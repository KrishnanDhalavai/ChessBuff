export type GameStateMode = 'IDLE' | 'LIVE_GAME' | 'GAME_OVER' | 'ANALYZING' | 'REVIEW_ACTIVE';

export type PieceColor = 'w' | 'b';
export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface BoardSquarePiece {
  type: PieceSymbol;
  color: PieceColor;
}

export interface TacticalArrow {
  from: string;
  to: string;
  color: string;
}

export interface CoachCommentary {
  ply: number;
  classification: string;
  explanation: string;
  coach_tip: string;
}

export interface PlyTelemetry {
  ply: number;
  san: string;
  uci: string;
  fen_before: string;
  fen_after: string;
  mover: 'White' | 'Black';
  classification: string;
  classification_tier: string;
  classification_symbol: string;
  classification_color: string;
  delta_w: number;
  win_prob_white: number;
  win_prob_black: number;
  accuracy: number;
  eval_cp: number;
  eval_text: string;
  best_move_san?: string;
  best_move_uci?: string;
  second_move_san?: string;
  refutation_san: string[];
  tactics: {
    fork?: any;
    pin?: any;
    hanging_pieces?: any[];
    quiescence?: any;
    back_rank_weakness?: boolean;
    missed_mate?: boolean;
  };
  arrows: TacticalArrow[];
  coach_commentary?: CoachCommentary;
}

export interface ReviewResponseData {
  game_hash: string;
  white_player: string;
  black_player: string;
  white_rating: number;
  black_rating: number;
  result: string;
  eco_code: string;
  opening_name: string;
  last_book_ply: number;
  white_accuracy: number;
  black_accuracy: number;
  white_rating_est: number;
  black_rating_est: number;
  plies: PlyTelemetry[];
  white_counts: Record<string, number>;
  black_counts: Record<string, number>;
  coach_summary?: string;
}

export interface GameArchiveItem {
  game_hash: string;
  white_player: string;
  black_player: string;
  white_rating: number;
  black_rating: number;
  result: string;
  eco_code: string;
  opening_name: string;
  white_accuracy: number;
  black_accuracy: number;
  played_at: string;
}
