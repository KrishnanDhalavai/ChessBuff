import React, { useState } from 'react';
import { PlyTelemetry } from '../types/chess';

interface AdvantageGraphProps {
  plies: PlyTelemetry[];
  currentPlyIndex: number;
  onSeekPly: (plyIndex: number) => void;
}

export const AdvantageGraph: React.FC<AdvantageGraphProps> = ({
  plies,
  currentPlyIndex,
  onSeekPly,
}) => {
  const [hoveredPly, setHoveredPly] = useState<number | null>(null);

  if (!plies || plies.length === 0) {
    return null;
  }

  const width = 360;
  const height = 90;
  const paddingX = 12;
  const paddingY = 8;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  const totalPoints = plies.length;
  // Starting point at ply 0 (50% win prob)
  const winProbPoints = [50.0, ...plies.map((p) => p.win_prob_white)];

  const getX = (idx: number) => paddingX + (idx / Math.max(1, totalPoints)) * graphWidth;
  // 100% win prob -> Y = paddingY (top); 0% win prob -> Y = paddingY + graphHeight (bottom)
  const getY = (val: number) => paddingY + graphHeight - (val / 100.0) * graphHeight;

  // Build SVG path string for the line
  const linePoints = winProbPoints.map((val, idx) => `${getX(idx)},${getY(val)}`);
  const pathD = `M ${linePoints.join(' L ')}`;

  // Area path (closed to bottom)
  const midY = getY(50);
  const areaD = `${pathD} L ${getX(totalPoints)},${height - paddingY} L ${paddingX},${height - paddingY} Z`;

  const activeX = getX(currentPlyIndex + 1);
  const activeY = getY(winProbPoints[currentPlyIndex + 1] ?? 50);

  const activePlyData = plies[currentPlyIndex] || null;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - paddingX;
    const ratio = Math.max(0, Math.min(1, clickX / graphWidth));
    const targetPly = Math.round(ratio * totalPoints);
    onSeekPly(Math.max(0, Math.min(totalPoints - 1, targetPly - 1)));
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hoverX = e.clientX - rect.left - paddingX;
    const ratio = Math.max(0, Math.min(1, hoverX / graphWidth));
    const targetPly = Math.round(ratio * totalPoints);
    setHoveredPly(Math.max(1, Math.min(totalPoints, targetPly)));
  };

  return (
    <div className="bg-[#262421] border-2 border-[#403D39] rounded-2xl p-3.5 shadow-xl select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-extrabold text-white">Advantage Swing Graph</span>
        <span className="text-xs font-mono font-bold text-neutral-300 bg-[#312E2B] px-2 py-0.5 rounded border border-[#403D39]">
          White: {plies[currentPlyIndex]?.win_prob_white?.toFixed(0) ?? 50}%
        </span>
      </div>

      <div className="relative cursor-pointer">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[90px] overflow-visible"
          onClick={handleSvgClick}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={() => setHoveredPly(null)}
        >
          {/* Background area */}
          <rect x={paddingX} y={paddingY} width={graphWidth} height={graphHeight} fill="#1E1C1A" rx="4" />

          {/* 50% Equality Baseline */}
          <line
            x1={paddingX}
            y1={midY}
            x2={width - paddingX}
            y2={midY}
            stroke="#403D39"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* Win Probability Area Gradient */}
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#81B64C" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          <path d={areaD} fill="url(#areaGradient)" />

          {/* Main Win Prob Trend Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Critical Move Markers (Blunders, Mistakes, Brilliant) */}
          {plies.map((p, idx) => {
            const isBlunder = p.classification_tier === 'blunder';
            const isBrilliant = p.classification_tier === 'brilliant';
            const isMiss = p.classification_tier === 'miss';
            if (!isBlunder && !isBrilliant && !isMiss) return null;

            const cx = getX(idx + 1);
            const cy = getY(p.win_prob_white);
            const color = p.classification_color;

            return (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r={isBrilliant ? 4 : 3}
                fill={color}
                stroke="#FFFFFF"
                strokeWidth="1.2"
              />
            );
          })}

          {/* Active Ply Vertical Cursor */}
          <line
            x1={activeX}
            y1={paddingY}
            x2={activeX}
            y2={height - paddingY}
            stroke="#81B64C"
            strokeWidth="2"
          />
          <circle
            cx={activeX}
            cy={activeY}
            r="4.5"
            fill="#81B64C"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
        </svg>

        {/* Hover / Active Tooltip */}
        {activePlyData && (
          <div className="flex items-center justify-between text-xs text-neutral-300 mt-2 font-mono bg-[#1C1A18] px-2.5 py-1.5 rounded-lg border border-[#403D39]">
            <span className="font-bold">Move {Math.floor((currentPlyIndex + 2) / 2)}: {activePlyData.mover} ({activePlyData.san})</span>
            <span style={{ color: activePlyData.classification_color }} className="font-black">
              {activePlyData.classification_symbol} {activePlyData.classification}
            </span>
            <span className="font-extrabold text-neutral-200">{activePlyData.eval_text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
