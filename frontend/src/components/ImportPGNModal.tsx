import React, { useState } from 'react';
import { X, Upload, FileText, Sparkles } from 'lucide-react';

interface ImportPGNModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (pgn: string) => void;
}

const PRESET_CLASSIC_GAMES = [
  {
    name: 'Paul Morphy vs Duke of Brunswick (Opera Game 1858)',
    desc: 'The iconic romantic attacking masterpiece featuring multiple piece sacrifices and brilliant queen deflections.',
    pgn: `[Event "Paris Opera"]
[Site "Paris FRA"]
[Date "1858.10.21"]
[White "Morphy, Paul"]
[Black "Duke of Brunswick and Count Isouard"]
[Result "1-0"]
[ECO "C41"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`,
  },
  {
    name: 'Kasparov vs Topalov (Wijk aan Zee 1999)',
    desc: '"Kasparov\'s Immortal" - An unforgettable rook sacrifice on d4 that chased the black king across the entire board.',
    pgn: `[Event "Hoogovens Group A"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[White "Kasparov, Garry"]
[Black "Topalov, Veselin"]
[Result "1-0"]
[ECO "B07"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bd7 Qd3+ 37. Ka1 Ra8+ 38. Ra7 Rxa7+ 39. Qxa7 Qc3+ 40. Kb1 Qb3+ 41. Ka1 Kc1 1-0`,
  },
];

export const ImportPGNModal: React.FC<ImportPGNModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [pgnText, setPgnText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pgnText.trim()) {
      onImport(pgnText.trim());
      onClose();
    }
  };

  const handleSelectPreset = (presetPgn: string) => {
    setPgnText(presetPgn);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#262421] border-2 border-[#403D39] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#403D39] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Upload className="w-6 h-6 text-[#81B64C]" />
            <span className="font-black text-lg text-white">Import PGN for Diamond Review</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#312E2B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className="block text-sm font-bold text-neutral-200 mb-2">
              Paste PGN or Algebraic Notation
            </label>
            <textarea
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ..."
              rows={6}
              className="w-full bg-[#1E1C1A] border-2 border-[#403D39] rounded-xl p-3.5 text-sm font-mono text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-[#81B64C] focus:ring-1 focus:ring-[#81B64C]"
            />
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-xs font-black text-neutral-400 uppercase tracking-wider block mb-2.5">
              Or Load Famous Classic Masterpiece
            </span>
            <div className="space-y-2.5">
              {PRESET_CLASSIC_GAMES.map((game, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectPreset(game.pgn)}
                  className="bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39] rounded-xl p-3.5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#81B64C]" />
                      {game.name}
                    </span>
                    <span className="text-xs text-neutral-300 font-bold bg-[#262421] px-2.5 py-1 rounded-md border border-[#403D39]">
                      Load
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {game.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-neutral-300 bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!pgnText.trim()}
              className="px-6 py-2.5 rounded-xl text-sm font-black text-white chess-btn-green flex items-center gap-2 disabled:opacity-40 disabled:hover:bg-[#81B64C]"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Run Diamond Review</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
