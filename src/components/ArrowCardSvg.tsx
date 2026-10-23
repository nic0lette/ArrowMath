import React from 'react';
import { PlaceTier, ColorTheme } from '../types/math';
import { ARROW_TIP_WIDTH, CARD_HEIGHT, DIGIT_WIDTH, THEMES } from '../utils/mathHelpers';

interface ArrowCardSvgProps {
  place: 1000 | 100 | 10 | 1;
  digit: number;
  theme?: ColorTheme;
  tier?: PlaceTier;
  isGhost?: boolean;
  opacity?: number;
  highlight?: boolean;
  showZeroGhost?: boolean;
  isUnderneath?: boolean;
}

export const ArrowCardSvg: React.FC<ArrowCardSvgProps> = ({
  place,
  digit,
  theme = 'curriculum',
  tier = place === 1000 ? 'thousands' : place === 100 ? 'hundreds' : place === 10 ? 'tens' : 'ones',
  isGhost = false,
  opacity = 1,
  highlight = false,
  showZeroGhost = false,
}) => {
  const digitCount = place === 1000 ? 4 : place === 100 ? 3 : place === 10 ? 2 : 1;
  const bodyWidth = digitCount * DIGIT_WIDTH;
  const totalWidth = bodyWidth + ARROW_TIP_WIDTH;
  const height = CARD_HEIGHT;
  const r = 10; // corner radius for left side

  const themeColors = THEMES[theme][tier];

  // Path definition:
  // Starts top-left with rounded corner -> top edge to bodyWidth -> arrow tip -> bottom edge back to bodyWidth -> bottom edge to left corner -> left edge up
  const pathD = `
    M ${r} 0
    L ${bodyWidth} 0
    L ${totalWidth} ${height / 2}
    L ${bodyWidth} ${height}
    L ${r} ${height}
    Q 0 ${height} 0 ${height - r}
    L 0 ${r}
    Q 0 0 ${r} 0
    Z
  `;

  // Digits array: [digit, 0, 0, 0] depending on place value
  const digits = [digit, ...Array(digitCount - 1).fill(0)];

  return (
    <svg
      width={totalWidth}
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      className={`select-none transition-transform overflow-visible ${highlight ? 'filter drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]' : ''}`}
      style={{ opacity }}
    >
      <defs>
        <filter id={`shadow-${place}-${digit}`} x="-5%" y="-5%" width="120%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.12" />
        </filter>
        <linearGradient id={`grad-${tier}-${theme}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Main card background shape */}
      <path
        d={pathD}
        fill={isGhost ? 'none' : themeColors.bg}
        stroke={highlight ? '#2563eb' : themeColors.border}
        strokeWidth={highlight ? 3 : 2}
        strokeDasharray={isGhost ? '6 4' : undefined}
        filter={isGhost ? undefined : `url(#shadow-${place}-${digit})`}
      />

      {/* Subtle sheen highlight gradient */}
      {!isGhost && <path d={pathD} fill={`url(#grad-${tier}-${theme})`} pointerEvents="none" />}

      {/* Subtle slot dividers between digits */}
      {!isGhost &&
        Array.from({ length: digitCount - 1 }).map((_, i) => (
          <line
            key={i}
            x1={(i + 1) * DIGIT_WIDTH}
            y1={12}
            x2={(i + 1) * DIGIT_WIDTH}
            y2={height - 12}
            stroke={themeColors.border}
            strokeWidth={1}
            strokeOpacity={0.25}
            strokeDasharray="2 3"
          />
        ))}

      {/* Render the digits */}
      {!isGhost &&
        digits.map((d, index) => {
          const isTrailingZero = index > 0;
          const cx = index * DIGIT_WIDTH + DIGIT_WIDTH / 2;
          const cy = height / 2 + 10;

          return (
            <g key={index}>
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                fill={themeColors.text}
                fontSize={32}
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
                className="select-none tracking-tight"
                opacity={isTrailingZero && showZeroGhost ? 0.35 : 1}
              >
                {d}
              </text>
            </g>
          );
        })}

      {/* Micro place-value indicator label in top corner */}
      {!isGhost && (
        <text
          x={10}
          y={15}
          fill={themeColors.text}
          fontSize={9}
          fontWeight="700"
          opacity={0.65}
          letterSpacing="0.05em"
          className="uppercase select-none font-mono"
        >
          {place === 1000 ? '1000s' : place === 100 ? '100s' : place === 10 ? '10s' : '1s'}
        </text>
      )}

      {/* Small arrow glyph on arrow tip */}
      {!isGhost && (
        <path
          d={`M ${totalWidth - 14} ${height / 2 - 4} L ${totalWidth - 8} ${height / 2} L ${totalWidth - 14} ${height / 2 + 4}`}
          fill="none"
          stroke={themeColors.border}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.4}
        />
      )}
    </svg>
  );
};
