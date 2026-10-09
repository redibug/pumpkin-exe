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

import GRID_CONFIG from '../../grid-config.json';

// Live-tunable perspective parameters. Initialized from grid-config.json;
// the debug overlay mutates these at runtime (and can save them back).
export const gridParams = { ...GRID_CONFIG };

export function setGridParams(patch) {
  Object.assign(gridParams, patch);
}

export function getGridParams() {
  return { ...gridParams };
}

// Local tuning override: grid-config.local.json (gitignored, written by the
// debug overlay) wins over the committed defaults when present. Loaded async;
// scenes should use onGridParamsReady() to redraw once it lands.
let gridParamsReady = false;
const readyListeners = [];
export function onGridParamsReady(cb) {
  if (gridParamsReady) cb();
  else readyListeners.push(cb);
}
fetch('grid-config.local.json')
  .then((r) => (r.ok ? r.json() : {}))
  .catch(() => ({}))
  .then((local) => {
    Object.assign(gridParams, local);
    gridParamsReady = true;
    readyListeners.forEach((cb) => cb());
    readyListeners.length = 0;
  });

/** '#d63c82' -> { r: 214, g: 60, b: 130 } */
export function hexToRgb(hexStr) {
  const h = hexStr.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Project grid coords (gx in [0, COLS], gy in [0, ROWS]) to screen space.
 * @returns {{x: number, y: number, s: number}} screen pos + perspective scale.
 */
export function project(gx, gy) {
  const { cx, horizon, ground, base, zNear, zFar } = gridParams;
  const t = gy / ROWS;
  const z = zFar + (zNear - zFar) * t;
  const s = zNear / z;
  return {
    x: cx + (gx - COLS / 2) * base * s,
    y: horizon + ((ground - horizon) * zNear) / z,
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
