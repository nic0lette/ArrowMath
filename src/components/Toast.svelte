<script lang="ts">
  import { game } from '../lib/state.svelte';

  const toast = $derived(game.toast);
  const open = $derived(Boolean(toast) && !game.guideOpen);
</script>

<!--
  The live region is a single persistent node: keying or recreating it per
  toast makes some screen readers skip announcements. The inner card is keyed
  only to restage its entry animation.
-->
<div
  class="toast"
  class:open
  class:warning={toast?.tone === 'warning'}
  class:success={toast?.tone === 'success'}
  role="status"
  aria-live="polite"
  onpointerenter={() => game.pauseToast()}
  onpointerleave={() => game.resumeToast()}
  onfocusin={() => game.pauseToast()}
  onfocusout={() => game.resumeToast()}
>
  {#if toast}
    {#key toast.id}
      <div class="toast-card">
        <span class="toast-icon" aria-hidden="true">
          {#if toast.tone === 'warning'}
            <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 2.2 14.2 13H1.8L8 2.2Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.2v3.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.2" r="0.8" fill="currentColor"/></svg>
          {:else if toast.tone === 'success'}
            <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2.5 8.3 6.3 12l7.2-7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {:else}
            <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.1v4.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="4.9" r="0.8" fill="currentColor"/></svg>
          {/if}
        </span>
        <span class="toast-message">{toast.message}</span>
        {#if toast.actionLabel}
          <button class="toast-action" type="button" onclick={() => game.runToastAction()}>{toast.actionLabel}</button>
        {/if}
        <button class="toast-close" type="button" aria-label="Dismiss message" onclick={() => game.dismissToast()}>
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="m3 3 6 6M9 3 3 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>
      </div>
    {/key}
  {/if}
</div>

<style>
  .toast {
    position: fixed;
    top: 86px;
    left: 50%;
    z-index: 9000;
    max-width: min(560px, calc(100vw - 32px));
    transform: translateX(-50%);
    /* An invisible toasts region must never block clicks over the canvas. */
    visibility: hidden;
    pointer-events: none;
  }

  .toast.open {
    visibility: visible;
    pointer-events: auto;
  }

  .toast-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 10px 9px 11px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--panel);
    box-shadow: var(--shadow-lg);
    color: var(--muted-strong);
    animation: toast-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .toast-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 9px;
    bottom: 9px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--accent);
    opacity: 0.65;
  }

  .toast.warning .toast-card::before {
    background: var(--warn);
  }

  .toast.success .toast-card::before {
    background: var(--success);
  }

  .toast-icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    flex: 0 0 auto;
    border-radius: 7px;
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .toast.warning .toast-icon {
    background: color-mix(in srgb, var(--warn) 14%, transparent);
    color: var(--warn-ink);
  }

  .toast.success .toast-icon {
    background: color-mix(in srgb, var(--success) 13%, transparent);
    color: var(--success-ink);
  }

  .toast-message {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
    margin-right: 2px;
  }

  .toast-action {
    height: 25px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--panel);
    color: var(--ink);
    font: inherit;
    font-size: 10.5px;
    font-weight: 750;
    cursor: pointer;
  }

  .toast-action:hover {
    background: var(--surface-muted);
  }

  .toast-close {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .toast-close:hover {
    background: var(--surface-muted);
    color: var(--ink);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(-7px) scale(0.98);
    }
  }

  @media (pointer: coarse) {
    .toast-action {
      height: 32px;
      padding-inline: 11px;
    }

    .toast-close {
      width: 32px;
      height: 32px;
    }
  }

  @media (max-width: 840px) {
    .toast {
      top: 100px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast-card {
      animation: none;
    }
  }
</style>
