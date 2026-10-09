// Standard virus types. Design data — safe as jam prep.
// Behavior lives in BattleScene.js, written during the 72h window.

export const RUTABAGA_MANDRAKE = {
  id: 'rutabaga-mandrake',
  name: 'RUTABAGA.MND',
  maxHp: 120,
  // State machine: BURROWED -> TELEGRAPH -> EMERGED -> BURROWED
  burrowedMs: 4000,   // invulnerable, hidden as a dirt mound
  telegraphMs: 800,   // tile flashes, rumble — fairness window
  emergedMs: 1200,    // vulnerable; screams at end of window
  screamDamage: 15,   // row-wide noise attack on the navi's row
  sprite: 'virus-rutabaga-mandrake',
  gag: "phew... smells like grandma's root cellar in here!",
};
