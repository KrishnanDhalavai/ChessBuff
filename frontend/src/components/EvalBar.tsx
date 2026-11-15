import React from 'react';

interface EvalBarProps {
  isVisible: boolean;
  winProbWhite: number; // 0 to 100
  evalText: string;
  isFlipped?: boolean;
}

export const EvalBar: React.FC<EvalBarProps> = ({
  isVisible,
  winProbWhite,
  evalText,
  isFlipped = false,
}) => {
  if (!isVisible) {
    return null;
  }

  // Clamped percentage: 5% to 95% so bar never disappears entirely
  const whitePercent = Math.max(5, Math.min(95, winProbWhite));
  const blackPercent = 100 - whitePercent;

  // If not flipped, White is at the bottom, Black is at the top
  const bottomPercent = isFlipped ? blackPercent : whitePercent;

  return (
    <div
      className="w-7 h-full bg-[#262421] rounded-l-md border border-[#403D39] relative flex flex-col justify-end overflow-hidden select-none transition-all duration-300 shadow-md shadow-black/40 mr-2 shrink-0"
      title={`Evaluation: ${evalText} (White win probability: ${winProbWhite.toFixed(1)}%)`}
    >
      {/* Black's share (top) */}
      <div className="absolute top-1.5 left-0 right-0 text-center font-mono text-xs font-black text-neutral-200 z-10 pointer-events-none drop-shadow-sm">
        {evalText.startsWith('-') || evalText.startsWith('-M') ? evalText : ''}
      </div>

      {/* White's share (bottom) */}
      <div
        className="w-full bg-[#FFFFFF] transition-all duration-300 ease-out"
        style={{ height: `${bottomPercent}%` }}
      />

      <div className="absolute bottom-1.5 left-0 right-0 text-center font-mono text-xs font-black text-neutral-900 z-10 pointer-events-none drop-shadow-sm">
        {evalText.startsWith('+') || evalText.startsWith('M') || evalText === '0.0' ? evalText : ''}
      </div>
    </div>
  );
};
