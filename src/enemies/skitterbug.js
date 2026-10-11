// skitterbug enemy: spawn + AI.
// Methods are mixed into BattleScene via Object.assign, so `this` is the scene.
import Phaser from 'phaser';
import { COLS, ROWS, project, tileCorners, tileFeet, tileCenter } from '../systems/grid.js';
import { SKITTER, SENTRY, BOMB_SPIDER, ROOTABREAK, AUTOSCALE } from '../data/viruses.js';
import { FIT_MAX } from '../systems/spriteFit.js';
import { SCRIPTS } from '../systems/dialogue.js';
import { sound } from '../systems/sound.js';

export const SkitterbugMethods = {
  spawnSkitterbug(col, row) {
    const sprite = this.physics.add.sprite(0, 0, 'skitterbug');
    sprite.setData('fitMax', AUTOSCALE.skitterbug ?? FIT_MAX);
    sprite.setOrigin(0.5, 1);
    this.placeFighter(sprite, col, row, SKITTER.manualScale);
    const enemy = {
      type: 'skitterbug', sprite, col, row,
      hp: SKITTER.maxHp, maxHp: SKITTER.maxHp, alive: true,
      nextCheck: 0,
      moveIntent: Math.random() < 0.5 ? -1 : 1, // -1 = up, 1 = down
      canSpit: false, // starts with a move (move, spit, move, spit...)
      shootAnim: false, // true while the shoot tween is playing
      hpBar: this.makeHpBar(),
    };
    // Idle bob as an INFINITE tween (keeps playing during pause, per the
    // standing rule). Squash-and-stretch on SCALE, not y — the sprite is
    // anchored at bottom-center (origin 0.5,1), so the feet stay planted.
    enemy.baseScaleX = sprite.scaleX;
    enemy.baseScaleY = sprite.scaleY;
    enemy.squash = { v: 0 };
    enemy.bobTween = this.tweens.add({
      targets: enemy.squash,
      v: 1,
      duration: 700 + Math.random() * 300, // desync per bug
      yoyo: true,
      repeat: -1, // infinite: survives setPaused
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (!enemy.alive) return;
        if (sprite.getData('teleporting') || enemy.shootAnim) return;
        const k = enemy.squash.v;
        sprite.setScale(
          enemy.baseScaleX * (1 + 0.04 * k), // wider
          enemy.baseScaleY * (1 - 0.06 * k)  // shorter
        );
      },
    });
    this.enemies.push(enemy);
    return enemy;
  },
  skitterbugAI(e, time) {
    if (time < e.nextCheck) return;
    e.nextCheck = time + SKITTER.checkIntervalMs;

    if (e.canSpit && this.naviPos.row === e.row) {
      this.spitIchor(e);
      e.canSpit = false;
      return;
    }
    // move: try the intended direction first
    let dir = e.moveIntent;
    let nr = e.row + dir;
    if (nr < 0 || nr >= ROWS) {
      dir = -dir; // blocked: flip intent, try the other way
      nr = e.row + dir;
    }
    if (nr < 0 || nr >= ROWS) {
      // can't move either way: regain spit, sit tight until next check
      e.canSpit = true;
      return;
    }
    e.moveIntent = dir;
    e.row = nr;
    this.teleportMove(e.sprite, e.col, e.row, SKITTER.manualScale, () => {
      // refresh base scale after the move (perspective may differ by row)
      e.baseScaleX = e.sprite.scaleX;
      e.baseScaleY = e.sprite.scaleY;
    });
    e.canSpit = true; // moving restores the spit
  },
  spitIchor(e) {
    sound.spit();
    // shoot animation: rear up (squash), then snap forward as the bullet fires
    const s = e.sprite;
    const bx = s.scaleX, by = s.scaleY;
    e.shootAnim = true;
    this.tweens.killTweensOf(s);
    this.tweens.add({
      targets: s,
      scaleX: bx * 0.9,
      scaleY: by * 1.12,
      duration: 90,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // fire!
        this.tweens.add({
          targets: s,
          scaleX: bx * 1.12,
          scaleY: by * 0.9,
          duration: 70,
          ease: 'Quad.easeOut',
          yoyo: true,
          onComplete: () => {
            s.setScale(bx, by);
            e.shootAnim = false;
          },
        });
        this.spawnIchorBullet(e);
      },
    });
  },
  spawnIchorBullet(e) {
    const p = tileCenter(e.col, e.row);
    const bullet = this.add.circle(p.x - 20, p.y, 8, SKITTER.bulletColor);
    bullet.setDepth(10 + e.row);
    // perspective: inherit from the shooter (going forward, all projectiles do this)
    const ps = e.sprite.scaleX;
    bullet.setScale(ps);
    bullet.setData('vx', -SKITTER.bulletSpeed);
    bullet.setData('row', e.row);
    bullet.setData('damage', SKITTER.bulletDamage);
    this.enemyProjectiles.add(bullet);
    this.tweens.add({ targets: bullet, scaleX: ps * 1.4, scaleY: ps * 1.4, duration: 120, yoyo: true });
  }
};
