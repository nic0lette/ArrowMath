import React from 'react';
import { ArrowCard } from '../../arrow-cards/src/react';
import { ColorTheme, PlaceTier } from '../types/math';

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

/**
 * App adapter around the shared arrow-cards library. Keeping this component
 * means the rest of the app doesn't need to know how the library is packaged.
 */
export const ArrowCardSvg: React.FC<ArrowCardSvgProps> = ({
  place,
  digit,
  theme = 'curriculum',
  tier,
  isGhost = false,
  opacity = 1,
  highlight = false,
  showZeroGhost = false,
}) => (
  <ArrowCard
    place={place}
    digit={digit}
    theme={theme}
    tier={tier}
    isGhost={isGhost}
    opacity={opacity}
    highlight={highlight}
    showZeroGhost={showZeroGhost}
  />
);
