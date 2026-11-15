import chess
from typing import Optional, Dict, Tuple, List
from .bitboard import compute_zobrist_hash

# Core Opening Database with ECO codes and move sequences
OPENINGS_DATA = [
    # Sicilian Defense
    ("B90", "Sicilian Defense: Najdorf Variation", ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]),
    ("B70", "Sicilian Defense: Dragon Variation", ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"]),
    ("B33", "Sicilian Defense: Sveshnikov Variation", ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"]),
    ("B20", "Sicilian Defense", ["e4", "c5"]),
    ("B22", "Sicilian Defense: Alapin Variation", ["e4", "c5", "c3"]),
    ("B23", "Sicilian Defense: Closed", ["e4", "c5", "Nc3"]),

    # French Defense
    ("C00", "French Defense", ["e4", "e6"]),
    ("C02", "French Defense: Advance Variation", ["e4", "e6", "d4", "d5", "e5"]),
    ("C10", "French Defense: Paulsen Variation", ["e4", "e6", "d4", "d5", "Nc3"]),
    ("C05", "French Defense: Tarrasch Variation", ["e4", "e6", "d4", "d5", "Nd2"]),
    ("C01", "French Defense: Exchange Variation", ["e4", "e6", "d4", "d5", "exd5"]),

    # Caro-Kann Defense
    ("B10", "Caro-Kann Defense", ["e4", "c6"]),
    ("B12", "Caro-Kann Defense: Advance Variation", ["e4", "c6", "d4", "d5", "e5"]),
    ("B13", "Caro-Kann Defense: Exchange Variation", ["e4", "c6", "d4", "d5", "exd5", "cxd5"]),
    ("B17", "Caro-Kann Defense: Steinitz Variation", ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Nd7"]),

    # Ruy Lopez
    ("C60", "Ruy Lopez", ["e4", "e5", "Nf3", "Nc6", "Bb5"]),
    ("C65", "Ruy Lopez: Berlin Defense", ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"]),
    ("C88", "Ruy Lopez: Closed", ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]),

    # Italian Game & Scotch
    ("C50", "Italian Game", ["e4", "e5", "Nf3", "Nc6", "Bc4"]),
    ("C51", "Italian Game: Evans Gambit", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"]),
    ("C54", "Italian Game: Giuoco Piano", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4"]),
    ("C45", "Scotch Game", ["e4", "e5", "Nf3", "Nc6", "d4"]),
    ("C42", "Petroff Defense", ["e4", "e5", "Nf3", "Nf6"]),

    # Queen's Gambit & 1.d4
    ("D06", "Queen's Gambit", ["d4", "d5", "c4"]),
    ("D20", "Queen's Gambit Accepted", ["d4", "d5", "c4", "dxc4"]),
    ("D30", "Queen's Gambit Declined", ["d4", "d5", "c4", "e6"]),
    ("D35", "Queen's Gambit Declined: Exchange", ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5"]),
    ("D10", "Slav Defense", ["d4", "d5", "c4", "c6"]),
    ("D02", "Queen's Pawn Game: London System", ["d4", "d5", "Bf4"]),
    ("D00", "Queen's Pawn Game", ["d4", "d5"]),

    # Indian Defenses
    ("E60", "King's Indian Defense", ["d4", "Nf6", "c4", "g6"]),
    ("E90", "King's Indian Defense: Classical", ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O", "Be2"]),
    ("E20", "Nimzo-Indian Defense", ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]),
    ("E12", "Queen's Indian Defense", ["d4", "Nf6", "c4", "e6", "Nf3", "b6"]),
    ("A56", "Benoni Defense", ["d4", "Nf6", "c4", "c5", "d5"]),
    ("A80", "Dutch Defense", ["d4", "f5"]),

    # Flank Openings
    ("A10", "English Opening", ["c4"]),
    ("A15", "English Opening: Anglo-Indian", ["c4", "Nf6"]),
    ("A04", "Réti Opening", ["Nf3"]),
    ("B01", "Scandinavian Defense", ["e4", "d5"]),
    ("B07", "Pirc Defense", ["e4", "d6", "d4", "Nf6", "Nc3", "g6"]),
    ("A00", "Grob Opening", ["g4"]),
    ("C20", "King's Pawn Game", ["e4", "e5"]),
]

class OpeningNode:
    def __init__(self):
        self.children: Dict[str, OpeningNode] = {}
        self.eco: Optional[str] = None
        self.name: Optional[str] = None

class OpeningBook:
    def __init__(self):
        self.root = OpeningNode()
        self.zobrist_map: Dict[int, Tuple[str, str, int]] = {}  # zobrist_hash -> (eco, name, ply)
        self._build_trie()

    def _build_trie(self):
        # Register standard starting position
        start_board = chess.Board()
        start_hash = compute_zobrist_hash(start_board)
        self.zobrist_map[start_hash] = ("A00", "Starting Position", 0)

        for eco, name, moves in OPENINGS_DATA:
            curr = self.root
            board = chess.Board()
            for ply, san in enumerate(moves, start=1):
                try:
                    move = board.parse_san(san)
                    board.push(move)
                except Exception:
                    break

                if san not in curr.children:
                    curr.children[san] = OpeningNode()
                curr = curr.children[san]
                curr.eco = eco
                curr.name = name

                z_hash = compute_zobrist_hash(board)
                if z_hash not in self.zobrist_map or ply > self.zobrist_map[z_hash][2]:
                    self.zobrist_map[z_hash] = (eco, name, ply)

    def is_book_position(self, board: chess.Board) -> bool:
        """O(1) Zobrist hash check to see if position is in the opening book."""
        h = compute_zobrist_hash(board)
        return h in self.zobrist_map

    def get_book_info(self, board: chess.Board) -> Optional[Tuple[str, str, int]]:
        """Return (ECO, Name, Ply) for a board state if in book."""
        h = compute_zobrist_hash(board)
        return self.zobrist_map.get(h)

    def find_opening_and_last_book_move(self, san_moves: List[str]) -> Tuple[str, str, int]:
        """Walk the move sequence and return (ECO, Opening Name, last_book_ply)."""
        curr = self.root
        best_eco = "A00"
        best_name = "Custom Game"
        last_book_ply = 0

        for ply, san in enumerate(san_moves, start=1):
            clean_san = san.strip("+#!?")
            matched_node = None
            for key, node in curr.children.items():
                if key.strip("+#!?") == clean_san:
                    matched_node = node
                    break
            
            if matched_node:
                curr = matched_node
                if curr.eco and curr.name:
                    best_eco = curr.eco
                    best_name = curr.name
                last_book_ply = ply
            else:
                break

        return best_eco, best_name, last_book_ply

opening_book = OpeningBook()
