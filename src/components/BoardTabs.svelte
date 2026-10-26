<script lang="ts">
  import { tick } from 'svelte';
  import { game } from '../lib/state.svelte';
  import { MAX_BOARD_NAME } from '../lib/boardStorage';

  let nav: HTMLElement | undefined = $state();
  let list: HTMLElement | undefined = $state();
  let menuOpen = $state(false);
  let editingId = $state<string | null>(null);
  let draft = $state('');

  const isFirst = $derived(game.activeBoardIndex <= 0);
  const isLast = $derived(game.activeBoardIndex === game.boards.length - 1);

  // Keep the open board's button in view when there are more boards than fit.
  $effect(() => {
    game.activeBoardId;
    tick().then(() => {
      list?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  });

  function startRename(id: string) {
    menuOpen = false;
    const board = game.boards.find((entry) => entry.id === id);
    if (!board) return;
    game.switchBoard(id);
    draft = board.name;
    editingId = id;
  }

  function finishRename(save: boolean) {
    if (!editingId) return;
    const id = editingId;
    editingId = null;
    if (save) game.renameBoard(id, draft);
  }

  function onNameKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishRename(true);
    } else if (event.key === 'Escape') {
      finishRename(false);
    }
  }

  function focusAndSelect(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  function runFromMenu(action: () => void) {
    menuOpen = false;
    action();
  }

  function onWindowPointerDown(event: PointerEvent) {
    if (menuOpen && !nav?.contains(event.target as Node)) menuOpen = false;
  }

  function onWindowKeyDown(event: KeyboardEvent) {
    if (menuOpen && event.key === 'Escape') menuOpen = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeyDown} />

<nav class="board-tabs" aria-label="Boards" bind:this={nav}>
  <button
    class="board-step"
    type="button"
    aria-label="Previous board"
    title="Previous board (Page Up)"
    disabled={isFirst}
    onclick={() => game.stepBoard(-1)}
  >
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>

  <div class="board-list" bind:this={list}>
    {#each game.boards as board (board.id)}
      {@const active = board.id === game.activeBoardId}
      {@const changed = game.isChangedSinceStart(board.id)}
      <div class="board-item" class:active>
        {#if editingId === board.id}
          <input
            class="board-name"
            type="text"
            aria-label="Board name"
            maxlength={MAX_BOARD_NAME}
            bind:value={draft}
            use:focusAndSelect
            onkeydown={onNameKeyDown}
            onblur={() => finishRename(true)}
          />
        {:else}
          <button
            class="board-tab"
            type="button"
            aria-current={active ? 'true' : undefined}
            data-changed={changed ? 'true' : undefined}
            title={changed ? `${board.name} (changed since its saved start)` : board.name}
            onclick={() => game.switchBoard(board.id)}
            ondblclick={() => startRename(board.id)}
          >
            {board.name}
            {#if changed}<span class="changed-dot" aria-hidden="true"></span>{/if}
          </button>
          {#if active}
            <button
              class="board-options"
              type="button"
              aria-label="Board options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onclick={() => (menuOpen = !menuOpen)}
            >
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="m3 4.75 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <button
    class="board-step"
    type="button"
    aria-label="Next board"
    title="Next board (Page Down)"
    disabled={isLast}
    onclick={() => game.stepBoard(1)}
  >
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M4.5 2.5 8 6 4.5 9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>

  <span class="board-divider" aria-hidden="true"></span>

  <button class="board-add" type="button" aria-label="Add board" title="Add board" onclick={() => game.addBoard()}>
    <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 2v8M2 6h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
  </button>

  {#if menuOpen}
    <div class="board-menu" role="menu" aria-label="Board options">
      <button type="button" role="menuitem" onclick={() => runFromMenu(() => game.saveStart())}>
        {game.activeStart ? 'Replace start' : 'Save as start'}
      </button>
      {#if game.activeStart}
        <button type="button" role="menuitem" onclick={() => runFromMenu(() => game.forgetStart())}>
          Forget start
        </button>
      {/if}
      <span class="menu-divider" role="separator"></span>
      <button type="button" role="menuitem" onclick={() => startRename(game.activeBoardId)}>Rename</button>
      <button type="button" role="menuitem" onclick={() => runFromMenu(() => game.duplicateBoard())}>
        Duplicate
      </button>
      <button type="button" role="menuitem" onclick={() => runFromMenu(() => game.clearBoard())}>
        Clear board
      </button>
      <button
        class="danger"
        type="button"
        role="menuitem"
        disabled={game.boards.length <= 1}
        onclick={() => runFromMenu(() => game.removeBoard(game.activeBoardId))}
      >
        Delete
      </button>
    </div>
  {/if}
</nav>

<style>
  .board-tabs {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    height: 30px;
    padding: 0 3px;
    border: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel) 86%, transparent);
    color: var(--muted);
    box-shadow: 0 1px 1px rgba(15, 23, 42, 0.02);
    backdrop-filter: blur(10px);
    pointer-events: auto;
  }

  .board-list {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .board-list::-webkit-scrollbar {
    display: none;
  }

  .board-item {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: 22px;
    border-radius: 7px;
  }

  .board-item.active {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  button {
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .board-tab {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 160px;
    height: 22px;
    padding: 0 9px;
    overflow: hidden;
    border-radius: 7px;
    font-size: 11.5px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .changed-dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--warn);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--warn) 20%, transparent);
  }

  .board-item:not(.active) .board-tab:hover {
    background: var(--surface-muted);
    color: var(--ink);
  }

  .board-item.active .board-tab {
    padding-right: 3px;
    font-weight: 750;
  }

  .board-options,
  .board-step,
  .board-add {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 7px;
  }

  .board-options:hover {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .board-step:hover:not(:disabled),
  .board-add:hover {
    background: var(--surface-muted);
    color: var(--ink);
  }

  .board-step:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .board-divider {
    flex: none;
    width: 1px;
    height: 14px;
    margin: 0 2px;
    background: var(--line);
  }

  .board-name {
    width: 150px;
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--accent);
    border-radius: 7px;
    outline: none;
    background: var(--panel);
    color: var(--ink);
    font: inherit;
    font-size: 11.5px;
    font-weight: 650;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
  }

  .board-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    display: grid;
    min-width: 140px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--panel);
    box-shadow: var(--shadow-md);
  }

  .board-menu button {
    padding: 7px 10px;
    border-radius: 7px;
    color: var(--ink);
    font-size: 12.5px;
    font-weight: 600;
    text-align: left;
  }

  .board-menu button:hover:not(:disabled) {
    background: var(--surface-muted);
  }

  .menu-divider {
    height: 1px;
    margin: 4px 6px;
    background: var(--line);
  }

  .board-menu .danger {
    color: var(--danger);
  }

  .board-menu button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
