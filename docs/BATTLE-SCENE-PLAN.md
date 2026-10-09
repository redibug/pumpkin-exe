# BATTLE-SCENE-PLAN.md

Design + implementation plan for the BattleScene combat loop.
Written as jam prep (design docs are legal prep); the actual logic gets
wired during the 72-hour window, ideally AI-assisted (that's the velocity
play the judges reward). Replaces the pre-written combat loop that was
stripped for rules safety — the old version is recoverable via the
`pre-jam-reference` git tag if we ever want to compare notes.

## Fantasy

MMBN-style grid battle: Bugchan the net navi (player side, left 3 columns)
vs PUMPKIN.EXE (enemy side, right 3 columns). Real-time with chip cooldowns.

## Scene responsibilities

1. Render the 6×3 grid (pink player tiles / cyan enemy tiles).
2. Track navi + boss state (HP, grid position, cooldowns).
3. Handle input: arrows move, keys 1–4 fire chips.
4. Run boss AI per phase, resolve damage both ways.
5. Update HUD (HP bars, chip cooldown dimming) and run win/lose sequences.

## State to track (create())

- `naviHp / naviMaxHp` (100/100), `naviPos {col,row}` — start {1,1}.
- `bossHp / BOSS.maxHp` (600), `bossPos {col,row}` — start {4,1}.
- `chipCooldowns` map: chip id → last-fired timestamp.
- `projectiles` physics group.
- Input: cursor keys + ONE/TWO/THREE/FOUR keys.

## Grid + HUD (presentation, wire Friday)

- `drawGrid()`: loop COLS×ROWS via `tileToWorld()`; player tiles use
  `tile-player`, enemy tiles `tile-enemy`.
- `drawHud()`: navi HP bar (bottom left), chip icons row (bottom center,
  dimmed while on cooldown), controls hint (bottom right), boss HP text (top).

## Navi movement

- Arrow keys move one tile per press; 160 ms debounce so holding a key
  doesn't teleport.
- Clamp to player side: col 0–2, row 0–(ROWS−1).
- Move the sprite to the new tile's world position.

## Chips (from `systems/chips.js` static deck)

- Keys 1–4 map to CHIPS[0..3]. Each chip checks `chipReady()` against its
  `cooldownMs` before firing; store last-fired time on fire.
- **Cannon** (40 dmg): spawn a projectile on the navi's row, velocity +X;
  on overlap with boss → damage, destroy projectile.
- **Spread** (25 dmg): like cannon, but one projectile per row for the
  target row and the rows above/below (clamped to grid).
- **Sword** (80 dmg): instant — if the tile directly ahead of the navi
  matches the boss's tile, damage the boss. No projectile.
- **Recover** (60 HP): heal the navi, clamped to max HP. No damage.
- Flash the target (tint) on hit as impact feedback.

## Boss: PUMPKIN.EXE phases

Phase data lives in `systems/chips.js` (`BOSS.phases`); Mel's call whether
to trim it before Friday — it's design data, currently kept.

- Phase from HP fraction: ≥60% Sprout, 30–60% Vine, <30% Harvest.
- Each phase has `moveIntervalMs` / `attackIntervalMs`; higher phases are
  faster. Boss wanders its 3 enemy-side columns on the move timer.
- Attacks (to design Friday): telegraphed tile warnings, then damage the
  navi if she's on a marked tile when it lands. Keep attacks readable —
  fairness over spectacle.

## Standard virus: RUTABAGA-MANDRAKE (Theme 2 integration)

Mel's concept (2026-10-09, jam day 1): carved rutabagas look like creepy
mandrake roots, so the Theme 2 enemy is a mandrake-themed virus that is
secretly a rutabaga. This is the Theme 2 pivot — no redesign of the core
loop, just a new enemy type expressing RUTABAGA.

- **Fantasy:** a gnarled root-vegetable creature with a carved, screaming
  face. It lives burrowed under enemy-side tiles and erupts to shriek.
- **States:** BURROWED → TELEGRAHAPHING → EMERGED (scream) → BURROWED.
- **Burrowed:** invulnerable; rendered as a dirt mound / cracked tile on
  its tile. Chips and sword do nothing. It picks a new tile each cycle
  (enemy side only).
- **Telegraph:** 800ms warning — its tile flashes/pulses and a rumble SFX
  plays. Fairness first: the player must always see it coming.
- **Emerged:** pops out for ~1.2s and SCREAMS — noise attack hitting the
  navi if she's on the same row (row-wide shriek wave). While emerged it
  IS vulnerable: sword/chips can hit it.
- **Tuning (systems/viruses.js):** HP 120, scream damage 15, cycle
  ~4s burrowed / 0.8s telegraph / 1.2s emerged. Tune Friday.
- **Bugchan gag (Theme 2 flavor):** on first emerge, Bugchan quips about
  the smell. Write the line Friday.
- One mandrake shares the arena with PUMPKIN.EXE; it does not move the
  boss's phases, just adds pressure and Theme 2 scoring.

## Damage + HUD refresh (update())

- Every frame: refresh navi HP bar width, dim chip icons on cooldown.
- Boss HP text updates on every hit.
- Navi takes damage only from boss attacks (never from her own chips).

## Win / lose

- Boss HP 0 → "VIRUS DELETED" splash, pause scene, stop input.
- Navi HP 0 → game-over splash + retry prompt (design the exact flow Friday).

## Suggested Friday build order

1. State init + grid + sprites + input (skeleton comes alive).
2. Movement + clamping.
3. Chip firing (cannon first, then spread/sword/recover).
4. Boss HP + damage overlap + HUD refresh.
5. Boss movement + phase switching.
6. Boss attacks + navi damage + game-over.
7. Win/lose polish, SFX hooks.

## AI-velocity notes

- Steps 2–4 are mechanical — prime candidates for AI codegen with the
  plan above as the prompt context.
- Boss attack patterns are the creative meat; spend human judgment there.
- Keep a Friday devlog of what the AI generated vs. what Mel directed —
  that feeds the "AI Direction & Adaptability" judging criterion.
