import { animate, type AnimationPlaybackControls } from 'motion';
import { SPRING_DEFAULT } from './geometry';

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

export interface MotionParams {
  x: number;
  y: number;
  immediate?: boolean;
  spring?: SpringConfig;
}

const freezers = new WeakMap<HTMLElement, () => void>();

// Tracked at module scope so toggling "Reduce motion" takes effect for cards
// mid-session, not only for those mounted after the change.
const reducedMotionQuery =
  typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
let prefersReducedMotion = reducedMotionQuery?.matches ?? false;
if (reducedMotionQuery) {
  reducedMotionQuery.addEventListener('change', (event) => {
    prefersReducedMotion = event.matches;
  });
}

/**
 * Stops a card's in-flight spring at its current visual position. The drag
 * gesture calls this synchronously before reading the card rect, so a bounce
 * or settle that is still animating cannot keep moving underneath the pointer.
 */
export function freezeCardMotion(node: HTMLElement): void {
  freezers.get(node)?.();
}

/**
 * Positions each card with Motion. Cards live in one flat layer rather than
 * being re-parented into groups, so a snap never restarts layout from (0, 0).
 * While a piece is under the pointer we follow immediately; snaps, bounces and
 * expand/collapse use real Motion springs.
 */
export function cardMotion(node: HTMLElement, initial: MotionParams) {
  let current = { x: initial.x, y: initial.y };
  let controls: AnimationPlaybackControls | null = null;
  // True while the node's transform has been written by us rather than left to
  // Motion. Motion caches transform values per element, so a later animation
  // needs an explicit first keyframe or it will spring from that stale cache.
  let manualTransform = true;

  node.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
  node.style.willChange = 'transform';

  function freeze() {
    const frozenTransform = window.getComputedStyle(node).transform;
    controls?.stop();
    controls = null;
    for (const animation of node.getAnimations()) animation.cancel();
    if (frozenTransform && frozenTransform !== 'none') {
      node.style.transform = frozenTransform;
      manualTransform = true;
    }
  }

  freezers.set(node, freeze);

  function move(next: MotionParams) {
    const from = current;
    const changed = Math.abs(next.x - from.x) > 0.01 || Math.abs(next.y - from.y) > 0.01;
    current = { x: next.x, y: next.y };
    if (!changed) {
      if (next.immediate) manualTransform = true;
      return;
    }

    controls?.stop();
    controls = null;

    if (next.immediate || prefersReducedMotion) {
      node.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      manualTransform = true;
      return;
    }

    const spring = next.spring ?? SPRING_DEFAULT;
    // Prime the animation with the actual visual origin when the card was just
    // following the pointer. Otherwise Motion can use a cached transform from
    // an earlier spring and animate in from the previous resting position.
    const keyframes = manualTransform
      ? { x: [from.x, next.x], y: [from.y, next.y] }
      : { x: next.x, y: next.y };
    manualTransform = false;
    controls = animate(
      node,
      keyframes,
      { type: 'spring', stiffness: spring.stiffness, damping: spring.damping },
    );
  }

  return {
    update(next: MotionParams) {
      move(next);
    },
    destroy() {
      controls?.stop();
      freezers.delete(node);
    },
  };
}
