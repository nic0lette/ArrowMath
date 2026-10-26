import { describe, expect, it } from 'vitest';
import type { Lesson, LessonBoard } from '../../src/lib/boardStorage';
import {
  addBoard,
  duplicateBoard,
  neighbourBoardId,
  removeBoard,
  renameBoard,
  sameBoard,
  setStart,
} from '../../src/lib/lesson';
import type { Piece } from '../../src/lib/geometry';

function piece(id: string): Piece {
  return { id, cards: [{ id: `${id}-card`, place: 1, digit: 3 }], x: 10, y: 20, mode: 'stack', z: 1, spring: 'default' };
}

function board(id: string, name = id, extra: Partial<LessonBoard> = {}): LessonBoard {
  return { id, name, pieces: [], sums: [], start: null, ...extra };
}

function lesson(active: string, ...boards: LessonBoard[]): Lesson {
  return { activeBoardId: active, boards };
}

const ids = (value: Lesson) => value.boards.map((entry) => entry.id);
const names = (value: Lesson) => value.boards.map((entry) => entry.name);

describe('addBoard', () => {
  it('puts an empty board after the active one and makes it active', () => {
    const before = lesson('a', board('a', 'Board 1'), board('b', 'Board 2'));
    const after = addBoard(before, 'new');

    expect(ids(after)).toEqual(['a', 'new', 'b']);
    expect(after.activeBoardId).toBe('new');
    expect(after.boards[1]).toEqual({ id: 'new', name: 'Board 3', pieces: [], sums: [], start: null });
    expect(ids(before)).toEqual(['a', 'b']);
  });

  it('picks a number no other board is already called', () => {
    const after = addBoard(lesson('a', board('a', 'Board 1'), board('b', 'Board 3')), 'new');
    expect(after.boards[1].name).toBe('Board 4');
  });
});

describe('duplicateBoard', () => {
  it('copies the pieces, sums and start right after the original, and opens the copy', () => {
    const original = board('a', 'Carrying', {
      pieces: [piece('p')],
      sums: [{ id: 's', x: 0, y: 0, left: 'p', right: null, revealed: { 1: 'x' } }],
      start: { pieces: [piece('p')], sums: [] },
    });
    const before = lesson('b', original, board('b'));
    const after = duplicateBoard(before, 'a', 'copy');

    expect(ids(after)).toEqual(['a', 'copy', 'b']);
    expect(after.activeBoardId).toBe('copy');
    const copy = after.boards[1];
    expect(copy.name).toBe('Carrying copy');
    expect(copy.pieces).toEqual(original.pieces);
    expect(copy.sums).toEqual(original.sums);
    expect(copy.start).toEqual(original.start);

    // The copy can change without touching the original.
    copy.pieces[0].x = 999;
    copy.pieces[0].cards[0].digit = 9;
    copy.sums[0].revealed[1] = 'changed';
    copy.start!.pieces[0].x = 999;
    expect(original.pieces[0]).toMatchObject({ x: 10 });
    expect(original.pieces[0].cards[0].digit).toBe(3);
    expect(original.sums[0].revealed[1]).toBe('x');
    expect(original.start!.pieces[0].x).toBe(10);
  });

  it('keeps a long name within the limit', () => {
    const after = duplicateBoard(lesson('a', board('a', 'x'.repeat(60))), 'a', 'copy');
    expect(after.boards[1].name).toHaveLength(60);
    expect(after.boards[1].name.endsWith(' copy')).toBe(true);
  });

  it('ignores a board that does not exist', () => {
    const before = lesson('a', board('a'));
    expect(duplicateBoard(before, 'gone', 'copy')).toBe(before);
  });
});

describe('renameBoard', () => {
  it('trims the new name and caps its length', () => {
    const after = renameBoard(lesson('a', board('a'), board('b')), 'b', `  ${'y'.repeat(80)} `);
    expect(names(after)).toEqual(['a', 'y'.repeat(60)]);
  });

  it('keeps the old name when the new one is blank', () => {
    const before = lesson('a', board('a', 'Warm-up'));
    expect(renameBoard(before, 'a', '   ')).toBe(before);
  });
});

describe('removeBoard', () => {
  it('opens the next board when the active one goes, or the previous one at the end', () => {
    const three = lesson('b', board('a'), board('b'), board('c'));

    const middle = removeBoard(three, 'b');
    expect(ids(middle)).toEqual(['a', 'c']);
    expect(middle.activeBoardId).toBe('c');

    const last = removeBoard({ ...three, activeBoardId: 'c' }, 'c');
    expect(last.activeBoardId).toBe('b');
  });

  it('keeps the active board when another one goes', () => {
    const after = removeBoard(lesson('a', board('a'), board('b')), 'b');
    expect(ids(after)).toEqual(['a']);
    expect(after.activeBoardId).toBe('a');
  });

  it('never removes the only board', () => {
    const before = lesson('a', board('a'));
    expect(removeBoard(before, 'a')).toBe(before);
  });
});

describe('neighbourBoardId', () => {
  const three = lesson('b', board('a'), board('b'), board('c'));

  it('steps forwards and backwards from the active board', () => {
    expect(neighbourBoardId(three, 1)).toBe('c');
    expect(neighbourBoardId(three, -1)).toBe('a');
  });

  it('stops at either end instead of wrapping around', () => {
    expect(neighbourBoardId({ ...three, activeBoardId: 'c' }, 1)).toBeNull();
    expect(neighbourBoardId({ ...three, activeBoardId: 'a' }, -1)).toBeNull();
  });
});

describe('setStart', () => {
  it('saves a copy of the layout as the board\'s start, separate from the live board', () => {
    const live = { pieces: [piece('p')], sums: [] };
    const after = setStart(lesson('a', board('a'), board('b')), 'a', live);

    expect(after.boards[0].start).toEqual(live);
    live.pieces[0].x = 999;
    expect(after.boards[0].start!.pieces[0].x).toBe(10);
    expect(after.boards[1].start).toBeNull();
  });

  it('forgets a saved start', () => {
    const saved = lesson('a', board('a', 'a', { start: { pieces: [], sums: [] } }));
    expect(setStart(saved, 'a', null).boards[0].start).toBeNull();
  });
});

describe('sameBoard', () => {
  const sum = { id: 's', x: 0, y: 0, left: 'p', right: null, revealed: {} };

  it('matches a copy of the same layout', () => {
    const state = { pieces: [piece('p'), piece('q')], sums: [sum] };
    expect(sameBoard(state, { pieces: [piece('p'), piece('q')], sums: [{ ...sum }] })).toBe(true);
  });

  it('ignores which piece is on top, the order they were added and sub-pixel drift', () => {
    const p = piece('p');
    const q = { ...piece('q'), z: 4 };
    const moved = { ...p, x: p.x + 0.001, z: 9 };
    expect(sameBoard({ pieces: [p, q], sums: [] }, { pieces: [q, moved], sums: [] })).toBe(true);
  });

  it('notices a moved, changed, added or removed piece', () => {
    const start = { pieces: [piece('p')], sums: [] };
    expect(sameBoard(start, { pieces: [{ ...piece('p'), x: 40 }], sums: [] })).toBe(false);
    expect(sameBoard(start, { pieces: [{ ...piece('p'), mode: 'expand' }], sums: [] })).toBe(false);
    const changed = piece('p');
    changed.cards[0].digit = 4;
    expect(sameBoard(start, { pieces: [changed], sums: [] })).toBe(false);
    expect(sameBoard(start, { pieces: [piece('p'), piece('q')], sums: [] })).toBe(false);
    expect(sameBoard(start, { pieces: [], sums: [] })).toBe(false);
  });

  it('notices a revealed answer or a moved plus', () => {
    const start = { pieces: [piece('p')], sums: [sum] };
    expect(sameBoard(start, { pieces: [piece('p')], sums: [{ ...sum, revealed: { 1: '3' } }] })).toBe(false);
    expect(sameBoard(start, { pieces: [piece('p')], sums: [{ ...sum, totalRevealed: '3' }] })).toBe(false);
    expect(sameBoard(start, { pieces: [piece('p')], sums: [{ ...sum, x: 48 }] })).toBe(false);
  });
});
