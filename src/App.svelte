<script lang="ts">
  import './app.css';
  import { game } from './lib/state.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import Workbench from './components/Workbench.svelte';
  import CardBank from './components/CardBank.svelte';
  import GuideModal from './components/GuideModal.svelte';
  import DragGhost from './components/DragGhost.svelte';
  import Toast from './components/Toast.svelte';
</script>

<svelte:window
  onpointermove={game.handlePointerMove}
  onpointerup={game.handlePointerUp}
  onpointercancel={game.handlePointerCancel}
  onkeydown={game.handleKeyDown}
/>

<div class="app" data-theme={game.theme} class:interacting={game.isInteracting}>
  <Toolbar />
  <main class="workspace" aria-label="Arrow Math workbench">
    <Workbench />
  </main>
  <CardBank />
  <GuideModal />
  <DragGhost />
  <Toast />
</div>
