// pumpkin enemy: spawn + AI.
// Methods are mixed into BattleScene via Object.assign, so `this` is the scene.
import Phaser from 'phaser';
import { COLS, ROWS, project, tileCorners, tileFeet, tileCenter } from '../systems/grid.js';
import { SKITTER, SENTRY, BOMB_SPIDER, ROOTABREAK, AUTOSCALE } from '../systems/viruses.js';
import { FIT_MAX } from '../systems/spriteFit.js';
import { SCRIPTS } from '../systems/dialogue.js';

export const PumpkinMethods = {
  spawnPumpkin(col, row) {
    const bp = tileFeet(col, row);
    const sprite = this.physics.add.sprite(bp.x, bp.y, 'boss');
    sprite.setData('fitMax', AUTOSCALE.pumpkin ?? FIT_MAX);
    sprite.setOrigin(0.5, 1); // viruses stand on their tiles too
    this.placeFighter(sprite, col, row, BOSS_MANUAL);
    const enemy = {
      type: 'pumpkin', sprite, col, row,
      hp: BOSS.maxHp, maxHp: BOSS.maxHp, alive: true,
      nextMove: 0, nextAttack: 0,
      hpBar: this.makeHpBar(),
    };
    this.enemies.push(enemy);
    return enemy;
  },
  bossPhase(enemy) {
    const frac = enemy.hp / enemy.maxHp;
    if (frac < 0.3) return BOSS.phases[2]; // Harvest
    if (frac < 0.6) return BOSS.phases[1];  // Vine
    return BOSS.phases[0];                  // Sprout
  },
  pumpkinAI(e, time) {
    const phase = this.bossPhase(e);

    // wander enemy columns
    if (time >= e.nextMove) {
      e.nextMove = time + phase.moveIntervalMs;
      const nc = Phaser.Math.Between(3, 5);
      const nr = Phaser.Math.Between(0, ROWS - 1);
      e.col = nc; e.row = nr;
      this.teleportMove(e.sprite, nc, nr, BOSS_MANUAL);
    }

    // telegraphed tile slam on the navi's tile
    if (time >= e.nextAttack) {
      e.nextAttack = time + phase.attackIntervalMs;
      const target = { col: this.naviPos.col, row: this.naviPos.row };
      const warn = this.highlightTile(target.col, target.row, 0xff5252, 0.4);
      this.time.delayedCall(700, () => {
        warn.destroy();
        if (this.over) return;
        // hit if navi is still on the warned tile
        if (this.naviPos.col === target.col && this.naviPos.row === target.row) {
          this.damageNavi(20);
        }
        const bc = tileCenter(target.col, target.row);
        const boom = this.add.circle(bc.x, bc.y, 40, 0xff9e2c, 0.5);
        boom.setDepth(10 + target.row); // above the floor, ordered by row
        this.tweens.add({ targets: boom, alpha: 0, scale: 1.6, duration: 250,
          onComplete: () => boom.destroy() });
      });
    }
  }
};
