// Standard virus types. Design data — safe as jam prep.
// Behavior lives in BattleScene.js, written during the 72h window.

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
  sprite: 'rootabreak',
  sproutSprite: 'rootabreak-sprout',
  gag: "phew... smells like grandma's root cellar in here!",
};
