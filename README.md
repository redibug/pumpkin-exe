# PUMPKIN.EXE — Net Battle

Ultimate AI-Powered Game Jam #5 entry (itch.io). A MegaMan Battle Network-inspired
single-boss grid battler: you are the operator, your navi fights PUMPKIN.EXE on a
6×3 grid. Static chip loadout, no deckbuilder. Built with Phaser 3.

## Quick start

```bash
npm install
npm run dev      # dev server, usually http://localhost:5173
npm run build    # production build -> dist/ (upload this to itch.io)
npm run preview  # preview the production build
```

## Controls

- Arrow keys — move navi (player-side 3×3 area)
- 1 — Cannon (straight shot, 40 dmg)
- 2 — Sword (adjacent tile, 80 dmg)
- 3 — Spread (row ± 1, 25 dmg each)
- 4 — Recover (+60 HP)

## Layout

- `src/main.js` — Phaser config + game boot
- `src/scenes/` — Title, Battle (TODO: victory/defeat screens)
- `src/systems/grid.js` — 6×3 grid helpers
- `src/systems/chips.js` — static deck + boss phase data
- `assets/` — AI-generated sprites/tiles/UI (see `docs/ART_PIPELINE.md`)
- `docs/ART_PIPELINE.md` — art style guide + generation workflow

## Jam rules relevant to this repo

- Generative AI **must** be used for at least one major component (we're using it
  for art + music, and an AI agent is co-developing — disclose all of this).
- Pre-generating raw base assets before the jam is allowed; assembly/integration
  happens in the 72h window.
- Web build required for itch.io submission.
