// MMBN-style grid: 6 columns x 3 rows.
// Player owns columns 0-2, enemy owns columns 3-5.

export const COLS = 6;
export const ROWS = 3;
export const PLAYER_COLS = [0, 1, 2];
export const ENEMY_COLS = [3, 4, 5];

// Pixel layout for a 960x540 stage.
export const TILE_W = 110;
export const TILE_H = 110;
export const GRID_ORIGIN_X = 150;
export const GRID_ORIGIN_Y = 105;

export function tileToWorld(col, row) {
  return {
    x: GRID_ORIGIN_X + col * TILE_W + TILE_W / 2,
    y: GRID_ORIGIN_Y + row * TILE_H + TILE_H / 2,
  };
}

export function isPlayerTile(col) {
  return PLAYER_COLS.includes(col);
}

export function isEnemyTile(col) {
  return ENEMY_COLS.includes(col);
}
