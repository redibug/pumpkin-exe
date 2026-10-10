// Static deck — no deckbuilder. Battle chips are single-use: firing one
// removes it from the loadout and the rest slide left to fill the hole.
// (cooldownMs is legacy data, unused now that chips don't recharge.)

export const CHIPS = [
  { id: 'cannon',  name: 'Cannon',  damage: 40, cooldownMs: 2500, color: 0xffa726, desc: 'Fires a straight shot down the row.' },
  { id: 'sword',   name: 'Sword',   damage: 80, cooldownMs: 4000, color: 0x4fc3f7, desc: 'Slashes the tile directly ahead.' },
  { id: 'spread',  name: 'Spread',  damage: 25, cooldownMs: 3500, color: 0xba68c8, desc: 'Hits the target row and the rows above/below.' },
  { id: 'recover', name: 'Recover', damage: 0,  cooldownMs: 9000, color: 0x81c784, desc: 'Restores 60 HP to the navi.' },
  { id: 'railgun', name: 'Railgun', damage: 50, cooldownMs: 5000, color: 0x00e5ff, desc: 'Piercing hitscan blast down the entire row.' },
];

export const CHIP_MAP = Object.fromEntries(CHIPS.map((c) => [c.id, c]));

// Hardcoded battle deck — the chips that exist, no deckbuilding.
// Drawn into the hand at the custom screen; unselected cards stay in
// hand until discarded, spent/selected cards go to the discard pile.
export const DECK = [
  'cannon', 'cannon', 'cannon', 'cannon', 'cannon', 'cannon',
  'sword', 'sword', 'sword', 'sword', 'sword',
  'spread', 'spread', 'spread', 'spread', 'spread',
  'recover', 'recover', 'recover', 'recover',
  'railgun', 'railgun', 'railgun',
];

// Boss data — PUMPKIN.EXE. Phases keyed by HP thresholds.
export const BOSS = {
  name: 'PUMPKIN.EXE',
  maxHp: 600,
  phases: [
    { threshold: 1.0, name: 'Sprout',  moveIntervalMs: 1400, attackIntervalMs: 2200 },
    { threshold: 0.6, name: 'Vine',    moveIntervalMs: 1000, attackIntervalMs: 1700 },
    { threshold: 0.3, name: 'Harvest', moveIntervalMs: 700,  attackIntervalMs: 1200 },
  ],
};
