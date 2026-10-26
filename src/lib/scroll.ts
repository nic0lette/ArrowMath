import type { Bounds } from './geometry';

/**
 * The workbench scrolls sideways. Pieces may sit anywhere up to WORLD_WIDTH,
 * and there is always a spare screen of bench past the furthest piece to
 * scroll into and work in.
 */
export const WORLD_WIDTH = 6000;
/** How close to the left or right edge a drag starts scrolling the bench. */
export const EDGE_ZONE = 48;
/** Pixels per frame at the very edge (and beyond it). */
export const MAX_EDGE_SPEED = 22;

/**
 * The bench reaches a screen past the furthest piece (or past the first
 * screen when everything fits on it), up to the world's edge. It never ends
 * before the part in view: otherwise moving the furthest card left would
 * shrink the bench and jump the scroll position mid-drag.
 */
export function scrollWidth(bounds: Bounds[], view: { x?: number; width: number }): number {
  let right = 0;
  for (const box of bounds) right = Math.max(right, box.x + box.width);
  const wanted = Math.min(WORLD_WIDTH, Math.ceil(Math.max(right, view.width) + view.width));
  return Math.max((view.x ?? 0) + view.width, wanted);
}

/**
 * How fast to scroll while dragging at `clientX`: negative near the left edge,
 * positive near the right, faster the closer the pointer gets.
 */
export function edgeScrollSpeed(clientX: number, rect: { left: number; width: number }): number {
  const fromLeft = clientX - rect.left;
  const fromRight = rect.left + rect.width - clientX;
  const ramp = (distance: number) => Math.min(1, (EDGE_ZONE - distance) / EDGE_ZONE) * MAX_EDGE_SPEED;
  if (fromRight < EDGE_ZONE) return Math.round(ramp(fromRight));
  if (fromLeft < EDGE_ZONE) return -Math.round(ramp(fromLeft));
  return 0;
}
