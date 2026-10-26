import { describe, expect, it } from 'vitest';
import {
  ARROW_TIP_WIDTH,
  DIGIT_WIDTH,
  THEMES,
  getArrowCardAriaLabel,
  getArrowCardModel,
  getArrowCardWidth,
  getPlaceLabel,
  getPlaceTier,
  renderArrowCardSvg,
  type ColorTheme,
} from 'arrow-cards';

describe('the ten-thousands card', () => {
  it('has five digit slots', () => {
    expect(getArrowCardWidth(10000)).toBe(5 * DIGIT_WIDTH + ARROW_TIP_WIDTH);
    expect(getArrowCardModel({ place: 10000, digit: 1 }).digits).toEqual([1, 0, 0, 0, 0]);
  });

  it('is labelled and read out as ten thousands', () => {
    expect(getPlaceTier(10000)).toBe('tenThousands');
    expect(getPlaceLabel(10000)).toBe('10000s');
    expect(getArrowCardAriaLabel(10000, 1)).toBe('1 ten thousands card, 10000');
    expect(renderArrowCardSvg({ place: 10000, digit: 1 })).toContain('aria-label="1 ten thousands card, 10000"');
  });

  it('has its own colour in every theme', () => {
    for (const theme of Object.keys(THEMES) as ColorTheme[]) {
      const colors = THEMES[theme];
      const others = [colors.thousands, colors.hundreds, colors.tens, colors.ones].map((set) => set.border);
      expect(colors.tenThousands.border).toMatch(/^#[0-9a-f]{6}$/);
      // Montessori repeats its colours every three places, so 10,000s match the tens.
      if (theme === 'montessori') expect(colors.tenThousands).toEqual(colors.tens);
      else expect(others).not.toContain(colors.tenThousands.border);
    }
  });
});
