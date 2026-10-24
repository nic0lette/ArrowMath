<script lang="ts">
  import ArrowCard from 'arrow-cards/svelte';
  import { getArrowCardWidth } from 'arrow-cards';
  import { game } from '../lib/state.svelte';

  const drag = $derived(game.bankDrag);
  const width = $derived(drag ? getArrowCardWidth(drag.card.place) : 0);
  const hint = $derived(
    !drag?.overCanvas
      ? 'Drag onto the workbench'
      : game.hover?.kind === 'conflict'
        ? 'Same place — will bounce'
        : game.hover
          ? 'Release to snap'
          : 'Release to place',
  );
</script>

{#if drag?.active}
  <div
    class="drag-ghost"
    class:conflict={game.hover?.kind === 'conflict'}
    class:outside={!drag.overCanvas}
    style:left="{drag.ghostX}px"
    style:top="{drag.ghostY}px"
    style:width="{width}px"
    aria-hidden="true"
  >
    <div class="ghost-card">
      <ArrowCard
        place={drag.card.place}
        digit={drag.card.digit}
        theme={game.theme}
        idPrefix="ghost-{drag.card.place}-{drag.card.digit}"
      />
    </div>
    <span class="ghost-hint">
      <span class="ghost-dot"></span>
      {hint}
    </span>
  </div>
{/if}

<style>
  .drag-ghost {
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    opacity: 0.96;
    animation: ghost-in 120ms ease-out;
  }

  .ghost-card {
    line-height: 0;
    transform: rotate(-2deg) scale(1.015);
    transform-origin: 40% 50%;
    filter: drop-shadow(0 18px 20px rgba(15, 23, 42, 0.25));
    transition: filter 120ms ease;
  }

  .drag-ghost.conflict .ghost-card {
    filter:
      drop-shadow(0 0 12px color-mix(in srgb, var(--warn) 55%, transparent))
      drop-shadow(0 16px 18px rgba(15, 23, 42, 0.2));
  }

  .drag-ghost.outside {
    opacity: 0.72;
  }

  .ghost-hint {
    position: absolute;
    top: calc(100% + 5px);
    left: 50%;
    transform: translateX(-50%) rotate(-2deg);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--panel);
    box-shadow: var(--shadow-sm);
    color: var(--muted-strong);
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 100ms ease;
  }

  .drag-ghost:not(.outside) .ghost-hint {
    opacity: 1;
  }

  .ghost-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
  }

  .drag-ghost.conflict .ghost-hint {
    color: var(--warn-ink);
    border-color: color-mix(in srgb, var(--warn) 35%, var(--line));
  }

  .drag-ghost.conflict .ghost-dot {
    background: var(--warn);
  }

  @keyframes ghost-in {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drag-ghost {
      animation: none;
    }
  }
</style>
