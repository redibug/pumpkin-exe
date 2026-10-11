// Standard virus types. Design data — safe as jam prep.
// Behavior lives in BattleScene.js (or enemies/*.js), written during the 72h window.

export const SKITTER = {
  id: 'skitterbug',
  name: 'SKITTERBUG',
  maxHp: 60,
  checkIntervalMs: 2800,  // slow cycle: each check is either a move or a spit
  bulletSpeed: 170,       // slow-moving ichor (chips fly at 520)
  bulletDamage: 10,
  bulletColor: 0x9dbb2e,  // sickly yellow-green ichor
  manualScale: 1,
};

export const SENTRY = {
  id: 'sentry',
  name: 'SENTRY',
  maxHp: 200,
  telegraphMs: 800,       // activated: sensor flashes red for slightly < 1s
  cooldownMs: 1000,       // cooldown: can't do anything for 1s
  laserDamage: 15,
  manualScale: 3,
};

export const BOMB_SPIDER = {
  id: 'bombspider',
  name: 'BOMB SPIDER',
  maxHp: 140,
  moveIntervalMs: 1600,   // cycle: move -> move -> throw -> repeat
  bombDamage: 20,
  throwDistance: 3,       // tiles forward (toward the player)
  manualScale: 1.25,
};

export const ROOTABREAK = {
  id: 'rootabreak',
  name: 'ROOTABREAK',
  maxHp: 120,
  // State machine: PLANTED -> LEAPING -> SCREAMING -> FALLING -> PLANTED
  // Stationary; invincible while planted. Jump timing synced by column.
  plantedMs: 3500,    // invulnerable, shown as a sprout
  columnDelayMs: 600, // each column jumps this much later than the last
  leapHeightPx: 110,  // how high they jump
  leapMs: 450,        // time to reach peak (then same to fall)
  screamDamage: 12,   // noise projectile damage
  noiseSpeed: 140,    // px/s, travels left and right
  manualScale: 1.25,
  sprite: 'rootabreak',
  sproutSprite: 'rootabreak-sprout',
  gag: "phew... smells like grandma's root cellar in here!",
};

// Per-enemy-type auto-scale: longest texture side auto-shrinks to fit.
// Unlisted types use the default FIT_MAX (512).
export const AUTOSCALE = {
  skitterbug: 120,
  sentry: 120,
  bombspider: 140,
};
