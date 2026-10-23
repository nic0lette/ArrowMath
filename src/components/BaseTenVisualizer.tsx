import React from 'react';
import { ColorTheme } from '../types/math';
import { THEMES } from '../utils/mathHelpers';

interface BaseTenVisualizerProps {
  thousands: number;
  hundreds: number;
  tens: number;
  ones: number;
  theme?: ColorTheme;
  compact?: boolean;
}

export const BaseTenVisualizer: React.FC<BaseTenVisualizerProps> = ({
  thousands,
  hundreds,
  tens,
  ones,
  theme = 'curriculum',
  compact = false,
}) => {
  const themeColors = THEMES[theme];

  return (
    <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Base-10 Concrete Blocks (MAB)
        </h4>
        <span className="text-xs text-slate-400">
          {thousands * 1000 + hundreds * 100 + tens * 10 + ones} Total Units
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 text-center">
        {/* Thousands Cubes */}
        <div className="flex flex-col items-center bg-white p-2.5 rounded-lg border border-slate-200">
          <span className="text-xs font-medium text-slate-600 mb-1">
            Thousands ({thousands})
          </span>
          <div className="h-20 w-full flex items-center justify-center overflow-hidden">
            {thousands === 0 ? (
              <span className="text-xs text-slate-300 italic">None</span>
            ) : (
              <div className="flex flex-wrap justify-center items-center gap-1 max-w-[120px]">
                {Array.from({ length: Math.min(thousands, 9) }).map((_, i) => (
                  <svg
                    key={i}
                    width={compact ? 22 : 28}
                    height={compact ? 22 : 28}
                    viewBox="0 0 40 40"
                    className="drop-shadow-sm"
                  >
                    {/* Isometric Cube */}
                    <path
                      d="M 20 2 L 36 11 L 20 20 L 4 11 Z"
                      fill={themeColors.thousands.fill}
                      stroke={themeColors.thousands.border}
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 4 11 L 20 20 L 20 38 L 4 29 Z"
                      fill={themeColors.thousands.accent}
                      stroke={themeColors.thousands.border}
                      strokeWidth="1.5"
                      opacity="0.85"
                    />
                    <path
                      d="M 20 20 L 36 11 L 36 29 L 20 38 Z"
                      fill={themeColors.thousands.accent}
                      stroke={themeColors.thousands.border}
                      strokeWidth="1.5"
                      opacity="0.65"
                    />
                  </svg>
                ))}
              </div>
            )}
          </div>
          <span className="text-[11px] font-mono text-slate-500 mt-1">
            {thousands > 0 ? `${thousands} × 1,000` : '0'}
          </span>
        </div>

        {/* Hundreds Flats */}
        <div className="flex flex-col items-center bg-white p-2.5 rounded-lg border border-slate-200">
          <span className="text-xs font-medium text-slate-600 mb-1">
            Hundreds ({hundreds})
          </span>
          <div className="h-20 w-full flex items-center justify-center overflow-hidden">
            {hundreds === 0 ? (
              <span className="text-xs text-slate-300 italic">None</span>
            ) : (
              <div className="flex flex-wrap justify-center items-center gap-1 max-w-[120px]">
                {Array.from({ length: Math.min(hundreds, 9) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      borderColor: themeColors.hundreds.border,
                      backgroundColor: themeColors.hundreds.fill,
                    }}
                    className="w-6 h-6 border rounded-sm grid grid-cols-4 grid-rows-4 gap-[0.5px] p-[1px] shadow-xs"
                  >
                    {Array.from({ length: 16 }).map((_, cellIdx) => (
                      <div
                        key={cellIdx}
                        className="bg-white/40 rounded-[0.5px]"
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <span className="text-[11px] font-mono text-slate-500 mt-1">
            {hundreds > 0 ? `${hundreds} × 100` : '0'}
          </span>
        </div>

        {/* Tens Rods */}
        <div className="flex flex-col items-center bg-white p-2.5 rounded-lg border border-slate-200">
          <span className="text-xs font-medium text-slate-600 mb-1">
            Tens ({tens})
          </span>
          <div className="h-20 w-full flex items-center justify-center overflow-hidden">
            {tens === 0 ? (
              <span className="text-xs text-slate-300 italic">None</span>
            ) : (
              <div className="flex justify-center items-center gap-1.5 h-16">
                {Array.from({ length: Math.min(tens, 9) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      borderColor: themeColors.tens.border,
                      backgroundColor: themeColors.tens.fill,
                    }}
                    className="w-2.5 h-14 border rounded-xs flex flex-col justify-between py-[1px] shadow-xs"
                  >
                    {Array.from({ length: 5 }).map((_, tick) => (
                      <div
                        key={tick}
                        className="h-[1px] bg-black/15 w-full"
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <span className="text-[11px] font-mono text-slate-500 mt-1">
            {tens > 0 ? `${tens} × 10` : '0'}
          </span>
        </div>

        {/* Ones Units */}
        <div className="flex flex-col items-center bg-white p-2.5 rounded-lg border border-slate-200">
          <span className="text-xs font-medium text-slate-600 mb-1">
            Ones ({ones})
          </span>
          <div className="h-20 w-full flex items-center justify-center overflow-hidden">
            {ones === 0 ? (
              <span className="text-xs text-slate-300 italic">None</span>
            ) : (
              <div className="flex flex-wrap justify-center items-center gap-1.5 max-w-[100px]">
                {Array.from({ length: Math.min(ones, 9) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      borderColor: themeColors.ones.border,
                      backgroundColor: themeColors.ones.fill,
                    }}
                    className="w-3.5 h-3.5 border rounded-xs shadow-xs"
                  />
                ))}
              </div>
            )}
          </div>
          <span className="text-[11px] font-mono text-slate-500 mt-1">
            {ones > 0 ? `${ones} × 1` : '0'}
          </span>
        </div>
      </div>
    </div>
  );
};
