<script lang="ts">
  import ArrowCard from 'arrow-cards/svelte';
  import { getArrowCardWidth, THEMES } from 'arrow-cards';
  import { game } from '../lib/state.svelte';
  import { placeTier, type Place } from '../lib/geometry';
  import { lockTrayGesture } from '../lib/trayGesture';

  const rows: Array<{
    place: Place;
    title: string;
    hint: string;
  }> = [
    { place: 1000, title: 'Thousands', hint: '0,000 – 9,000' },
    { place: 100, title: 'Hundreds', hint: '000 – 900' },
    { place: 10, title: 'Tens', hint: '00 – 90' },
    { place: 1, title: 'Ones', hint: '0 – 9' },
  ];
  // Zero cards hold an empty place open, so 205 can read 200 + 00 + 5.
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const strips = $state<Record<number, HTMLDivElement | null>>({});

  let makeValue = $state('');
  let scrollEdges = $state<Record<number, { left: boolean; right: boolean }>>({});

  function watchScroll(node: HTMLDivElement, place: Place) {
    let frame = 0;
    let destroyed = false;

    const measure = () => {
      if (destroyed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (destroyed) return;
        const left = node.scrollLeft > 2;
        const right = node.scrollLeft + node.clientWidth < node.scrollWidth - 2;
        scrollEdges = { ...scrollEdges, [place]: { left, right } };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    node.addEventListener('scroll', measure, { passive: true });
    const settle = setTimeout(measure, 180);

    return {
      destroy() {
        destroyed = true;
        cancelAnimationFrame(frame);
        clearTimeout(settle);
        observer.disconnect();
        node.removeEventListener('scroll', measure);
      },
    };
  }

  function beginDrag(event: PointerEvent, place: Place, digit: number) {
    event.stopPropagation();
    game.beginBankDrag(event, { place, digit });
  }

  function keyboardAdd(event: MouseEvent, place: Place, digit: number) {
    if (event.detail === 0) {
      game.addBankCard({ place, digit });
    }
  }

  function scrollRow(place: Place, direction: number) {
    const strip = strips[place];
    strip?.scrollBy({ left: direction * 280, behavior: 'smooth' });
  }

  function handleMake(mode: 'cards' | 'stacked') {
    if (mode === 'stacked') game.makeNumber(makeValue, 'stack');
    else game.makeNumberAsCards(makeValue);
  }

  function onNumberInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    makeValue = input.value.replace(/\D/g, '').slice(0, 4);
    input.value = makeValue;
  }

  function onMakeKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleMake('stacked');
    }
  }
</script>

<section class="bank" class:collapsed={!game.bankOpen} aria-label="Arrow card tray">
  <header class="bank-head">
    <div class="bank-heading">
      <span class="tray-icon" aria-hidden="true">
        <span class="tray-card tray-card-1"></span>
        <span class="tray-card tray-card-2"></span>
        <span class="tray-card tray-card-3"></span>
      </span>
      <div class="bank-title-text">
        <h2>Card tray</h2>
        <p>Drag onto the bench, or tap to add</p>
      </div>
    </div>

    <form class="maker" onsubmit={(event) => event.preventDefault()}>
      <label class="maker-label" for="make-number">
        Make <span class="maker-label-suffix">a number</span>
      </label>
      <div class="number-field">
        <span class="number-hash" aria-hidden="true">#</span>
        <input
          id="make-number"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          spellcheck="false"
          maxlength="4"
          placeholder="4325"
          value={makeValue}
          aria-label="Number to make, from 1 to 9999"
          oninput={onNumberInput}
          onkeydown={onMakeKeyDown}
        />
      </div>
      <button class="make-button" type="button" onclick={() => handleMake('cards')} title="Add each place value as its own card">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <rect x="1.5" y="4.5" width="4" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
          <rect x="6.5" y="4.5" width="4" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
          <rect x="11.5" y="4.5" width="3" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
        </svg>
        <span>Add Cards</span>
      </button>
      <button class="make-button primary" type="button" onclick={() => handleMake('stacked')} title="Add the number as one stacked group">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path d="M2 5.5h12M2 8h12M2 10.5h12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          <path d="M5 3v1.5M8 3v1.5M11 3v1.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.5" />
        </svg>
        <span>Add Stacked</span>
      </button>
    </form>

    <button
      class="make-button plus-button"
      type="button"
      title="Add a plus, then drag a number to each side of it"
      onclick={() => game.addSum()}
    >
      <span class="plus-glyph" aria-hidden="true">+</span>
      <span>Add Plus</span>
    </button>

    <button
      class="collapse-button"
      type="button"
      aria-expanded={game.bankOpen}
      aria-label={game.bankOpen ? 'Collapse card tray' : 'Expand card tray'}
      title={game.bankOpen ? 'Collapse the card tray' : 'Expand the card tray'}
      onclick={() => game.toggleBank()}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" class:flip={!game.bankOpen}>
        <path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </header>

  <div class="bank-body">
    <div class="bank-body-inner" inert={!game.bankOpen}>
      {#each rows as row (row.place)}
        {@const colors = THEMES[game.theme][placeTier(row.place)]}
        <div class="bank-row" style="--place-color: {colors.accent}; --place-soft: {colors.bg}; --place-border: {colors.border}">
          <div class="bank-label">
            <span class="place-swatch" aria-hidden="true"></span>
            <div>
              <strong>{row.title}</strong>
              <small>{row.hint}</small>
            </div>
          </div>

          <div class="bank-scroller-wrap">
            <button
              class="scroll-hint left"
              class:hidden={!scrollEdges[row.place]?.left}
              type="button"
              aria-label="Scroll {row.title} cards left"
              tabindex="-1"
              onclick={() => scrollRow(row.place, -1)}
            >
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>

            <div
              class="bank-strip"
              bind:this={strips[row.place]}
              use:watchScroll={row.place}
              use:lockTrayGesture
            >
              {#each digits as digit (digit)}
                {@const width = getArrowCardWidth(row.place)}
                <button
                  class="bank-card"
                  class:picked={game.bankDrag?.active &&
                    game.bankDrag.source === 'bank' &&
                    game.bankDrag.cards[0].place === row.place &&
                    game.bankDrag.cards[0].digit === digit}
                  type="button"
                  style="--card-w: {width}px"
                  aria-label="Add {digit} {row.title.toLowerCase()} card, {digit * row.place}"
                  title="Drag or tap to add {digit * row.place}"
                  data-bank-place={row.place}
                  data-bank-digit={digit}
                  onpointerdown={(event) => beginDrag(event, row.place, digit)}
                  onclick={(event) => keyboardAdd(event, row.place, digit)}
                >
                  <span
                    class="bank-card-scale"
                    style:width="{width}px"
                    style:transform="scale(var(--bank-scale))"
                  >
                    <ArrowCard
                      place={row.place}
                      digit={digit}
                      theme={game.theme}
                      idPrefix="bank-{row.place}-{digit}"
                      className="bank-arrow-card"
                    />
                  </span>
                  <span class="bank-digit-badge" aria-hidden="true">{digit}</span>
                </button>
              {/each}
            </div>

            <button
              class="scroll-hint right"
              class:hidden={!scrollEdges[row.place]?.right}
              type="button"
              aria-label="Scroll {row.title} cards right"
              tabindex="-1"
              onclick={() => scrollRow(row.place, 1)}
            >
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .bank {
    flex: 0 0 auto;
    margin: 0 clamp(14px, 2vw, 26px) max(10px, env(safe-area-inset-bottom));
    padding: 10px 14px 8px;
    border: 1px solid var(--line);
    border-radius: 20px;
    background: var(--panel);
    box-shadow: var(--shadow-sm);
    --bank-scale: 0.6;
  }

  .bank-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    min-height: 44px;
    padding: 0 2px 8px;
  }

  .bank-heading {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;
  }

  .tray-icon {
    position: relative;
    display: block;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: var(--surface-muted);
    border: 1px solid var(--line);
  }

  .tray-card {
    position: absolute;
    left: 6px;
    height: 6px;
    border-radius: 2px;
  }

  .tray-card::after {
    content: '';
    position: absolute;
    top: 0;
    right: -3px;
    border-top: 3px solid transparent;
    border-bottom: 3px solid transparent;
    border-left: 4px solid currentColor;
  }

  .tray-card-1 {
    top: 7px;
    width: 16px;
    background: #fee2e2;
    color: #ef4444;
  }

  .tray-card-2 {
    top: 13px;
    width: 19px;
    background: #dcfce7;
    color: #22c55e;
  }

  .tray-card-3 {
    top: 19px;
    width: 13px;
    background: #fef9c3;
    color: #eab308;
  }

  .bank-title-text h2 {
    margin: 0;
    color: var(--ink);
    font-size: 13.5px;
    font-weight: 750;
    letter-spacing: -0.015em;
    line-height: 1.2;
  }

  .bank-title-text p {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 10.5px;
    line-height: 1.3;
  }

  .maker {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .maker-label {
    margin-right: 2px;
    color: var(--muted);
    font-size: 10.5px;
    font-weight: 700;
    white-space: nowrap;
  }

  .number-field {
    position: relative;
    display: flex;
    align-items: center;
    height: 32px;
    border: 1px solid var(--line-strong);
    border-radius: 9px;
    background: var(--panel);
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  .number-field:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 13%, transparent);
  }

  .number-hash {
    padding-left: 9px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 650;
  }

  .number-field input {
    width: 78px;
    height: 100%;
    padding: 0 8px 0 3px;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  .number-field input::placeholder {
    color: color-mix(in srgb, var(--muted) 60%, transparent);
    font-weight: 600;
  }

  .make-button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--panel);
    color: var(--muted-strong);
    font: inherit;
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .make-button:hover {
    border-color: var(--line-strong);
    background: var(--surface-muted);
    color: var(--ink);
  }

  .plus-glyph {
    font-size: 15px;
    font-weight: 800;
    line-height: 1;
  }

  .make-button.primary {
    border-color: transparent;
    background: var(--ink);
    color: var(--panel);
  }

  .make-button.primary:hover {
    background: var(--accent);
    color: #fff;
  }

  .make-button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .collapse-button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .collapse-button:hover {
    background: var(--surface-muted);
    color: var(--ink);
  }

  .collapse-button svg {
    transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .collapse-button svg.flip {
    transform: rotate(180deg);
  }

  .bank-body {
    display: grid;
    grid-template-rows: 1fr;
    transition:
      grid-template-rows 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 180ms ease;
  }

  .bank.collapsed .bank-body {
    grid-template-rows: 0fr;
    opacity: 0;
  }

  .bank-body-inner {
    min-height: 0;
    overflow: hidden;
  }

  .bank-row {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: calc(68px * var(--bank-scale) + 12px);
    border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  }

  .bank-row:first-child {
    border-top: 0;
  }

  .bank-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 2px;
  }

  .place-swatch {
    width: 4px;
    height: 27px;
    border-radius: 3px;
    background: var(--place-color);
    opacity: 0.85;
  }

  .bank-label strong {
    display: block;
    color: var(--ink);
    font-size: 11.5px;
    font-weight: 750;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .bank-label small {
    display: block;
    margin-top: 1px;
    color: var(--muted);
    font-size: 9.5px;
    font-weight: 550;
    font-variant-numeric: tabular-nums;
    line-height: 1.3;
  }

  .bank-scroller-wrap {
    position: relative;
    min-width: 0;
  }

  .bank-strip {
    display: flex;
    align-items: center;
    gap: 7px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 4px 20px 5px 2px;
    scrollbar-width: none;
    touch-action: pan-x;
    overscroll-behavior-x: contain;
  }

  .bank-strip::-webkit-scrollbar {
    display: none;
  }

  .bank-card {
    position: relative;
    flex: 0 0 auto;
    width: calc(var(--card-w) * var(--bank-scale));
    height: calc(68px * var(--bank-scale));
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    cursor: grab;
    /* Let a horizontal swipe pan the tray. Vertical/diagonal drags stay with
       the pointer handlers so a card can still be pulled onto the bench. */
    touch-action: pan-x;
    -webkit-touch-callout: none;
    transition:
      transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1),
      filter 150ms ease,
      opacity 150ms ease;
    transform-origin: center;
  }

  .bank-card:hover {
    transform: translateY(-3px);
    filter: drop-shadow(0 7px 8px rgba(15, 23, 42, 0.14));
    z-index: 2;
  }

  .bank-card:active,
  .bank-card.picked {
    cursor: grabbing;
    transform: translateY(-1px) scale(0.98);
    opacity: 0.72;
  }

  .bank-card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  .bank-card-scale {
    display: block;
    transform-origin: top left;
    line-height: 0;
    pointer-events: none;
  }

  .bank-digit-badge {
    position: absolute;
    right: -1px;
    top: -2px;
    display: none;
  }

  .scroll-hint {
    position: absolute;
    top: 50%;
    z-index: 3;
    display: grid;
    place-items: center;
    width: 20px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    color: var(--muted);
    box-shadow: var(--shadow-xs);
    transform: translateY(-50%);
    opacity: 0.6;
    cursor: pointer;
    transition:
      opacity 120ms ease,
      color 120ms ease;
    backdrop-filter: blur(4px);
  }

  .scroll-hint:hover {
    opacity: 1;
    color: var(--ink);
  }

  .scroll-hint.hidden {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .scroll-hint.left {
    left: 0;
  }

  .scroll-hint.right {
    right: 0;
  }

  @media (max-width: 1180px) {
    .bank {
      --bank-scale: 0.54;
    }
  }

  @media (max-width: 980px) {
    .bank {
      --bank-scale: 0.49;
    }

    .bank-head {
      flex-wrap: wrap;
      gap: 8px 12px;
    }

    .maker {
      order: 3;
      width: 100%;
      justify-content: flex-end;
    }

    .bank-row {
      grid-template-columns: 94px minmax(0, 1fr);
    }

    .bank-title-text p {
      display: none;
    }

    .collapse-button {
      order: 2;
      margin-left: auto;
    }
  }

  @media (max-width: 640px) {
    .bank {
      margin-inline: 8px;
      padding-inline: 10px;
      --bank-scale: 0.46;
    }

    .maker-label-suffix {
      display: none;
    }

    .make-button {
      padding-inline: 8px;
      font-size: 9.5px;
    }

    .number-field input {
      width: 58px;
    }
  }

  @media (pointer: coarse) {
    .collapse-button {
      width: 40px;
      height: 40px;
    }

    .scroll-hint {
      width: 28px;
      height: 36px;
    }

    .bank-strip {
      padding-right: 30px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bank-body,
    .bank-card,
    .collapse-button svg {
      transition: none;
    }
  }
</style>
