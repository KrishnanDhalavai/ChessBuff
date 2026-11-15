import React from 'react';

interface ChessClockProps {
  timeMs: number;
  isActive: boolean;
  isLowTime?: boolean;
}

export const ChessClock: React.FC<ChessClockProps> = ({ timeMs, isActive }) => {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((Math.max(0, timeMs) % 1000) / 100);

  const isCrimson = totalSeconds < 10 && timeMs > 0;

  // Active: #FFFFFF background with dark numerals #1A1816
  // Inactive: #262421 background with neutral-400 numerals
  // Low time: #B33430 crimson alert with white numerals
  let bgClass = 'bg-[#262421] text-neutral-400 border border-[#403D39]';
  if (isCrimson && isActive) {
    bgClass = 'bg-[#B33430] text-white border border-rose-500 shadow-md shadow-rose-900/40 animate-pulse';
  } else if (isActive) {
    bgClass = 'bg-[#FFFFFF] text-[#1A1816] font-extrabold shadow-md border border-neutral-300';
  }

  const formattedTime =
    totalSeconds < 10 && isActive
      ? `${seconds}.${tenths}`
      : `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div
      className={`px-4 py-2 rounded-lg min-w-[92px] text-center font-mono text-xl font-black tracking-tight select-none transition-all duration-150 shadow-md ${bgClass}`}
    >
      {formattedTime}
    </div>
  );
};
