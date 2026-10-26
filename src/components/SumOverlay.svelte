<script lang="ts">
  import ArrowCard from 'arrow-cards/svelte';
  import { game } from '../lib/state.svelte';
  import { ROW_SCALE, isRevealed, isTotalRevealed, sumLayout, type Sum } from '../lib/addition';
  import { formatNumber, pieceValue } from '../lib/geometry';

  interface Props {
    sum: Sum;
  }

  let { sum }: Props = $props();

  const left = $derived(game.pieces.find((piece) => piece.id === sum.left) ?? null);
  const right = $derived(game.pieces.find((piece) => piece.id === sum.right) ?? null);
  const layout = $derived(sumLayout(sum, left, right));
  const totalShown = $derived(isTotalRevealed(sum, left, right));
  const selected = $derived(game.selectedSumId === sum.id && !game.selectedId);
  const label = $derived(
    left && right
      ? `Plus: ${formatNumber(pieceValue(left.cards))} + ${formatNumber(pieceValue(right.cards))}`
      : 'Plus. Drag a number to each side to add them.',
  );

  function hovering(side: 'left' | 'right'): boolean {
    return game.sumHover?.sumId === sum.id && game.sumHover.side === side;
  }

  function beginDrag(event: PointerEvent) {
    event.stopPropagation();
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    game.beginSumDrag(event, sum.id);
  }

  function onPlusKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      game.selectSum(sum.id);
    }
  }
</script>

<div class="sum-overlay" data-sum-id={sum.id} data-left={sum.left ?? ''} data-right={sum.right ?? ''}>
  {#each ['left', 'right'] as const as side (side)}
    {#if !sum[side]}
      {@const slot = side === 'left' ? layout.leftSlot : layout.rightSlot}
      <div
        class="sum-slot"
        class:aimed={hovering(side)}
        data-slot={side}
        style:left="{slot.x}px"
        style:top="{slot.y}px"
        style:width="{slot.width}px"
        style:height="{slot.height}px"
        aria-hidden="true"
      >
        Drop a number
      </div>
    {/if}
  {/each}

  <div
    class="sum-plus"
    class:selected
    role="button"
    tabindex="0"
    aria-label="{label}. Drag to move."
    title="Drag to move the sum"
    data-sum-handle
    style:left="{layout.plus.x}px"
    style:top="{layout.plus.y}px"
    style:width="{layout.plus.width}px"
    style:height="{layout.plus.height}px"
    onpointerdown={beginDrag}
    onkeydown={onPlusKey}
    ondblclick={(event) => {
      event.stopPropagation();
      if (layout.toggle) game.toggleCollapsed(sum.id);
    }}
  >
    +
  </div>

  {#if layout.toggle}
    <button
      class="sum-toggle"
      class:collapsed={sum.collapsed}
      type="button"
      aria-expanded={!sum.collapsed}
      aria-label="{sum.collapsed ? 'Show' : 'Hide'} the place rows"
      title="{sum.collapsed ? 'Show' : 'Hide'} the place rows (or double-click the plus)"
      style:left="{layout.toggle.x}px"
      style:top="{layout.toggle.y}px"
      style:width="{layout.toggle.width}px"
      style:height="{layout.toggle.height}px"
      onpointerdown={(event) => event.stopPropagation()}
      onclick={(event) => {
        event.stopPropagation();
        game.toggleCollapsed(sum.id);
      }}
    >
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  {/if}

  {#if selected}
    <button
      class="sum-remove"
      type="button"
      title="Remove the plus (the numbers stay)"
      aria-label="Remove the plus"
      style:left="{layout.plus.x + layout.plus.width - 6}px"
      style:top="{layout.plus.y - 20}px"
      onpointerdown={(event) => event.stopPropagation()}
      onclick={(event) => {
        event.stopPropagation();
        game.removeSum(sum.id);
      }}
    >
      <!-- Same trash icon as the group toolbar's remove button. -->
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
        <path d="M3.5 4.5h9M6.5 4.5V3.2c0-.39.31-.7.7-.7h1.6c.39 0 .7.31.7.7v1.3M5 4.5l.6 8.1c.03.5.45.9.96.9h2.88c.51 0 .93-.4.96-.9l.6-8.1" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  {/if}

  {#if layout.equals && layout.total && left && right}
    {@const total = layout.total}
    <button
      class="row-equals total-equals"
      class:shown={totalShown}
      type="button"
      aria-pressed={totalShown}
      aria-label="{totalShown ? 'Hide' : 'Show'} {formatNumber(pieceValue(left.cards))} + {formatNumber(pieceValue(right.cards))}"
      style:left="{layout.equals.x}px"
      style:top="{layout.equals.y}px"
      style:width="{layout.equals.width}px"
      style:height="{layout.equals.height}px"
      onpointerdown={(event) => event.stopPropagation()}
      onclick={(event) => {
        event.stopPropagation();
        game.toggleTotal(sum.id);
      }}>=</button
    >

    {#if totalShown}
      <div class="sum-total" data-total={total.value}>
        {#if total.overflow !== null}
          <span
            class="row-overflow total-overflow"
            style:left="{total.x}px"
            style:top="{total.y}px"
            style:width="{total.width}px"
            style:height="{total.height}px">{formatNumber(total.overflow)}</span
          >
        {:else}
          {#each total.cards as entry (entry.place)}
            <div
              class="mini-card copyable"
              data-total-card
              role="button"
              tabindex="-1"
              aria-label="Drag out a copy of {formatNumber(total.value)}"
              title="Drag out a copy"
              onpointerdown={(event) => game.beginAnswerDrag(event, total.cards)}
              data-place={entry.place}
              data-digit={entry.digit}
              style:left="{entry.x}px"
              style:top="{entry.y}px"
              style:width="{entry.width}px"
              style:height="{entry.height}px"
            >
              <ArrowCard
                place={entry.place}
                digit={entry.digit}
                theme={game.theme}
                idPrefix="sum-{sum.id}-total-{entry.place}"
              />
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  {/if}

  {#each layout.rows as row (row.place)}
    {@const shown = isRevealed(sum, row)}
    <div class="sum-row" data-row-place={row.place}>
      {#each [{ box: row.leftCard, digit: row.left, part: 'left' }, { box: row.rightCard, digit: row.right, part: 'right' }] as entry (entry.part)}
        <div
          class="mini-card"
          data-part={entry.part}
          data-place={row.place}
          data-digit={entry.digit}
          style:left="{entry.box.x}px"
          style:top="{entry.box.y}px"
          style:width="{entry.box.width}px"
          style:height="{entry.box.height}px"
        >
          <span class="mini-scale" style:transform="scale({ROW_SCALE})">
            <ArrowCard
              place={row.place}
              digit={entry.digit}
              theme={game.theme}
              idPrefix="sum-{sum.id}-{row.place}-{entry.part}"
            />
          </span>
        </div>
      {/each}

      <span
        class="row-plus"
        style:left="{row.plus.x}px"
        style:top="{row.plus.y}px"
        style:width="{row.plus.width}px"
        style:height="{row.plus.height}px"
        aria-hidden="true">+</span
      >

      <button
        class="row-equals"
        class:shown
        type="button"
        aria-pressed={shown}
        aria-label="{shown ? 'Hide' : 'Show'} {formatNumber(row.left * row.place)} + {formatNumber(row.right * row.place)}"
        style:left="{row.equals.x}px"
        style:top="{row.equals.y}px"
        style:width="{row.equals.width}px"
        style:height="{row.equals.height}px"
        onpointerdown={(event) => event.stopPropagation()}
        onclick={(event) => {
          event.stopPropagation();
          game.toggleReveal(sum.id, row.place);
        }}>=</button
      >

      {#if shown}
        {#if row.overflow !== null}
          <span
            class="row-overflow"
            data-result
            style:left="{row.result.x}px"
            style:top="{row.result.y}px"
            style:height="{row.result.height}px">{formatNumber(row.overflow)}</span
          >
        {:else}
          {#each row.resultCards as result (result.place)}
            <div
              class="mini-card result copyable"
              data-result
              role="button"
              tabindex="-1"
              aria-label="Drag out a copy of {formatNumber(row.left * row.place + row.right * row.place)}"
              title="Drag out a copy"
              onpointerdown={(event) => game.beginAnswerDrag(event, row.resultCards)}
              data-place={result.place}
              data-digit={result.digit}
              style:left="{result.x}px"
              style:top="{result.y}px"
              style:width="{result.width}px"
              style:height="{result.height}px"
            >
              <span class="mini-scale" style:transform="scale({ROW_SCALE})">
                <ArrowCard
                  place={result.place}
                  digit={result.digit}
                  theme={game.theme}
                  idPrefix="sum-{sum.id}-{row.place}-result-{result.place}"
                />
              </span>
            </div>
          {/each}
        {/if}
      {/if}
    </div>
  {/each}
</div>

<style>
  .sum-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    /* No z-index here, so this is not a stacking context: the rows and the
       plus stay under every card (so dragged cards pass over them), while
       the remove button below can still rise above the attached numbers. */
  }

  .sum-slot {
    position: absolute;
    display: grid;
    place-items: center;
    border: 2px dashed color-mix(in srgb, var(--line-strong) 70%, transparent);
    border-radius: 12px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 650;
    text-align: center;
    transition:
      border-color 120ms ease,
      background 120ms ease,
      color 120ms ease;
  }

  .sum-slot.aimed {
    border-color: var(--halo);
    background: color-mix(in srgb, var(--halo) 10%, transparent);
    color: var(--ink);
  }

  .sum-plus {
    position: absolute;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--panel);
    border: 2px solid var(--line-strong);
    box-shadow: var(--shadow-sm);
    color: var(--ink);
    font-size: 26px;
    font-weight: 800;
    line-height: 1;
    padding-bottom: 2px;
    cursor: grab;
    pointer-events: auto;
    touch-action: none;
    outline: none;
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  .sum-plus:hover {
    border-color: var(--accent);
  }

  .sum-plus:active {
    cursor: grabbing;
  }

  .sum-plus.selected,
  .sum-plus:focus-visible {
    border-color: var(--accent);
    box-shadow:
      var(--shadow-sm),
      0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent);
  }

  .sum-toggle {
    position: absolute;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: var(--panel);
    color: var(--muted-strong);
    box-shadow: var(--shadow-xs);
    cursor: pointer;
    pointer-events: auto;
    transition:
      color 120ms ease,
      border-color 120ms ease;
  }

  .sum-toggle svg {
    transition: transform 160ms ease;
  }

  /* Points up to fold the rows away, down to bring them back. */
  .sum-toggle.collapsed svg {
    transform: rotate(180deg);
  }

  .sum-toggle:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .sum-toggle:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .sum-remove {
    position: absolute;
    display: grid;
    place-items: center;
    width: 27px;
    height: 27px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    color: var(--muted);
    box-shadow: var(--shadow-xs);
    cursor: pointer;
    pointer-events: auto;
    /* Above any card: card z-indexes are 20 + piece.z * 8 + index. */
    z-index: 100000;
  }

  .sum-remove:hover {
    background: color-mix(in srgb, var(--danger) 10%, var(--panel));
    color: var(--danger);
  }

  .sum-remove:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .mini-card {
    position: absolute;
    line-height: 0;
    animation: row-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .copyable {
    cursor: grab;
    pointer-events: auto;
    touch-action: none;
  }

  .copyable:active {
    cursor: grabbing;
  }

  .mini-scale {
    display: inline-block;
    transform-origin: top left;
  }

  .row-plus {
    position: absolute;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--panel);
    border: 1.5px solid var(--line);
    color: var(--muted-strong);
    font-size: 15px;
    font-weight: 800;
    line-height: 1;
    padding-bottom: 1px;
  }

  .row-equals {
    position: absolute;
    display: grid;
    place-items: center;
    padding: 0 0 2px;
    border: 1.5px solid var(--line-strong);
    border-radius: 10px;
    background: var(--panel);
    color: var(--ink);
    font: inherit;
    font-size: 19px;
    font-weight: 800;
    line-height: 1;
    box-shadow: var(--shadow-xs);
    cursor: pointer;
    pointer-events: auto;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .row-equals:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .total-equals {
    border-radius: 12px;
    font-size: 24px;
  }

  .row-equals.shown {
    border-color: transparent;
    background: var(--ink);
    color: var(--panel);
  }

  .row-equals:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .row-overflow {
    position: absolute;
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    border-radius: 10px;
    background: var(--panel);
    border: 1px solid var(--line);
    color: var(--ink);
    font-size: 18px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .total-overflow {
    justify-content: flex-end;
    font-size: 26px;
  }

  @keyframes row-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  @media (pointer: coarse) {
    .sum-remove {
      width: 34px;
      height: 34px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mini-card {
      animation: none;
    }
  }
</style>
