import { sortCards, type Card, type Piece, type PieceMode, type Place } from './geometry';

/**
 * The board (pieces) persists to localStorage so a lesson survives a page
 * refresh. Preferences live under `arrow-math:preferences` in state.svelte.ts;
 * this module owns `arrow-math:workbench`. Everything here is pure data with no
 * runes, so it stays unit-testable.
 */

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

export interface StoredBoard {
  version: number;
  pieces: StoredPiece[];
}

const PLACES: Place[] = [1000, 100, 10, 1];
const SAVE_DELAY = 300;

function isPlace(value: unknown): value is Place {
  return PLACES.includes(value as Place);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Pushes the current board into storage as `{ version, pieces }`. */
export function serializeBoard(pieces: Piece[]): StoredBoard {
  return {
    version: BOARD_VERSION,
    pieces: pieces.map((piece) => ({
      id: piece.id,
      cards: piece.cards.map((card) => ({ id: card.id, place: card.place, digit: card.digit })),
      x: Math.round(piece.x * 100) / 100,
      y: Math.round(piece.y * 100) / 100,
      mode: piece.mode,
      z: piece.z,
    })),
  };
}

function parseCard(input: unknown): Card | null {
  if (!input || typeof input !== 'object') return null;
  const { id, place, digit } = input as StoredCard;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isPlace(place)) return null;
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return null;
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

export function loadBoard(): Piece[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(BOARD_KEY);
    if (!raw) return [];
    return deserializeBoard(JSON.parse(raw));
  } catch {
    // Corrupt or inaccessible storage behaves like a fresh workbench.
    return [];
  }
}

export function saveBoard(board: StoredBoard): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(BOARD_KEY, JSON.stringify(board));
  } catch {
    // A nicety, like preferences; private browsing can reject storage.
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBoard: StoredBoard | null = null;

export function saveBoardLater(board: StoredBoard): void {
  // Rapid moves coalesce into one write; drag frames never thrash storage.
  pendingBoard = board;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const boardToWrite = pendingBoard;
    pendingBoard = null;
    if (boardToWrite) saveBoard(boardToWrite);
  }, SAVE_DELAY);
}

/** Writes any pending board immediately (used when the page goes away). */
export function flushBoard(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingBoard) {
    saveBoard(pendingBoard);
    pendingBoard = null;
  }
}
