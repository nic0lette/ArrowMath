import { describe, expect, it } from 'vitest';
import { CARD_HEIGHT, getArrowCardWidth } from 'arrow-cards';
import {
  PLUS_GAP,
  PLUS_SIZE,
  ROW_ITEM_GAP,
  ROW_SCALE,
  findSumSlot,
  placeRows,
  rowResult,
  sumLayout,
  type Sum,
} from '../../src/lib/addition';
import type { Card, Piece, Place } from '../../src/lib/geometry';

let idSequence = 0;

function card(place: Place, digit: number): Card {
  return { id: `card-${++idSequence}`, place, digit };
}

function cardsFor(value: number, places: Place[] = [1000, 100, 10, 1]): Card[] {
  return places
    .map((place) => ({ place, digit: Math.floor(value / place) % 10 }))
    .filter((entry) => entry.digit > 0)
    .map((entry) => card(entry.place, entry.digit));
}

function piece(id: string, cards: Card[], x = 0, y = 0): Piece {
  return { id, cards, x, y, mode: 'stack', z: 1, spring: 'default' };
}

function sum(overrides: Partial<Sum> = {}): Sum {
  return { id: 'sum', x: 400, y: 300, left: null, right: null, revealed: {}, ...overrides };
}

describe('placeRows', () => {
  it('lists one row per place, ones first', () => {
    const rows = placeRows(cardsFor(1234), cardsFor(5678));
    expect(rows.map((row) => [row.place, row.left, row.right])).toEqual([
      [1, 4, 8],
      [10, 3, 7],
      [100, 2, 6],
      [1000, 1, 5],
    ]);
  });

  it('fills a place missing from one number with zero', () => {
    const rows = placeRows(cardsFor(123), cardsFor(205));
    expect(rows.map((row) => [row.place, row.left, row.right])).toEqual([
      [1, 3, 5],
      [10, 2, 0],
      [100, 1, 2],
    ]);
  });

  it('stops at the highest place either number uses', () => {
    expect(placeRows(cardsFor(7), cardsFor(40)).map((row) => row.place)).toEqual([1, 10]);
  });

  it('counts a zero card as using its place', () => {
    const rows = placeRows([card(100, 0), card(1, 3)], cardsFor(5));
    expect(rows.map((row) => row.place)).toEqual([1, 10, 100]);
  });

  it('keys each row by its digits so a changed number can be told apart', () => {
    const [before] = placeRows(cardsFor(4), cardsFor(8));
    const [after] = placeRows(cardsFor(5), cardsFor(8));
    expect(before.key).not.toEqual(after.key);
  });
});

describe('rowResult', () => {
  it('gives one card when there is no carry', () => {
    expect(rowResult(10, 3, 4)).toEqual({ cards: [{ place: 10, digit: 7 }], overflow: null });
  });

  it('gives a zero card for 0 + 0', () => {
    expect(rowResult(10, 0, 0)).toEqual({ cards: [{ place: 10, digit: 0 }], overflow: null });
  });

  it('stacks the carried ten with the remaining ones', () => {
    expect(rowResult(1, 4, 8)).toEqual({
      cards: [
        { place: 10, digit: 1 },
        { place: 1, digit: 2 },
      ],
      overflow: null,
    });
  });

  it('carries a hundred out of the tens', () => {
    expect(rowResult(10, 3, 7).cards).toEqual([{ place: 100, digit: 1 }]);
  });

  it('reports thousands that carry past the largest card as an overflow value', () => {
    expect(rowResult(1000, 5, 6)).toEqual({ cards: [], overflow: 11000 });
  });
});

describe('sumLayout', () => {
  it('puts the left number just before the plus and the right number just after it', () => {
    const left = piece('a', cardsFor(1234));
    const right = piece('b', cardsFor(5678));
    const layout = sumLayout(sum({ left: 'a', right: 'b' }), left, right);

    expect(layout.plus.x).toBe(400);
    expect(layout.plus.y + PLUS_SIZE / 2).toBe(300 + CARD_HEIGHT / 2);
    expect(layout.leftPosition).toEqual({ x: 400 - PLUS_GAP - getArrowCardWidth(1000), y: 300 });
    expect(layout.rightPosition).toEqual({ x: 400 + PLUS_SIZE + PLUS_GAP, y: 300 });
  });

  it('shows place rows only when both sides are filled', () => {
    const left = piece('a', cardsFor(12));
    expect(sumLayout(sum({ left: 'a' }), left, null).rows).toEqual([]);
    expect(sumLayout(sum({ left: 'a', right: 'b' }), left, piece('b', cardsFor(5))).rows).toHaveLength(2);
  });

  it('stacks rows upwards from the ones above the numbers', () => {
    const layout = sumLayout(
      sum({ left: 'a', right: 'b' }),
      piece('a', cardsFor(1234)),
      piece('b', cardsFor(5678)),
    );
    const ys = layout.rows.map((row) => row.y);
    expect(layout.rows.map((row) => row.place)).toEqual([1, 10, 100, 1000]);
    expect(ys[0] + layout.rows[0].height).toBeLessThan(300);
    expect(ys).toEqual([...ys].sort((a, b) => b - a));
  });

  it('lines up every row on the plus column and every = in one column', () => {
    const layout = sumLayout(
      sum({ left: 'a', right: 'b' }),
      piece('a', cardsFor(1234)),
      piece('b', cardsFor(5678)),
    );
    const plusCenter = layout.plus.x + layout.plus.width / 2;
    for (const row of layout.rows) {
      expect(row.plus.x + row.plus.width / 2).toBe(plusCenter);
      expect(row.leftCard.x + row.leftCard.width).toBeLessThan(row.plus.x);
      expect(row.rightCard.x).toBeGreaterThan(row.plus.x + row.plus.width);
      expect(row.equals.x).toBe(layout.rows[0].equals.x);
      expect(row.equals.x).toBeGreaterThan(row.rightCard.x + row.rightCard.width);
    }
  });

  it('bounds cover the numbers, the plus and the rows', () => {
    const layout = sumLayout(
      sum({ left: 'a', right: 'b' }),
      piece('a', cardsFor(1234)),
      piece('b', cardsFor(5678)),
    );
    const top = layout.rows[layout.rows.length - 1].y;
    expect(layout.bounds.y).toBeLessThanOrEqual(top);
    expect(layout.bounds.y + layout.bounds.height).toBe(300 + CARD_HEIGHT);
    expect(layout.bounds.x).toBeLessThanOrEqual(layout.leftPosition!.x);
  });
});

describe('sumLayout alignment', () => {
  const tip = (box: { x: number; width: number }) => box.x + box.width;

  function filled(leftValue: number, rightValue: number) {
    const left = piece('a', cardsFor(leftValue));
    const right = piece('b', cardsFor(rightValue));
    return sumLayout(sum({ left: 'a', right: 'b' }), left, right);
  }

  it('ends every left row card at the left number\'s arrow tip', () => {
    const layout = filled(1234, 56);
    for (const row of layout.rows) expect(tip(row.leftCard)).toBe(400 - PLUS_GAP);
  });

  it('ends every right row card at the right number\'s arrow tip', () => {
    const layout = filled(1234, 5678);
    const rightTip = layout.rightPosition!.x + getArrowCardWidth(1000);
    for (const row of layout.rows) expect(tip(row.rightCard)).toBe(rightTip);
  });

  it('moves a narrow right number along so the widest row card still clears the plus', () => {
    const layout = filled(5678, 5);
    const thousands = layout.rows.find((row) => row.place === 1000)!;
    expect(thousands.rightCard.x).toBeGreaterThanOrEqual(
      thousands.plus.x + thousands.plus.width + ROW_ITEM_GAP,
    );
    const rightTip = layout.rightPosition!.x + getArrowCardWidth(1);
    expect(layout.rightPosition!.x).toBeGreaterThan(400 + PLUS_SIZE + PLUS_GAP);
    for (const row of layout.rows) expect(tip(row.rightCard)).toBe(rightTip);
  });

  it('puts an = after the right number, in the same column as every row\'s =', () => {
    const layout = filled(127, 2385);
    const equals = layout.equals!;
    const center = equals.x + equals.width / 2;
    expect(equals.x).toBeGreaterThan(layout.rightPosition!.x + getArrowCardWidth(1000));
    expect(equals.y + equals.height / 2).toBe(300 + CARD_HEIGHT / 2);
    for (const row of layout.rows) expect(row.equals.x + row.equals.width / 2).toBe(center);
  });

  it('keeps room for the total as full-size cards after the =', () => {
    const layout = filled(127, 2385);
    const total = layout.total!;
    expect(total.value).toBe(2512);
    expect(total.x).toBeGreaterThan(layout.equals!.x + layout.equals!.width);
    expect(total.width).toBe(getArrowCardWidth(1000));
    expect(total.cards.map((entry) => [entry.place, entry.digit])).toEqual([
      [1000, 2],
      [100, 5],
      [10, 1],
      [1, 2],
    ]);
    for (const entry of total.cards) expect(tip(entry)).toBe(tip(total));
    expect(tip(layout.bounds)).toBeGreaterThanOrEqual(tip(total));
  });

  it('ends every row answer at the total\'s ones tip', () => {
    const layout = filled(127, 2385);
    const totalTip = tip(layout.total!);
    for (const row of layout.rows) {
      expect(tip(row.result)).toBe(totalTip);
      for (const entry of row.resultCards) expect(tip(entry)).toBe(totalTip);
    }
  });

  it('ends an overflowing answer at the same tip', () => {
    const layout = filled(5000, 6000);
    const thousands = layout.rows.find((row) => row.place === 1000)!;
    expect(thousands.overflow).toBe(11000);
    expect(layout.total!.overflow).toBe(11000);
    expect(layout.total!.cards).toEqual([]);
    expect(tip(thousands.result)).toBe(tip(layout.total!));
  });

  it('shows a zero card for a total of nothing', () => {
    const layout = sumLayout(
      sum({ left: 'a', right: 'b' }),
      piece('a', [card(1, 0)]),
      piece('b', [card(1, 0)]),
    );
    expect(layout.total!.cards.map((entry) => [entry.place, entry.digit])).toEqual([[1, 0]]);
  });

  it('has no = or total until both sides are filled', () => {
    const layout = sumLayout(sum({ left: 'a' }), piece('a', cardsFor(12)), null);
    expect(layout.equals).toBeNull();
    expect(layout.total).toBeNull();
  });

  it('keeps row cards at row scale', () => {
    const layout = filled(1234, 5678);
    for (const row of layout.rows) {
      expect(row.leftCard.width).toBe(getArrowCardWidth(row.place) * ROW_SCALE);
    }
  });
});

describe('findSumSlot', () => {

  it('finds the empty left slot when a card is dropped just before the plus', () => {
    const sums = [sum()];
    const width = getArrowCardWidth(1);
    const dropped = { x: 400 - PLUS_GAP - width + 6, y: 306, width, height: CARD_HEIGHT };
    expect(findSumSlot(dropped, sums)).toEqual({ sum: sums[0], side: 'left' });
  });

  it('finds the empty right slot when a card is dropped just after the plus', () => {
    const sums = [sum()];
    const dropped = { x: 400 + PLUS_SIZE + 4, y: 290, width: 86, height: CARD_HEIGHT };
    expect(findSumSlot(dropped, sums)).toEqual({ sum: sums[0], side: 'right' });
  });

  it('ignores a slot that is already filled', () => {
    const sums = [sum({ right: 'a' })];
    const dropped = { x: 400 + PLUS_SIZE + 4, y: 300, width: 86, height: CARD_HEIGHT };
    expect(findSumSlot(dropped, sums)).toBeNull();
  });

  it('ignores cards that are nowhere near', () => {
    const dropped = { x: 40, y: 40, width: 86, height: CARD_HEIGHT };
    expect(findSumSlot(dropped, [sum()])).toBeNull();
  });
});
