import React from 'react';
import { ChessClock } from './ChessClock';
import { PieceSymbol, PieceColor } from '../types/chess';
import { ChessPieceIcon } from './ChessPieces';

interface PlayerStripProps {
  handle: string;
  rating: number;
  avatarUrl?: string;
  flagCode?: string;
  capturedPieces: PieceSymbol[];
  opponentColor: PieceColor;
  materialDiff?: number;
  timeMs: number;
  isActive: boolean;
}

export const PlayerStrip: React.FC<PlayerStripProps> = ({
  handle,
  rating,
  avatarUrl,
  flagCode = '🌍',
  capturedPieces,
  opponentColor,
  materialDiff = 0,
  timeMs,
  isActive,
}) => {
  // Group captured pieces in canonical order: Q, R, B, N, P
  const pieceOrder: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];
  const counts: Partial<Record<PieceSymbol, number>> = {};
  for (const p of capturedPieces) {
    counts[p] = (counts[p] || 0) + 1;
  }

  return (
    <div className="w-full h-12 flex items-center justify-between px-2 bg-transparent select-none">
      {/* Left Details: Avatar, Handle, Rating Pill, Flag, Captured Pieces */}
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-lg bg-[#403D39] border-2 border-[#524E48] flex items-center justify-center overflow-hidden shrink-0 shadow-md">
          {avatarUrl ? (
            <img src={avatarUrl} alt={handle} className="w-full h-full object-cover" />
          ) : (
            <span className="font-extrabold text-sm text-neutral-200 uppercase">
              {handle.slice(0, 2)}
            </span>
          )}
        </div>

        {/* Handle, Rating Pill & Flag */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-extrabold text-base text-white truncate max-w-[150px]">
            {handle}
          </span>
          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-[#262421] text-neutral-300 border border-[#403D39]">
            {rating}
          </span>
          <span className="text-base" title="Country">{flagCode}</span>
        </div>

        {/* Captured Pieces with Material Differential */}
        <div className="flex items-center gap-1.5 ml-2 overflow-x-auto">
          {pieceOrder.map((pt) => {
            const count = counts[pt] || 0;
            if (count === 0) return null;
            return (
              <div key={pt} className="flex items-center -space-x-2">
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="w-5 h-5 opacity-85">
                    <ChessPieceIcon type={pt} color={opponentColor} />
                  </div>
                ))}
              </div>
            );
          })}
          {materialDiff > 0 && (
            <span className="text-sm font-black text-amber-400 ml-1.5">
              +{materialDiff}
            </span>
          )}
        </div>
      </div>

      {/* Right Details: Digital Chess Clock */}
      <ChessClock timeMs={timeMs} isActive={isActive} />
    </div>
  );
};
