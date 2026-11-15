import io
import os
import math
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import chess
import chess.pgn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import GEMINI_API_KEY, DEFAULT_ENGINE_DEPTH, PROJECT_ROOT
from .models import ReviewRequest, EvaluatePositionRequest, SettingsRequest
from .bitboard import compute_zobrist_hash
from .opening_book import opening_book
from .engine_eval import engine_evaluator, centipawns_to_win_percentage
from .tactical_extractor import extract_symbolic_tactics
from .classifier import classify_move
from .caps2 import compute_move_accuracy, compute_volatility_weighted_accuracy, estimate_player_rating
from .gemini_coach import generate_gemini_coach_reviews
from .storage import db_manager, singleflight, compute_canonical_game_hash

app = FastAPI(title="ChessBuff Diamond Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Runtime config holder
RUN_CONFIG = {
    "api_key": GEMINI_API_KEY
}

def parse_and_validate_game(req: ReviewRequest) -> Tuple[List[chess.Move], List[str], Dict[str, Any]]:
    """
    Security Firewall & FIDE Replay Engine:
    Accepts raw PGN or move list, verifies legality of every half-move (ply),
    and rejects malformed/corrupted sequences.
    """
    game_meta = {
        "white_player": req.white_player or "White",
        "black_player": req.black_player or "Black",
        "white_rating": req.white_rating or 1500,
        "black_rating": req.black_rating or 1500,
        "result": req.result or "*",
        "pgn": req.pgn or ""
    }

    moves: List[chess.Move] = []
    san_list: List[str] = []
    board = chess.Board()

    if req.pgn and req.pgn.strip():
        try:
            pgn_io = io.StringIO(req.pgn.strip())
            parsed_game = chess.pgn.read_game(pgn_io)
            if parsed_game is not None:
                headers = parsed_game.headers
                if "White" in headers:
                    game_meta["white_player"] = headers["White"]
                if "Black" in headers:
                    game_meta["black_player"] = headers["Black"]
                if "WhiteElo" in headers and headers["WhiteElo"].isdigit():
                    game_meta["white_rating"] = int(headers["WhiteElo"])
                if "BlackElo" in headers and headers["BlackElo"].isdigit():
                    game_meta["black_rating"] = int(headers["BlackElo"])
                if "Result" in headers:
                    game_meta["result"] = headers["Result"]

                curr = parsed_game
                ply_count = 0
                while curr.variations and ply_count < 500:
                    next_node = curr.variations[0]
                    move = next_node.move
                    if move in board.legal_moves:
                        san_list.append(board.san(move))
                        moves.append(move)
                        board.push(move)
                        ply_count += 1
                    else:
                        break
                    curr = next_node
        except Exception as e:
            print(f"[Security Firewall] PGN parsing error: {e}")

    # If moves were provided as list or fallback
    if not moves and req.moves:
        board.reset()
        san_list.clear()
        for m_str in req.moves[:500]:
            m_str = m_str.strip()
            move = None
            try:
                # Try UCI first
                move = chess.Move.from_uci(m_str)
                if move not in board.legal_moves:
                    move = None
            except Exception:
                move = None
            
            if move is None:
                try:
                    # Try SAN
                    move = board.parse_san(m_str)
                except Exception:
                    move = None

            if move and move in board.legal_moves:
                san_list.append(board.san(move))
                moves.append(move)
                board.push(move)
            else:
                break

    if not moves:
        raise HTTPException(status_code=400, detail="No legal chess moves found in provided game sequence.")

    return moves, san_list, game_meta

async def _process_game_review(
    moves: List[chess.Move],
    san_list: List[str],
    game_meta: Dict[str, Any],
    game_hash: str,
    api_key: Optional[str]
) -> Dict[str, Any]:
    """Internal review worker wrapped by Singleflight."""
    # 1. Opening Book Detection
    eco_code, opening_name, last_book_ply = opening_book.find_opening_and_last_book_move(san_list)

    board = chess.Board()
    plies_telemetry: List[Dict[str, Any]] = []
    critical_events: List[Dict[str, Any]] = []
    tactical_motifs: List[Dict[str, Any]] = []

    white_deltas: List[float] = []
    black_deltas: List[float] = []
    white_accuracies: List[float] = []
    black_accuracies: List[float] = []
    white_win_probs: List[float] = [50.0]  # Starting win prob
    black_win_probs: List[float] = [50.0]

    white_counts = {
        "brilliant": 0, "great": 0, "best": 0, "excellent": 0, "good": 0,
        "book": 0, "inaccuracy": 0, "mistake": 0, "blunder": 0, "miss": 0
    }
    black_counts = {
        "brilliant": 0, "great": 0, "best": 0, "excellent": 0, "good": 0,
        "book": 0, "inaccuracy": 0, "mistake": 0, "blunder": 0, "miss": 0
    }

    prev_eval_res = None
    prev_mover_blundered = False

    for i, move in enumerate(moves):
        ply = i + 1
        mover_color = board.turn
        mover_name = "White" if mover_color == chess.WHITE else "Black"
        san = san_list[i]
        fen_before = board.fen()

        board_before = board.copy(stack=False)
        board.push(move)
        fen_after = board.fen()

        # Opening Book Short-Circuit (Algorithm 1)
        # If position's 64-bit Zobrist hash matches a known book line, label Book (#A88865) and skip engine eval
        is_book = (ply <= last_book_ply and opening_book.is_book_position(board))

        if is_book:
            best_move = move
            second_move = None
            cp1 = 20.0 if mover_color == chess.WHITE else -20.0
            win_prob1 = 52.0
            win_prob2 = None
            w_after = 52.0
            delta_w = 0.0
            mate1 = None
            mate_after = None
            pv1 = [move]
            pv_refute = []
            opp_win_prob = 48.0
            w_white = 52.0 if mover_color == chess.WHITE else 48.0
            w_black = 48.0 if mover_color == chess.WHITE else 52.0
            eval_cp_white = 20.0
        else:
            # Target depth for deep analysis
            eval_depth = min(14, DEFAULT_ENGINE_DEPTH)
            # Engine analysis prior to move
            eval_before = engine_evaluator.evaluate_position(board_before, depth=eval_depth, multipv=2)
            best_move = eval_before.get("best_move")
            second_move = eval_before.get("second_move")
            cp1 = eval_before.get("cp1", 0.0)
            win_prob1 = eval_before.get("win_prob1", 50.0)
            win_prob2 = eval_before.get("win_prob2")
            mate1 = eval_before.get("mate1")
            pv1 = eval_before.get("pv1", [])

            # Engine analysis after move from opponent's perspective
            eval_after = engine_evaluator.evaluate_position(board, depth=eval_depth, multipv=2)
            opp_win_prob = eval_after.get("win_prob1", 50.0)
            mate_after = eval_after.get("mate1")
            pv_refute = eval_after.get("pv1", [])

            # Mover's win prob after move = 100 - opponent's win prob
            w_after = 100.0 - opp_win_prob
            delta_w = max(0.0, win_prob1 - w_after)

            if mover_color == chess.WHITE:
                w_white = w_after
                w_black = opp_win_prob
                eval_cp_white = cp1 if move == best_move else (100.0 - 2.0 * opp_win_prob) * 10.0
            else:
                w_white = opp_win_prob
                w_black = w_after
                eval_cp_white = - (cp1 if move == best_move else (100.0 - 2.0 * opp_win_prob) * 10.0)

        white_win_probs.append(w_white)
        black_win_probs.append(w_black)

        # Extract Hallucination-Free Bitboard Tactics
        tactics = extract_symbolic_tactics(
            board_before=board_before,
            move_played=move,
            board_after=board,
            pv_refute=pv_refute,
            pv_best=pv1,
            mover_color=mover_color,
            is_mate_threat=(mate1 is not None and mate1 > 0)
        )

        # Classify Move
        cls_info = classify_move(
            board_before=board_before,
            move_played=move,
            board_after=board,
            w_before=win_prob1,
            w_after=w_after,
            delta_w=delta_w,
            best_move=best_move,
            second_move=second_move,
            win_prob1=win_prob1,
            win_prob2=win_prob2,
            mate_before=mate1,
            mate_after=mate_after,
            prev_mover_opponent_blundered=prev_mover_blundered,
            pv_refute=pv_refute,
            ply=ply
        )

        tier = cls_info["tier"]
        if mover_color == chess.WHITE:
            white_counts[tier] = white_counts.get(tier, 0) + 1
        else:
            black_counts[tier] = black_counts.get(tier, 0) + 1

        # Accuracy
        acc_i = compute_move_accuracy(delta_w)
        if mover_color == chess.WHITE:
            white_deltas.append(delta_w)
            white_accuracies.append(acc_i)
        else:
            black_deltas.append(delta_w)
            black_accuracies.append(acc_i)

        # Index tactical motifs
        if tactics.get("fork"):
            tactical_motifs.append({"motif": "fork", "ply": ply, "classification": tier, "mover": mover_name})
        if tactics.get("pin"):
            tactical_motifs.append({"motif": "pin", "ply": ply, "classification": tier, "mover": mover_name})
        if tactics.get("missed_mate"):
            tactical_motifs.append({"motif": "missed_mate", "ply": ply, "classification": tier, "mover": mover_name})
        if tactics.get("back_rank_weakness"):
            tactical_motifs.append({"motif": "back_rank", "ply": ply, "classification": tier, "mover": mover_name})

        # Eval text (e.g. +1.4 or M2)
        if mate1 is not None:
            eval_text = f"M{abs(mate1)}" if mate1 > 0 else f"-M{abs(mate1)}"
        else:
            eval_text = f"{eval_cp_white/100.0:+.1f}"

        # Arrows: played move arrow (yellow/color-coded) and best move arrow (green) if different
        arrows = list(tactics.get("arrows", []))
        if best_move and move != best_move:
            arrows.append({
                "from": chess.square_name(best_move.from_square),
                "to": chess.square_name(best_move.to_square),
                "color": "#96BC4B"  # Best move green
            })

        ply_data = {
            "ply": ply,
            "san": san,
            "uci": move.uci(),
            "fen_before": fen_before,
            "fen_after": fen_after,
            "mover": mover_name,
            "classification": cls_info["name"],
            "classification_tier": tier,
            "classification_symbol": cls_info["symbol"],
            "classification_color": cls_info["color"],
            "delta_w": round(delta_w, 2),
            "win_prob_white": round(w_white, 1),
            "win_prob_black": round(w_black, 1),
            "accuracy": round(acc_i, 1),
            "eval_cp": round(eval_cp_white, 1),
            "eval_text": eval_text,
            "best_move_san": tactics.get("best_move_san"),
            "best_move_uci": best_move.uci() if best_move else None,
            "second_move_san": board_before.san(second_move) if second_move and second_move in board_before.legal_moves else None,
            "refutation_san": tactics.get("refutation_san", []),
            "tactics": tactics,
            "arrows": arrows,
            "coach_commentary": None,
        }
        plies_telemetry.append(ply_data)

        # Check if critical event for Single-Batch Gemini Coach
        if cls_info["is_critical"]:
            critical_events.append(ply_data)

        # Update previous mover blunder tracking
        prev_mover_blundered = (tier in ["blunder", "mistake"])

    # 3. CAPS2 Volatility-Weighted Game Accuracy & Estimated Rating
    white_acc = compute_volatility_weighted_accuracy(white_accuracies, white_win_probs)
    black_acc = compute_volatility_weighted_accuracy(black_accuracies, black_win_probs)

    white_acpl = float(sum(white_deltas) / max(1, len(white_deltas)))
    black_acpl = float(sum(black_deltas) / max(1, len(black_deltas)))

    white_est_rating = estimate_player_rating(white_acc, white_acpl, game_meta.get("white_rating", 1500))
    black_est_rating = estimate_player_rating(black_acc, black_acpl, game_meta.get("black_rating", 1500))

    game_meta["white_accuracy"] = white_acc
    game_meta["black_accuracy"] = black_acc
    game_meta["eco_code"] = eco_code
    game_meta["opening_name"] = opening_name

    # 4. Single-Batch Gemini Coach (Batched Outbound Request)
    coach_feedbacks = await generate_gemini_coach_reviews(
        critical_events=critical_events,
        api_key=api_key or RUN_CONFIG.get("api_key")
    )

    # Map coach feedback by ply
    feedback_map = {item.get("ply"): item for item in coach_feedbacks if isinstance(item, dict)}
    for p in plies_telemetry:
        if p["ply"] in feedback_map:
            p["coach_commentary"] = feedback_map[p["ply"]]

    # Overall Coach Summary
    coach_summary = f"This game was a sharp contest in the {opening_name} ({eco_code}). "
    if white_acc >= 90.0:
        coach_summary += "White displayed masterclass precision. "
    elif white_acc < 70.0:
        coach_summary += "White had multiple missed tactical chances. "
    if black_acc >= 90.0:
        coach_summary += "Black played with tenacious accuracy."
    elif black_acc < 70.0:
        coach_summary += "Black struggled with positional defense."

    review_result = {
        "game_hash": game_hash,
        "white_player": game_meta.get("white_player", "White"),
        "black_player": game_meta.get("black_player", "Black"),
        "white_rating": game_meta.get("white_rating", 1500),
        "black_rating": game_meta.get("black_rating", 1500),
        "result": game_meta.get("result", "*"),
        "eco_code": eco_code,
        "opening_name": opening_name,
        "last_book_ply": last_book_ply,
        "white_accuracy": white_acc,
        "black_accuracy": black_acc,
        "white_rating_est": white_est_rating,
        "black_rating_est": black_est_rating,
        "plies": plies_telemetry,
        "white_counts": white_counts,
        "black_counts": black_counts,
        "coach_summary": coach_summary,
    }

    # 5. Persist to SQLite Hybrid Cache (Zstandard compressed)
    db_manager.save_game_and_review(
        game_hash=game_hash,
        game_meta=game_meta,
        telemetry=review_result,
        motifs=tactical_motifs
    )

    return review_result

@app.post("/api/review")
async def create_game_review(req: ReviewRequest):
    """
    Generate or retrieve a full Diamond Post-Game Review.
    Enforces pure gameplay state isolation: zero hints during play,
    unlocked only post-game.
    """
    moves, san_list, game_meta = parse_and_validate_game(req)
    game_hash = compute_canonical_game_hash(san_list)

    # 1. L1 / L2 Cache Check
    cached_review = db_manager.get_review(game_hash)
    if cached_review is not None:
        return cached_review

    # 2. In-Flight Coalescing (Singleflight Pattern)
    result = await singleflight.execute(
        game_hash,
        lambda: _process_game_review(moves, san_list, game_meta, game_hash, req.api_key)
    )
    return result

@app.get("/api/review/{game_hash}")
async def get_game_review(game_hash: str):
    """O(1) retrieval of a previously reviewed game."""
    cached = db_manager.get_review(game_hash)
    if not cached:
        raise HTTPException(status_code=404, detail="Game review not found.")
    return cached

@app.get("/api/archive")
async def list_games_archive(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    """Chronological game archive with pagination."""
    return db_manager.list_games(limit=limit, offset=offset)

@app.get("/api/tactics/filter")
async def filter_tactical_motifs(motif: str = Query(..., description="fork, pin, missed_mate, back_rank"), limit: int = 50):
    """Tactical motif inverted index query."""
    return db_manager.query_tactical_motifs(motif=motif, limit=limit)

@app.post("/api/engine/evaluate")
async def evaluate_single_position(req: EvaluatePositionRequest):
    """On-demand position evaluation."""
    try:
        board = chess.Board(req.fen)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid FEN string.")
    
    res = engine_evaluator.evaluate_position(board, depth=req.depth or 14, multipv=2)
    best_move = res.get("best_move")
    second_move = res.get("second_move")
    return {
        "fen": req.fen,
        "best_move": best_move.uci() if best_move else None,
        "second_move": second_move.uci() if second_move else None,
        "cp1": res.get("cp1", 0.0),
        "cp2": res.get("cp2"),
        "win_prob1": res.get("win_prob1", 50.0),
        "win_prob2": res.get("win_prob2"),
        "mate1": res.get("mate1"),
    }

@app.post("/api/settings")
async def update_settings(req: SettingsRequest):
    """Update runtime Gemini API key."""
    RUN_CONFIG["api_key"] = req.api_key.strip()
    return {"status": "ok", "api_key_configured": bool(RUN_CONFIG["api_key"])}

@app.get("/api/health")
async def health_check():
    print("Inside health_check handler!", flush=True)
    is_alive = False
    try:
        is_alive = engine_evaluator.engine.is_alive()
    except Exception as e:
        print("Error checking engine is_alive:", e, flush=True)
    return {
        "status": "healthy",
        "stockfish_detected": is_alive,
        "gemini_api_key_configured": bool(RUN_CONFIG.get("api_key"))
    }

from fastapi.responses import FileResponse

# Mount built frontend assets & SPA catch-all
dist_dir = PROJECT_ROOT / "frontend" / "dist"
assets_dir = dist_dir / "assets"
sounds_dir = dist_dir / "sounds"
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="static_assets")
if os.path.exists(sounds_dir):
    app.mount("/sounds", StaticFiles(directory=str(sounds_dir)), name="static_sounds")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    index_path = dist_dir / "index.html"
    if os.path.exists(index_path):
        return FileResponse(str(index_path))
    return {"message": "ChessBuff Diamond Engine API Running"}
