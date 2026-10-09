// MMBN-style grid: 6 columns x 3 rows, rendered in fake-3D perspective.
// Player owns columns 0-2, enemy owns columns 3-5.
//
// Projection is true 1/depth perspective (the mock-up math, battle-mockup.png):
// gy=0 is the far edge at the horizon, gy=ROWS is the near edge. Both screen
// position and scale fall out of depth z, so fighters shrink as they move
// away and tiles converge toward the vanishing point.

export const COLS = 6;
export const ROWS = 3;
export const PLAYER_COLS = [0, 1, 2];
export const ENEMY_COLS = [3, 4, 5];

const CX = 480;      // vanishing-point x (screen center)
const HORIZON = 140; // screen y of the far grid edge
const GROUND = 400;  // screen y of the near grid edge
const BASE = 120;    // tile width in px at z = 1 (near edge)
const ZNEAR = 1.0;
const ZFAR = 2.0;
const K = (GROUND - HORIZON) * ZNEAR;

/**
 * Project grid coords (gx in [0, COLS], gy in [0, ROWS]) to screen space.
 * @returns {{x: number, y: number, s: number}} screen pos + perspective scale.
 */
export function project(gx, gy) {
  const t = gy / ROWS;
  const z = ZFAR + (ZNEAR - ZFAR) * t;
  const s = ZNEAR / z;
  return {
    x: CX + (gx - COLS / 2) * BASE * s,
    y: HORIZON + K / z,
    s,
  };
}

/** Four screen-space corners of tile (c, r): [topLeft, topRight, bottomRight, bottomLeft]. */
export function tileCorners(c, r) {
  return [
    project(c, r),       // tl
    project(c + 1, r),   // tr
    project(c + 1, r + 1), // br
    project(c, r + 1),   // bl
  ];
}

/** Screen pos + scale for a fighter's FEET on tile (c, r). Fighters are
 *  anchored bottom-middle (origin 0.5, 1) so they stand on their tiles. */
export function tileFeet(c, r) {
  return project(c + 0.5, r + 1);
}

/** Screen pos + scale at the center of tile (c, r). */
export function tileCenter(c, r) {
  return project(c + 0.5, r + 0.5);
}

export function isPlayerTile(col) {
  return PLAYER_COLS.includes(col);
}

export function isEnemyTile(col) {
  return ENEMY_COLS.includes(col);
}
