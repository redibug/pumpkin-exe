// rootabreak enemy: spawn + AI.
// Methods are mixed into BattleScene via Object.assign, so `this` is the scene.
import Phaser from 'phaser';
import { COLS, ROWS, project, tileCorners, tileFeet, tileCenter } from '../systems/grid.js';
import { SKITTER, SENTRY, BOMB_SPIDER, ROOTABREAK, AUTOSCALE } from '../data/viruses.js';
import { FIT_MAX } from '../systems/spriteFit.js';
import { SCRIPTS } from '../systems/dialogue.js';

export const RootabreakMethods = {
  spawnRootabreak(col, row, big = false) {
    const mp = tileFeet(col, row);
    const mc = tileCenter(col, row);
    // planted: sprout visible, main sprite hidden
    // centered on the tile (it's rooted, not standing)
    const sprout = this.add.image(mc.x, mc.y, 'rootabreak-sprout');
    sprout.setOrigin(0.5, 0.9);
    sprout.setScale(mp.s * 0.9).setDepth(9 + row);
    const sprite = this.physics.add.sprite(mc.x, mc.y, 'rootabreak').setVisible(false);
    sprite.setData('fitMax', AUTOSCALE.rootabreak ?? FIT_MAX);
    sprite.setOrigin(0.5, 0.9); // lifted off the tile surface
    if (big) sprite.setTint(0xffab91); // big one: slightly red tint
    this.placeFighter(sprite, col, row, ROOTABREAK.manualScale * (big ? 1.35 : 1));
    // override placeFighter's feet positioning: center on the tile
    sprite.setPosition(mc.x, mc.y);
    // align sprout's bottom with the main sprite's bottom (different sizes,
    // same origin) so the plant/replant transition doesn't jump
    const sproutY = sprite.y + 0.1 * (sprite.displayHeight - sprout.displayHeight);
    sprout.setPosition(mc.x, sproutY);
    // store the home position for the leap (sprite returns here)
    const homeY = sprite.y;
    const maxHp = big ? ROOTABREAK.maxHp * 2 : ROOTABREAK.maxHp;
    const enemy = {
      type: 'rootabreak', sprite, sprout, col, row, homeY, sproutY,
      hp: maxHp, maxHp, alive: true, big,
      state: 'planted', // planted | leaping | screaming | falling
      nextJump: -1, // init on first AI tick (column-synced)
      screamText: null, wiggleTween: null,
      sproutPopping: false, // true during the replant pop-in (idle pauses)
      hpBar: this.makeHpBar(),
    };
    // Sprout idle: gentle squash-and-stretch like skitterbug (feet planted)
    enemy.sproutBaseScaleX = sprout.scaleX;
    enemy.sproutBaseScaleY = sprout.scaleY;
    enemy.sproutSquash = { v: 0 };
    enemy.sproutBob = this.tweens.add({
      targets: enemy.sproutSquash,
      v: 1,
      duration: 900 + Math.random() * 400, // desync per plant
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (!enemy.alive) return;
        if (enemy.state !== 'planted' || !enemy.sprout.visible) return;
        if (enemy.sproutPopping) return; // pop-in owns the scale
        const k = enemy.sproutSquash.v;
        enemy.sprout.setScale(
          enemy.sproutBaseScaleX * (1 + 0.03 * k), // wider
          enemy.sproutBaseScaleY * (1 - 0.05 * k)  // shorter
        );
      },
    });
    this.enemies.push(enemy);
    return enemy;
  },
  rootabreakAI(md, time) {
    if (!md.alive) return;
    // init jump timer on first tick: column-synced (same col jumps together,
    // each column to the right is slightly delayed)
    if (md.nextJump < 0) {
      md.nextJump = time + ROOTABREAK.plantedMs + (md.col - 3) * ROOTABREAK.columnDelayMs;
      return;
    }
    if (md.state !== 'planted' || time < md.nextJump) return;

    // LEAP: hide sprout, show sprite
    md.state = 'leaping';
    md.sprout.setVisible(false);
    md.sprite.setVisible(true);
    const manual = ROOTABREAK.manualScale * (md.big ? 1.35 : 1);
    this.placeFighter(md.sprite, md.col, md.row, manual);
    // center on the tile (not feet)
    const mc = tileCenter(md.col, md.row);
    md.sprite.setPosition(mc.x, mc.y);
    const airHomeY = md.sprite.y;
    // pop-in scale
    const targetScale = md.sprite.scaleX;
    md.sprite.setScale(targetScale * 0.3);
    this.tweens.add({
      targets: md.sprite, scaleX: targetScale, scaleY: targetScale,
      duration: 150, ease: 'Back.easeOut',
    });
    // wiggle while airborne: gentle rotation
    md.wiggleTween = this.tweens.add({
      targets: md.sprite, angle: 6,
      duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // leap up
    this.tweens.add({
      targets: md.sprite, y: airHomeY - ROOTABREAK.leapHeightPx,
      duration: ROOTABREAK.leapMs, ease: 'Quad.easeOut',
      onComplete: () => {
        if (!md.alive) return;
        // SCREAM at peak: KYAAH! floats up and fades, sound waves out
        // (from the sprite's air position, not the ground)
        // Offsets scale with displayHeight so they track the head at any distance.
        md.state = 'screaming';
        const sx = md.sprite.x, sy = md.sprite.y;
        const dh = md.sprite.displayHeight;
        const textY = sy - 0.95 * dh; // at head height
        md.screamText = this.add.text(sx, textY, 'KYAAAH!!', {
          fontFamily: 'monospace', fontSize: '22px', color: '#ce93d8',
          stroke: '#2a0a2a', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(31); // above the HP number (depth 30)
        // float up slowly and fade out (longer-lived)
        // shake: intense at first, still by half duration (decaying amplitude)
        const baseX = sx;
        const shake = { t: 0 };
        this.tweens.add({
          targets: shake, t: 1, duration: 1800, ease: 'Linear',
          onUpdate: () => {
            if (!md.screamText || !md.screamText.active) return;
            const amp = (1 - shake.t) * 10; // 10px -> 0
            md.screamText.x = baseX + Phaser.Math.Between(-amp, amp);
          },
          onComplete: () => {
            if (md.screamText && md.screamText.active) md.screamText.x = baseX;
          },
        });
        this.tweens.add({
          targets: md.screamText, y: textY - 0.3 * dh, alpha: 0,
          duration: 1800*2, ease: 'Quad.easeOut',
          onComplete: () => {
            if (md.screamText) { md.screamText.destroy(); md.screamText = null; }
          },
        });
        this.spawnNoiseWave(md, -1); // left
        this.spawnNoiseWave(md, 1);  // right
        if (!this.mandrakeGagged) {
          this.mandrakeGagged = true;
          this.startDialogue(SCRIPTS.mandrakeGag);
        }
        // hang at peak briefly, then fall
        this.time.delayedCall(350, () => {
          if (!md.alive) return;
          md.state = 'falling';
          this.tweens.add({
            targets: md.sprite, y: airHomeY,
            duration: ROOTABREAK.leapMs, ease: 'Quad.easeIn',
            onComplete: () => {
              if (!md.alive) return;
              // stop the wiggle
              if (md.wiggleTween) { md.wiggleTween.stop(); md.wiggleTween = null; }
              md.sprite.setAngle(0);
              // LAND: scale down (reverse of pop-in), then re-plant
              this.tweens.add({
                targets: md.sprite, scaleX: 0, scaleY: 0,
                duration: 130, ease: 'Quad.easeIn',
                onComplete: () => {
                  if (!md.alive) return;
                  md.state = 'planted';
                  md.sprite.setVisible(false);
                  // sprout pops in at the bottom-aligned position
                  md.sprout.setPosition(md.sprite.x, md.sproutY).setVisible(true);
                  md.sproutPopping = true;
                  md.sprout.setScale(0);
                  // refresh base scale (perspective may have changed)
                  const mp = tileFeet(md.col, md.row);
                  md.sproutBaseScaleX = mp.s * 0.9;
                  md.sproutBaseScaleY = mp.s * 0.9;
                  this.tweens.add({
                    targets: md.sprout, scaleX: md.sproutBaseScaleX, scaleY: md.sproutBaseScaleY,
                    duration: 160, ease: 'Back.easeOut',
                    onComplete: () => { md.sproutPopping = false; },
                  });
                  md.nextJump = this.time.now + ROOTABREAK.plantedMs + (md.col - 3) * ROOTABREAK.columnDelayMs;
                },
              });
            },
          });
        });
      },
    });
  },
  spawnNoiseWave(md, dir) {
    // Sound wave: vertical arc, endpoints toward the rootabreak, bulging
    // outward — like a ripple tracing a circle around them.
    // Spawns at the sprite's air position with perspective scale.
    // The arc's leading edge (bulge) is at local x=0 so the hitbox (proj.x)
    // lines up with the visual.
    const g = this.add.graphics();
    const color = 0xce93d8;
    g.lineStyle(4, color, 0.9);
    // arc: radius 34, spanning ~100 degrees. Circle center offset so the
    // bulge (leading edge) sits at x=0.
    const radius = 34;
    const halfAngle = Phaser.Math.DegToRad(50);
    if (dir > 0) {
      // right side: bulge at x=0, circle center to the left
      g.arc(-radius, 0, radius, -halfAngle, halfAngle, false);
    } else {
      // left side: bulge at x=0, circle center to the right
      g.arc(radius, 0, radius, Math.PI - halfAngle, Math.PI + halfAngle, false);
    }
    g.strokePath();
    // perspective: match the sprite's scale (going forward, all projectiles
    // should inherit perspective from their source)
    const ps = md.sprite.scaleX;
    // spawn a quarter tile out in the travel direction, at mouth height
    const corners = tileCorners(md.col, md.row);
    const tileW = Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x));
    g.setPosition(
      md.sprite.x + dir * tileW * 0.25,
      md.sprite.y - 0.5 * md.sprite.displayHeight
    );
    g.setScale(ps);
    g.setDepth(10 + md.row);
    g.setData('vx', dir * ROOTABREAK.noiseSpeed);
    g.setData('row', md.row);
    g.setData('damage', ROOTABREAK.screamDamage);
    g.setData('expand', 0); // tracks expansion for the update loop
    g.setData('baseScale', ps); // perspective scale (expansion multiplies this)
    this.enemyProjectiles.add(g);
  }
};
