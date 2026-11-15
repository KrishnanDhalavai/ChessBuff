import chess
from typing import Dict, List, Optional, Any, Tuple
from .bitboard import has_luft

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 100,
}

def square_name(sq: int) -> str:
    return chess.square_name(sq)

def piece_symbol_name(pt: int) -> str:
    names = {
        chess.PAWN: "pawn",
        chess.KNIGHT: "knight",
        chess.BISHOP: "bishop",
        chess.ROOK: "rook",
        chess.QUEEN: "queen",
        chess.KING: "king",
    }
    return names.get(pt, "piece")

def compute_quiescence_material_delta(
    board: chess.Board,
    pv_line: List[chess.Move],
    mover_color: chess.Color,
    max_plies: int = 6
) -> Dict[str, Any]:
    """
    Play forward along pv_line until captures resolve,
    tracking net material change for mover_color and details of captures.
    """
    b = board.copy(stack=False)
    net_delta = 0
    captures_resolved = []

    for idx, move in enumerate(pv_line[:max_plies]):
        if b.is_capture(move):
            to_sq = move.to_square
            captured = b.piece_at(to_sq)
            if captured is not None:
                val = PIECE_VALUES.get(captured.piece_type, 0)
                # If mover is capturing, it's positive for mover
                if b.turn == mover_color:
                    net_delta += val
                else:
                    net_delta -= val
                captures_resolved.append({
                    "ply": idx + 1,
                    "by_turn": "mover" if b.turn == mover_color else "opponent",
                    "captured_piece": piece_symbol_name(captured.piece_type),
                    "square": square_name(to_sq),
                    "value": val,
                })
        b.push(move)

    return {
        "net_material_delta": net_delta,
        "captures": captures_resolved,
    }

def detect_fork(board: chess.Board, move: chess.Move) -> Optional[Dict[str, Any]]:
    """
    Computes bitwise attack mask of the moved piece on destination square.
    If it simultaneously intersects >= 2 enemy pieces that are higher in value
    or completely undefended, flags fork with attacker_sq, target_1_sq, target_2_sq.
    """
    to_sq = move.to_square
    piece = board.piece_at(to_sq)
    if not piece:
        return None

    attacker_color = piece.color
    enemy_color = not attacker_color
    attacker_val = PIECE_VALUES.get(piece.piece_type, 1)

    # Squares attacked by this piece from to_sq
    attacked_sqs = board.attacks(to_sq)
    
    valid_targets = []
    for target_sq in attacked_sqs:
        target_piece = board.piece_at(target_sq)
        if target_piece and target_piece.color == enemy_color:
            target_val = PIECE_VALUES.get(target_piece.piece_type, 1)
            # Piece is either higher value or king or undefended
            defenders = board.attackers(enemy_color, target_sq)
            if target_val > attacker_val or target_piece.piece_type == chess.KING or len(defenders) == 0:
                valid_targets.append({
                    "square": square_name(target_sq),
                    "piece": piece_symbol_name(target_piece.piece_type),
                    "value": target_val
                })

    if len(valid_targets) >= 2:
        # Sort targets by value descending
        valid_targets.sort(key=lambda t: t["value"], reverse=True)
        return {
            "type": "fork",
            "attacker": square_name(to_sq),
            "attacker_piece": piece_symbol_name(piece.piece_type),
            "target1": valid_targets[0]["square"],
            "target1_piece": valid_targets[0]["piece"],
            "target2": valid_targets[1]["square"],
            "target2_piece": valid_targets[1]["piece"],
        }
    return None

def detect_pins(board_before: chess.Board, board_after: chess.Board, mover_color: chess.Color) -> Optional[Dict[str, Any]]:
    """
    Compares pinned-piece bitmasks before and after move to detect newly pinned pieces.
    """
    enemy_color = not mover_color
    # Pinned pieces of the opponent against opponent king
    pinned_before = board_before.pin_mask(enemy_color, board_before.king(enemy_color)) if board_before.king(enemy_color) is not None else 0
    pinned_after = board_after.pin_mask(enemy_color, board_after.king(enemy_color)) if board_after.king(enemy_color) is not None else 0

    new_pins = pinned_after & ~pinned_before
    if new_pins:
        sqs = []
        for sq in range(64):
            if (new_pins >> sq) & 1:
                p = board_after.piece_at(sq)
                if p:
                    sqs.append({
                        "square": square_name(sq),
                        "piece": piece_symbol_name(p.piece_type)
                    })
        if sqs:
            return {
                "type": "pin",
                "pinned_pieces": sqs,
            }
    return None

def detect_hanging_pieces(board: chess.Board, color: chess.Color) -> List[Dict[str, Any]]:
    """
    Detect undefended or underdefended pieces for the given color that are attacked by opponent.
    """
    opponent = not color
    hanging = []
    for sq in range(64):
        piece = board.piece_at(sq)
        if piece and piece.color == color and piece.piece_type != chess.KING:
            attackers = board.attackers(opponent, sq)
            if attackers:
                defenders = board.attackers(color, sq)
                piece_val = PIECE_VALUES.get(piece.piece_type, 1)
                # Truly hanging if undefended, or if attacked by lower value piece
                min_attacker_val = min(
                    PIECE_VALUES.get(board.piece_at(a).piece_type, 1)
                    for a in attackers if board.piece_at(a)
                )
                if len(defenders) == 0 or min_attacker_val < piece_val:
                    hanging.append({
                        "square": square_name(sq),
                        "piece": piece_symbol_name(piece.piece_type),
                        "value": piece_val,
                    })
    return hanging

def extract_symbolic_tactics(
    board_before: chess.Board,
    move_played: chess.Move,
    board_after: chess.Board,
    pv_refute: List[chess.Move],
    pv_best: List[chess.Move],
    mover_color: chess.Color,
    is_mate_threat: bool = False
) -> Dict[str, Any]:
    """
    Extract verified, hallucination-free symbolic tactical facts for a played move.
    """
    tactics = {
        "fork": None,
        "pin": None,
        "hanging_pieces": [],
        "quiescence": None,
        "back_rank_weakness": False,
        "missed_mate": False,
        "best_move_san": None,
        "refutation_san": [],
        "arrows": [],
    }

    # Best move SAN & PV SAN
    try:
        if pv_best:
            tactics["best_move_san"] = board_before.san(pv_best[0])
    except Exception:
        pass

    # Refutation sequence in SAN
    try:
        ref_b = board_after.copy(stack=False)
        ref_san = []
        for m in pv_refute[:4]:
            if m in ref_b.legal_moves:
                ref_san.append(ref_b.san(m))
                ref_b.push(m)
            else:
                break
        tactics["refutation_san"] = ref_san
    except Exception:
        pass

    # Quiescence calculation
    if pv_refute:
        tactics["quiescence"] = compute_quiescence_material_delta(board_after, pv_refute, mover_color)

    # Fork by played move
    fork_info = detect_fork(board_after, move_played)
    if fork_info:
        tactics["fork"] = fork_info
        tactics["arrows"].append({
            "from": fork_info["attacker"],
            "to": fork_info["target1"],
            "color": "#1BACA6"  # Teal fork highlight
        })
        tactics["arrows"].append({
            "from": fork_info["attacker"],
            "to": fork_info["target2"],
            "color": "#1BACA6"
        })

    # Pins
    pin_info = detect_pins(board_before, board_after, mover_color)
    if pin_info:
        tactics["pin"] = pin_info

    # Hanging pieces left after move
    hanging = detect_hanging_pieces(board_after, mover_color)
    if hanging:
        tactics["hanging_pieces"] = hanging

    # Back-rank weakness
    enemy_color = not mover_color
    if not has_luft(board_after, enemy_color):
        tactics["back_rank_weakness"] = True

    # Missed mate
    if is_mate_threat:
        tactics["missed_mate"] = True

    return tactics
