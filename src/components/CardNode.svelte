<script lang="ts">
  import ArrowCard from 'arrow-cards/svelte';
  import { getArrowCardWidth, type ColorTheme } from 'arrow-cards';
  import { cardMotion, type SpringConfig } from '../lib/cardMotion';
  import { game } from '../lib/state.svelte';
  import { isPeelZone, placeTier, type Card, type PieceMode } from '../lib/geometry';

  interface Props {
    card: Card;
    pieceId: string;
    x: number;
    y: number;
    z: number;
    theme: ColorTheme;
    mode: PieceMode;
    isBase: boolean;
    grouped: boolean;
    xray: boolean;
    dragging: boolean;
    covered: boolean;
    visibleWidth: number;
    spring: SpringConfig;
  }

  let {
    card,
    pieceId,
    x,
    y,
    z,
    theme,
    mode,
    isBase,
    grouped,
    xray,
    dragging,
    covered,
    visibleWidth,
    spring,
  }: Props = $props();

  const width = $derived(getArrowCardWidth(card.place));
  const showThrough = $derived(xray && mode === 'stack' && !isBase);
  const elId = $derived(`card-${card.id.replace(/[^a-zA-Z0-9_-]/g, '')}`);
  const value = $derived(card.digit * card.place);
  const peelLift = $derived(
    grouped && game.intent?.kind === 'peel' && game.intent.cardId === card.id,
  );
  const moveIntent = $derived(
    grouped && game.intent?.kind === 'move' && game.intent.pieceId === pieceId,
  );
  // Leave a few pixels of the hidden part under the covering card so the cut
  // edge stays tucked away instead of peeking through its rounded corners.
  const liftClip = $derived(Math.min(width, visibleWidth + 8));

  // Hold the clip for the length of the settle so a card leaving the aim state
  // cannot flash its hidden portion above the cards on top of it.
  let clipHold = $state(false);
  $effect(() => {
    if (peelLift) {
      clipHold = true;
      return;
    }
    if (!clipHold) return;
    const timer = setTimeout(() => {
      clipHold = false;
    }, 200);
    return () => clearTimeout(timer);
  });
  const liftClipped = $derived(covered && clipHold);
  const placeTierName = $derived(placeTier(card.place));
  const actionLabel = $derived(
    !grouped
      ? 'Drag to move.'
      : mode === 'expand'
        ? 'Drag to pull this card out of the group.'
        : 'Drag the digit end to pull this card out; drag the arrow end to move the group.',
  );

  function intentFor(event: PointerEvent): 'peel' | 'move' | null {
    if (!grouped) return null;
    if (mode === 'expand') return 'peel';
    const target = event.currentTarget as HTMLElement;
    return isPeelZone(event.clientX, target.getBoundingClientRect().left) ? 'peel' : 'move';
  }

  function updateIntent(event: PointerEvent) {
    // Touch has no hover phase. Showing the mouse-only aim lift while a finger
    // rests on a card leaves it stuck on afterwards.
    if (event.pointerType === 'touch' || game.isInteracting) return;
    const kind = intentFor(event);
    if (!kind) {
      game.clearIntentForCard(pieceId, card.id);
      return;
    }
    game.setIntent({ pieceId, cardId: card.id, kind });
  }

  function onPointerEnter(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    game.setHoveredPiece(pieceId);
    updateIntent(event);
  }

  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    game.setHoveredPiece(null);
    if (!game.isInteracting) game.clearIntentForCard(pieceId, card.id);
  }

  function onPointerDown(event: PointerEvent) {
    const target = event.currentTarget as HTMLElement;
    target.focus({ preventScroll: true });
    event.stopPropagation();
    game.beginCardDrag(event, pieceId, card.id, intentFor(event) ?? 'move');
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      game.selectPiece(pieceId);
    }
  }
</script>

<div
  class="card-node"
  class:dragging
  class:show-through={showThrough}
  class:peel-lift={peelLift}
  class:lift-clipped={liftClipped}
  class:move-intent={moveIntent}
  style:z-index={z}
  style:width="{width}px"
  style:height="68px"
  style:--card-lift-clip="{liftClip}px"
  use:cardMotion={{ x, y, immediate: dragging, spring }}
  role="button"
  tabindex="0"
  aria-label="{card.digit} {placeTierName} card, {value}. {actionLabel}"
  data-piece={pieceId}
  data-card-id={card.id}
  data-place={card.place}
  data-digit={card.digit}
  data-dragging={dragging ? 'true' : 'false'}
  onpointerdown={onPointerDown}
  onpointerenter={onPointerEnter}
  onpointermove={updateIntent}
  onpointerleave={onPointerLeave}
  onkeydown={onKeyDown}
>
  <!-- The ArrowCard SVG carries its own aria-label; hiding it keeps screen
       readers announcing the value once, from the container's full label. -->
  <div class="card-inner" aria-hidden="true">
    <ArrowCard
      place={card.place}
      digit={card.digit}
      theme={theme}
      idPrefix={elId}
      className="workbench-card"
      showZeroGhost={xray && mode === 'stack' && !isBase}
    />
    {#if showThrough}
      <span class="peek-edge" aria-hidden="true"></span>
    {/if}
  </div>
</div>

<style>
  .card-node {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 12px;
    outline: none;
    cursor: grab;
    touch-action: none;
    -webkit-touch-callout: none;
    user-select: none;
    transform-origin: center;
  }

  .card-node.dragging {
    cursor: grabbing;
  }

  .card-node:focus-visible {
    box-shadow:
      0 0 0 3px var(--canvas-bg, #fff),
      0 0 0 6px var(--accent);
  }

  .card-inner {
    position: relative;
    width: 100%;
    height: 68px;
    line-height: 0;
    transform-origin: 48% 55%;
    transition:
      transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 220ms ease,
      filter 180ms ease;
  }

  .card-node:not(.dragging):hover .card-inner {
    transform: translateY(-4px);
    filter: drop-shadow(0 10px 12px rgba(15, 23, 42, 0.14));
  }

  /* Aiming at the flat, leading-digit end: this card alone lifts. A card that
     is buried in a stack is clipped to its exposed part, so it slides up from
     under the cards on top rather than rising through them. */
  .card-node.peel-lift:not(.dragging) .card-inner {
    transform: translateY(-5px);
    filter:
      drop-shadow(0 10px 10px rgba(15, 23, 42, 0.16))
      drop-shadow(0 2px 3px rgba(15, 23, 42, 0.1));
    transition:
      transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 220ms ease,
      filter 180ms ease;
  }

  .card-node.lift-clipped:not(.dragging) .card-inner {
    clip-path: inset(-16px calc(100% - var(--card-lift-clip)) -18px -16px);
  }

  /* Aiming at the arrow side: the whole group lifts as one object. */
  .card-node.move-intent:not(.dragging) .card-inner {
    transform: translateY(-4px);
    filter: drop-shadow(0 10px 12px rgba(15, 23, 42, 0.16));
  }

  /* Soften the internal card outlines so the stack reads as one object. */
  .card-node.move-intent :global(.arrow-card-svg > path:first-of-type) {
    stroke-opacity: 0.42;
    transition: stroke-opacity 160ms ease;
  }

  .card-node.dragging .card-inner {
    transform: scale(1.035) rotate(-1.1deg);
    filter: drop-shadow(0 18px 22px rgba(15, 23, 42, 0.2));
  }

  .card-node.show-through .card-inner {
    opacity: 0.88;
  }

  /* X-ray: keep the top card's digits and outline crisp, but let its fill go
     translucent so the covered zeros on the card underneath show through. */
  .card-node.show-through :global(.arrow-card-svg > path:first-of-type) {
    fill-opacity: 0.3;
    transition: fill-opacity 220ms ease;
  }

  .card-node.show-through :global(.arrow-card-svg > path:nth-of-type(2)) {
    opacity: 0.12;
  }

  .peek-edge {
    pointer-events: none;
    position: absolute;
    inset: 0;
    border-radius: 10px 28px 28px 10px;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 8%, transparent);
  }

  @media (pointer: coarse) {
    /* The arrow tip is only 28px wide, which is narrower than a fingertip.
       Extend the grab area past the front edge so a stack is easier to pick
       up by its arrow end, without changing where the card is drawn. */
    .card-node::after {
      content: '';
      position: absolute;
      top: 0;
      right: -20px;
      bottom: 0;
      width: 20px;
      touch-action: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-inner {
      transition: none;
    }
    .card-node.move-intent :global(.arrow-card-svg > path:first-of-type) {
      transition: none;
    }
  }
</style>
