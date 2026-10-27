<script lang="ts">
  import './app.css';
  import { game } from './lib/state.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import Workbench from './components/Workbench.svelte';
  import CardBank from './components/CardBank.svelte';
  import PhoneTray from './components/PhoneTray.svelte';
  import GuideModal from './components/GuideModal.svelte';
  import DragGhost from './components/DragGhost.svelte';
  import Toast from './components/Toast.svelte';
  import { isPhoneScreen } from './lib/screen';

  let width = $state(typeof window === 'undefined' ? 1200 : window.innerWidth);
  let height = $state(typeof window === 'undefined' ? 800 : window.innerHeight);
  // Phones get a tray that opens over the bench instead of sitting below it.
  const phone = $derived(isPhoneScreen(width, height));
</script>

<svelte:window
  bind:innerWidth={width}
  bind:innerHeight={height}
  onpointermove={game.handlePointerMove}
  onpointerup={game.handlePointerUp}
  onpointercancel={game.handlePointerCancel}
  onkeydown={game.handleKeyDown}
/>

<div class="app" data-theme={game.theme} class:interacting={game.isInteracting}>
  <Toolbar {phone} />
  <main class="workspace" aria-label="Arrow Cards workbench">
    <Workbench />
    {#if phone}
      <PhoneTray side={width > height} />
    {/if}
  </main>
  {#if !phone}
    <CardBank />
  {/if}
  <GuideModal />
  <DragGhost />
  <Toast />
</div>
