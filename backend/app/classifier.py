import chess
from typing import Dict, Any, Optional, List
from .opening_book import opening_book
from .tactical_extractor import PIECE_VALUES

CLASSIFICATION_COLORS = {
    "book": "#A88865",
    "brilliant": "#1BACA6",
    "great": "#5C8BB0",
    "best": "#96BC4B",
    "excellent": "#96BC4B",
    "good": "#95AF8A",
    "inaccuracy": "#F7C631",
    "mistake": "#E6912C",
    "blunder": "#CA3431",
    "miss": "#FF6B6B",
}

CLASSIFICATION_SYMBOLS = {
    "book": "Book",
    "brilliant": "!!",
    "great": "!",
    "best": "★",
    "excellent": "Excellent",
    "good": "Good",
    "inaccuracy": "?!",
    "mistake": "?",
    "blunder": "??",
    "miss": "Miss",
}

def is_piece_en_prise_or_sacrificed(
    board_before: chess.Board,
    move: chess.Move,
    board_after: chess.Board,
    refutation_pv: List[chess.Move]
) -> bool:
    """
    Check if the move executes a material sacrifice:
    1. Static material balance decreases after opponent's best capture reply, OR
    2. Moved piece lands on a square where it is en prise (attacked by lower value or undefended).
    """
    mover = board_before.turn
    opponent = not mover
    to_sq = move.to_square
    moved_piece = board_after.piece_at(to_sq)
    if not moved_piece or moved_piece.piece_type == chess.KING:
        return False

    moved_val = PIECE_VALUES.get(moved_piece.piece_type, 1)

    # Check if opponent attacks destination square
    attackers = board_after.attackers(opponent, to_sq)
    defenders = board_after.attackers(mover, to_sq)

    if attackers:
        min_attacker_val = min(
            PIECE_VALUES.get(board_after.piece_at(a).piece_type, 1)
            for a in attackers if board_after.piece_at(a)
        )
        # En prise if undefended or attacked by lower-value piece (e.g. Queen attacked by Knight or Bishop)
        if len(defenders) == 0 or min_attacker_val < moved_val:
            return True

    # Check if first move of opponent refutation/response is a capture of equal/higher piece
    if refutation_pv and len(refutation_pv) > 0:
        opp_reply = refutation_pv[0]
        if board_after.is_capture(opp_reply):
            captured_sq = opp_reply.to_square
            captured_p = board_after.piece_at(captured_sq)
            if captured_p and captured_p.color == mover:
                if PIECE_VALUES.get(captured_p.piece_type, 0) >= 3:
                    return True

    return False

def classify_move(
    board_before: chess.Board,
    move_played: chess.Move,
    board_after: chess.Board,
    w_before: float,
    w_after: float,
    delta_w: float,
    best_move: Optional[chess.Move],
    second_move: Optional[chess.Move],
    win_prob1: float,
    win_prob2: Optional[float],
    mate_before: Optional[int],
    mate_after: Optional[int],
    prev_mover_opponent_blundered: bool,
    pv_refute: List[chess.Move],
    ply: int
) -> Dict[str, Any]:
    """
    Deterministic Move Classification State Machine.
    Evaluates rules in strict priority order.
    """
    # 1. Opening Book
    if opening_book.is_book_position(board_after) and ply <= 24:
        return {
            "tier": "book",
            "symbol": CLASSIFICATION_SYMBOLS["book"],
            "color": CLASSIFICATION_COLORS["book"],
            "name": "Book",
            "is_critical": False,
        }

    # Blunder condition check
    turns_mate_into_non_mate = (mate_before is not None and mate_before > 0 and (mate_after is None or mate_after <= 0))
    allows_forced_mate = (mate_after is not None and mate_after < 0)

    # 2. Brilliant (!!)
    # delta_w <= 2.0%, material sacrifice, not already overwhelmingly winning (w_before < 85%)
    if delta_w <= 2.0 and w_before < 85.0:
        if is_piece_en_prise_or_sacrificed(board_before, move_played, board_after, pv_refute):
            return {
                "tier": "brilliant",
                "symbol": CLASSIFICATION_SYMBOLS["brilliant"],
                "color": CLASSIFICATION_COLORS["brilliant"],
                "name": "Brilliant",
                "is_critical": True,
            }

    # 3. Great (!)
    # Played move matches PV1 (delta_w <= 1.0%), and gap between best & second-best is critical:
    # W(cp1) - W(cp2) >= 15.0% (only move that holds advantage or draw)
    if delta_w <= 1.0 and win_prob2 is not None:
        if (win_prob1 - win_prob2) >= 15.0:
            return {
                "tier": "great",
                "symbol": CLASSIFICATION_SYMBOLS["great"],
                "color": CLASSIFICATION_COLORS["great"],
                "name": "Great",
                "is_critical": True,
            }

    # 4. Miss
    # On ply i-1, opponent committed mistake/blunder that spiked current mover's win prob >= 15%,
    # and on ply i, mover failed to capitalize, dropping W_after back down by >= 15%.
    if prev_mover_opponent_blundered and delta_w >= 15.0:
        return {
            "tier": "miss",
            "symbol": CLASSIFICATION_SYMBOLS["miss"],
            "color": CLASSIFICATION_COLORS["miss"],
            "name": "Miss",
            "is_critical": True,
        }

    # 5. Standard Precision Thresholds
    # Blunder (??)
    if delta_w > 22.0 or turns_mate_into_non_mate or allows_forced_mate:
        return {
            "tier": "blunder",
            "symbol": CLASSIFICATION_SYMBOLS["blunder"],
            "color": CLASSIFICATION_COLORS["blunder"],
            "name": "Blunder",
            "is_critical": True,
        }

    # Mistake (?)
    if 12.0 < delta_w <= 22.0:
        return {
            "tier": "mistake",
            "symbol": CLASSIFICATION_SYMBOLS["mistake"],
            "color": CLASSIFICATION_COLORS["mistake"],
            "name": "Mistake",
            "is_critical": True,
        }

    # Inaccuracy (?!)
    if 6.0 < delta_w <= 12.0:
        return {
            "tier": "inaccuracy",
            "symbol": CLASSIFICATION_SYMBOLS["inaccuracy"],
            "color": CLASSIFICATION_COLORS["inaccuracy"],
            "name": "Inaccuracy",
            "is_critical": True,
        }

    # Good
    if 3.0 < delta_w <= 6.0:
        return {
            "tier": "good",
            "symbol": CLASSIFICATION_SYMBOLS["good"],
            "color": CLASSIFICATION_COLORS["good"],
            "name": "Good",
            "is_critical": False,
        }

    # Excellent
    if 1.0 < delta_w <= 3.0:
        return {
            "tier": "excellent",
            "symbol": CLASSIFICATION_SYMBOLS["excellent"],
            "color": CLASSIFICATION_COLORS["excellent"],
            "name": "Excellent",
            "is_critical": False,
        }

    # Best (★)
    # Move equals PV1 or delta_w <= 1.0%
    return {
        "tier": "best",
        "symbol": CLASSIFICATION_SYMBOLS["best"],
        "color": CLASSIFICATION_COLORS["best"],
        "name": "Best",
        "is_critical": False,
    }
