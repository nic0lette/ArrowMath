import { game } from './state.svelte';

/**
 * Touch starts on a tray card are a tussle between the tray's own scrolling
 * and a card drag. `touch-action` lets the browser decide as soon as the
 * finger moves along the scroll axis; on a diagonal pull towards the bench
 * that cancels the drag before the ghost can follow. Lock the gesture
 * ourselves: a swipe along the tray scrolls it, anything with a real pull
 * across it stays a card drag, and preventing that first touchmove stops the
 * browser from taking the gesture away mid-drag.
 *
 * `scroll` is the axis the tray scrolls along: 'x' for a strip along the
 * bottom (cards are pulled up), 'y' for a column down the side (cards are
 * pulled sideways).
 */
const GESTURE_SLOP = 8;
const PULL_INTENT = 36;

export function lockTrayGesture(node: HTMLElement, scroll: 'x' | 'y' = 'x') {
  let axis = scroll;
  let start: { x: number; y: number } | null = null;
  let decided: 'scroll' | 'drag' | null = null;

  function stopTracking() {
    start = null;
    decided = null;
  }

  function onTouchStart(event: TouchEvent) {
    stopTracking();
    if (event.touches.length !== 1) return;

    const target = event.target as HTMLElement | null;
    if (!target?.closest('.bank-card')) return;

    const touch = event.touches[0];
    start = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchMove(event: TouchEvent) {
    if (!start || decided === 'scroll' || event.touches.length !== 1) return;

    // No card is being pulled (the pointerdown was ignored, or the gesture
    // was already handed to the tray): leave native scrolling alone.
    if (!game.bankDrag) {
      stopTracking();
      return;
    }

    if (decided === 'drag') {
      if (event.cancelable) event.preventDefault();
      return;
    }

    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < GESTURE_SLOP) return;

    // A drag to the bench always travels across the tray; a scroll stays
    // roughly along it. Bias ambiguous diagonal movement towards the drag so a
    // teacher pulling a card out never loses it to a little drift.
    const along = Math.abs(axis === 'x' ? dx : dy);
    const across = Math.abs(axis === 'x' ? dy : dx);
    decided = across >= PULL_INTENT || along <= across * 1.25 ? 'drag' : 'scroll';

    if (decided === 'drag') {
      if (event.cancelable) event.preventDefault();
    } else {
      // Let the browser scroll the tray. Drop the pending card drag so a
      // pointerup over the bench cannot add a card afterwards.
      game.cancelBankDrag();
      stopTracking();
    }
  }

  function onTouchEnd() {
    stopTracking();
  }

  node.addEventListener('touchstart', onTouchStart, { passive: true });
  // Non-passive for the whole tray: the browser must ask this handler before
  // it can claim a card gesture for scrolling.
  node.addEventListener('touchmove', onTouchMove, { passive: false });
  node.addEventListener('touchend', onTouchEnd, { passive: true });
  node.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return {
    update(next: 'x' | 'y' = 'x') {
      axis = next;
      stopTracking();
    },
    destroy() {
      stopTracking();
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    },
  };
}
