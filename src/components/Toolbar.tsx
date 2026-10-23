import React from 'react';
import { ColorTheme } from '../types/math';
import { THEMES } from '../utils/mathHelpers';
import {
  Volume2,
  VolumeX,
  Palette,
  RotateCcw,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface ToolbarProps {
  theme: ColorTheme;
  onThemeChange: (theme: ColorTheme) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onClearCanvas: () => void;
  onAutoSnapAll: () => void;
  onOpenHelp: () => void;
  totalCardsCount: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  theme,
  onThemeChange,
  isMuted,
  onToggleMute,
  onClearCanvas,
  onAutoSnapAll,
  onOpenHelp,
  totalCardsCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-40 shadow-xs">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
            <span className="font-mono tracking-tighter">10&gt;</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
              Arrow Math
            </h1>
            <p className="text-[11px] text-slate-500 font-medium leading-none">
              Place Value & Partitioning Cards
            </p>
          </div>
        </div>
      </div>

      {/* Center Actions: Auto-Snap / Group */}
      <div className="flex items-center gap-2">
        {totalCardsCount > 1 && (
          <button
            type="button"
            onClick={onAutoSnapAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors border border-blue-200 shadow-2xs"
            title="Snap matching place-value cards into numbers"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Snap All Cards</span>
          </button>
        )}
      </div>

      {/* Right Controls: Theme, Sound, Reset, Help */}
      <div className="flex items-center gap-2">
        {/* Color Theme Dropdown */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
          <Palette className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ColorTheme)}
            className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
          >
            {(Object.keys(THEMES) as ColorTheme[]).map((key) => (
              <option key={key} value={key}>
                {THEMES[key].name}
              </option>
            ))}
          </select>
        </div>

        {/* Sound Mute Toggle */}
        <button
          type="button"
          onClick={onToggleMute}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Reset / Clear */}
        <button
          type="button"
          onClick={onClearCanvas}
          title="Clear Board"
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* How-it-works Help */}
        <button
          type="button"
          onClick={onOpenHelp}
          title="How Arrow Cards Work"
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
