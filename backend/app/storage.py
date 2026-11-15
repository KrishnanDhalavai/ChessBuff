import sqlite3
import hashlib
import json
import zstandard as zstd
import asyncio
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from .config import DB_PATH

# Zstandard compressor / decompressor
_CCTX = zstd.ZstdCompressor(level=3)
_DCTX = zstd.ZstdDecompressor()

class Singleflight:
    """
    In-Flight Request Coalescing (Singleflight Pattern).
    Ensures that if multiple requests arrive for the same uncached game_hash concurrently,
    only the first execution occurs; all other callers await the same asyncio.Future.
    """
    def __init__(self):
        self._active: Dict[str, asyncio.Future] = {}
        self._lock: Optional[asyncio.Lock] = None

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def execute(self, key: str, coro_func):
        async with self._get_lock():
            if key in self._active:
                future = self._active[key]
                # Await existing in-flight future outside the lock
                is_leader = False
            else:
                loop = asyncio.get_running_loop()
                future = loop.create_future()
                self._active[key] = future
                is_leader = True

        if not is_leader:
            return await future

        try:
            result = await coro_func()
            future.set_result(result)
            return result
        except Exception as e:
            future.set_exception(e)
            raise e
        finally:
            async with self._get_lock():
                self._active.pop(key, None)

class DatabaseManager:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        # Enable WAL mode for high concurrency
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            # Games Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    game_hash TEXT PRIMARY KEY,
                    white_player TEXT DEFAULT 'White',
                    black_player TEXT DEFAULT 'Black',
                    white_rating INTEGER DEFAULT 1500,
                    black_rating INTEGER DEFAULT 1500,
                    result TEXT DEFAULT '*',
                    eco_code TEXT DEFAULT 'A00',
                    opening_name TEXT DEFAULT 'Custom Game',
                    white_accuracy REAL DEFAULT 0.0,
                    black_accuracy REAL DEFAULT 0.0,
                    played_at TEXT,
                    pgn TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_games_played_at ON games(played_at DESC)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_games_eco ON games(eco_code)")

            # Game Reviews Table (Compressed JSONB Blob)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS game_reviews (
                    game_hash TEXT PRIMARY KEY,
                    telemetry_blob BLOB NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (game_hash) REFERENCES games(game_hash)
                )
            """)

            # Tactical Motif Inverted Index Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS tactical_motifs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    motif TEXT NOT NULL,
                    game_hash TEXT NOT NULL,
                    ply INTEGER NOT NULL,
                    classification TEXT NOT NULL,
                    mover TEXT NOT NULL,
                    FOREIGN KEY (game_hash) REFERENCES games(game_hash)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tactics_motif ON tactical_motifs(motif)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tactics_game ON tactical_motifs(game_hash)")

    def get_review(self, game_hash: str) -> Optional[Dict[str, Any]]:
        """O(1) retrieval of full review telemetry from L2 cache."""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT telemetry_blob FROM game_reviews WHERE game_hash = ?",
                (game_hash,)
            ).fetchone()
            if row:
                compressed_data = row["telemetry_blob"]
                decompressed = _DCTX.decompress(compressed_data)
                return json.loads(decompressed.decode("utf-8"))
        return None

    def save_game_and_review(
        self,
        game_hash: str,
        game_meta: Dict[str, Any],
        telemetry: Dict[str, Any],
        motifs: List[Dict[str, Any]]
    ):
        """Save canonical game metadata, compressed telemetry review, and index tactical motifs."""
        json_bytes = json.dumps(telemetry).encode("utf-8")
        compressed_blob = _CCTX.compress(json_bytes)
        now_str = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            # Upsert game
            conn.execute("""
                INSERT OR REPLACE INTO games (
                    game_hash, white_player, black_player, white_rating, black_rating,
                    result, eco_code, opening_name, white_accuracy, black_accuracy,
                    played_at, pgn
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                game_hash,
                game_meta.get("white_player", "White"),
                game_meta.get("black_player", "Black"),
                game_meta.get("white_rating", 1500),
                game_meta.get("black_rating", 1500),
                game_meta.get("result", "*"),
                game_meta.get("eco_code", "A00"),
                game_meta.get("opening_name", "Custom Game"),
                game_meta.get("white_accuracy", 0.0),
                game_meta.get("black_accuracy", 0.0),
                game_meta.get("played_at", now_str),
                game_meta.get("pgn", "")
            ))

            # Upsert review
            conn.execute("""
                INSERT OR REPLACE INTO game_reviews (
                    game_hash, telemetry_blob, created_at
                ) VALUES (?, ?, ?)
            """, (game_hash, compressed_blob, now_str))

            # Clean and insert tactical motifs
            conn.execute("DELETE FROM tactical_motifs WHERE game_hash = ?", (game_hash,))
            for m in motifs:
                conn.execute("""
                    INSERT INTO tactical_motifs (motif, game_hash, ply, classification, mover)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    m["motif"],
                    game_hash,
                    m["ply"],
                    m.get("classification", ""),
                    m.get("mover", "")
                ))

    def list_games(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """List historical games with pagination."""
        with self._get_connection() as conn:
            rows = conn.execute("""
                SELECT game_hash, white_player, black_player, white_rating, black_rating,
                       result, eco_code, opening_name, white_accuracy, black_accuracy,
                       played_at
                FROM games
                ORDER BY played_at DESC
                LIMIT ? OFFSET ?
            """, (limit, offset)).fetchall()
            return [dict(r) for r in rows]

    def query_tactical_motifs(self, motif: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Inverted index query: find games by tactical motifs (e.g. fork, pin, missed_mate)."""
        with self._get_connection() as conn:
            rows = conn.execute("""
                SELECT t.motif, t.game_hash, t.ply, t.classification, t.mover,
                       g.white_player, g.black_player, g.result, g.opening_name
                FROM tactical_motifs t
                JOIN games g ON t.game_hash = g.game_hash
                WHERE t.motif = ?
                ORDER BY g.played_at DESC
                LIMIT ?
            """, (motif, limit)).fetchall()
            return [dict(r) for r in rows]

# Canonical PGN normalization & SHA-256 digest
def compute_canonical_game_hash(san_moves: List[str]) -> str:
    """
    Strips volatile headers (Date, Site, Clock, White/Black name),
    normalizes the move sequence to canonical spaced SAN string,
    and returns its SHA-256 hexadecimal digest.
    """
    clean_moves = [m.strip("+#!?") for m in san_moves]
    normalized_str = " ".join(clean_moves)
    return hashlib.sha256(normalized_str.encode("utf-8")).hexdigest()

db_manager = DatabaseManager()
singleflight = Singleflight()
