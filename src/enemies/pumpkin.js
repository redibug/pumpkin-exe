// pumpkin enemy: spawn + AI.
// Methods are mixed into BattleScene via Object.assign, so `this` is the scene.
import Phaser from 'phaser';
import { COLS, ROWS, project, tileCorners, tileFeet, tileCenter } from '../systems/grid.js';
import { SKITTER, SENTRY, BOMB_SPIDER, ROOTABREAK, AUTOSCALE } from '../data/viruses.js';
import { FIT_MAX } from '../systems/spriteFit.js';
import { SCRIPTS } from '../systems/dialogue.js';
import { BOSS } from '../data/chips.js';
import { sound } from '../systems/sound.js';

export const PumpkinMethods = {
  spawnPumpkin(col, row) {
    const bp = tileFeet(col, row);
    const sprite = this.physics.add.sprite(bp.x, bp.y, 'boss');
    sprite.setData('fitMax', AUTOSCALE.pumpkin ?? FIT_MAX);
    sprite.setOrigin(0.5, 1); // viruses stand on their tiles too
    this.placeFighter(sprite, col, row, BOSS.manualScale);
    const enemy = {
      type: 'pumpkin', sprite, col, row,
      hp: BOSS.maxHp, maxHp: BOSS.maxHp, alive: true,
      nextMove: 0, nextAttack: 0,
      nextTwitch: 0, // set on first AI tick
      lastPhase: null,
      hpBar: this.makeHpBar(),
    };
    // Breathing: barely-there squash-and-stretch, pauses during teleport
    enemy.breathBaseScaleX = sprite.scaleX;
    enemy.breathBaseScaleY = sprite.scaleY;
    enemy.breath = { v: 0 };
    enemy.breathTween = this.tweens.add({
      targets: enemy.breath, v: 1,
      duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (!enemy.alive) return;
        if (enemy.sprite.getData('teleporting')) return;
        const k = enemy.breath.v;
        enemy.sprite.setScale(
          enemy.breathBaseScaleX * (1 + 0.015 * k),
          enemy.breathBaseScaleY * (1 - 0.02 * k)
        );
      },
    });
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
    // dramatic sting + summon a rootabreak on phase change (Vine & Harvest)
    if (e.lastPhase && e.lastPhase !== phase) {
      sound.battleStart();
      // spawn a rootabreak on a free enemy-side tile
      const freeTiles = [];
      for (let c = 3; c <= 5; c++) {
        for (let r = 0; r < ROWS; r++) {
          const occupied = this.enemies.some((o) => o.alive && o.col === c && o.row === r);
          if (!occupied) freeTiles.push({ col: c, row: r });
        }
      }
      if (freeTiles.length > 0) {
        const spot = Phaser.Utils.Array.GetRandom(freeTiles);
        this.spawnRootabreak(spot.col, spot.row, false);
      }
    }
    e.lastPhase = phase;

    // rare unnerving twitch: sudden jerk with no easing, then still
    if (!e.nextTwitch) e.nextTwitch = time + Phaser.Math.Between(3000, 6000);
    if (time >= e.nextTwitch && !e.sprite.getData('teleporting')) {
      e.nextTwitch = time + Phaser.Math.Between(5000, 10000);
      // snap to a wrong angle, hold a beat, snap back
      const jerk = Phaser.Math.Between(-5, 5) || 3;
      this.tweens.add({
        targets: e.sprite, angle: jerk,
        duration: 60, ease: 'Quad.easeIn',
        onComplete: () => {
          this.time.delayedCall(120, () => {
            if (!e.alive) return;
            this.tweens.add({
              targets: e.sprite, angle: 0,
              duration: 90, ease: 'Quad.easeOut',
            });
          });
        },
      });
    }

    // wander enemy columns
    if (time >= e.nextMove) {
      e.nextMove = time + phase.moveIntervalMs;
      const nc = Phaser.Math.Between(3, 5);
      const nr = Phaser.Math.Between(0, ROWS - 1);
      e.col = nc; e.row = nr;
      this.teleportMove(e.sprite, nc, nr, BOSS.manualScale);
    }

    // telegraphed pumpkin drop: floating pumpkin slams onto the navi's tile
    if (time >= e.nextAttack) {
      e.nextAttack = time + phase.attackIntervalMs;
      const target = { col: this.naviPos.col, row: this.naviPos.row };
      const warn = this.highlightTile(target.col, target.row, 0xff5252, 0.4);
      // float delay shrinks as HP drops: 500ms full -> 200ms near death
      const hpFrac = e.hp / e.maxHp;
      const floatMs = 200 + 300 * hpFrac;
      // spawn pumpkin above the target tile
      const tc = tileCenter(target.col, target.row);
      const tf = tileFeet(target.col, target.row);
      const drop = this.add.image(tc.x, tc.y - 420 * tf.s, 'pumpkin-drop');
      drop.setScale(tf.s * 0.9);
      drop.setDepth(10 + target.row);
      drop.setAngle(Phaser.Math.Between(-8, 8));
      // gentle hover wobble while floating
      const wobble = this.tweens.add({
        targets: drop, y: drop.y - 12 * tf.s,
        duration: 240, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.time.delayedCall(floatMs, () => {
        warn.destroy();
        if (this.over || !e.alive) { wobble.stop(); drop.destroy(); return; }
        wobble.stop();
        // slam down fast
        this.tweens.add({
          targets: drop, y: tc.y, angle: 0,
          duration: 160, ease: 'Quad.easeIn',
          onComplete: () => {
            if (this.over) { drop.destroy(); return; }
            sound.slam();
            sound.explosion();
            this.playExplosion(tc.x, tc.y, tf.s * 0.8);
            // screen shake
            this.cameras.main.shake(120, 0.008);
            // hit if navi is still on the warned tile
            if (this.naviPos.col === target.col && this.naviPos.row === target.row) {
              this.damageNavi(20);
            }
            drop.destroy();
          },
        });
      });
    }
  }
};
