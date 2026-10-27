import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampZoom,
  defaultZoom,
  scrollToKeep,
  stepZoom,
} from '../../src/lib/zoom';

describe('clampZoom', () => {
  it('keeps the bench between its smallest and largest sizes', () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(clampZoom(0.83)).toBe(0.83);
  });

  it('never goes small enough to make cards hard to grab', () => {
    // A 68px card shrinks to about 41px at 60%, near the 44px touch guideline.
    expect(MIN_ZOOM).toBeGreaterThanOrEqual(0.6);
  });

  it('falls back to full size for nonsense', () => {
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});

describe('stepZoom', () => {
  it('moves one tenth at a time', () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1, -1)).toBe(0.9);
  });

  it('lands back on the tenths after a pinch left it between them', () => {
    expect(stepZoom(0.83, 1)).toBe(0.9);
    expect(stepZoom(0.83, -1)).toBe(0.8);
  });

  it('stops at either end', () => {
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
  });
});

describe('defaultZoom', () => {
  it('starts phones smaller, in either orientation', () => {
    expect(defaultZoom(390, 844)).toBe(0.75);
    expect(defaultZoom(844, 390)).toBe(0.75);
  });

  it('keeps tablets, laptops and boards at full size', () => {
    expect(defaultZoom(768, 1024)).toBe(1);
    expect(defaultZoom(1440, 900)).toBe(1);
  });
});

describe('scrollToKeep', () => {
  it('keeps the bench point under the anchor in place while zooming', () => {
    // At 100%, 300px into the view with 200px scrolled is bench x 500.
    const scroll = scrollToKeep({ scrollLeft: 200, anchorX: 300, from: 1, to: 0.5 });
    // At 50%, bench x 500 is 250px into the content; 300px into the view.
    expect(scroll).toBe(-50);
  });

  it('keeps the left edge still when anchored there', () => {
    expect(scrollToKeep({ scrollLeft: 400, anchorX: 0, from: 1, to: 0.8 })).toBe(320);
  });
});
