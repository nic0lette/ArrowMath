import { CARD_HEIGHT, getArrowCardWidth } from 'arrow-cards';
import {
  SNAP_MIN_OVERLAP,
  layoutPiece,
  numberToCards,
  overlapOf,
  pieceValue,
  type Bounds,
  type Card,
  type Piece,
  type Place,
} from './geometry';

/**
 * Addition: a "+" that two numbers (pieces) attach to, one on each side.
 * Once both sides are filled, each place value gets its own row above the
 * numbers (ones at the bottom, thousands at the top) with an "=" that reveals
 * that column's sum. Everything here is pure geometry and arithmetic; the
 * store owns the state and the drag gestures.
 */

export const PLUS_SIZE = 44;
/** Gap between an attached number and the plus. */
export const PLUS_GAP = 14;
/** Width of the dashed outline shown for an empty side. */
export const SLOT_WIDTH = 100;
/** How far outside an empty slot a dropped number still attaches. */
export const ATTACH_REACH = 56;

/** Place rows show smaller cards so four of them fit above the numbers. */
export const ROW_SCALE = 0.7;
export const ROW_HEIGHT = CARD_HEIGHT * ROW_SCALE;
export const ROW_GAP = 10;
/** Space between the numbers and the first (ones) row. */
export const ROWS_OFFSET = 24;
export const ROW_PLUS_SIZE = 26;
export const ROW_ITEM_GAP = 10;
export const EQUALS_SIZE = 32;
/** Room for a text result such as "11,000" that has no single card. */
export const OVERFLOW_WIDTH = 92;
/** The "=" on the numbers' line, between the right number and the total. */
export const TOTAL_EQUALS_SIZE = 40;
export const TOTAL_GAP = 14;
/** Room for a total of 10,000 or more, shown as text at full size. */
export const TOTAL_OVERFLOW_WIDTH = 132;

export type SumSide = 'left' | 'right';

export interface Sum {
  id: string;
  /** Left edge of the plus. */
  x: number;
  /** Top of the row the two numbers sit in. */
  y: number;
  left: string | null;
  right: string | null;
  /**
   * Places whose "=" has been pressed, each with the row key it was pressed
   * for. Changing a number changes the key, which hides the answer again.
   */
  revealed: Partial<Record<Place, string>>;
  /** Set when the total's "=" has been pressed, keyed like `revealed`. */
  totalRevealed?: string;
}

export interface PlaceRow {
  place: Place;
  left: number;
  right: number;
  key: string;
}

export interface RowResult {
  cards: Array<{ place: Place; digit: number }>;
  /** Set when the answer needs a card larger than thousands. */
  overflow: number | null;
}

export interface ResultCardGeometry extends Bounds {
  place: Place;
  digit: number;
}

export interface RowGeometry extends PlaceRow {
  y: number;
  height: number;
  leftCard: Bounds;
  rightCard: Bounds;
  plus: Bounds;
  equals: Bounds;
  result: Bounds;
  resultCards: ResultCardGeometry[];
  overflow: number | null;
}

export interface TotalGeometry extends Bounds {
  value: number;
  /** Full-size cards stacked on their arrow tips; empty when overflowing. */
  cards: ResultCardGeometry[];
  /** Set when the total needs a card larger than thousands. */
  overflow: number | null;
}

export interface SumLayout {
  plus: Bounds;
  leftSlot: Bounds;
  rightSlot: Bounds;
  leftPosition: { x: number; y: number } | null;
  rightPosition: { x: number; y: number } | null;
  rows: RowGeometry[];
  /** The "=" after the right number, once both sides are filled. */
  equals: Bounds | null;
  /** Where the total goes. Its space is kept even while it is hidden. */
  total: TotalGeometry | null;
  bounds: Bounds;
}

const PLACES_UP: Place[] = [1, 10, 100, 1000];

function digitAt(cards: Card[], place: Place): number {
  return cards.find((card) => card.place === place)?.digit ?? 0;
}

/**
 * One row per place from the ones up to the highest place either number
 * uses. A place one number leaves out counts as a zero card, so 123 + 205
 * reads 20 + 00 in the tens.
 */
export function placeRows(left: Card[], right: Card[]): PlaceRow[] {
  const used = [...left, ...right].map((card) => card.place);
  if (used.length === 0) return [];
  const highest = Math.max(...used);

  return PLACES_UP.filter((place) => place <= highest).map((place) => {
    const l = digitAt(left, place);
    const r = digitAt(right, place);
    return { place, left: l, right: r, key: `${l}+${r}` };
  });
}

/** The cards that make one column's answer: 4 + 8 ones is a 10 stacked on a 2. */
export function rowResult(place: Place, left: number, right: number): RowResult {
  const total = left + right;
  if (total < 10) return { cards: [{ place, digit: total }], overflow: null };
  if (place === 1000) return { cards: [], overflow: total * place };

  const cards: RowResult['cards'] = [{ place: (place * 10) as Place, digit: 1 }];
  if (total > 10) cards.push({ place, digit: total - 10 });
  return { cards, overflow: null };
}

function pieceWidth(piece: Piece): number {
  return layoutPiece(piece.cards, piece.mode).width;
}

/** The cards for a whole total: 2,512 is a 2,000 with 500, 10 and 2 on it. */
export function totalCards(value: number): Array<{ place: Place; digit: number }> {
  return value === 0 ? [{ place: 1, digit: 0 }] : numberToCards(value);
}

/**
 * Lays a sum out like written column addition. Each place row sits above the
 * numbers with its left card ending at the left number's arrow tip and its
 * right card ending at the right number's tip. Every "=" shares one column
 * with the "=" on the numbers' line, and every answer ends at the total's
 * ones tip, so the columns of the answers line up with the total.
 */
export function sumLayout(sum: Sum, left: Piece | null, right: Piece | null): SumLayout {
  const plus: Bounds = {
    x: sum.x,
    y: sum.y + (CARD_HEIGHT - PLUS_SIZE) / 2,
    width: PLUS_SIZE,
    height: PLUS_SIZE,
  };
  const leftSlot: Bounds = {
    x: sum.x - PLUS_GAP - SLOT_WIDTH,
    y: sum.y,
    width: SLOT_WIDTH,
    height: CARD_HEIGHT,
  };
  const rightSlot: Bounds = {
    x: sum.x + PLUS_SIZE + PLUS_GAP,
    y: sum.y,
    width: SLOT_WIDTH,
    height: CARD_HEIGHT,
  };

  const leftWidth = left ? pieceWidth(left) : SLOT_WIDTH;
  const rightWidth = right ? pieceWidth(right) : SLOT_WIDTH;
  const leftPosition = left ? { x: sum.x - PLUS_GAP - leftWidth, y: sum.y } : null;

  if (!left || !right) {
    const rightPosition = right ? { x: rightSlot.x, y: sum.y } : null;
    const minX = sum.x - PLUS_GAP - leftWidth;
    const maxX = rightSlot.x + rightWidth;
    return {
      plus,
      leftSlot,
      rightSlot,
      leftPosition,
      rightPosition,
      rows: [],
      equals: null,
      total: null,
      bounds: { x: minX, y: sum.y, width: maxX - minX, height: CARD_HEIGHT },
    };
  }

  const placed = placeRows(left.cards, right.cards);
  const highest = placed[placed.length - 1].place;
  const plusCenter = sum.x + PLUS_SIZE / 2;
  const rowPlusX = plusCenter - ROW_PLUS_SIZE / 2;

  // The right number moves along when the widest row card would not fit
  // between the row plus and its tip.
  const widestRowCard = getArrowCardWidth(highest) * ROW_SCALE;
  const rightTip = Math.max(
    rightSlot.x + rightWidth,
    rowPlusX + ROW_PLUS_SIZE + ROW_ITEM_GAP + widestRowCard,
  );
  const rightPosition = { x: rightTip - rightWidth, y: sum.y };

  const equals: Bounds = {
    x: rightTip + TOTAL_GAP,
    y: sum.y + (CARD_HEIGHT - TOTAL_EQUALS_SIZE) / 2,
    width: TOTAL_EQUALS_SIZE,
    height: TOTAL_EQUALS_SIZE,
  };
  const equalsCenter = equals.x + TOTAL_EQUALS_SIZE / 2;

  const value = pieceValue(left.cards) + pieceValue(right.cards);
  const overflow = value > 9999 ? value : null;
  const cards = overflow === null ? totalCards(value) : [];
  const totalWidth = cards.length
    ? Math.max(...cards.map((entry) => getArrowCardWidth(entry.place)))
    : TOTAL_OVERFLOW_WIDTH;
  const totalX = equals.x + TOTAL_EQUALS_SIZE + TOTAL_GAP;
  const totalTip = totalX + totalWidth;
  const total: TotalGeometry = {
    x: totalX,
    y: sum.y,
    width: totalWidth,
    height: CARD_HEIGHT,
    value,
    overflow,
    cards: cards.map((entry) => {
      const width = getArrowCardWidth(entry.place);
      return { ...entry, x: totalTip - width, y: sum.y, width, height: CARD_HEIGHT };
    }),
  };

  const rows = layoutRows(sum, placed, {
    rowPlusX,
    leftTip: sum.x - PLUS_GAP,
    rightTip,
    equalsCenter,
    resultTip: totalTip,
  });

  let minX = leftPosition!.x;
  let minY = sum.y;
  for (const row of rows) {
    minX = Math.min(minX, row.leftCard.x);
    minY = Math.min(minY, row.y);
  }

  return {
    plus,
    leftSlot,
    rightSlot,
    leftPosition,
    rightPosition,
    rows,
    equals,
    total,
    bounds: { x: minX, y: minY, width: totalTip - minX, height: sum.y + CARD_HEIGHT - minY },
  };
}

interface RowColumns {
  rowPlusX: number;
  leftTip: number;
  rightTip: number;
  equalsCenter: number;
  resultTip: number;
}

function layoutRows(sum: Sum, rows: PlaceRow[], columns: RowColumns): RowGeometry[] {
  return rows.map((row, index) => {
    const y = sum.y - ROWS_OFFSET - ROW_HEIGHT - index * (ROW_HEIGHT + ROW_GAP);
    const cardWidth = getArrowCardWidth(row.place) * ROW_SCALE;
    const answer = rowResult(row.place, row.left, row.right);
    // Results stack like a piece: arrow tips on the right, the widest card
    // underneath.
    const resultWidth = answer.cards.length
      ? Math.max(...answer.cards.map((entry) => getArrowCardWidth(entry.place) * ROW_SCALE))
      : OVERFLOW_WIDTH;
    const resultCards = answer.cards.map((entry) => {
      const width = getArrowCardWidth(entry.place) * ROW_SCALE;
      return { ...entry, x: columns.resultTip - width, y, width, height: ROW_HEIGHT };
    });

    return {
      ...row,
      y,
      height: ROW_HEIGHT,
      leftCard: { x: columns.leftTip - cardWidth, y, width: cardWidth, height: ROW_HEIGHT },
      rightCard: { x: columns.rightTip - cardWidth, y, width: cardWidth, height: ROW_HEIGHT },
      plus: {
        x: columns.rowPlusX,
        y: y + (ROW_HEIGHT - ROW_PLUS_SIZE) / 2,
        width: ROW_PLUS_SIZE,
        height: ROW_PLUS_SIZE,
      },
      equals: {
        x: columns.equalsCenter - EQUALS_SIZE / 2,
        y: y + (ROW_HEIGHT - EQUALS_SIZE) / 2,
        width: EQUALS_SIZE,
        height: EQUALS_SIZE,
      },
      result: { x: columns.resultTip - resultWidth, y, width: resultWidth, height: ROW_HEIGHT },
      resultCards,
      overflow: answer.overflow,
    };
  });
}

/** The area around an empty side that a dropped number attaches to. */
function attachZone(sum: Sum, side: SumSide): Bounds {
  const y = sum.y - ATTACH_REACH / 2;
  const height = CARD_HEIGHT + ATTACH_REACH;
  const width = SLOT_WIDTH + ATTACH_REACH + PLUS_GAP + PLUS_SIZE / 2;
  return side === 'left'
    ? { x: sum.x - PLUS_GAP - SLOT_WIDTH - ATTACH_REACH, y, width, height }
    : { x: sum.x + PLUS_SIZE / 2, y, width, height };
}

export function findSumSlot(
  dragged: Bounds,
  sums: Sum[],
): { sum: Sum; side: SumSide } | null {
  let best: { sum: Sum; side: SumSide; area: number } | null = null;

  for (const sum of sums) {
    for (const side of ['left', 'right'] as const) {
      if (sum[side]) continue;
      const overlap = overlapOf(dragged, attachZone(sum, side));
      if (overlap.x < SNAP_MIN_OVERLAP || overlap.y < SNAP_MIN_OVERLAP) continue;
      if (!best || overlap.area > best.area) best = { sum, side, area: overlap.area };
    }
  }

  return best ? { sum: best.sum, side: best.side } : null;
}

export function attachedSide(sum: Sum, pieceId: string): SumSide | null {
  if (sum.left === pieceId) return 'left';
  if (sum.right === pieceId) return 'right';
  return null;
}

export function isRevealed(sum: Sum, row: PlaceRow): boolean {
  return sum.revealed[row.place] === row.key;
}

/** Identifies the two numbers a total was revealed for. */
export function totalKey(left: Piece, right: Piece): string {
  return `${pieceValue(left.cards)}+${pieceValue(right.cards)}`;
}

export function isTotalRevealed(sum: Sum, left: Piece | null, right: Piece | null): boolean {
  return Boolean(left && right && sum.totalRevealed === totalKey(left, right));
}
