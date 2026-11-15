import React, { useEffect, useState } from 'react';
import { X, Archive, Sparkles, Filter, Calendar } from 'lucide-react';
import { GameArchiveItem } from '../types/chess';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadReview: (gameHash: string) => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  isOpen,
  onClose,
  onLoadReview,
}) => {
  const [games, setGames] = useState<GameArchiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tacticalFilter, setTacticalFilter] = useState<string>('all');
  const [filteredResults, setFilteredResults] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadArchive();
    }
  }, [isOpen]);

  const loadArchive = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/archive?limit=30');
      if (res.ok) {
        const data = await res.json();
        setGames(data);
      }
    } catch (e) {
      console.error('Failed to load archive:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = async (motif: string) => {
    setTacticalFilter(motif);
    if (motif === 'all') {
      setFilteredResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tactics/filter?motif=${motif}`);
      if (res.ok) {
        const data = await res.json();
        setFilteredResults(data);
      }
    } catch (e) {
      console.error('Tactical filter error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#262421] border-2 border-[#403D39] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#403D39] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Archive className="w-6 h-6 text-[#81B64C]" />
            <span className="font-black text-lg text-white">Game Review Archive</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#312E2B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tactical Motif Inverted Index Filter Bar */}
        <div className="px-4 py-2.5 bg-[#1E1C1A] border-b border-[#403D39] flex items-center gap-2 overflow-x-auto text-sm">
          <span className="font-bold text-neutral-300 flex items-center gap-1.5 shrink-0 text-sm">
            <Filter className="w-4 h-4 text-[#81B64C]" /> Motifs:
          </span>
          {[
            { id: 'all', label: 'All Games' },
            { id: 'fork', label: 'Knight/Queen Forks' },
            { id: 'pin', label: 'Absolute/Relative Pins' },
            { id: 'missed_mate', label: 'Missed Mates' },
            { id: 'back_rank', label: 'Back-Rank Weaknesses' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleFilterChange(item.id)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs md:text-sm transition-colors shrink-0 ${
                tacticalFilter === item.id
                  ? 'bg-[#81B64C] text-white shadow-xs'
                  : 'bg-[#2B2927] text-neutral-300 hover:text-white hover:bg-[#34312E]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* List Body */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {loading ? (
            <div className="text-center py-12 text-neutral-300 text-sm font-semibold">
              Loading archive records...
            </div>
          ) : tacticalFilter !== 'all' ? (
            /* Filtered Motif Results */
            filteredResults.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-sm italic">
                No games found with motif "{tacticalFilter}".
              </div>
            ) : (
              filteredResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => {
                    onLoadReview(r.game_hash);
                    onClose();
                  }}
                  className="bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39] rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-black text-sm text-white">
                      {r.white_player} vs {r.black_player} ({r.result})
                    </div>
                    <div className="text-xs text-neutral-300 mt-1">
                      {r.opening_name} • Ply {r.ply} ({r.mover} {r.classification})
                    </div>
                  </div>
                  <span className="text-xs font-black text-[#81B64C] uppercase tracking-wider bg-[#262421] px-2.5 py-1 rounded border border-[#403D39]">
                    {r.motif}
                  </span>
                </div>
              ))
            )
          ) : games.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-sm italic">
              No games reviewed yet. Play a game or import a PGN to generate your first Diamond Review!
            </div>
          ) : (
            games.map((g) => (
              <div
                key={g.game_hash}
                onClick={() => {
                  onLoadReview(g.game_hash);
                  onClose();
                }}
                className="bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39] rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-black text-sm md:text-base text-white">
                      {g.white_player} ({g.white_rating}) vs {g.black_player} ({g.black_rating})
                    </span>
                    <span className="text-xs font-mono font-bold bg-[#262421] px-2 py-0.5 rounded text-neutral-200 border border-[#403D39]">
                      {g.result}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-300 mt-1.5 flex items-center gap-3">
                    <span className="font-semibold">{g.eco_code} {g.opening_name}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-neutral-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(g.played_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Accuracies */}
                <div className="text-right shrink-0">
                  <div className="text-sm md:text-base font-black text-white">
                    <span className="text-neutral-100">{g.white_accuracy.toFixed(1)}%</span>
                    <span className="text-neutral-500 mx-1">/</span>
                    <span className="text-neutral-200">{g.black_accuracy.toFixed(1)}%</span>
                  </div>
                  <div className="text-xs text-[#81B64C] font-extrabold flex items-center justify-end gap-1 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> View Review
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
