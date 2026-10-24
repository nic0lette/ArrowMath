<script lang="ts">
  import ArrowCard from 'arrow-cards/svelte';
  import { game } from '../lib/state.svelte';
  import { layoutPiece, type Card, type PieceMode } from '../lib/geometry';

  let dialogEl: HTMLDialogElement | undefined = $state();
  let demoMode = $state<PieceMode>('stack');
  let peek = $state(false);

  const demoCards: Card[] = [
    { id: 'guide-thousands', place: 1000, digit: 4 },
    { id: 'guide-hundreds', place: 100, digit: 3 },
    { id: 'guide-tens', place: 10, digit: 2 },
    { id: 'guide-ones', place: 1, digit: 5 },
  ];
  const scale = 0.5;
  const demoLayout = $derived(layoutPiece(demoCards, demoMode));
  const demoWidth = $derived(demoLayout.width * scale);
  const resultLeft = $derived(demoWidth + 14);

  $effect(() => {
    if (game.guideOpen && dialogEl && !dialogEl.open) {
      dialogEl.showModal();
      // Initial focus on the title (not the Close button) so an impatient
      // Enter does not immediately re-close the guide.
      dialogEl.querySelector<HTMLElement>('#guide-title')?.focus();
    } else if (!game.guideOpen && dialogEl?.open) {
      dialogEl.close();
    }
  });

  function handleClose() {
    game.closeGuide();
  }

  function handleBackdrop(event: MouseEvent) {
    if (event.target === dialogEl) game.closeGuide();
  }
</script>

<dialog
  bind:this={dialogEl}
  class="guide-dialog"
  aria-labelledby="guide-title"
  onclose={handleClose}
  onclick={handleBackdrop}
>
  <div class="guide-panel">
    <header class="guide-head">
      <div class="guide-heading">
        <span class="guide-icon" aria-hidden="true">
          <svg viewBox="0 0 40 40" width="34" height="34">
            <rect x="1" y="1" width="38" height="38" rx="11" fill="var(--accent-soft)" />
            <path d="M7 11h18l7 6.5-7 6.5H7a2.5 2.5 0 0 1-2.5-2.5v-8A2.5 2.5 0 0 1 7 11Z" fill="#fff" stroke="#3b82f6" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M14 20h16l5 5-5 5H14a2.5 2.5 0 0 1-2.5-2.5v-5A2.5 2.5 0 0 1 14 20Z" fill="var(--panel)" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </span>
        <div>
          <span class="guide-eyebrow">Teacher guide</span>
          <h2 id="guide-title">How arrow cards work</h2>
        </div>
      </div>
      <button class="guide-close" type="button" aria-label="Close guide" onclick={() => game.closeGuide()}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 4 8 8M12 4 4 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
    </header>

    <div class="guide-scroll">
      <p class="guide-lede">
        Arrow cards make place value physical. Each card has a pointed arrow that slides over the
        zeros of a larger card — so a stack of cards reads as a single number.
      </p>

      <section class="demo-card" aria-label="Interactive arrow card demonstration">
        <div class="demo-top">
          <div class="demo-title">
            <span class="demo-kicker">4 thousands · 3 hundreds · 2 tens · 5 ones</span>
            <strong>{demoMode === 'stack' ? 'Stacked' : 'Expanded'}</strong>
          </div>
          <div class="demo-controls">
            <div class="segmented" role="group" aria-label="Card display mode">
              <button
                type="button"
                class:active={demoMode === 'stack'}
                aria-pressed={demoMode === 'stack'}
                onclick={() => (demoMode = 'stack')}
              >Stacked</button>
              <button
                type="button"
                class:active={demoMode === 'expand'}
                aria-pressed={demoMode === 'expand'}
                onclick={() => (demoMode = 'expand')}
              >Expanded</button>
            </div>
            <label class="peek-toggle" class:disabled={demoMode === 'expand'}>
              <input type="checkbox" bind:checked={peek} disabled={demoMode === 'expand'} />
              <span>X-ray zeros</span>
            </label>
          </div>
        </div>

        <div class="demo-stage">
          <div class="demo-canvas" style:min-width="{demoWidth + 118}px">
            <div class="demo-arrow-group" style:width="{demoWidth}px">
              {#each demoLayout.cards as entry (entry.card.id)}
                <div
                  class="demo-arrow"
                  class:peek={peek && demoMode === 'stack' && !entry.isBase}
                  style:left="{entry.localX * scale}px"
                  style:width="{entry.width * scale}px"
                  style:opacity={peek && demoMode === 'stack' && !entry.isBase ? 0.88 : 1}
                >
                  <div
                    style:width="{entry.width}px"
                    style:transform="scale({scale})"
                    style:transform-origin="top left"
                  >
                    <ArrowCard
                      place={entry.card.place}
                      digit={entry.card.digit}
                      theme={game.theme}
                      idPrefix="guide-{entry.card.id}"
                      className="guide-demo-card"
                      showZeroGhost={peek && demoMode === 'stack' && !entry.isBase}
                    />
                  </div>
                </div>
              {/each}

              {#each demoLayout.operators as operator, index (index)}
                <span
                  class="demo-plus"
                  style:left="{operator.x * scale}px"
                  style:top="{operator.y * scale}px"
                  style:width="{operator.width * scale}px"
                  style:height="{operator.height * scale}px"
                >+</span>
              {/each}
            </div>

            <span class="demo-result" style:left="{resultLeft}px">
              <span class="demo-equals">=</span> 4,325
            </span>
          </div>
        </div>

        <p class="demo-caption">
          {#if demoMode === 'stack'}
            {#if peek}
              X-ray is on: the card fills become see-through so the covered zeros underneath show
              through. The visible digits still read 4,325.
            {:else}
              The arrow tips align on the right. Each smaller card sits over the zeros beneath it,
              so the stack reads as 4,325.
            {/if}
          {:else}
            Expanded, every place value appears on its own card: 4,000 + 300 + 20 + 5 = 4,325.
          {/if}
        </p>
      </section>

      <div class="big-idea">
        <span class="idea-mark" aria-hidden="true">“</span>
        <p>
          The zeros never disappear. They are <strong>hidden</strong> underneath the next card. That
          is why 4,000 + 300 + 20 + 5 becomes <strong>4,325</strong>.
        </p>
        <span class="idea-tag">The big idea</span>
      </div>

      <section class="principles" aria-label="Three key principles">
        <article>
          <span class="principle-number">01</span>
          <h3>Right-align the tips</h3>
          <p>A smaller card sits over the zeros on the right of a larger card, keeping every digit in its true column.</p>
        </article>
        <article>
          <span class="principle-number">02</span>
          <h3>Overlap to combine</h3>
          <p>Drag one card well over another and they snap into a stack with one clean result.</p>
        </article>
        <article>
          <span class="principle-number">03</span>
          <h3>Touch edges to chain</h3>
          <p>A shallow edge overlap lays the cards out as a number sentence — perfect for reading aloud.</p>
        </article>
      </section>

      <section class="teacher-tips">
        <div class="tips-heading">
          <span class="tips-icon" aria-hidden="true">✦</span>
          <h3>Quick classroom moves</h3>
        </div>
        <ul>
          <li><strong>Ask, “What is hiding under the 3?”</strong> Toggle X-ray and prove the zeros are still there.</li>
          <li><strong>Pull the digit end to take a card out.</strong> Make 4,325, drag the 300 card out by its flat left end, and the group becomes 4,025. Slide a 700 card in to make 4,725.</li>
          <li><strong>Move the whole number</strong> by dragging the arrow spine of a stack or the number chip in its toolbar. In expanded view, use the number chip. The glow tells you which will happen.</li>
          <li><strong>Expand, then stack.</strong> Read the number sentence first, then build the compact number. Double-click a group to switch between the two.</li>
          <li><strong>Use “Make a number”.</strong> Type a target such as 4,325, then add it as separate cards for pupils to assemble.</li>
          <li><strong>Same-place cards bounce.</strong> That is the column rule: one card per place value in a group.</li>
        </ul>
      </section>

      <div class="guide-note">
        <span aria-hidden="true">⌨</span>
        <p>Cards can be nudged with the arrow keys and removed with Delete. Drag a card's digit end to pull it out. In a stack, drag the arrow side or the number chip to move the group; when expanded, use the number chip. Double-click a group to expand or stack it.</p>
      </div>
    </div>

    <footer class="guide-foot">
      <span>Arrow Math · place value made visible</span>
      <button type="button" onclick={() => game.closeGuide()}>Got it</button>
    </footer>
  </div>
</dialog>

<style>
  .guide-dialog {
    width: min(820px, calc(100vw - 28px));
    max-width: none;
    max-height: none;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    overflow: visible;
  }

  .guide-dialog::backdrop {
    background: color-mix(in srgb, #0f172a 48%, transparent);
    backdrop-filter: blur(5px);
  }

  .guide-dialog[open] {
    animation: dialog-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .guide-panel {
    display: flex;
    flex-direction: column;
    max-height: min(88dvh, 860px);
    border: 1px solid var(--line);
    border-radius: 24px;
    background: var(--panel);
    box-shadow: 0 30px 80px rgba(15, 23, 42, 0.28);
    overflow: hidden;
  }

  .guide-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 22px;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--panel) 92%, transparent);
  }

  .guide-heading {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .guide-icon {
    display: flex;
    flex: 0 0 auto;
    filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.08));
  }

  .guide-eyebrow {
    display: block;
    color: var(--accent);
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.13em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .guide-head h2 {
    margin: 2px 0 0;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.15;
  }

  .guide-close {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--panel);
    color: var(--muted);
    cursor: pointer;
  }

  .guide-close:hover {
    background: var(--surface-muted);
    color: var(--ink);
  }

  .guide-scroll {
    overflow-y: auto;
    padding: 20px 24px 24px;
    scrollbar-width: thin;
    scrollbar-color: var(--line-strong) transparent;
  }

  .guide-lede {
    margin: 0 0 18px;
    max-width: 650px;
    color: var(--muted-strong);
    font-size: 13.5px;
    line-height: 1.65;
  }

  .demo-card {
    border: 1px solid var(--line);
    border-radius: 18px;
    background:
      radial-gradient(circle at 12% 10%, color-mix(in srgb, var(--accent) 5%, transparent), transparent 45%),
      var(--canvas-bg);
    background-image:
      linear-gradient(to right, var(--canvas-grid) 1px, transparent 1px),
      linear-gradient(to bottom, var(--canvas-grid) 1px, transparent 1px);
    background-size: 24px 24px;
    padding: 14px;
  }

  .demo-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 10px;
  }

  .demo-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .demo-kicker {
    color: var(--muted);
    font-size: 9.5px;
    font-weight: 650;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .demo-title strong {
    color: var(--ink);
    font-size: 13px;
    font-weight: 750;
  }

  .demo-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .segmented {
    display: flex;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
  }

  .segmented button {
    height: 25px;
    padding: 0 9px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }

  .segmented button.active {
    background: var(--accent);
    color: #fff;
  }

  .segmented button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .peek-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--muted-strong);
    font-size: 10px;
    font-weight: 650;
    cursor: pointer;
  }

  .peek-toggle.disabled {
    opacity: 0.45;
    cursor: default;
  }

  .peek-toggle input {
    width: 13px;
    height: 13px;
    margin: 0;
    accent-color: var(--accent);
  }

  .demo-stage {
    overflow-x: auto;
    overflow-y: hidden;
    padding: 6px 2px 4px;
  }

  .demo-canvas {
    position: relative;
    height: calc(68px * 0.5 + 12px);
    min-height: 50px;
    display: flex;
    align-items: center;
  }

  .demo-arrow-group {
    position: relative;
    height: calc(68px * 0.5);
    transition: width 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .demo-arrow {
    position: absolute;
    top: 0;
    line-height: 0;
    transition:
      left 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 200ms ease;
  }

  .demo-arrow.peek :global(.guide-demo-card > path:first-of-type) {
    fill-opacity: 0.3;
  }

  .demo-arrow.peek :global(.guide-demo-card > path:nth-of-type(2)) {
    opacity: 0.12;
  }

  .demo-plus {
    position: absolute;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    color: var(--muted);
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
    transition: opacity 200ms ease;
  }

  .demo-result {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--panel);
    color: var(--ink);
    font-size: 12px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    box-shadow: var(--shadow-xs);
    transition: left 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .demo-equals {
    color: var(--muted);
    font-weight: 600;
  }

  .demo-caption {
    margin: 6px 2px 0;
    color: var(--muted);
    font-size: 10.5px;
    line-height: 1.5;
  }

  .big-idea {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin: 18px 0;
    padding: 14px 16px 14px 46px;
    border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--line));
    border-radius: 13px;
    background: color-mix(in srgb, var(--accent) 5%, var(--panel));
  }

  .idea-mark {
    position: absolute;
    left: 15px;
    top: 8px;
    color: var(--accent);
    font-family: Georgia, serif;
    font-size: 32px;
    line-height: 1;
    opacity: 0.5;
  }

  .big-idea p {
    margin: 0;
    color: var(--muted-strong);
    font-size: 12.5px;
    line-height: 1.6;
  }

  .big-idea strong {
    color: var(--ink);
    font-weight: 750;
  }

  .idea-tag {
    position: absolute;
    top: -8px;
    right: 12px;
    padding: 2px 7px;
    border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--line));
    border-radius: 999px;
    background: var(--panel);
    color: var(--accent);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .principles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .principles article {
    position: relative;
    padding: 14px 13px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--panel);
  }

  .principle-number {
    display: inline-block;
    margin-bottom: 8px;
    color: var(--accent);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .principles h3 {
    margin: 0 0 5px;
    color: var(--ink);
    font-size: 12px;
    font-weight: 750;
    letter-spacing: -0.01em;
  }

  .principles p {
    margin: 0;
    color: var(--muted);
    font-size: 10.5px;
    line-height: 1.5;
  }

  .teacher-tips {
    margin-top: 18px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: var(--surface-muted);
  }

  .tips-heading {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 8px;
  }

  .tips-icon {
    color: #b45309;
    font-size: 12px;
  }

  .teacher-tips h3 {
    margin: 0;
    color: var(--ink);
    font-size: 12.5px;
    font-weight: 750;
  }

  .teacher-tips ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding-left: 17px;
    color: var(--muted-strong);
    font-size: 11px;
    line-height: 1.5;
  }

  .teacher-tips strong {
    color: var(--ink);
    font-weight: 700;
  }

  .guide-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 14px;
    padding: 0 2px;
    color: var(--muted);
    font-size: 10px;
    line-height: 1.5;
  }

  .guide-note span {
    color: var(--muted);
    font-size: 12px;
  }

  .guide-note p {
    margin: 0;
  }

  .guide-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 22px;
    border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--panel) 94%, transparent);
  }

  .guide-foot span {
    color: var(--muted);
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .guide-foot button {
    height: 32px;
    padding: 0 15px;
    border: 0;
    border-radius: 8px;
    background: var(--ink);
    color: var(--panel);
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .guide-foot button:hover {
    background: var(--accent);
    color: #fff;
  }

  @keyframes dialog-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.985);
    }
  }

  @media (max-width: 640px) {
    .guide-head {
      padding: 14px 16px;
    }

    .guide-scroll {
      padding: 16px;
    }

    .guide-head h2 {
      font-size: 19px;
    }

    .principles {
      grid-template-columns: 1fr;
    }

    .guide-foot span {
      display: none;
    }

    .guide-foot {
      justify-content: flex-end;
    }

  }

  @media (pointer: coarse) {
    .guide-close {
      width: 38px;
      height: 38px;
    }

    .segmented button {
      height: 32px;
      padding-inline: 12px;
    }

    .peek-toggle input {
      width: 20px;
      height: 20px;
    }

    .guide-foot button {
      height: 38px;
      padding-inline: 18px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .guide-dialog[open] {
      animation: none;
    }

    .demo-arrow-group,
    .demo-arrow,
    .demo-result,
    .demo-plus {
      transition: none;
    }
  }
</style>
