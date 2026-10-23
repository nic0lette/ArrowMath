export type PlaceTier = 'thousands' | 'hundreds' | 'tens' | 'ones';

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

export type ColorTheme = 'curriculum' | 'montessori' | 'pastel' | 'vibrant';

export interface ThemeColors {
  name: string;
  thousands: { bg: string; border: string; text: string; fill: string; accent: string };
  hundreds: { bg: string; border: string; text: string; fill: string; accent: string };
  tens: { bg: string; border: string; text: string; fill: string; accent: string };
  ones: { bg: string; border: string; text: string; fill: string; accent: string };
}

export interface MathChallenge {
  id: string;
  title: string;
  instruction: string;
  targetNumber: number;
  level: 1 | 2 | 3 | 4;
  hint?: string;
}
