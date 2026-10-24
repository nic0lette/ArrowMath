# Arrow Math

An interactive place-value workbench built around draggable arrow cards
(1000s, 100s, 10s, 1s). Cards can be stacked, expanded, grouped, duplicated,
and snapped to a grid to explore expanded form and number composition.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build into dist/
npm run preview  # preview the production build
npm run lint     # TypeScript type-check
```

## Project layout

| Path | What it is |
|---|---|
| `src/App.tsx` | Workbench state, drag/snap rules, grouping and layout. |
| `src/components/` | Card wrappers, group rendering, toolbar, card bank, help modal. |
| `src/utils/mathHelpers.ts` | Number decomposition plus grid/snap helpers. |
| `arrow-cards/` | Standalone library that draws the arrow cards as plain SVG. |
| `arrow-cards/demo.html` | Visual catalogue of every card, digit, and theme. |

## Reusing the arrow cards

The card artwork lives in [`arrow-cards/`](arrow-cards/README.md). It has:

- a dependency-free SVG renderer (`renderArrowCardSvg`)
- a React adapter (`<ArrowCard />`)
- a Svelte 5 component
- a live demo and a full description of the geometry, colours, and layering

Copy that folder into another prototype and follow
[`arrow-cards/README.md`](arrow-cards/README.md). The app itself imports the same
folder, so the artwork has a single source of truth.
