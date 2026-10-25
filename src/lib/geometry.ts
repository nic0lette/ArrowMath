import {
  CARD_HEIGHT,
  DIGIT_WIDTH,
  getArrowCardWidth,
  type PlaceValue,
} from 'arrow-cards';

export const GRID_SIZE = 24;
export const SNAP_MIN_OVERLAP = 10;
export const STACK_MIN_OVERLAP = 28;
export const STACK_RATIO = 0.35;
export const BOUNCE_MARGIN = 28;
export const CANVAS_PADDING = 16;
export const EXPAND_OP_GAP = 14;
export const EXPAND_OP_SIZE = 26;
export const EXPAND_OP_STEP = EXPAND_OP_GAP * 2 + EXPAND_OP_SIZE;
export const RESULT_GAP = 18;
/** Room reserved for the "= 4,325" chip when an expanded group sits near the edge. */
export const RESULT_RESERVE = 108;

export type Place = PlaceValue;
export type PieceMode = 'stack' | 'expand';
export type SpringKind = 'default' | 'bounce';
export type DropKind = 'stack' | 'chain' | 'conflict';

export interface Card {
  id: string;
  place: Place;
  digit: number;
}

export interface Piece {
  id: string;
  cards: Card[];
  x: number;
  y: number;
  mode: PieceMode;
  z: number;
  spring: SpringKind;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardGeometry {
  card: Card;
  index: number;
  localX: number;
  localY: number;
  width: number;
  height: number;
  isBase: boolean;
}

export interface OperatorGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PieceLayout {
  cards: CardGeometry[];
  operators: OperatorGeometry[];
  width: number;
  height: number;
  stackWidth: number;
  resultX: number;
}

export interface DropCandidate {
  target: Piece;
  targetBounds: Bounds;
  overlapX: number;
  overlapY: number;
  area: number;
  kind: DropKind;
}

export const SPRING_DEFAULT = { stiffness: 300, damping: 26 } as const;
export const SPRING_BOUNCE = { stiffness: 300, damping: 14 } as const;

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.place - a.place);
}

export function pieceValue(cards: Card[]): number {
  return cards.reduce((total, card) => total + card.digit * card.place, 0);
}

// TODO(locale): numbers are always shown in en-US style ("4,325"), and
// makeNumber only strips commas from typed input. See "Planned work" in the
// README: this should follow the chosen UI locale once translations exist.
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function layoutPiece(cardsInput: Card[], mode: PieceMode): PieceLayout {
  const cards = sortCards(cardsInput);
  const widths = cards.map((card) => getArrowCardWidth(card.place));
  const stackWidth = widths.length ? Math.max(...widths) : 0;
  const placed: CardGeometry[] = [];
  const operators: OperatorGeometry[] = [];

  if (mode === 'stack') {
    cards.forEach((card, index) => {
      const width = widths[index];
      placed.push({
        card,
        index,
        localX: stackWidth - width,
        localY: 0,
        width,
        height: CARD_HEIGHT,
        isBase: index === 0,
      });
    });

    return {
      cards: placed,
      operators,
      width: stackWidth,
      height: CARD_HEIGHT,
      stackWidth,
      resultX: stackWidth + RESULT_GAP,
    };
  }

  let cursor = 0;
  cards.forEach((card, index) => {
    if (index > 0) {
      operators.push({
        x: cursor + EXPAND_OP_GAP,
        y: (CARD_HEIGHT - EXPAND_OP_SIZE) / 2,
        width: EXPAND_OP_SIZE,
        height: EXPAND_OP_SIZE,
      });
      cursor += EXPAND_OP_STEP;
    }

    const width = widths[index];
    placed.push({
      card,
      index,
      localX: cursor,
      localY: 0,
      width,
      height: CARD_HEIGHT,
      isBase: index === 0,
    });
    cursor += width;
  });

  return {
    cards: placed,
    operators,
    width: cursor,
    height: CARD_HEIGHT,
    stackWidth,
    resultX: cursor + RESULT_GAP,
  };
}

export function pieceBounds(piece: Piece): Bounds {
  const layout = layoutPiece(piece.cards, piece.mode);
  return {
    x: piece.x,
    y: piece.y,
    width: layout.width,
    height: layout.height,
  };
}

/** The visible width including the expanded group's result chip. */
export function pieceVisualWidth(piece: Pick<Piece, 'cards' | 'mode'>): number {
  const layout = layoutPiece(piece.cards, piece.mode);
  const reserve = piece.mode === 'expand' && piece.cards.length > 1 ? RESULT_RESERVE : 0;
  return layout.width + reserve;
}

/** Card bounds plus the result chip space, for placement and tidy-up. */
export function pieceVisualBounds(piece: Piece): Bounds {
  const bounds = pieceBounds(piece);
  return { ...bounds, width: pieceVisualWidth(piece) };
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export function snapToGrid(value: number, size = GRID_SIZE): number {
  return Math.round(value / size) * size;
}

export function overlapOf(a: Bounds, b: Bounds): { x: number; y: number; area: number } {
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return {
    x,
    y,
    area: x > 0 && y > 0 ? x * y : 0,
  };
}

export function sharesPlace(a: Card[], b: Card[]): boolean {
  const places = new Set(a.map((card) => card.place));
  return b.some((card) => places.has(card.place));
}

/**
 * True when the pointer aims at a card's flat, leading-digit end — the zone
 * that peels that one card out of its group instead of moving the whole
 * group. CardNode hover intent and the store's after-drop refresh share it.
 */
export function isPeelZone(clientX: number, cardLeft: number): boolean {
  return clientX - cardLeft < DIGIT_WIDTH;
}

/**
 * Strict 2D AABB detection. A target is only considered when both axes
 * intersect by at least 10px. Substantial horizontal overlap stacks the
 * cards; a shallow edge overlap builds an expanded chain instead. A group that
 * is already expanded always gains the card as part of its chain.
 */
export function findDropCandidate(
  cards: Card[],
  draggedBounds: Bounds,
  pieces: Piece[],
  ignoreIds: string[] = [],
): DropCandidate | null {
  let best: DropCandidate | null = null;
  const ignored = new Set(ignoreIds);

  for (const target of pieces) {
    if (ignored.has(target.id)) continue;
    const targetBounds = pieceBounds(target);
    const overlap = overlapOf(draggedBounds, targetBounds);

    if (overlap.x < SNAP_MIN_OVERLAP || overlap.y < SNAP_MIN_OVERLAP) continue;

    const conflict = sharesPlace(cards, target.cards);
    // An expanded group stays expanded: any card that joins it joins the
    // number sentence, however far it overlaps.
    const expanded = target.mode === 'expand' && target.cards.length > 1;
    const stack =
      !expanded &&
      (overlap.x >= STACK_MIN_OVERLAP ||
        overlap.x > STACK_RATIO * Math.min(draggedBounds.width, targetBounds.width));
    const kind: DropKind = conflict ? 'conflict' : stack ? 'stack' : 'chain';

    const candidate: DropCandidate = {
      target,
      targetBounds,
      overlapX: overlap.x,
      overlapY: overlap.y,
      area: overlap.area,
      kind,
    };

    if (
      !best ||
      candidate.area > best.area + 0.5 ||
      (Math.abs(candidate.area - best.area) <= 0.5 && target.z > best.target.z)
    ) {
      best = candidate;
    }
  }

  return best;
}

/**
 * Places the merged group so that the stationary target's largest card keeps
 * its exact canvas coordinate. Because stack positions are right-aligned, all
 * of the target's cards stay visually anchored when a new card is added.
 */
export function getMergedPosition(
  target: Piece,
  mergedCards: Card[],
  mode: PieceMode,
): { x: number; y: number } {
  const oldLayout = layoutPiece(target.cards, target.mode);
  const nextLayout = layoutPiece(mergedCards, mode);
  const anchor = sortCards(target.cards)[0];

  if (!anchor) {
    return { x: target.x, y: target.y };
  }

  const oldAnchor = oldLayout.cards.find((entry) => entry.card.id === anchor.id);
  const nextAnchor = nextLayout.cards.find((entry) => entry.card.id === anchor.id);

  return {
    x: target.x + (oldAnchor?.localX ?? 0) - (nextAnchor?.localX ?? 0),
    y: target.y,
  };
}

export function mergeCards(target: Card[], incoming: Card[]): Card[] {
  const seen = new Set<Place>();
  const merged: Card[] = [];

  for (const card of sortCards([...target, ...incoming])) {
    if (seen.has(card.place)) continue;
    seen.add(card.place);
    merged.push(card);
  }

  return merged;
}

export interface CardRemovalLayout {
  cards: Card[];
  x: number;
  y: number;
  mode: PieceMode;
}

/**
 * Removes one card from a piece without letting the remaining cards jump.
 * Stacked groups keep their arrow tips anchored on the right; expanded chains
 * close ranks from the left. If only one card remains, it keeps the exact
 * on-canvas position it had inside the old layout.
 */
export function removeCardFromPiece(
  piece: Pick<Piece, 'cards' | 'x' | 'y' | 'mode'>,
  cardId: string,
): CardRemovalLayout | null {
  if (!piece.cards.some((card) => card.id === cardId)) return null;

  const oldLayout = layoutPiece(piece.cards, piece.mode);
  const cards = sortCards(piece.cards.filter((card) => card.id !== cardId));
  if (cards.length === 0) return null;

  if (cards.length === 1) {
    const remaining = oldLayout.cards.find((entry) => entry.card.id === cards[0].id);
    return {
      cards,
      x: piece.x + (remaining?.localX ?? 0),
      y: piece.y + (remaining?.localY ?? 0),
      mode: 'stack',
    };
  }

  if (piece.mode === 'stack') {
    const nextWidth = layoutPiece(cards, 'stack').width;
    return {
      cards,
      x: piece.x + oldLayout.width - nextWidth,
      y: piece.y,
      mode: 'stack',
    };
  }

  return {
    cards,
    x: piece.x,
    y: piece.y,
    mode: 'expand',
  };
}

export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * Finds a lively clear-away position after a same-place collision. Direction
 * follows the drop side first, then tries the other sides, then a grid search.
 * The target's bounds are always cleared by the required 28px margin.
 */
export function findBouncePosition(options: {
  dragged: Bounds;
  target: Bounds;
  pieces: Piece[];
  sourceId: string;
  canvas: CanvasSize;
}): { x: number; y: number } {
  const { dragged, target, pieces, sourceId, canvas } = options;
  const pad = CANVAS_PADDING;
  const maxX = canvas.width - dragged.width - pad;
  const maxY = canvas.height - dragged.height - pad;
  const obstacles = pieces
    .filter((piece) => piece.id !== sourceId)
    .map((piece) => pieceVisualBounds(piece));

  const clear = (x: number, y: number): boolean => {
    const candidate: Bounds = { x, y, width: dragged.width, height: dragged.height };
    const targetZone: Bounds = {
      x: target.x - BOUNCE_MARGIN,
      y: target.y - BOUNCE_MARGIN,
      width: target.width + BOUNCE_MARGIN * 2,
      height: target.height + BOUNCE_MARGIN * 2,
    };
    if (overlapOf(candidate, targetZone).area > 0) return false;

    return !obstacles.some((obstacle) => overlapOf(candidate, obstacle).area > 4);
  };

  const clampCandidate = (x: number, y: number) => ({
    x: clamp(x, pad, Math.max(pad, maxX)),
    y: clamp(y, pad, Math.max(pad, maxY)),
  });

  const draggedCenter = dragged.x + dragged.width / 2;
  const targetCenter = target.x + target.width / 2;
  const toRight = draggedCenter >= targetCenter;

  const lateral = toRight
    ? [
        { x: target.x + target.width + BOUNCE_MARGIN, y: dragged.y },
        { x: target.x - dragged.width - BOUNCE_MARGIN, y: dragged.y },
      ]
    : [
        { x: target.x - dragged.width - BOUNCE_MARGIN, y: dragged.y },
        { x: target.x + target.width + BOUNCE_MARGIN, y: dragged.y },
      ];

  const vertical = [
    { x: dragged.x, y: target.y + target.height + BOUNCE_MARGIN },
    { x: dragged.x, y: target.y - dragged.height - BOUNCE_MARGIN },
  ];

  const directional = [
    ...lateral,
    ...vertical,
    { x: target.x + target.width + BOUNCE_MARGIN, y: target.y + target.height + BOUNCE_MARGIN },
    { x: target.x - dragged.width - BOUNCE_MARGIN, y: target.y - dragged.height - BOUNCE_MARGIN },
    { x: target.x + target.width + BOUNCE_MARGIN, y: target.y - dragged.height - BOUNCE_MARGIN },
    { x: target.x - dragged.width - BOUNCE_MARGIN, y: target.y + target.height + BOUNCE_MARGIN },
  ];

  for (const raw of directional) {
    const point = clampCandidate(raw.x, raw.y);
    if (clear(point.x, point.y)) return point;
  }

  const preferred = clampCandidate(dragged.x, dragged.y);
  let best: { x: number; y: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const step = GRID_SIZE;
  const startX = pad;
  const startY = pad;
  const endX = Math.max(startX, maxX);
  const endY = Math.max(startY, maxY);

  for (let y = startY; y <= endY; y += step) {
    for (let x = startX; x <= endX; x += step) {
      if (!clear(x, y)) continue;
      const distance = (x - preferred.x) ** 2 + (y - preferred.y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
    }
  }

  if (best) return best;

  // A very crowded canvas — adjacent clear space does not exist. Return the
  // closest in-bounds spot instead of letting the card escape the viewport.
  return {
    x: clamp(target.x + target.width + BOUNCE_MARGIN, pad, Math.max(pad, maxX)),
    y: clamp(dragged.y, pad, Math.max(pad, maxY)),
  };
}

/**
 * Finds the free spot nearest the visual centre of the canvas, used for
 * tap-to-add and the "Make" controls.
 */
export function findFreeSpot(options: {
  width: number;
  height: number;
  pieces: Piece[];
  canvas: CanvasSize;
  ignoreId?: string;
}): { x: number; y: number } {
  const { width, height, pieces, canvas, ignoreId } = options;
  const pad = Math.max(CANVAS_PADDING, 20);
  const step = GRID_SIZE;
  const maxX = Math.max(pad, canvas.width - width - pad);
  const maxY = Math.max(pad, canvas.height - height - pad);
  const preferred = {
    x: clamp(canvas.width * 0.5 - width * 0.5, pad, maxX),
    y: clamp(canvas.height * 0.45 - height * 0.5, pad, maxY),
  };
  const others = pieces
    .filter((piece) => piece.id !== ignoreId)
    .map((piece) => {
      const box = pieceBounds(piece);
      return {
        x: box.x - 16,
        y: box.y - 16,
        width: box.width + 32,
        height: box.height + 32,
      };
    });

  let best = preferred;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let y = pad; y <= maxY; y += step) {
    for (let x = pad; x <= maxX; x += step) {
      const candidate: Bounds = { x, y, width, height };
      if (others.some((other) => overlapOf(candidate, other).area > 0)) continue;
      const distance = (x - preferred.x) ** 2 + (y - preferred.y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
    }
  }

  return best;
}

const WORDS_UNDER_TWENTY = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const WORDS_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * Writes a piece's value in words, e.g. 4325 → "Four thousand three hundred
 * twenty-five". Empty places are left out rather than read as zero. English
 * only for now (see the locale TODO on formatNumber).
 */
export function numberToWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 9999) return formatNumber(value);
  if (value === 0) return 'Zero';

  const thousands = Math.floor(value / 1000);
  const hundreds = Math.floor(value / 100) % 10;
  const rest = value % 100;
  const parts: string[] = [];
  if (thousands) parts.push(`${WORDS_UNDER_TWENTY[thousands]} thousand`);
  if (hundreds) parts.push(`${WORDS_UNDER_TWENTY[hundreds]} hundred`);
  if (rest >= 20) {
    const ones = rest % 10;
    parts.push(WORDS_TENS[Math.floor(rest / 10)] + (ones ? `-${WORDS_UNDER_TWENTY[ones]}` : ''));
  } else if (rest) {
    parts.push(WORDS_UNDER_TWENTY[rest]);
  }

  const text = parts.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function numberToCards(value: number): Array<{ place: Place; digit: number }> {
  if (!Number.isFinite(value) || value < 1 || value > 9999) return [];
  const places: Place[] = [1000, 100, 10, 1];
  const result: Array<{ place: Place; digit: number }> = [];

  for (const place of places) {
    const digit = Math.floor(value / place) % 10;
    if (digit > 0) result.push({ place, digit });
  }

  return result;
}

export function placeTier(place: Place): 'thousands' | 'hundreds' | 'tens' | 'ones' {
  if (place === 1000) return 'thousands';
  if (place === 100) return 'hundreds';
  if (place === 10) return 'tens';
  return 'ones';
}

