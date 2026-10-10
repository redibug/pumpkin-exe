import Phaser from 'phaser';
import { COLS, ROWS, project, tileCorners, tileFeet, tileCenter, isPlayerTile, gridParams, setGridParams, getGridParams, hexToRgb } from '../systems/grid.js';
import { CHIP_MAP, DECK, BOSS } from '../systems/chips.js';
import { RUTABAGA_MANDRAKE } from '../systems/viruses.js';
import { fitFactor } from '../systems/spriteFit.js';
import { createDebugOverlay } from '../systems/debugOverlay.js';
import { DialogueUI, SCRIPTS } from '../systems/dialogue.js';

// BattleScene — written during the jam 72h window (2026-10-09).
// MMBN-style grid battle: Bugchan (navi) vs PUMPKIN.EXE + RUTABAGA.MND.

const M = RUTABAGA_MANDRAKE;

// Manual artistic scales on top of the auto-fit + perspective scale.
const NAVI_MANUAL = 1;
const BOSS_MANUAL = 0.5;
const MANDRAKE_MANUAL = 0.25;

// ---- custom screen / deck ----
const CUSTOM_GAUGE_MS = 10000; // battle time to fill the custom gauge
const HAND_MAX = 5;            // cards drawn per custom screen
const LOADOUT_MAX = 4;         // selected cards -> the 1-4 chip slots

// ---- glassy tile palette (base colors live in grid-config.json) ----
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
    this.load.image('boss', 'assets/sprites/boss-v4-cloak.png');
    this.load.image('mandrake', 'assets/sprites/virus-rutabaga-mandrake.png');
    this.load.image('bg', 'assets/tiles/bg-cyberspace.png');
    this.load.image('chip-cannon', 'assets/ui/chip-cannon.png');
    this.load.image('chip-sword', 'assets/ui/chip-sword.png');
    this.load.image('chip-spread', 'assets/ui/chip-spread.png');
    this.load.image('chip-recover', 'assets/ui/chip-recover.png');
    this.load.image('mug-bugchan', 'assets/mugshots/mug-bugchan.png');
    this.load.image('mug-pumpkin', 'assets/mugshots/mug-pumpkin.png');
    this.load.image('mug-mandrake', 'assets/mugshots/mug-mandrake.png');
  }

  create() {
    this.over = false;
    this.time.paused = false; // insurance: never boot a restart mid-pause

    // ---- state ----
    this.naviHp = 100; this.naviMaxHp = 100;
    this.naviPos = { col: 1, row: 1 };
    this.bossHp = BOSS.maxHp;
    this.bossPos = { col: 4, row: 1 };
    this.projectiles = this.physics.add.group();
    this.shootReadyAt = 0; // buster hitscan fire rate gate

    // ---- custom screen / deck state ----
    this.deck = Phaser.Utils.Array.Shuffle([...DECK]);
    this.discardPile = [];
    this.hand = [];
    this.loadout = [null, null, null, null]; // chip ids loaded into slots 1-4
    this.customTimer = 0;
    this.customOpen = false;
    this._skipChips = 0; // frames to skip chip input after the custom screen closes

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
    // NB: mandrake.timer + boss AI timers are armed when the intro
    // dialogue finishes, so the battle doesn't run during the cutscene.

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
    this.customKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.shootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X); // buster
    this.chipFrontKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z); // front chip
    this.chipFrontKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE); // front chip
    this.input.mouse.disableContextMenu(); // right-click discards in the custom screen

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

    // ---- dialogue ----
    this.dialogue = new DialogueUI(this);

    this.add.text(480, 20, `${BOSS.name}  HP: ${this.bossHp}/${BOSS.maxHp}`, {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffb74d',
    }).setOrigin(0.5).setName('bossHpText');

    // battle intro; the custom screen opens first, then the fight starts
    this.startDialogue(SCRIPTS.intro, () => {
      this.nextBossMove = this.time.now + 1400;
      this.nextBossAttack = this.time.now + 2200;
      this.mandrake.timer = this.time.now + M.burrowedMs;
      this.openCustom(); // MMBN-style: every battle starts at the custom screen
    });
  }

  // ================= dialogue + pause =================

  // Freeze the whole game while a script plays: physics, tweens, timers,
  // animations. update() routes to the dialogue instead of game logic.
  //
  // NB: Phaser's Clock keeps advancing .now even when paused (it assigns
  // this.now before the paused check), so AI timers set from it would all
  // expire during a long dialogue. We measure the pause and shift every
  // pending timer forward on resume, so the pause costs zero game time.
  //
  // Looping ambient motion (idle animations, infinite tweens) keeps playing
  // so the scene stays alive; anything finite or gameplay-coupled pauses.
  setPaused(paused) {
    if (paused) {
      this.pauseStart = this.time.now;
      this.physics.world.pause();
      this.time.paused = true;
      this._pausedAnims = [];
      for (const child of this.children.list) {
        const a = child.anims;
        if (a && a.isPlaying && a.currentAnim && a.currentAnim.repeat !== -1) {
          a.pause();
          this._pausedAnims.push(a);
        }
      }
      this._pausedTweens = this.tweens.getTweens().filter((t) => !t.isInfinite && !t.isFinished());
      this._pausedTweens.forEach((t) => { t.paused = true; });
    } else {
      const pausedMs = this.time.now - (this.pauseStart || this.time.now);
      for (const key of ['nextBossMove', 'nextBossAttack']) {
        if (Number.isFinite(this[key])) this[key] += pausedMs;
      }
      if (Number.isFinite(this.mandrake.timer)) this.mandrake.timer += pausedMs;
      if (Number.isFinite(this._lastMove)) this._lastMove += pausedMs;
      if (Number.isFinite(this.shootReadyAt)) this.shootReadyAt += pausedMs;
      this.physics.world.resume();
      this.time.paused = false;
      (this._pausedAnims || []).forEach((a) => a.resume());
      (this._pausedTweens || []).forEach((t) => { t.paused = false; });
      this._pausedAnims = [];
      this._pausedTweens = [];
    }
  }

  startDialogue(script, onDone) {
    this.setPaused(true);
    this.dialogue.start(script, () => {
      this.setPaused(false);
      if (onDone) onDone();
    });
  }

  // ================= custom screen =================

  // MMBN-style custom: the gauge fills during battle, SHIFT opens this
  // screen (also auto-opens when the battle starts). Draw up to HAND_MAX
  // cards, pick up to LOADOUT_MAX for the 1-4 slots. Unpicked cards stay
  // in hand for next time; X marks a card for discard (red X, tossed on
  // confirm). Confirming spends the old loadout to the discard pile and
  // loads the new picks. OK is an on-screen button, navigable with the
  // arrows and clickable with the mouse (ESC still cancels).
  openCustom() {
    if (this.customOpen || this.over || this.dialogue.isActive()) return;
    this.customOpen = true;
    this.customTimer = 0;
    this.updateCustomGaugeHud();
    this.setPaused(true);
    this.drawToHand();
    this.customCursor = { row: 0, col: 0 }; // row 0 = cards, row 1 = buttons
    this.customSelected = []; // hand indices, in selection order
    this.customDiscard = []; // hand indices marked for discard (red X)
    this.buildCustomUI();
    // Swallow the input that opened the screen: the opening click is still
    // being dispatched when the cards are created, so it would pass through
    // and "click" a card. Arm on pointer-up (or immediately if no pointer
    // is down, i.e. opened via keyboard).
    this.customArmed = !this.input.activePointer.isDown;
    this._customArmHandler = () => { this.customArmed = true; };
    this.input.once('pointerup', this._customArmHandler);
    this._customKeyHandler = (event) => this.handleCustomKey(event);
    this.input.keyboard.on('keydown', this._customKeyHandler);
  }

  drawToHand() {
    while (this.hand.length < HAND_MAX) {
      if (this.deck.length === 0) {
        if (this.discardPile.length === 0) break;
        this.deck = Phaser.Utils.Array.Shuffle(this.discardPile);
        this.discardPile = [];
      }
      this.hand.push(this.deck.pop());
    }
  }

  handleCustomKey(event) {
    const cur = this.customCursor;
    const rowLen = [this.hand.length, 1]; // cards row, OK button row
    switch (event.code) {
      case 'ArrowLeft':
        cur.col = Math.max(0, cur.col - 1);
        break;
      case 'ArrowRight':
        cur.col = Math.min(rowLen[cur.row] - 1, cur.col + 1);
        break;
      case 'ArrowUp':
        if (cur.row === 1) { cur.row = 0; cur.col = Math.min(cur.col, this.hand.length - 1); }
        break;
      case 'ArrowDown':
        if (cur.row === 0) { cur.row = 1; cur.col = 0; }
        break;
      case 'KeyZ':
        this.activateCustomCursor();
        return;
      case 'KeyX':
        if (cur.row === 0) this.toggleCustomDiscard();
        break;
      case 'Escape':
        this.cancelCustom();
        return;
      default:
        return;
    }
    this.refreshCustom();
  }

  // Z: the generic "press" key — toggles a card, or pushes the OK button
  activateCustomCursor() {
    const cur = this.customCursor;
    if (cur.row === 0) {
      this.toggleCustomSelect();
      this.refreshCustom();
    } else {
      this.confirmCustom();
    }
  }

  toggleCustomSelect() {
    const i = this.customCursor.col;
    if (i < 0 || i >= this.hand.length) return;
    const at = this.customSelected.indexOf(i);
    if (at >= 0) {
      this.customSelected.splice(at, 1);
    } else {
      const m = this.customDiscard.indexOf(i); // selecting clears a discard mark
      if (m >= 0) this.customDiscard.splice(m, 1);
      if (this.customSelected.length < LOADOUT_MAX) this.customSelected.push(i);
    }
  }

  // X: mark a card for discard (red X) — toggles; marking clears selection
  toggleCustomDiscard() {
    const i = this.customCursor.col;
    if (i < 0 || i >= this.hand.length) return;
    const m = this.customDiscard.indexOf(i);
    if (m >= 0) {
      this.customDiscard.splice(m, 1);
    } else {
      const at = this.customSelected.indexOf(i);
      if (at >= 0) this.customSelected.splice(at, 1);
      this.customDiscard.push(i);
    }
  }

  confirmCustom() {
    if (this.customSelected.length === 0 && this.customDiscard.length === 0) {
      this.closeCustomUI(); // nothing picked or marked: keep loadout
      return;
    }
    const picked = this.customSelected.map((i) => this.hand[i]); // selection order
    const tossed = this.customDiscard.map((i) => this.hand[i]);
    // old loadout is spent, marked cards are tossed
    this.loadout.forEach((id) => { if (id) this.discardPile.push(id); });
    tossed.forEach((id) => this.discardPile.push(id));
    this.loadout = [null, null, null, null];
    picked.forEach((id, s) => { this.loadout[s] = id; });
    // picked + tossed cards leave the hand
    const gone = new Set([...this.customSelected, ...this.customDiscard]);
    [...gone].sort((a, b) => b - a).forEach((i) => this.hand.splice(i, 1));
    this.updateLoadoutHud();
    this.closeCustomUI();
  }

  cancelCustom() {
    this.closeCustomUI(); // gauge stays spent, loadout unchanged
  }

  closeCustomUI() {
    this.input.keyboard.off('keydown', this._customKeyHandler);
    this._customKeyHandler = null;
    this.input.off('pointerup', this._customArmHandler);
    if (this.customUI) { this.customUI.destroy(); this.customUI = null; }
    this.customOpen = false;
    // Swallow the key edge that closed the screen: it's still JustDown on
    // the next frame, which battle input would read as "use front chip".
    this._skipChips = 1;
    this.setPaused(false);
  }

  buildCustomUI() {
    const ui = this.add.container(0, 0).setDepth(200).setScrollFactor(0);
    this.customUI = ui;
    ui.add(this.add.rectangle(480, 270, 960, 540, 0x05070f, 0.88));
    ui.add(this.add.rectangle(480, 270, 810, 430, 0x0a1226, 1).setStrokeStyle(3, 0x00e5ff));
    ui.add(this.add.text(480, 92, 'CUSTOM SCREEN', {
      fontFamily: 'monospace', fontSize: '28px', color: '#00e5ff',
    }).setOrigin(0.5));
    this.customCountsText = this.add.text(480, 132, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#9fb3c8',
    }).setOrigin(0.5);
    ui.add(this.customCountsText);
    this.customCardLayer = this.add.container(0, 0);
    ui.add(this.customCardLayer);
    this.customButtonLayer = this.add.container(0, 0);
    ui.add(this.customButtonLayer);
    ui.add(this.add.text(480, 472, 'arrows: move · Z/click: select · X/right-click: discard · ESC: cancel', {
      fontFamily: 'monospace', fontSize: '14px', color: '#9fb3c8',
    }).setOrigin(0.5));
    this.refreshCustom();
  }

  refreshCustom() {
    this.refreshCustomCards();
    this.refreshCustomButtons();
  }

  refreshCustomButtons() {
    this.customButtonLayer.removeAll(true);
    const x = 480, y = 420;
    const isCursor = this.customCursor.row === 1;
    const bg = this.add.rectangle(x, y, 130, 44, 0x0d1526)
      .setStrokeStyle(2, isCursor ? 0xffffff : 0x00e5ff);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      this.customCursor = { row: 1, col: 0 };
      this.refreshCustom();
    });
    bg.on('pointerdown', () => {
      if (!this.customArmed) return; // ignore the click that opened the screen
      this.confirmCustom();
    });
    const label = this.add.text(x, y, 'OK', {
      fontFamily: 'monospace', fontSize: '18px',
      color: isCursor ? '#ffffff' : '#e8f6ff',
    }).setOrigin(0.5);
    this.customButtonLayer.add([bg, label]);
  }

  refreshCustomCards() {
    this.customCardLayer.removeAll(true);
    const n = this.hand.length;
    const cw = 130, ch = 170, gap = 14;
    const x0 = 480 - (n * cw + (n - 1) * gap) / 2 + cw / 2;
    this.hand.forEach((chipId, i) => {
      const chip = CHIP_MAP[chipId];
      const card = this.add.container(x0 + i * (cw + gap), 300);
      const selIdx = this.customSelected.indexOf(i);
      const marked = this.customDiscard.includes(i);
      const isCursor = this.customCursor.row === 0 && this.customCursor.col === i;
      const border = selIdx >= 0 ? 0x00e5ff : marked ? 0xff3b30 : isCursor ? 0xffffff : 0x334155;
      // hover halo: visible over any card state (selected/marked keep their border)
      if (isCursor) {
        card.add(this.add.rectangle(0, 0, cw + 12, ch + 12, 0xffffff, 0.15)
          .setStrokeStyle(2, 0xffffff));
      }
      const bg = this.add.rectangle(0, 0, cw, ch, 0x0d1526)
        .setStrokeStyle(selIdx >= 0 ? 4 : 2, border);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        this.customCursor = { row: 0, col: i };
        this.refreshCustom();
      });
      bg.on('pointerdown', (pointer) => {
        if (!this.customArmed) return; // ignore the click that opened the screen
        this.customCursor = { row: 0, col: i };
        if (pointer.rightButtonDown()) this.toggleCustomDiscard();
        else this.toggleCustomSelect();
        this.refreshCustom();
      });
      card.add(bg);
      card.add(this.add.image(0, -40, `chip-${chipId}`).setDisplaySize(56, 56));
      card.add(this.add.text(0, 12, chip.name, {
        fontFamily: 'monospace', fontSize: '16px', color: '#e8f6ff',
      }).setOrigin(0.5));
      card.add(this.add.text(0, 36, chip.desc, {
        fontFamily: 'monospace', fontSize: '10px', color: '#9fb3c8',
        wordWrap: { width: cw - 18 },
      }).setOrigin(0.5, 0));
      if (selIdx >= 0) {
        card.add(this.add.text(0, -ch / 2 - 16, `→ ${selIdx + 1}`, {
          fontFamily: 'monospace', fontSize: '18px', color: '#00e5ff',
        }).setOrigin(0.5));
      }
      if (marked) {
        // red highlight + red X: tossed to the discard pile on confirm
        // (Line geometry renders minus the display origin: setOrigin(0, 0))
        card.add(this.add.rectangle(0, 0, cw, ch, 0xff3b30, 0.16));
        const m = 36;
        card.add(this.add.line(0, 0, -m, -m, m, m, 0xff3b30).setOrigin(0, 0).setLineWidth(7));
        card.add(this.add.line(0, 0, m, -m, -m, m, 0xff3b30).setOrigin(0, 0).setLineWidth(7));
      }
      this.customCardLayer.add(card);
    });
    this.customCountsText.setText(
      `deck: ${this.deck.length}   discard: ${this.discardPile.length}` +
      `   selected: ${this.customSelected.length}/${LOADOUT_MAX}   marked: ${this.customDiscard.length}`,
    );
  }

  // ================= teleport =================

  // Vertical-slice teleport dissolve, recreated in-engine from Mel's
  // teleport-smear strip art: the sprite is sliced into vertical strips
  // that jitter vertically and get erased, more intense in later frames.
  // 3 frames out (dissolve), then 3 in reverse (materialize).
  // Movement input / AI is locked per-sprite while its teleport runs.
  teleportMove(sprite, col, row, manual, onDone) {
    if (sprite.getData('teleporting')) {
      this.placeFighter(sprite, col, row, manual); // fallback: instant pop
      if (onDone) onDone();
      return;
    }
    sprite.setData('teleporting', true);
    this.playTeleportFrames(sprite, 'out', () => {
      this.placeFighter(sprite, col, row, manual);
      this.playTeleportFrames(sprite, 'in', () => {
        sprite.setData('teleporting', false);
        if (onDone) onDone();
      });
    });
  }

  playTeleportFrames(sprite, direction, onDone) {
    const STRIPS = 40;
    const FRAME_MS = 6;
    const JITTER = [4, 10, 18];      // vertical jitter px, grows per frame
    const HIDE = [0.25, 0.5, 0.75];  // fraction of strips erased per frame

    const frame = sprite.frame;
    const fw = frame.width, fh = frame.height;
    const sw = fw / STRIPS;
    const scale = sprite.scaleX;
    const ox = sprite.x, oy = sprite.y;
    const key = sprite.texture.key;
    const frameName = frame.name;

    sprite.setVisible(false);

    // slice the current frame into vertical strips, aligned 1:1 over the sprite
    const objs = [];
    for (let i = 0; i < STRIPS; i++) {
      const img = this.add.image(ox, oy, key, frameName);
      img.setOrigin(0.5, 1).setScale(scale).setDepth(sprite.depth + 1);
      img.setCrop(i * sw, 0, sw, fh);
      objs.push(img);
    }

    // precompute the 3 frames: cumulative erase + growing jitter
    const frames = [];
    const hidden = new Set();
    for (let f = 0; f < 3; f++) {
      while (hidden.size < Math.floor(STRIPS * HIDE[f])) {
        hidden.add((Math.random() * STRIPS) | 0);
      }
      const st = [];
      for (let i = 0; i < STRIPS; i++) {
        st.push({ visible: !hidden.has(i), yOff: (Math.random() * 2 - 1) * JITTER[f] });
      }
      frames.push(st);
    }
    const order = direction === 'out' ? [0, 1, 2] : [2, 1, 0];

    let step = 0;
    const tick = () => {
      if (step < order.length) {
        const st = frames[order[step]];
        for (let i = 0; i < STRIPS; i++) {
          objs[i].setVisible(st[i].visible);
          objs[i].setY(oy + st[i].yOff);
        }
        step++;
        this.time.delayedCall(FRAME_MS, tick);
      } else {
        objs.forEach((o) => o.destroy());
        if (direction === 'in') sprite.setVisible(true);
        onDone();
      }
    };
    tick();
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
  // Floor-level: always below the characters.
  highlightTile(c, r, color, alpha = 0.4) {
    const g = this.add.graphics().setDepth(5);
    const [tl, tr, br, bl] = tileCorners(c, r);
    g.fillStyle(color, alpha);
    g.fillPoints([tl, tr, br, bl], true);
    g.lineStyle(3, color, 1);
    g.strokePoints([tl, tr, br, bl, tl].map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
    return g;
  }

  drawGrid() {
    const g = this.add.graphics().setDepth(-5);
    g.setBlendMode(Phaser.BlendModes[gridParams.blendMode] ?? Phaser.BlendModes.NORMAL);
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
    const base = hexToRgb(isPlayerTile(c) ? gridParams.pink : gridParams.cyan);
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

    // custom gauge under the HP bar
    this.add.text(20, 514, 'CUSTOM', { fontFamily: 'monospace', fontSize: '12px', color: '#9fb3c8' });
    this.add.rectangle(120, 522, 220, 10, 0x101828).setOrigin(0, 0.5);
    // NB: created at full width — setDisplaySize divides by the current
    // width, so a 0-width rect would scale to NaN and never render.
    this.customGaugeFill = this.add.rectangle(122, 522, 216, 6, 0x00e5ff).setOrigin(0, 0.5);
    this.customGaugeFill.setDisplaySize(0, 6);
    this.customReadyText = this.add.text(348, 514, 'SHIFT!', {
      fontFamily: 'monospace', fontSize: '14px', color: '#00e5ff',
    }).setVisible(false);

    // empty chip slot texture, drawn once
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x101828, 1);
    g.fillRoundedRect(0, 0, 48, 48, 8);
    g.lineStyle(2, 0x334155, 1);
    g.strokeRoundedRect(0, 0, 48, 48, 8);
    g.generateTexture('chip-empty', 48, 48);
    g.destroy();

    // 4 loadout slots (1-4): filled from the custom screen
    this.chipIcons = [];
    for (let i = 0; i < LOADOUT_MAX; i++) {
      const x = 420 + i * 70;
      const icon = this.add.image(x, 500, 'chip-empty').setDisplaySize(32, 32);
      const label = this.add.text(x, 530, `${i + 1}`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#9fb3c8',
      }).setOrigin(0.5);
      this.chipIcons.push({ icon, label });
    }
    this.updateLoadoutHud();

    this.add.text(700, 482, 'Arrows: move · SHIFT: custom', {
      fontFamily: 'monospace', fontSize: '12px', color: '#9fb3c8',
    });
    this.add.text(700, 502, 'X: shoot · Z/Space: chip · 1-4: chips', {
      fontFamily: 'monospace', fontSize: '12px', color: '#9fb3c8',
    });
  }

  // refresh the 4 slot icons from the current loadout
  updateLoadoutHud() {
    this.chipIcons.forEach(({ icon }, i) => {
      const id = this.loadout[i];
      // NB: setTexture keeps the old scale, so re-apply the display size
      // every time (chip art is 800x800, empty slot is 48x48).
      icon.setTexture(id ? `chip-${id}` : 'chip-empty').setDisplaySize(32, 32);
    });
  }

  updateCustomGaugeHud() {
    const frac = Math.min(this.customTimer / CUSTOM_GAUGE_MS, 1);
    this.customGaugeFill.setDisplaySize(216 * frac, 6);
    const full = frac >= 1;
    this.customReadyText.setVisible(full && !this.customOpen);
  }

  // ================= main loop =================

  update(time, delta) {
    // dialogue owns the frame while a script plays: the game is paused
    if (this.dialogue.isActive()) {
      this.dialogue.update(delta);
      return;
    }
    if (this.customOpen) return; // custom screen owns the frame (game paused)
    if (this.over) return;
    // custom gauge fills during battle; SHIFT opens the custom screen
    if (this.customTimer < CUSTOM_GAUGE_MS) {
      this.customTimer = Math.min(this.customTimer + delta, CUSTOM_GAUGE_MS);
      this.updateCustomGaugeHud();
    } else if (Phaser.Input.Keyboard.JustDown(this.customKey)) {
      this.openCustom();
    }
    this.handleMovement(time);
    // skip one frame of chip input after the custom screen closes, so the
    // key edge that confirmed it isn't re-read as "use front chip"
    if (this._skipChips > 0) this._skipChips--;
    else this.handleChips(time);
    this.bossAI(time);
    this.mandrakeAI(time);
    this.updateHud(time);
    this.checkEnd();
  }

  // ================= navi =================

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
      this.teleportMove(this.navi, nc, nr, NAVI_MANUAL);
    }
  }

  handleChips(time) {
    // X: buster shoot (hitscan). Z/Space: use the front chip. 1-4: chips out of order.
    if (Phaser.Input.Keyboard.JustDown(this.shootKey)) this.fireShoot(time);
    if (Phaser.Input.Keyboard.JustDown(this.chipFrontKey)
      || Phaser.Input.Keyboard.JustDown(this.chipFrontKey2)) this.fireChipAt(0, time);
    const keyMap = [this.keys.ONE, this.keys.TWO, this.keys.THREE, this.keys.FOUR];
    keyMap.forEach((key, i) => {
      if (Phaser.Input.Keyboard.JustDown(key)) this.fireChipAt(i, time);
    });
  }

  // Use the chip at loadout index i (single use): it disappears and the
  // chips to its right tween left to fill the hole.
  fireChipAt(i, time) {
    const chipId = this.loadout[i];
    if (!chipId) return;
    this.fireChip(CHIP_MAP[chipId], time);
    this.loadout.splice(i, 1);
    this.updateLoadoutHud();
    this.chipIcons.forEach(({ icon }, s) => {
      this.tweens.killTweensOf(icon);
      const targetX = 420 + s * 70;
      if (s >= i && this.loadout[s]) {
        icon.x = targetX + 70;
        this.tweens.add({ targets: icon, x: targetX, duration: 160, ease: 'Quad.easeOut' });
      } else {
        icon.x = targetX;
      }
    });
  }

  // Buster: instant hitscan down the navi's row — no projectile. Hits the
  // first enemy ahead; shows the punch frame + a muzzle flash.
  fireShoot(time) {
    if (time < this.shootReadyAt) return;
    this.shootReadyAt = time + 300;
    this.showPunchFrame();
    const s = this.navi.scaleX;
    const mx = this.navi.x + 45 * s, my = this.navi.y - 115 * s;
    this.showMuzzleFlash(mx, my);
    const row = this.naviPos.row;
    let target = null, targetCol = 99;
    if (this.bossHp > 0 && this.bossPos.row === row
      && this.bossPos.col > this.naviPos.col && this.bossPos.col < targetCol) {
      target = 'boss'; targetCol = this.bossPos.col;
    }
    const md = this.mandrake;
    if (md.alive && md.state === 'emerged' && md.pos.row === row
      && md.pos.col > this.naviPos.col && md.pos.col < targetCol) {
      target = 'mandrake'; targetCol = md.pos.col;
    }
    const endX = target ? tileCenter(targetCol, row).x : 930;
    // NB: Line geometry renders minus the display origin, so setOrigin(0, 0)
    // or the beam centers on the wrong point.
    const beam = this.add.line(0, 0, mx, my, endX, my, 0xfff176).setOrigin(0, 0);
    beam.setLineWidth(3).setAlpha(0.9);
    beam.setDepth(18);
    this.tweens.add({ targets: beam, alpha: 0, duration: 110, onComplete: () => beam.destroy() });
    if (target === 'boss') { this.damageBoss(10); this.flash(this.boss, 0xfff176); }
    else if (target === 'mandrake') { this.damageMandrake(10); this.flash(this.mandrakeSprite, 0xfff176); }
  }

  // Punch frame for the buster. Mel is drawing the real punch frame +
  // muzzle flash herself; until 'bugchan-punch' lands in sprites/, the
  // fallback is a quick lunge. (Wire the preload in preload() when it lands.)
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
  }

  // PLACEHOLDER for Mel's muzzle-flash overlay: procedural star flash.
  showMuzzleFlash(x, y) {
    const g = this.add.graphics().setDepth(21);
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
  }

  fireChip(chip, time) {
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
      this.teleportMove(this.boss, nc, nr, BOSS_MANUAL);
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
        boom.setDepth(10 + target.row); // above the floor, ordered by row
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
        this.startDialogue(SCRIPTS.mandrakeGag);
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
      wave.setDepth(10 + md.pos.row); // above the floor, ordered by row
      this.tweens.add({ targets: wave, alpha: 0, x: left.x - 40, duration: 350,
        onComplete: () => wave.destroy() });
      this.add.text(rowC.x, rowC.y - 70, 'KYAAAH!!', {
        fontFamily: 'monospace', fontSize: '22px', color: '#ba68c8',
      }).setOrigin(0.5).setDepth(10 + md.pos.row).setName('screamText');
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
    this.chipIcons.forEach(({ icon }, i) => {
      icon.setAlpha(this.loadout[i] ? 1 : 0.25); // single-use: no recharge dimming
    });
  }

  checkEnd() {
    // don't trigger endings twice, or while a script is playing
    if (this.over || this.dialogue.isActive()) return;
    const bossDead = this.bossHp <= 0;
    const mandrakeDead = !this.mandrake.alive;
    if (this.naviHp <= 0) {
      this.startDialogue(SCRIPTS.defeat, () => this.showGameOver());
      return;
    }
    if (bossDead && mandrakeDead) {
      this.startDialogue(SCRIPTS.victory, () => this.showVictory());
    }
  }

  showGameOver() {
    this.over = true;
    this.add.text(480, 250, 'GAME OVER', {
      fontFamily: 'monospace', fontSize: '56px', color: '#ff5252',
    }).setOrigin(0.5).setDepth(100);
    this.add.text(480, 320, 'press R to jack in again', {
      fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
    }).setOrigin(0.5).setDepth(100);
    this.input.keyboard.once('keydown-R', () => this.scene.restart());
  }

  showVictory() {
    this.over = true;
    this.add.text(480, 250, 'VIRUS DELETED', {
      fontFamily: 'monospace', fontSize: '56px', color: '#81c784',
    }).setOrigin(0.5).setDepth(100);
    this.add.text(480, 320, 'PUMPKIN.EXE + RUTABAGA.MND busted!', {
      fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
    }).setOrigin(0.5).setDepth(100);
    this.add.text(480, 360, 'thanks for playing! 🎃🥕', {
      fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
    }).setOrigin(0.5).setDepth(100);
  }
}
