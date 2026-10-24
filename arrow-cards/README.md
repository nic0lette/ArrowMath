# Arrow Cards

A tiny, dependency-free way to render the place-value arrow cards from **Arrow Math**.

The core is plain TypeScript that returns an SVG string, so it works in vanilla HTML,
React, Svelte, Vue, server-side rendering — anything that can put SVG on a page.
React and Svelte adapters are included as optional conveniences.

- **No runtime dependencies** in the core.
- **No Tailwind required** — all styles are inline SVG attributes.
- **Copy the whole `arrow-cards/` folder** into another project and you're done.
- The Arrow Math app itself uses this folder, so the demo and the app can't drift apart.

---

## Quick start

### Vanilla HTML / JavaScript

```ts
import { renderArrowCardSvg } from './arrow-cards/src/index';

const card = renderArrowCardSvg({
  place: 1000,
  digit: 3,
  theme: 'curriculum',
});

document.querySelector('#card').innerHTML = card;
```

### React

```tsx
import { ArrowCard } from './arrow-cards/src/react';

export function Example() {
  return <ArrowCard place={1000} digit={3} theme="curriculum" />;
}
```

The React adapter wraps the SVG in an inline `<span>` with `line-height: 0`, so it
occupies exactly the card's width and height.

### Svelte 5

Copy `src/svelte/ArrowCard.svelte` into your Svelte project, adjusting the import of
`../index` to wherever you put the core:

```svelte
<script>
  import ArrowCard from './ArrowCard.svelte';
</script>

<ArrowCard place={1000} digit={3} theme="curriculum" />
```

Or use the core directly if you don't want a component:

```svelte
<script>
  import { renderArrowCardSvg } from './arrow-cards/src/index';

  const card = $derived(renderArrowCardSvg({ place: 1000, digit: 3 }));
</script>

<span style="display:inline-block;line-height:0">{@html card}</span>
```

### Vue

```vue
<script setup lang="ts">
import { renderArrowCardSvg } from './arrow-cards/src/index';
const card = renderArrowCardSvg({ place: 1000, digit: 3 });
</script>

<template>
  <span style="display:inline-block;line-height:0" v-html="card" />
</template>
```

---

## API

### `<ArrowCard>` / `renderArrowCardSvg()`

| Option | Type | Default | Meaning |
|---|---|---|---|
| `place` | `1000 \| 100 \| 10 \| 1` | required | How many digit slots the card has. |
| `digit` | `number` | required | Leading digit (1–9 for normal cards). Trailing slots become `0`. |
| `theme` | `'curriculum' \| 'montessori' \| 'pastel' \| 'vibrant'` | `'curriculum'` | Colour palette. |
| `tier` | `'thousands' \| 'hundreds' \| 'tens' \| 'ones'` | derived from `place` | Force a palette tier. |
| `isGhost` | `boolean` | `false` | Dashed outline only. |
| `opacity` | `number` | `1` | Opacity for the whole SVG. |
| `highlight` | `boolean` | `false` | Blue outline + glow (selection state). |
| `showZeroGhost` | `boolean` | `false` | Show trailing zeros at 35% opacity. |
| `idPrefix` | `string` | `'arrow-card'` | Prefix for internal `<defs>` ids. Give each card a unique value if you render many. |
| `className` | `string` | `''` | Extra class on the root `<svg>`. |
| `ariaLabel` | `string` | generated | Accessible label. |

`renderArrowCardSvg()` returns a complete `<svg>` string.
The React/Svelte wrappers expose the same options plus normal wrapper props.

### Other exports

| Export | Purpose |
|---|---|
| `THEMES` | All palettes and their colour roles. |
| `getArrowCardModel()` | Pure geometry/style object if you want to render with your own UI layer. |
| `getArrowCardWidth()` | Width in px for a given `place`. |
| `getPlaceTier()` | Maps `place` to `thousands` / `hundreds` / `tens` / `ones`. |
| `getPlaceLabel()` | Returns `1000s`, `100s`, `10s`, `1s`. |
| `getDigitCount()` | 4 / 3 / 2 / 1 slots. |
| `getArrowCardAriaLabel()` | Standard accessible label. |
| `DIGIT_WIDTH` | `58` px per digit slot. |
| `ARROW_TIP_WIDTH` | `28` px arrow tip. |
| `CARD_HEIGHT` | `68` px. |

---

## How the look is built

If you ever need to recreate the cards by hand, this is the recipe.

### Geometry

Each card is one SVG path:

- `DIGIT_WIDTH = 58px` per digit slot.
- `ARROW_TIP_WIDTH = 28px` for the triangular tip.
- `CARD_HEIGHT = 68px`.
- Left corners have a 10px radius.
- Width = `digitCount × 58 + 28`.
  - Thousands: 260px
  - Hundreds: 202px
  - Tens: 144px
  - Ones: 86px

The silhouette is a rectangle with a rounded left edge and a point on the right:

```text
M 10 0
L bodyWidth 0
L totalWidth 34          ← arrow point
L bodyWidth 68
L 10 68
Q 0 68 0 58
L 0 10
Q 0 0 10 0
Z
```

### Theme colours

Each tier has five roles:

| Role | Used for |
|---|---|
| `bg` | Card fill. |
| `border` | Card outline, dividers, arrow glyph. |
| `text` | Digits and the small place label. |
| `fill` | Reserved for matching base-ten visuals. |
| `accent` | Reserved for matching base-ten visuals. |

The four themes are `curriculum`, `montessori`, `pastel`, and `vibrant`.
Their exact hex values live at the top of `src/index.ts` and are exported as `THEMES`.

### Layers, bottom to top

1. **Arrow silhouette** — filled with the theme's `bg`, stroked with `border`.
2. **Soft shadow** — `feDropShadow` with `dy=3`, `stdDeviation=3`, colour `#0f172a` at 12%.
3. **Sheen** — a vertical white-to-black gradient at 25% → 5% opacity.
4. **Slot dividers** — dashed vertical lines between digits.
5. **Digits** — 32px bold, system UI font, centred in each 58px slot.
6. **Place label** — 9px monospace `1000s` / `100s` / `10s` / `1s` in the top-left.
7. **Arrow glyph** — a small chevron near the tip at 40% opacity.

### Stacking rule

The visual trick in the app is right-alignment: stack cards so their arrow tips line up.
The smaller place-value card covers the larger card's trailing zeros. In code, that means
positioning each card at `containerWidth - cardWidth` inside the group.

### Selection / ghost states

- **Highlight:** 3px `#2563eb` stroke plus a blue drop shadow glow.
- **Ghost:** transparent fill, dashed `6 4` border, no digits, labels, or sheen.
- **X-ray:** trailing zeros at 35% opacity via `showZeroGhost`.

---

## Live demo

From this folder:

```bash
npm run demo
```

Or from the repo root, start the app's dev server and open:

```text
http://localhost:3000/arrow-cards/demo.html
```

The demo shows every place value, digit 1–9, all four themes, and the zero-ghost toggle.

---

## What is *not* in the library

This package only draws cards. Arrow Math's drag, grid snapping, bounce rules, card
grouping, and workbench state are app-specific and stay in `src/`.

If you want to reuse those too, the relevant pure helpers are:

- `snapToGrid()` / `snapPosition()` in `src/utils/mathHelpers.ts`
- `getBoxOverlap()` / `calculateBouncePosition()` in `src/App.tsx`

---

## Copying into another project

Copy the entire `arrow-cards/` folder. Then:

- Use `src/index.ts` with any bundler or server-side renderer.
- Use `src/react.tsx` for React 18+.
- Use `src/svelte/ArrowCard.svelte` for Svelte 5.
- The core has no `package.json` dependency requirements.

If the other project uses TypeScript, its bundler needs to support `.ts` imports — Vite,
SvelteKit, Next, and most modern setups do.
