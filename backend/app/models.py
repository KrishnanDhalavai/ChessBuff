from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class ReviewRequest(BaseModel):
    pgn: Optional[str] = Field(None, max_length=150_000, description="Raw PGN string (max 150KB)")
    moves: Optional[List[str]] = Field(None, max_length=600, description="List of UCI or SAN moves (max 600)")
    white_player: Optional[str] = Field("White", max_length=120)
    black_player: Optional[str] = Field("Black", max_length=120)
    white_rating: Optional[int] = Field(1500, ge=100, le=4000)
    black_rating: Optional[int] = Field(1500, ge=100, le=4000)
    result: Optional[str] = Field("*", max_length=16)
    api_key: Optional[str] = Field(None, max_length=256)

class EvaluatePositionRequest(BaseModel):
    fen: str = Field(..., max_length=256, description="FEN string")
    depth: Optional[int] = Field(14, ge=1, le=24, description="Search depth (1-24)")

class SettingsRequest(BaseModel):
    api_key: str = Field(..., max_length=256, description="Gemini API Key")

class PlyTelemetry(BaseModel):
    ply: int
    san: str
    uci: str
    fen_before: str
    fen_after: str
    mover: str  # "White" or "Black"
    classification: str
    classification_symbol: str
    classification_color: str
    delta_w: float
    win_prob_white: float
    win_prob_black: float
    accuracy: float
    eval_cp: float
    eval_text: str
    best_move_san: Optional[str] = None
    best_move_uci: Optional[str] = None
    second_move_san: Optional[str] = None
    refutation_san: List[str] = []
    tactics: Dict[str, Any] = {}
    coach_commentary: Optional[Dict[str, Any]] = None

class ReviewResponse(BaseModel):
    game_hash: str
    eco_code: str
    opening_name: str
    last_book_ply: int
    white_accuracy: float
    black_accuracy: float
    white_rating_est: int
    black_rating_est: int
    plies: List[Dict[str, Any]]
    white_counts: Dict[str, int]
    black_counts: Dict[str, int]
    coach_summary: Optional[str] = None
