<script lang="ts">
  import { game } from '../lib/state.svelte';
  import { formatNumber } from '../lib/geometry';

  const halo = $derived(game.hover);
  const below = $derived(halo ? halo.bounds.y < 52 : false);
  const labelEnd = $derived(
    halo ? halo.bounds.x + halo.bounds.width > game.canvas.width - 58 : false,
  );
  const labelStart = $derived(halo ? halo.bounds.x < 58 : false);
  const label = $derived(
    halo
      ? halo.kind === 'conflict'
        ? 'Same Place (Bounces)'
        : halo.kind === 'stack'
          ? 'Snap Together'
          : 'Chain Together'
      : '',
  );
  const icon = $derived(halo?.kind === 'conflict' ? '⚠️' : '✨');
</script>

{#if halo}
  <div
    class="halo"
    class:conflict={halo.kind === 'conflict'}
    class:chain={halo.kind === 'chain'}
    class:label-below={below}
    class:label-end={labelEnd}
    class:label-start={!labelEnd && labelStart}
    style:left="{halo.bounds.x}px"
    style:top="{halo.bounds.y}px"
    style:width="{halo.bounds.width}px"
    style:height="{halo.bounds.height}px"
    aria-hidden="true"
  >
    <span class="halo-pulse"></span>
    <span class="halo-label">
      <span class="halo-icon">{icon}</span>
      <span class="halo-text">{label}</span>
      {#if halo.targetValue > 0}
        <span class="halo-value">{formatNumber(halo.targetValue)}</span>
      {/if}
    </span>
  </div>
{/if}

<style>
  .halo {
    position: absolute;
    z-index: 4000;
    pointer-events: none;
    border: 2px solid var(--halo);
    border-radius: 18px;
    background: color-mix(in srgb, var(--halo) 7%, transparent);
    box-shadow:
      0 0 0 5px color-mix(in srgb, var(--halo) 13%, transparent),
      0 8px 26px color-mix(in srgb, var(--halo) 22%, transparent);
    transition:
      left 70ms linear,
      top 70ms linear,
      width 70ms linear,
      height 70ms linear,
      border-color 120ms ease,
      background 120ms ease;
  }

  .halo.conflict {
    border-color: var(--warn);
    background: color-mix(in srgb, var(--warn) 9%, transparent);
    box-shadow:
      0 0 0 5px color-mix(in srgb, var(--warn) 16%, transparent),
      0 8px 26px color-mix(in srgb, var(--warn) 24%, transparent);
  }

  .halo.chain {
    border-style: dashed;
  }

  .halo-label {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 10px);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--panel);
    border: 1px solid color-mix(in srgb, var(--halo) 30%, var(--line));
    box-shadow: var(--shadow-md);
    color: var(--halo-ink);
    font-size: 12.5px;
    font-weight: 750;
    line-height: 1;
    white-space: nowrap;
    transform: translateX(-50%);
    animation: halo-label-in 140ms ease-out;
  }

  .halo.conflict .halo-label {
    color: var(--warn-ink);
    border-color: color-mix(in srgb, var(--warn) 38%, var(--line));
  }

  .halo.label-below .halo-label {
    bottom: auto;
    top: calc(100% + 10px);
  }

  .halo.label-end .halo-label {
    left: auto;
    right: 0;
    transform: none;
  }

  .halo.label-start .halo-label {
    left: 0;
    right: auto;
    transform: none;
  }

  .halo-icon {
    font-size: 13px;
  }

  .halo-value {
    padding-left: 7px;
    margin-left: 1px;
    border-left: 1px solid var(--line);
    color: var(--muted);
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }

  .halo-pulse {
    position: absolute;
    inset: -4px;
    border-radius: 20px;
    border: 1.5px solid color-mix(in srgb, var(--halo) 45%, transparent);
    animation: halo-pulse 1.4s ease-out infinite;
  }

  .halo.conflict .halo-pulse {
    border-color: color-mix(in srgb, var(--warn) 55%, transparent);
  }

  @keyframes halo-pulse {
    0% {
      opacity: 0.65;
      transform: scale(0.995);
    }
    70% {
      opacity: 0;
      transform: scale(1.025);
    }
    100% {
      opacity: 0;
    }
  }

  @keyframes halo-label-in {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .halo,
    .halo-label,
    .halo-pulse {
      animation: none;
      transition: none;
    }
  }
</style>
