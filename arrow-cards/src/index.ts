// Arrow Cards — a tiny, framework-agnostic renderer for place-value arrow cards.
// No runtime dependencies. Generates plain SVG strings.

export type ColorTheme = 'curriculum' | 'montessori' | 'pastel' | 'vibrant';
/**
 * 10000 is only ever drawn as part of an answer (the Arrow Cards app's sums reach
 * 19,998); apps decide which places a pupil can actually hold.
 */
export type PlaceValue = 10000 | 1000 | 100 | 10 | 1;
export type PlaceTier = 'tenThousands' | 'thousands' | 'hundreds' | 'tens' | 'ones';

export interface ThemeColorSet {
  bg: string;
  border: string;
  text: string;
  fill: string;
  accent: string;
}

export interface ThemeColors {
  name: string;
  tenThousands: ThemeColorSet;
  thousands: ThemeColorSet;
  hundreds: ThemeColorSet;
  tens: ThemeColorSet;
  ones: ThemeColorSet;
}

export const THEMES: Record<ColorTheme, ThemeColors> = {
  curriculum: {
    name: 'UK Primary Standard',
    tenThousands: {
      bg: '#f3e8ff',
      border: '#9333ea',
      text: '#6b21a8',
      fill: '#e9d5ff',
      accent: '#a855f7',
    },
    thousands: {
      bg: '#fee2e2',
      border: '#ef4444',
      text: '#991b1b',
      fill: '#fecaca',
      accent: '#dc2626',
    },
    hundreds: {
      bg: '#e0f2fe',
      border: '#0284c7',
      text: '#075985',
      fill: '#bae6fd',
      accent: '#0284c7',
    },
    tens: {
      bg: '#dcfce7',
      border: '#22c55e',
      text: '#166534',
      fill: '#bbf7d0',
      accent: '#16a34a',
    },
    ones: {
      bg: '#fef9c3',
      border: '#eab308',
      text: '#854d0e',
      fill: '#fef08a',
      accent: '#ca8a04',
    },
  },
  montessori: {
    name: 'Montessori Classic',
    // Montessori colours repeat every three places: 10,000s are blue like tens.
    tenThousands: {
      bg: '#dbeafe',
      border: '#1d4ed8',
      text: '#1e3a8a',
      fill: '#bfdbfe',
      accent: '#2563eb',
    },
    thousands: {
      bg: '#dcfce7',
      border: '#15803d',
      text: '#14532d',
      fill: '#bbf7d0',
      accent: '#16a34a',
    },
    hundreds: {
      bg: '#fee2e2',
      border: '#b91c1c',
      text: '#7f1d1d',
      fill: '#fecaca',
      accent: '#dc2626',
    },
    tens: {
      bg: '#dbeafe',
      border: '#1d4ed8',
      text: '#1e3a8a',
      fill: '#bfdbfe',
      accent: '#2563eb',
    },
    ones: {
      bg: '#dcfce7',
      border: '#15803d',
      text: '#14532d',
      fill: '#bbf7d0',
      accent: '#16a34a',
    },
  },
  pastel: {
    name: 'Modern Studio Pastel',
    tenThousands: {
      bg: '#dbeafe',
      border: '#3b82f6',
      text: '#1e40af',
      fill: '#bfdbfe',
      accent: '#60a5fa',
    },
    thousands: {
      bg: '#ede9fe',
      border: '#7c3aed',
      text: '#5b21b6',
      fill: '#ddd6fe',
      accent: '#8b5cf6',
    },
    hundreds: {
      bg: '#ccfbf1',
      border: '#0d9488',
      text: '#115e59',
      fill: '#99f6e4',
      accent: '#14b8a6',
    },
    tens: {
      bg: '#ffedd5',
      border: '#ea580c',
      text: '#9a3412',
      fill: '#fed7aa',
      accent: '#f97316',
    },
    ones: {
      bg: '#ffe4e6',
      border: '#e11d48',
      text: '#9f1239',
      fill: '#fecdd3',
      accent: '#f43f5e',
    },
  },
  vibrant: {
    name: 'High Contrast Bold',
    tenThousands: {
      bg: '#701a75',
      border: '#a21caf',
      text: '#ffffff',
      fill: '#86198f',
      accent: '#d946ef',
    },
    thousands: {
      bg: '#312e81',
      border: '#4338ca',
      text: '#ffffff',
      fill: '#3730a3',
      accent: '#6366f1',
    },
    hundreds: {
      bg: '#064e3b',
      border: '#047857',
      text: '#ffffff',
      fill: '#065f46',
      accent: '#10b981',
    },
    tens: {
      bg: '#78350f',
      border: '#b45309',
      text: '#ffffff',
      fill: '#92400e',
      accent: '#f59e0b',
    },
    ones: {
      bg: '#881337',
      border: '#be123c',
      text: '#ffffff',
      fill: '#9f1239',
      accent: '#f43f5e',
    },
  },
};

export const DIGIT_WIDTH = 58;
export const ARROW_TIP_WIDTH = 28;
export const CARD_HEIGHT = 68;

export function getPlaceTier(place: PlaceValue): PlaceTier {
  if (place === 10000) return 'tenThousands';
  if (place === 1000) return 'thousands';
  if (place === 100) return 'hundreds';
  if (place === 10) return 'tens';
  return 'ones';
}

export function getDigitCount(place: PlaceValue): number {
  return place === 10000 ? 5 : place === 1000 ? 4 : place === 100 ? 3 : place === 10 ? 2 : 1;
}

export function getArrowCardWidth(place: PlaceValue): number {
  return getDigitCount(place) * DIGIT_WIDTH + ARROW_TIP_WIDTH;
}

export function getPlaceLabel(place: PlaceValue): string {
  return String(place) + 's';
}

export interface ArrowCardOptions {
  /** 10000, 1000, 100, 10 or 1. Controls the number of digit slots. */
  place: PlaceValue;
  /** Leading digit, 0–9. Trailing slots are rendered as zeros. */
  digit: number;
  /** Visual palette. Defaults to `curriculum`. */
  theme?: ColorTheme;
  /** Force the palette tier. Defaults from `place`. */
  tier?: PlaceTier;
  /** Dashed outline instead of a solid card. */
  isGhost?: boolean;
  /** 0–1. Applies to the whole SVG. Defaults to 1. */
  opacity?: number;
  /** Blue outline and glow, used for selected cards. */
  highlight?: boolean;
  /** Show the trailing zeros at reduced opacity. */
  showZeroGhost?: boolean;
}

export interface ArrowCardModel {
  place: PlaceValue;
  digit: number;
  theme: ColorTheme;
  tier: PlaceTier;
  width: number;
  height: number;
  bodyWidth: number;
  totalWidth: number;
  digitCount: number;
  themeColors: ThemeColorSet;
  pathD: string;
  digits: number[];
  dividerXs: number[];
  digitPositions: Array<{ x: number; y: number; value: number; isTrailingZero: boolean }>;
  placeLabel: string;
  arrowGlyphPath: string;
  borderRadius: number;
  isGhost: boolean;
  opacity: number;
  highlight: boolean;
  showZeroGhost: boolean;
}

/**
 * Pure geometry/style data for one card. Useful if you want to render the
 * card with your own UI layer instead of using `renderArrowCardSvg`.
 */
export function getArrowCardModel(options: ArrowCardOptions): ArrowCardModel {
  const {
    place,
    digit,
    theme = 'curriculum',
    tier = getPlaceTier(place),
    isGhost = false,
    opacity = 1,
    highlight = false,
    showZeroGhost = false,
  } = options;

  const digitCount = getDigitCount(place);
  const bodyWidth = digitCount * DIGIT_WIDTH;
  const totalWidth = bodyWidth + ARROW_TIP_WIDTH;
  const height = CARD_HEIGHT;
  const r = 10;

  const pathD = [
    `M ${r} 0`,
    `L ${bodyWidth} 0`,
    `L ${totalWidth} ${height / 2}`,
    `L ${bodyWidth} ${height}`,
    `L ${r} ${height}`,
    `Q 0 ${height} 0 ${height - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    'Z',
  ].join(' ');

  return {
    place,
    digit,
    theme,
    tier,
    width: totalWidth,
    height,
    bodyWidth,
    totalWidth,
    digitCount,
    themeColors: THEMES[theme][tier],
    pathD,
    digits: [digit, ...Array(digitCount - 1).fill(0)],
    dividerXs: Array.from({ length: digitCount - 1 }, (_, i) => (i + 1) * DIGIT_WIDTH),
    digitPositions: Array.from({ length: digitCount }, (_, index) => ({
      x: index * DIGIT_WIDTH + DIGIT_WIDTH / 2,
      y: height / 2 + 10,
      value: index === 0 ? digit : 0,
      isTrailingZero: index > 0,
    })),
    placeLabel: getPlaceLabel(place),
    arrowGlyphPath: `M ${totalWidth - 14} ${height / 2 - 4} L ${totalWidth - 8} ${height / 2} L ${
      totalWidth - 14
    } ${height / 2 + 4}`,
    borderRadius: r,
    isGhost,
    opacity,
    highlight,
    showZeroGhost,
  };
}

export interface RenderArrowCardOptions extends ArrowCardOptions {
  /** Prefix for SVG `<defs>` ids. Useful when several cards share a page. */
  idPrefix?: string;
  /** Optional class on the root `<svg>`. */
  className?: string;
  /** Accessible label. Defaults to e.g. "3 thousands card". */
  ariaLabel?: string;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Render one arrow card to a standalone SVG string.
 *
 * Safe to use in a browser, in SSR, or in any framework. The output has no
 * external dependencies; paste it straight into HTML.
 */
export function renderArrowCardSvg(options: RenderArrowCardOptions): string {
  const model = getArrowCardModel(options);
  const {
    theme,
    tier,
    width,
    height,
    pathD,
    themeColors,
    digit,
    place,
    placeLabel,
    isGhost,
    opacity,
    highlight,
    showZeroGhost,
  } = model;
  const idPrefix = safeIdPart(options.idPrefix ?? 'arrow-card') || 'arrow-card';
  const shadowId = `${idPrefix}-shadow-${place}-${digit}`;
  const gradientId = `${idPrefix}-grad-${tier}-${theme}`;
  const ariaLabel =
    options.ariaLabel ?? getArrowCardAriaLabel(place, digit);

  const svgClass = [
    'arrow-card-svg',
    highlight ? 'arrow-card-svg--highlight' : '',
    options.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const svgStyle = [
    `opacity:${opacity}`,
    'user-select:none',
    'transition:transform 150ms ease',
    'overflow:visible',
    highlight ? 'filter:drop-shadow(0 0 10px rgba(59,130,246,0.6))' : '',
  ]
    .filter(Boolean)
    .join(';');

  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(
      ariaLabel
    )}" class="${escapeAttribute(svgClass)}" style="${svgStyle}">`
  );

  // Definitions: soft card shadow + top-to-bottom sheen.
  parts.push('<defs>');
  parts.push(
    `<filter id="${shadowId}" x="-5%" y="-5%" width="120%" height="130%">` +
      '<feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.12"/>' +
      '</filter>'
  );
  parts.push(
    `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">` +
      '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/>' +
      '<stop offset="100%" stop-color="#000000" stop-opacity="0.05"/>' +
      '</linearGradient>'
  );
  parts.push('</defs>');

  // Arrow silhouette.
  const stroke = highlight ? '#2563eb' : themeColors.border;
  const strokeWidth = highlight ? 3 : 2;
  parts.push(
    `<path d="${pathD}" fill="${isGhost ? 'none' : themeColors.bg}" stroke="${stroke}" stroke-width="${strokeWidth}"` +
      (isGhost ? ' stroke-dasharray="6 4"' : ` filter="url(#${shadowId})"`) +
      '/>'
  );

  // Subtle glass sheen.
  if (!isGhost) {
    parts.push(`<path d="${pathD}" fill="url(#${gradientId})" pointer-events="none"/>`);
  }

  // Dashed dividers between digit slots.
  if (!isGhost) {
    for (const x of model.dividerXs) {
      parts.push(
        `<line x1="${x}" y1="12" x2="${x}" y2="${height - 12}" stroke="${themeColors.border}" stroke-width="1" stroke-opacity="0.25" stroke-dasharray="2 3"/>`
      );
    }
  }

  // Digits, with the leading digit followed by trailing zeros.
  if (!isGhost) {
    for (const position of model.digitPositions) {
      const textOpacity = position.isTrailingZero && showZeroGhost ? 0.35 : 1;
      parts.push(
        `<text x="${position.x}" y="${position.y}" text-anchor="middle" fill="${themeColors.text}" font-size="32" font-weight="700" font-family="system-ui, -apple-system, sans-serif" style="user-select:none;letter-spacing:-0.025em" opacity="${textOpacity}">${position.value}</text>`
      );
    }
  }

  // Micro place-value label in the top-left corner.
  if (!isGhost) {
    parts.push(
      `<text x="10" y="15" fill="${themeColors.text}" font-size="9" font-weight="700" opacity="0.65" style="text-transform:uppercase;user-select:none;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;letter-spacing:0.05em">${placeLabel}</text>`
    );
  }

  // Little arrow glyph on the tip.
  if (!isGhost) {
    parts.push(
      `<path d="${model.arrowGlyphPath}" fill="none" stroke="${themeColors.border}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>`
    );
  }

  parts.push('</svg>');
  return parts.join('');
}

/** Default accessible label used by the React/Svelte wrappers. */
export function getArrowCardAriaLabel(place: PlaceValue, digit: number): string {
  const placeName =
    place === 10000
      ? 'ten thousands'
      : place === 1000
        ? 'thousands'
        : place === 100
          ? 'hundreds'
          : place === 10
            ? 'tens'
            : 'ones';
  return `${digit} ${placeName} card, ${digit * place}`;
}
