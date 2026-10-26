import type { Sum } from './addition';
import { MAX_BOARD_NAME, defaultBoardName, type BoardState, type Lesson, type LessonBoard } from './boardStorage';
import type { Piece } from './geometry';

/**
 * The lesson's boards as pure data: adding, copying, renaming, removing and
 * stepping between them. Each operation returns a new lesson (or the same one
 * when nothing changes), so the store only has to swap the live board in and
 * out, and everything here stays unit-testable.
 */

export function clonePieces(pieces: Piece[]): Piece[] {
  return pieces.map((piece) => ({
    ...piece,
    cards: piece.cards.map((card) => ({ ...card })),
  }));
}

export function cloneSums(sums: Sum[]): Sum[] {
  return sums.map((sum) => ({ ...sum, revealed: { ...sum.revealed } }));
}

export function cloneBoardState(state: BoardState): BoardState {
  return { pieces: clonePieces(state.pieces), sums: cloneSums(state.sums) };
}

function cleanName(name: string): string {
  return name.trim().slice(0, MAX_BOARD_NAME);
}

function nextBoardName(lesson: Lesson): string {
  const taken = new Set(lesson.boards.map((board) => board.name));
  let index = lesson.boards.length;
  while (taken.has(defaultBoardName(index))) index += 1;
  return defaultBoardName(index);
}

function insertAfter(lesson: Lesson, afterId: string, board: LessonBoard): Lesson {
  const index = lesson.boards.findIndex((entry) => entry.id === afterId);
  const boards = [...lesson.boards];
  boards.splice(index + 1, 0, board);
  return { boards, activeBoardId: board.id };
}

/** Adds an empty board after the active one and opens it. */
export function addBoard(lesson: Lesson, id: string): Lesson {
  const board: LessonBoard = { id, name: nextBoardName(lesson), pieces: [], sums: [], start: null };
  return insertAfter(lesson, lesson.activeBoardId, board);
}

/** Copies a board, saved start included, right after it and opens the copy. */
export function duplicateBoard(lesson: Lesson, sourceId: string, id: string): Lesson {
  const source = lesson.boards.find((board) => board.id === sourceId);
  if (!source) return lesson;
  const suffix = ' copy';
  const name = cleanName(source.name.slice(0, MAX_BOARD_NAME - suffix.length) + suffix);
  return insertAfter(lesson, sourceId, {
    id,
    name,
    ...cloneBoardState(source),
    start: source.start ? cloneBoardState(source.start) : null,
  });
}

export function renameBoard(lesson: Lesson, id: string, name: string): Lesson {
  const cleaned = cleanName(name);
  if (!cleaned) return lesson;
  return {
    ...lesson,
    boards: lesson.boards.map((board) => (board.id === id ? { ...board, name: cleaned } : board)),
  };
}

/** Removes a board, keeping at least one. Losing the active board opens its neighbour. */
export function removeBoard(lesson: Lesson, id: string): Lesson {
  const index = lesson.boards.findIndex((board) => board.id === id);
  if (index === -1 || lesson.boards.length === 1) return lesson;
  const boards = lesson.boards.filter((board) => board.id !== id);
  const activeBoardId =
    lesson.activeBoardId === id ? boards[Math.min(index, boards.length - 1)].id : lesson.activeBoardId;
  return { boards, activeBoardId };
}

/** The board `delta` places from the active one, or null past either end. */
export function neighbourBoardId(lesson: Lesson, delta: number): string | null {
  const index = lesson.boards.findIndex((board) => board.id === lesson.activeBoardId);
  return lesson.boards[index + delta]?.id ?? null;
}
