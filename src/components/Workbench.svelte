<script lang="ts">
  import { game, springFor } from '../lib/state.svelte';
  import { layoutPiece, type Card, type PieceMode } from '../lib/geometry';
  import CardNode from './CardNode.svelte';
  import PieceOverlay from './PieceOverlay.svelte';
  import HoverHalo from './HoverHalo.svelte';
  import EmptyState from './EmptyState.svelte';

  interface FlatCard {
    card: Card;
    pieceId: string;
    x: number;
    y: number;
    z: number;
    mode: PieceMode;
    isBase: boolean;
    grouped: boolean;
    dragging: boolean;
    spring: ReturnType<typeof springFor>;
  }

  const cards = $derived.by<FlatCard[]>(() => {
    const flat: FlatCard[] = [];

    for (const piece of game.pieces) {
      const layout = layoutPiece(piece.cards, piece.mode);
      const dragging = game.draggingPieceId === piece.id;

      layout.cards.forEach((entry, index) => {
        flat.push({
          card: entry.card,
          pieceId: piece.id,
          x: piece.x + entry.localX,
          y: piece.y + entry.localY,
          z: 20 + piece.z * 8 + index,
          mode: piece.mode,
          isBase: entry.isBase,
          grouped: piece.cards.length > 1,
          dragging,
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
    if (target.closest('.card-node, .piece-chrome, .empty-state, button, input, a')) return;

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
    data-card-count={game.cardCount}
    data-piece-count={game.pieces.length}
  >
    <div class="canvas-head" aria-hidden="true">
      <div class="canvas-status">
        <span class="status-spark"></span>
        <span class="status-label">Workbench</span>
        <span class="status-divider"></span>
        <span class="status-count">{countLabel}</span>
      </div>
      <div class="canvas-tip">
        <span><i class="tip-dot snap"></i>Overlap to snap</span>
        <span><i class="tip-dot pull"></i>Digit end pulls out</span>
      </div>
    </div>

    {#if game.pieces.length === 0}
      <EmptyState />
    {/if}

    <div class="cards-layer">
      {#each cards as entry (entry.card.id)}
        <CardNode
          card={entry.card}
          pieceId={entry.pieceId}
          x={entry.x}
          y={entry.y}
          z={entry.z}
          theme={game.theme}
          mode={entry.mode}
          isBase={entry.isBase}
          grouped={entry.grouped}
          xray={game.xray}
          dragging={entry.dragging}
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
    background-image:
      linear-gradient(to right, var(--canvas-grid) 1px, transparent 1px),
      linear-gradient(to bottom, var(--canvas-grid) 1px, transparent 1px),
      radial-gradient(circle at 20% -10%, var(--canvas-glow) 0%, transparent 55%);
    background-size:
      24px 24px,
      24px 24px,
      100% 100%;
    box-shadow:
      var(--shadow-sm),
      inset 0 1px 0 rgba(255, 255, 255, 0.55);
    isolation: isolate;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
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

  .canvas-status,
  .canvas-tip {
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
  }

  .canvas-status {
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

  .canvas-tip {
    gap: 12px;
    padding: 0 10px;
  }

  .canvas-tip span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .tip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .tip-dot.snap {
    background: var(--halo);
  }

  .tip-dot.pull {
    background: var(--peel);
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
    .canvas-tip {
      display: none;
    }

    .workbench {
      border-radius: 18px;
    }
  }
</style>
