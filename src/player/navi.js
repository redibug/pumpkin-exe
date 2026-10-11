// Navi (player) controls: movement, chip firing, projectiles.
// Mixed into BattleScene via Object.assign, so `this` is the scene.
import Phaser from 'phaser';
import { COLS, ROWS, tileCorners, tileFeet, tileCenter, isPlayerTile } from '../systems/grid.js';
import { CHIP_MAP } from '../data/chips.js';
import { sound } from '../systems/sound.js';

export const NAVI_MANUAL = 1;

export const NaviMethods = {
  handleMovement(time) {
    if (this.navi.getData('teleporting')) return;
    if (this._lastMove && time - this._lastMove < 160) return;
    const { col, row } = this.naviPos;
    let nc = col, nr = row;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) nc--;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) nc++;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) nr--;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) nr++;
    else return;

    nc = Phaser.Math.Clamp(nc, 0, 2);
    nr = Phaser.Math.Clamp(nr, 0, ROWS - 1);
    if (nc !== col || nr !== row) {
      this.naviPos = { col: nc, row: nr };
      this._lastMove = time;
      sound.step();
      this.teleportMove(this.navi, nc, nr, NAVI_MANUAL);
    }
  },
  handleChips(time) {
    // X: buster shoot (hitscan). Z/Space: use the front chip. 1-4: chips out of order.
    if (Phaser.Input.Keyboard.JustDown(this.shootKey)) this.fireShoot(time);
    // Rapid fire: keep firing while the key is held (started via JustDown below).
    // Uses the scene clock for timing to avoid stale `time` params.
    if (this.rapidFiring) {
      const { slot, key } = this.rapidFiring;
      if (!key.isDown || this.loadout[slot] !== 'rapid') {
        this.rapidFiring = null; // key released or chip gone
      } else if (this.time.now >= this.rapidNextShot) {
        this.fireRapidShot(slot);
      }
    }
    const frontDown = Phaser.Input.Keyboard.JustDown(this.chipFrontKey);
    const front2Down = Phaser.Input.Keyboard.JustDown(this.chipFrontKey2);
    if (frontDown || front2Down) {
      this.pressChipKey(0, frontDown ? this.chipFrontKey : this.chipFrontKey2);
    }
    const keyMap = [this.keys.ONE, this.keys.TWO, this.keys.THREE, this.keys.FOUR];
    keyMap.forEach((key, i) => {
      if (Phaser.Input.Keyboard.JustDown(key)) this.pressChipKey(i, key);
    });
  },
  pressChipKey(i, key) {
    const chipId = this.loadout[i];
    if (!chipId) {
      if (i === 0) this.fireShoot(this.time.now); // out of chips: buster
      return;
    }
    if (chipId === 'rapid') {
      // don't restart if already firing this slot (e.g. pressing 1 while holding Z)
      if (this.rapidFiring && this.rapidFiring.slot === i) return;
      this.startRapidFire(i, key);
    } else {
      this.fireChipAt(i, this.time.now);
    }
  },
  startRapidFire(slot, key) {
    if (this.chipAmmo[slot] == null) {
      this.chipAmmo[slot] = CHIP_MAP.rapid.shots; // 10
    }
    this.rapidFiring = { slot, key };
    this.fireRapidShot(slot);
  },
  fireRapidShot(slot) {
    sound.buster();
    const chip = CHIP_MAP.rapid;
    // hitscan like the buster: instant beam, hits first enemy ahead on the row
    const row = this.naviPos.row;
    const s = this.navi.scaleX;
    const mx = this.navi.x + 45 * s, my = this.navi.y - 115 * s;
    this.showMuzzleFlash(mx, my, row);
    sound.buster();
    let target = null, targetCol = 99;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.type === 'rootabreak' && e.state === 'planted') continue;
      if (e.row === row && e.col > this.naviPos.col && e.col < targetCol) {
        target = e; targetCol = e.col;
      }
    }
    const endX = target ? tileCenter(targetCol, row).x : 930;
    const beam = this.add.line(0, 0, mx, my, endX, my, chip.color).setOrigin(0, 0);
    beam.setLineWidth(2).setAlpha(0.8);
    beam.setDepth(10 + row);
    this.tweens.add({ targets: beam, alpha: 0, duration: 90, onComplete: () => beam.destroy() });
    if (target) { this.damageEnemy(target, chip.damage); this.flash(target.sprite, chip.color); }

    this.chipAmmo[slot]--;
    this.rapidNextShot = this.time.now + (chip.fireIntervalMs ?? 130);

    if (this.chipAmmo[slot] <= 0) {
      // out of ammo: remove the chip, slide the rest left
      this.rapidFiring = null;
      this.removeChipFromLoadout(slot);
    } else {
      this.updateLoadoutHud();
    }
  },
  removeChipFromLoadout(i) {
    this.loadout.splice(i, 1);
    this.chipAmmo.splice(i, 1);
    this.chipAmmo.push(null); // keep length 4
    // fix rapidFiring slot if it was after the removed chip
    if (this.rapidFiring && this.rapidFiring.slot > i) {
      this.rapidFiring.slot--;
    }
    this.updateLoadoutHud();
    this.chipIcons.forEach(({ frame, icon, ammo }, s) => {
      this.tweens.killTweensOf([frame, icon, ammo]);
      const targetX = 420 + s * 70;
      if (s >= i && this.loadout[s]) {
        frame.x = targetX + 70; icon.x = targetX + 70; ammo.x = targetX + 70 + 16;
        this.tweens.add({ targets: [frame, icon], x: targetX, duration: 160, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: ammo, x: targetX + 16, duration: 160, ease: 'Quad.easeOut' });
      } else {
        frame.x = targetX; icon.x = targetX; ammo.x = targetX + 16;
      }
    });
  },
  fireChipAt(i, time) {
    const chipId = this.loadout[i];
    if (!chipId) return;
    this.fireChip(CHIP_MAP[chipId], time);
    this.removeChipFromLoadout(i);
  },
  fireShoot(time) {
    if (time < this.shootReadyAt) return;
    this.shootReadyAt = time + 150;
    this.showPunchFrame();
    const row = this.naviPos.row;
    const s = this.navi.scaleX;
    const mx = this.navi.x + 45 * s, my = this.navi.y - 115 * s;
    this.showMuzzleFlash(mx, my, row);
    sound.buster();
    // first alive enemy ahead on the navi's row (any type)
    let target = null, targetCol = 99;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.type === 'rootabreak' && e.state === 'planted') continue;
      if (e.row === row && e.col > this.naviPos.col && e.col < targetCol) {
        target = e; targetCol = e.col;
      }
    }
    const endX = target ? tileCenter(targetCol, row).x : 930;
    // NB: Line geometry renders minus the display origin, so setOrigin(0, 0)
    // or the beam centers on the wrong point.
    const beam = this.add.line(0, 0, mx, my, endX, my, 0xfff176).setOrigin(0, 0);
    beam.setLineWidth(3).setAlpha(0.9);
    beam.setDepth(10 + row); // row-ordered like the other battle effects
    this.tweens.add({ targets: beam, alpha: 0, duration: 110, onComplete: () => beam.destroy() });
    if (target) { this.damageEnemy(target, 5); this.flash(target.sprite, 0xfff176); }
  },
  showPunchFrame() {
    if (this._punchT) return;
    const hasPunch = this.textures.exists('bugchan-punch');
    if (hasPunch) {
      this.navi.anims.pause();
      this.navi.setTexture('bugchan-punch');
    } else {
      this.tweens.add({ targets: this.navi, x: this.navi.x + 8, duration: 60, yoyo: true });
    }
    this._punchT = this.time.delayedCall(130, () => {
      this._punchT = null;
      if (hasPunch) {
        this.navi.setTexture('bugchan');
        this.navi.play('bugchan-idle');
      }
    });
  },
  showMuzzleFlash(x, y, row) {
    const g = this.add.graphics().setDepth(10 + row); // row-ordered
    const pts = [];
    for (let k = 0; k < 16; k++) {
      const r = k % 2 === 0 ? 26 : 10;
      const a = (k / 16) * Math.PI * 2;
      pts.push(new Phaser.Geom.Point(Math.cos(a) * r, Math.sin(a) * r));
    }
    g.fillStyle(0xfff176, 1);
    g.fillPoints(pts, true);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, 8);
    g.setPosition(x, y);
    this.tweens.add({ targets: g, alpha: 0, scale: 1.6, duration: 90, onComplete: () => g.destroy() });
  },
  fireChip(chip, time) {
    const feet = tileFeet(this.naviPos.col, this.naviPos.row);

    if (chip.id === 'recover') {
      sound.recover();
      this.naviHp = Math.min(this.naviMaxHp, this.naviHp + 60);
      this.flash(this.navi, 0x81c784);
      return;
    }

    if (chip.id === 'sword') {
      sound.sword();
      const target = { col: this.naviPos.col + 1, row: this.naviPos.row };
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.type === 'rootabreak' && e.state === 'planted') continue;
        if (target.col === e.col && target.row === e.row) {
          this.damageEnemy(e, chip.damage);
        }
      }
      // sword arc flash on the target tile
      const arc = this.highlightTile(target.col, target.row, chip.color, 0.35);
      this.time.delayedCall(140, () => arc.destroy());
      return;
    }

    if (chip.id === 'bomb') {
      sound.bombThrow();
      // Lob a bomb 3 tiles ahead; explodes in a plus shape (like the spider's)
      const targetCol = Math.min(COLS - 1, this.naviPos.col + 3);
      const targetRow = this.naviPos.row;
      // red warning telegraphs on the affected tiles
      const warns = [];
      const tiles = [[targetCol, targetRow],
        [targetCol - 1, targetRow], [targetCol + 1, targetRow],
        [targetCol, targetRow - 1], [targetCol, targetRow + 1]];
      for (const [c, r] of tiles) {
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
          warns.push(this.highlightTile(c, r, 0xff3b30, 0.35));
        }
      }
      const startX = feet.x + 30, startY = feet.y - 90;
      const end = tileFeet(targetCol, targetRow);
      const bomb = this.add.sprite(startX, startY, 'bug-bomb');
      bomb.play('bug-bomb-fuse');
      bomb.setScale(this.navi.scaleX * 0.9);
      bomb.setDepth(20);
      const proxy = { t: 0 };
      const arcH = 190;
      this.tweens.add({
        targets: proxy, t: 1, duration: 1050, ease: 'Linear',
        onUpdate: () => {
          const t = proxy.t;
          const x = startX + (end.x - startX) * t;
          const y = startY + (end.y - startY) * t - Math.sin(t * Math.PI) * arcH;
          bomb.setPosition(x, y);
          bomb.angle += 5;
        },
        onComplete: () => {
          bomb.destroy();
          warns.forEach((w) => w.destroy());
          // explosion sprite
          const c = tileCenter(targetCol, targetRow);
          this.playExplosion(c.x, c.y, 0.6);
          sound.explosion();
          // damage enemies on the landing tile + orthogonal adjacent
          for (const e of this.enemies) {
            if (!e.alive) continue;
            if (e.type === 'rootabreak' && e.state === 'planted') continue;
            const manhattan = Math.abs(e.col - targetCol) + Math.abs(e.row - targetRow);
            if (manhattan <= 1) {
              this.damageEnemy(e, chip.damage);
              this.flash(e.sprite, chip.color);
            }
          }
        },
      });
      return;
    }

    if (chip.id === 'railgun') {
      sound.railgun();
      // Instant hitscan that pierces: hits ALL enemies on the navi's row.
      const row = this.naviPos.row;
      const s = this.navi.scaleX;
      const mx = this.navi.x + 45 * s, my = this.navi.y - 115 * s;
      // beam across the full row
      const beam = this.add.line(0, 0, mx, my, 930, my, 0x00e5ff).setOrigin(0, 0);
      beam.setLineWidth(5).setAlpha(0.95);
      beam.setDepth(10 + row);
      this.tweens.add({ targets: beam, alpha: 0, duration: 140, onComplete: () => beam.destroy() });
      // damage every hittable enemy ahead on the row (pierce, no early stop)
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.type === 'rootabreak' && e.state === 'planted') continue;
        if (e.row === row && e.col > this.naviPos.col) {
          this.damageEnemy(e, chip.damage);
          this.flash(e.sprite, chip.color);
        }
      }
      return;
    }

    if (chip.id === 'cannon') sound.cannon();
    else if (chip.id === 'spread') sound.spread();
    else if (chip.id === 'rapid') sound.buster();
    const rows = chip.id === 'spread'
      ? [this.naviPos.row - 1, this.naviPos.row, this.naviPos.row + 1].filter((r) => r >= 0 && r < ROWS)
      : [this.naviPos.row];
    rows.forEach((r) => {
      // Spread: the center bullet fires from in front; the side bullets
      // come from Bugchan's side (her x) on the rows above/below.
      const startX = (chip.id === 'spread' && r !== this.naviPos.row) ? feet.x : feet.x + 30;
      const proj = this.add.circle(startX, tileCenter(0, r).y, 10, chip.color);
      proj.setDepth(10 + r); // row-ordered like other effects
      proj.setData('damage', chip.damage);
      proj.setData('row', r);
      proj.setData('vx', 520);
      this.projectiles.add(proj);
    });
  },
  projOverlapsTile(proj, col, row) {
    if (proj.getData('row') !== row) return false;
    const corners = tileCorners(col, row);
    const xs = corners.map((p) => p.x);
    const leftX = Math.min(...xs), rightX = Math.max(...xs);
    const px = proj.x, rad = 10;
    return px + rad >= leftX && px - rad <= rightX;
  },
  updateProjectiles(delta) {
    const dt = delta / 1000;
    for (const proj of [...this.projectiles.getChildren()]) {
      if (!proj.active) continue;
      proj.x += proj.getData('vx') * dt;
      if (proj.x > 1020) { proj.destroy(); continue; }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.type === 'rootabreak' && e.state === 'planted') continue;
        if (this.projOverlapsTile(proj, e.col, e.row)) {
          this.damageEnemy(e, proj.getData('damage'));
          proj.destroy();
          break;
        }
      }
    }
  }
};
