import type { Sum } from './addition';
import { sortCards, type Card, type Piece, type PieceMode, type Place } from './geometry';

/**
 * The lesson (every board, each with its pieces and sums) persists to
 * localStorage so it survives a page refresh. Preferences live under
 * `arrow-math:preferences` in state.svelte.ts; this module owns
 * `arrow-math:lesson`, and reads the older single-board `arrow-math:workbench`
 * once to migrate it. Everything here is pure data with no runes, so it stays
 * unit-testable.
 *
 * The keys keep the app's old name, Arrow Math, on purpose: renaming them
 * would lose every board and setting already saved on a device.
 */

export const LESSON_KEY = 'arrow-math:lesson';
export const LESSON_VERSION = 2;
/** Where a single board was saved before lessons existed. */
export const BOARD_KEY = 'arrow-math:workbench';
export const BOARD_VERSION = 1;

interface StoredCard {
  id: string;
  place: number;
  digit: number;
}

interface StoredPiece {
  id: string;
  cards: StoredCard[];
  x: number;
  y: number;
  mode: string;
  z: number;
}

interface StoredSum {
  id: string;
  x: number;
  y: number;
  left: string | null;
  right: string | null;
  revealed: Record<string, string>;
  totalRevealed?: string;
  collapsed?: boolean;
}

export interface StoredBoard {
  pieces: StoredPiece[];
  /** Added after version 1 shipped; older boards simply have no sums. */
  sums?: StoredSum[];
}

interface StoredLessonBoard extends StoredBoard {
  id: string;
  name: string;
  /** The layout the teacher saved; absent until they save one. */
  start?: StoredBoard;
}

export interface StoredLesson {
  version: number;
  activeBoardId: string;
  boards: StoredLessonBoard[];
}

export interface BoardState {
  pieces: Piece[];
  sums: Sum[];
}

export interface LessonBoard extends BoardState {
  id: string;
  name: string;
  /** The layout Reset brings back, or null if the teacher never saved one. */
  start: BoardState | null;
}

export interface Lesson {
  boards: LessonBoard[];
  activeBoardId: string;
}

export const MAX_BOARD_NAME = 60;

export function defaultBoardName(index: number): string {
  return `Board ${index + 1}`;
}

const PLACES: Place[] = [1000, 100, 10, 1];
const SAVE_DELAY = 300;

function isPlace(value: unknown): value is Place {
  return PLACES.includes(value as Place);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Turns one board into plain `{ pieces, sums }` data for storage. */
export function serializeBoard(pieces: Piece[], sums: Sum[] = []): StoredBoard {
  return {
    pieces: pieces.map((piece) => ({
      id: piece.id,
      cards: piece.cards.map((card) => ({ id: card.id, place: card.place, digit: card.digit })),
      x: round(piece.x),
      y: round(piece.y),
      mode: piece.mode,
      z: piece.z,
    })),
    sums: sums.map((sum) => ({
      id: sum.id,
      x: round(sum.x),
      y: round(sum.y),
      left: sum.left,
      right: sum.right,
      revealed: { ...sum.revealed },
      ...(sum.totalRevealed ? { totalRevealed: sum.totalRevealed } : {}),
      ...(sum.collapsed ? { collapsed: true } : {}),
    })),
  };
}

function parseCard(input: unknown): Card | null {
  if (!input || typeof input !== 'object') return null;
  const { id, place, digit } = input as StoredCard;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isPlace(place)) return null;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return null;
  return { id, place, digit };
}

function parsePiece(input: unknown): Piece | null {
  if (!input || typeof input !== 'object') return null;
  const { id, cards, x, y, mode, z } = input as StoredPiece;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!Array.isArray(cards) || cards.length === 0) return null;

  const parsedCards = cards.map(parseCard) as Array<Card | null>;
  // A piece cannot hold two cards of the same place, so corrupted duplicates
  // collapse to the first-wins letter of each place.
  const seen = new Set<Place>();
  const uniqueCards: Card[] = [];
  for (const card of parsedCards) {
    if (!card || seen.has(card.place)) continue;
    seen.add(card.place);
    uniqueCards.push(card);
  }
  if (uniqueCards.length === 0) return null;

  return {
    id,
    cards: sortCards(uniqueCards),
    x: isFiniteNumber(x) ? x : 0,
    y: isFiniteNumber(y) ? y : 0,
    mode: mode === 'expand' ? 'expand' : 'stack',
    z: isFiniteNumber(z) && z >= 0 ? z : 1,
    spring: 'default',
  };
}

/** Accepts unknown data from storage and rebuilds anything that is safe. */
export function deserializeBoard(raw: unknown): Piece[] {
  if (!raw || typeof raw !== 'object') return [];
  const { pieces } = raw as { pieces?: unknown };
  if (!Array.isArray(pieces)) return [];

  const result: Piece[] = [];
  for (const entry of pieces) {
    const piece = parsePiece(entry);
    if (piece) result.push(piece);
  }
  return result;
}

function parseSum(input: unknown, pieceIds: Set<string>, attached: Set<string>): Sum | null {
  if (!input || typeof input !== 'object') return null;
  const { id, x, y, left, right, revealed, totalRevealed, collapsed } = input as StoredSum;
  if (typeof id !== 'string' || id.length === 0) return null;

  // A side points at a piece that must exist and sit on only one plus.
  const side = (value: unknown): string | null => {
    if (typeof value !== 'string' || !pieceIds.has(value) || attached.has(value)) return null;
    attached.add(value);
    return value;
  };

  const parsedRevealed: Sum['revealed'] = {};
  if (revealed && typeof revealed === 'object') {
    for (const [key, value] of Object.entries(revealed)) {
      const place = Number(key);
      if (isPlace(place) && typeof value === 'string') parsedRevealed[place] = value;
    }
  }

  return {
    id,
    x: isFiniteNumber(x) ? x : 0,
    y: isFiniteNumber(y) ? y : 0,
    left: side(left),
    right: side(right),
    revealed: parsedRevealed,
    ...(typeof totalRevealed === 'string' ? { totalRevealed } : {}),
    ...(collapsed === true ? { collapsed } : {}),
  };
}

/** Rebuilds the board's sums, keeping only links to pieces that loaded. */
export function deserializeSums(raw: unknown, pieceIds: Set<string>): Sum[] {
  if (!raw || typeof raw !== 'object') return [];
  const { sums } = raw as { sums?: unknown };
  if (!Array.isArray(sums)) return [];

  const attached = new Set<string>();
  const result: Sum[] = [];
  for (const entry of sums) {
    const sum = parseSum(entry, pieceIds, attached);
    if (sum) result.push(sum);
  }
  return result;
}

export function serializeLesson(lesson: Lesson): StoredLesson {
  return {
    version: LESSON_VERSION,
    activeBoardId: lesson.activeBoardId,
    boards: lesson.boards.map((board) => ({
      id: board.id,
      name: board.name,
      ...serializeBoard(board.pieces, board.sums),
      ...(board.start ? { start: serializeBoard(board.start.pieces, board.start.sums) } : {}),
    })),
  };
}

function parseBoardState(raw: unknown): BoardState {
  const pieces = deserializeBoard(raw);
  return { pieces, sums: deserializeSums(raw, new Set(pieces.map((piece) => piece.id))) };
}

function parseName(value: unknown, index: number): string {
  const name = typeof value === 'string' ? value.trim().slice(0, MAX_BOARD_NAME) : '';
  return name || defaultBoardName(index);
}

function freshLesson(): Lesson {
  return {
    activeBoardId: 'board-1',
    boards: [{ id: 'board-1', name: defaultBoardName(0), pieces: [], sums: [], start: null }],
  };
}

/**
 * Accepts unknown data from storage and rebuilds a lesson with at least one
 * board. A single board saved before lessons existed becomes the first board.
 */
export function deserializeLesson(raw: unknown): Lesson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return freshLesson();
  const { boards, activeBoardId, pieces } = raw as {
    boards?: unknown;
    activeBoardId?: unknown;
    pieces?: unknown;
  };

  if (!Array.isArray(boards)) {
    if (!Array.isArray(pieces)) return freshLesson();
    const lesson = freshLesson();
    Object.assign(lesson.boards[0], parseBoardState(raw));
    return lesson;
  }

  const result: LessonBoard[] = [];
  const seen = new Set<string>();
  for (const entry of boards) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, name, start } = entry as Partial<StoredLessonBoard>;
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      name: parseName(name, result.length),
      ...parseBoardState(entry),
      start: start && typeof start === 'object' ? parseBoardState(start) : null,
    });
  }
  if (result.length === 0) return freshLesson();

  const active = result.find((board) => board.id === activeBoardId) ?? result[0];
  return { boards: result, activeBoardId: active.id };
}

function readStored(): unknown {
  if (typeof localStorage === 'undefined') return null;
  const lesson = localStorage.getItem(LESSON_KEY);
  // Once a lesson is saved the old board is never read again, so a corrupt
  // lesson cannot bring back a stale board from before the migration.
  if (lesson !== null) return JSON.parse(lesson);
  const board = localStorage.getItem(BOARD_KEY);
  return board ? JSON.parse(board) : null;
}

export function loadLesson(): Lesson {
  try {
    return deserializeLesson(readStored());
  } catch {
    // Corrupt or inaccessible storage behaves like a fresh workbench.
    return freshLesson();
  }
}

export function saveLesson(lesson: StoredLesson): void {
  try {
    if (typeof localStorage === 'undefined') return;
    // The old board key is left alone, so an older copy of the app still opens.
    localStorage.setItem(LESSON_KEY, JSON.stringify(lesson));
  } catch {
    // A nicety, like preferences; private browsing can reject storage.
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingLesson: StoredLesson | null = null;

export function saveLessonLater(lesson: StoredLesson): void {
  // Rapid moves coalesce into one write; drag frames never thrash storage.
  pendingLesson = lesson;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const lessonToWrite = pendingLesson;
    pendingLesson = null;
    if (lessonToWrite) saveLesson(lessonToWrite);
  }, SAVE_DELAY);
}

/** Writes any pending lesson immediately (used when the page goes away). */
export function flushLesson(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingLesson) {
    saveLesson(pendingLesson);
    pendingLesson = null;
  }
}
