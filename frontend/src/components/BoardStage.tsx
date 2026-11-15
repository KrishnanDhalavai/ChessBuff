import React, { useState } from 'react';
import { Chess, Square } from 'chess.js';
import { ChessPieceIcon } from './ChessPieces';
import { TacticalArrow, PieceSymbol, PieceColor } from '../types/chess';
import { soundManager } from '../audio/soundManager';

interface BoardStageProps {
  game: Chess;
  isFlipped: boolean;
  lastMove: { from: Square; to: Square } | null;
  onMove: (from: Square, to: Square, promotion?: PieceSymbol) => boolean;
  isInteractive: boolean;
  arrows?: TacticalArrow[];
  activeBadge?: { square: string; symbol: string; color: string } | null;
}

export const BoardStage: React.FC<BoardStageProps> = ({
  game,
  isFlipped,
  lastMove,
  onMove,
  isInteractive,
  arrows = [],
  activeBadge = null,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  const boardArray = game.board();

  // Ranks & Files depending on flip
  const ranks = isFlipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = isFlipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  const getSquareName = (file: string, rank: number): Square => `${file}${rank}` as Square;

  const handleSquareClick = (square: Square) => {
    if (!isInteractive) return;

    // If already selected a piece
    if (selectedSquare) {
      if (selectedSquare === square) {
        // Deselect
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // Check if target square is a legal move
      if (legalMoves.includes(square)) {
        // Check for pawn promotion
        const piece = game.get(selectedSquare);
        if (piece && piece.type === 'p' && (square.endsWith('8') || square.endsWith('1'))) {
          setPendingPromotion({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }

        const success = onMove(selectedSquare, square);
        if (success) {
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }
      }
    }

    // Select piece on square if it's the active turn
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setLegalMoves(moves.map((m) => m.to as Square));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const handlePromotionChoice = (promoPiece: PieceSymbol) => {
    if (pendingPromotion) {
      onMove(pendingPromotion.from, pendingPromotion.to, promoPiece);
      setPendingPromotion(null);
    }
  };

  // Convert chess square (e.g. 'e4') to percentage coordinates (center of square)
  const squareToPercent = (sq: string) => {
    if (!sq || sq.length < 2) return { x: 50, y: 50 };
    const f = sq[0];
    const r = parseInt(sq[1], 10);
    const fileIdx = files.indexOf(f);
    const rankIdx = ranks.indexOf(r);
    const x = fileIdx * 12.5 + 6.25;
    const y = rankIdx * 12.5 + 6.25;
    return { x, y };
  };

  const inCheck = game.inCheck();
  const kingSquare = inCheck
    ? (() => {
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardArray[r][c];
            if (p && p.type === 'k' && p.color === game.turn()) {
              return p.square as Square;
            }
          }
        }
        return null;
      })()
    : null;

  return (
    <div className="relative aspect-square w-full h-full rounded-lg shadow-2xl overflow-hidden select-none border-2 border-[#403D39]">
      {/* 8x8 Board Grid */}
      <div className="w-full h-full grid grid-cols-8 grid-rows-8">
        {ranks.map((rank, rIdx) =>
          files.map((file, fIdx) => {
            const sq = getSquareName(file, rank);
            const isDark = (rIdx + fIdx) % 2 === 1;
            const piece = game.get(sq);

            const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isSelected = selectedSquare === sq;
            const isLegalTarget = legalMoves.includes(sq);
            const isCheckSquare = inCheck && kingSquare === sq;

            // Coordinates display (Chess.com style: top-left rank on first col, bottom-right file on last row)
            const showRankCoord = fIdx === 0;
            const showFileCoord = rIdx === 7;
            const coordColor = isDark ? '#EBECD0' : '#739552';

            return (
              <div
                key={sq}
                onClick={() => handleSquareClick(sq)}
                className={`relative flex items-center justify-center cursor-pointer transition-colors duration-75 ${
                  isDark ? 'bg-[#739552]' : 'bg-[#EBECD0]'
                }`}
              >
                {/* Last Move Yellow Highlight */}
                {isLastMove && (
                  <div className="absolute inset-0 bg-[#FFFF33]/45 pointer-events-none" />
                )}

                {/* Selected Square Highlight */}
                {isSelected && (
                  <div className="absolute inset-0 bg-[#FFFF33]/60 ring-2 ring-amber-300 pointer-events-none" />
                )}

                {/* King in Check Red Alert */}
                {isCheckSquare && (
                  <div className="absolute inset-0 bg-radial-red bg-rose-600/60 ring-2 ring-rose-500 animate-pulse pointer-events-none" />
                )}

                {/* Internal Rank Coordinate */}
                {showRankCoord && (
                  <span
                    style={{ color: coordColor }}
                    className="absolute top-1 left-1.5 text-xs md:text-sm font-black select-none pointer-events-none drop-shadow-xs"
                  >
                    {rank}
                  </span>
                )}

                {/* Internal File Coordinate */}
                {showFileCoord && (
                  <span
                    style={{ color: coordColor }}
                    className="absolute bottom-1 right-1.5 text-xs md:text-sm font-black select-none pointer-events-none drop-shadow-xs"
                  >
                    {file}
                  </span>
                )}

                {/* Piece Icon */}
                {piece && (
                  <div className="w-[90%] h-[90%] z-10 drop-shadow-md transition-transform duration-100 transform active:scale-95 flex items-center justify-center">
                    <ChessPieceIcon type={piece.type as PieceSymbol} color={piece.color as PieceColor} />
                  </div>
                )}

                {/* Legal Move Indicators: Dot for empty square, corner rings for capture */}
                {isLegalTarget && !piece && (
                  <div className="absolute w-4 h-4 md:w-5 md:h-5 rounded-full bg-black/25 z-10 pointer-events-none shadow-sm" />
                )}
                {isLegalTarget && piece && (
                  <div className="absolute inset-1 rounded-full border-4 md:border-[5px] border-black/30 z-10 pointer-events-none shadow-sm" />
                )}

                {/* On-Board Move Classification Badge Pinned to Top-Right Corner */}
                {activeBadge && activeBadge.square === sq && (
                  <div
                    style={{ backgroundColor: activeBadge.color }}
                    className="absolute -top-2 -right-2 z-30 px-2.5 py-1 rounded-full text-white font-black text-xs md:text-sm shadow-xl shadow-black/80 border-2 border-white/60 flex items-center justify-center animate-bounce"
                  >
                    {activeBadge.symbol}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* SVG Directional Arrow Layer */}
      {arrows.length > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
          <defs>
            {arrows.map((arr, i) => (
              <marker
                key={`marker-${i}`}
                id={`arrowhead-${i}`}
                markerWidth="6"
                markerHeight="6"
                refX="4"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 6 3, 0 6" fill={arr.color} opacity="0.85" />
              </marker>
            ))}
          </defs>
          {arrows.map((arr, i) => {
            const start = squareToPercent(arr.from);
            const end = squareToPercent(arr.to);
            return (
              <line
                key={`line-${i}`}
                x1={`${start.x}%`}
                y1={`${start.y}%`}
                x2={`${end.x}%`}
                y2={`${end.y}%`}
                stroke={arr.color}
                strokeWidth="7"
                strokeLinecap="round"
                opacity="0.8"
                markerEnd={`url(#arrowhead-${i})`}
              />
            );
          })}
        </svg>
      )}

      {/* Pawn Promotion Modal Dialog */}
      {pendingPromotion && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-40">
          <div className="bg-[#262421] border border-[#403D39] rounded-xl p-4 shadow-2xl flex flex-col items-center gap-3">
            <span className="text-sm font-bold text-neutral-200">Promote Pawn</span>
            <div className="flex gap-2">
              {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((promo) => (
                <button
                  key={promo}
                  onClick={() => handlePromotionChoice(promo)}
                  className="w-14 h-14 bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39] rounded-lg p-2 transition-transform transform hover:scale-105 active:scale-95 shadow-md"
                >
                  <ChessPieceIcon type={promo} color={game.turn() as PieceColor} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
