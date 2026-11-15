import React from 'react';
import {
  Gamepad2,
  Puzzle,
  GraduationCap,
  Upload,
  Archive,
  Volume2,
  VolumeX,
  Settings,
  Sparkles,
} from 'lucide-react';
import { soundManager } from '../audio/soundManager';

interface NavRailProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenImport: () => void;
  onOpenArchive: () => void;
  onOpenSettings: () => void;
  soundMuted: boolean;
  setSoundMuted: (muted: boolean) => void;
}

export const NavRail: React.FC<NavRailProps> = ({
  activeTab,
  setActiveTab,
  onOpenImport,
  onOpenArchive,
  onOpenSettings,
  soundMuted,
  setSoundMuted,
}) => {
  const toggleSound = () => {
    const isMuted = soundManager.toggleMute();
    setSoundMuted(isMuted);
    if (!isMuted) soundManager.play('move');
  };

  const navItems = [
    { id: 'play', label: 'Play', icon: Gamepad2, onClick: () => setActiveTab('play') },
    { id: 'puzzles', label: 'Puzzles', icon: Puzzle, onClick: () => setActiveTab('puzzles') },
    { id: 'learn', label: 'Learn', icon: GraduationCap, onClick: () => setActiveTab('learn') },
    { id: 'import', label: 'Import PGN', icon: Upload, onClick: onOpenImport },
    { id: 'archive', label: 'Archive', icon: Archive, onClick: onOpenArchive },
  ];

  return (
    <aside className="w-[160px] h-screen bg-[#262421] border-r border-[#403D39] flex flex-col justify-between select-none z-20 shrink-0">
      {/* Top Brand Emblem */}
      <div>
        <div className="h-16 flex items-center gap-2.5 px-4 cursor-pointer hover:opacity-90 transition-opacity border-b border-[#312E2B]/60">
          <div className="w-10 h-10 rounded-xl bg-[#81B64C] flex items-center justify-center shadow-lg shadow-black/40 shrink-0">
            <svg viewBox="0 0 45 45" className="w-7 h-7 fill-white">
              <path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" />
            </svg>
          </div>
          <div>
            <div className="font-black text-lg tracking-tight text-white leading-tight">
              Chess<span className="text-[#81B64C]">Buff</span>
            </div>
            <div className="text-xs text-neutral-400 font-bold tracking-wider flex items-center gap-1 mt-0.5">
              DIAMOND <Sparkles className="w-3 h-3 text-cyan-400" />
            </div>
          </div>
        </div>

        {/* Primary Vertical Navigation */}
        <nav className="p-2 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-bold transition-all duration-100 ${
                  isActive
                    ? 'bg-[#312E2B] text-white shadow-inner border border-[#403D39]'
                    : 'text-neutral-400 hover:text-white hover:bg-[#2F2D2A]'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#81B64C]' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Utility Controls */}
      <div className="p-3 border-t border-[#403D39]/40 space-y-1.5">
        <button
          onClick={toggleSound}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-neutral-300 hover:text-white hover:bg-[#2F2D2A] transition-colors"
          title={soundMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {soundMuted ? <VolumeX className="w-5 h-5 text-rose-400 shrink-0" /> : <Volume2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          <span>{soundMuted ? 'Muted' : 'Sound On'}</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-neutral-300 hover:text-white hover:bg-[#2F2D2A] transition-colors"
          title="Engine & Gemini Settings"
        >
          <Settings className="w-5 h-5 text-neutral-400 shrink-0" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
