import React, { useState } from 'react';
import { X, Settings, Key, Cpu, Sparkles, Check, Clock } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeControlSeconds: number;
  setTimeControlSeconds: (sec: number) => void;
  botSkillLevel: number;
  setBotSkillLevel: (lvl: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  timeControlSeconds,
  setTimeControlSeconds,
  botSkillLevel,
  setBotSkillLevel,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#262421] border border-[#403D39] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#403D39] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-[#81B64C]" />
            <span className="font-black text-lg text-white">Engine & Coach Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#312E2B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          {/* Gemini API Key Section */}
          <div className="bg-[#1E1C1A] border-2 border-[#403D39] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-neutral-100 flex items-center gap-2 text-sm">
                <Key className="w-4 h-4 text-amber-400" /> Google AI Studio Gemini API Key
              </span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/40">
                gemini-3.5-flash-lite Active
              </span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Powers the Gemini Flash Diamond Coach. If left blank, the deterministic Bitboard Coach operates with 100% offline accuracy.
            </p>
            <form onSubmit={handleSaveApiKey} className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste AIzaSy... key or configure in .env"
                className="flex-1 bg-[#262421] border border-[#403D39] rounded-lg px-3.5 py-2 font-mono text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-[#81B64C]"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg font-bold text-white chess-btn-green flex items-center gap-1.5"
              >
                {saveSuccess ? <Check className="w-4 h-4 text-white" /> : null}
                <span>{saveSuccess ? 'Saved!' : 'Save'}</span>
              </button>
            </form>
          </div>

          {/* Engine Status Banner */}
          <div className="bg-[#1E1C1A] border-2 border-[#403D39] rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="font-extrabold text-sm text-white">Stockfish 19 UCI MultiPV=2</div>
                <div className="text-xs text-neutral-300">Target Depth 16 • Sigmoid CAPS2 Logistic Mapping</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-emerald-900/50 text-emerald-300 font-black text-xs border border-emerald-700/60">
              ACTIVE
            </span>
          </div>

          {/* Time Controls */}
          <div className="space-y-2">
            <label className="font-bold text-neutral-200 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-[#81B64C]" /> Live Match Time Control
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { sec: 60, label: '1 min Bullet' },
                { sec: 180, label: '3 min Blitz' },
                { sec: 300, label: '5 min Blitz' },
                { sec: 600, label: '10 min Rapid' },
              ].map((tc) => (
                <button
                  key={tc.sec}
                  type="button"
                  onClick={() => setTimeControlSeconds(tc.sec)}
                  className={`py-2.5 rounded-lg font-bold text-sm text-center transition-colors ${
                    timeControlSeconds === tc.sec
                      ? 'bg-[#81B64C] text-white shadow-sm'
                      : 'bg-[#312E2B] text-neutral-300 hover:bg-[#3D3A36]'
                  }`}
                >
                  {tc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bot Skill Level */}
          <div className="space-y-2">
            <label className="font-bold text-neutral-200 flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-cyan-400" /> Opponent AI Strength
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { lvl: 5, label: 'Casual (1200)' },
                { lvl: 12, label: 'Intermediate (1800)' },
                { lvl: 20, label: 'Grandmaster (2600)' },
              ].map((b) => (
                <button
                  key={b.lvl}
                  type="button"
                  onClick={() => setBotSkillLevel(b.lvl)}
                  className={`py-2.5 rounded-lg font-bold text-sm text-center transition-colors ${
                    botSkillLevel === b.lvl
                      ? 'bg-[#81B64C] text-white shadow-sm'
                      : 'bg-[#312E2B] text-neutral-300 hover:bg-[#3D3A36]'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#403D39] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-bold text-neutral-200 bg-[#312E2B] hover:bg-[#3D3A36] border border-[#403D39]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
