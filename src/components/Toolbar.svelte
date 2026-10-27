<script lang="ts">
  import type { ColorTheme } from 'arrow-cards';
  import { game } from '../lib/state.svelte';
  import { MAX_ZOOM, MIN_ZOOM } from '../lib/zoom';

  const themes: Array<{ value: ColorTheme; label: string }> = [
    { value: 'curriculum', label: 'UK Primary Curriculum' },
    { value: 'montessori', label: 'Montessori Classic' },
    { value: 'pastel', label: 'Modern Pastel' },
    { value: 'vibrant', label: 'High Contrast' },
  ];

  function changeTheme(event: Event) {
    game.setTheme((event.currentTarget as HTMLSelectElement).value as ColorTheme);
  }
</script>

<header class="topbar">
  <div class="brand">
    <span class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 44 44" width="38" height="38">
        <defs>
          <linearGradient id="brand-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#eef4ff" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="42" height="42" rx="12" fill="url(#brand-bg)" stroke="#dbe7f8" />
        <path d="M8 12h20.5l7.5 7-7.5 7H8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Z" fill="#fee2e2" stroke="#ef4444" stroke-width="1.6" stroke-linejoin="round" />
        <path d="M15 20h18.5l5.5 5.5-5.5 5.5H15a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z" fill="#dcfce7" stroke="#22c55e" stroke-width="1.6" stroke-linejoin="round" />
        <path d="M22 27h13.5l3.5 3.5-3.5 3.5H22a2.5 2.5 0 0 1-2.5-2.5v-2A2.5 2.5 0 0 1 22 27Z" fill="#fef9c3" stroke="#eab308" stroke-width="1.6" stroke-linejoin="round" />
      </svg>
    </span>
    <div class="brand-text">
      <h1>Arrow Math</h1>
      <p>Place value workbench</p>
    </div>
  </div>

  <div class="toolbar">
    <label class="theme-control">
      <span class="theme-label">Theme</span>
      <span class="select-wrap">
        <select value={game.theme} aria-label="Color theme" onchange={changeTheme}>
          {#each themes as theme (theme.value)}
            <option value={theme.value}>{theme.label}</option>
          {/each}
        </select>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </label>

    <span class="divider" aria-hidden="true"></span>

    <div class="tool-group" role="group" aria-label="Canvas options">
      <button
        class="tool-button"
        class:active={game.snapToGrid}
        type="button"
        aria-pressed={game.snapToGrid}
        aria-label="Grid snapping"
        title="Snap released cards to the 24px grid"
        onclick={() => game.toggleSnapToGrid()}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path d="M3 1.5v10.2c0 .44.36.8.8.8h10.2M3 8h8.5M8 3v10.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/>
          <rect x="5.5" y="5.5" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>
        </svg>
        <span class="tool-label">Grid snap</span>
      </button>

      <button
        class="tool-button"
        class:active={game.showWords}
        type="button"
        aria-pressed={game.showWords}
        aria-label="Number words"
        title="Show each number in words under its cards"
        onclick={() => game.toggleWords()}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path d="M1.7 8S4 3.8 8 3.8 14.3 8 14.3 8 12 12.2 8 12.2 1.7 8 1.7 8Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>
          <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.35"/>
        </svg>
        <span class="tool-label">Words</span>
      </button>

      <button
        class="tool-button"
        class:muted={game.muted}
        type="button"
        aria-pressed={game.muted}
        aria-label="Sound"
        title={game.muted ? 'Unmute sounds' : 'Mute sounds'}
        onclick={() => game.toggleMute()}
      >
        {#if game.muted}
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path d="M2.5 6h2L7 3.8v8.4L4.5 10h-2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="m10.5 6 3 4M13.5 6l-3 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        {:else}
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path d="M2.5 6h2L7 3.8v8.4L4.5 10h-2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M10 5.2a4.2 4.2 0 0 1 0 5.6M12.1 3.3a7 7 0 0 1 0 9.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        {/if}
        <span class="tool-label">{game.muted ? 'Muted' : 'Sound'}</span>
      </button>
    </div>

    <span class="divider" aria-hidden="true"></span>

    <div class="tool-group" role="group" aria-label="Zoom">
      <button
        class="tool-button zoom-step"
        type="button"
        aria-label="Zoom out"
        title="Make everything on the workbench smaller"
        disabled={game.zoom <= MIN_ZOOM}
        onclick={() => game.zoomOut()}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path d="M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
      <button
        class="tool-button zoom-level"
        type="button"
        aria-label="Reset zoom"
        title="Back to full size"
        onclick={() => game.resetZoom()}
      >
        {Math.round(game.zoom * 100)}%
      </button>
      <button
        class="tool-button zoom-step"
        type="button"
        aria-label="Zoom in"
        title="Make everything on the workbench larger"
        disabled={game.zoom >= MAX_ZOOM}
        onclick={() => game.zoomIn()}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path d="M3.5 8h9M8 3.5v9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <span class="divider" aria-hidden="true"></span>

    <div class="tool-group" role="group" aria-label="Workbench actions">
      <button
        class="tool-button arrange-action"
        type="button"
        aria-label="Snap all cards"
        title="Snap every card into neat rows"
        onclick={() => game.tidyAll()}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path d="M2 4.5h6M2 8h9M2 11.5h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="m12.5 3 .6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7Z" fill="currentColor" opacity="0.7"/>
        </svg>
        <span class="tool-label">Snap all</span>
      </button>

      <button
        class="tool-button danger"
        type="button"
        aria-label={game.activeStart ? 'Reset to start' : 'Reset canvas'}
        title={game.activeStart ? 'Bring back the saved start' : 'Clear the workbench'}
        onclick={() => game.resetCanvas()}
      >
        {#if game.activeStart}
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4M3.2 2.6v2.6h2.6" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {:else}
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path d="M3.5 4.5h9M6.5 4.5V3.2c0-.39.31-.7.7-.7h1.6c.39 0 .7.31.7.7v1.3M5 4.5l.6 8.1c.03.5.45.9.96.9h2.88c.51 0 .93-.4.96-.9l.6-8.1" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
        <span class="tool-label">Reset</span>
      </button>
    </div>

    <button
      class="guide-button"
      type="button"
      aria-label="How arrow cards work"
      title="How arrow cards work"
      onclick={() => game.openGuide()}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <path d="M2.8 3.3A1.3 1.3 0 0 1 4.1 2h3.4c.8 0 1.5.6 1.5 1.4V14c0-.8-.7-1.4-1.5-1.4H4.1a1.3 1.3 0 0 1-1.3-1.3V3.3ZM13.2 3.3A1.3 1.3 0 0 0 11.9 2H8.5C7.7 2 7 2.6 7 3.4V14c0-.8.7-1.4 1.5-1.4h3.4a1.3 1.3 0 0 0 1.3-1.3V3.3Z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>
      </svg>
      <span>How it works</span>
    </button>
  </div>
</header>

<style>
  .topbar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 10px clamp(16px, 2.1vw, 28px) 12px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;
  }

  .brand-mark {
    display: flex;
    filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.08));
  }

  .brand-text h1 {
    margin: 0;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1.1;
  }

  .brand-text p {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.035em;
    text-transform: uppercase;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .theme-control {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .theme-label {
    color: var(--muted);
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .select-wrap select {
    appearance: none;
    height: 32px;
    min-width: 154px;
    padding: 0 28px 0 10px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--panel);
    color: var(--muted-strong);
    font: inherit;
    font-size: 11px;
    font-weight: 650;
    cursor: pointer;
    transition:
      border-color 120ms ease,
      background 120ms ease;
  }

  .select-wrap select:hover {
    border-color: var(--line-strong);
    background: var(--surface-muted);
  }

  .select-wrap select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .select-wrap svg {
    position: absolute;
    right: 10px;
    color: var(--muted);
    pointer-events: none;
  }

  .divider {
    width: 1px;
    height: 21px;
    background: var(--line);
    flex: 0 0 auto;
  }

  .tool-group {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel) 70%, transparent);
  }

  .tool-button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 10.5px;
    font-weight: 650;
    cursor: pointer;
    transition:
      background 120ms ease,
      color 120ms ease,
      opacity 120ms ease;
  }

  .tool-button:hover {
    background: var(--surface-muted);
    color: var(--ink);
  }

  .tool-button.active {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .tool-button.muted {
    opacity: 0.7;
  }

  .tool-button.danger:hover {
    background: color-mix(in srgb, var(--danger) 9%, transparent);
    color: var(--danger);
  }

  .tool-button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .tool-button:disabled {
    opacity: 0.35;
    cursor: default;
    background: transparent;
    color: var(--muted);
  }

  .zoom-step {
    width: 28px;
    padding: 0;
    justify-content: center;
  }

  .zoom-level {
    min-width: 42px;
    padding: 0 4px;
    justify-content: center;
    font-variant-numeric: tabular-nums;
  }

  .guide-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: var(--ink);
    color: var(--panel);
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 120ms ease,
      transform 120ms ease;
  }

  .guide-button:hover {
    background: var(--accent);
    color: #fff;
    transform: translateY(-1px);
  }

  .guide-button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (max-width: 1180px) {
    .theme-label {
      display: none;
    }

    .select-wrap select {
      min-width: 138px;
    }
  }

  @media (max-width: 1020px) {
    .brand-text p {
      display: none;
    }

    .toolbar {
      gap: 6px;
    }

    .divider {
      display: none;
    }
  }

  @media (max-width: 960px) {
    .tool-label {
      display: none;
    }

    .tool-button:not(.zoom-level) {
      width: 28px;
      padding: 0;
      justify-content: center;
    }
  }

  @media (max-width: 900px) {
    .guide-button span {
      display: none;
    }

    .guide-button {
      width: 34px;
      padding: 0;
      justify-content: center;
    }
  }

  @media (max-width: 840px) {
    .topbar {
      flex-wrap: wrap;
      gap: 8px;
      padding-bottom: 8px;
    }

    .toolbar {
      width: 100%;
      justify-content: flex-end;
    }

    .brand-mark svg {
      width: 32px;
      height: 32px;
    }

    .brand-text h1 {
      font-size: 17px;
    }
  }

  @media (max-width: 560px) {
    .select-wrap select {
      min-width: 158px;
      max-width: 172px;
      font-size: 10.5px;
    }

    .theme-control {
      margin-right: auto;
    }

    .arrange-action {
      display: none;
    }
  }

  @media (pointer: coarse) {
    .toolbar {
      flex-wrap: wrap;
      row-gap: 6px;
    }

    .tool-button {
      height: 34px;
      min-width: 34px;
      padding: 0 9px;
    }

    .select-wrap select {
      height: 36px;
    }

    .guide-button {
      height: 38px;
      min-width: 38px;
    }
  }

  @media (max-width: 560px) and (pointer: coarse) {
    .toolbar {
      gap: 4px;
    }

    .select-wrap select {
      min-width: 148px;
      max-width: 156px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .guide-button,
    .select-wrap select {
      transition: none;
    }
  }
</style>
