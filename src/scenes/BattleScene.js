import Phaser from 'phaser';
import { COLS, ROWS, project, tileCorners, tileFeet, tileCenter, isPlayerTile, gridParams, setGridParams, getGridParams } from '../systems/grid.js';
import { CHIPS, BOSS } from '../systems/chips.js';
import { RUTABAGA_MANDRAKE } from '../systems/viruses.js';
import { fitFactor } from '../systems/spriteFit.js';
import { createDebugOverlay } from '../systems/debugOverlay.js';

// BattleScene — written during the jam 72h window (2026-10-09).
// MMBN-style grid battle: Bugchan (navi) vs PUMPKIN.EXE + RUTABAGA.MND.

const M = RUTABAGA_MANDRAKE;

// Manual artistic scales on top of the auto-fit + perspective scale.
const NAVI_MANUAL = 1;
const BOSS_MANUAL = 1;
const MANDRAKE_MANUAL = 0.55;

// ---- glassy tile palette (matches battle-mockup.png) ----
const PINK = { r: 214, g: 60, b: 130 };  // player side
const CYAN = { r: 40, g: 170, b: 210 };  // enemy side
const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };
const hex = (c) => (c.r << 16) | (c.g << 8) | c.b;
const mixc = (a, b, t) => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});
const lerpPt = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  preload() {
    this.load.image('tile-player', 'assets/tiles/tile-player.png');
    this.load.image('tile-enemy', 'assets/tiles/tile-enemy.png');
    this.load.spritesheet('bugchan', 'assets/sprites/bugchan-idle-strip.png', { frameWidth: 112, frameHeight: 224 });
    this.load.image('boss', 'assets/sprites/boss-pumpkin.png');
    this.load.image('mandrake', 'assets/sprites/virus-rutabaga-mandrake.png');
    this.load.image('bg', 'assets/tiles/bg-cyberspace.png');
    this.load.image('chip-cannon', 'assets/ui/chip-cannon.png');
    this.load.image('chip-sword', 'assets/ui/chip-sword.png');
    this.load.image('chip-spread', 'assets/ui/chip-spread.png');
    this.load.image('chip-recover', 'assets/ui/chip-recover.png');
  }

  create() {
    this.over = false;

    // ---- state ----
    this.naviHp = 100; this.naviMaxHp = 100;
    this.naviPos = { col: 1, row: 1 };
    this.bossHp = BOSS.maxHp;
    this.bossPos = { col: 4, row: 1 };
    this.chipCooldowns = {};
    this.projectiles = this.physics.add.group();

    // mandrake state machine
    this.mandrake = {
      hp: M.maxHp, alive: true,
      state: 'burrowed', // burrowed | telegraph | emerged
      timer: 0,
      pos: { col: 3, row: 2 },
      gagged: false,
    };

    // ---- presentation ----
    this.add.image(480, 270, 'bg').setDisplaySize(960, 540).setDepth(-10);
    this.drawGrid();
    this.drawHud();

    // player idle animation (8-frame strip)
    this.anims.create({
      key: 'bugchan-idle',
      frames: this.anims.generateFrameNumbers('bugchan', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });

    const p = tileFeet(this.naviPos.col, this.naviPos.row);
    this.navi = this.physics.add.sprite(p.x, p.y, 'bugchan');
    this.navi.play('bugchan-idle');
    this.navi.setOrigin(0.5, 1); // feet at the tile: she stands ON it
    this.placeFighter(this.navi, this.naviPos.col, this.naviPos.row, NAVI_MANUAL);

    const bp = tileFeet(this.bossPos.col, this.bossPos.row);
    this.boss = this.physics.add.sprite(bp.x, bp.y, 'boss');
    this.boss.setOrigin(0.5, 1); // viruses stand on their tiles too
    this.placeFighter(this.boss, this.bossPos.col, this.bossPos.row, BOSS_MANUAL);

    // mandrake: dirt mound (burrowed) + hidden sprite
    const mp = tileFeet(this.mandrake.pos.col, this.mandrake.pos.row);
    this.mound = this.add.ellipse(mp.x, mp.y - 8, 70, 26, 0x5d3a1a);
    this.mound.setScale(mp.s).setDepth(9 + this.mandrake.pos.row);
    this.mandrakeSprite = this.physics.add.sprite(mp.x, mp.y, 'mandrake').setVisible(false);
    this.mandrakeSprite.setOrigin(0.5, 1);
    this.placeFighter(this.mandrakeSprite, this.mandrake.pos.col, this.mandrake.pos.row, MANDRAKE_MANUAL);
    this.mandrake.timer = this.time.now + M.burrowedMs;

    // ---- debug overlay (TEMPORARY): live perspective tuning ----
    this.debugOverlay = createDebugOverlay({
      getValues: getGridParams,
      onChange: (key, value) => {
        setGridParams({ [key]: value });
        this.redrawGrid();
      },
    });
    document.getElementById('game').appendChild(this.debugOverlay.el);
    this.debugVisible = true;
    this.input.keyboard.on('keydown-D', () => {
      this.debugVisible = !this.debugVisible;
      this.debugOverlay.setVisible(this.debugVisible);
      if (this.debugVisible) this.debugOverlay.refresh();
    });

    // ---- input ----
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('ONE,TWO,THREE,FOUR');

    // ---- collisions ----
    this.physics.add.overlap(this.projectiles, this.boss, (boss, proj) => {
      this.damageBoss(proj.getData('damage'));
      proj.destroy();
    });
    this.physics.add.overlap(this.projectiles, this.mandrakeSprite, (spr, proj) => {
      if (this.mandrake.alive && this.mandrake.state === 'emerged') {
        this.damageMandrake(proj.getData('damage'));
      }
      proj.destroy();
    });

    // boss AI timers
    this.nextBossMove = this.time.now + 1400;
    this.nextBossAttack = this.time.now + 2200;

    this.add.text(480, 20, `${BOSS.name}  HP: ${this.bossHp}/${BOSS.maxHp}`, {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffb74d',
    }).setOrigin(0.5).setName('bossHpText');
  }

  // ================= grid + HUD =================

  // Position a fighter on a tile: feet at the tile's front edge (origin
  // 0.5, 1), scale follows the perspective depth, depth sorted by row.
  placeFighter(sprite, c, r, manual = 1) {
    const p = tileFeet(c, r);
    sprite.setPosition(p.x, p.y);
    sprite.setScale(fitFactor(sprite) * manual * p.s);
    sprite.setDepth(10 + r);
  }

  // Translucent perspective highlight over a tile (telegraphs, sword arc).
  highlightTile(c, r, color, alpha = 0.4) {
    const g = this.add.graphics().setDepth(30);
    const [tl, tr, br, bl] = tileCorners(c, r);
    g.fillStyle(color, alpha);
    g.fillPoints([tl, tr, br, bl], true);
    g.lineStyle(3, color, 1);
    g.strokePoints([tl, tr, br, bl, tl].map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
    return g;
  }

  drawGrid() {
    const g = this.add.graphics().setDepth(-5);
    this.gridGraphics = g;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.drawGlassTile(g, c, r);
      }
    }
  }

  // Destroy and rebuild the grid from the current params, then re-seat
  // every fighter on its tile. Used by the debug overlay while tuning.
  redrawGrid() {
    if (this.gridGraphics) this.gridGraphics.destroy();
    this.drawGrid();
    this.placeFighter(this.navi, this.naviPos.col, this.naviPos.row, NAVI_MANUAL);
    this.placeFighter(this.boss, this.bossPos.col, this.bossPos.row, BOSS_MANUAL);
    if (this.mandrakeSprite.visible) {
      this.placeFighter(this.mandrakeSprite, this.mandrake.pos.col, this.mandrake.pos.row, MANDRAKE_MANUAL);
    }
    const mp = tileFeet(this.mandrake.pos.col, this.mandrake.pos.row);
    this.mound.setPosition(mp.x, mp.y - 8).setScale(mp.s).setDepth(9 + this.mandrake.pos.row);
  }

  // One glassy tile slab, matching battle-mockup.png: vertical glass
  // gradient, corner-to-corner diagonal shine, bright readable edge, and
  // a dark extruded slab edge on the camera side so tiles aren't flat.
  drawGlassTile(g, c, r) {
    const base = isPlayerTile(c) ? PINK : CYAN;
    const [tl, tr, br, bl] = tileCorners(c, r);
    const s = tl.s;

    // slab thickness: extrude the camera-side edge downward
    const th = gridParams.thickness * s;
    g.fillStyle(hex(mixc(base, BLACK, 0.55)));
    g.fillPoints([bl, br, { x: br.x, y: br.y + th }, { x: bl.x, y: bl.y + th }], true);

    // glassy vertical gradient, drawn as strips so it follows the perspective
    const N = 14;
    const topC = mixc(base, WHITE, 0.42);
    const botC = mixc(base, BLACK, 0.38);
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      g.fillStyle(hex(mixc(topC, botC, (t0 + t1) / 2)));
      g.fillPoints(
        [lerpPt(tl, bl, t0), lerpPt(tr, br, t0), lerpPt(tr, br, t1), lerpPt(tl, bl, t1)],
        true,
      );
    }

    // diagonal shine, corner to corner
    g.fillStyle(hex(mixc(topC, WHITE, 0.35)), 0.5);
    g.fillPoints(
      [lerpPt(tl, tr, 0.02), lerpPt(tl, tr, 0.32), lerpPt(bl, br, 0.98), lerpPt(bl, br, 0.68)],
      true,
    );

    // crisp readable edge
    g.lineStyle(2, hex(mixc(base, WHITE, 0.55)), 1);
    g.strokePoints([tl, tr, br, bl, tl].map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
  }

  drawHud() {
    this.add.rectangle(120, 500, 220, 18, 0x101828).setOrigin(0, 0.5);
    this.hpBar = this.add.rectangle(122, 500, 216, 14, 0x4fc3f7).setOrigin(0, 0.5);
    this.add.text(20, 490, 'NAVI', { fontFamily: 'monospace', fontSize: '16px', color: '#e8f6ff' });

    this.chipIcons = [];
    CHIPS.forEach((chip, i) => {
      const x = 420 + i * 70;
      const icon = this.add.image(x, 500, `chip-${chip.id}`).setDisplaySize(48, 48);
      const label = this.add.text(x, 530, `${i + 1}`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#9fb3c8',
      }).setOrigin(0.5);
      this.chipIcons.push({ chip, icon, label });
    });

    this.add.text(760, 490, 'Arrows: move   1-4: chips', {
      fontFamily: 'monospace', fontSize: '14px', color: '#9fb3c8',
    });
  }

  // ================= main loop =================

  update(time) {
    if (this.over) return;
    this.handleMovement(time);
    this.handleChips(time);
    this.bossAI(time);
    this.mandrakeAI(time);
    this.updateHud(time);
    this.checkEnd();
  }

  // ================= navi =================

  handleMovement(time) {
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
      this.placeFighter(this.navi, nc, nr, NAVI_MANUAL);
      this._lastMove = time;
    }
  }

  handleChips(time) {
    const keyMap = [this.keys.ONE, this.keys.TWO, this.keys.THREE, this.keys.FOUR];
    keyMap.forEach((key, i) => {
      if (Phaser.Input.Keyboard.JustDown(key)) this.fireChip(CHIPS[i], time);
    });
  }

  chipReady(chip, time) {
    const last = this.chipCooldowns[chip.id];
    if (last === undefined) return true; // ready immediately at battle start
    return time - last >= chip.cooldownMs;
  }

  fireChip(chip, time) {
    if (!this.chipReady(chip, time)) return;
    this.chipCooldowns[chip.id] = time;
    const feet = tileFeet(this.naviPos.col, this.naviPos.row);

    if (chip.id === 'recover') {
      this.naviHp = Math.min(this.naviMaxHp, this.naviHp + 60);
      this.flash(this.navi, 0x81c784);
      return;
    }

    if (chip.id === 'sword') {
      const target = { col: this.naviPos.col + 1, row: this.naviPos.row };
      let hit = false;
      if (target.col === this.bossPos.col && target.row === this.bossPos.row && this.bossHp > 0) {
        this.damageBoss(chip.damage); hit = true;
      }
      const md = this.mandrake;
      if (md.alive && md.state === 'emerged' && target.col === md.pos.col && target.row === md.pos.row) {
        this.damageMandrake(chip.damage); hit = true;
      }
      if (hit) this.flash(this.boss, chip.color);
      // sword arc flash on the target tile
      const arc = this.highlightTile(target.col, target.row, chip.color, 0.35);
      this.time.delayedCall(140, () => arc.destroy());
      return;
    }

    const rows = chip.id === 'spread'
      ? [this.naviPos.row - 1, this.naviPos.row, this.naviPos.row + 1].filter((r) => r >= 0 && r < ROWS)
      : [this.naviPos.row];
    rows.forEach((r) => {
      const proj = this.add.circle(feet.x + 30, tileCenter(0, r).y, 10, chip.color);
      proj.setDepth(20);
      this.physics.add.existing(proj);
      proj.setData('damage', chip.damage);
      this.projectiles.add(proj);
      // NB: velocity must be set AFTER group.add — adding to a physics
      // group zeroes the body's velocity.
      proj.body.setVelocityX(520);
    });
  }

  // ================= boss AI =================

  bossPhase() {
    const frac = this.bossHp / BOSS.maxHp;
    if (frac < 0.3) return BOSS.phases[2]; // Harvest
    if (frac < 0.6) return BOSS.phases[1];  // Vine
    return BOSS.phases[0];                  // Sprout
  }

  bossAI(time) {
    if (this.bossHp <= 0) return;
    const phase = this.bossPhase();

    // wander enemy columns
    if (time >= this.nextBossMove) {
      this.nextBossMove = time + phase.moveIntervalMs;
      const nc = Phaser.Math.Between(3, 5);
      const nr = Phaser.Math.Between(0, ROWS - 1);
      this.bossPos = { col: nc, row: nr };
      this.placeFighter(this.boss, nc, nr, BOSS_MANUAL);
    }

    // telegraphed tile slam on the navi's tile
    if (time >= this.nextBossAttack) {
      this.nextBossAttack = time + phase.attackIntervalMs;
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
        boom.setDepth(25);
        this.tweens.add({ targets: boom, alpha: 0, scale: 1.6, duration: 250,
          onComplete: () => boom.destroy() });
      });
    }
  }

  // ================= mandrake AI =================

  mandrakeAI(time) {
    const md = this.mandrake;
    if (!md.alive || time < md.timer) return;

    if (md.state === 'burrowed') {
      // start telegraph: flash its tile
      md.state = 'telegraph';
      md.timer = time + M.telegraphMs;
      md.warnRect = this.highlightTile(md.pos.col, md.pos.row, 0xba68c8, 0.45);
      this.tweens.add({ targets: md.warnRect, alpha: 0.1, duration: 120, yoyo: 5 });
    } else if (md.state === 'telegraph') {
      // EMERGE
      if (md.warnRect) { md.warnRect.destroy(); md.warnRect = null; }
      md.state = 'emerged';
      md.timer = time + M.emergedMs;
      this.mound.setVisible(false);
      this.mandrakeSprite.setVisible(true);
      this.placeFighter(this.mandrakeSprite, md.pos.col, md.pos.row, MANDRAKE_MANUAL);
      const targetScale = this.mandrakeSprite.scaleX;
      this.mandrakeSprite.setScale(targetScale * 0.18);
      this.tweens.add({ targets: this.mandrakeSprite, scaleX: targetScale, scaleY: targetScale, duration: 180, ease: 'Back.easeOut' });
      if (!md.gagged) {
        md.gagged = true;
        this.bugchanSay(M.gag);
      }
    } else if (md.state === 'emerged') {
      // SCREAM — row-wide noise attack
      md.state = 'burrowed';
      md.timer = time + M.burrowedMs;
      const rowC = tileCenter(md.pos.col, md.pos.row);
      // scream wave visual across the row, following the perspective
      const left = project(0, md.pos.row + 0.5);
      const right = project(6, md.pos.row + 0.5);
      const wave = this.add.rectangle((left.x + right.x) / 2, rowC.y, right.x - left.x, 40, 0xba68c8, 0.35);
      wave.setDepth(25);
      this.tweens.add({ targets: wave, alpha: 0, x: left.x - 40, duration: 350,
        onComplete: () => wave.destroy() });
      this.add.text(rowC.x, rowC.y - 70, 'KYAAAH!!', {
        fontFamily: 'monospace', fontSize: '22px', color: '#ba68c8',
      }).setOrigin(0.5).setName('screamText');
      this.time.delayedCall(600, () => {
        const t = this.children.getByName('screamText');
        if (t) t.destroy();
      });
      if (this.naviPos.row === md.pos.row) {
        this.damageNavi(M.screamDamage);
      }
      // burrow at a new random enemy tile
      this.mandrakeSprite.setVisible(false);
      md.pos = { col: Phaser.Math.Between(3, 5), row: Phaser.Math.Between(0, ROWS - 1) };
      const np = tileFeet(md.pos.col, md.pos.row);
      this.mound.setPosition(np.x, np.y - 8).setVisible(true);
      this.mound.setDepth(9 + md.pos.row).setScale(np.s);
    }
  }

  bugchanSay(text) {
    const s = this.add.text(480, 80, `Bugchan: "${text}"`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#f8bbd0',
      backgroundColor: '#101828', padding: { x: 10, y: 6 },
    }).setOrigin(0.5);
    this.time.delayedCall(2600, () => s.destroy());
  }

  // ================= damage =================

  flash(target, color) {
    target.setTintFill(color);
    this.time.delayedCall(120, () => { if (target.active) target.clearTint(); });
  }

  damageBoss(amount) {
    if (this.bossHp <= 0) return;
    this.bossHp = Math.max(0, this.bossHp - amount);
    this.flash(this.boss, 0xffffff);
    const t = this.children.getByName('bossHpText');
    if (t) t.setText(`${BOSS.name}  HP: ${this.bossHp}/${BOSS.maxHp}`);
    if (this.bossHp <= 0) {
      const s0 = this.boss.scaleX;
      this.tweens.add({ targets: this.boss, alpha: 0, scaleX: s0 * 1.2, scaleY: s0 * 1.2, duration: 400 });
    }
  }

  damageMandrake(amount) {
    const md = this.mandrake;
    if (!md.alive) return;
    md.hp = Math.max(0, md.hp - amount);
    this.flash(this.mandrakeSprite, 0xffffff);
    if (md.hp <= 0) {
      md.alive = false;
      if (md.warnRect) md.warnRect.destroy();
      const s0 = this.mandrakeSprite.scaleX;
      this.tweens.add({ targets: this.mandrakeSprite, alpha: 0, scaleX: s0 * 1.45, scaleY: s0 * 1.45, duration: 350,
        onComplete: () => this.mandrakeSprite.setVisible(false) });
    }
  }

  damageNavi(amount) {
    if (this.over) return;
    this.naviHp = Math.max(0, this.naviHp - amount);
    this.flash(this.navi, 0xff5252);
    this.cameras.main.shake(120, 0.008);
  }

  // ================= HUD + end =================

  updateHud(time) {
    const w = 216 * (this.naviHp / this.naviMaxHp);
    this.hpBar.setDisplaySize(Math.max(w, 0), 14);
    this.chipIcons.forEach(({ chip, icon }) => {
      icon.setAlpha(this.chipReady(chip, time) ? 1 : 0.35);
    });
  }

  checkEnd() {
    const bossDead = this.bossHp <= 0;
    const mandrakeDead = !this.mandrake.alive;
    if (this.naviHp <= 0 && !this.over) {
      this.over = true;
      this.add.text(480, 250, 'GAME OVER', {
        fontFamily: 'monospace', fontSize: '56px', color: '#ff5252',
      }).setOrigin(0.5);
      this.add.text(480, 320, 'press R to jack in again', {
        fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
      }).setOrigin(0.5);
      this.input.keyboard.once('keydown-R', () => this.scene.restart());
      return;
    }
    if (bossDead && mandrakeDead && !this.over) {
      this.over = true;
      this.add.text(480, 250, 'VIRUS DELETED', {
        fontFamily: 'monospace', fontSize: '56px', color: '#81c784',
      }).setOrigin(0.5);
      this.add.text(480, 320, 'PUMPKIN.EXE + RUTABAGA.MND busted!', {
        fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
      }).setOrigin(0.5);
      this.add.text(480, 360, 'thanks for playing! 🎃🥕', {
        fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
      }).setOrigin(0.5);
    }
  }
}
