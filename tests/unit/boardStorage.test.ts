import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deserializeBoard,
  deserializeSums,
  flushBoard,
  loadBoard,
  saveBoard,
  saveBoardLater,
  serializeBoard,
  BOARD_KEY,
  BOARD_VERSION,
} from '../../src/lib/boardStorage';
import { sortCards, type Piece, type PieceMode, type Place } from '../../src/lib/geometry';

let idSequence = 0;

function card(place: Place, digit: number): { id: string; place: Place; digit: number } {
  return { id: `card-${++idSequence}`, place, digit };
}

function piece(
  id: string,
  cards: Array<{ id: string; place: Place; digit: number }>,
  x: number,
  y: number,
  mode: PieceMode = 'stack',
  z = 1,
): Piece {
  return { id, cards: sortCards(cards), x, y, mode, z, spring: 'default' };
}

describe('serializeBoard', () => {
  it('round-trips pieces through JSON with coordinates and stacking intact', () => {
    const board = [
      piece('piece-a', [card(1000, 4), card(100, 3)], 100, 50, 'stack', 2),
      piece('piece-b', [card(10, 2), card(1, 5)], 260, 120, 'expand', 3),
    ];

    const stored = serializeBoard(board);
    expect(stored.version).toBe(BOARD_VERSION);
    expect(stored.pieces).toHaveLength(2);
    expect(stored.pieces[0]).toMatchObject({ id: 'piece-a', x: 100, y: 50, mode: 'stack', z: 2 });
    expect(stored.pieces[1].cards).toHaveLength(2);
    expect('spring' in stored.pieces[0]).toBe(false);

    const restored = deserializeBoard(JSON.parse(JSON.stringify(stored)));
    expect(restored).toHaveLength(2);
    expect(restored[0]).toMatchObject({
      id: 'piece-a',
      x: 100,
      y: 50,
      mode: 'stack',
      z: 2,
      spring: 'default',
    });
    expect(restored[0].cards.map((entry) => entry.place)).toEqual([1000, 100]);
    expect(restored[1].cards.map((entry) => [entry.place, entry.digit])).toEqual([
      [10, 2],
      [1, 5],
    ]);
  });

  it('rounds coordinates so the stored board stays tidy', () => {
    const stored = serializeBoard([piece('p', [card(1, 5)], 100.12345, 50)]);

    expect(stored.pieces[0].x).toBe(100.12);
    expect(stored.pieces[0].y).toBe(50);
  });
});

describe('deserializeBoard validation', () => {
  it('returns an empty board for malformed roots', () => {
    expect(deserializeBoard(null)).toEqual([]);
    expect(deserializeBoard('nope')).toEqual([]);
    expect(deserializeBoard({})).toEqual([]);
    expect(deserializeBoard({ pieces: 'all' })).toEqual([]);
    expect(deserializeBoard({ pieces: null })).toEqual([]);
  });

  it('drops pieces with bad cards, unknown places or invalid digits', () => {
    const board = deserializeBoard({
      version: BOARD_VERSION,
      pieces: [
        { id: 'ok', cards: [{ id: 'c1', place: 100, digit: 3 }], x: 10, y: 20, mode: 'stack', z: 1 },
        { id: 'bad-place', cards: [{ id: 'c2', place: 50, digit: 3 }], x: 0, y: 0, mode: 'stack', z: 1 },
        { id: 'bad-digit', cards: [{ id: 'c3', place: 10, digit: 12 }], x: 0, y: 0, mode: 'stack', z: 1 },
        { id: 'bad-id', cards: [{ id: '', place: 10, digit: 2 }], x: 0, y: 0, mode: 'stack', z: 1 },
        { id: 'empty', cards: [], x: 0, y: 0, mode: 'stack', z: 1 },
        'not-an-object',
        null,
      ],
    });

    expect(board.map((entry) => entry.id)).toEqual(['ok']);
  });

  it('collapses duplicate places inside one piece and sorts by place', () => {
    const board = deserializeBoard({
      version: BOARD_VERSION,
      pieces: [
        {
          id: 'dup',
          cards: [
            { id: 'c1', place: 1, digit: 5 },
            { id: 'c2', place: 100, digit: 3 },
            { id: 'c3', place: 100, digit: 8 },
            { id: 'c4', place: 10, digit: 2 },
          ],
          x: 0,
          y: 0,
          mode: 'stack',
          z: 1,
        },
      ],
    });

    expect(board).toHaveLength(1);
    expect(board[0].cards.map((entry) => [entry.place, entry.digit])).toEqual([
      [100, 3],
      [10, 2],
      [1, 5],
    ]);
  });

  it('defaults an unknown mode to stack and falls back for bad coordinates', () => {
    const board = deserializeBoard({
      version: BOARD_VERSION,
      pieces: [{ id: 'weird', cards: [{ id: 'c1', place: 10, digit: 2 }], x: 'many', y: null, mode: 'diagonal', z: -4 }],
    });

    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ x: 0, y: 0, mode: 'stack', z: 1, spring: 'default' });
  });
});

describe('zero cards', () => {
  it('keeps a zero card, which holds an empty place open', () => {
    const board = deserializeBoard({
      version: BOARD_VERSION,
      pieces: [{ id: 'p', cards: [{ id: 'c1', place: 10, digit: 0 }], x: 0, y: 0, mode: 'stack', z: 1 }],
    });

    expect(board[0].cards).toEqual([{ id: 'c1', place: 10, digit: 0 }]);
  });
});

describe('ten-thousands cards', () => {
  it('are never loaded as a card on the bench; they only appear in answers', () => {
    const board = deserializeBoard({
      version: BOARD_VERSION,
      pieces: [
        {
          id: 'p',
          cards: [
            { id: 'big', place: 10000, digit: 1 },
            { id: 'c1', place: 1, digit: 3 },
          ],
          x: 0,
          y: 0,
          mode: 'stack',
          z: 1,
        },
      ],
    });
    expect(board[0].cards).toEqual([{ id: 'c1', place: 1, digit: 3 }]);
  });
});

describe('sums', () => {
  const ids = new Set(['a', 'b', 'c']);

  it('round-trips a plus with the numbers attached to it', () => {
    const stored = serializeBoard(
      [piece('a', [card(1, 4)], 0, 0), piece('b', [card(1, 8)], 0, 0)],
      [{ id: 'sum-1', x: 300.123, y: 200, left: 'a', right: 'b', revealed: { 1: '4+8' } }],
    );

    expect(deserializeSums(JSON.parse(JSON.stringify(stored)), ids)).toEqual([
      { id: 'sum-1', x: 300.12, y: 200, left: 'a', right: 'b', revealed: { 1: '4+8' } },
    ]);
  });

  it('empties a side whose number no longer exists or is already attached elsewhere', () => {
    const sums = deserializeSums(
      {
        sums: [
          { id: 's1', x: 0, y: 0, left: 'gone', right: 'a', revealed: {} },
          { id: 's2', x: 0, y: 0, left: 'a', right: 'b', revealed: { 7: 'x', 10: 3 } },
        ],
      },
      ids,
    );

    expect(sums.map((sum) => [sum.left, sum.right])).toEqual([
      [null, 'a'],
      [null, 'b'],
    ]);
    expect(sums[1].revealed).toEqual({});
  });

  it('round-trips a revealed total and drops one that is not text', () => {
    const stored = serializeBoard(
      [piece('a', [card(1, 4)], 0, 0), piece('b', [card(1, 8)], 0, 0)],
      [{ id: 's', x: 0, y: 0, left: 'a', right: 'b', revealed: {}, totalRevealed: '4+8' }],
    );
    expect(deserializeSums(JSON.parse(JSON.stringify(stored)), ids)[0].totalRevealed).toBe('4+8');

    const [bad] = deserializeSums(
      { sums: [{ id: 's', x: 0, y: 0, left: 'a', right: 'b', revealed: {}, totalRevealed: 12 }] },
      ids,
    );
    expect(bad.totalRevealed).toBeUndefined();
  });

  it('round-trips a collapsed sum', () => {
    const stored = serializeBoard(
      [piece('a', [card(1, 4)], 0, 0), piece('b', [card(1, 8)], 0, 0)],
      [{ id: 's', x: 0, y: 0, left: 'a', right: 'b', revealed: {}, collapsed: true }],
    );
    expect(deserializeSums(JSON.parse(JSON.stringify(stored)), ids)[0].collapsed).toBe(true);
  });

  it('treats a board saved before sums existed as having none', () => {
    expect(deserializeSums({ version: BOARD_VERSION, pieces: [] }, ids)).toEqual([]);
    expect(deserializeSums({ sums: [{ id: '' }, null, 'x'] }, ids)).toEqual([]);
  });
});

describe('storage round-trips', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    flushBoard();
  });

  function stubStorage(): Map<string, string> {
    const store = new Map<string, string>();
    const fake = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    vi.stubGlobal('localStorage', fake);
    return store;
  }

  it('writes the debounced board and reads it back', () => {
    const store = stubStorage();
    const board = [piece('piece-a', [card(1, 9)], 24, 96)];

    saveBoardLater(serializeBoard(board));
    flushBoard();
    expect(store.get(BOARD_KEY)).toContain('piece-a');

    const restored = loadBoard();
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ id: 'piece-a', x: 24, y: 96 });
  });

  it('coalesces rapid saves into the latest board', () => {
    const store = stubStorage();

    saveBoardLater(serializeBoard([piece('first', [card(1, 1)], 0, 0)]));
    saveBoardLater(serializeBoard([piece('second', [card(10, 1)], 48, 0)]));
    flushBoard();

    expect(store.get(BOARD_KEY)).toContain('second');
    expect(loadBoard().map((entry) => entry.id)).toEqual(['second']);
  });

  it('treats corrupt storage like a fresh board and handles an explicit empty board', () => {
    stubStorage();

    saveBoard(serializeBoard([]));
    expect(loadBoard()).toEqual([]);

    localStorage.setItem(BOARD_KEY, '{not json');
    expect(loadBoard()).toEqual([]);

    localStorage.setItem(BOARD_KEY, '["also wrong"]');
    expect(loadBoard()).toEqual([]);
  });

  it('returns an empty board when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadBoard()).toEqual([]);
  });
});
