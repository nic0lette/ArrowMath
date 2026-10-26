import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BOARD_KEY,
  LESSON_KEY,
  LESSON_VERSION,
  deserializeLesson,
  flushLesson,
  loadLesson,
  saveLessonLater,
  serializeLesson,
  type Lesson,
} from '../../src/lib/boardStorage';
import { sortCards, type Piece, type Place } from '../../src/lib/geometry';

function piece(id: string, place: Place, digit: number, x = 0, y = 0): Piece {
  return {
    id,
    cards: sortCards([{ id: `${id}-card`, place, digit }]),
    x,
    y,
    mode: 'stack',
    z: 1,
    spring: 'default',
  };
}

function storedPiece(id: string, place: number, digit: number) {
  return { id, cards: [{ id: `${id}-card`, place, digit }], x: 10, y: 20, mode: 'stack', z: 1 };
}

function lesson(): Lesson {
  return {
    activeBoardId: 'board-b',
    boards: [
      {
        id: 'board-a',
        name: 'Warm-up',
        pieces: [piece('a1', 10, 4, 100, 50)],
        sums: [],
        start: null,
      },
      {
        id: 'board-b',
        name: 'Problem 2: carrying',
        pieces: [piece('b1', 1, 7), piece('b2', 1, 8)],
        sums: [{ id: 's1', x: 300, y: 200, left: 'b1', right: 'b2', revealed: { 1: '7+8' } }],
        start: {
          pieces: [piece('b1', 1, 7), piece('b2', 1, 8)],
          sums: [{ id: 's1', x: 300, y: 200, left: 'b1', right: 'b2', revealed: {} }],
        },
      },
    ],
  };
}

describe('serializeLesson', () => {
  it('round-trips named boards, the active board and each saved start', () => {
    const stored = serializeLesson(lesson());
    expect(stored.version).toBe(LESSON_VERSION);

    const restored = deserializeLesson(JSON.parse(JSON.stringify(stored)));
    expect(restored.activeBoardId).toBe('board-b');
    expect(restored.boards.map((board) => [board.id, board.name])).toEqual([
      ['board-a', 'Warm-up'],
      ['board-b', 'Problem 2: carrying'],
    ]);
    expect(restored.boards[0].pieces[0]).toMatchObject({ id: 'a1', x: 100, y: 50 });
    expect(restored.boards[0].start).toBeNull();
    expect(restored.boards[1].sums[0]).toMatchObject({ left: 'b1', right: 'b2', revealed: { 1: '7+8' } });
    expect(restored.boards[1].start?.pieces.map((entry) => entry.id)).toEqual(['b1', 'b2']);
    expect(restored.boards[1].start?.sums[0]).toMatchObject({ left: 'b1', right: 'b2', revealed: {} });
  });

  it('leaves out a start that was never saved, but keeps a saved empty one', () => {
    const stored = serializeLesson({
      activeBoardId: 'a',
      boards: [
        { id: 'a', name: 'Never saved', pieces: [], sums: [], start: null },
        { id: 'b', name: 'Saved empty', pieces: [], sums: [], start: { pieces: [], sums: [] } },
      ],
    });

    expect('start' in stored.boards[0]).toBe(false);
    expect(deserializeLesson(stored).boards[1].start).toEqual({ pieces: [], sums: [] });
  });
});

describe('deserializeLesson', () => {
  it('starts a fresh lesson with one empty board for anything unreadable', () => {
    for (const raw of [null, 'nope', 42, [], {}, { boards: 'all' }, { boards: [] }]) {
      const fresh = deserializeLesson(raw);
      expect(fresh.boards).toHaveLength(1);
      expect(fresh.boards[0]).toMatchObject({ name: 'Board 1', pieces: [], sums: [], start: null });
      expect(fresh.activeBoardId).toBe(fresh.boards[0].id);
    }
  });

  it('moves a board saved before lessons existed into the first board', () => {
    const migrated = deserializeLesson({
      version: 1,
      pieces: [storedPiece('old', 100, 3)],
      sums: [{ id: 's', x: 0, y: 0, left: 'old', right: null, revealed: {} }],
    });

    expect(migrated.boards).toHaveLength(1);
    expect(migrated.boards[0]).toMatchObject({ name: 'Board 1', start: null });
    expect(migrated.boards[0].pieces.map((entry) => entry.id)).toEqual(['old']);
    expect(migrated.boards[0].sums[0].left).toBe('old');
    expect(migrated.activeBoardId).toBe(migrated.boards[0].id);
  });

  it('drops boards without an id or with a repeated one, and names unnamed boards', () => {
    const restored = deserializeLesson({
      version: LESSON_VERSION,
      activeBoardId: 'a',
      boards: [
        { id: 'a', name: 'First', pieces: [], sums: [] },
        { id: 'a', name: 'Copy with the same id', pieces: [], sums: [] },
        { id: '', name: 'No id', pieces: [], sums: [] },
        { name: 'Missing id', pieces: [] },
        null,
        { id: 'b', name: '   ', pieces: [storedPiece('p', 1, 2)] },
        { id: 'c', name: 42 },
      ],
    });

    expect(restored.boards.map((board) => [board.id, board.name])).toEqual([
      ['a', 'First'],
      ['b', 'Board 2'],
      ['c', 'Board 3'],
    ]);
    expect(restored.boards[1].pieces.map((entry) => entry.id)).toEqual(['p']);
    expect(restored.boards[2].pieces).toEqual([]);
  });

  it('trims names and caps their length', () => {
    const restored = deserializeLesson({
      boards: [{ id: 'a', name: `  ${'x'.repeat(200)}  `, pieces: [] }],
    });
    expect(restored.boards[0].name).toBe('x'.repeat(60));
  });

  it('falls back to the first board when the active one is missing', () => {
    const restored = deserializeLesson({
      activeBoardId: 'gone',
      boards: [
        { id: 'a', name: 'A', pieces: [] },
        { id: 'b', name: 'B', pieces: [] },
      ],
    });
    expect(restored.activeBoardId).toBe('a');
  });

  it('validates a saved start like a board and links its sums to its own pieces', () => {
    const restored = deserializeLesson({
      boards: [
        {
          id: 'a',
          name: 'A',
          pieces: [storedPiece('live', 1, 1)],
          start: {
            pieces: [storedPiece('start', 10, 2), storedPiece('bad', 50, 2)],
            sums: [{ id: 's', x: 0, y: 0, left: 'live', right: 'start', revealed: {} }],
          },
        },
        { id: 'b', name: 'B', pieces: [], start: 'not a board' },
      ],
    });

    expect(restored.boards[0].start?.pieces.map((entry) => entry.id)).toEqual(['start']);
    expect(restored.boards[0].start?.sums[0]).toMatchObject({ left: null, right: 'start' });
    expect(restored.boards[1].start).toBeNull();
  });
});

describe('lesson storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    flushLesson();
  });

  function stubStorage(): Map<string, string> {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    return store;
  }

  it('writes the debounced lesson and reads it back', () => {
    const store = stubStorage();

    saveLessonLater(serializeLesson(lesson()));
    flushLesson();
    expect(store.get(LESSON_KEY)).toContain('Problem 2: carrying');

    const restored = loadLesson();
    expect(restored.boards.map((board) => board.name)).toEqual(['Warm-up', 'Problem 2: carrying']);
  });

  it('migrates a board saved before lessons existed and leaves the old save in place', () => {
    const store = stubStorage();
    const old = JSON.stringify({ version: 1, pieces: [storedPiece('old', 1, 9)] });
    store.set(BOARD_KEY, old);

    const migrated = loadLesson();
    expect(migrated.boards[0].pieces.map((entry) => entry.id)).toEqual(['old']);
    // An older version of the app opened in another tab can still read it.
    expect(store.get(BOARD_KEY)).toBe(old);
  });

  it('prefers the lesson over an old board save once one exists', () => {
    const store = stubStorage();
    store.set(BOARD_KEY, JSON.stringify({ version: 1, pieces: [storedPiece('old', 1, 9)] }));
    store.set(LESSON_KEY, JSON.stringify(serializeLesson(lesson())));

    expect(loadLesson().boards).toHaveLength(2);
  });

  it('does not bring back an old board save when the lesson is corrupt', () => {
    const store = stubStorage();
    store.set(BOARD_KEY, JSON.stringify({ version: 1, pieces: [storedPiece('old', 1, 9)] }));
    store.set(LESSON_KEY, '{not json');

    const fresh = loadLesson();
    expect(fresh.boards).toHaveLength(1);
    expect(fresh.boards[0].pieces).toEqual([]);
  });

  it('starts a fresh lesson when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadLesson().boards).toHaveLength(1);
  });
});
