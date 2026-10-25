import { CARD_HEIGHT, getArrowCardWidth, type ColorTheme } from 'arrow-cards';
import { audio } from './audio';
import {
  deserializeBoard,
  flushBoard,
  loadBoard,
  saveBoardLater,
  serializeBoard,
} from './boardStorage';
import { freezeCardMotion } from './cardMotion';
import {
  CANVAS_PADDING,
  GRID_SIZE,
  RESULT_RESERVE,
  SPRING_BOUNCE,
  SPRING_DEFAULT,
  clamp,
  findBouncePosition,
  findDropCandidate,
  findFreeSpot,
  formatNumber,
  getMergedPosition,
  isPeelZone,
  layoutPiece,
  mergeCards,
  numberToCards,
  pieceBounds,
  pieceValue,
  pieceVisualBounds,
  pieceVisualWidth,
  placeTier,
  removeCardFromPiece,
  sharesPlace,
  snapToGrid,
  sortCards,
  type Bounds,
  type Card,
  type CanvasSize,
  type DropCandidate,
  type DropKind,
  type Piece,
  type PieceMode,
  type Place,
} from './geometry';

const PREFS_KEY = 'arrow-math:preferences';
/** Slightly larger than a normal drag threshold: peeling changes structure. */
const PEEL_THRESHOLD = 8;

type ToastTone = 'info' | 'success' | 'warning';

export interface HoverHalo {
  kind: DropKind;
  targetId: string;
  targetValue: number;
  bounds: Bounds;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  action?: () => void;
}

export type DragIntentKind = 'peel' | 'move';

export interface DragIntent {
  pieceId: string;
  cardId: string | null;
  kind: DragIntentKind;
}

interface DragState {
  pieceId: string;
  cardId: string | null;
  pointerId: number;
  startPointer: { x: number; y: number };
  startPiece: { x: number; y: number };
  moved: boolean;
  kind: DragIntentKind;
  peeled: boolean;
  fromChrome: boolean;
  doubleClick: boolean;
}

export interface BankDragState {
  card: { place: Place; digit: number };
  pointerId: number;
  startClientX: number;
  startClientY: number;
  ghostX: number;
  ghostY: number;
  ghostCanvasX: number;
  ghostCanvasY: number;
  active: boolean;
  overCanvas: boolean;
}

export interface BankCardSource {
  place: Place;
  digit: number;
}

interface Preferences {
  theme: ColorTheme;
  muted: boolean;
  snapToGrid: boolean;
  xray: boolean;
  bankOpen: boolean;
}

const THEME_KEYS: ColorTheme[] = ['curriculum', 'montessori', 'pastel', 'vibrant'];

function readPreferences(): Partial<Preferences> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object') return {};

    // Storage contents come from last year's browser. Anything that is not
    // exactly the expected type falls back to its default.
    const prefs: Partial<Preferences> = {};
    if (typeof raw.theme === 'string' && (THEME_KEYS as string[]).includes(raw.theme)) {
      prefs.theme = raw.theme as ColorTheme;
    }
    for (const key of ['muted', 'snapToGrid', 'xray', 'bankOpen'] as const) {
      if (typeof raw[key] === 'boolean') prefs[key] = raw[key];
    }
    return prefs;
  } catch {
    return {};
  }
}

function savePreferences(prefs: Preferences): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Preferences are a nicety; private browsing can reject storage.
  }
}

function makeId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

function clonePieces(pieces: Piece[]): Piece[] {
  return pieces.map((piece) => ({
    ...piece,
    cards: piece.cards.map((card) => ({ ...card })),
  }));
}

function makeCard(place: Place, digit: number): Card {
  return { id: makeId('card'), place, digit };
}

function makePiece(cards: Card[], x: number, y: number, mode: PieceMode, z: number): Piece {
  return {
    id: makeId('piece'),
    cards: sortCards(cards),
    x,
    y,
    mode,
    z,
    spring: 'default',
  };
}

function isPointInRect(x: number, y: number, rect: { left: number; top: number; width: number; height: number }): boolean {
  return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
}

/** One shared warning for bank drops and dragging into a taken column. */
function duplicatePlaceMessage(place: Place | null): string {
  const column = place ? placeTier(place) : 'place value';
  return `The ${column} column already has a card — same place values bounce apart. Pull the old card out from its digit end to change it.`;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, button, a, [contenteditable="true"], [role="dialog"] button, [role="dialog"] a',
    ),
  );
}

class ArrowMathStore {
  pieces = $state<Piece[]>([]);
  theme = $state<ColorTheme>('curriculum');
  muted = $state(false);
  snapToGrid = $state(true);
  xray = $state(false);
  bankOpen = $state(true);
  guideOpen = $state(false);
  bankDrag = $state<BankDragState | null>(null);
  hover = $state<HoverHalo | null>(null);
  intent = $state<DragIntent | null>(null);
  selectedId = $state<string | null>(null);
  hoveredId = $state<string | null>(null);
  toast = $state<Toast | null>(null);
  canvas = $state<CanvasSize>({ width: 1200, height: 560 });

  private drag = $state<DragState | null>(null);
  private lastPointerDown: { pieceId: string; time: number; x: number; y: number } | null = null;
  private intentRefreshToken = 0;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private canvasEl: HTMLElement | null = null;
  private canvasRect = { left: 0, top: 0, width: 1200, height: 560 };
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private toastDuration = 0;
  private toastShownAt = 0;
  private bounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private resetSnapshot: Piece[] | null = null;
  private lastCanvasWidth = 0;
  private lastCanvasHeight = 0;
  private pendingBoardClamp = false;
  private boardWatcherStop: (() => void) | null = null;

  constructor() {
    const prefs = readPreferences();
    if (prefs.theme) this.theme = prefs.theme;
    this.muted = prefs.muted ?? false;
    this.snapToGrid = prefs.snapToGrid ?? true;
    this.xray = prefs.xray ?? false;
    const roomyScreen =
      typeof window === 'undefined' || (window.innerWidth >= 760 && window.innerHeight >= 680);
    this.bankOpen = prefs.bankOpen ?? roomyScreen;
    audio.setMuted(this.muted);

    // A lesson continues after a refresh. Pieces load before any canvas is
    // measured; measureCanvas clamps them into whatever size it finds.
    const restored = loadBoard();
    if (restored.length > 0) {
      this.pieces = restored;
      this.pendingBoardClamp = true;
    }
    this.watchBoard();
  }

  get isInteracting(): boolean {
    return Boolean(this.drag || this.bankDrag?.active);
  }

  get selectedPiece(): Piece | null {
    if (!this.selectedId) return null;
    return this.pieces.find((piece) => piece.id === this.selectedId) ?? null;
  }

  get cardCount(): number {
    return this.pieces.reduce((total, piece) => total + piece.cards.length, 0);
  }

  get draggingPieceId(): string | null {
    if (!this.drag) return null;
    // A pending peel is still an aim gesture: keep the group calm and let the
    // card glow until the movement threshold actually pulls it out.
    if (this.drag.kind === 'peel' && !this.drag.peeled) return null;
    return this.drag.pieceId;
  }

  get draggingFromChrome(): boolean {
    return Boolean(this.drag?.fromChrome);
  }

  setIntent(intent: DragIntent | null): void {
    const current = this.intent;
    if (
      current === intent ||
      (current &&
        intent &&
        current.pieceId === intent.pieceId &&
        current.cardId === intent.cardId &&
        current.kind === intent.kind)
    ) {
      return;
    }
    this.intent = intent;
  }

  clearIntent(): void {
    this.intent = null;
  }

  clearIntentForCard(pieceId: string, cardId: string): void {
    if (this.intent?.pieceId === pieceId && this.intent.cardId === cardId) {
      this.intent = null;
    }
  }

  clearIntentForMoveHandle(pieceId: string): void {
    if (
      this.intent?.pieceId === pieceId &&
      this.intent.kind === 'move' &&
      this.intent.cardId === null
    ) {
      this.intent = null;
    }
  }

  /**
   * Recomputes the drag intent from the element under the pointer. A drop
   * clears the drag state, but the pointer can still be resting on the card or
   * number chip, so the glow should stay.
   */
  refreshIntentAt(clientX: number, clientY: number): void {
    if (this.drag || this.bankDrag || typeof document === 'undefined') return;

    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!element) {
      this.intent = null;
      return;
    }

    const chrome = element.closest<HTMLElement>('.piece-chrome');
    if (chrome) {
      const pieceId = chrome.dataset.pieceId;
      const piece = pieceId ? this.pieces.find((entry) => entry.id === pieceId) : null;
      this.intent =
        piece && piece.cards.length > 1
          ? { pieceId: piece.id, cardId: null, kind: 'move' }
          : null;
      return;
    }

    const cardElement = element.closest<HTMLElement>('.card-node');
    const pieceId = cardElement?.dataset.piece;
    const cardId = cardElement?.dataset.cardId;
    if (!cardElement || !pieceId || !cardId) {
      this.intent = null;
      return;
    }

    const piece = this.pieces.find((entry) => entry.id === pieceId);
    if (!piece || piece.cards.length < 2) {
      this.intent = null;
      return;
    }

    const kind: DragIntentKind =
      piece.mode === 'expand' || isPeelZone(clientX, cardElement.getBoundingClientRect().left)
        ? 'peel'
        : 'move';
    this.intent = { pieceId, cardId, kind };
  }

  private persist(): void {
    savePreferences({
      theme: this.theme,
      muted: this.muted,
      snapToGrid: this.snapToGrid,
      xray: this.xray,
      bankOpen: this.bankOpen,
    });
  }

  attachCanvas(element: HTMLElement): () => void {
    this.canvasEl = element;
    this.measureCanvas();

    const observer = new ResizeObserver(() => this.measureCanvas());
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (this.canvasEl === element) this.canvasEl = null;
    };
  }

  /**
   * Saves the board whenever any piece changes — a drag, snap, peel or remove.
   * The store lives outside component initialisation, so the root effect form
   * applies. Reading `pieces` here deep-tracks every card and coordinate, and a
   * module-level `pagehide` listener flushes the debounced write on close.
   */
  private watchBoard(): void {
    if (this.boardWatcherStop) return;
    this.boardWatcherStop = $effect.root(() => {
      $effect(() => {
        saveBoardLater(serializeBoard(this.pieces));
      });
    });
  }

  measureCanvas(): void {
    if (!this.canvasEl) return;

    // The card layer is the actual coordinate system for pieces. Measuring the
    // workbench's border box instead would add its 1px border to every synced
    // position, which makes a single card creep by 1px on each click.
    const layer = this.canvasEl.querySelector<HTMLElement>('.cards-layer');
    const rect = (layer ?? this.canvasEl).getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.canvasRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width !== this.canvas.width || height !== this.canvas.height) {
      this.canvas = { width, height };
    }

    if (this.pendingBoardClamp) {
      // A board restored from storage can be wider than the current canvas
      // (different screen, collapsed tray). Pull it inside exactly once.
      this.pendingBoardClamp = false;
      this.keepPiecesInView();
    }

    // Height matters as much as width: opening the card tray shortens the
    // workbench and would otherwise hide cards resting near the bottom.
    if (
      this.lastCanvasWidth > 0 &&
      (width !== this.lastCanvasWidth || height !== this.lastCanvasHeight)
    ) {
      this.keepPiecesInView();
    }
    this.lastCanvasWidth = width;
    this.lastCanvasHeight = height;
  }

  private keepPiecesInView(): void {
    for (const piece of this.pieces) {
      const bounds = pieceBounds(piece);
      const maxX = this.canvas.width - pieceVisualWidth(piece) - CANVAS_PADDING;
      const maxY = this.canvas.height - bounds.height - CANVAS_PADDING;
      piece.x = clamp(piece.x, CANVAS_PADDING, Math.max(CANVAS_PADDING, maxX));
      piece.y = clamp(piece.y, CANVAS_PADDING, Math.max(CANVAS_PADDING, maxY));
    }
  }

  private clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    return {
      x: clientX - this.canvasRect.left,
      y: clientY - this.canvasRect.top,
    };
  }

  private maxZ(): number {
    return this.pieces.reduce((max, piece) => Math.max(max, piece.z), 0);
  }

  bringToFront(piece: Piece): void {
    if (this.maxZ() > 300) {
      const ordered = [...this.pieces].sort((a, b) => a.z - b.z);
      ordered.forEach((entry, index) => {
        entry.z = index + 1;
      });
    }
    const top = this.maxZ();
    if (piece.z !== top) piece.z = top + 1;
  }

  private applySpring(piece: Piece, spring: 'default' | 'bounce'): void {
    const existing = this.bounceTimers.get(piece.id);
    if (existing) {
      clearTimeout(existing);
      this.bounceTimers.delete(piece.id);
    }
    piece.spring = spring;
    if (spring === 'bounce') {
      const timer = setTimeout(() => {
        piece.spring = 'default';
        this.bounceTimers.delete(piece.id);
      }, 1100);
      this.bounceTimers.set(piece.id, timer);
    }
  }

  // ---------------------------------------------------------------------------
  // Bank drag & add
  // ---------------------------------------------------------------------------

  beginBankDrag(event: PointerEvent, card: BankCardSource): void {
    if (this.drag || this.bankDrag) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.measureCanvas();

    const width = getArrowCardWidth(card.place);
    const rect = this.canvasRect;
    const ghostX = event.clientX - width / 2;
    const ghostY = event.clientY - CARD_HEIGHT / 2;

    this.bankDrag = {
      card: { place: card.place, digit: card.digit },
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      ghostX,
      ghostY,
      ghostCanvasX: ghostX - rect.left,
      ghostCanvasY: ghostY - rect.top,
      active: false,
      overCanvas: false,
    };
    this.hover = null;
    this.selectedId = null;
    this.hoveredId = null;
    this.intent = null;
    this.lastPointerDown = null;
    audio.pickup();
    event.preventDefault();
  }

  /**
   * Drops a pending bank drag without adding anything. Used when a touch that
   * started on a tray card turns out to be a row swipe rather than a pull.
   */
  cancelBankDrag(): void {
    if (!this.bankDrag) return;
    this.bankDrag = null;
    this.hover = null;
    this.intent = null;
    this.lastPointerDown = null;
  }

  private updateBankDrag(clientX: number, clientY: number): void {
    const drag = this.bankDrag;
    if (!drag) return;
    const distance = Math.hypot(clientX - drag.startClientX, clientY - drag.startClientY);
    if (!drag.active && distance < 5) return;

    drag.active = true;
    const width = getArrowCardWidth(drag.card.place);
    drag.ghostX = clientX - width / 2;
    drag.ghostY = clientY - CARD_HEIGHT / 2;
    drag.ghostCanvasX = drag.ghostX - this.canvasRect.left;
    drag.ghostCanvasY = drag.ghostY - this.canvasRect.top;

    const inside = isPointInRect(clientX, clientY, this.canvasRect);
    drag.overCanvas = inside;

    if (!inside) {
      this.hover = null;
      return;
    }

    const preview = makePiece(
      [{ id: 'preview', place: drag.card.place, digit: drag.card.digit }],
      clamp(drag.ghostCanvasX, CANVAS_PADDING, Math.max(CANVAS_PADDING, this.canvas.width - width - CANVAS_PADDING)),
      clamp(
        drag.ghostCanvasY,
        CANVAS_PADDING,
        Math.max(CANVAS_PADDING, this.canvas.height - CARD_HEIGHT - CANVAS_PADDING),
      ),
      'stack',
      9999,
    );
    const candidate = findDropCandidate(preview.cards, pieceBounds(preview), this.pieces);
    this.hover = this.haloFor(candidate);
  }

  addBankCard(card: BankCardSource): Piece {
    this.measureCanvas();
    const incoming = makeCard(card.place, card.digit);
    const layout = layoutPiece([incoming], 'stack');
    const spot = findFreeSpot({
      width: layout.width,
      height: CARD_HEIGHT,
      pieces: this.pieces,
      canvas: this.canvas,
    });
    const piece = makePiece([incoming], spot.x, spot.y, 'stack', this.maxZ() + 1);
    this.pieces.push(piece);
    this.selectedId = piece.id;
    this.hoveredId = piece.id;
    audio.add();
    return piece;
  }

  private dropBankCard(drag: BankDragState, clientX: number, clientY: number): void {
    if (!isPointInRect(clientX, clientY, this.canvasRect)) return;

    const incoming = makeCard(drag.card.place, drag.card.digit);
    const width = getArrowCardWidth(incoming.place);
    const canvasX = clamp(
      drag.ghostCanvasX,
      CANVAS_PADDING,
      Math.max(CANVAS_PADDING, this.canvas.width - width - CANVAS_PADDING),
    );
    const canvasY = clamp(
      drag.ghostCanvasY,
      CANVAS_PADDING,
      Math.max(CANVAS_PADDING, this.canvas.height - CARD_HEIGHT - CANVAS_PADDING),
    );

    const preview = makePiece([incoming], canvasX, canvasY, 'stack', this.maxZ() + 1);
    const candidate = findDropCandidate(preview.cards, pieceBounds(preview), this.pieces);

    if (candidate && candidate.kind !== 'conflict') {
      this.mergeInto(preview, candidate.target, candidate.kind);
      return;
    }

    if (candidate && candidate.kind === 'conflict') {
      const bounce = findBouncePosition({
        dragged: pieceBounds(preview),
        target: pieceVisualBounds(candidate.target),
        pieces: [...this.pieces, preview],
        sourceId: preview.id,
        canvas: this.canvas,
      });
      preview.x = bounce.x;
      preview.y = bounce.y;
      this.pieces.push(preview);
      this.applySpring(preview, 'bounce');
      this.selectedId = preview.id;
      this.hover = null;
      this.notify(duplicatePlaceMessage(incoming.place), 'warning');
      audio.bounce();
      return;
    }

    if (this.snapToGrid) {
      preview.x = clamp(
        snapToGrid(preview.x),
        CANVAS_PADDING,
        Math.max(CANVAS_PADDING, this.canvas.width - width - CANVAS_PADDING),
      );
      preview.y = clamp(
        snapToGrid(preview.y),
        CANVAS_PADDING,
        Math.max(CANVAS_PADDING, this.canvas.height - CARD_HEIGHT - CANVAS_PADDING),
      );
    }

    this.pieces.push(preview);
    this.bringToFront(preview);
    this.selectedId = preview.id;
    this.hoveredId = preview.id;
    this.hover = null;
    audio.add();
  }

  // ---------------------------------------------------------------------------
  // Canvas drag
  // ---------------------------------------------------------------------------

  /**
   * Entry point from a card. A card in a group has two gestures:
   * - the flat, leading-digit end pulls that card out;
   * - the arrow/zero end moves the whole group.
   * Expanded groups are already split visually, so any card drag pulls it out.
   */
  beginCardDrag(
    event: PointerEvent,
    pieceId: string,
    cardId: string,
    kind: DragIntentKind,
  ): void {
    if (this.drag || this.bankDrag) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const piece = this.pieces.find((entry) => entry.id === pieceId);
    if (!piece || !piece.cards.some((card) => card.id === cardId)) return;

    const doubleClick = this.notePointerDown(piece, event);

    if (kind === 'peel' && piece.cards.length > 1) {
      this.beginPeelDrag(event, piece, cardId, doubleClick);
    } else {
      this.beginMoveDrag(event, piece, cardId, false, doubleClick);
    }
  }

  /** The group's value chip is always a grab handle for the whole piece. */
  beginChromeDrag(event: PointerEvent, pieceId: string): void {
    if (this.drag || this.bankDrag) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const piece = this.pieces.find((entry) => entry.id === pieceId);
    if (!piece) return;
    this.lastPointerDown = null;
    this.beginMoveDrag(event, piece, null, true, false);
  }

  /**
   * Records same-piece double-clicks so the whole group can toggle between
   * Stack and Expand without reaching for the toolbar. This is deliberately
   * pointer-based rather than a native dblclick handler: pointerdown is
   * preventDefault-ed for dragging, and touch needs the same shortcut.
   */
  private notePointerDown(piece: Piece, event: PointerEvent): boolean {
    if (piece.cards.length < 2) {
      this.lastPointerDown = null;
      return false;
    }

    const now = Date.now();
    const last = this.lastPointerDown;
    const isDouble =
      Boolean(last) &&
      last!.pieceId === piece.id &&
      now - last!.time < 350 &&
      Math.hypot(event.clientX - last!.x, event.clientY - last!.y) < 14;

    this.lastPointerDown = isDouble
      ? null
      : { pieceId: piece.id, time: now, x: event.clientX, y: event.clientY };

    return isDouble;
  }

  private beginPeelDrag(
    event: PointerEvent,
    piece: Piece,
    cardId: string,
    doubleClick: boolean,
  ): void {
    this.measureCanvas();
    this.bringToFront(piece);
    this.applySpring(piece, 'default');
    this.selectedId = piece.id;
    this.hoveredId = piece.id;
    this.hover = null;
    this.intent = { pieceId: piece.id, cardId, kind: 'peel' };

    const pointer = this.clientToCanvas(event.clientX, event.clientY);
    this.drag = {
      pieceId: piece.id,
      cardId,
      pointerId: event.pointerId,
      startPointer: pointer,
      startPiece: { x: piece.x, y: piece.y },
      moved: false,
      kind: 'peel',
      peeled: false,
      fromChrome: false,
      doubleClick,
    };
    audio.pickup();
    event.preventDefault();
  }

  private beginMoveDrag(
    event: PointerEvent,
    piece: Piece,
    cardId: string | null,
    fromChrome: boolean,
    doubleClick: boolean,
  ): void {
    this.measureCanvas();

    // A piece can still be mid-spring when it is grabbed (for example while a
    // bounce is settling). State normally holds the spring's destination, while
    // the DOM is somewhere along the animation. Adopt the visual position before
    // recording the drag origin so the piece does not jump to the old target.
    if (fromChrome) {
      this.syncPieceToVisual(piece);
    } else if (cardId) {
      const layout = layoutPiece(piece.cards, piece.mode);
      const cardGeometry = layout.cards.find((entry) => entry.card.id === cardId);
      const cardElement = event.currentTarget as HTMLElement | null;
      if (cardGeometry && cardElement) {
        // Freeze any in-flight Motion animation at its current visual position
        // before measuring it. Without this, a spring can keep advancing while
        // Svelte flushes the new drag state, producing a visible jump.
        freezeCardMotion(cardElement);

        const rect = cardElement.getBoundingClientRect();
        const visualX = rect.left - this.canvasRect.left - cardGeometry.localX;
        const visualY = rect.top - this.canvasRect.top - cardGeometry.localY;
        if (Math.abs(visualX - piece.x) > 0.1 || Math.abs(visualY - piece.y) > 0.1) {
          piece.x = visualX;
          piece.y = visualY;
        }
      }
    }

    this.bringToFront(piece);
    this.applySpring(piece, 'default');
    this.selectedId = piece.id;
    this.hoveredId = piece.id;
    this.hover = null;
    this.intent = { pieceId: piece.id, cardId: fromChrome ? null : cardId, kind: 'move' };

    const pointer = this.clientToCanvas(event.clientX, event.clientY);
    this.drag = {
      pieceId: piece.id,
      cardId,
      pointerId: event.pointerId,
      startPointer: pointer,
      startPiece: { x: piece.x, y: piece.y },
      moved: false,
      kind: 'move',
      peeled: false,
      fromChrome,
      doubleClick,
    };
    audio.pickup();
    event.preventDefault();
  }

  /** Freezes a piece at where it currently looks on screen. */
  private syncPieceToVisual(piece: Piece): void {
    const anchor = piece.cards[0];
    if (!anchor) return;
    const element = this.canvasEl?.querySelector<HTMLElement>(
      `.card-node[data-card-id="${anchor.id}"]`,
    );
    if (!element) return;

    freezeCardMotion(element);
    const rect = element.getBoundingClientRect();
    const geometry = layoutPiece(piece.cards, piece.mode).cards.find(
      (entry) => entry.card.id === anchor.id,
    );
    if (!geometry) return;

    const visualX = rect.left - this.canvasRect.left - geometry.localX;
    const visualY = rect.top - this.canvasRect.top - geometry.localY;
    if (Math.abs(visualX - piece.x) > 0.1 || Math.abs(visualY - piece.y) > 0.1) {
      piece.x = visualX;
      piece.y = visualY;
    }
  }

  /** Splits one card out of its piece at its current on-screen position. */
  private peelCard(drag: DragState): boolean {
    const source = this.pieces.find((entry) => entry.id === drag.pieceId);
    const cardId = drag.cardId;
    if (!source || !cardId) return false;
    const card = source.cards.find((entry) => entry.id === cardId);
    if (!card) return false;

    const layout = layoutPiece(source.cards, source.mode);
    const geometry = layout.cards.find((entry) => entry.card.id === cardId);
    let visualX = source.x + (geometry?.localX ?? 0);
    let visualY = source.y + (geometry?.localY ?? 0);

    const cardElement = this.canvasEl?.querySelector<HTMLElement>(
      `.card-node[data-card-id="${cardId}"]`,
    );
    if (cardElement) {
      freezeCardMotion(cardElement);
      const rect = cardElement.getBoundingClientRect();
      visualX = rect.left - this.canvasRect.left;
      visualY = rect.top - this.canvasRect.top;
    }

    const removal = removeCardFromPiece(source, cardId);
    if (!removal) return false;

    source.cards = removal.cards;
    source.x = removal.x;
    source.y = removal.y;
    source.mode = removal.mode;
    this.applySpring(source, 'default');

    const detached = makePiece([card], visualX, visualY, 'stack', this.maxZ() + 1);
    this.pieces.push(detached);
    this.bringToFront(detached);

    drag.pieceId = detached.id;
    drag.startPiece = { x: visualX, y: visualY };
    drag.peeled = true;
    drag.moved = true;

    this.lastPointerDown = null;
    this.selectedId = detached.id;
    this.hoveredId = detached.id;
    this.hover = null;
    this.intent = { pieceId: detached.id, cardId, kind: 'peel' };
    audio.peel();
    return true;
  }

  private updatePieceDrag(clientX: number, clientY: number): void {
    const drag = this.drag;
    if (!drag) return;

    const pointer = this.clientToCanvas(clientX, clientY);
    const dx = pointer.x - drag.startPointer.x;
    const dy = pointer.y - drag.startPointer.y;
    const distance = Math.hypot(dx, dy);

    if (drag.kind === 'peel' && !drag.peeled) {
      if (distance <= PEEL_THRESHOLD) return;
      drag.moved = true;
      if (!this.peelCard(drag)) {
        this.drag = null;
        this.intent = null;
        return;
      }
    } else if (distance > 4) {
      drag.moved = true;
    }

    const piece = this.pieces.find((entry) => entry.id === drag.pieceId);
    if (!piece) {
      this.drag = null;
      return;
    }

    if (drag.moved) this.lastPointerDown = null;

    piece.x = clamp(
      drag.startPiece.x + dx,
      CANVAS_PADDING,
      Math.max(CANVAS_PADDING, this.canvas.width - pieceVisualWidth(piece) - CANVAS_PADDING),
    );
    piece.y = clamp(
      drag.startPiece.y + dy,
      CANVAS_PADDING,
      Math.max(CANVAS_PADDING, this.canvas.height - CARD_HEIGHT - CANVAS_PADDING),
    );

    const candidate = findDropCandidate(piece.cards, pieceBounds(piece), this.pieces, [piece.id]);
    this.hover = this.haloFor(candidate);
  }

  private endPieceDrag(): void {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    this.hover = null;
    this.intent = null;
    const piece = this.pieces.find((entry) => entry.id === drag.pieceId);
    if (!piece) return;

    if (!drag.moved) {
      if (drag.doubleClick && piece.cards.length > 1) {
        this.lastPointerDown = null;
        this.toggleMode(piece.id);
        return;
      }
      this.selectedId = piece.id;
      return;
    }

    this.lastPointerDown = null;
    const candidate = findDropCandidate(piece.cards, pieceBounds(piece), this.pieces, [piece.id]);

    if (candidate) {
      if (candidate.kind === 'conflict') {
        this.bouncePieceAway(piece, candidate.target);
      } else {
        this.mergeInto(piece, candidate.target, candidate.kind);
      }
      return;
    }

    if (this.snapToGrid) {
      piece.x = snapToGrid(piece.x);
      piece.y = snapToGrid(piece.y);
    }
    this.fitPieceInCanvas(piece);
    this.selectedId = piece.id;
  }

  private fitPieceInCanvas(piece: Piece): void {
    const bounds = pieceBounds(piece);
    const visualWidth = pieceVisualWidth(piece);
    piece.x = clamp(
      piece.x,
      CANVAS_PADDING,
      Math.max(CANVAS_PADDING, this.canvas.width - visualWidth - CANVAS_PADDING),
    );
    piece.y = clamp(
      piece.y,
      CANVAS_PADDING,
      Math.max(CANVAS_PADDING, this.canvas.height - bounds.height - CANVAS_PADDING),
    );
  }

  private mergeInto(source: Piece, target: Piece, kind: Exclude<DropKind, 'conflict'>): void {
    if (sharesPlace(source.cards, target.cards)) {
      this.bouncePieceAway(source, target);
      return;
    }

    const merged = mergeCards(target.cards, source.cards);
    const mode: PieceMode = kind === 'stack' ? 'stack' : 'expand';
    const position = getMergedPosition(target, merged, mode);

    target.cards = merged;
    target.mode = mode;
    target.x = position.x;
    target.y = position.y;
    target.spring = 'default';
    // The anchor rule grows a stack leftwards and a chain rightwards, so a
    // merge at the workbench edge can reach past it. Staying visible wins.
    this.fitPieceInCanvas(target);

    this.pieces = this.pieces.filter((piece) => piece.id !== source.id);
    this.bringToFront(target);
    this.hover = null;
    this.hoveredId = target.id;
    this.selectedId = target.id;
    this.markRemoved(source.id);

    if (kind === 'stack') {
      audio.snap();
    } else {
      audio.chain();
    }
  }

  private bouncePieceAway(source: Piece, target: Piece): void {
    const bounce = findBouncePosition({
      dragged: pieceVisualBounds(source),
      target: pieceVisualBounds(target),
      pieces: this.pieces,
      sourceId: source.id,
      canvas: this.canvas,
    });

    source.x = bounce.x;
    source.y = bounce.y;
    this.applySpring(source, 'bounce');
    this.hover = null;
    this.selectedId = source.id;

    const duplicate = source.cards.find((card) => target.cards.some((other) => other.place === card.place));
    this.notify(duplicatePlaceMessage(duplicate ? duplicate.place : null), 'warning');
    audio.bounce();
  }

  private haloFor(candidate: DropCandidate | null): HoverHalo | null {
    if (!candidate) return null;
    return {
      kind: candidate.kind,
      targetId: candidate.target.id,
      targetValue: pieceValue(candidate.target.cards),
      bounds: {
        x: candidate.targetBounds.x - 2,
        y: candidate.targetBounds.y - 2,
        width: candidate.targetBounds.width + 4,
        height: candidate.targetBounds.height + 4,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Pointer lifecycle
  // ---------------------------------------------------------------------------

  handlePointerMove = (event: PointerEvent): void => {
    // Any real pointer movement makes a pending drop-position refresh stale.
    this.intentRefreshToken += 1;
    if (this.bankDrag && event.pointerId === this.bankDrag.pointerId) {
      this.updateBankDrag(event.clientX, event.clientY);
      return;
    }
    if (this.drag && event.pointerId === this.drag.pointerId) {
      this.updatePieceDrag(event.clientX, event.clientY);
    }
  };

  handlePointerUp = (event: PointerEvent): void => {
    if (this.bankDrag && event.pointerId === this.bankDrag.pointerId) {
      const drag = this.bankDrag;
      this.bankDrag = null;
      this.hover = null;
      this.intent = null;
      if (drag.active) {
        this.dropBankCard(drag, event.clientX, event.clientY);
      } else {
        this.addBankCard(drag.card);
      }
      return;
    }

    if (this.drag && event.pointerId === this.drag.pointerId) {
      this.endPieceDrag();

      // A mouse pointer is still resting on the card after the drop, so its
      // aim lift should stay. A lifted finger is not hovering anything, and
      // re-checking elementFromPoint would leave a stuck lift behind it.
      if (event.pointerType === 'touch') return;

      const { clientX, clientY } = event;
      const token = ++this.intentRefreshToken;
      requestAnimationFrame(() => {
        if (token === this.intentRefreshToken) {
          this.refreshIntentAt(clientX, clientY);
        }
      });
    }
  };

  handlePointerCancel = (event: PointerEvent): void => {
    this.intentRefreshToken += 1;
    if (this.bankDrag && event.pointerId === this.bankDrag.pointerId) {
      this.bankDrag = null;
      this.hover = null;
      this.intent = null;
      this.lastPointerDown = null;
      return;
    }
    if (this.drag && event.pointerId === this.drag.pointerId) {
      this.endPieceDrag();
      this.intent = null;
      this.lastPointerDown = null;
    }
  };

  cancelInteraction(): void {
    this.intent = null;
    this.lastPointerDown = null;
    if (this.bankDrag) {
      this.bankDrag = null;
      this.hover = null;
    }
    if (this.drag) {
      const drag = this.drag;
      this.drag = null;
      this.hover = null;
      const piece = this.pieces.find((entry) => entry.id === drag.pieceId);
      if (piece) this.fitPieceInCanvas(piece);
    }
  }

  // ---------------------------------------------------------------------------
  // Group & canvas actions
  // ---------------------------------------------------------------------------

  selectPiece(id: string | null): void {
    this.selectedId = id;
    if (id) {
      const piece = this.pieces.find((entry) => entry.id === id);
      if (piece) this.bringToFront(piece);
    }
  }

  setHoveredPiece(id: string | null): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }

    if (id) {
      this.hoveredId = id;
      return;
    }

    // Give the pointer time to cross the small gap between a card and its
    // floating toolbar. Entering the toolbar cancels this hide.
    this.hoverTimer = setTimeout(() => {
      this.hoveredId = null;
      this.hoverTimer = null;
    }, 240);
  }

  /**
   * Touch pointers do not reliably fire pointerleave after a tap, so a
   * hover-only toolbar can otherwise outlive the gesture that opened it.
   */
  private clearHover(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.hoveredId = null;
  }

  toggleMode(pieceId: string): void {
    const piece = this.pieces.find((entry) => entry.id === pieceId);
    if (!piece || piece.cards.length < 2) return;
    piece.mode = piece.mode === 'stack' ? 'expand' : 'stack';
    this.fitPieceInCanvas(piece);
    this.selectedId = piece.id;
    this.intent = null;
    this.lastPointerDown = null;
    if (piece.mode === 'expand') {
      audio.expand();
    } else {
      audio.stack();
    }
  }

  removePiece(pieceId: string): void {
    const index = this.pieces.findIndex((piece) => piece.id === pieceId);
    if (index < 0) return;
    const removed = this.pieces[index];
    const removedCopy = clonePieces([removed])[0];
    this.pieces = this.pieces.filter((piece) => piece.id !== pieceId);
    if (this.selectedId === pieceId) this.selectedId = null;
    if (this.hoveredId === pieceId) this.hoveredId = null;
    if (this.intent?.pieceId === pieceId) this.intent = null;
    this.lastPointerDown = null;
    this.markRemoved(pieceId);
    audio.remove();
    this.notify(`Removed ${formatNumber(pieceValue(removed.cards))}.`, 'info', {
      label: 'Undo',
      run: () => {
        this.pieces.splice(Math.min(index, this.pieces.length), 0, removedCopy);
        this.selectedId = removedCopy.id;
        audio.add();
      },
    });
  }

  clearSelection(): void {
    this.selectedId = null;
    this.intent = null;
    this.lastPointerDown = null;
    // A tap on empty canvas should also dismiss a toolbar that was kept open
    // by a touch hover, not just the selection.
    this.clearHover();
  }

  private markRemoved(pieceId: string): void {
    const timer = this.bounceTimers.get(pieceId);
    if (timer) {
      clearTimeout(timer);
      this.bounceTimers.delete(pieceId);
    }
  }

  tidyAll(): void {
    if (this.pieces.length === 0) {
      this.notify('Add some cards first, then tidy them into rows.', 'info');
      audio.click();
      return;
    }

    const ordered = [...this.pieces].sort((a, b) => pieceValue(b.cards) - pieceValue(a.cards));
    const pad = 32;
    const gap = 34;
    const rowGap = 58;
    let x = pad;
    let y = 76;
    let rowHeight = CARD_HEIGHT;

    for (const piece of ordered) {
      const bounds = pieceBounds(piece);
      const visualWidth = pieceVisualWidth(piece);
      if (x > pad && x + visualWidth > this.canvas.width - pad) {
        x = pad;
        y += rowHeight + rowGap;
        rowHeight = CARD_HEIGHT;
      }
      piece.x = x;
      piece.y = y;
      x += visualWidth + gap;
      rowHeight = Math.max(rowHeight, bounds.height);
    }

    this.keepPiecesInView();
    this.selectedId = null;
    audio.tidy();
    this.notify('All cards tidied into rows.', 'success');
  }

  resetCanvas(): void {
    if (this.pieces.length === 0) {
      this.notify('The workbench is already clear.', 'info');
      audio.click();
      return;
    }
    this.resetSnapshot = clonePieces(this.pieces);
    // The pieces are leaving the board, so their bounce timers should not
    // outlive them and reveal a late "settle" on a piece that no longer exists.
    for (const piece of this.pieces) this.markRemoved(piece.id);
    this.pieces = [];
    this.selectedId = null;
    this.hoveredId = null;
    this.hover = null;
    this.intent = null;
    this.lastPointerDown = null;
    audio.reset();
    this.notify('Workbench cleared.', 'info', {
      label: 'Undo',
      run: () => {
        if (!this.resetSnapshot) return;
        this.pieces = clonePieces(this.resetSnapshot);
        this.resetSnapshot = null;
        audio.tidy();
      },
    });
  }

  makeNumber(raw: string, mode: PieceMode): void {
    const cleaned = raw.replace(/,/g, '').trim();
    const value = Number(cleaned);
    if (!Number.isInteger(value) || value < 1 || value > 9999) {
      this.notify('Enter a whole number from 1 to 9,999.', 'warning');
      audio.click();
      return;
    }

    const entries = numberToCards(value);
    if (entries.length === 0) {
      this.notify('Enter a whole number from 1 to 9,999.', 'warning');
      return;
    }

    const cards = entries.map(({ place, digit }) => makeCard(place, digit));
    const layout = layoutPiece(cards, mode);
    const spot = findFreeSpot({
      width: layout.width + (mode === 'expand' && cards.length > 1 ? RESULT_RESERVE : 0),
      height: layout.height,
      pieces: this.pieces,
      canvas: this.canvas,
    });
    const piece = makePiece(cards, spot.x, spot.y, mode, this.maxZ() + 1);
    this.pieces.push(piece);
    this.selectedId = piece.id;
    this.hoveredId = piece.id;
    audio.add();
    this.notify(`Added ${formatNumber(value)} as ${mode === 'expand' ? 'an expanded chain' : 'a stacked group'}.`, 'success');
  }

  makeNumberAsCards(raw: string): void {
    const cleaned = raw.replace(/,/g, '').trim();
    const value = Number(cleaned);
    if (!Number.isInteger(value) || value < 1 || value > 9999) {
      this.notify('Enter a whole number from 1 to 9,999.', 'warning');
      audio.click();
      return;
    }

    const entries = numberToCards(value);
    if (entries.length === 0) {
      this.notify('Enter a whole number from 1 to 9,999.', 'warning');
      return;
    }

    const cards = entries.map(({ place, digit }) => makeCard(place, digit));
    const gap = 20;
    const widths = cards.map((card) => getArrowCardWidth(card.place));
    const availableWidth = Math.max(220, this.canvas.width - 80);
    const rows: Array<{ cards: Card[]; widths: number[]; width: number }> = [];
    let current: { cards: Card[]; widths: number[]; width: number } = { cards: [], widths: [], width: 0 };

    cards.forEach((card, index) => {
      const width = widths[index];
      const nextWidth = current.width === 0 ? width : current.width + gap + width;
      if (current.cards.length > 0 && nextWidth > availableWidth) {
        rows.push(current);
        current = { cards: [card], widths: [width], width };
      } else {
        current.cards.push(card);
        current.widths.push(width);
        current.width = nextWidth;
      }
    });
    if (current.cards.length) rows.push(current);

    const rowHeight = CARD_HEIGHT;
    const blockHeight = rows.length * rowHeight + Math.max(0, rows.length - 1) * 22;
    const blockWidth = Math.max(...rows.map((row) => row.width));
    const spot = findFreeSpot({
      width: blockWidth,
      height: blockHeight,
      pieces: this.pieces,
      canvas: this.canvas,
    });

    let y = spot.y;
    let topPieceId: string | null = null;
    rows.forEach((row) => {
      let x = spot.x + (blockWidth - row.width) / 2;
      row.cards.forEach((card, index) => {
        const piece = makePiece([card], x, y, 'stack', this.maxZ() + 1);
        this.pieces.push(piece);
        topPieceId = piece.id;
        x += row.widths[index] + gap;
      });
      y += rowHeight + 22;
    });

    this.selectedId = topPieceId;
    audio.add();
    this.notify(`Added ${entries.length} separate ${entries.length === 1 ? 'card' : 'cards'} for ${formatNumber(value)}.`, 'success');
  }

  tryExample(): void {
    this.makeNumber('4325', 'stack');
  }

  setTheme(theme: ColorTheme): void {
    this.theme = theme;
    this.persist();
    audio.click();
  }

  toggleSnapToGrid(): void {
    this.snapToGrid = !this.snapToGrid;
    this.persist();
    audio.click();
  }

  toggleXray(): void {
    this.xray = !this.xray;
    this.persist();
    audio.click();

    if (this.xray) {
      const hasStack = this.pieces.some(
        (piece) => piece.mode === 'stack' && piece.cards.length > 1,
      );
      if (!hasStack) {
        this.notify(
          'X-ray only reveals zeros in a stacked group. Snap two or more cards together first.',
          'info',
        );
      }
    }
  }

  toggleMute(): void {
    this.muted = !this.muted;
    audio.setMuted(this.muted);
    this.persist();
    if (!this.muted) audio.click();
  }

  toggleBank(): void {
    this.bankOpen = !this.bankOpen;
    this.persist();
    audio.click();
    requestAnimationFrame(() => this.measureCanvas());
  }

  openGuide(): void {
    this.guideOpen = true;
    this.cancelInteraction();
  }

  closeGuide(): void {
    this.guideOpen = false;
  }

  notify(message: string, tone: ToastTone = 'info', action?: { label: string; run: () => void }): void {
    this.toast = {
      id: Date.now() + Math.random(),
      message,
      tone,
      actionLabel: action?.label,
      action: action?.run,
    };
    this.scheduleToastEnd(action ? 6400 : 4200);
  }

  private scheduleToastEnd(duration: number): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastDuration = duration;
    this.toastShownAt = performance.now();
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.toastTimer = null;
    }, duration);
  }

  /** Hovering or focusing the toast stops the clock, e.g. the Undo button. */
  pauseToast(): void {
    if (!this.toast || !this.toastTimer) return;
    clearTimeout(this.toastTimer);
    this.toastTimer = null;
    const remaining = this.toastDuration - (performance.now() - this.toastShownAt);
    this.toastDuration = Math.max(0, remaining);
  }

  /** Resumes whatever time the paused toast still had left. */
  resumeToast(): void {
    if (!this.toast || this.toastTimer) return;
    if (this.toastDuration <= 0) {
      this.toast = null;
      return;
    }
    this.scheduleToastEnd(this.toastDuration);
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toast = null;
    this.toastDuration = 0;
  }

  runToastAction(): void {
    const action = this.toast?.action;
    this.dismissToast();
    action?.();
  }

  handleKeyDown = (event: KeyboardEvent): void => {
    if (this.guideOpen) return;

    // Escape must always be able to cancel a drag, even if a toolbar button
    // happens to hold focus while a pointer gesture is in progress.
    if (event.key === 'Escape') {
      if (this.drag || this.bankDrag) {
        this.cancelInteraction();
      } else if (this.selectedId) {
        this.clearSelection();
      }
      return;
    }

    if (isTypingTarget(event.target)) return;

    if (!this.selectedId) return;
    const piece = this.selectedPiece;
    if (!piece) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.removePiece(piece.id);
      return;
    }

    const step = event.shiftKey ? GRID_SIZE * 2 : 12;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowUp') dy = -step;
    else if (event.key === 'ArrowDown') dy = step;

    if (dx !== 0 || dy !== 0) {
      event.preventDefault();
      const bounds = pieceBounds(piece);
      piece.x = clamp(
        piece.x + dx,
        CANVAS_PADDING,
        Math.max(CANVAS_PADDING, this.canvas.width - bounds.width - CANVAS_PADDING),
      );
      piece.y = clamp(
        piece.y + dy,
        CANVAS_PADDING,
        Math.max(CANVAS_PADDING, this.canvas.height - bounds.height - CANVAS_PADDING),
      );
      audio.click();
    }
  };
}

export const game = new ArrowMathStore();

export function springFor(piece: Piece): { stiffness: number; damping: number } {
  return piece.spring === 'bounce' ? SPRING_BOUNCE : SPRING_DEFAULT;
}

// A tab being closed or swapped away cannot wait for the debounced write.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flushBoard());
}
