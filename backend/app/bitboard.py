import chess
import random
from typing import Tuple, List, Optional

# --- 16-Bit Move Encoding ---
# Bits 0-5:   Origin square (0-63)
# Bits 6-11:  Destination square (0-63)
# Bits 12-15: Flags
#   0: Quiet move
#   1: Double pawn push
#   2: King castle
#   3: Queen castle
#   4: Capture
#   5: En passant capture
#   8: Knight promotion
#   9: Bishop promotion
#  10: Rook promotion
#  11: Queen promotion
#  12: Knight promo capture
#  13: Bishop promo capture
#  14: Rook promo capture
#  15: Queen promo capture

FLAG_QUIET = 0
FLAG_DOUBLE_PAWN = 1
FLAG_KING_CASTLE = 2
FLAG_QUEEN_CASTLE = 3
FLAG_CAPTURE = 4
FLAG_EN_PASSANT = 5
FLAG_PROMO_KNIGHT = 8
FLAG_PROMO_BISHOP = 9
FLAG_PROMO_ROOK = 10
FLAG_PROMO_QUEEN = 11

def encode_move(move: chess.Move, board: chess.Board) -> int:
    """Pack a chess.Move into a uint16 integer."""
    from_sq = move.from_square
    to_sq = move.to_square
    flags = FLAG_QUIET

    is_capture = board.is_capture(move)
    is_ep = board.is_en_passant(move)
    is_castling = board.is_castling(move)
    piece = board.piece_at(from_sq)

    if move.promotion:
        promo_map = {
            chess.KNIGHT: FLAG_PROMO_KNIGHT,
            chess.BISHOP: FLAG_PROMO_BISHOP,
            chess.ROOK: FLAG_PROMO_ROOK,
            chess.QUEEN: FLAG_PROMO_QUEEN,
        }
        base_flag = promo_map.get(move.promotion, FLAG_PROMO_QUEEN)
        flags = (base_flag + 4) if is_capture else base_flag
    elif is_ep:
        flags = FLAG_EN_PASSANT
    elif is_castling:
        flags = FLAG_KING_CASTLE if to_sq > from_sq else FLAG_QUEEN_CASTLE
    elif is_capture:
        flags = FLAG_CAPTURE
    elif piece and piece.piece_type == chess.PAWN:
        if abs(to_sq - from_sq) == 16:
            flags = FLAG_DOUBLE_PAWN

    return (from_sq & 0x3F) | ((to_sq & 0x3F) << 6) | ((flags & 0xF) << 12)

def decode_move(encoded: int) -> Tuple[int, int, Optional[int]]:
    """Unpack a uint16 move into (from_sq, to_sq, promotion_piece)."""
    from_sq = encoded & 0x3F
    to_sq = (encoded >> 6) & 0x3F
    flags = (encoded >> 12) & 0xF

    promo_map = {
        FLAG_PROMO_KNIGHT: chess.KNIGHT,
        FLAG_PROMO_BISHOP: chess.BISHOP,
        FLAG_PROMO_ROOK: chess.ROOK,
        FLAG_PROMO_QUEEN: chess.QUEEN,
        12: chess.KNIGHT,
        13: chess.BISHOP,
        14: chess.ROOK,
        15: chess.QUEEN,
    }
    promo = promo_map.get(flags)
    return from_sq, to_sq, promo

def pack_move_list(moves: List[chess.Move], board: chess.Board) -> bytes:
    """Encode an entire move sequence into a compact binary bytearray (2 bytes per move)."""
    b = board.copy(stack=False)
    out = bytearray()
    for move in moves:
        enc = encode_move(move, b)
        out.extend(enc.to_bytes(2, byteorder="little", signed=False))
        b.push(move)
    return bytes(out)

def unpack_move_list(raw_bytes: bytes, initial_board: Optional[chess.Board] = None) -> List[chess.Move]:
    """Decode raw bytes back into a list of chess.Move objects."""
    board = (initial_board or chess.Board()).copy(stack=False)
    moves = []
    for i in range(0, len(raw_bytes), 2):
        chunk = raw_bytes[i:i+2]
        if len(chunk) < 2:
            break
        enc = int.from_bytes(chunk, byteorder="little", signed=False)
        from_sq, to_sq, promo = decode_move(enc)
        move = chess.Move(from_sq, to_sq, promotion=promo)
        moves.append(move)
        board.push(move)
    return moves


# --- 64-Bit Zobrist Hashing ---
_RNG = random.Random(0x4368657373427566)  # Deterministic seed: "ChessBuf"

# 12 piece types (White P, N, B, R, Q, K; Black p, n, b, r, q, k) x 64 squares
ZOBRIST_PIECES = {
    pt: [
        [_RNG.getrandbits(64) for _ in range(64)]
        for _ in range(2)  # Color: 0=Black, 1=White
    ]
    for pt in [chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING]
}

# 16 possible castling rights combinations
ZOBRIST_CASTLING = [_RNG.getrandbits(64) for _ in range(16)]

# 8 en passant files (+1 for none)
ZOBRIST_EP = [_RNG.getrandbits(64) for _ in range(9)]

# Side to move
ZOBRIST_BLACK_TO_MOVE = _RNG.getrandbits(64)

def compute_zobrist_hash(board: chess.Board) -> int:
    """Compute the 64-bit Zobrist hash of a chess.Board state in O(1) CPU cycles."""
    h = 0
    # Pieces
    for sq in range(64):
        piece = board.piece_at(sq)
        if piece:
            color_idx = 1 if piece.color == chess.WHITE else 0
            h ^= ZOBRIST_PIECES[piece.piece_type][color_idx][sq]

    # Castling rights mask (4 bits)
    castle_mask = 0
    if board.has_kingside_castling_rights(chess.WHITE):
        castle_mask |= 1
    if board.has_queenside_castling_rights(chess.WHITE):
        castle_mask |= 2
    if board.has_kingside_castling_rights(chess.BLACK):
        castle_mask |= 4
    if board.has_queenside_castling_rights(chess.BLACK):
        castle_mask |= 8
    h ^= ZOBRIST_CASTLING[castle_mask]

    # En passant file
    if board.ep_square is not None:
        ep_file = chess.square_file(board.ep_square)
        h ^= ZOBRIST_EP[ep_file]
    else:
        h ^= ZOBRIST_EP[8]

    # Turn
    if board.turn == chess.BLACK:
        h ^= ZOBRIST_BLACK_TO_MOVE

    return h & 0xFFFFFFFFFFFFFFFF


# --- 64-Bit Bitboard Operations ---
def bitboard_to_squares(bb: int) -> List[int]:
    """Extract list of square indices (0-63) from a 64-bit integer bitboard."""
    squares = []
    while bb > 0:
        lsb = (bb & -bb).bit_length() - 1
        squares.append(lsb)
        bb &= bb - 1
    return squares

def get_piece_bitboards(board: chess.Board):
    """Return dictionary of 64-bit uint piece masks."""
    return {
        "white_pawns": int(board.pieces(chess.PAWN, chess.WHITE)),
        "white_knights": int(board.pieces(chess.KNIGHT, chess.WHITE)),
        "white_bishops": int(board.pieces(chess.BISHOP, chess.WHITE)),
        "white_rooks": int(board.pieces(chess.ROOK, chess.WHITE)),
        "white_queens": int(board.pieces(chess.QUEEN, chess.WHITE)),
        "white_king": int(board.pieces(chess.KING, chess.WHITE)),
        "black_pawns": int(board.pieces(chess.PAWN, chess.BLACK)),
        "black_knights": int(board.pieces(chess.KNIGHT, chess.BLACK)),
        "black_bishops": int(board.pieces(chess.BISHOP, chess.BLACK)),
        "black_rooks": int(board.pieces(chess.ROOK, chess.BLACK)),
        "black_queens": int(board.pieces(chess.QUEEN, chess.BLACK)),
        "black_king": int(board.pieces(chess.KING, chess.BLACK)),
        "occupied_white": int(board.occupied_co[chess.WHITE]),
        "occupied_black": int(board.occupied_co[chess.BLACK]),
        "occupied": int(board.occupied),
    }

def has_luft(board: chess.Board, color: chess.Color) -> bool:
    """Check if the castled king has an escape square (luft) on the adjacent ranks/files."""
    king_sq = board.king(color)
    if king_sq is None:
        return True
    
    king_rank = chess.square_rank(king_sq)
    king_file = chess.square_file(king_sq)
    # Check if king is on the back rank (rank 0 for White, rank 7 for Black)
    if color == chess.WHITE and king_rank == 0:
        shield_pawns = board.pieces(chess.PAWN, chess.WHITE)
        # Check squares directly in front of castled king (f2, g2, h2 or a2, b2, c2)
        forward_sqs = [chess.square(f, 1) for f in range(max(0, king_file - 1), min(8, king_file + 2))]
        # If any forward square is NOT occupied by our pawn, king has some breathing room
        for sq in forward_sqs:
            if not ((shield_pawns >> sq) & 1):
                return True
        return False
    elif color == chess.BLACK and king_rank == 7:
        shield_pawns = board.pieces(chess.PAWN, chess.BLACK)
        forward_sqs = [chess.square(f, 6) for f in range(max(0, king_file - 1), min(8, king_file + 2))]
        for sq in forward_sqs:
            if not ((shield_pawns >> sq) & 1):
                return True
        return False
    return True
