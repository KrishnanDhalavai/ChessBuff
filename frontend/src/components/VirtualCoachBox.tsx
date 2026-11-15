import React from 'react';
import { Sparkles, Play, Lightbulb } from 'lucide-react';
import { PlyTelemetry } from '../types/chess';

interface VirtualCoachBoxProps {
  currentPlyData: PlyTelemetry | null;
  onShowFollowUp: () => void;
  hasFollowUp: boolean;
  isPlayingFollowUp: boolean;
}

export const VirtualCoachBox: React.FC<VirtualCoachBoxProps> = ({
  currentPlyData,
  onShowFollowUp,
  hasFollowUp,
  isPlayingFollowUp,
}) => {
  if (!currentPlyData) {
    return (
      <div className="bg-[#262421] border border-[#403D39] rounded-xl p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <div className="text-sm font-bold text-neutral-200">Diamond Coach</div>
          <div className="text-xs text-neutral-400">Step through moves to receive Grandmaster insights.</div>
        </div>
      </div>
    );
  }

  const commentary = currentPlyData.coach_commentary;
  const classification = currentPlyData.classification;
  const symbol = currentPlyData.classification_symbol;
  const color = currentPlyData.classification_color;
  const explanation = commentary?.explanation || `Move ${currentPlyData.san} played by ${currentPlyData.mover}.`;
  const tip = commentary?.coach_tip || 'Keep your pieces active and coordinate towards the enemy king.';

  return (
    <div className="bg-[#262421] border-2 border-[#403D39] rounded-2xl p-4 shadow-xl relative overflow-hidden select-none">
      <div className="flex items-start gap-3.5">
        {/* Coach Avatar */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full bg-linear-to-b from-emerald-600 to-teal-800 border-2 border-emerald-400/70 flex items-center justify-center shadow-md">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-0.5 shadow">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* Speech Bubble Container */}
        <div className="flex-1 min-w-0">
          {/* Header Badge */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: color }}
                className="px-2.5 py-1 rounded-md text-xs font-black text-white uppercase tracking-wider shadow-sm flex items-center gap-1.5"
              >
                <span>{symbol}</span>
                <span>{classification}</span>
              </span>
              <span className="text-sm font-bold text-neutral-200">
                Ply {currentPlyData.ply}: <span className="text-[#81B64C]">{currentPlyData.san}</span>
              </span>
            </div>

            {/* Evaluation Score Pill */}
            <span className="font-mono text-sm font-black text-neutral-300 bg-[#1C1A18] px-2 py-0.5 rounded border border-[#403D39]">
              {currentPlyData.eval_text}
            </span>
          </div>

          {/* Speech Bubble Card */}
          <div className="bg-[#312E2B] rounded-xl p-3 border border-[#403D39] text-sm leading-relaxed text-neutral-100 shadow-inner">
            <p className="font-medium text-white">{explanation}</p>
            {tip && (
              <div className="mt-2.5 pt-2.5 border-t border-[#403D39] flex items-start gap-2 text-neutral-300">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-xs md:text-sm font-medium italic">{tip}</span>
              </div>
            )}
          </div>

          {/* Interactive "Show Follow-Up" Button */}
          {hasFollowUp && (
            <div className="mt-2.5 flex items-center justify-end">
              <button
                onClick={onShowFollowUp}
                disabled={isPlayingFollowUp}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold shadow-md transition-all ${
                  isPlayingFollowUp
                    ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                    : 'chess-btn-green text-white hover:brightness-105 active:scale-95'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isPlayingFollowUp ? 'Playing Line...' : 'Show Follow-Up'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
