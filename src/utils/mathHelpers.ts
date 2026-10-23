import { ArrowCardData, ColorTheme, PlaceTier, ThemeColors } from '../types/math';

export const THEMES: Record<ColorTheme, ThemeColors> = {
  curriculum: {
    name: 'UK Primary Standard',
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

export const DIGIT_WIDTH = 58; // Width per digit in card
export const ARROW_TIP_WIDTH = 28; // Triangular tip length
export const CARD_HEIGHT = 68; // Height of card

export function getCardWidth(place: 1000 | 100 | 10 | 1): number {
  const digitCount = place === 1000 ? 4 : place === 100 ? 3 : place === 10 ? 2 : 1;
  return digitCount * DIGIT_WIDTH + ARROW_TIP_WIDTH;
}

export function getTierFromPlace(place: 1000 | 100 | 10 | 1): PlaceTier {
  if (place === 1000) return 'thousands';
  if (place === 100) return 'hundreds';
  if (place === 10) return 'tens';
  return 'ones';
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
