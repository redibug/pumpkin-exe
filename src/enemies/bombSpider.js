// bombSpider enemy: spawn + AI.
// Methods are mixed into BattleScene via Object.assign, so `this` is the scene.
import Phaser from 'phaser';
import { COLS, ROWS, project, tileCorners, tileFeet, tileCenter } from '../systems/grid.js';
import { SKITTER, SENTRY, BOMB_SPIDER, ROOTABREAK, AUTOSCALE } from '../data/viruses.js';
import { FIT_MAX } from '../systems/spriteFit.js';
import { SCRIPTS } from '../systems/dialogue.js';

export const BombSpiderMethods = {
  spawnBombSpider(col, row) {
    // Bomb Spider (rebranded Jack): walks randomly, carries a bomb on its
    // back. At intervals it throws the bomb 3 tiles forward (toward player);
    // on landing it damages the 3x3 area. Bomb is composited in-engine:
    // a separate sprite on the back (hidden while thrown).
    const sprite = this.physics.add.sprite(0, 0, 'bomb-spider');
    sprite.setData('fitMax', AUTOSCALE.bombspider ?? FIT_MAX);
    sprite.setOrigin(0.5, 1);
    this.placeFighter(sprite, col, row, BOMB_SPIDER.manualScale);
    // bomb on the back: sits at the abdomen, layered BEHIND the spider
    const bombBack = this.add.sprite(0, 0, 'bomb');
    bombBack.play('bomb-fuse');
    bombBack.setOrigin(0.5, 0.5);
    // scale bomb relative to spider (bomb art is 64px, spider is 128px wide)
    const bombScale = sprite.scaleX * 0.9;
    bombBack.setScale(bombScale);
    bombBack.setDepth(sprite.depth - 0.5); // behind the spider
    this.positionBombBack({ sprite, bombBack });
    const enemy = {
      type: 'bombspider', sprite, bombBack, col, row,
      hp: BOMB_SPIDER.maxHp, maxHp: BOMB_SPIDER.maxHp, alive: true,
      nextMove: 0,
      movesDone: 0, // cycle: move -> move -> throw -> repeat
      hasBomb: true, // false while the thrown bomb is in the air
      hpBar: this.makeHpBar(),
    };
    // Idle: same squash-and-stretch as skitterbug (feet planted, scale only)
    enemy.baseScaleX = sprite.scaleX;
    enemy.baseScaleY = sprite.scaleY;
    enemy.squash = { v: 0 };
    enemy.bobTween = this.tweens.add({
      targets: enemy.squash,
      v: 1,
      duration: 700 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (!enemy.alive) return;
        if (sprite.getData('teleporting')) return;
        const k = enemy.squash.v;
        sprite.setScale(
          enemy.baseScaleX * (1 + 0.04 * k),
          enemy.baseScaleY * (1 - 0.06 * k)
        );
      },
    });
    this.enemies.push(enemy);
    return enemy;
  },
  positionBombBack(e) {
    const s = e.sprite;
    e.bombBack.setPosition(
      s.x + s.displayWidth * 0.28,
      s.y - s.displayHeight * 0.72
    );
    // inherit the spider's current scale (incl. squash) on both axes
    e.bombBack.setScale(s.scaleX * 0.9, s.scaleY * 0.9);
    e.bombBack.setDepth(s.depth - 0.5); // behind the spider
  },
  syncBombBacks() {
    for (const e of this.enemies) {
      if (e.type !== 'bombspider' || !e.bombBack || !e.alive) continue;
      e.bombBack.setVisible(e.hasBomb && e.sprite.visible);
      if (e.hasBomb && e.sprite.visible) this.positionBombBack(e);
    }
  },
  bombSpiderAI(e, time) {
    // Cycle: move -> move -> throw -> repeat
    if (time >= e.nextMove) {
      e.nextMove = time + BOMB_SPIDER.moveIntervalMs;
      if (e.movesDone >= 3) {
        // time to throw (if carrying the bomb)
        if (e.hasBomb) {
          this.throwBomb(e);
        }
        e.movesDone = 0;
      } else {
        // do a move: try all 4 directions in random order
        const dirs = Phaser.Utils.Array.Shuffle([[-1, 0], [1, 0], [0, -1], [0, 1]]);
        for (const [dc, dr] of dirs) {
          const nc = Phaser.Math.Clamp(e.col + dc, 3, 5);
          const nr = Phaser.Math.Clamp(e.row + dr, 0, ROWS - 1);
          if (nc !== e.col || nr !== e.row) {
            e.col = nc; e.row = nr;
            this.teleportMove(e.sprite, e.col, e.row, BOMB_SPIDER.manualScale, () => {
              // refresh base scale after the move (perspective may differ by row)
              e.baseScaleX = e.sprite.scaleX;
              e.baseScaleY = e.sprite.scaleY;
              this.positionBombBack(e);
            });
            this.positionBombBack(e);
            break;
          }
        }
        e.movesDone++;
      }
    }
  },
  throwBomb(e) {
    e.hasBomb = false;
    e.bombBack.setVisible(false);
    // target: 3 tiles forward (toward player), same row; clamp to grid
    const targetCol = Math.max(0, e.col - BOMB_SPIDER.throwDistance);
    const targetRow = e.row;
    // red warning indicators on the affected tiles (plus-shape)
    const warns = [];
    const tiles = [[targetCol, targetRow],
      [targetCol - 1, targetRow], [targetCol + 1, targetRow],
      [targetCol, targetRow - 1], [targetCol, targetRow + 1]];
    for (const [c, r] of tiles) {
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
        warns.push(this.highlightTile(c, r, 0xff3b30, 0.35));
      }
    }
    e.bombWarns = warns;
    const startX = e.sprite.x, startY = e.sprite.y - e.sprite.displayHeight * 0.7;
    const end = tileFeet(targetCol, targetRow);
    // flying bomb: same art, fuse anim, rotates slowly in flight
    const bomb = this.add.sprite(startX, startY, 'bomb');
    bomb.play('bomb-fuse');
    bomb.setScale(e.sprite.scaleX * 0.9);
    bomb.setDepth(20); // above everything while flying
    const proxy = { t: 0 };
    const arcH = 190; // higher arc
    this.tweens.add({
      targets: proxy, t: 1, duration: 1050, ease: 'Linear', // longer flight
      onUpdate: () => {
        const t = proxy.t;
        const x = startX + (end.x - startX) * t;
        const y = startY + (end.y - startY) * t - Math.sin(t * Math.PI) * arcH;
        bomb.setPosition(x, y);
        bomb.angle += 5; // slow rotation
      },
      onComplete: () => this.landBomb(bomb, targetCol, targetRow, e),
    });
  },
  landBomb(bomb, col, row, e) {
    bomb.destroy();
    // clear the warning indicators
    if (e.bombWarns) {
      e.bombWarns.forEach((w) => w.destroy());
      e.bombWarns = null;
    }
    // explosion sprite on the landing tile
    const c = tileCenter(col, row);
    this.playExplosion(c.x, c.y, 0.6);
    // damage: landing tile + orthogonal adjacent (plus-shape, no diagonals)
    const nc = this.naviPos.col, nr = this.naviPos.row;
    const manhattan = Math.abs(nc - col) + Math.abs(nr - row);
    if (manhattan <= 1) {
      this.damageNavi(BOMB_SPIDER.bombDamage);
      this.flash(this.navi, 0xff6f00);
    }
    // reload: bomb readied immediately on explosion
    if (e.alive) {
      e.hasBomb = true;
      this.positionBombBack(e);
      e.bombBack.setVisible(true);
    }
  }
};
