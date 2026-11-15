import React, { useEffect, useState } from 'react';
import {
  ChevronsLeft,
  ChevronLeft,
  Play,
  Pause,
  ChevronRight,
  ChevronsRight,
  RotateCcw,
} from 'lucide-react';

interface VCRControlsProps {
  currentPlyIndex: number;
  totalPlies: number;
  currentSan?: string;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onFlip?: () => void;
  isFlipped?: boolean;
}

export const VCRControls: React.FC<VCRControlsProps> = ({
  currentPlyIndex,
  totalPlies,
  currentSan,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onFlip,
  isFlipped,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Keyboard navigation listeners: ArrowLeft / ArrowRight / Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrev, onNext]);

  // Auto-play interval
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        if (currentPlyIndex < totalPlies - 1) {
          onNext();
        } else {
          setIsPlaying(false);
        }
      }, 1400);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentPlyIndex, totalPlies, onNext]);

  const isAtStart = currentPlyIndex <= -1;
  const isAtEnd = currentPlyIndex >= totalPlies - 1;

  // Calculate friendly move display: e.g. "Move 12. Nxf7 (Ply 23/45)"
  const currentTurn = currentPlyIndex >= 0 ? Math.floor(currentPlyIndex / 2) + 1 : 0;
  const isWhiteMove = currentPlyIndex % 2 === 0;

  return (
    <div className="w-full bg-[#262421] border-2 border-[#403D39] rounded-2xl p-2.5 flex items-center justify-between shadow-2xl select-none">
      {/* Left Navigation Buttons: First & Previous */}
      <div className="flex items-center gap-2">
        <button
          onClick={onFirst}
          disabled={isAtStart}
          className="h-12 w-12 rounded-xl flex items-center justify-center text-neutral-300 hover:text-white bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39] disabled:opacity-25 disabled:hover:bg-[#312E2B] disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
          title="First Move (Home / Start)"
        >
          <ChevronsLeft className="w-6 h-6" />
        </button>

        <button
          onClick={onPrev}
          disabled={isAtStart}
          className="h-12 px-5 rounded-xl flex items-center justify-center gap-2 text-white bg-[#36332F] hover:bg-[#45413B] border-2 border-[#524E48] disabled:opacity-25 disabled:hover:bg-[#36332F] disabled:cursor-not-allowed transition-all shadow-md active:scale-95 text-base font-extrabold"
          title="Previous Move (← Left Arrow)"
        >
          <ChevronLeft className="w-7 h-7" />
          <span className="hidden sm:inline">Prev</span>
        </button>
      </div>

      {/* Center: Play State & Move Counter */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Toggle */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`h-12 px-5 rounded-xl text-sm font-extrabold flex items-center gap-2.5 shadow-lg transition-all active:scale-95 ${
            isPlaying
              ? 'bg-amber-600 hover:bg-amber-500 text-white border-b-4 border-amber-800'
              : 'chess-btn-green text-white hover:brightness-105'
          }`}
          title="Auto-Play Game (Spacebar)"
        >
          {isPlaying ? (
            <>
              <Pause className="w-5 h-5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>Auto-Play</span>
            </>
          )}
        </button>

        {/* Current Move Pill */}
        <div className="px-3.5 py-2 rounded-xl bg-[#1C1A18] border border-[#403D39] text-center min-w-[120px]">
          {totalPlies === 0 ? (
            <span className="text-xs text-neutral-400 font-bold">No moves</span>
          ) : currentPlyIndex === -1 ? (
            <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Start Position</span>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-white">
                {currentTurn}. {isWhiteMove ? '' : '.. '}
                <span className="text-[#81B64C]">{currentSan || ''}</span>
              </span>
              <span className="text-[11px] text-neutral-400 font-semibold">
                Ply {currentPlyIndex + 1} / {totalPlies}
              </span>
            </div>
          )}
        </div>

        {/* Flip Board Shortcut */}
        {onFlip && (
          <button
            onClick={onFlip}
            className="h-12 w-12 rounded-xl flex items-center justify-center text-neutral-300 hover:text-white bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39] transition-all shadow-sm active:scale-95"
            title="Flip Board View"
          >
            <RotateCcw className={`w-5 h-5 transition-transform duration-300 ${isFlipped ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Right Navigation Buttons: Next & Last */}
      <div className="flex items-center gap-2">
        <button
          onClick={onNext}
          disabled={isAtEnd}
          className="h-12 px-5 rounded-xl flex items-center justify-center gap-2 text-white bg-[#81B64C] hover:bg-[#95C85A] border-b-4 border-[#457524] disabled:opacity-25 disabled:hover:bg-[#81B64C] disabled:cursor-not-allowed transition-all shadow-md active:scale-95 text-base font-extrabold"
          title="Next Move (→ Right Arrow)"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-7 h-7" />
        </button>

        <button
          onClick={onLast}
          disabled={isAtEnd}
          className="h-12 w-12 rounded-xl flex items-center justify-center text-neutral-300 hover:text-white bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39] disabled:opacity-25 disabled:hover:bg-[#312E2B] disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
          title="Last Move (End)"
        >
          <ChevronsRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
