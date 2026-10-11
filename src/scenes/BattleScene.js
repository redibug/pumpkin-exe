import Phaser from 'phaser';
import { COLS, ROWS, project, tileCorners, tileFeet, tileCenter, isPlayerTile, gridParams, setGridParams, getGridParams, hexToRgb } from '../systems/grid.js';
import { CHIP_MAP, DECK, BOSS } from '../data/chips.js';
import { ROOTABREAK, SKITTER, SENTRY, BOMB_SPIDER, AUTOSCALE } from '../data/viruses.js';
import { fitFactor, FIT_MAX } from '../systems/spriteFit.js';
import { createDebugGameplay, isDialogueSkipped } from '../systems/debugGameplay.js';
import { createDebugOverlay } from '../systems/debugOverlay.js';
import { DialogueUI, SCRIPTS } from '../systems/dialogue.js';
import { BATTLES } from '../data/battles.js';
import { SkitterbugMethods } from '../enemies/skitterbug.js';
import { SentryMethods } from '../enemies/sentry.js';
import { BombSpiderMethods } from '../enemies/bombSpider.js';
import { RootabreakMethods } from '../enemies/rootabreak.js';
import { PumpkinMethods } from '../enemies/pumpkin.js';
import { EffectsMethods } from '../systems/effects.js';
import { sound } from '../systems/sound.js';
import { CustomScreenMethods, CUSTOM_GAUGE_MS, HAND_MAX, LOADOUT_MAX } from '../ui/customScreen.js';
import { NaviMethods, NAVI_MANUAL } from '../player/navi.js';

// BattleScene — written during the jam 72h window (2026-10-09).
// MMBN-style grid battle: Bugchan (navi) vs PUMPKIN.EXE + RUTABAGA.MND.


// Skitterbug tuning (Mel: edit freely)

// ---- battles ----
// Mel: edit freely — enemy comps, names, dialogue. Simple words, short lines.

// ---- custom screen config lives in src/ui/customScreen.js ----

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

  init(data) {
    this.battleIndex = data.battleIndex || 0;
    // HP carries between battles (no heal); defaults to full on fresh start/retry
    this._carriedHp = (typeof data.naviHp === 'number') ? data.naviHp : 100;
  }

  preload() {
    this.load.image('tile-player', 'assets/tiles/tile-player.png');
    this.load.image('tile-enemy', 'assets/tiles/tile-enemy.png');
    this.load.spritesheet('bugchan', 'assets/sprites/bug/bugchan-idle-strip.png', { frameWidth: 112, frameHeight: 224 });
    this.load.image('boss', 'assets/sprites/viruses/boss-v5-cloak.png');
    this.load.image('pumpkin-drop', 'assets/sprites/viruses/pumpkin-drop.png');
    this.load.image('rootabreak', 'assets/sprites/viruses/rootabreak.png');
    this.load.image('rootabreak-sprout', 'assets/sprites/viruses/rootabreak sprout.png');
    this.load.image('skitterbug', 'assets/sprites/viruses/virus-skitterbug.png');
    this.load.image('skitterbug-green', 'assets/sprites/viruses/virus-skitterbug-green.png');
    this.load.image('sentry', 'assets/sprites/viruses/virus-sentry-clean.png');
    this.load.image('bomb-spider', 'assets/sprites/viruses/bomb spider.png');
    this.load.spritesheet('bomb', 'assets/sprites/viruses/bomb.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('bug-bomb', 'assets/sprites/bug/bomb.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('explosion', 'assets/sprites/explosion-strip.png', { frameWidth: 256, frameHeight: 256 });
    this.load.image('bg', 'assets/tiles/bg-cyberspace.png');
    this.load.image('chip-cannon', 'assets/ui/chip-cannon.png');
    this.load.image('chip-sword', 'assets/ui/chip-sword.png');
    this.load.image('chip-spread', 'assets/ui/chip-spread.png');
    this.load.image('chip-recover', 'assets/ui/chip-recover.png');
    this.load.image('chip-railgun', 'assets/ui/chip-railgun.png');
    this.load.image('chip-rapid', 'assets/ui/chip-rapid.png');
    this.load.image('chip-bomb', 'assets/ui/chip-bomb.png');
    this.load.image('chip-cannon-small', 'assets/ui/chip-cannon-small.png');
    this.load.image('chip-sword-small', 'assets/ui/chip-sword-small.png');
    this.load.image('chip-spread-small', 'assets/ui/chip-spread-small.png');
    this.load.image('chip-recover-small', 'assets/ui/chip-recover-small.png');
    this.load.image('chip-railgun-small', 'assets/ui/chip-railgun-small.png');
    this.load.image('chip-rapid-small', 'assets/ui/chip-rapid-small.png');
    this.load.image('chip-bomb-small', 'assets/ui/chip-bomb-small.png');
    this.load.image('chip-frame', 'assets/ui/chip-frame.png');
    this.load.image('mug-bugchan', 'assets/mugshots/mug-bugchan.png');
    this.load.image('mug-mel', 'assets/mugshots/mug-mel.png');
    this.load.audio('mus-battle', 'assets/audio/Jam Network Battle Theme.mp3');
    this.load.audio('mus-boss', 'assets/audio/Jam Network Boss Theme.mp3');
    this.load.image('mug-pumpkin', 'assets/mugshots/mug-pumpkin.png');
    this.load.image('mug-mandrake', 'assets/mugshots/mug-mandrake.png');
  }

  create() {
    this.over = false;
    this.time.paused = false; // insurance: never boot a restart mid-pause

    // audio unlocks on first gesture
    sound.init();
    this.input.once('pointerdown', () => sound.resume());
    this.input.keyboard.once('keydown', () => sound.resume());
    this.input.keyboard.on('keydown-M', () => {
      const on = sound.toggleMute();
      // also mute/unmute the background music
      if (this._bgm) this._bgm.setMute(!on);
    });
    sound.battleStart();
    // background music: boss theme for PUMPKIN.EXE, battle theme otherwise.
    // Persisted on the game object so it keeps looping across battles
    // instead of restarting (only switches when the track changes).
    const isBoss = BATTLES[this.battleIndex]?.name === 'PUMPKIN.EXE';
    const wantKey = isBoss ? 'mus-boss' : 'mus-battle';
    if (!this.game._bgm || this.game._bgmKey !== wantKey) {
      // stop old track if switching
      if (this.game._bgm) { this.game._bgm.stop(); this.game._bgm.destroy(); }
      this.game._bgm = this.sound.add(wantKey, { loop: true, volume: 0.35 });
      this.game._bgmKey = wantKey;
      this.game._bgm.setMute(!sound.enabled);
    }
    this._bgm = this.game._bgm; // alias for the M-key handler
    const playBgm = () => { if (!this._bgm.isPlaying) this._bgm.play(); };
    this.input.once('pointerdown', playBgm);
    this.input.keyboard.once('keydown', playBgm);

    // ---- state ----
    this.naviHp = this._carriedHp; this.naviMaxHp = 100;
    this.naviPos = { col: 1, row: 1 };
    // per-battle start position (e.g. SENTRY POST starts bottom-left)
    const _battleCfg = BATTLES[this.battleIndex];
    if (_battleCfg.naviStart) this.naviPos = { ..._battleCfg.naviStart };
    this.projectiles = this.add.group(); // tile-based collision, no physics
    this.enemyProjectiles = this.add.group(); // virus bullets (hurt the navi)
    this.shootReadyAt = 0; // buster hitscan fire rate gate
    this.enemies = []; // {type, sprite, col, row, hp, maxHp, alive, ...}

    // ---- custom screen / deck state ----
    this.deck = Phaser.Utils.Array.Shuffle([...DECK]);
    this.discardPile = [];
    this.hand = Array(HAND_MAX).fill(null); // chip case: fixed slots, null = empty
    this.loadout = [null, null, null, null]; // chip ids loaded into slots 1-4
    this.chipAmmo = [null, null, null, null]; // shots left for multi-use chips (rapid)
    this.rapidFiring = null; // { slot, key } while holding a rapid chip
    this.rapidNextShot = 0;
    this.customTimer = 0;
    this.customOpen = false;

    // mandrake state machine (per-enemy; see spawnMandrake)

    // ---- presentation ----
    this.add.image(480, 270, 'bg').setDisplaySize(960, 540).setDepth(-10);
    this.drawGrid();
    this.drawHud();

    // player idle animation (8-frame strip) — only create once (anims persist across restarts)
    if (!this.anims.exists('bugchan-idle')) {
      this.anims.create({
        key: 'bugchan-idle',
        frames: this.anims.generateFrameNumbers('bugchan', { start: 0, end: 7 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (!this.anims.exists('bomb-fuse')) {
      this.anims.create({
        key: 'bomb-fuse',
        frames: this.anims.generateFrameNumbers('bomb', { start: 0, end: 1 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (!this.anims.exists('bug-bomb-fuse')) {
      this.anims.create({
        key: 'bug-bomb-fuse',
        frames: this.anims.generateFrameNumbers('bug-bomb', { start: 0, end: 1 }),
        frameRate: 8,
        repeat: -1,
      });
    }

    const p = tileFeet(this.naviPos.col, this.naviPos.row);
    this.navi = this.physics.add.sprite(p.x, p.y, 'bugchan');
    this.navi.play('bugchan-idle');
    this.navi.setOrigin(0.5, 1); // feet at the tile: she stands ON it
    this.placeFighter(this.navi, this.naviPos.col, this.naviPos.row, NAVI_MANUAL);

    // spawn this battle's enemies from the config
    const battle = BATTLES[this.battleIndex];
    for (const e of battle.enemies) {
      if (e.type === 'pumpkin') this.spawnPumpkin(e.col, e.row);
      else if (e.type === 'rootabreak') this.spawnRootabreak(e.col, e.row, e.big);
      else if (e.type === 'skitterbug') this.spawnSkitterbug(e.col, e.row);
      else if (e.type === 'skitterbug-green') this.spawnSkitterbug(e.col, e.row, true);
      else if (e.type === 'sentry') this.spawnSentry(e.col, e.row);
      else if (e.type === 'bombspider') this.spawnBombSpider(e.col, e.row);
    }
    // NB: enemy AI timers are armed when the intro dialogue finishes, so
    // the battle doesn't run during the cutscene.

    // ---- debug overlay: only with ?debug=true in URL ----
    const debugMode = new URLSearchParams(window.location.search).get('debug') === 'true';
    this.debugMode = debugMode;
    if (debugMode) {
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

      // ---- gameplay debug panel ----
      // G toggles it. Skip-dialogue is local-only (localStorage, never in repo).
      this.debugGameplay = createDebugGameplay({
        onSkipBattle: () => this.debugSkipBattle(),
      });
      this.debugGameplay.setVisible(true);
      this.debugGameplayVisible = true;
      document.getElementById('game').appendChild(this.debugGameplay.el);
      this.input.keyboard.on('keydown-G', () => {
        this.debugGameplayVisible = !this.debugGameplayVisible;
        this.debugGameplay.setVisible(this.debugGameplayVisible);
      });
    }

    // ---- input ----
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('ONE,TWO,THREE,FOUR');
    this.customKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.shootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X); // buster
    this.chipFrontKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z); // front chip
    this.chipFrontKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE); // front chip
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER); // dialogue advance
    this.input.mouse.disableContextMenu(); // right-click discards in the custom screen

    // ---- dialogue ----
    this.dialogue = new DialogueUI(this);

    this.add.text(480, 20, `${battle.name}`, {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffb74d',
    }).setOrigin(0.5).setName('battleNameText');

    // battle intro; the custom screen opens first, then the fight starts
    this.startDialogue(battle.intro, () => {
      const now = this.time.now;
      for (const e of this.enemies) {
        if (e.type === 'pumpkin') {
          e.nextMove = now + 1400;
          e.nextAttack = now + 2200;
        } else if (e.type === 'skitterbug') {
          e.nextCheck = now + 1500;
        } else if (e.type === 'bombspider') {
          e.nextMove = now; // move immediately, no grace period for moving
          e.throwAllowedAt = now + BOMB_SPIDER.throwGraceMs;
        }
      }
      this.openCustom(); // MMBN-style: every battle starts at the custom screen
    });
  }

  // ================= enemies =================






  // Position the back-bomb at the spider's abdomen, layered behind.
  // Offset up and to the right so it peeks out from behind the body.
  // Scale follows the spider's perspective scale AND idle squash.

  // HP number floating above an enemy's head
  makeHpBar() {
    return this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
  }

  updateHpBar(enemy) {
    const t = enemy.hpBar;
    // only show for hittable enemies (mandrakes hide while burrowed)
    const show = enemy.alive && (enemy.type !== 'rootabreak' || enemy.state !== 'planted');
    t.setVisible(show);
    if (!show) return;
    const s = enemy.sprite;
    t.setPosition(s.x, s.y - s.displayHeight - 14);
    t.setText(`${enemy.hp}`);
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
      this._pausedTweens = this.tweens.getTweens().filter((t) => !t.isInfinite && !t.isFinished() && !t._noPause);
      this._pausedTweens.forEach((t) => { t.paused = true; });
    } else {
      const pausedMs = this.time.now - (this.pauseStart || this.time.now);
      for (const e of this.enemies) {
        for (const key of ['nextMove', 'nextAttack', 'nextCheck', 'timer', 'throwAllowedAt']) {
          if (Number.isFinite(e[key])) e[key] += pausedMs;
        }
      }
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
    // Local-only debug: skip all dialogue (localStorage flag, never committed)
    if (isDialogueSkipped()) {
      if (onDone) onDone();
      return;
    }
    this.setPaused(true);
    this.dialogue.start(script, () => {
      this.setPaused(false);
      if (onDone) onDone();
    });
  }

  // Debug: jump to the next battle (no-op on the last one).
  debugSkipBattle() {
    if (this.battleIndex + 1 >= BATTLES.length) return;
    // close any open UI/dialogue so the restart is clean
    if (this.customOpen) this.closeCustomUI();
    this.scene.restart({ battleIndex: this.battleIndex + 1, naviHp: this.naviHp });
  }

  // ================= custom screen =================

  // MMBN-style custom: the gauge fills during battle, SHIFT opens this
  // screen (also auto-opens when the battle starts). The hand is a chip
  // case of HAND_MAX fixed slots: unpicked cards stay in their slots, and
  // new chips load into the emptied slots. Pick up to LOADOUT_MAX for the
  // 1-4 slots; X marks a card for discard (red X, tossed on confirm).
  // Confirming spends the old loadout to the discard pile and loads the
  // new picks. OK is an on-screen button, navigable with the arrows and
  // clickable with the mouse (ESC still cancels).



  // Z: the generic "press" key — toggles a card, or pushes the OK button


  // X: mark a card for discard (red X) — toggles; marking clears selection




  // ================= custom screen (redesigned) =================
  // Left-side panel (draggable by the top handle) so the enemy layout stays
  // visible while planning chips. Vertical chip list using the new chip
  // frame; highlighting a chip shows its large art + name + desc.
  // Selecting slides a chip right; marking for discard slides it left.


  // Scale an image to fit within a max area, preserving aspect ratio.
  // Call after setTexture (reads the new texture's frame dimensions).


  // ================= teleport =================

  // Vertical-slice teleport dissolve, recreated in-engine from Mel's
  // teleport-smear strip art: the sprite is sliced into vertical strips
  // that jitter vertically and get erased, more intense in later frames.
  // 3 frames out (dissolve), then 3 in reverse (materialize).
  // Movement input / AI is locked per-sprite while its teleport runs.

  // Dissolve a sprite into pixel chunks when it's deleted. Each chunk is baked
  // as its own canvas texture (no setCrop), positioned to tile the sprite's
  // display bounds. Chunks start intact, lerp outward top-to-bottom, then
  // delete top-to-bottom with a flicker.


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
    for (const e of this.enemies) {
      const manual = e.type === 'pumpkin' ? BOSS.manualScale : ROOTABREAK.manualScale * (e.big ? 1.35 : 1);
      if (e.type === 'rootabreak' && !e.sprite.visible) continue;
      this.placeFighter(e.sprite, e.col, e.row, manual);
      if (e.type === 'rootabreak') {
        const mc = tileCenter(e.col, e.row);
        const mp = tileFeet(e.col, e.row);
        // keep sprout bottom-aligned with the main sprite
        const sproutY = mc.y + 0.1 * (e.sprite.displayHeight - e.sprout.displayHeight);
        e.sprout.setPosition(mc.x, sproutY).setScale(mp.s * 0.9).setDepth(9 + e.row);
        e.sproutY = sproutY;
      }
    }
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
    // init to carried HP (not full) — updateHud doesn't run while custom screen is open
    this.hpBar.setDisplaySize(216 * (this.naviHp / this.naviMaxHp), 14);
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

    // 4 loadout slots (1-4): filled from the custom screen.
    // New chip frame with the small chip art as its label.
    // Layering: icon below, frame on top (frame has a transparent hole).
    this.chipIcons = [];
    for (let i = 0; i < LOADOUT_MAX; i++) {
      const x = 420 + i * 70;
      const icon = this.add.image(x, 498.6, 'chip-empty').setDisplaySize(30, 30);
      const frame = this.add.image(x, 500, 'chip-frame').setDisplaySize(44, 44);
      const label = this.add.text(x, 530, `${i + 1}`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#9fb3c8',
      }).setOrigin(0.5);
      // ammo counter for multi-use chips (e.g. rapid fire): "×10" in yellow
      const ammo = this.add.text(x + 16, 484, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffeb3b',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);
      this.chipIcons.push({ frame, icon, label, ammo });
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
    this.chipIcons.forEach(({ frame, icon, ammo }, i) => {
      const id = this.loadout[i];
      const loaded = !!id;
      // only loaded chips get the chip frame; empty slots show the placeholder
      frame.setVisible(loaded);
      // NB: setTexture keeps the old scale, so re-apply the display size
      // every time (small chip art is 96x96, empty slot is 48x48).
      icon.setTexture(loaded ? `chip-${id}-small` : 'chip-empty').setDisplaySize(30, 30);
      // ammo counter for multi-use chips (rapid fire)
      const shots = this.chipAmmo[i];
      if (loaded && shots != null && shots > 0) {
        ammo.setText(`×${shots}`).setVisible(true);
      } else {
        ammo.setVisible(false);
      }
      // ammo text follows the icon when slots slide
      ammo.x = icon.x + 16;
    });
  }

  updateCustomGaugeHud() {
    const frac = Math.min(this.customTimer / CUSTOM_GAUGE_MS, 1);
    this.customGaugeFill.setDisplaySize(216 * frac, 6);
    const full = frac >= 1;
    this.customReadyText.setVisible(full && !this.customOpen);
  }

  // ================= main loop =================

  // Gamepad helper: returns the first connected pad, or null.
  // Standard mapping: D-pad/stick = move, A = buster/confirm,
  // X = front chip, LB/RB or Start = custom screen.
  getPad() {
    const pads = this.input.gamepad?.gamepads;
    if (!pads) return null;
    for (const p of pads) { if (p && p.connected) return p; }
    return null;
  }
  // Gamepad button JustDown (with edge detection)
  padJustDown(pad, btn) {
    if (!pad) return false;
    const key = `_pad${btn}`;
    const down = pad.buttons[btn]?.pressed;
    const was = this[key];
    this[key] = down;
    return down && !was;
  }
  update(time, delta) {
    // visual follows run even when paused (don't affect game timing)
    this.syncBombBacks();
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
    } else if (Phaser.Input.Keyboard.JustDown(this.customKey)
      || this.padJustDown(this.getPad(), 4) || this.padJustDown(this.getPad(), 5)
      || this.padJustDown(this.getPad(), 9)) {
      this.openCustom(true); // in scene update: no keydown dispatch in flight
    }
    this.handleMovement(time);
    this.handleChips(time);
    this.updateProjectiles(delta);
    this.updateEnemyProjectiles(delta);
    this.updateEnemies(time);
    for (const e of this.enemies) this.updateHpBar(e);
    this.updateHud(time);
    this.checkEnd();
  }

  // ================= navi =================



  // Called on JustDown of a chip key. Rapid fire starts a hold-to-fire;
  // other chips fire once via fireChipAt. Front key (Z/Space) with an empty
  // slot falls back to the buster.



  // Remove chip at index i from the loadout (used up): splice, HUD, slide anim.

  // Use the chip at loadout index i (single use): it disappears and the
  // chips to its right tween left to fill the hole.

  // Buster: instant hitscan down the navi's row — no projectile. Hits the
  // first enemy ahead; shows the punch frame + a muzzle flash.

  // Punch frame for the buster. Mel is drawing the real punch frame +
  // muzzle flash herself; until 'bugchan-punch' lands in sprites/, the
  // fallback is a quick lunge. (Wire the preload in preload() when it lands.)

  // PLACEHOLDER for Mel's muzzle-flash overlay: procedural star flash.


  // Tile-based projectile collision (not sprite boxes): a projectile hits
  // only if it's on the enemy's row and overlapping the enemy's tile.


  // ================= enemy AI =================

  updateEnemies(time) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.type === 'pumpkin') this.pumpkinAI(e, time);
      else if (e.type === 'rootabreak') this.rootabreakAI(e, time);
      else if (e.type === 'skitterbug') this.skitterbugAI(e, time);
      else if (e.type === 'sentry') this.sentryAI(e, time);
      else if (e.type === 'bombspider') this.bombSpiderAI(e, time);
    }
  }



  // ================= mandrake AI =================



  // ================= skitterbug AI =================
  // Slow cycle: move, spit, move, spit...
  // Each check: if the navi is on our row and we can spit -> spit.
  // Otherwise move (up/down by intent). Can't spit twice without moving.




  // Keep back-bombs synced to their spiders (position + squash).
  // Runs every frame, even when paused — it's a visual follow, not game timing.






  updateEnemyProjectiles(delta) {
    const dt = delta / 1000;
    for (const b of [...this.enemyProjectiles.getChildren()]) {
      if (!b.active) continue;
      b.x += b.getData('vx') * dt;
      // move the tile indicator to the wave's current tile
      // (highlightTile bakes world coords, so destroy/recreate on change)
      const brow = b.getData('row');
      let curCol = -1;
      for (let cc = 0; cc < COLS; cc++) {
        const corners = tileCorners(cc, brow);
        const xs = corners.map((p) => p.x);
        if (b.x >= Math.min(...xs) && b.x <= Math.max(...xs)) { curCol = cc; break; }
      }
      const prevCol = b.getData('hlCol');
      if (curCol !== prevCol) {
        const oldHl = b.getData('tileHighlight');
        if (oldHl && oldHl.active) oldHl.destroy();
        b.setData('tileHighlight', null);
        if (curCol >= 0) {
          // wave is over a tile: highlight it
          const color = 0xff5252; // standard red telegraph (visible on pink tiles)
          const newHl = this.highlightTile(curCol, brow, color, 0.25);
          b.setData('tileHighlight', newHl);
        }
        // if curCol is -1 (off the grid), no highlight — you can't be hit there
        b.setData('hlCol', curCol);
      }
      // sound waves expand as they travel (tracing a larger circle)
      // baseScale preserves the perspective scale
      if (b.getData('expand') !== undefined) {
        const ex = b.getData('expand') + dt * 1.2;
        b.setData('expand', ex);
        const base = b.getData('baseScale') ?? 1;
        b.setScale(base * (1 + ex * 0.6));
      }
      // destroy off-screen either side (noise travels both directions)
      if (b.x < -60 || b.x > 1020) {
        const hh = b.getData('tileHighlight');
        if (hh && hh.active) hh.destroy();
        b.destroy(); continue;
      }
      // hits the navi if on her row and overlapping her tile
      if (b.getData('row') === this.naviPos.row
        && this.projOverlapsTile(b, this.naviPos.col, this.naviPos.row)) {
        this.damageNavi(b.getData('damage') ?? SKITTER.bulletDamage);
        const hh2 = b.getData('tileHighlight');
        if (hh2 && hh2.active) hh2.destroy();
        b.destroy();
      }
    }
  }

  // ================= damage =================


  damageEnemy(e, amount) {
    if (!e.alive) return;
    e.hp = Math.max(0, e.hp - amount);
    this.flash(e.sprite, 0xffffff);
    this.updateHpBar(e);
    if (e.hp <= 0) {
      sound.enemyDie();
      e.alive = false;
      if (e.warnRect) { e.warnRect.destroy(); e.warnRect = null; }
      if (e.sprout) e.sprout.setVisible(false);
      if (e.sproutBob) e.sproutBob.stop();
      if (e.breathTween) e.breathTween.stop();
      if (e.screamText) { e.screamText.destroy(); e.screamText = null; }
      if (e.wiggleTween) { e.wiggleTween.stop(); e.wiggleTween = null; }
      e.sprite.setAngle(0);
      if (e.sensor) { this.tweens.killTweensOf(e.sensor); e.sensor.setVisible(false); }
      if (e.bombBack) { e.bombBack.destroy(); e.bombBack = null; }
      if (e.bombWarns) { e.bombWarns.forEach((w) => w.destroy()); e.bombWarns = null; }
      this.tweens.killTweensOf(e.sprite); // stop idle/shoot tweens
      if (e.bobTween) e.bobTween.stop(); // stop the infinite idle bob
      // abort mid-teleport: clear the flag (tick sees it and cleans up),
      // destroy any strip objects
      if (e.sprite.getData('teleporting')) {
        e.sprite.setData('teleporting', false);
        const objs = e.sprite.getData('teleportObjs') || [];
        objs.forEach((o) => { if (o.active) o.destroy(); });
        e.sprite.setData('teleportObjs', null);
      }
      // reset to home position (e.g. sentry kickback) so dissolve aligns
      if (e.baseX !== undefined) e.sprite.setPosition(e.baseX, e.baseY);
      // dissolve top-to-bottom (replaces the old grow+fade)
      this.dissolveSprite(e.sprite);
      this.updateHpBar(e); // hides the bar
    }
  }

  damageNavi(amount) {
    sound.hurt();
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
    if (this.naviHp <= 0) {
      // Bugchan gets the delete animation too
      this.tweens.killTweensOf(this.navi);
      // abort mid-teleport: clear the flag (tick sees it and cleans up),
      // destroy any strip objects — otherwise the 'in' phase re-shows her
      if (this.navi.getData('teleporting')) {
        this.navi.setData('teleporting', false);
        const objs = this.navi.getData('teleportObjs') || [];
        objs.forEach((o) => { if (o.active) o.destroy(); });
        this.navi.setData('teleportObjs', null);
      }
      this.dissolveSprite(this.navi);
      this.startDialogue(SCRIPTS.defeat, () => this.showGameOver());
      return;
    }
    if (this.enemies.every((e) => !e.alive)) {
      this.showVictory();
    }
  }

  // Fancy title with vertical gradient, stroke, and blurred drop shadow.
  // Drawn on a canvas for the gradient; returns an Image.
  // Reuses the texture if it already exists (e.g. across battles).
  makeFancyTitle(x, y, text, gradTop, gradBottom, strokeColor) {
    const fontSize = 56;
    const key = `title-${text.replace(/\s/g, '_')}`;
    if (!this.textures.exists(key)) {
      // measure text width via a temp canvas
      const meas = this.textures.createCanvas('__meas', 4, 4);
      const mctx = meas.getContext();
      mctx.font = `bold ${fontSize}px monospace`;
      const tw = Math.ceil(mctx.measureText(text).width);
      this.textures.remove('__meas');
      const pad = 24;
      const cw = tw + pad * 2, ch = fontSize + pad * 2;
      const tex = this.textures.createCanvas(key, cw, ch);
      const ctx = tex.getContext();
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = cw / 2, cy = ch / 2;
      // blurred dark drop shadow (drawn first, offset down)
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 5;
      // gradient fill
      const grad = ctx.createLinearGradient(0, cy - fontSize / 2, 0, cy + fontSize / 2);
      grad.addColorStop(0, gradTop);
      grad.addColorStop(1, gradBottom);
      ctx.fillStyle = grad;
      ctx.fillText(text, cx, cy);
      // stroke on top (no shadow for the stroke)
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 3;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(text, cx, cy);
      tex.refresh();
    }
    const img = this.add.image(x, y, key).setDepth(100);
    return img;
  }

  // Glitch-in: flicker with x-jitter, then scale down to 1.0
  glitchIn(title, ...subs) {
    const baseX = title.x;
    title.setScale(1.22).setAlpha(0);
    subs.forEach((s) => s.setAlpha(0));
    let ticks = 0;
    this.time.addEvent({
      delay: 45, repeat: 7,
      callback: () => {
        ticks++;
        title.x = baseX + Phaser.Math.Between(-9, 9);
        title.setAlpha(Phaser.Math.FloatBetween(0.25, 1));
        if (ticks >= 7) {
          title.x = baseX;
          title.setAlpha(1);
          this.tweens.add({
            targets: title, scaleX: 1, scaleY: 1,
            duration: 220, ease: 'Quad.easeOut',
          });
          // fade the subtitles in after the title settles
          subs.forEach((s, i) => {
            this.tweens.add({
              targets: s, alpha: 1,
              duration: 180, delay: 120 + i * 90,
            });
          });
        }
      },
    });
  }

  showGameOver() {
    sound.gameOver();
    this.over = true;
    const title = this.makeFancyTitle(480, 250, 'GAME OVER', '#ff8a80', '#d32f2f', '#4a0000');
    const sub = this.add.text(480, 320, 'press R to log in again', {
      fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
    }).setOrigin(0.5).setDepth(100);
    sub.setShadow(0, 3, 'rgba(0,0,0,0.85)', 10, true, true);
    this.glitchIn(title, sub);
    // R retries the current battle, not the whole run
    this.input.keyboard.once('keydown-R', () => this.scene.restart({ battleIndex: this.battleIndex }));
  }

  showVictory() {
    sound.victory();
    this.over = true;
    const battle = BATTLES[this.battleIndex];
    const title = this.makeFancyTitle(480, 250, 'VIRUS DELETED', '#c8e6c9', '#2e7d32', '#0a2a0a');
    const sub1 = this.add.text(480, 320, `${battle.name} busted!`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
    }).setOrigin(0.5).setDepth(100);
    sub1.setShadow(0, 3, 'rgba(0,0,0,0.85)', 10, true, true);
    const isLast = this.battleIndex >= BATTLES.length - 1;
    const sub2 = this.add.text(480, 360, isLast ? 'thanks for playing! 🎃' : 'press Z to continue', {
      fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
    }).setOrigin(0.5).setDepth(100);
    sub2.setShadow(0, 3, 'rgba(0,0,0,0.85)', 10, true, true);
    this.glitchIn(title, sub1, sub2);
    if (isLast) return;
    // victory screen -> story segment -> next battle
    const advance = (e) => {
      if (e.code !== 'KeyZ' && e.code !== 'Space' && e.code !== 'Enter') return;
      this.input.keyboard.off('keydown', advance);
      this.startDialogue(battle.victory, () => {
        this.startDialogue(battle.story, () => {
          // no heal between battles: carry current HP forward
          this.scene.restart({ battleIndex: this.battleIndex + 1, naviHp: this.naviHp });
        });
      });
    };
    this.input.keyboard.on('keydown', advance);
  }
}

// Enemy methods are defined in src/enemies/*.js and mixed in here,
// so `this` inside those methods is the scene.
Object.assign(BattleScene.prototype, SkitterbugMethods);
Object.assign(BattleScene.prototype, SentryMethods);
Object.assign(BattleScene.prototype, BombSpiderMethods);
Object.assign(BattleScene.prototype, RootabreakMethods);
Object.assign(BattleScene.prototype, PumpkinMethods);
Object.assign(BattleScene.prototype, EffectsMethods);
Object.assign(BattleScene.prototype, CustomScreenMethods);
Object.assign(BattleScene.prototype, NaviMethods);
