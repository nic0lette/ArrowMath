<script lang="ts">
  import ArrowCard from 'arrow-cards/svelte';
  import { getArrowCardWidth } from 'arrow-cards';
  import { game } from '../lib/state.svelte';

  const scale = 0.58;
  const showcase = [
    { place: 1000 as const, digit: 4, top: 0 },
    { place: 100 as const, digit: 3, top: 11 },
    { place: 10 as const, digit: 2, top: 22 },
    { place: 1 as const, digit: 5, top: 33 },
  ];
  const stackWidth = getArrowCardWidth(1000) * scale;
</script>

<section class="empty-state" aria-labelledby="empty-title">
  <div class="empty-visual" aria-hidden="true">
    <span class="orb orb-one"></span>
    <span class="orb orb-two"></span>
    <div class="art-frame">
      <div class="art-stack" style:width="{stackWidth}px">
        {#each showcase as card, index (card.place)}
          {@const width = getArrowCardWidth(card.place) * scale}
          <div class="art-card" style:top="{card.top}px" style:right="0" style:width="{width}px">
            <div
              class="art-scale"
              style:width="{getArrowCardWidth(card.place)}px"
              style:transform="scale({scale})"
              style:z-index={index + 1}
            >
              <ArrowCard
                place={card.place}
                digit={card.digit}
                theme={game.theme}
                idPrefix="empty-{card.place}"
              />
            </div>
          </div>
        {/each}
      </div>
      <span class="art-result">= 4,325</span>
    </div>
    <div class="art-note art-note-top">
      <span class="note-dot"></span>
      The zeros hide underneath
    </div>
    <div class="art-note art-note-bottom">
      <span class="note-spark">✦</span>
      Right-aligned arrow tips
    </div>
  </div>

  <div class="empty-copy">
    <span class="eyebrow">Place value workbench</span>
    <h2 id="empty-title">Build a number,<br />one arrow at a time.</h2>
    <p class="lede">
      Drag a card from the tray below. Overlap the arrows to stack place values — or touch just the
      edges to build a number sentence. Once stacked, pull a card out by its flat digit end to
      change the number.
    </p>

    <div class="quick-rules">
      <span class="rule">
        <i class="rule-icon rule-blue" aria-hidden="true">
          <svg viewBox="0 0 14 14" width="12" height="12"><path d="M2 4h7M2 10h7M10 4l2 3-2 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </i>
        Overlap to snap
      </span>
      <span class="rule">
        <i class="rule-icon rule-green" aria-hidden="true">
          <svg viewBox="0 0 14 14" width="12" height="12"><path d="M2 7h10M8 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </i>
        Edge-touch to chain
      </span>
      <span class="rule">
        <i class="rule-icon rule-amber" aria-hidden="true">!</i>
        Same place bounces
      </span>
    </div>

    <div class="empty-actions">
      <button class="try-button" type="button" onclick={() => game.tryExample()}>
        Try 4,325
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <span class="empty-hint">or drag any card from the tray</span>
    </div>
  </div>
</section>

<style>
  .empty-state {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(28px, 5vw, 76px);
    padding: clamp(56px, 8vh, 96px) clamp(24px, 5vw, 72px) 40px;
    pointer-events: none;
    animation: empty-in 460ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .empty-copy {
    position: relative;
    max-width: 470px;
    pointer-events: none;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    color: var(--accent);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .eyebrow::before {
    content: '';
    width: 20px;
    height: 2px;
    border-radius: 2px;
    background: currentColor;
  }

  h2 {
    margin: 0;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: clamp(30px, 3.2vw, 46px);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.035em;
  }

  .lede {
    max-width: 430px;
    margin: 16px 0 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.65;
  }

  .quick-rules {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 22px;
  }

  .rule {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px 7px 7px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: color-mix(in srgb, var(--panel) 80%, transparent);
    color: var(--muted-strong);
    font-size: 11.5px;
    font-weight: 650;
    white-space: nowrap;
  }

  .rule-icon {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-style: normal;
    font-size: 10px;
    font-weight: 850;
  }

  .rule-blue {
    background: color-mix(in srgb, #3b82f6 13%, transparent);
    color: #2563eb;
  }

  .rule-green {
    background: color-mix(in srgb, #10b981 13%, transparent);
    color: #047857;
  }

  .rule-amber {
    background: color-mix(in srgb, #f59e0b 16%, transparent);
    color: #b45309;
  }

  .empty-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 26px;
  }

  .try-button {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    height: 42px;
    padding: 0 17px;
    border: 0;
    border-radius: 12px;
    background: var(--accent);
    color: #fff;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.22) inset,
      0 8px 18px color-mix(in srgb, var(--accent) 27%, transparent);
    font: inherit;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
    pointer-events: auto;
    transition:
      transform 150ms ease,
      box-shadow 150ms ease,
      background 150ms ease;
  }

  .try-button:hover {
    transform: translateY(-1px);
    background: var(--accent-strong);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.22) inset,
      0 10px 22px color-mix(in srgb, var(--accent) 33%, transparent);
  }

  .try-button:active {
    transform: translateY(0);
  }

  .try-button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  .empty-hint {
    color: var(--muted);
    font-size: 11.5px;
    font-weight: 550;
  }

  .empty-visual {
    position: relative;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(240px, 27vw, 330px);
    height: clamp(230px, 29vh, 300px);
    pointer-events: none;
  }

  .art-frame {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 218px;
    height: 168px;
    border: 1px dashed color-mix(in srgb, var(--line-strong) 80%, transparent);
    border-radius: 24px;
    background:
      linear-gradient(color-mix(in srgb, var(--panel) 60%, transparent), color-mix(in srgb, var(--panel) 20%, transparent));
    box-shadow: 0 18px 50px rgba(15, 23, 42, 0.06);
    transform: rotate(-1.4deg);
  }

  .art-stack {
    position: relative;
    height: 73px;
    transform: translateY(-4px);
  }

  .art-card {
    position: absolute;
    height: 40px;
  }

  .art-scale {
    transform-origin: top left;
    line-height: 0;
    filter: drop-shadow(0 2px 3px rgba(15, 23, 42, 0.1));
  }

  .art-result {
    position: absolute;
    right: -38px;
    bottom: 15px;
    padding: 6px 10px;
    border-radius: 9px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--ink);
    font-size: 13px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    box-shadow: var(--shadow-sm);
    transform: rotate(1.6deg);
  }

  .art-note {
    position: absolute;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 9px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    box-shadow: var(--shadow-xs);
    color: var(--muted-strong);
    font-size: 10.5px;
    font-weight: 650;
    white-space: nowrap;
  }

  .art-note-top {
    top: 4px;
    left: -8px;
    transform: rotate(-2.5deg);
  }

  .art-note-bottom {
    right: -18px;
    bottom: 8px;
    transform: rotate(2deg);
  }

  .note-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 3px color-mix(in srgb, #22c55e 16%, transparent);
  }

  .note-spark {
    color: #d97706;
    font-size: 11px;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(1px);
    opacity: 0.8;
  }

  .orb-one {
    width: 56px;
    height: 56px;
    top: 16px;
    right: 4px;
    background: radial-gradient(circle at 35% 35%, color-mix(in srgb, #93c5fd 70%, transparent), transparent 70%);
  }

  .orb-two {
    width: 70px;
    height: 70px;
    bottom: 20px;
    left: 2px;
    background: radial-gradient(circle at 35% 35%, color-mix(in srgb, #fde68a 62%, transparent), transparent 72%);
  }

  @keyframes empty-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  @media (max-width: 1050px) {
    .empty-visual {
      display: none;
    }

    .empty-copy {
      max-width: 540px;
      text-align: center;
    }

    .eyebrow::before {
      display: none;
    }

    .quick-rules,
    .empty-actions {
      justify-content: center;
    }
  }

  @media (max-height: 640px) {
    .empty-state {
      padding-top: 55px;
    }

    .lede {
      margin-top: 10px;
    }

    .quick-rules {
      margin-top: 14px;
    }

    .empty-actions {
      margin-top: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .empty-state {
      animation: none;
    }
  }
</style>
