/** A screen whose short side is below this is treated as a phone. */
export const PHONE_SHORT_SIDE = 500;

/** Phones, upright or on their side, get the compact tray and a smaller bench. */
export function isPhoneScreen(width: number, height: number): boolean {
  return Math.min(width, height) < PHONE_SHORT_SIDE;
}
