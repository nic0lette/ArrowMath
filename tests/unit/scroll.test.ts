import { describe, expect, it } from 'vitest';
import {
  EDGE_ZONE,
  MAX_EDGE_SPEED,
  WORLD_WIDTH,
  edgeScrollSpeed,
  scrollWidth,
} from '../../src/lib/scroll';

describe('scrollWidth', () => {
  const view = { x: 0, width: 1000 };
  const box = (x: number, width: number) => ({ x, y: 0, width, height: 68 });

  it('always has a spare screen to scroll into, even on an empty bench', () => {
    expect(scrollWidth([], view)).toBe(2000);
    expect(scrollWidth([box(100, 300)], view)).toBe(2000);
  });

  it('reaches a screen past the furthest piece', () => {
    expect(scrollWidth([box(100, 300), box(1400, 200)], view)).toBe(2600);
  });

  it('never shrinks out from under the part in view', () => {
    expect(scrollWidth([box(100, 300)], { x: 1500, width: 1000 })).toBe(2500);
  });

  it('stops at the edge of the world', () => {
    expect(scrollWidth([box(5800, 200)], view)).toBe(WORLD_WIDTH);
  });

  it('rounds up to whole pixels', () => {
    expect(scrollWidth([box(1490.2, 10)], view)).toBe(2501);
  });
});

describe('edgeScrollSpeed', () => {
  const rect = { left: 100, width: 800 };

  it('is still away from the edges', () => {
    expect(edgeScrollSpeed(500, rect)).toBe(0);
    expect(edgeScrollSpeed(100 + EDGE_ZONE + 1, rect)).toBe(0);
  });

  it('scrolls left near the left edge and right near the right edge', () => {
    expect(edgeScrollSpeed(110, rect)).toBeLessThan(0);
    expect(edgeScrollSpeed(890, rect)).toBeGreaterThan(0);
  });

  it('speeds up towards the edge and past it, up to a limit', () => {
    expect(edgeScrollSpeed(895, rect)).toBeGreaterThan(edgeScrollSpeed(880, rect));
    expect(edgeScrollSpeed(1400, rect)).toBe(MAX_EDGE_SPEED);
    expect(edgeScrollSpeed(-400, rect)).toBe(-MAX_EDGE_SPEED);
  });
});
