import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square } from 'chess.js';
import { NavRail } from './components/NavRail';
import { BoardStage } from './components/BoardStage';
import { PlayerStrip } from './components/PlayerStrip';
import { EvalBar } from './components/EvalBar';
import { VCRControls } from './components/VCRControls';
import { RightPanel } from './components/RightPanel';
import { ImportPGNModal } from './components/ImportPGNModal';
import { ArchiveModal } from './components/ArchiveModal';
import { SettingsModal } from './components/SettingsModal';
import { soundManager } from './audio/soundManager';
import {
  GameStateMode,
  PieceSymbol,
  ReviewResponseData,
  PlyTelemetry,
  TacticalArrow,
} from './types/chess';

export const App: React.FC = () => {
  // --- State Machine ---
  const [mode, setMode] = useState<GameStateMode>('LIVE_GAME');
  const [activeNavTab, setActiveNavTab] = useState<string>('play');

  // --- Chess Game State ---
  const [game, setGame] = useState<Chess>(new Chess());
  const [sanMoves, setSanMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [gameResultText, setGameResultText] = useState<string | null>(null);

  // --- Clocks ---
  const [timeControlSeconds, setTimeControlSeconds] = useState<number>(300); // 5 min
  const [whiteTimeMs, setWhiteTimeMs] = useState<number>(300 * 1000);
  const [blackTimeMs, setBlackTimeMs] = useState<number>(300 * 1000);
  const [activeTurn, setActiveTurn] = useState<'w' | 'b'>('w');

  // --- Captured Pieces & Material ---
  const [whiteCaptured, setWhiteCaptured] = useState<PieceSymbol[]>([]);
  const [blackCaptured, setBlackCaptured] = useState<PieceSymbol[]>([]);
  const [whiteMaterialDiff, setWhiteMaterialDiff] = useState<number>(0);
  const [blackMaterialDiff, setBlackMaterialDiff] = useState<number>(0);

  // --- AI Opponent Settings ---
  const [botSkillLevel, setBotSkillLevel] = useState<number>(12); // Intermediate
  const [isBotPlaying, setIsBotPlaying] = useState<boolean>(true); // Play vs Bot by default
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  // --- Post-Game Review Data ---
  const [reviewData, setReviewData] = useState<ReviewResponseData | null>(null);
  const [currentReviewPlyIndex, setCurrentReviewPlyIndex] = useState<number>(-1);
  const [isPlayingFollowUp, setIsPlayingFollowUp] = useState<boolean>(false);

  // --- Modals ---
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Sound start
  useEffect(() => {
    soundManager.play('start');
  }, []);

  // Update captured pieces & material difference
  const updateCapturedPieces = useCallback((chessInstance: Chess) => {
    const board = chessInstance.board();
    const remainingWhite: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
    const remainingBlack: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) {
          if (p.color === 'w') remainingWhite[p.type as PieceSymbol]++;
          else remainingBlack[p.type as PieceSymbol]++;
        }
      }
    }

    const startingCounts: Record<PieceSymbol, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
    const pieceValues: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

    const capturedW: PieceSymbol[] = [];
    const capturedB: PieceSymbol[] = [];

    (Object.keys(startingCounts) as PieceSymbol[]).forEach((pt) => {
      const lostW = startingCounts[pt] - remainingWhite[pt];
      for (let i = 0; i < lostW; i++) capturedW.push(pt);

      const lostB = startingCounts[pt] - remainingBlack[pt];
      for (let i = 0; i < lostB; i++) capturedB.push(pt);
    });

    let scoreW = 0;
    let scoreB = 0;
    capturedB.forEach((p) => (scoreW += pieceValues[p]));
    capturedW.forEach((p) => (scoreB += pieceValues[p]));

    setWhiteCaptured(capturedB); // White captured Black's pieces
    setBlackCaptured(capturedW); // Black captured White's pieces
    setWhiteMaterialDiff(Math.max(0, scoreW - scoreB));
    setBlackMaterialDiff(Math.max(0, scoreB - scoreW));
  }, []);

  // Clock Ticker
  useEffect(() => {
    if (mode !== 'LIVE_GAME') return;

    const interval = setInterval(() => {
      if (activeTurn === 'w') {
        setWhiteTimeMs((prev) => {
          if (prev <= 100) {
            handleGameOver('Black wins on time');
            return 0;
          }
          return prev - 100;
        });
      } else {
        setBlackTimeMs((prev) => {
          if (prev <= 100) {
            handleGameOver('White wins on time');
            return 0;
          }
          return prev - 100;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [mode, activeTurn]);

  // Handle Game Termination
  const handleGameOver = useCallback((resultMsg: string) => {
    setMode('GAME_OVER');
    setGameResultText(resultMsg);
    soundManager.play('end');
  }, []);

  // Check Game State After Every Move
  const verifyGameState = useCallback((chessInstance: Chess) => {
    if (chessInstance.isGameOver()) {
      if (chessInstance.isCheckmate()) {
        const winner = chessInstance.turn() === 'w' ? 'Black' : 'White';
        handleGameOver(`${winner} won by checkmate!`);
      } else if (chessInstance.isDraw()) {
        if (chessInstance.isStalemate()) {
          handleGameOver('Draw by stalemate');
        } else if (chessInstance.isThreefoldRepetition()) {
          handleGameOver('Draw by repetition');
        } else if (chessInstance.isInsufficientMaterial()) {
          handleGameOver('Draw by insufficient material');
        } else {
          handleGameOver('Draw agreed');
        }
      }
      return true;
    }
    return false;
  }, [handleGameOver]);

  // AI Opponent Move Trigger
  const triggerBotMove = useCallback(async (currentFen: string) => {
    if (mode !== 'LIVE_GAME' || !isBotPlaying) return;

    try {
      // Query backend engine for AI move
      const res = await fetch('/api/engine/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: currentFen, depth: Math.min(12, Math.max(4, botSkillLevel)) }),
      });

      if (res.ok) {
        const data = await res.json();
        const bestMoveUci = data.best_move;
        if (bestMoveUci) {
          const from = bestMoveUci.slice(0, 2) as Square;
          const to = bestMoveUci.slice(2, 4) as Square;
          const promo = bestMoveUci.length > 4 ? (bestMoveUci[4] as PieceSymbol) : undefined;

          // Apply move
          setGame((prevGame) => {
            const nextGame = new Chess(prevGame.fen());
            try {
              const moveResult = nextGame.move({ from, to, promotion: promo });
              if (moveResult) {
                if (moveResult.captured) soundManager.play('capture');
                else if (nextGame.inCheck()) soundManager.play('check');
                else if (moveResult.san.includes('O-O')) soundManager.play('castle');
                else soundManager.play('move');

                setLastMove({ from, to });
                setSanMoves((prev) => [...prev, moveResult.san]);
                updateCapturedPieces(nextGame);
                setActiveTurn('w');
                verifyGameState(nextGame);
              }
            } catch (e) {
              console.error('Bot move execution failed:', e);
            }
            return nextGame;
          });
        }
      }
    } catch (e) {
      console.warn('Bot evaluation request error:', e);
    }
  }, [mode, isBotPlaying, botSkillLevel, updateCapturedPieces, verifyGameState]);

  // Human Player Move
  const handlePlayerMove = (from: Square, to: Square, promotion?: PieceSymbol): boolean => {
    if (mode !== 'LIVE_GAME') return false;

    try {
      const nextGame = new Chess(game.fen());
      const moveResult = nextGame.move({
        from,
        to,
        promotion: promotion || 'q',
      });

      if (!moveResult) return false;

      // Play audio based on move nature
      if (moveResult.captured) soundManager.play('capture');
      else if (nextGame.inCheck()) soundManager.play('check');
      else if (moveResult.san.includes('O-O')) soundManager.play('castle');
      else soundManager.play('move');

      setLastMove({ from, to });
      setGame(nextGame);
      setSanMoves((prev) => [...prev, moveResult.san]);
      updateCapturedPieces(nextGame);

      const isOver = verifyGameState(nextGame);
      if (!isOver) {
        setActiveTurn('b');
        // Trigger bot reply if bot is playing as Black
        if (isBotPlaying) {
          setTimeout(() => {
            triggerBotMove(nextGame.fen());
          }, 350);
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  // Start Diamond Post-Game Review
  const handleStartReview = async () => {
    setMode('ANALYZING');
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moves: sanMoves,
          white_player: 'You',
          black_player: isBotPlaying ? 'Grandmaster AI' : 'Opponent',
          result: gameResultText?.includes('White') ? '1-0' : gameResultText?.includes('Black') ? '0-1' : '1/2-1/2',
        }),
      });

      if (res.ok) {
        const data: ReviewResponseData = await res.json();
        setReviewData(data);
        setMode('REVIEW_ACTIVE');
        // Seek to first move
        seekReviewPly(0, data);
        soundManager.play('start');
      } else {
        alert('Failed to generate review. Please verify your game moves.');
        setMode('GAME_OVER');
      }
    } catch (e) {
      console.error('Review generation error:', e);
      setMode('GAME_OVER');
    }
  };

  // Import external PGN for review
  const handleImportPGN = async (pgnText: string) => {
    setMode('ANALYZING');
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn: pgnText }),
      });

      if (res.ok) {
        const data: ReviewResponseData = await res.json();
        setReviewData(data);
        setSanMoves(data.plies.map((p) => p.san));
        setMode('REVIEW_ACTIVE');
        seekReviewPly(0, data);
        soundManager.play('start');
      } else {
        alert('Could not parse or validate the provided PGN.');
        setMode('IDLE');
      }
    } catch (e) {
      console.error('Import review error:', e);
      setMode('IDLE');
    }
  };

  // Load from Archive
  const handleLoadArchiveReview = async (gameHash: string) => {
    setMode('ANALYZING');
    try {
      const res = await fetch(`/api/review/${gameHash}`);
      if (res.ok) {
        const data: ReviewResponseData = await res.json();
        setReviewData(data);
        setSanMoves(data.plies.map((p) => p.san));
        setMode('REVIEW_ACTIVE');
        seekReviewPly(0, data);
        soundManager.play('start');
      }
    } catch (e) {
      console.error('Failed to load archive review:', e);
      setMode('IDLE');
    }
  };

  // Seek Board to a Specific Ply during Review
  const seekReviewPly = (plyIndex: number, currentReview: ReviewResponseData | null = reviewData) => {
    const rev = currentReview || reviewData;
    if (!rev || !rev.plies || rev.plies.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(rev.plies.length - 1, plyIndex));
    setCurrentReviewPlyIndex(clampedIndex);

    const plyData = rev.plies[clampedIndex];
    if (plyData) {
      const targetFen = plyData.fen_after;
      const newGame = new Chess(targetFen);
      setGame(newGame);
      updateCapturedPieces(newGame);

      const uci = plyData.uci;
      if (uci && uci.length >= 4) {
        setLastMove({
          from: uci.slice(0, 2) as Square,
          to: uci.slice(2, 4) as Square,
        });
      }
      soundManager.play('move');
    }
  };

  // Interactive "Show Follow-Up" Button
  const handleShowFollowUp = async () => {
    if (!reviewData || currentReviewPlyIndex < 0 || isPlayingFollowUp) return;
    const currentPly = reviewData.plies[currentReviewPlyIndex];
    if (!currentPly || !currentPly.refutation_san || currentPly.refutation_san.length === 0) return;

    setIsPlayingFollowUp(true);
    // Start from fen_after
    const demoGame = new Chess(currentPly.fen_after);

    for (let i = 0; i < currentPly.refutation_san.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const sanMove = currentPly.refutation_san[i];
      try {
        const res = demoGame.move(sanMove);
        if (res) {
          setGame(new Chess(demoGame.fen()));
          setLastMove({ from: res.from as Square, to: res.to as Square });
          if (res.captured) soundManager.play('capture');
          else if (demoGame.inCheck()) soundManager.play('check');
          else soundManager.play('move');
        }
      } catch (e) {
        break;
      }
    }

    // Wait a brief moment and reset back to active ply position
    await new Promise((resolve) => setTimeout(resolve, 1200));
    seekReviewPly(currentReviewPlyIndex);
    setIsPlayingFollowUp(false);
  };

  // Start New Live Match
  const handleNewGame = () => {
    const freshGame = new Chess();
    setGame(freshGame);
    setSanMoves([]);
    setLastMove(null);
    setReviewData(null);
    setCurrentReviewPlyIndex(-1);
    setGameResultText(null);
    setWhiteTimeMs(timeControlSeconds * 1000);
    setBlackTimeMs(timeControlSeconds * 1000);
    setActiveTurn('w');
    setWhiteCaptured([]);
    setBlackCaptured([]);
    setWhiteMaterialDiff(0);
    setBlackMaterialDiff(0);
    setMode('LIVE_GAME');
    soundManager.play('start');
  };

  // Resign / Draw
  const handleResign = () => {
    handleGameOver('Resignation by White. Black wins!');
  };

  const handleOfferDraw = () => {
    handleGameOver('Game drawn by mutual agreement.');
  };

  // Navigation handlers
  const currentPlyData: PlyTelemetry | null =
    mode === 'REVIEW_ACTIVE' && reviewData && currentReviewPlyIndex >= 0
      ? reviewData.plies[currentReviewPlyIndex] || null
      : null;

  // Active board badge & arrows in review mode
  const activeBadge =
    mode === 'REVIEW_ACTIVE' && currentPlyData && lastMove
      ? {
          square: lastMove.to,
          symbol: currentPlyData.classification_symbol,
          color: currentPlyData.classification_color,
        }
      : null;

  const arrows: TacticalArrow[] =
    mode === 'REVIEW_ACTIVE' && currentPlyData ? currentPlyData.arrows || [] : [];

  return (
    <div className="w-screen h-screen flex bg-[#302E2B] overflow-hidden select-none">
      {/* 1. Left Navigation Rail (160px) */}
      <NavRail
        activeTab={activeNavTab}
        setActiveTab={(tab) => {
          setActiveNavTab(tab);
          if (tab === 'play' && mode === 'IDLE') handleNewGame();
        }}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenArchive={() => setIsArchiveOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        soundMuted={soundMuted}
        setSoundMuted={setSoundMuted}
      />

      {/* 2. Center Board Stage */}
      <main className="flex-1 h-screen flex flex-col items-center justify-center p-3 relative overflow-hidden bg-[#302E2B]">
        <div className="flex flex-col items-center justify-center w-full max-w-[min(calc(100vh-170px),calc(100vw-620px),820px)] mx-auto">
          {/* Top Player Strip (Opponent / Black) */}
          <div className="w-full mb-1.5">
            <PlayerStrip
              handle={isFlipped ? 'You' : isBotPlaying ? 'Grandmaster AI' : 'Opponent'}
              rating={isFlipped ? 1500 : 2600}
              flagCode={isFlipped ? '🇺🇸' : '🤖'}
              capturedPieces={isFlipped ? whiteCaptured : blackCaptured}
              opponentColor={isFlipped ? 'b' : 'w'}
              materialDiff={isFlipped ? whiteMaterialDiff : blackMaterialDiff}
              timeMs={isFlipped ? whiteTimeMs : blackTimeMs}
              isActive={mode === 'LIVE_GAME' && (isFlipped ? activeTurn === 'w' : activeTurn === 'b')}
            />
          </div>

          {/* Board Center Container with Dynamic 28px Eval Bar */}
          <div className="flex items-center justify-center w-full aspect-square relative">
            {/* 28px Vertical Evaluation Bar (STRICTLY HIDDEN during LIVE_GAME) */}
            <EvalBar
              isVisible={mode === 'REVIEW_ACTIVE'}
              winProbWhite={currentPlyData?.win_prob_white ?? 50.0}
              evalText={currentPlyData?.eval_text ?? '0.0'}
              isFlipped={isFlipped}
            />

            {/* Square Board Stage */}
            <BoardStage
              game={game}
              isFlipped={isFlipped}
              lastMove={lastMove}
              onMove={handlePlayerMove}
              isInteractive={mode === 'LIVE_GAME' && activeTurn === (isFlipped ? 'b' : 'w')}
              arrows={arrows}
              activeBadge={activeBadge}
            />
          </div>

          {/* Bottom Player Strip (You / White) */}
          <div className="w-full mt-1.5">
            <PlayerStrip
              handle={isFlipped ? (isBotPlaying ? 'Grandmaster AI' : 'Opponent') : 'You'}
              rating={isFlipped ? 2600 : 1500}
              flagCode={isFlipped ? '🤖' : '🇺🇸'}
              capturedPieces={isFlipped ? blackCaptured : whiteCaptured}
              opponentColor={isFlipped ? 'w' : 'b'}
              materialDiff={isFlipped ? blackMaterialDiff : whiteMaterialDiff}
              timeMs={isFlipped ? blackTimeMs : whiteTimeMs}
              isActive={mode === 'LIVE_GAME' && (isFlipped ? activeTurn === 'b' : activeTurn === 'w')}
            />
          </div>

          {/* Center Bottom: VCR Playback & Next/Previous Move Tracker */}
          {(mode === 'REVIEW_ACTIVE' || (mode === 'GAME_OVER' && sanMoves.length > 0)) && (
            <div className="w-full mt-2.5">
              <VCRControls
                currentPlyIndex={currentReviewPlyIndex}
                totalPlies={sanMoves.length}
                currentSan={currentPlyData?.san}
                onFirst={() => seekReviewPly(0)}
                onPrev={() => seekReviewPly(currentReviewPlyIndex - 1)}
                onNext={() => seekReviewPly(currentReviewPlyIndex + 1)}
                onLast={() => seekReviewPly(sanMoves.length - 1)}
                onFlip={() => setIsFlipped(!isFlipped)}
                isFlipped={isFlipped}
              />
            </div>
          )}
        </div>
      </main>

      {/* 3. 420px Right Analysis & Control Panel */}
      <RightPanel
        mode={mode}
        sanMoves={sanMoves}
        currentMoveIndex={currentReviewPlyIndex}
        onSelectMove={(plyIndex) => {
          if (mode === 'REVIEW_ACTIVE') seekReviewPly(plyIndex);
        }}
        onResign={handleResign}
        onOfferDraw={handleOfferDraw}
        onFlipBoard={() => setIsFlipped(!isFlipped)}
        onStartReview={handleStartReview}
        onNewGame={handleNewGame}
        reviewData={reviewData}
        currentPlyData={currentPlyData}
        onShowFollowUp={handleShowFollowUp}
        hasFollowUp={Boolean(currentPlyData?.refutation_san && currentPlyData.refutation_san.length > 0)}
        isPlayingFollowUp={isPlayingFollowUp}
        gameResultText={gameResultText}
      />

      {/* Modals */}
      <ImportPGNModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportPGN}
      />

      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        onLoadReview={handleLoadArchiveReview}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        timeControlSeconds={timeControlSeconds}
        setTimeControlSeconds={(sec) => {
          setTimeControlSeconds(sec);
          setWhiteTimeMs(sec * 1000);
          setBlackTimeMs(sec * 1000);
        }}
        botSkillLevel={botSkillLevel}
        setBotSkillLevel={setBotSkillLevel}
      />
    </div>
  );
};
