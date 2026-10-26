import { describe, expect, it } from 'vitest';
import {
  BOUNCE_MARGIN,
  CANVAS_PADDING,
  EXPAND_OP_GAP,
  EXPAND_OP_SIZE,
  RESULT_RESERVE,
  clamp,
  findBouncePosition,
  findDropCandidate,
  findFreeSpot,
  formatNumber,
  getMergedPosition,
  layoutPiece,
  mergeCards,
  numberToCards,
  numberToWords,
  overlapOf,
  pieceBounds,
  pieceVisualBounds,
  pieceVisualWidth,
  removeCardFromPiece,
  sharesPlace,
  snapToGrid,
  sortCards,
  type Card,
  type Piece,
  type PieceMode,
  type Place,
} from '../../src/lib/geometry';

let idSequence = 0;

function card(place: Place, digit: number, id = `card-${++idSequence}`): Card {
  return { id, place, digit };
}

function piece(
  id: string,
  cards: Card[],
  x: number,
  y: number,
  mode: PieceMode = 'stack',
  z = 1,
): Piece {
  return { id, cards: sortCards(cards), x, y, mode, z, spring: 'default' };
}

describe('layoutPiece', () => {
  const cards = [
    card(1000, 4),
    card(100, 3),
    card(10, 2),
    card(1, 5),
  ];

  it('right-aligns stacked cards so arrow tips are flush', () => {
    const layout = layoutPiece(cards, 'stack');

    expect(layout.width).toBe(260);
    expect(layout.stackWidth).toBe(260);
    expect(layout.height).toBe(68);
    expect(layout.cards.map((entry) => entry.localX)).toEqual([0, 58, 116, 174]);
    expect(layout.cards.map((entry) => entry.width)).toEqual([260, 202, 144, 86]);
    expect(layout.operators).toHaveLength(0);
    expect(layout.cards[0].isBase).toBe(true);
    expect(layout.cards[1].isBase).toBe(false);
  });

  it('spreads expanded cards with + operator positions', () => {
    const layout = layoutPiece(cards, 'expand');

    expect(layout.cards.map((entry) => entry.localX)).toEqual([0, 314, 570, 768]);
    expect(layout.width).toBe(854);
    expect(layout.operators).toEqual([
      { x: 274, y: 21, width: EXPAND_OP_SIZE, height: EXPAND_OP_SIZE },
      { x: 530, y: 21, width: EXPAND_OP_SIZE, height: EXPAND_OP_SIZE },
      { x: 728, y: 21, width: EXPAND_OP_SIZE, height: EXPAND_OP_SIZE },
    ]);
    expect(layout.operators[0].x).toBe(260 + EXPAND_OP_GAP);
  });

  it('sorts cards by place value regardless of input order', () => {
    const shuffled = [cards[3], cards[1], cards[0], cards[2]];
    const layout = layoutPiece(shuffled, 'stack');
    expect(layout.cards.map((entry) => entry.card.place)).toEqual([1000, 100, 10, 1]);
  });

  it('reserves extra room for the expanded result chip', () => {
    const single = piece('single', [cards[1]], 10, 20, 'stack');
    const group = piece('group', cards, 10, 20, 'expand');

    expect(pieceBounds(single)).toEqual({ x: 10, y: 20, width: 202, height: 68 });
    expect(pieceVisualWidth(group)).toBe(854 + RESULT_RESERVE);
    expect(pieceVisualBounds(group).width).toBe(854 + RESULT_RESERVE);
  });
});

describe('overlap and drop detection', () => {
  it('reports strict AABB overlap', () => {
    expect(overlapOf({ x: 0, y: 0, width: 100, height: 50 }, { x: 90, y: 40, width: 30, height: 30 })).toEqual({
      x: 10,
      y: 10,
      area: 100,
    });
    expect(overlapOf({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 10, width: 10, height: 10 }).area).toBe(0);
  });

  it('ignores cards overlapping less than 10px on either axis', () => {
    const target = piece('target', [card(1000, 3)], 0, 0);
    const draggedCards = [card(100, 8)];

    const horizontal = findDropCandidate(draggedCards, { x: 252, y: 0, width: 202, height: 68 }, [target]);
    const vertical = findDropCandidate(draggedCards, { x: 100, y: 63, width: 202, height: 68 }, [target]);

    expect(horizontal).toBeNull();
    expect(vertical).toBeNull();
  });

  it('chains shallow edge overlaps and stacks substantial overlaps', () => {
    const target = piece('target', [card(1000, 3)], 0, 0);
    const draggedCards = [card(100, 8)];

    const chain = findDropCandidate(draggedCards, { x: 248, y: 0, width: 202, height: 68 }, [target]);
    const stack = findDropCandidate(draggedCards, { x: 220, y: 0, width: 202, height: 68 }, [target]);

    expect(chain?.kind).toBe('chain');
    expect(chain?.overlapX).toBe(12);
    expect(stack?.kind).toBe('stack');
    expect(stack?.overlapX).toBe(40);
  });

  it('joins an expanded group as a chain however far the card overlaps', () => {
    const expanded = piece('target', [card(1000, 4), card(10, 2)], 0, 0, 'expand');
    const deep = findDropCandidate([card(100, 3)], { x: 100, y: 0, width: 202, height: 68 }, [expanded]);
    const duplicate = findDropCandidate([card(10, 7)], { x: 100, y: 0, width: 144, height: 68 }, [expanded]);

    expect(deep?.overlapX).toBeGreaterThan(100);
    expect(deep?.kind).toBe('chain');
    expect(duplicate?.kind).toBe('conflict');
  });

  it('treats a duplicate place as a conflict even at the edge', () => {
    const target = piece('target', [card(100, 4), card(10, 2), card(1, 5)], 0, 0);
    const incoming = [card(10, 5)];
    const candidate = findDropCandidate(incoming, { x: 187, y: 0, width: 144, height: 68 }, [target]);

    expect(candidate?.kind).toBe('conflict');
    expect(candidate?.overlapX).toBe(15);
    expect(sharesPlace(incoming, target.cards)).toBe(true);
  });

  it('picks the largest overlap and ignores excluded pieces', () => {
    const slightlyOverlapped = piece('a', [card(100, 8)], 180, 0, 'stack', 5);
    const heavilyOverlapped = piece('b', [card(1000, 2)], 50, 0, 'stack', 1);
    const dragged = [card(10, 5)];
    const bounds = { x: 100, y: 0, width: 144, height: 68 };

    const winner = findDropCandidate(dragged, bounds, [slightlyOverlapped, heavilyOverlapped]);
    const excluded = findDropCandidate(dragged, bounds, [slightlyOverlapped, heavilyOverlapped], ['b']);

    expect(winner?.target.id).toBe('b');
    expect(excluded?.target.id).toBe('a');
  });
});

describe('removeCardFromPiece', () => {
  const cards = [card(1000, 4), card(100, 3), card(10, 2), card(1, 5)];

  it('anchors a stack on its arrow tips when the widest card leaves', () => {
    const group = piece('group', cards, 100, 50, 'stack');
    const result = removeCardFromPiece(group, group.cards[0].id);

    expect(result?.mode).toBe('stack');
    expect(result?.x).toBe(158);
    expect(result?.y).toBe(50);
    expect(result?.cards.map((entry) => entry.place)).toEqual([100, 10, 1]);
    // The remaining hundreds card stays exactly where it was.
    expect(result!.x + layoutPiece(result!.cards, 'stack').cards[0].localX).toBe(158);
  });

  it('leaves the position alone when a middle card leaves a stack', () => {
    const group = piece('group', cards, 100, 50, 'stack');
    const result = removeCardFromPiece(group, group.cards[1].id);

    expect(result).toMatchObject({ x: 100, y: 50, mode: 'stack' });
    expect(result?.cards.map((entry) => entry.place)).toEqual([1000, 10, 1]);
  });

  it('keeps a single remaining card exactly where it appeared', () => {
    const group = piece('group', [card(100, 3), card(10, 2)], 100, 50, 'expand');
    const result = removeCardFromPiece(group, group.cards[0].id);
    const oldTens = layoutPiece(group.cards, 'expand').cards.find(
      (entry) => entry.card.place === 10,
    );

    expect(result?.mode).toBe('stack');
    expect(result?.x).toBe(100 + (oldTens?.localX ?? 0));
    expect(result?.y).toBe(50);
  });

  it('closes ranks from the left when an expanded card leaves', () => {
    const group = piece('group', cards, 100, 50, 'expand');
    const result = removeCardFromPiece(group, group.cards[1].id);

    expect(result).toMatchObject({ x: 100, y: 50, mode: 'expand' });
    expect(result?.cards.map((entry) => entry.place)).toEqual([1000, 10, 1]);
  });

  it('returns null when the card is not in the piece', () => {
    const group = piece('group', cards, 100, 50);
    expect(removeCardFromPiece(group, 'missing')).toBeNull();
  });
});

describe('getMergedPosition', () => {
  it('keeps the target card anchored when a wider card is added', () => {
    const target = piece('target', [card(100, 4)], 100, 50, 'stack');
    const merged = mergeCards(target.cards, [card(1000, 2), card(10, 2), card(1, 5)]);
    const position = getMergedPosition(target, merged, 'stack');
    const anchor = layoutPiece(merged, 'stack').cards.find((entry) => entry.card.place === 100);

    expect(anchor?.localX).toBe(58);
    expect(position.x).toBe(42); // 100 − (58 − 0)
    expect(position.y).toBe(50);
    expect(position.x + (anchor?.localX ?? 0)).toBe(100);
  });

  it('keeps the target group anchored when stacking smaller cards', () => {
    const target = piece('target', [card(1000, 4), card(100, 3)], 100, 50, 'stack');
    const merged = mergeCards(target.cards, [card(10, 2), card(1, 5)]);
    const position = getMergedPosition(target, merged, 'stack');

    expect(position).toEqual({ x: 100, y: 50 });
  });

  it('anchors the target card in an expanded chain', () => {
    const target = piece('target', [card(100, 4)], 100, 50, 'stack');
    const merged = mergeCards(target.cards, [card(1000, 2)]);
    const position = getMergedPosition(target, merged, 'expand');
    const layout = layoutPiece(merged, 'expand');
    const anchor = layout.cards.find((entry) => entry.card.place === 100);

    expect(anchor?.localX).toBe(314);
    expect(position.x).toBe(100 - 314);
    expect(position.x + (anchor?.localX ?? 0)).toBe(100);
  });

  it('skips duplicate places when merging', () => {
    const target = [card(1000, 4), card(100, 3)];
    const merged = mergeCards(target, [card(100, 8), card(10, 2), card(1, 5)]);

    expect(merged.map((entry) => entry.place)).toEqual([1000, 100, 10, 1]);
    expect(merged.map((entry) => entry.digit)).toEqual([4, 3, 2, 5]);
  });
});

describe('findBouncePosition', () => {
  const canvas = { width: 1200, height: 600 };

  it('clears the target bounding box by the 28px margin', () => {
    const target = piece('target', [card(100, 1), card(10, 2), card(1, 5)], 300, 200);
    const source = piece('source', [card(10, 5)], 350, 200);
    const result = findBouncePosition({
      dragged: pieceVisualBounds(source),
      target: pieceVisualBounds(target),
      pieces: [target, source],
      sourceId: source.id,
      canvas,
    });

    expect(result).toEqual({ x: 530, y: 200 });
    expect(result.x - (target.x + 202)).toBe(BOUNCE_MARGIN);
  });

  it('finds another direction when the preferred side would leave the viewport', () => {
    const target = piece('target', [card(100, 1), card(10, 2), card(1, 5)], 900, 200);
    const source = piece('source', [card(10, 5)], 950, 200);
    const result = findBouncePosition({
      dragged: pieceVisualBounds(source),
      target: pieceVisualBounds(target),
      pieces: [target, source],
      sourceId: source.id,
      canvas,
    });
    const targetZone = {
      x: target.x - BOUNCE_MARGIN,
      y: target.y - BOUNCE_MARGIN,
      width: 202 + BOUNCE_MARGIN * 2,
      height: 68 + BOUNCE_MARGIN * 2,
    };
    const sourceBounds = { x: result.x, y: result.y, width: 144, height: 68 };

    expect(overlapOf(sourceBounds, targetZone).area).toBe(0);
    expect(result.x).toBeGreaterThanOrEqual(CANVAS_PADDING);
    expect(result.x).toBeLessThanOrEqual(canvas.width - 144 - CANVAS_PADDING);
    expect(result.y).toBeGreaterThanOrEqual(CANVAS_PADDING);
    expect(result.y).toBeLessThanOrEqual(canvas.height - 68 - CANVAS_PADDING);
  });

  it('always clamps the bounced card inside the canvas', () => {
    const target = piece('target', [card(1000, 1), card(100, 2), card(10, 5)], 20, 20);
    const source = piece('source', [card(1, 5)], 30, 20);
    const result = findBouncePosition({
      dragged: pieceVisualBounds(source),
      target: pieceVisualBounds(target),
      pieces: [target, source],
      sourceId: source.id,
      canvas: { width: 320, height: 180 },
    });

    expect(result.x).toBeGreaterThanOrEqual(CANVAS_PADDING);
    expect(result.y).toBeGreaterThanOrEqual(CANVAS_PADDING);
    expect(result.x + 86).toBeLessThanOrEqual(320 - CANVAS_PADDING + 0.01);
    expect(result.y + 68).toBeLessThanOrEqual(180 - CANVAS_PADDING + 0.01);
  });
});

describe('number helpers', () => {
  it('formats numbers with thousands separators', () => {
    expect(formatNumber(4325)).toBe('4,325');
    expect(formatNumber(9999)).toBe('9,999');
  });

  it('decomposes a number into place-value cards', () => {
    expect(numberToCards(4325)).toEqual([
      { place: 1000, digit: 4 },
      { place: 100, digit: 3 },
      { place: 10, digit: 2 },
      { place: 1, digit: 5 },
    ]);
    expect(numberToCards(1000)).toEqual([{ place: 1000, digit: 1 }]);
    expect(numberToCards(101)).toEqual([
      { place: 100, digit: 1 },
      { place: 1, digit: 1 },
    ]);
    expect(numberToCards(0)).toEqual([]);
    expect(numberToCards(10000)).toEqual([]);
    expect(numberToCards(Number.NaN)).toEqual([]);
  });

  it('clamps and snaps to the 24px grid', () => {
    expect(snapToGrid(35)).toBe(24);
    expect(snapToGrid(36)).toBe(48);
    expect(snapToGrid(12)).toBe(24);
    expect(clamp(-5, 10, 100)).toBe(10);
    expect(clamp(105, 10, 100)).toBe(100);
    expect(clamp(50, 10, 100)).toBe(50);
  });
});

describe('numberToWords', () => {
  it('names every value a piece can hold, in sentence case', () => {
    expect(numberToWords(4325)).toBe('Four thousand three hundred twenty-five');
    expect(numberToWords(9999)).toBe('Nine thousand nine hundred ninety-nine');
    expect(numberToWords(1)).toBe('One');
    expect(numberToWords(7)).toBe('Seven');
  });

  it('uses the teen words and plain tens', () => {
    expect(numberToWords(10)).toBe('Ten');
    expect(numberToWords(13)).toBe('Thirteen');
    expect(numberToWords(19)).toBe('Nineteen');
    expect(numberToWords(20)).toBe('Twenty');
    expect(numberToWords(90)).toBe('Ninety');
  });

  it('leaves out empty places instead of saying zero', () => {
    expect(numberToWords(100)).toBe('One hundred');
    expect(numberToWords(105)).toBe('One hundred five');
    expect(numberToWords(4005)).toBe('Four thousand five');
    expect(numberToWords(7010)).toBe('Seven thousand ten');
    expect(numberToWords(3400)).toBe('Three thousand four hundred');
    expect(numberToWords(8000)).toBe('Eight thousand');
  });
});

describe('findFreeSpot', () => {
  it('keeps clear of extra obstacles', () => {
    const canvas = { width: 600, height: 400 };
    const obstacles = [{ x: 0, y: 0, width: 600, height: 200 }];
    const spot = findFreeSpot({ width: 100, height: 60, pieces: [], canvas, obstacles });
    expect(spot.y).toBeGreaterThanOrEqual(216);
  });

  it('picks the least crowded spot when nothing is fully clear', () => {
    const canvas = { width: 600, height: 400 };
    // Everything is covered except a strip down the left edge.
    const obstacles = [{ x: 120, y: 0, width: 480, height: 400 }];
    const spot = findFreeSpot({ width: 200, height: 60, pieces: [], canvas, obstacles });
    expect(spot.x).toBeLessThan(60);
  });

  it('searches only the given area, such as the part of the bench in view', () => {
    const canvas = { width: 6000, height: 400 };
    const area = { x: 2000, y: 0, width: 600, height: 400 };
    const spot = findFreeSpot({ width: 100, height: 60, pieces: [], canvas, area });
    expect(spot.x).toBeGreaterThanOrEqual(2000);
    expect(spot.x + 100).toBeLessThanOrEqual(2600);
    // Centred in the area, as it would be on an unscrolled bench.
    expect(Math.abs(spot.x + 50 - 2300)).toBeLessThanOrEqual(24);
  });
});
