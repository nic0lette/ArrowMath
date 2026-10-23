import React, { useState } from 'react';
import { ColorTheme, PlaceTier } from '../types/math';
import { ArrowCardSvg } from './ArrowCardSvg';
import { sound } from '../utils/audio';
import { Sparkles, Plus, Dices, ChevronDown, ChevronUp, Hand } from 'lucide-react';

interface CardBankProps {
  theme: ColorTheme;
  onStartDragCard: (place: 1000 | 100 | 10 | 1, digit: number, e: React.PointerEvent) => void;
  onBuildFullNumber: (num: number, asStacked: boolean) => void;
}

export const CardBank: React.FC<CardBankProps> = ({
  theme,
  onStartDragCard,
  onBuildFullNumber,
}) => {
  const [activeTab, setActiveTab] = useState<PlaceTier | 'all'>('all');
  const [customNumber, setCustomNumber] = useState<string>('3452');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const tiers: { tier: PlaceTier; place: 1000 | 100 | 10 | 1; label: string }[] = [
    { tier: 'thousands', place: 1000, label: '1000s' },
    { tier: 'hundreds', place: 100, label: '100s' },
    { tier: 'tens', place: 10, label: '10s' },
    { tier: 'ones', place: 1, label: '1s' },
  ];

  const handleGenerate = (asStacked: boolean) => {
    const val = parseInt(customNumber.replace(/,/g, ''), 10);
    if (!isNaN(val) && val > 0 && val <= 9999) {
      sound.playSnap();
      onBuildFullNumber(val, asStacked);
    }
  };

  const handleRandomize = () => {
    const rand = Math.floor(Math.random() * 9000) + 1000;
    setCustomNumber(rand.toString());
  };

  return (
    <div className="bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg transition-all duration-200 z-30">
      {/* Tray header & quick generator */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Card Bank:
            </span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Cards
              </button>
              {tiers.map((t) => (
                <button
                  key={t.tier}
                  type="button"
                  onClick={() => setActiveTab(t.tier)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    activeTab === t.tier
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            <Hand className="w-3 h-3 text-slate-400" />
            <span>Click to add or drag directly to workbench</span>
          </div>
        </div>

        {/* Quick Builder Input */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1 border border-slate-200">
            <span className="text-xs text-slate-500 pl-1.5 font-medium">Make:</span>
            <input
              type="number"
              min={1}
              max={9999}
              value={customNumber}
              onChange={(e) => setCustomNumber(e.target.value)}
              placeholder="e.g. 4325"
              className="w-20 px-2 py-0.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              title="Random Number"
              onClick={handleRandomize}
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleGenerate(false)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium rounded shadow-2xs border border-slate-200 cursor-pointer"
            >
              <Plus className="w-3 h-3 text-blue-600" />
              <span>Add Cards</span>
            </button>
            <button
              type="button"
              onClick={() => handleGenerate(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-2xs cursor-pointer transition-colors"
            >
              <Sparkles className="w-3 h-3 text-blue-200" />
              <span>Add Stacked</span>
            </button>
          </div>

          {/* Minimize Tray button */}
          <button
            type="button"
            title={isCollapsed ? 'Show Card Bank' : 'Hide Card Bank'}
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Cards list tray */}
      {!isCollapsed && (
        <div className="max-w-7xl mx-auto px-4 py-2.5 overflow-x-auto">
          <div className="flex flex-col gap-2.5 min-w-[760px]">
            {tiers
              .filter((t) => activeTab === 'all' || activeTab === t.tier)
              .map((t) => (
                <div key={t.tier} className="flex items-center gap-3">
                  <div className="w-14 shrink-0 text-right">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                      {t.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                      <div
                        key={`${t.place}-${digit}`}
                        onPointerDown={(e) => onStartDragCard(t.place, digit, e)}
                        className="cursor-grab active:cursor-grabbing transition-transform hover:scale-105 active:scale-95 shrink-0 select-none touch-none"
                        title={`Drag to board or click to add ${digit * t.place}`}
                      >
                        <div className="origin-left transform scale-75 -my-2.5 pointer-events-none">
                          <ArrowCardSvg
                            place={t.place}
                            digit={digit}
                            theme={theme}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
