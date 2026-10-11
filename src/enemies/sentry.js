// sentry enemy: spawn + AI.
// Methods are mixed into BattleScene via Object.assign, so `this` is the scene.
import Phaser from 'phaser';
import { COLS, ROWS, project, tileCorners, tileFeet, tileCenter } from '../systems/grid.js';
import { SKITTER, SENTRY, BOMB_SPIDER, ROOTABREAK, AUTOSCALE } from '../data/viruses.js';
import { FIT_MAX } from '../systems/spriteFit.js';
import { SCRIPTS } from '../systems/dialogue.js';
import { sound } from '../systems/sound.js';

export const SentryMethods = {
  spawnSentry(col, row) {
    // Stationary turret. State machine: ready (watching) -> activated
    // (sensor flashing red, ~800ms) -> fires piercing hitscan laser ->
    // cooldown (1s, does nothing) -> ready.
    const sprite = this.physics.add.sprite(0, 0, 'sentry');
    sprite.setData('fitMax', AUTOSCALE.sentry ?? FIT_MAX);
    sprite.setOrigin(0.75, 1);
    this.placeFighter(sprite, col, row, SENTRY.manualScale);
    // sensor light: red dot at the indicator on the sprite (74.5% from
    // left, 43.8% from top); flashes when activated.
    // Origin is (0.75, 1), so offset from sprite.x/y accordingly.
    const sensor = this.add.circle(
      sprite.x + (0.7449 - 0.75) * sprite.displayWidth,
      sprite.y + (0.4375 - 1.0) * sprite.displayHeight,
      7, 0xff3b30
    );
    sensor.setDepth(sprite.depth + 1);
    sensor.setVisible(false);
    const enemy = {
      type: 'sentry', sprite, sensor, col, row,
      hp: SENTRY.maxHp, maxHp: SENTRY.maxHp, alive: true,
      state: 'ready', // ready | activated | cooldown
      cooldownUntil: 0,
      hpBar: this.makeHpBar(),
      baseX: sprite.x, baseY: sprite.y, // home position (for kickback reset)
    };
    this.enemies.push(enemy);
    return enemy;
  },
  sentryAI(e, time) {
    if (!e.alive || this.over) return;

    if (e.state === 'cooldown') {
      if (time >= e.cooldownUntil) {
        e.state = 'ready';
      }
      return;
    }
    if (e.state === 'activated') return; // fire timer is pending

    // ready: the moment the navi steps onto its row, activate
    if (this.naviPos.row !== e.row) return;
    e.state = 'activated';
    sound.warning();

    // sensor light flashes red for slightly less than a second
    e.sensor.setVisible(true);
    e.sensor.setAlpha(1);
    this.tweens.add({
      targets: e.sensor, alpha: 0.15, duration: 100, yoyo: true, repeat: 7,
    });

    this.time.delayedCall(SENTRY.telegraphMs, () => {
      if (!e.alive || this.over) { e.state = 'ready'; e.sensor.setVisible(false); return; }
      this.fireSentryLaser(e);
      // summoned sentries (boss attack) delete themselves after firing
      if (e.summoned) {
        e.alive = false;
        if (e.sensor) { this.tweens.killTweensOf(e.sensor); e.sensor.destroy(); }
        if (e.hpBar) e.hpBar.setVisible(false);
        this.tweens.killTweensOf(e.sprite);
        e.sprite.destroy();
        return;
      }
      e.state = 'cooldown';
      e.cooldownUntil = this.time.now + SENTRY.cooldownMs;
      e.sensor.setVisible(false);
    });
  },
  fireSentryLaser(e) {
    sound.laser();
    // Instant piercing hitscan (like the railgun chip, but firing left at
    // the navi). Powerful kickback shoves the sentry right slightly.
    const s = e.sprite;
    const baseX = s.x;
    this.tweens.add({
      targets: s, x: baseX + 14, duration: 90, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => { if (s.active) s.setX(baseX); },
    });

    // red beam from the cannon muzzle (left edge, 33.9% from top) leftwards.
    // Origin is (0.75, 1).
    const mx = s.x + (0.0 - 0.75) * s.displayWidth;
    const my = s.y + (0.3390 - 1.0) * s.displayHeight;
    const beam = this.add.line(0, 0, 30, my, mx, my, 0xff3b30).setOrigin(0, 0);
    beam.setLineWidth(6).setAlpha(0.95);
    beam.setDepth(10 + e.row);
    this.tweens.add({ targets: beam, alpha: 0, duration: 160, onComplete: () => beam.destroy() });

    // hitscan: if the navi is on the row when it fires, she takes the hit
    if (this.naviPos.row === e.row) {
      this.damageNavi(SENTRY.laserDamage);
      this.flash(this.navi, 0xff3b30);
    }
  }
};
