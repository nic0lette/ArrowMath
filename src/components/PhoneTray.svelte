<script lang="ts">
  import ArrowCard from 'arrow-cards/svelte';
  import { getArrowCardWidth, THEMES } from 'arrow-cards';
  import { game } from '../lib/state.svelte';
  import { placeTier, type Place } from '../lib/geometry';
  import { lockTrayGesture } from '../lib/trayGesture';

  /**
   * The card tray on a phone. It stays closed until asked for, so the bench
   * gets the screen, and shows one place at a time. Upright it rises from the
   * bottom; on its side it opens down the right, where there is width to spare.
   * It slides away once a card is pulled out of it and comes back after the drop.
   */
  let { side = false }: { side?: boolean } = $props();

  const places: Array<{ place: Place; title: string; short: string }> = [
    { place: 1000, title: 'Thousands', short: '1000s' },
    { place: 100, title: 'Hundreds', short: '100s' },
    { place: 10, title: 'Tens', short: '10s' },
    { place: 1, title: 'Ones', short: '1s' },
  ];
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  let open = $state(false);
  let place = $state<Place>(1);
  let makeValue = $state('');
  let panel: HTMLElement | undefined = $state();
  let strip: HTMLElement | undefined = $state();

  // The tray only slides away once a card has been pulled out of it. Hiding it
  // as soon as a drag starts would also catch a swipe along the cards, and
  // moving the tray from under the finger stops it scrolling.
  let pulledOut = $state(false);
  const view = $derived(
    !open ? 'closed' : game.bankDrag?.active && pulledOut ? 'hidden' : 'open',
  );

  $effect(() => {
    if (!game.bankDrag) {
      pulledOut = false;
      return;
    }
    const node = panel;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const onMove = (event: PointerEvent) => {
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inside) pulledOut = true;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  });
  const title = $derived(places.find((entry) => entry.place === place)?.title ?? '');

  // Tell the store what the open tray covers, so new cards land in sight.
  // While it is away for a drag, the last report stands: it is coming back.
  $effect(() => {
    const node = panel;
    if (!node || view === 'closed') {
      game.setTrayCover(null);
      return;
    }
    if (view === 'hidden') return;
    const report = () => game.setTrayCover({ rect: node.getBoundingClientRect(), side });
    // Measure once the slide-in has finished, and whenever the tray resizes.
    const settle = setTimeout(report, 240);
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => {
      clearTimeout(settle);
      observer.disconnect();
    };
  });

  $effect(() => () => game.setTrayCover(null));

  function choosePlace(next: Place) {
    place = next;
    strip?.scrollTo({ left: 0, top: 0 });
  }

  function onTabKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = places[(index + step + places.length) % places.length];
    choosePlace(next.place);
    const tabs = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs?.[places.indexOf(next)]?.focus();
  }

  function beginDrag(event: PointerEvent, digit: number) {
    event.stopPropagation();
    game.beginBankDrag(event, { place, digit });
  }

  function keyboardAdd(event: MouseEvent, digit: number) {
    if (event.detail === 0) game.addBankCard({ place, digit });
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

{#if !open}
  <button class="tray-launcher" class:side type="button" aria-label="Open card tray" onclick={() => (open = true)}>
    <span class="launcher-icon" aria-hidden="true">
      <span class="mini-card mini-1"></span>
      <span class="mini-card mini-2"></span>
      <span class="mini-card mini-3"></span>
    </span>
    Cards
  </button>
{/if}

<section
  class="phone-tray"
  class:side
  bind:this={panel}
  data-phone-tray
  data-state={view}
  aria-label="Arrow card tray"
  inert={!open}
>
  <header class="tray-head">
    <div class="place-tabs" role="tablist" aria-label="Place">
      {#each places as entry, index (entry.place)}
        {@const colors = THEMES[game.theme][placeTier(entry.place)]}
        <button
          class="place-tab"
          type="button"
          role="tab"
          aria-selected={place === entry.place}
          aria-controls="phone-tray-cards"
          aria-label={entry.title}
          tabindex={place === entry.place ? 0 : -1}
          style="--place-color: {colors.accent}; --place-soft: {colors.bg}; --place-border: {colors.border}"
          onclick={() => choosePlace(entry.place)}
          onkeydown={(event) => onTabKeyDown(event, index)}
        >
          {entry.short}
        </button>
      {/each}
    </div>
    <button class="close-button" type="button" aria-label="Close card tray" onclick={() => (open = false)}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        {#if side}
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        {:else}
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        {/if}
      </svg>
    </button>
  </header>

  <div
    class="phone-strip"
    id="phone-tray-cards"
    role="tabpanel"
    aria-label="{title} cards"
    bind:this={strip}
    use:lockTrayGesture={side ? 'y' : 'x'}
  >
    {#each digits as digit (`${place}-${digit}`)}
      {@const width = getArrowCardWidth(place)}
      <button
        class="bank-card"
        class:picked={game.bankDrag?.active &&
          game.bankDrag.source === 'bank' &&
          game.bankDrag.cards[0].place === place &&
          game.bankDrag.cards[0].digit === digit}
        type="button"
        style="--card-w: {width}px"
        aria-label="Add {digit} {title.toLowerCase()} card, {digit * place}"
        data-bank-place={place}
        data-bank-digit={digit}
        onpointerdown={(event) => beginDrag(event, digit)}
        onclick={(event) => keyboardAdd(event, digit)}
      >
        <span class="bank-card-scale" style:width="{width}px">
          <ArrowCard {place} {digit} theme={game.theme} idPrefix="phone-{place}-{digit}" />
        </span>
      </button>
    {/each}
  </div>

  <form class="maker" onsubmit={(event) => event.preventDefault()}>
    <div class="number-field">
      <span class="number-hash" aria-hidden="true">#</span>
      <input
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
    <button class="make-button primary" type="button" onclick={() => handleMake('stacked')}>Add Stacked</button>
    <button class="make-button" type="button" onclick={() => handleMake('cards')}>Add Cards</button>
    <button class="make-button" type="button" aria-label="Add Plus" onclick={() => game.addSum()}>
      <span class="plus-glyph" aria-hidden="true">+</span> Plus
    </button>
  </form>
</section>

<style>
  .phone-tray {
    --bank-scale: 0.6;
    position: absolute;
    z-index: 20;
    left: 8px;
    right: 8px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px 10px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: color-mix(in srgb, var(--panel) 96%, transparent);
    box-shadow:
      0 -6px 24px rgba(15, 23, 42, 0.12),
      var(--shadow-sm);
    backdrop-filter: blur(8px);
    transition:
      transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 160ms ease;
  }

  .phone-tray[data-state='closed'],
  .phone-tray[data-state='hidden'] {
    transform: translateY(calc(100% + 16px));
    opacity: 0;
    pointer-events: none;
  }

  .phone-tray.side {
    left: auto;
    top: 0;
    width: 252px;
  }

  .side .place-tab {
    padding: 0 2px;
    font-size: 11px;
    letter-spacing: -0.02em;
  }

  .phone-tray.side[data-state='closed'],
  .phone-tray.side[data-state='hidden'] {
    transform: translateX(calc(100% + 16px));
  }

  .tray-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .place-tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    flex: 1;
    gap: 4px;
    padding: 3px;
    border-radius: 11px;
    background: var(--surface-muted);
  }

  .place-tab {
    height: 34px;
    padding: 0 4px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--muted-strong);
    font: inherit;
    font-size: 12px;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    box-shadow: inset 0 -3px 0 -1px color-mix(in srgb, var(--place-color) 55%, transparent);
  }

  .place-tab[aria-selected='true'] {
    border-color: var(--place-border);
    background: var(--place-soft);
    color: var(--ink);
    box-shadow: inset 0 -3px 0 -1px var(--place-color);
  }

  .place-tab:focus-visible,
  .close-button:focus-visible,
  .make-button:focus-visible,
  .tray-launcher:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .close-button {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  /* Upright: two rows that scroll sideways. Ones fit five by two. */
  .phone-strip {
    display: grid;
    /* 1–5 on top, 6–9 underneath, read like a number line. */
    grid-template-columns: repeat(5, max-content);
    justify-content: start;
    gap: 8px 8px;
    padding: 4px 2px 2px;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior: contain;
    scrollbar-width: none;
    touch-action: pan-x;
  }

  .phone-strip::-webkit-scrollbar {
    display: none;
  }

  /* On its side: a column that scrolls up and down, cards wrapping in rows. */
  .side .phone-strip {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    overflow-x: hidden;
    overflow-y: auto;
    touch-action: pan-y;
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
    touch-action: pan-x;
    -webkit-touch-callout: none;
    transition:
      transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 150ms ease;
  }

  .side .bank-card {
    touch-action: pan-y;
  }

  .bank-card.picked {
    transform: scale(0.97);
    opacity: 0.6;
  }

  .bank-card-scale {
    display: block;
    transform: scale(var(--bank-scale));
    transform-origin: top left;
    line-height: 0;
    pointer-events: none;
  }

  .maker {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .side .maker {
    flex-wrap: wrap;
  }

  .number-field {
    display: flex;
    align-items: center;
    flex: 1 1 64px;
    min-width: 64px;
    height: 36px;
    border: 1px solid var(--line-strong);
    border-radius: 9px;
    background: var(--panel);
  }

  .number-hash {
    padding-left: 8px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 650;
  }

  .number-field input {
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 0 6px 0 3px;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    /* 16px stops iOS zooming the page when the field is focused. */
    font-size: 16px;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
  }

  .make-button {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: 0 0 auto;
    height: 36px;
    padding: 0 9px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--panel);
    color: var(--muted-strong);
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }

  .make-button.primary {
    border-color: transparent;
    background: var(--ink);
    color: var(--panel);
  }

  .plus-glyph {
    font-size: 15px;
    font-weight: 800;
    line-height: 1;
  }

  .tray-launcher {
    position: absolute;
    z-index: 20;
    right: 16px;
    bottom: 18px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 48px;
    padding: 0 16px 0 10px;
    border: 0;
    border-radius: 999px;
    background: var(--ink);
    color: var(--panel);
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.25);
    font: inherit;
    font-size: 14px;
    font-weight: 750;
    cursor: pointer;
    animation: launcher-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .launcher-icon {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel) 14%, transparent);
  }

  .mini-card {
    position: absolute;
    left: 5px;
    height: 5px;
    border-radius: 2px;
  }

  .mini-1 {
    top: 7px;
    width: 14px;
    background: #f87171;
  }

  .mini-2 {
    top: 12px;
    width: 17px;
    background: #4ade80;
  }

  .mini-3 {
    top: 17px;
    width: 11px;
    background: #facc15;
  }

  @keyframes launcher-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .phone-tray,
    .bank-card,
    .tray-launcher {
      transition: none;
      animation: none;
    }
  }
</style>
