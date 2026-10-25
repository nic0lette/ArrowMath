# Arrow Math

A tactile place-value workbench for primary classrooms, built with **Svelte 5** and **Motion**.

Teachers and pupils can drag arrow cards onto a workbench, overlap them to build numbers, expand a group into a number sentence, and see the zeros that a stack hides. Everything runs locally — there are no images or audio files to load.

![Svelte](https://img.shields.io/badge/Svelte-5-ff3e00)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Motion](https://img.shields.io/badge/Motion-springs-0f172a)

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

```bash
npm run build     # production build
npm run preview   # preview the production build
npm run check     # svelte-check + TypeScript
npm test          # unit + browser tests
```

The first Playwright run needs a browser:

```bash
npx playwright install chromium
```

## Tests

```bash
npm run test:unit   # Vitest: geometry, thresholds, anchoring, bounce placement
npm run test:e2e    # Playwright: real pointer drags in Chromium
```

The Playwright suite starts its own Vite server on port 4173. It covers:

- strict 10px 2D overlap requirements
- stack vs. edge-chain detection
- anchored merges for card-to-card and group-to-group interactions
- duplicate-place bounce start and settle
- pulling cards out by their digit end, moving groups from the arrow spine or number chip, and double-click stack/expand
- repeated drags settling from the new drop rather than the previous resting position
- the regression where a card was picked up mid-bounce and jumped to its spring destination
- expand/stack, X-ray revealing hidden zeros, undoable reset, the teacher guide, and a phone-width layout check

Unit tests live in `tests/unit/`; browser tests and drag helpers live in `tests/e2e/`.

## How to play

- **Drag from the tray** — press any card in the bottom bank and drag it onto the workbench. A full-size ghost follows the pointer. Tap a bank card instead to add it automatically.
- **Overlap to stack** — when two cards intersect by at least 10px on both axes, a halo appears. A substantial overlap (28px or 35% of the narrower card) snaps the cards into a flush stack.
- **Pull a card out** — grab a card's flat, leading-digit end in a stack and drag. That card leaves the group, the remaining cards close up, and the value updates (`4,325 → 4,025`). Hovering lifts the card by its exposed end, or lifts the whole stack when you point at the arrow side.
- **Move a group** — drag the arrow side/spine of a stack, or drag the number chip in the group toolbar.
- **Touch edges to chain** — a shallow edge overlap (10–27px) builds an expanded number sentence with `+` operators and a result.
- **Same place bounces** — a place-value column can only hold one card. Drop a duplicate and the stationary group stays anchored while the incoming card springs into nearby clear space.
- **Expand / Stack** — use the small group toolbar above a stack to spring it open into `4,000 + 300 + 20 + 5 = 4,325`, then stack it back up. Double-click a group to toggle the same way. Once expanded, dragging any card pulls it out.
- **X-ray zeros** — in a stacked group, turn on X-ray to make the top cards 88% opaque, fade their trailing zeros, and let their fills become see-through. The placeholder zeros covered by the top cards become visible as ghost digits. It has no effect on single cards or expanded groups, where nothing is hidden.
- **Make a number** — type a target such as `4325` and add it as separate cards or as one stacked group.
- **Classroom tools** — switch curricula, toggle grid snapping, tidy every card into rows, mute the procedural sound, clear the canvas (with undo), or open the teacher guide.

### Teacher keyboard shortcuts

- `Enter` / `Space` selects a focused card.
- Arrow keys nudge the selected card or group (hold `Shift` for 24px steps).
- `Delete` removes the selection.
- `Escape` cancels a drag or clears the selection.

## Project layout

```text
arrow-cards/                Existing internal arrow-card library
src/
  App.svelte                App shell and pointer wiring
  app.css                   Design tokens, four themes, app layout
  components/
    Toolbar.svelte          Theme, grid, X-ray, audio, tidy, reset, guide
    Workbench.svelte        Flat card layer, overlays, status
    CardNode.svelte         Accessible draggable card
    PieceOverlay.svelte     Group toolbar, + operators, = result
    HoverHalo.svelte        Blue snap / amber bounce halos
    EmptyState.svelte       First-run invitation and sample
    CardBank.svelte         Place-value-aware card tray
    DragGhost.svelte        Floating bank-drag preview
    GuideModal.svelte       Pedagogical teacher guide
    Toast.svelte            Notifications and undo actions
  lib/
    geometry.ts             AABB detection, stack/chain layout, bounce search
    state.svelte.ts         Svelte 5 rune store + all authoritative state
    cardMotion.ts           Motion spring action for card transforms
    audio.ts                Procedural Web Audio sounds
  main.ts
tests/
  unit/                     Vitest geometry/unit tests
  e2e/                      Playwright interaction tests + drag helpers
```

## Implementation notes

- **Svelte 5 runes** (`$state`, `$derived`, `$effect`) own every card and group position. There are no layout projections or layout-group tags.
- **No re-parenting.** All canvas cards live in one flat, keyed layer. A snap changes card/group membership in state, never the DOM hierarchy, so cards animate from their current position instead of restarting at `(0, 0)`.
- **Motion springs.** `cardMotion` drives transforms with Motion. Dragging follows the pointer instantly, while releases, snaps, bounces, tidy-up and expand/stack use springs. Bounces use `{ stiffness: 300, damping: 14 }`; normal settles use `{ stiffness: 300, damping: 26 }`.
- **Interruptible springs.** Starting a drag freezes any in-flight card spring at its current visual transform, stops the Motion controls, and syncs the piece's authoritative coordinates to that visual position before recording the drag origin. This prevents a card grabbed mid-bounce from jumping to the spring's stale destination.
- **Anchor rule.** Stacked cards align on their arrow-tip side. When merging, the stationary target's largest card keeps its exact canvas coordinate; any extra width extends to the left, so existing cards never jump.
- **Two drag zones.** In a stack, the flat leading-digit slot pulls that card out; the arrow side moves the whole group. Expanded groups are already visually separate, so a card drag always pulls it out. Hovering the digit end lifts that card alone, clipped to the part exposed by the cards stacked above it, so it slides out from under them instead of rising through them. Hovering the arrow side lifts the whole stack as one object and softens the internal outlines so it reads as a single piece.
- **Group moves.** Drag the arrow spine of a stack or the number chip in the group toolbar. The chrome stays visible during a toolbar drag. After a drop, the aim state re-checks the pointer, so the lift persists while you are still pointing at the card or chip.
- **Layer coordinates.** Piece coordinates are measured against the card layer inside the workbench border, not the workbench border box. Grabbing a card therefore cannot creep by the 1px border on each click.
- **Double-click toggles.** Double-clicking any card in a multi-card group switches between Stack and Expand; the toolbar button remains for touch and keyboard use.
- **Strict overlap.** Targets are only considered when both 2D overlap axes are at least 10px. The stack/chain decision then uses the horizontal overlap.
- **Procedural audio.** Clicks, snaps, peels, expands and rubbery bounce sounds are generated with Web Audio oscillators. The bounce is a 360Hz → 180Hz → 240Hz pitch bend with vibrato.
- **Themes, preferences and _the lesson itself_** are stored in `localStorage`: mute, grid snapping, tray state, and the whole workbench (pieces, positions and stacking order) survive a page refresh, clamped to fit whatever screen size is found. A teacher clearing the canvas and refreshing stays cleared.
- **Responsive.** The workbench shrinks, the card tray collapses by default on phones, and bank rows scroll with accessible arrow buttons. The teacher guide becomes a scrollable native `<dialog>`.

## Arrow card integration

The app imports the internal library through the bare package name:

```ts
import { getArrowCardWidth, CARD_HEIGHT, THEMES } from 'arrow-cards';
import ArrowCard from 'arrow-cards/svelte';
```

Those specifiers are mapped to `arrow-cards/src/index.ts` and
`arrow-cards/src/svelte/ArrowCard.svelte` in both `vite.config.ts` and
`tsconfig.json`, so the library can be edited independently without a publish step.
