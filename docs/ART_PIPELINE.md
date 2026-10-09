# Art Pipeline

All visual assets are AI-generated (per jam rules, generative AI is *required* for
at least one major component — art is ours). Style and workflow below so anyone
(Bug or Bugchan) can generate consistent assets.

## Style guide

- **Look:** 16-bit pixel art, chunky readable silhouettes, limited palettes.
- **Palette anchors:** player side = electric blue `#4fc3f7` / deep navy `#101828`;
  enemy side = ember red/orange `#ff9e2c` / `#d84315`; accents = toxic green `#81c784`,
  violet `#ba68c8`.
- **Backgrounds:** always isolated on **solid pure black** (`#000000`) so we can
  key them out or drop them straight onto the dark cyberspace backdrop.
- **Sprites:** single character, front-facing, full body, no text, no watermark.
- **Tiles:** square, seamless-ish, subtle circuit/hex patterning.
- **UI icons:** centered symbol on transparent-or-black square, bold shape,
  readable at 48px.

## Prompt template

```
16-bit pixel art game sprite, <SUBJECT>, <PALETTE NOTES>,
single character centered, front-facing, full body,
isolated on solid pure black background, no text, no watermark
```

## Asset list

| File | Size target | Status |
|---|---|---|
| `assets/sprites/navi.png` | ~128px | ✅ pre-generated |
| `assets/sprites/boss-pumpkin.png` | ~192px | ✅ pre-generated |
| `assets/tiles/tile-player.png` | 110px square | ✅ pre-generated |
| `assets/tiles/tile-enemy.png` | 110px square | ✅ pre-generated |
| `assets/tiles/bg-cyberspace.png` | 960×540 | ✅ pre-generated |
| `assets/ui/chip-cannon.png` | 48px | ⬜ jam |
| `assets/ui/chip-sword.png` | 48px | ⬜ jam |
| `assets/ui/chip-spread.png` | 48px | ⬜ jam |
| `assets/ui/chip-recover.png` | 48px | ⬜ jam |
| `assets/audio/*` | — | ⬜ jam (AI music/SFX) |

Base sprites/tiles may be pre-generated before the jam (allowed by the rules);
final assembly, animation frames, and polish happen inside the 72h window.

## Adding a new asset

1. Generate with the prompt template above, save to the right folder.
2. Name it exactly as referenced in `BattleScene.preload()` (or add a new
   `this.load.image(...)` line).
3. If the generator didn't give pure black, open the PNG and flood-fill the
   background to `#000000` before committing.

## Disclosure (for the itch.io page)

"All sprites, tiles, and UI were generated with AI image tools and edited by the
team. Music/SFX are AI-generated. Code was written by a human–AI pair (Bug +
Bugchan, an AI agent)."
