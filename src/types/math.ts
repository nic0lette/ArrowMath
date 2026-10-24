import type { PlaceTier } from '../../arrow-cards/src';

export type { ColorTheme, PlaceTier, ThemeColors } from '../../arrow-cards/src';

export interface ArrowCardData {
  id: string;
  place: 1000 | 100 | 10 | 1;
  tier: PlaceTier;
  digit: number; // 1 - 9
  value: number; // digit * place (e.g., 4000, 300, 20, 5)
  x: number;
  y: number;
  zIndex: number;
  groupId?: string; // If part of a snapped group
}

export interface CardGroupData {
  id: string;
  cards: ArrowCardData[]; // Ordered thousands -> hundreds -> tens -> ones
  x: number;
  y: number;
  zIndex: number;
  isExpanded: boolean; // false = stacked/superimposed, true = horizontal expanded form
  showXRay: boolean; // reveal zeros under top cards
}

export interface MathChallenge {
  id: string;
  title: string;
  instruction: string;
  targetNumber: number;
  level: 1 | 2 | 3 | 4;
  hint?: string;
}
