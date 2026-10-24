import {
  ARROW_TIP_WIDTH,
  CARD_HEIGHT,
  DIGIT_WIDTH,
  THEMES,
  getArrowCardWidth,
  getPlaceTier,
} from '../../arrow-cards/src';
import { ArrowCardData, PlaceTier } from '../types/math';

// Re-export the card design tokens so existing app code can keep importing
// them from this module.
export { THEMES, DIGIT_WIDTH, ARROW_TIP_WIDTH, CARD_HEIGHT };

// Aligns with the 24px dot grid painted on the workbench.
export const GRID_SIZE = 24;

export function snapToGrid(value: number, gridSize = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPosition(
  x: number,
  y: number,
  gridSize = GRID_SIZE
): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}

export function getCardWidth(place: 1000 | 100 | 10 | 1): number {
  return getArrowCardWidth(place);
}

export function getTierFromPlace(place: 1000 | 100 | 10 | 1): PlaceTier {
  return getPlaceTier(place);
}

export function decomposeNumber(num: number): {
  thousands: number;
  hundreds: number;
  tens: number;
  ones: number;
} {
  const clamped = Math.max(0, Math.min(9999, Math.floor(num)));
  const thousands = Math.floor(clamped / 1000);
  const hundreds = Math.floor((clamped % 1000) / 100);
  const tens = Math.floor((clamped % 100) / 10);
  const ones = clamped % 10;
  return { thousands, hundreds, tens, ones };
}

export function createCard(place: 1000 | 100 | 10 | 1, digit: number, x = 100, y = 100): ArrowCardData {
  return {
    id: `card-${place}-${digit}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    place,
    tier: getTierFromPlace(place),
    digit,
    value: digit * place,
    x,
    y,
    zIndex: place === 1000 ? 10 : place === 100 ? 20 : place === 10 ? 30 : 40,
  };
}

export function numberToWords(num: number): string {
  if (num === 0) return 'zero';

  const onesNames = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teensNames = [
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ];
  const tensNames = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const parts: string[] = [];
  const th = Math.floor(num / 1000);
  const h = Math.floor((num % 1000) / 100);
  const rem = num % 100;

  if (th > 0) {
    parts.push(`${onesNames[th]} thousand`);
  }
  if (h > 0) {
    parts.push(`${onesNames[h]} hundred`);
  }
  if (rem > 0) {
    if (parts.length > 0) {
      parts.push('and');
    }
    if (rem < 10) {
      parts.push(onesNames[rem]);
    } else if (rem < 20) {
      parts.push(teensNames[rem - 10]);
    } else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      if (o > 0) {
        parts.push(`${tensNames[t]}-${onesNames[o]}`);
      } else {
        parts.push(tensNames[t]);
      }
    }
  }

  return parts.join(' ');
}

export function speakText(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.05;
  window.speechSynthesis.speak(utterance);
}
