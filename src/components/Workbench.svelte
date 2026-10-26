<script lang="ts">
  import { game, springFor } from '../lib/state.svelte';
  import { layoutPiece, type Card, type PieceMode } from '../lib/geometry';
  import CardNode from './CardNode.svelte';
  import PieceOverlay from './PieceOverlay.svelte';
  import SumOverlay from './SumOverlay.svelte';
  import HoverHalo from './HoverHalo.svelte';
  import EmptyState from './EmptyState.svelte';
  import BoardTabs from './BoardTabs.svelte';

  interface FlatCard {
    card: Card;
    pieceId: string;
    x: number;
    y: number;
    z: number;
    mode: PieceMode;
    grouped: boolean;
    dragging: boolean;
    carried: boolean;
    visibleWidth: number;
    spring: ReturnType<typeof springFor>;
  }

  const cards = $derived.by<FlatCard[]>(() => {
    const flat: FlatCard[] = [];

    for (const piece of game.pieces) {
      const layout = layoutPiece(piece.cards, piece.mode);
      const dragging = game.draggingPieceId === piece.id;
      const carried = game.isCarried(piece.id);

      layout.cards.forEach((entry, index) => {
        // In a stack, every card but the front one is tucked under the next
        // (smaller) card. Its visible width is the distance to that card's left
        // edge, which can be wider than one digit slot when places are missing.
        const covering = piece.mode === 'stack' ? layout.cards[index + 1] : undefined;
        const visibleWidth = covering ? covering.localX - entry.localX : entry.width;

        flat.push({
          card: entry.card,
          pieceId: piece.id,
          x: piece.x + entry.localX,
          y: piece.y + entry.localY,
          z: 20 + piece.z * 8 + index,
          mode: piece.mode,
          grouped: piece.cards.length > 1,
          dragging,
          carried,
          visibleWidth,
          spring: springFor(piece),
        });
      });
    }

    return flat.sort((a, b) => a.z - b.z);
  });

  const countLabel = $derived(
    game.pieces.length === 0
      ? 'Ready'
      : `${game.cardCount} ${game.cardCount === 1 ? 'card' : 'cards'}`,
  );

  function attachCanvas(node: HTMLElement) {
    const destroy = game.attachCanvas(node);
    return { destroy };
  }

  function onCanvasPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('.card-node, .piece-chrome, [data-sum-handle], .empty-state, button, input, a')) return;

    // On a phone, leave the "Make a number" field and close its keyboard when
    // the teacher moves on to touching the workbench.
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
    ) {
      active.blur();
    }

    game.clearSelection();
  }

  /**
   * A mouse drag on the empty bench pans it sideways. Touch pans natively
   * (the scroller allows pan-x), so only mouse and pen are handled here.
   */
  let pan: { pointerId: number; startX: number; startScroll: number } | null = null;

  function onScrollerPointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.card-node, .piece-chrome, [data-sum-handle], .copyable, button, input, a')) return;
    const scroller = event.currentTarget as HTMLElement;
    if (scroller.scrollWidth <= scroller.clientWidth) return;
    pan = { pointerId: event.pointerId, startX: event.clientX, startScroll: scroller.scrollLeft };
    scroller.setPointerCapture(event.pointerId);
  }

  function onScrollerPointerMove(event: PointerEvent) {
    if (!pan || event.pointerId !== pan.pointerId) return;
    const scroller = event.currentTarget as HTMLElement;
    scroller.scrollLeft = pan.startScroll - (event.clientX - pan.startX);
  }

  function endPan(event: PointerEvent) {
    if (pan && event.pointerId === pan.pointerId) pan = null;
  }

  /**
   * The bench only scrolls sideways, so an ordinary up/down mouse wheel (or
   * trackpad swipe) scrolls it left and right. Sideways swipes and
   * Shift+wheel already do; Ctrl+wheel is left alone for zooming.
   */
  function wheelScrollsSideways(node: HTMLElement) {
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (node.scrollWidth <= node.clientWidth) return;
      const scale =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? node.clientWidth
            : 1;
      node.scrollLeft += event.deltaY * scale;
      event.preventDefault();
    };
    // Not passive: the page itself must not scroll as well.
    node.addEventListener('wheel', onWheel, { passive: false });
    return { destroy: () => node.removeEventListener('wheel', onWheel) };
  }

  let scroller: HTMLElement | undefined = $state();

  // Each board opens at its left edge, wherever the last one was scrolled to.
  $effect(() => {
    game.activeBoardId;
    if (scroller) scroller.scrollLeft = 0;
  });

  function onCanvasPointerLeave() {
    if (!game.isInteracting) game.clearIntent();
  }
</script>

<div class="workbench-shell">
  <div
    class="workbench"
    use:attachCanvas
    onpointerdown={onCanvasPointerDown}
    onpointerleave={onCanvasPointerLeave}
    role="region"
    aria-label="Arrow card workbench"
    data-workbench
    data-board-id={game.activeBoardId}
    data-card-count={game.cardCount}
    data-piece-count={game.pieces.length}
    data-sum-count={game.sums.length}
  >
    <div class="canvas-head">
      <div class="canvas-status" aria-hidden="true">
        <span class="status-spark"></span>
        <span class="status-label">Workbench</span>
        <span class="status-divider"></span>
        <span class="status-count">{countLabel}</span>
      </div>
      <BoardTabs />
    </div>

    {#if game.pieces.length === 0 && game.sums.length === 0}
      <EmptyState />
    {/if}

    <div
      class="workbench-scroll"
      role="presentation"
      data-workbench-scroll
      bind:this={scroller}
      use:wheelScrollsSideways
      onpointerdown={onScrollerPointerDown}
      onpointermove={onScrollerPointerMove}
      onpointerup={endPan}
      onpointercancel={endPan}
    >
    <div class="workbench-content" data-workbench-content style:width="{game.scrollWidth}px">
    {#key game.activeBoardId}
    <!-- Remounts per board, so the new board's cards slide in rather than
         springing across from where the old board's cards were. -->
    <div class="board-layer" data-slide={game.boardSlide}>
    <div class="cards-layer">
      {#each game.sums as sum (sum.id)}
        <SumOverlay {sum} />
      {/each}
      {#each cards as entry (entry.card.id)}
        <CardNode
          card={entry.card}
          pieceId={entry.pieceId}
          x={entry.x}
          y={entry.y}
          z={entry.z}
          theme={game.theme}
          mode={entry.mode}
          grouped={entry.grouped}
          dragging={entry.dragging}
          carried={entry.carried}
          visibleWidth={entry.visibleWidth}
          spring={entry.spring}
        />
      {/each}
    </div>

    {#each game.pieces as piece (piece.id)}
      <PieceOverlay {piece} />
    {/each}

    {#if game.hover}
      <HoverHalo />
    {/if}
    </div>
    {/key}
    </div>
    </div>

    <span class="canvas-corner corner-tl" aria-hidden="true"></span>
    <span class="canvas-corner corner-br" aria-hidden="true"></span>
  </div>
</div>

<style>
  .workbench-shell {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
  }

  .workbench {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 24px;
    background-color: var(--canvas-bg);
    background-image: radial-gradient(circle at 20% -10%, var(--canvas-glow) 0%, transparent 55%);
    box-shadow:
      var(--shadow-sm),
      inset 0 1px 0 rgba(255, 255, 255, 0.55);
    isolation: isolate;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  /* No z-index on the scroller or its content, so cards, toolbars and the
     canvas head still share the workbench's stacking context. */
  .workbench-scroll {
    position: absolute;
    inset: 0;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    /* Empty bench pans sideways on touch; cards keep touch-action: none. */
    touch-action: pan-x;
  }

  .workbench-content {
    position: relative;
    min-width: 100%;
    height: 100%;
    /* The grid scrolls with the cards, so grid snapping still lines up. */
    background-image:
      linear-gradient(to right, var(--canvas-grid) 1px, transparent 1px),
      linear-gradient(to bottom, var(--canvas-grid) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  /* No z-index here either: cards and their toolbars keep sharing the
     workbench's stacking context once the slide has finished. */
  .board-layer {
    position: absolute;
    inset: 0;
  }

  .board-layer[data-slide='next'] {
    animation: board-in-next 240ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .board-layer[data-slide='previous'] {
    animation: board-in-previous 240ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes board-in-next {
    from {
      opacity: 0;
      transform: translateX(48px);
    }
  }

  @keyframes board-in-previous {
    from {
      opacity: 0;
      transform: translateX(-48px);
    }
  }

  .cards-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .canvas-head {
    position: absolute;
    z-index: 3;
    top: 14px;
    left: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    pointer-events: none;
  }

  .canvas-status {
    display: inline-flex;
    align-items: center;
    height: 28px;
    border: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
    border-radius: 9px;
    background: color-mix(in srgb, var(--panel) 78%, transparent);
    color: var(--muted);
    font-size: 10.5px;
    font-weight: 650;
    letter-spacing: 0.01em;
    box-shadow: 0 1px 1px rgba(15, 23, 42, 0.02);
    backdrop-filter: blur(10px);
    gap: 7px;
    padding: 0 10px 0 8px;
  }

  .status-spark {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 13%, transparent);
  }

  .status-label {
    color: var(--muted-strong);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .status-divider {
    width: 1px;
    height: 11px;
    background: var(--line);
  }

  .status-count {
    font-variant-numeric: tabular-nums;
  }

  .canvas-corner {
    position: absolute;
    width: 34px;
    height: 34px;
    pointer-events: none;
    opacity: 0.6;
    z-index: 0;
  }

  .corner-tl {
    top: 0;
    left: 0;
    border-top: 2px solid color-mix(in srgb, var(--accent) 16%, transparent);
    border-left: 2px solid color-mix(in srgb, var(--accent) 16%, transparent);
    border-top-left-radius: 23px;
  }

  .corner-br {
    right: 0;
    bottom: 0;
    border-bottom: 2px solid color-mix(in srgb, var(--line-strong) 30%, transparent);
    border-right: 2px solid color-mix(in srgb, var(--line-strong) 30%, transparent);
    border-bottom-right-radius: 23px;
  }

  @media (max-width: 720px) {
    .workbench {
      border-radius: 18px;
    }

    /* The boards need the room more than the card count does. */
    .canvas-status {
      display: none;
    }

    .canvas-head {
      justify-content: flex-end;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .board-layer[data-slide] {
      animation: none;
    }
  }
</style>
