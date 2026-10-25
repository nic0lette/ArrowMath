<script lang="ts">
  import { THEMES } from 'arrow-cards';
  import { game } from '../lib/state.svelte';
  import {
    formatNumber,
    layoutPiece,
    numberToWords,
    pieceValue,
    placeTier,
    type Piece,
  } from '../lib/geometry';

  interface Props {
    piece: Piece;
  }

  let { piece }: Props = $props();

  const layout = $derived(layoutPiece(piece.cards, piece.mode));
  const value = $derived(pieceValue(piece.cards));
  const colors = $derived(THEMES[game.theme][placeTier(piece.cards[0].place)]);
  const isDragging = $derived(game.draggingPieceId === piece.id);
  const isSelected = $derived(game.selectedId === piece.id);
  const keepChromeForChromeDrag = $derived(game.draggingFromChrome && isDragging);
  // The toolbar is how the selection shows, so only the selected piece gets
  // one. Hover alone would put a second toolbar on another group.
  const showChrome = $derived(
    (!game.isInteracting || keepChromeForChromeDrag) &&
      (!isDragging || keepChromeForChromeDrag) &&
      piece.spring !== 'bounce' &&
      (isSelected || keepChromeForChromeDrag),
  );
  // Number words sit just under the cards, or just above them when the piece
  // is too close to the bottom edge. The toolbar steps around them.
  const WORDS_GAP = 4;
  const WORDS_HEIGHT = 20;
  const words = $derived(numberToWords(value));
  let wordsWidth = $state(0);
  const wordsBelow = $derived(
    piece.y + layout.height + WORDS_GAP + WORDS_HEIGHT <= game.canvas.height - 4,
  );
  const wordsTop = $derived(
    wordsBelow ? piece.y + layout.height + WORDS_GAP : piece.y - WORDS_GAP - WORDS_HEIGHT,
  );
  // Long words beside the right edge shift left rather than being cut off.
  const wordsLeft = $derived(
    Math.max(8, Math.min(piece.x, game.canvas.width - 8 - wordsWidth)),
  );
  const wordsSpace = WORDS_GAP + WORDS_HEIGHT;
  const belowTop = $derived(
    piece.y + layout.height + 10 + (game.showWords && wordsBelow ? wordsSpace : 0),
  );
  const aboveTop = $derived(piece.y - 44 - (game.showWords && !wordsBelow ? wordsSpace : 0));
  const chromeAbove = $derived(aboveTop >= 10 || belowTop + 38 > game.canvas.height - 8);
  const chromeTop = $derived(chromeAbove ? Math.max(8, aboveTop) : belowTop);
  const chromeMin = $derived(piece.cards.length > 1 ? 172 : 118);
  const chromeLeft = $derived(
    Math.min(
      Math.max(piece.x + layout.width, chromeMin),
      Math.max(chromeMin, game.canvas.width - 8),
    ),
  );
  const isExpanded = $derived(piece.mode === 'expand');
  // On a plus, the sum's own rows give the answers, and the plus sits where
  // this chip would.
  const attached = $derived(game.isAttached(piece.id));
  const overlayZ = $derived(20 + piece.z * 8 + 6);

  function toggleMode(event: MouseEvent) {
    event.stopPropagation();
    game.toggleMode(piece.id);
  }

  function remove(event: MouseEvent) {
    event.stopPropagation();
    game.removePiece(piece.id);
  }

  function keepChromeVisible() {
    game.setHoveredPiece(piece.id);
  }

  function enterValue(event: PointerEvent) {
    event.stopPropagation();
    keepChromeVisible();
    game.setIntent({ pieceId: piece.id, cardId: null, kind: 'move' });
  }

  function leaveValue() {
    if (!game.isInteracting) game.clearIntentForMoveHandle(piece.id);
  }

  function beginValueDrag(event: PointerEvent) {
    event.stopPropagation();
    event.preventDefault();
    game.beginChromeDrag(event, piece.id);
  }

  function leaveChrome() {
    game.setHoveredPiece(null);
    if (!game.isInteracting) game.clearIntentForMoveHandle(piece.id);
  }
</script>

<div class="piece-overlay" class:dragging={isDragging} class:selected={isSelected} style:z-index={overlayZ}>
  {#if isExpanded}
    {#each layout.operators as operator, index (index)}
      <span
        class="equation-operator"
        style:left="{piece.x + operator.x}px"
        style:top="{piece.y + operator.y}px"
        style:width="{operator.width}px"
        style:height="{operator.height}px"
        style:--operator-accent={colors.accent}
        aria-hidden="true">+</span
      >
    {/each}
    {#if !attached}
    <span
      class="equation-result"
      style:left="{piece.x + layout.resultX}px"
      style:top="{piece.y + layout.height / 2}px"
      aria-label="Equals {formatNumber(value)}"
    >
      <span class="equals" aria-hidden="true">=</span>
      <span>{formatNumber(value)}</span>
    </span>
    {/if}
  {/if}

  {#if game.showWords}
    <span
      class="piece-words"
      style:left="{wordsLeft}px"
      style:top="{wordsTop}px"
      bind:offsetWidth={wordsWidth}
    >{words}</span>
  {/if}

  {#if showChrome}
    <div
      class="piece-chrome"
      class:below={!chromeAbove}
      class:no-transition={isDragging}
      style:left="{chromeLeft}px"
      style:top="{chromeTop}px"
      style:--piece-accent={colors.accent}
      role="toolbar"
      tabindex="-1"
      aria-label="Controls for {formatNumber(value)}"
      data-piece-id={piece.id}
      data-mode={piece.mode}
      onpointerenter={keepChromeVisible}
      onpointerleave={leaveChrome}
      onpointerdown={(event) => event.stopPropagation()}
    >
      <span
        class="chrome-value"
        role="button"
        tabindex="0"
        aria-label="{piece.cards.length > 1 ? 'Group' : 'Card'} {formatNumber(value)}. Drag to move, or press Enter to select."
        title="Drag to move this {piece.cards.length > 1 ? 'group' : 'card'}"
        onpointerenter={enterValue}
        onpointerleave={leaveValue}
        onpointerdown={beginValueDrag}
        onkeydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            game.selectPiece(piece.id);
          }
        }}
      >
        <span class="chrome-grip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
        <span class="chrome-dot" aria-hidden="true"></span>
        <span>{formatNumber(value)}</span>
      </span>
      {#if piece.cards.length > 1}
        <button
          class="chrome-button"
          type="button"
          title={isExpanded ? 'Stack the cards so the zeros hide (or double-click the group)' : 'Expand into a number sentence (or double-click the group)'}
          onpointerdown={(event) => event.stopPropagation()}
          onclick={toggleMode}
        >
          {#if isExpanded}
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M2 4h8M2 8h8M2 12h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              <path d="M12 8l2 0M12 4l2 0M12 12l2 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.35" />
            </svg>
            <span>Stack</span>
          {:else}
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <rect x="1" y="4" width="5" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5" />
              <rect x="10" y="4" width="5" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5" />
              <path d="M7.5 8h1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <span>Expand</span>
          {/if}
        </button>
      {/if}
      <button
        class="chrome-button icon-only remove"
        type="button"
        title="Remove this {piece.cards.length > 1 ? 'group' : 'card'}"
        aria-label="Remove {formatNumber(value)}"
        onpointerdown={(event) => event.stopPropagation()}
        onclick={remove}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path d="M3.5 4.5h9M6.5 4.5V3.2c0-.39.31-.7.7-.7h1.6c.39 0 .7.31.7.7v1.3M5 4.5l.6 8.1c.03.5.45.9.96.9h2.88c.51 0 .93-.4.96-.9l.6-8.1" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  {/if}
</div>

<style>
  .piece-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: z-index 0s;
  }

  .equation-operator {
    position: absolute;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--panel);
    border: 1.5px solid color-mix(in srgb, var(--operator-accent) 32%, var(--line));
    box-shadow: var(--shadow-xs);
    color: var(--operator-accent);
    font-size: 16px;
    font-weight: 800;
    line-height: 1;
    padding-bottom: 1px;
    pointer-events: none;
    animation: operator-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .equation-result {
    position: absolute;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 12px;
    border-radius: 11px;
    background: var(--panel);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-xs);
    color: var(--ink);
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.015em;
    white-space: nowrap;
    pointer-events: none;
    animation: result-in 240ms 40ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .piece-words {
    position: absolute;
    height: 20px;
    color: var(--muted-strong);
    font-size: 14px;
    font-weight: 650;
    line-height: 20px;
    letter-spacing: 0.005em;
    white-space: nowrap;
    pointer-events: none;
  }

  .equation-result .equals {
    color: var(--muted);
    font-weight: 600;
  }

  .piece-chrome {
    position: absolute;
    transform: translateX(-100%);
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 4px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: var(--shadow-md);
    pointer-events: auto;
    white-space: nowrap;
    transition:
      left 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
      top 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 150ms ease;
  }

  .piece-chrome::before {
    content: '';
    position: absolute;
    top: 100%;
    right: 20px;
    width: 9px;
    height: 5px;
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    background: var(--line);
  }

  .piece-chrome::after {
    content: '';
    position: absolute;
    top: calc(100% - 1px);
    right: 21px;
    width: 7px;
    height: 4px;
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    background: var(--panel);
  }

  .piece-chrome.below::before {
    top: auto;
    bottom: 100%;
    clip-path: polygon(0 100%, 100% 100%, 50% 0);
  }

  .piece-chrome.below::after {
    top: auto;
    bottom: calc(100% - 1px);
    clip-path: polygon(0 100%, 100% 100%, 50% 0);
  }

  .piece-chrome.no-transition {
    transition: none;
  }

  .piece-chrome:hover {
    border-color: color-mix(in srgb, var(--piece-accent) 25%, var(--line));
  }

  .chrome-value {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px 0 5px;
    min-height: 27px;
    border-radius: 8px;
    color: var(--ink);
    font-size: 13px;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
    cursor: grab;
    user-select: none;
    transition: background 120ms ease;
  }

  .chrome-value:hover {
    background: var(--surface-muted);
  }

  .chrome-value:active {
    cursor: grabbing;
  }

  .chrome-value:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .chrome-grip {
    display: grid;
    grid-template-columns: repeat(2, 2px);
    gap: 2px;
    opacity: 0.35;
    transition: opacity 120ms ease;
  }

  .chrome-value:hover .chrome-grip {
    opacity: 0.65;
  }

  .chrome-grip i {
    width: 2px;
    height: 2px;
    border-radius: 50%;
    background: currentColor;
  }

  .chrome-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--piece-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--piece-accent) 14%, transparent);
  }

  .chrome-button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 27px;
    padding: 0 7px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 11.5px;
    font-weight: 650;
    cursor: pointer;
    transition:
      background 120ms ease,
      color 120ms ease;
  }

  .chrome-button:hover {
    background: var(--surface-muted);
    color: var(--ink);
  }

  .chrome-button.icon-only {
    width: 27px;
    padding: 0;
    justify-content: center;
  }

  .chrome-button.remove:hover {
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    color: var(--danger);
  }

  .chrome-button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  @keyframes operator-in {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
  }

  @keyframes result-in {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(-4px);
    }
  }

  @media (pointer: coarse) {
    /* Fingers need more than a 27px toolbar row. The chrome is still only
       42px tall, so the existing above/below offsets keep the pointer clear. */
    .piece-chrome {
      padding: 3px;
      gap: 4px;
    }

    .chrome-value {
      min-height: 34px;
      padding: 0 8px 0 7px;
    }

    .chrome-button {
      height: 34px;
      padding: 0 9px;
    }

    .chrome-button.icon-only {
      width: 34px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .piece-chrome {
      transition: none;
    }
    .equation-operator,
    .equation-result {
      animation: none;
    }
  }

  :global([data-theme='vibrant']) .piece-chrome,
  :global([data-theme='vibrant']) .equation-result,
  :global([data-theme='vibrant']) .equation-operator {
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
  }
</style>
