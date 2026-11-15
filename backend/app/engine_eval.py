import math
import os
import subprocess
import threading
from typing import Dict, List, Optional, Tuple, Any
import chess
from .config import STOCKFISH_PATH, DEFAULT_ENGINE_DEPTH
from .bitboard import compute_zobrist_hash

# Transposition cache: (zobrist_hash, depth) -> CachedEngineEval
_TRANSPOSITION_CACHE: Dict[Tuple[int, int], Dict[str, Any]] = {}

def centipawns_to_win_percentage(cp: float) -> float:
    """
    Sigmoid Win-Probability Mapping:
    W(cp) = 100 / (1 + exp(-0.00368208 * cp))
    cp is clamped to [-1000, 1000].
    """
    clamped_cp = max(-1000.0, min(1000.0, float(cp)))
    return 100.0 / (1.0 + math.exp(-0.00368208 * clamped_cp))

class DirectUciEngine:
    """
    Direct high-speed UCI controller over Stockfish subprocess pipes.
    Sub-50ms MultiPV=2 evaluations with zero deadlock.
    """
    def __init__(self, stockfish_path: str = STOCKFISH_PATH):
        self.stockfish_path = stockfish_path
        self._proc: Optional[subprocess.Popen] = None
        self._lock = threading.RLock()
        # Lazy initialization on first search

    def _ensure_process(self):
        if self._proc is None or self._proc.poll() is not None:
            self._init_process()

    def _init_process(self):
        if not os.path.exists(self.stockfish_path):
            return

        try:
            self._proc = subprocess.Popen(
                [self.stockfish_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                close_fds=True,
            )
            self._proc.stdin.write("uci\n")
            self._proc.stdin.flush()
            while True:
                line = self._proc.stdout.readline()
                if not line or "uciok" in line:
                    break

            self._proc.stdin.write("setoption name MultiPV value 2\n")
            self._proc.stdin.write("setoption name Threads value 2\n")
            self._proc.stdin.write("setoption name Hash value 32\n")
            self._proc.stdin.write("isready\n")
            self._proc.stdin.flush()
            
            while True:
                line = self._proc.stdout.readline()
                if not line or "readyok" in line:
                    break
        except Exception as e:
            print(f"[DirectUciEngine] Failed to launch Stockfish: {e}")
            self._proc = None

    def close(self):
        with self._lock:
            if self._proc:
                try:
                    self._proc.stdin.write("quit\n")
                    self._proc.stdin.flush()
                    self._proc.wait(timeout=1.0)
                except Exception:
                    self._proc.kill()
                self._proc = None

    def is_alive(self) -> bool:
        with self._lock:
            self._ensure_process()
            return self._proc is not None and self._proc.poll() is None

    def analyse_sync(self, fen: str, depth: int = DEFAULT_ENGINE_DEPTH) -> Dict[str, Any]:
        """Synchronously query Stockfish with MultiPV=2 (Strictly Sanitized against UCI injection)."""
        # Sanitize FEN against newlines/control characters and clamp search depth
        clean_fen = " ".join(fen.strip().split())
        safe_depth = max(1, min(int(depth), 24))

        with self._lock:
            self._ensure_process()
            if not self.is_alive():
                return {}

            self._proc.stdin.write(f"position fen {clean_fen}\n")
            self._proc.stdin.write(f"go depth {safe_depth}\n")
            self._proc.stdin.flush()

            pv1_data: Dict[str, Any] = {"cp": 0.0, "mate": None, "pv": []}
            pv2_data: Dict[str, Any] = {"cp": 0.0, "mate": None, "pv": []}
            best_move_str = None

            while True:
                line = self._proc.stdout.readline()
                if not line:
                    break
                line = line.strip()

                if line.startswith("bestmove"):
                    parts = line.split()
                    if len(parts) >= 2:
                        best_move_str = parts[1]
                    break

                if "multipv" in line and "score" in line:
                    tokens = line.split()
                    try:
                        mpv_idx = tokens.index("multipv")
                        mpv_num = int(tokens[mpv_idx + 1])
                        score_idx = tokens.index("score")
                        score_type = tokens[score_idx + 1]
                        score_val = int(tokens[score_idx + 2])

                        pv_moves = []
                        if "pv" in tokens:
                            pv_idx = tokens.index("pv")
                            pv_moves = tokens[pv_idx + 1:]

                        target_dict = pv1_data if mpv_num == 1 else pv2_data
                        if score_type == "cp":
                            target_dict["cp"] = float(score_val)
                            target_dict["mate"] = None
                        elif score_type == "mate":
                            target_dict["mate"] = score_val
                            target_dict["cp"] = 1000.0 - min(20.0, score_val) if score_val > 0 else -1000.0 - max(-20.0, score_val)
                        if pv_moves:
                            target_dict["pv"] = pv_moves
                    except Exception:
                        pass

            return {
                "pv1": pv1_data,
                "pv2": pv2_data,
                "bestmove": best_move_str,
            }

class EngineEvaluator:
    def __init__(self, stockfish_path: str = STOCKFISH_PATH):
        self.engine = DirectUciEngine(stockfish_path)

    def close(self):
        self.engine.close()

    def evaluate_position(
        self,
        board: chess.Board,
        depth: int = DEFAULT_ENGINE_DEPTH,
        multipv: int = 2
    ) -> Dict[str, Any]:
        """
        Evaluate a single board position with MultiPV=2.
        Returns:
            best_move: chess.Move
            second_move: Optional[chess.Move]
            cp1: float (from perspective of board.turn)
            cp2: Optional[float]
            pv1: List[chess.Move]
            pv2: List[chess.Move]
            win_prob1: float [0, 100]
            win_prob2: Optional[float] [0, 100]
            mate1: Optional[int]
        """
        z_hash = compute_zobrist_hash(board)
        cache_key = (z_hash, depth)
        if cache_key in _TRANSPOSITION_CACHE:
            return _TRANSPOSITION_CACHE[cache_key]

        fen = board.fen()
        mover = board.turn

        res = self.engine.analyse_sync(fen, depth)
        
        if res and res.get("bestmove"):
            pv1 = res.get("pv1", {})
            pv2 = res.get("pv2", {})

            raw_cp1 = pv1.get("cp", 0.0)
            mate1 = pv1.get("mate")
            win_prob1 = centipawns_to_win_percentage(raw_cp1)

            def parse_pv_moves(str_moves: List[str]) -> List[chess.Move]:
                parsed = []
                b = board.copy(stack=False)
                for sm in str_moves:
                    try:
                        m = chess.Move.from_uci(sm)
                        if m in b.legal_moves:
                            parsed.append(m)
                            b.push(m)
                        else:
                            break
                    except Exception:
                        break
                return parsed

            pv1_moves = parse_pv_moves(pv1.get("pv", []))
            best_move = pv1_moves[0] if pv1_moves else (
                chess.Move.from_uci(res["bestmove"]) if res.get("bestmove") in [m.uci() for m in board.legal_moves] else None
            )

            second_move = None
            cp2 = None
            win_prob2 = None
            pv2_moves = []
            if pv2.get("pv"):
                pv2_moves = parse_pv_moves(pv2.get("pv", []))
                if pv2_moves:
                    second_move = pv2_moves[0]
                    cp2 = pv2.get("cp", raw_cp1 - 25.0)
                    win_prob2 = centipawns_to_win_percentage(cp2)

            output = {
                "best_move": best_move,
                "second_move": second_move,
                "cp1": raw_cp1,
                "cp2": cp2,
                "pv1": pv1_moves,
                "pv2": pv2_moves,
                "win_prob1": win_prob1,
                "win_prob2": win_prob2,
                "mate1": mate1,
            }
            _TRANSPOSITION_CACHE[cache_key] = output
            return output

        return self._heuristic_fallback(board)

    def _heuristic_fallback(self, board: chess.Board) -> Dict[str, Any]:
        mover = board.turn
        piece_vals = {
            chess.PAWN: 100,
            chess.KNIGHT: 320,
            chess.BISHOP: 330,
            chess.ROOK: 500,
            chess.QUEEN: 900,
            chess.KING: 0,
        }
        white_mat = sum(len(board.pieces(pt, chess.WHITE)) * val for pt, val in piece_vals.items())
        black_mat = sum(len(board.pieces(pt, chess.BLACK)) * val for pt, val in piece_vals.items())
        diff = white_mat - black_mat
        cp = float(diff if mover == chess.WHITE else -diff)

        legal_moves = list(board.legal_moves)
        best_move = legal_moves[0] if legal_moves else None
        second_move = legal_moves[1] if len(legal_moves) > 1 else None

        win_prob = centipawns_to_win_percentage(cp)
        return {
            "best_move": best_move,
            "second_move": second_move,
            "cp1": cp,
            "cp2": cp - 25.0 if second_move else None,
            "pv1": [best_move] if best_move else [],
            "pv2": [second_move] if second_move else [],
            "win_prob1": win_prob,
            "win_prob2": win_prob - 5.0 if second_move else None,
            "mate1": None,
        }

engine_evaluator = EngineEvaluator()
