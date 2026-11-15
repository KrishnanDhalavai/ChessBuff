import React, { useRef, useEffect } from 'react';
import {
  RotateCcw,
  Flag,
  Handshake,
  Sparkles,
  ListOrdered,
  PlusCircle,
} from 'lucide-react';
import { GameStateMode, ReviewResponseData, PlyTelemetry } from '../types/chess';
import { VirtualCoachBox } from './VirtualCoachBox';
import { AdvantageGraph } from './AdvantageGraph';
import { CAPS2Matrix } from './CAPS2Matrix';

interface RightPanelProps {
  mode: GameStateMode;
  sanMoves: string[];
  currentMoveIndex: number; // 0-based ply index
  onSelectMove: (plyIndex: number) => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onFlipBoard: () => void;
  onStartReview: () => void;
  onNewGame: () => void;
  reviewData: ReviewResponseData | null;
  currentPlyData: PlyTelemetry | null;
  onShowFollowUp: () => void;
  hasFollowUp: boolean;
  isPlayingFollowUp: boolean;
  gameResultText: string | null;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  mode,
  sanMoves,
  currentMoveIndex,
  onSelectMove,
  onResign,
  onOfferDraw,
  onFlipBoard,
  onStartReview,
  onNewGame,
  reviewData,
  currentPlyData,
  onShowFollowUp,
  hasFollowUp,
  isPlayingFollowUp,
  gameResultText,
}) => {
  const [activeTab, setActiveTab] = React.useState<'review' | 'moves'>('review');
  const moveListRef = useRef<HTMLDivElement>(null);

  // Group moves into turns: [ { white: "e4", black: "e5", turnNum: 1 }, ... ]
  const turns: { turnNum: number; white?: string; black?: string; whitePly: number; blackPly?: number }[] = [];
  for (let i = 0; i < sanMoves.length; i += 2) {
    const turnNum = Math.floor(i / 2) + 1;
    turns.push({
      turnNum,
      white: sanMoves[i],
      whitePly: i,
      black: sanMoves[i + 1],
      blackPly: i + 1 < sanMoves.length ? i + 1 : undefined,
    });
  }

  // Auto-scroll move list to active ply
  useEffect(() => {
    if (moveListRef.current) {
      const activeEl = moveListRef.current.querySelector('.active-ply-item');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [currentMoveIndex]);

  return (
    <aside className="w-[420px] h-screen bg-[#262421] border-l-2 border-[#403D39] flex flex-col justify-between select-none z-10 shrink-0">
      {/* Panel Header */}
      <div className="h-16 border-b-2 border-[#403D39] px-4 flex items-center justify-between bg-[#262421]">
        <div className="flex items-center gap-2 overflow-hidden">
          {mode === 'REVIEW_ACTIVE' ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="font-black text-base text-white flex items-center gap-2 shrink-0">
                <Sparkles className="w-5 h-5 text-cyan-400" /> Diamond Review
              </span>
              {reviewData && (
                <span className="text-xs font-bold text-neutral-300 bg-[#312E2B] px-2.5 py-1 rounded-md border border-[#403D39] truncate max-w-[170px]">
                  {reviewData.eco_code} {reviewData.opening_name}
                </span>
              )}
            </div>
          ) : (
            <span className="font-black text-base text-white flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-[#81B64C]" /> Moves
            </span>
          )}
        </div>

        {/* Tab Switcher if in REVIEW mode */}
        {mode === 'REVIEW_ACTIVE' && (
          <div className="flex bg-[#312E2B] p-1 rounded-xl border border-[#403D39] shrink-0">
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1.5 text-sm font-extrabold rounded-lg transition-colors ${
                activeTab === 'review' ? 'bg-[#81B64C] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Coach
            </button>
            <button
              onClick={() => setActiveTab('moves')}
              className={`px-3 py-1.5 text-sm font-extrabold rounded-lg transition-colors ${
                activeTab === 'moves' ? 'bg-[#81B64C] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Moves
            </button>
          </div>
        )}
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* State 1: ANALYZING SPINNER */}
        {mode === 'ANALYZING' && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-linear-to-tr from-[#1BACA6] via-[#81B64C] to-emerald-400 animate-spin flex items-center justify-center p-0.5 shadow-2xl">
                <div className="w-full h-full bg-[#262421] rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-cyan-400 animate-pulse" />
                </div>
              </div>
            </div>
            <div>
              <div className="font-black text-lg text-white">Analyzing Game</div>
              <div className="text-sm text-neutral-300 mt-1.5 max-w-[280px] leading-relaxed">
                Stockfish MultiPV=2 calculating CAPS2 Win Probability & Neuro-Symbolic Bitboard Tactics...
              </div>
            </div>
          </div>
        )}

        {/* State 2: REVIEW ACTIVE WORKSPACE */}
        {mode === 'REVIEW_ACTIVE' && reviewData && activeTab === 'review' && (
          <div className="space-y-3.5">
            {/* 1. Virtual Coach Dialogue Box */}
            <VirtualCoachBox
              currentPlyData={currentPlyData}
              onShowFollowUp={onShowFollowUp}
              hasFollowUp={hasFollowUp}
              isPlayingFollowUp={isPlayingFollowUp}
            />

            {/* 2. Advantage Swing Graph */}
            <AdvantageGraph
              plies={reviewData.plies}
              currentPlyIndex={currentMoveIndex}
              onSeekPly={onSelectMove}
            />

            {/* 3. CAPS2 Accuracy & Classification Matrix */}
            <CAPS2Matrix reviewData={reviewData} />
          </div>
        )}

        {/* State 3: TWO-COLUMN ALGEBRAIC SAN MOVE LIST (During Live Game, Game Over, or Moves tab) */}
        {(mode === 'LIVE_GAME' || mode === 'IDLE' || mode === 'GAME_OVER' || (mode === 'REVIEW_ACTIVE' && activeTab === 'moves')) && (
          <div
            ref={moveListRef}
            className="rounded-xl border-2 border-[#403D39] overflow-hidden bg-[#262421] shadow-inner text-sm"
          >
            {turns.length === 0 ? (
              <div className="p-10 text-center text-neutral-400 font-semibold italic text-base">
                Moves will appear here as they are played.
              </div>
            ) : (
              <div className="divide-y divide-[#34312E]">
                {turns.map((turn) => {
                  const isWhiteActive = currentMoveIndex === turn.whitePly;
                  const isBlackActive = turn.blackPly !== undefined && currentMoveIndex === turn.blackPly;

                  // In review mode, get move badges if available
                  const whitePlyInfo = reviewData?.plies[turn.whitePly];
                  const blackPlyInfo = turn.blackPly !== undefined ? reviewData?.plies[turn.blackPly] : undefined;

                  return (
                    <div
                      key={turn.turnNum}
                      className={`flex items-center text-neutral-200 text-sm md:text-base ${
                        turn.turnNum % 2 === 1 ? 'bg-[#2B2927]' : 'bg-[#262421]'
                      }`}
                    >
                      {/* Turn Number */}
                      <div className="w-12 py-2.5 px-3 text-right font-mono font-bold text-neutral-400 select-none border-r border-[#34312E] shrink-0 text-sm">
                        {turn.turnNum}.
                      </div>

                      {/* White Move */}
                      <div
                        onClick={() => onSelectMove(turn.whitePly)}
                        className={`flex-1 py-2 px-3.5 flex items-center justify-between cursor-pointer font-bold transition-colors ${
                          isWhiteActive
                            ? 'active-ply-item bg-[#81B64C]/30 text-white font-black ring-2 ring-[#81B64C] rounded-sm'
                            : 'hover:bg-[#383531] text-neutral-100'
                        }`}
                      >
                        <span className="text-sm md:text-base">{turn.white}</span>
                        {whitePlyInfo && (
                          <span
                            style={{ backgroundColor: whitePlyInfo.classification_color }}
                            className="px-2 py-0.5 rounded-full text-white text-xs font-black shadow-sm"
                          >
                            {whitePlyInfo.classification_symbol}
                          </span>
                        )}
                      </div>

                      {/* Black Move */}
                      {turn.black ? (
                        <div
                          onClick={() => turn.blackPly !== undefined && onSelectMove(turn.blackPly)}
                          className={`flex-1 py-2 px-3.5 flex items-center justify-between cursor-pointer font-bold transition-colors ${
                            isBlackActive
                              ? 'active-ply-item bg-[#81B64C]/30 text-white font-black ring-2 ring-[#81B64C] rounded-sm'
                              : 'hover:bg-[#383531] text-neutral-100'
                          }`}
                        >
                          <span className="text-sm md:text-base">{turn.black}</span>
                          {blackPlyInfo && (
                            <span
                              style={{ backgroundColor: blackPlyInfo.classification_color }}
                              className="px-2 py-0.5 rounded-full text-white text-xs font-black shadow-sm"
                            >
                              {blackPlyInfo.classification_symbol}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* State 4: POST-GAME SUMMARY CARD (Upon Game Over) */}
        {mode === 'GAME_OVER' && (
          <div className="bg-[#312E2B] border-2 border-[#81B64C] rounded-2xl p-5 shadow-2xl space-y-4 animate-fade-in">
            <div className="text-center">
              <div className="text-sm uppercase tracking-wider font-black text-neutral-400">
                Match Concluded
              </div>
              <div className="text-xl font-black text-white mt-1">
                {gameResultText || 'Game Over'}
              </div>
            </div>

            {/* Signature 3D Beveled Green CTA Button */}
            <button
              onClick={onStartReview}
              className="w-full py-3.5 px-5 rounded-xl font-black text-white text-lg tracking-wide chess-btn-green flex items-center justify-center gap-2.5 shadow-xl hover:brightness-105 active:scale-98 cursor-pointer"
            >
              <Sparkles className="w-6 h-6 text-amber-300" />
              <span>Game Review</span>
            </button>

            <button
              onClick={onNewGame}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-neutral-200 text-sm chess-btn-gray hover:text-white"
            >
              New Live Game
            </button>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="p-3.5 border-t-2 border-[#403D39] bg-[#262421]">
        {mode === 'REVIEW_ACTIVE' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onNewGame}
              className="flex-1 py-3 px-4 rounded-xl font-extrabold text-white text-sm chess-btn-green flex items-center justify-center gap-2 shadow-md active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Match</span>
            </button>

            <button
              onClick={onFlipBoard}
              className="p-3 rounded-xl text-neutral-300 hover:text-white bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39] transition-all shadow-sm active:scale-95"
              title="Flip Board"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        ) : mode === 'LIVE_GAME' ? (
          /* In-Game Action Bar: Resign, Offer Draw, Flip */
          <div className="flex items-center gap-2.5">
            <button
              onClick={onResign}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-extrabold text-neutral-200 bg-[#312E2B] hover:bg-rose-900/50 hover:text-rose-100 border border-[#403D39] transition-colors shadow-sm"
            >
              <Flag className="w-4 h-4" />
              <span>Resign</span>
            </button>

            <button
              onClick={onOfferDraw}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-extrabold text-neutral-200 bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39] transition-colors shadow-sm"
            >
              <Handshake className="w-4 h-4" />
              <span>Draw</span>
            </button>

            <button
              onClick={onFlipBoard}
              className="p-3 rounded-xl text-neutral-300 hover:text-white bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39] transition-colors shadow-sm"
              title="Flip Board"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onNewGame}
              className="w-full py-3 px-4 rounded-xl font-extrabold text-white text-sm chess-btn-green flex items-center justify-center gap-2 shadow-md"
            >
              <span>Start New Match</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
