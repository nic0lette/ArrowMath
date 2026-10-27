/**
 * The workbench can be zoomed so the whole bench (cards, pluses, toolbars and
 * grid) is drawn smaller or larger together. Pieces keep their positions in
 * bench coordinates; only the drawing and the pointer mapping change.
 */

/**
 * Smallest zoom. A 68px card is about 41px tall here and the digit end you
 * pull a card out by is about 35px wide, near the 44px touch guideline.
 */
export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 1.5;
/** How far one press of − or + changes the zoom. */
export const ZOOM_STEP = 0.1;
/** Phones start here, so a four-digit number fits with room to work. */
export const PHONE_ZOOM = 0.75;
/** A screen whose short side is below this is treated as a phone. */
const PHONE_SHORT_SIDE = 500;

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** One step of − or +, landing on the tenths even after a pinch. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const steps = round(zoom / ZOOM_STEP, 6);
  const next = direction > 0 ? Math.floor(steps) + 1 : Math.ceil(steps) - 1;
  return clampZoom(round(next * ZOOM_STEP));
}

export function defaultZoom(width: number, height: number): number {
  return Math.min(width, height) < PHONE_SHORT_SIDE ? PHONE_ZOOM : 1;
}

/**
 * The scroll position that keeps the bench point at `anchorX` (measured from
 * the view's left edge) under it when the zoom changes from `from` to `to`.
 */
export function scrollToKeep({
  scrollLeft,
  anchorX,
  from,
  to,
}: {
  scrollLeft: number;
  anchorX: number;
  from: number;
  to: number;
}): number {
  const benchX = (scrollLeft + anchorX) / from;
  return benchX * to - anchorX;
}
