import React from 'react';
import { ReviewResponseData } from '../types/chess';

interface CAPS2MatrixProps {
  reviewData: ReviewResponseData;
}

export const CAPS2Matrix: React.FC<CAPS2MatrixProps> = ({ reviewData }) => {
  const tiers = [
    { key: 'brilliant', name: 'Brilliant', symbol: '!!', color: '#1BACA6' },
    { key: 'great', name: 'Great', symbol: '!', color: '#5C8BB0' },
    { key: 'best', name: 'Best', symbol: '★', color: '#96BC4B' },
    { key: 'excellent', name: 'Excellent', symbol: 'Excellent', color: '#96BC4B' },
    { key: 'good', name: 'Good', symbol: 'Good', color: '#95AF8A' },
    { key: 'book', name: 'Book', symbol: 'Book', color: '#A88865' },
    { key: 'inaccuracy', name: 'Inaccuracy', symbol: '?!', color: '#F7C631' },
    { key: 'mistake', name: 'Mistake', symbol: '?', color: '#E6912C' },
    { key: 'blunder', name: 'Blunder', symbol: '??', color: '#CA3431' },
    { key: 'miss', name: 'Miss', symbol: 'Miss', color: '#FF6B6B' },
  ];

  return (
    <div className="bg-[#262421] border-2 border-[#403D39] rounded-2xl p-3.5 shadow-xl select-none">
      {/* Accuracy & Estimated Rating Header Cards */}
      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        {/* White Card */}
        <div className="bg-[#312E2B] rounded-xl p-3 border border-[#403D39] flex flex-col items-center shadow-md">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-neutral-400 shadow-xs" />
            <span className="font-extrabold text-sm md:text-base text-white truncate max-w-[120px]">
              {reviewData.white_player}
            </span>
          </div>
          <div className="text-3xl md:text-4xl font-black text-white tracking-tight">
            {reviewData.white_accuracy.toFixed(1)}%
          </div>
          <div className="text-xs text-neutral-300 mt-1 font-medium">
            Est. Rating: <span className="font-black text-amber-400 text-sm">{reviewData.white_rating_est}</span>
          </div>
        </div>

        {/* Black Card */}
        <div className="bg-[#312E2B] rounded-xl p-3 border border-[#403D39] flex flex-col items-center shadow-md">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-neutral-900 border-2 border-neutral-500 shadow-xs" />
            <span className="font-extrabold text-sm md:text-base text-white truncate max-w-[120px]">
              {reviewData.black_player}
            </span>
          </div>
          <div className="text-3xl md:text-4xl font-black text-white tracking-tight">
            {reviewData.black_accuracy.toFixed(1)}%
          </div>
          <div className="text-xs text-neutral-300 mt-1 font-medium">
            Est. Rating: <span className="font-black text-amber-400 text-sm">{reviewData.black_rating_est}</span>
          </div>
        </div>
      </div>

      {/* 10 Classification Tiers Vertical Table */}
      <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
        {tiers.map((t) => {
          const whiteCount = reviewData.white_counts[t.key] || 0;
          const blackCount = reviewData.black_counts[t.key] || 0;

          return (
            <div
              key={t.key}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#2B2927] hover:bg-[#34312E] transition-colors"
            >
              {/* White Count */}
              <span className={`w-10 text-center text-sm md:text-base font-black ${whiteCount > 0 ? 'text-white' : 'text-neutral-500'}`}>
                {whiteCount}
              </span>

              {/* Classification Badge & Label */}
              <div className="flex items-center gap-2 flex-1 justify-center">
                <span
                  style={{ backgroundColor: t.color }}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black text-white shadow-xs shrink-0"
                >
                  {t.symbol.length <= 2 ? t.symbol : t.symbol.charAt(0)}
                </span>
                <span className="font-bold text-neutral-200 text-xs md:text-sm truncate">
                  {t.name}
                </span>
              </div>

              {/* Black Count */}
              <span className={`w-10 text-center text-sm md:text-base font-black ${blackCount > 0 ? 'text-white' : 'text-neutral-500'}`}>
                {blackCount}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
