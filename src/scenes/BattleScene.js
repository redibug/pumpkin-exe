import Phaser from 'phaser';
import { COLS, ROWS, project, tileCorners, tileFeet, tileCenter, isPlayerTile, gridParams, setGridParams, getGridParams, hexToRgb } from '../systems/grid.js';
import { CHIP_MAP, DECK, BOSS } from '../systems/chips.js';
import { RUTABAGA_MANDRAKE } from '../systems/viruses.js';
import { fitFactor, FIT_MAX } from '../systems/spriteFit.js';
import { createDebugGameplay, isDialogueSkipped } from '../systems/debugGameplay.js';
import { createDebugOverlay } from '../systems/debugOverlay.js';
import { DialogueUI, SCRIPTS } from '../systems/dialogue.js';

// BattleScene — written during the jam 72h window (2026-10-09).
// MMBN-style grid battle: Bugchan (navi) vs PUMPKIN.EXE + RUTABAGA.MND.

const M = RUTABAGA_MANDRAKE;

// Skitterbug tuning (Mel: edit freely)
const SKITTER = {
  maxHp: 60,
  checkIntervalMs: 2800,  // slow cycle: each check is either a move or a spit
  bulletSpeed: 170,       // slow-moving ichor (chips fly at 520)
  bulletDamage: 10,
  bulletColor: 0x9dbb2e,  // sickly yellow-green ichor
};
const SKITTER_MANUAL = 0.5;

const SENTRY = {
  maxHp: 80,
  telegraphMs: 800,       // activated: sensor flashes red for slightly < 1s
  cooldownMs: 1000,       // cooldown: can't do anything for 1s
  laserDamage: 15,
};
const SENTRY_MANUAL = 0.9;

// Per-enemy-type auto-scale: longest texture side auto-shrinks to fit.
// Unlisted types use the default FIT_MAX (512).
const AUTOSCALE = {
  skitterbug: 120,
  sentry: 140,
};

// ---- battles ----
// Mel: edit freely — enemy comps, names, dialogue. Simple words, short lines.
const BATTLES = [
  {
    name: 'SKITTER PATROL',
    enemies: [
      { type: 'skitterbug', col: 3, row: 0 },
      { type: 'skitterbug', col: 4, row: 2 },
    ],
    intro: [
      { speaker: 'mel', text: 'Bugchan, I jacked you in. Two beetle viruses are crawling around in there.' },
      { speaker: 'bugchan', text: 'Beetles with cannons?! I will debug these bugs!' },
      { speaker: 'skitterbug', text: 'SKITTER SKITTER!' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Squashed! Those beetles were slow!' },
    ],
    story: [
      { speaker: 'mel', text: 'Good work. But I see roots digging nearby. Stay sharp.' },
      { speaker: 'bugchan', text: 'Roots? Smells like rutabagas...' },
    ],
  },
  {
    name: 'SENTRY POST',
    naviStart: { col: 0, row: 2 }, // bottom left
    enemies: [
      { type: 'skitterbug', col: 3, row: 0 }, // top left enemy square
      { type: 'sentry', col: 5, row: 1 },     // far right middle
    ],
    intro: [
      { speaker: 'mel', text: 'A sentry turret is guarding that lane. It only shoots when you are on its row.' },
      { speaker: 'bugchan', text: 'Then I will stay off its row! Easy!' },
      { speaker: 'sentry', text: 'TARGET ACQUIRED.' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Turret down! It never even moved!' },
    ],
    story: [
      { speaker: 'mel', text: 'Nice dodging. Something is sprouting ahead...' },
      { speaker: 'bugchan', text: 'I smell veggies. Rutabaga veggies!' },
    ],
  },
  {
    name: 'SPROUT PATROL',
    enemies: [
      { type: 'mandrake', col: 4, row: 0 },
      { type: 'mandrake', col: 4, row: 2 },
    ],
    intro: [
      { speaker: 'mel', text: 'Bugchan, I jacked you in. Two rutabaga viruses are digging around in there.' },
      { speaker: 'bugchan', text: 'Smells like dirt! I will debug these roots!' },
      { speaker: 'mandrake', text: 'KYAAAH!!' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Two down! That was easy!' },
    ],
    story: [
      { speaker: 'mel', text: 'Good work. But I see more signals deeper in. Keep going.' },
      { speaker: 'bugchan', text: 'Deeper? It smells worse down there...' },
    ],
  },
  {
    name: 'ROOT CELLAR',
    enemies: [
      { type: 'mandrake', col: 3, row: 0 },
      { type: 'mandrake', col: 5, row: 1, big: true },
      { type: 'mandrake', col: 3, row: 2 },
    ],
    intro: [
      { speaker: 'mel', text: 'Three this time. The big one in the middle looks mean.' },
      { speaker: 'bugchan', text: 'Big root, big problems! Chips ready, Mel!' },
      { speaker: 'mandrake', text: 'KYAAAH!!' },
    ],
    victory: [
      { speaker: 'bugchan', text: 'Phew! The big one almost got me!' },
    ],
    story: [
      { speaker: 'mel', text: 'One signal left. It is huge. Be careful, Bugchan.' },
      { speaker: 'bugchan', text: 'Huge? Like... pumpkin huge?' },
      { speaker: 'pumpkin', text: 'I AM PUMPKIN.EXE! THIS HARVEST IS MINE, LITTLE BUG!' },
    ],
  },
  {
    name: 'PUMPKIN.EXE',
    enemies: [
      { type: 'pumpkin', col: 4, row: 1 },
      { type: 'mandrake', col: 5, row: 0 },
    ],
    intro: [
      { speaker: 'mel', text: 'Bugchan, I jacked you into the cyberworld. Something is wrong in there...' },
      { speaker: 'bugchan', text: 'Whoa! Pumpkins everywhere! And they look mad!' },
      { speaker: 'pumpkin', text: 'I AM PUMPKIN.EXE! THIS HARVEST IS MINE, LITTLE BUG!' },
      { speaker: 'bugchan', text: 'Not on my watch! Mel, send chips! I will debug this gourd!' },
    ],
    victory: [
      { speaker: 'pumpkin', text: 'NO... MY HARVEST... ROTTING...' },
      { speaker: 'bugchan', text: 'Virus deleted! Good work, Mel!' },
    ],
    story: [], // last battle: no story after, goes to ending
  },
];

// Manual artistic scales on top of the auto-fit + perspective scale.
const NAVI_MANUAL = 1;
const BOSS_MANUAL = 0.5;
const MANDRAKE_MANUAL = 0.25;

// ---- custom screen / deck ----
const CUSTOM_GAUGE_MS = 10000; // battle time to fill the custom gauge
const HAND_MAX = 5;            // chip-case slots in the custom screen
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

  init(data) {
    this.battleIndex = data.battleIndex || 0;
  }

  preload() {
    this.load.image('tile-player', 'assets/tiles/tile-player.png');
    this.load.image('tile-enemy', 'assets/tiles/tile-enemy.png');
    this.load.spritesheet('bugchan', 'assets/sprites/bug/bugchan-idle-strip.png', { frameWidth: 112, frameHeight: 224 });
    this.load.image('boss', 'assets/sprites/viruses/boss-v5-cloak.png');
    this.load.image('mandrake', 'assets/sprites/viruses/virus-rutabaga-mandrake.png');
    this.load.image('skitterbug', 'assets/sprites/viruses/virus-skitterbug.png');
    this.load.image('sentry', 'assets/sprites/viruses/virus-sentry-clean.png');
    this.load.image('bg', 'assets/tiles/bg-cyberspace.png');
    this.load.image('chip-cannon', 'assets/ui/chip-cannon.png');
    this.load.image('chip-sword', 'assets/ui/chip-sword.png');
    this.load.image('chip-spread', 'assets/ui/chip-spread.png');
    this.load.image('chip-recover', 'assets/ui/chip-recover.png');
    this.load.image('chip-railgun', 'assets/ui/chip-railgun.png');
    this.load.image('chip-cannon-small', 'assets/ui/chip-cannon-small.png');
    this.load.image('chip-sword-small', 'assets/ui/chip-sword-small.png');
    this.load.image('chip-spread-small', 'assets/ui/chip-spread-small.png');
    this.load.image('chip-recover-small', 'assets/ui/chip-recover-small.png');
    this.load.image('chip-railgun-small', 'assets/ui/chip-railgun-small.png');
    this.load.image('chip-frame', 'assets/ui/chip-frame.png');
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
    // per-battle start position (e.g. SENTRY POST starts bottom-left)
    const _battleCfg = BATTLES[this.battleIndex];
    if (_battleCfg.naviStart) this.naviPos = { ..._battleCfg.naviStart };
    this.projectiles = this.add.group(); // tile-based collision, no physics
    this.enemyProjectiles = this.add.group(); // virus bullets (hurt the navi)
    this.shootReadyAt = 0; // buster hitscan fire rate gate
    this.enemies = []; // {type, sprite, col, row, hp, maxHp, alive, ...}
    this.mandrakeGagged = false; // first-emerge gag plays once per battle

    // ---- custom screen / deck state ----
    this.deck = Phaser.Utils.Array.Shuffle([...DECK]);
    this.discardPile = [];
    this.hand = Array(HAND_MAX).fill(null); // chip case: fixed slots, null = empty
    this.loadout = [null, null, null, null]; // chip ids loaded into slots 1-4
    this.customTimer = 0;
    this.customOpen = false;

    // mandrake state machine (per-enemy; see spawnMandrake)

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

    // spawn this battle's enemies from the config
    const battle = BATTLES[this.battleIndex];
    for (const e of battle.enemies) {
      if (e.type === 'pumpkin') this.spawnPumpkin(e.col, e.row);
      else if (e.type === 'mandrake') this.spawnMandrake(e.col, e.row, e.big);
      else if (e.type === 'skitterbug') this.spawnSkitterbug(e.col, e.row);
      else if (e.type === 'sentry') this.spawnSentry(e.col, e.row);
    }
    // NB: enemy AI timers are armed when the intro dialogue finishes, so
    // the battle doesn't run during the cutscene.

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

    // ---- gameplay debug panel (TEMPORARY: hide before shipping) ----
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
        } else if (e.type === 'mandrake') {
          e.timer = now + M.burrowedMs;
        } else if (e.type === 'skitterbug') {
          e.nextCheck = now + 1500;
        }
      }
      this.openCustom(); // MMBN-style: every battle starts at the custom screen
    });
  }

  // ================= enemies =================

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
  }

  spawnMandrake(col, row, big = false) {
    const mp = tileFeet(col, row);
    // dirt mound (burrowed) + hidden sprite
    const mound = this.add.ellipse(mp.x, mp.y - 8, 70, 26, 0x5d3a1a);
    mound.setScale(mp.s).setDepth(9 + row);
    const sprite = this.physics.add.sprite(mp.x, mp.y, 'mandrake').setVisible(false);
    sprite.setData('fitMax', AUTOSCALE.mandrake ?? FIT_MAX);
    sprite.setOrigin(0.5, 1);
    if (big) sprite.setTint(0xffab91); // big one: slightly red tint
    this.placeFighter(sprite, col, row, MANDRAKE_MANUAL * (big ? 1.35 : 1));
    const maxHp = big ? M.maxHp * 2 : M.maxHp;
    const enemy = {
      type: 'mandrake', sprite, mound, col, row,
      hp: maxHp, maxHp, alive: true, big,
      state: 'burrowed', // burrowed | telegraph | emerged
      timer: 0, warnRect: null,
      hpBar: this.makeHpBar(),
    };
    this.enemies.push(enemy);
    return enemy;
  }

  spawnSkitterbug(col, row) {
    const sprite = this.physics.add.sprite(0, 0, 'skitterbug');
    sprite.setData('fitMax', AUTOSCALE.skitterbug ?? FIT_MAX);
    sprite.setOrigin(0.5, 1);
    this.placeFighter(sprite, col, row, SKITTER_MANUAL);
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
  }

  spawnSentry(col, row) {
    // Stationary turret. State machine: ready (watching) -> activated
    // (sensor flashing red, ~800ms) -> fires piercing hitscan laser ->
    // cooldown (1s, does nothing) -> ready.
    const sprite = this.physics.add.sprite(0, 0, 'sentry');
    sprite.setData('fitMax', AUTOSCALE.sentry ?? FIT_MAX);
    sprite.setOrigin(0.5, 1);
    this.placeFighter(sprite, col, row, SENTRY_MANUAL);
    // sensor light: small red dot above the crown, flashes when activated
    const sensor = this.add.circle(sprite.x, sprite.y - sprite.displayHeight - 6, 7, 0xff3b30);
    sensor.setDepth(sprite.depth + 1);
    sensor.setVisible(false);
    const enemy = {
      type: 'sentry', sprite, sensor, col, row,
      hp: SENTRY.maxHp, maxHp: SENTRY.maxHp, alive: true,
      state: 'ready', // ready | activated | cooldown
      cooldownUntil: 0,
      hpBar: this.makeHpBar(),
    };
    this.enemies.push(enemy);
    return enemy;
  }

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
    const show = enemy.alive && (enemy.type !== 'mandrake' || enemy.state === 'emerged');
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
      this._pausedTweens = this.tweens.getTweens().filter((t) => !t.isInfinite && !t.isFinished());
      this._pausedTweens.forEach((t) => { t.paused = true; });
    } else {
      const pausedMs = this.time.now - (this.pauseStart || this.time.now);
      for (const e of this.enemies) {
        for (const key of ['nextMove', 'nextAttack', 'nextCheck', 'timer']) {
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
    this.scene.restart({ battleIndex: this.battleIndex + 1 });
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
  openCustom(skipKeyGuard = false) {
    if (this.customOpen || this.over || this.dialogue.isActive()) return;
    this.customOpen = true;
    this.customTimer = 0;
    this.updateCustomGaugeHud();
    this.setPaused(true);
    this.drawToHand();
    this.customCursor = { row: 0, col: 0 }; // row 0 = cards, row 1 = OK button
    this.customOkFromCol = HAND_MAX - 1; // Left/Up from OK returns here
    this.customSelected = []; // hand indices, in selection order
    this.customDiscard = []; // hand indices marked for discard (red X)
    this.buildCustomUI();
    // The keyboard plugin emits 'keydown-Z' BEFORE generic 'keydown'. If this
    // screen was opened by Z/Space/Enter, our 'keydown' handler (registered
    // during the 'keydown-X' dispatch) would fire for that SAME press and
    // auto-select the first chip. Swallow that one emit.
    const JustDown = Phaser.Input.Keyboard.JustDown;
    this._swallowCustomKeydown = !skipKeyGuard &&
      (JustDown(this.chipFrontKey) || JustDown(this.chipFrontKey2) || JustDown(this.enterKey));
    // Swallow the input that opened the screen: the opening click is still
    // being dispatched when the cards are created, so it would pass through
    // and "click" a card. Arm on pointer-up (or immediately if no pointer
    // is down, i.e. opened via keyboard).
    this.customArmed = !this.input.activePointer.isDown;
    this._customArmHandler = () => { this.customArmed = true; };
    this.input.once('pointerup', this._customArmHandler);
    this._customKeyHandler = (event) => {
      if (this._swallowCustomKeydown) { this._swallowCustomKeydown = false; return; }
      this.handleCustomKey(event);
    };
    this.input.keyboard.on('keydown', this._customKeyHandler);
  }

  drawToHand() {
    // chip case: new chips load into the empty slots; the rest stay put
    for (let i = 0; i < HAND_MAX; i++) {
      if (this.hand[i]) continue;
      if (this.deck.length === 0) {
        if (this.discardPile.length === 0) break;
        this.deck = Phaser.Utils.Array.Shuffle(this.discardPile);
        this.discardPile = [];
      }
      this.hand[i] = this.deck.pop();
    }
  }

  handleCustomKey(event) {
    const cur = this.customCursor;
    switch (event.code) {
      case 'ArrowUp':
        if (cur.row === 1) { cur.row = 0; cur.col = this.customOkFromCol; }
        else cur.col = Math.max(0, cur.col - 1);
        break;
      case 'ArrowDown':
        if (cur.row === 0) {
          if (cur.col >= HAND_MAX - 1) {
            this.customOkFromCol = cur.col;
            cur.row = 1; cur.col = 0;
          } else cur.col = Math.min(HAND_MAX - 1, cur.col + 1);
        }
        break;
      case 'ArrowRight':
        // OK button sits in the right column: Right reaches it from the chips
        if (cur.row === 0) {
          this.customOkFromCol = cur.col;
          cur.row = 1; cur.col = 0;
        }
        break;
      case 'ArrowLeft':
        // Left from OK returns to the chip we came from
        if (cur.row === 1) { cur.row = 0; cur.col = this.customOkFromCol; }
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
    if (i < 0 || i >= HAND_MAX || !this.hand[i]) return; // empty slot
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
    if (i < 0 || i >= HAND_MAX || !this.hand[i]) return; // empty slot
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
    // picked + tossed cards leave their slots empty (chip case keeps position)
    const gone = new Set([...this.customSelected, ...this.customDiscard]);
    gone.forEach((i) => { this.hand[i] = null; });
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
    this.input.off('pointermove', this._customDragMove);
    this.input.off('pointerup', this._customDragUp);
    this._customDragMove = null; this._customDragUp = null;
    if (this.customUI) { this.customUI.destroy(); this.customUI = null; }
    if (this.customBackdrop) { this.customBackdrop.destroy(); this.customBackdrop = null; }
    this.customCards = null;
    this.customOpen = false;
    // Consume any pending JustDown edges: _justDown persists until read or
    // key-up, so the key that closed the screen would otherwise fire a chip
    // on a later frame (e.g. if still held).
    const JD = Phaser.Input.Keyboard.JustDown;
    JD(this.shootKey); JD(this.chipFrontKey); JD(this.chipFrontKey2); JD(this.enterKey);
    Object.values(this.keys).forEach(JD);
    this.setPaused(false);
  }

  // ================= custom screen (redesigned) =================
  // Left-side panel (draggable by the top handle) so the enemy layout stays
  // visible while planning chips. Vertical chip list using the new chip
  // frame; highlighting a chip shows its large art + name + desc.
  // Selecting slides a chip right; marking for discard slides it left.

  buildCustomUI() {
    const PANEL_W = 400, PANEL_H = 508;
    // subtle dim outside the panel (kept out of the draggable container)
    this.customBackdrop = this.add.rectangle(480, 270, 960, 540, 0x05070f, 0.35)
      .setDepth(199).setScrollFactor(0);
    const ui = this.add.container(16, 16).setDepth(200).setScrollFactor(0);
    this.customUI = ui;

    ui.add(this.add.rectangle(PANEL_W / 2, PANEL_H / 2, PANEL_W, PANEL_H, 0x0a1226, 1)
      .setStrokeStyle(3, 0x00e5ff));

    // top handle: drag the window around with the mouse
    const handle = this.add.rectangle(PANEL_W / 2, 18, PANEL_W, 36, 0x0d1b33)
      .setStrokeStyle(2, 0x00e5ff);
    handle.setInteractive({ useHandCursor: true });
    ui.add(handle);
    ui.add(this.add.text(PANEL_W / 2, 18, 'CUSTOM SCREEN', {
      fontFamily: 'monospace', fontSize: '20px', color: '#00e5ff',
    }).setOrigin(0.5));
    let dragging = false, dragDX = 0, dragDY = 0;
    handle.on('pointerdown', (pointer) => {
      if (!this.customArmed) return; // ignore the click that opened the screen
      dragging = true;
      dragDX = pointer.x - ui.x;
      dragDY = pointer.y - ui.y;
    });
    this._customDragMove = (pointer) => {
      if (!dragging || !pointer.isDown) return;
      ui.x = Phaser.Math.Clamp(pointer.x - dragDX, -PANEL_W + 80, 960 - 80);
      ui.y = Phaser.Math.Clamp(pointer.y - dragDY, 0, 540 - 80);
    };
    this._customDragUp = () => { dragging = false; };
    this.input.on('pointermove', this._customDragMove);
    this.input.on('pointerup', this._customDragUp);

    // ---- Row 1: deck info row ----
    // (handle with title is above; indicators sit just below it)

    // ---- Row 2: chip row ----
    // Left column: chip selection, shifted down to clear the indicators.
    // persistent chip cards (built once so select/mark can slide-tween).
    // Layering: icon (label) below, frame on top. The frame is 32x32 with a
    // 22x22 hole at x=[5,26], y=[4,25]; at 64x64 the hole is 44x44 centered
    // at (0,-2), so the icon is 44x44 at (0,-2) to exactly fill it.
    this.customCards = [];
    for (let i = 0; i < HAND_MAX; i++) {
      const baseX = 72, baseY = 110 + i * 76;
      const root = this.add.container(baseX, baseY);
      const halo = this.add.rectangle(0, 0, 76, 76, 0xffffff, 0.12)
        .setStrokeStyle(2, 0xffffff).setVisible(false);
      const icon = this.add.image(0, -2, 'chip-empty').setDisplaySize(44, 44);
      const frame = this.add.image(0, 0, 'chip-frame').setDisplaySize(64, 64);
      // selection order + discard X live in the top-left corner of the chip
      const selText = this.add.text(-26, -28, '', {
        fontFamily: 'monospace', fontSize: '18px', color: '#00e5ff',
      }).setOrigin(0.5).setVisible(false);
      // red X for marked (discard): small badge in the corner
      const m = 10;
      const x1 = this.add.line(-24, -24, -m, -m, m, m, 0xff3b30).setOrigin(0, 0).setLineWidth(5).setVisible(false);
      const x2 = this.add.line(-24, -24, m, -m, -m, m, 0xff3b30).setOrigin(0, 0).setLineWidth(5).setVisible(false);
      const tint = this.add.rectangle(0, 0, 64, 64, 0xff3b30, 0.15).setVisible(false);
      root.add([halo, icon, frame, tint, x1, x2, selText]);
      frame.setInteractive({ useHandCursor: true });
      frame.on('pointerover', () => {
        this.customCursor = { row: 0, col: i };
        this.refreshCustom();
      });
      frame.on('pointerdown', (pointer) => {
        if (!this.customArmed) return;
        this.customCursor = { row: 0, col: i };
        if (pointer.rightButtonDown()) this.toggleCustomDiscard();
        else this.toggleCustomSelect();
        this.refreshCustom();
      });
      ui.add(root);
      this.customCards.push({ root, halo, frame, icon, selText, x1, x2, tint, baseX });
    }

    // Right column: selected chip info (image, name, desc, then OK button).
    // Shifted down a little for visual balance.
    // The art fits dynamically within 160x160, preserving aspect ratio.
    this.customDetailImage = this.add.image(265, 185, 'chip-empty');
    this.fitImageToArea(this.customDetailImage, 160, 160);
    this.customDetailName = this.add.text(265, 280, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#e8f6ff',
    }).setOrigin(0.5);
    this.customDetailDesc = this.add.text(265, 307, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#9fb3c8',
      wordWrap: { width: 190 }, align: 'center',
    }).setOrigin(0.5, 0);
    ui.add([this.customDetailImage, this.customDetailName, this.customDetailDesc]);

    // deck/discard/selected/marked indicators at the top of the window
    this.customCountsText = this.add.text(200, 55, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#9fb3c8',
    }).setOrigin(0.5);
    ui.add(this.customCountsText);

    // OK button: centered in the right column, under the chip info
    const okX = 265, okY = 410;
    this.customOkBg = this.add.rectangle(okX, okY, 110, 36, 0x0d1526)
      .setStrokeStyle(2, 0x00e5ff);
    this.customOkBg.setInteractive({ useHandCursor: true });
    this.customOkBg.on('pointerover', () => {
      this.customCursor = { row: 1, col: 0 };
      this.refreshCustom();
    });
    this.customOkBg.on('pointerdown', () => {
      if (!this.customArmed) return;
      this.confirmCustom();
    });
    this.customOkLabel = this.add.text(okX, okY, 'OK', {
      fontFamily: 'monospace', fontSize: '18px', color: '#e8f6ff',
    }).setOrigin(0.5);
    ui.add([this.customOkBg, this.customOkLabel]);

    // ---- Row 3: controls row ----
    ui.add(this.add.text(200, 490, 'up/down: move · Z/click: select · X/right-click: discard', {
      fontFamily: 'monospace', fontSize: '10px', color: '#9fb3c8',
    }).setOrigin(0.5));

    this.refreshCustom();
  }

  // Scale an image to fit within a max area, preserving aspect ratio.
  // Call after setTexture (reads the new texture's frame dimensions).
  fitImageToArea(image, maxW, maxH) {
    const scale = Math.min(maxW / image.width, maxH / image.height);
    image.setDisplaySize(image.width * scale, image.height * scale);
  }

  refreshCustom() {
    if (!this.customUI) return;
    // cards
    this.hand.forEach((chipId, i) => {
      const card = this.customCards[i];
      const isCursor = this.customCursor.row === 0 && this.customCursor.col === i;
      const selIdx = this.customSelected.indexOf(i);
      const marked = this.customDiscard.includes(i);
      const selected = selIdx >= 0;
      if (!chipId) {
        card.frame.setAlpha(0.3);
        card.icon.setVisible(false);
        card.halo.setVisible(isCursor);
        card.selText.setVisible(false);
        card.x1.setVisible(false); card.x2.setVisible(false); card.tint.setVisible(false);
        this.tweens.killTweensOf(card.root);
        card.root.x = card.baseX;
      } else {
        card.frame.setAlpha(1);
        card.icon.setVisible(true).setTexture(`chip-${chipId}-small`).setDisplaySize(44, 44);
        card.halo.setVisible(isCursor);
        card.selText.setVisible(selected).setText(selected ? `${selIdx + 1}→` : '');
        card.tint.setVisible(marked);
        card.x1.setVisible(marked); card.x2.setVisible(marked);
        // slide: selected -> right, marked -> left
        const targetX = card.baseX + (selected ? 14 : 0) + (marked ? -14 : 0);
        if (card.root.x !== targetX) {
          this.tweens.killTweensOf(card.root);
          this.tweens.add({ targets: card.root, x: targetX, duration: 150, ease: 'Quad.easeOut' });
        }
      }
      // detail panel follows the highlighted chip
      if (isCursor && chipId) {
        const chip = CHIP_MAP[chipId];
        this.customDetailImage.setTexture(`chip-${chipId}`).setVisible(true);
        this.fitImageToArea(this.customDetailImage, 160, 160);
        this.customDetailName.setText(chip.name);
        this.customDetailDesc.setText(chip.desc);
      }
    });
    // OK button highlight
    const okCursor = this.customCursor.row === 1;
    this.customOkBg.setStrokeStyle(2, okCursor ? 0xffffff : 0x00e5ff);
    this.customOkLabel.setColor(okCursor ? '#ffffff' : '#e8f6ff');
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

  // Dissolve a sprite into pixel chunks when it's deleted. Chunks start at
  // their original positions (intact sprite), lerp outward top-to-bottom,
  // then delete top-to-bottom with a flicker. Positions use the sprite's
  // DISPLAYED bounds (displayWidth/Height), not scale math, so the manual
  // 0.5 scale can't double the spacing.
  dissolveSprite(sprite, onDone) {
    const DURATION = 700;
    const TARGET_PX = 10;

    const frame = sprite.frame;
    const fw = frame.width, fh = frame.height;
    const dispW = sprite.displayWidth, dispH = sprite.displayHeight;
    const cols = Phaser.Math.Clamp(Math.round(dispW / TARGET_PX), 3, 30);
    const rows = Phaser.Math.Clamp(Math.round(dispH / TARGET_PX), 3, 30);
    const cw = fw / cols, ch = fh / rows; // texture px per chunk
    const chunkW = dispW / cols, chunkH = dispH / rows; // screen px per chunk
    const ox = sprite.x, oy = sprite.y; // bottom-center (origin 0.5,1)
    const key = sprite.texture.key;
    const depth = sprite.depth;
    const scaleX = sprite.scaleX, scaleY = sprite.scaleY;

    sprite.setVisible(false);

    const chunks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // center of chunk (c,r) in screen coords, tiling the display bounds
        const cx = ox - dispW / 2 + (c + 0.5) * chunkW;
        const cy = oy - dispH + (r + 0.5) * chunkH;
        const img = this.add.image(cx, cy, key);
        img.setOrigin(0.5, 0.5).setScale(scaleX, scaleY).setDepth(depth + 1);
        img.setCrop(c * cw, r * ch, cw, ch);
        const scatterAt = (r / rows) * 0.45 + Math.random() * 0.15;
        const dissolveAt = scatterAt + 0.2 + Math.random() * 0.2;
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 18;
        chunks.push({
          img, ox: cx, oy: cy,
          dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist - 12,
          scatterAt, dissolveAt,
        });
      }
    }

    const progress = { t: 0 };
    this.tweens.add({
      targets: progress, t: 1, duration: DURATION, ease: 'Quad.easeIn',
      onUpdate: () => {
        for (const ch of chunks) {
          if (progress.t < ch.scatterAt) {
            ch.img.setPosition(ch.ox, ch.oy);
            ch.img.setAlpha(1).setVisible(true);
          } else if (progress.t < ch.dissolveAt) {
            const k = (progress.t - ch.scatterAt) / (ch.dissolveAt - ch.scatterAt);
            const e = k * k;
            ch.img.setPosition(ch.ox + ch.dx * e, ch.oy + ch.dy * e);
            ch.img.setAlpha(1 - e * 0.4).setVisible(true);
          } else {
            const d = progress.t - ch.dissolveAt;
            ch.img.setVisible(d < 0.06 && Math.random() > 0.5);
          }
        }
      },
      onComplete: () => {
        for (const ch of chunks) ch.img.destroy();
        if (onDone) onDone();
      },
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
    for (const e of this.enemies) {
      const manual = e.type === 'pumpkin' ? BOSS_MANUAL : MANDRAKE_MANUAL * (e.big ? 1.35 : 1);
      if (e.type === 'mandrake' && !e.sprite.visible) continue;
      this.placeFighter(e.sprite, e.col, e.row, manual);
      if (e.type === 'mandrake') {
        const mp = tileFeet(e.col, e.row);
        e.mound.setPosition(mp.x, mp.y - 8).setScale(mp.s).setDepth(9 + e.row);
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
      this.chipIcons.push({ frame, icon, label });
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
    this.chipIcons.forEach(({ frame, icon }, i) => {
      const id = this.loadout[i];
      const loaded = !!id;
      // only loaded chips get the chip frame; empty slots show the placeholder
      frame.setVisible(loaded);
      // NB: setTexture keeps the old scale, so re-apply the display size
      // every time (small chip art is 96x96, empty slot is 48x48).
      icon.setTexture(loaded ? `chip-${id}-small` : 'chip-empty').setDisplaySize(30, 30);
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
    this.chipIcons.forEach(({ frame, icon }, s) => {
      this.tweens.killTweensOf([frame, icon]);
      const targetX = 420 + s * 70;
      if (s >= i && this.loadout[s]) {
        frame.x = targetX + 70; icon.x = targetX + 70;
        this.tweens.add({ targets: [frame, icon], x: targetX, duration: 160, ease: 'Quad.easeOut' });
      } else {
        frame.x = targetX; icon.x = targetX;
      }
    });
  }

  // Buster: instant hitscan down the navi's row — no projectile. Hits the
  // first enemy ahead; shows the punch frame + a muzzle flash.
  fireShoot(time) {
    if (time < this.shootReadyAt) return;
    this.shootReadyAt = time + 300;
    this.showPunchFrame();
    const row = this.naviPos.row;
    const s = this.navi.scaleX;
    const mx = this.navi.x + 45 * s, my = this.navi.y - 115 * s;
    this.showMuzzleFlash(mx, my, row);
    // first alive enemy ahead on the navi's row (any type)
    let target = null, targetCol = 99;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.type === 'mandrake' && e.state !== 'emerged') continue;
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
    if (target) { this.damageEnemy(target, 10); this.flash(target.sprite, 0xfff176); }
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
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.type === 'mandrake' && e.state !== 'emerged') continue;
        if (target.col === e.col && target.row === e.row) {
          this.damageEnemy(e, chip.damage);
        }
      }
      // sword arc flash on the target tile
      const arc = this.highlightTile(target.col, target.row, chip.color, 0.35);
      this.time.delayedCall(140, () => arc.destroy());
      return;
    }

    if (chip.id === 'railgun') {
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
        if (e.type === 'mandrake' && e.state !== 'emerged') continue;
        if (e.row === row && e.col > this.naviPos.col) {
          this.damageEnemy(e, chip.damage);
          this.flash(e.sprite, chip.color);
        }
      }
      return;
    }

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
  }

  // Tile-based projectile collision (not sprite boxes): a projectile hits
  // only if it's on the enemy's row and overlapping the enemy's tile.
  projOverlapsTile(proj, col, row) {
    if (proj.getData('row') !== row) return false;
    const corners = tileCorners(col, row);
    const xs = corners.map((p) => p.x);
    const leftX = Math.min(...xs), rightX = Math.max(...xs);
    const px = proj.x, rad = 10;
    return px + rad >= leftX && px - rad <= rightX;
  }

  updateProjectiles(delta) {
    const dt = delta / 1000;
    for (const proj of [...this.projectiles.getChildren()]) {
      if (!proj.active) continue;
      proj.x += proj.getData('vx') * dt;
      if (proj.x > 1020) { proj.destroy(); continue; }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.type === 'mandrake' && e.state !== 'emerged') continue;
        if (this.projOverlapsTile(proj, e.col, e.row)) {
          this.damageEnemy(e, proj.getData('damage'));
          proj.destroy();
          break;
        }
      }
    }
  }

  // ================= enemy AI =================

  updateEnemies(time) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.type === 'pumpkin') this.pumpkinAI(e, time);
      else if (e.type === 'mandrake') this.mandrakeAI(e, time);
      else if (e.type === 'skitterbug') this.skitterbugAI(e, time);
      else if (e.type === 'sentry') this.sentryAI(e, time);
    }
  }

  bossPhase(enemy) {
    const frac = enemy.hp / enemy.maxHp;
    if (frac < 0.3) return BOSS.phases[2]; // Harvest
    if (frac < 0.6) return BOSS.phases[1];  // Vine
    return BOSS.phases[0];                  // Sprout
  }

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

  // ================= mandrake AI =================

  mandrakeAI(md, time) {
    if (!md.alive || time < md.timer) return;
    const manual = MANDRAKE_MANUAL * (md.big ? 1.35 : 1);

    if (md.state === 'burrowed') {
      // start telegraph: flash its tile
      md.state = 'telegraph';
      md.timer = time + M.telegraphMs;
      md.warnRect = this.highlightTile(md.col, md.row, 0xba68c8, 0.45);
      this.tweens.add({ targets: md.warnRect, alpha: 0.1, duration: 120, yoyo: 5 });
    } else if (md.state === 'telegraph') {
      // EMERGE
      if (md.warnRect) { md.warnRect.destroy(); md.warnRect = null; }
      md.state = 'emerged';
      md.timer = time + M.emergedMs;
      md.mound.setVisible(false);
      md.sprite.setVisible(true);
      this.placeFighter(md.sprite, md.col, md.row, manual);
      const targetScale = md.sprite.scaleX;
      md.sprite.setScale(targetScale * 0.18);
      this.tweens.add({ targets: md.sprite, scaleX: targetScale, scaleY: targetScale, duration: 180, ease: 'Back.easeOut' });
      if (!this.mandrakeGagged) {
        this.mandrakeGagged = true;
        this.startDialogue(SCRIPTS.mandrakeGag);
      }
    } else if (md.state === 'emerged') {
      // SCREAM — row-wide noise attack
      md.state = 'burrowed';
      md.timer = time + M.burrowedMs;
      const rowC = tileCenter(md.col, md.row);
      // scream wave visual across the row, following the perspective
      const left = project(0, md.row + 0.5);
      const right = project(6, md.row + 0.5);
      const wave = this.add.rectangle((left.x + right.x) / 2, rowC.y, right.x - left.x, 40, 0xba68c8, 0.35);
      wave.setDepth(10 + md.row); // above the floor, ordered by row
      this.tweens.add({ targets: wave, alpha: 0, x: left.x - 40, duration: 350,
        onComplete: () => wave.destroy() });
      this.add.text(rowC.x, rowC.y - 70, 'KYAAAH!!', {
        fontFamily: 'monospace', fontSize: '22px', color: '#ba68c8',
      }).setOrigin(0.5).setDepth(10 + md.row).setName('screamText');
      this.time.delayedCall(600, () => {
        const t = this.children.getByName('screamText');
        if (t) t.destroy();
      });
      if (this.naviPos.row === md.row) {
        this.damageNavi(M.screamDamage);
      }
      // burrow at a new random enemy tile
      md.sprite.setVisible(false);
      md.col = Phaser.Math.Between(3, 5);
      md.row = Phaser.Math.Between(0, ROWS - 1);
      const np = tileFeet(md.col, md.row);
      md.mound.setPosition(np.x, np.y - 8).setVisible(true);
      md.mound.setDepth(9 + md.row).setScale(np.s);
    }
  }

  // ================= skitterbug AI =================
  // Slow cycle: move, spit, move, spit...
  // Each check: if the navi is on our row and we can spit -> spit.
  // Otherwise move (up/down by intent). Can't spit twice without moving.

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
    this.teleportMove(e.sprite, e.col, e.row, SKITTER_MANUAL, () => {
      // refresh base scale after the move (perspective may differ by row)
      e.baseScaleX = e.sprite.scaleX;
      e.baseScaleY = e.sprite.scaleY;
    });
    e.canSpit = true; // moving restores the spit
  }

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

    // sensor light flashes red for slightly less than a second
    e.sensor.setVisible(true);
    e.sensor.setAlpha(1);
    this.tweens.add({
      targets: e.sensor, alpha: 0.15, duration: 100, yoyo: true, repeat: 7,
    });

    this.time.delayedCall(SENTRY.telegraphMs, () => {
      if (!e.alive || this.over) { e.state = 'ready'; e.sensor.setVisible(false); return; }
      this.fireSentryLaser(e);
      e.state = 'cooldown';
      e.cooldownUntil = this.time.now + SENTRY.cooldownMs;
      e.sensor.setVisible(false);
    });
  }

  fireSentryLaser(e) {
    // Instant piercing hitscan (like the railgun chip, but firing left at
    // the navi). Mouth splits open (squash) as it fires.
    const s = e.sprite;
    const bx = s.scaleX, by = s.scaleY;
    this.tweens.add({
      targets: s, scaleX: bx * 1.1, scaleY: by * 0.85, duration: 80, yoyo: true,
      onComplete: () => { if (s.active) s.setScale(bx, by); },
    });

    // red beam from the sentry leftwards across its row
    const p = tileCenter(e.col, e.row);
    const beam = this.add.line(0, 0, 30, p.y, p.x - 20, p.y, 0xff3b30).setOrigin(0, 0);
    beam.setLineWidth(6).setAlpha(0.95);
    beam.setDepth(10 + e.row);
    this.tweens.add({ targets: beam, alpha: 0, duration: 160, onComplete: () => beam.destroy() });

    // hitscan: if the navi is on the row when it fires, she takes the hit
    if (this.naviPos.row === e.row) {
      this.damageNavi(SENTRY.laserDamage);
      this.flash(this.navi, 0xff3b30);
    }
  }

  spitIchor(e) {
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
  }

  spawnIchorBullet(e) {
    const p = tileCenter(e.col, e.row);
    const bullet = this.add.circle(p.x - 20, p.y, 8, SKITTER.bulletColor);
    bullet.setDepth(10 + e.row);
    bullet.setData('vx', -SKITTER.bulletSpeed);
    bullet.setData('row', e.row);
    this.enemyProjectiles.add(bullet);
    this.tweens.add({ targets: bullet, scaleX: 1.4, scaleY: 1.4, duration: 120, yoyo: true });
  }

  updateEnemyProjectiles(delta) {
    const dt = delta / 1000;
    for (const b of [...this.enemyProjectiles.getChildren()]) {
      if (!b.active) continue;
      b.x += b.getData('vx') * dt;
      if (b.x < -20) { b.destroy(); continue; }
      // hits the navi if on her row and overlapping her tile
      if (b.getData('row') === this.naviPos.row
        && this.projOverlapsTile(b, this.naviPos.col, this.naviPos.row)) {
        this.damageNavi(SKITTER.bulletDamage);
        b.destroy();
      }
    }
  }

  // ================= damage =================

  flash(target, color) {
    target.setTintFill(color);
    this.time.delayedCall(120, () => { if (target.active) target.clearTint(); });
  }

  damageEnemy(e, amount) {
    if (!e.alive) return;
    e.hp = Math.max(0, e.hp - amount);
    this.flash(e.sprite, 0xffffff);
    this.updateHpBar(e);
    if (e.hp <= 0) {
      e.alive = false;
      if (e.warnRect) { e.warnRect.destroy(); e.warnRect = null; }
      if (e.mound) e.mound.setVisible(false);
      if (e.sensor) { this.tweens.killTweensOf(e.sensor); e.sensor.setVisible(false); }
      this.tweens.killTweensOf(e.sprite); // stop idle/shoot tweens
      if (e.bobTween) e.bobTween.stop(); // stop the infinite idle bob
      // dissolve top-to-bottom (replaces the old grow+fade)
      this.dissolveSprite(e.sprite);
      this.updateHpBar(e); // hides the bar
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
    if (this.naviHp <= 0) {
      this.startDialogue(SCRIPTS.defeat, () => this.showGameOver());
      return;
    }
    if (this.enemies.every((e) => !e.alive)) {
      this.showVictory();
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
    // R retries the current battle, not the whole run
    this.input.keyboard.once('keydown-R', () => this.scene.restart({ battleIndex: this.battleIndex }));
  }

  showVictory() {
    this.over = true;
    const battle = BATTLES[this.battleIndex];
    this.add.text(480, 250, 'VIRUS DELETED', {
      fontFamily: 'monospace', fontSize: '56px', color: '#81c784',
    }).setOrigin(0.5).setDepth(100);
    this.add.text(480, 320, `${battle.name} busted!`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
    }).setOrigin(0.5).setDepth(100);
    const isLast = this.battleIndex >= BATTLES.length - 1;
    this.add.text(480, 360, isLast ? 'thanks for playing! 🎃' : 'press Z to continue', {
      fontFamily: 'monospace', fontSize: '18px', color: '#9fb3c8',
    }).setOrigin(0.5).setDepth(100);
    if (isLast) return;
    // victory screen -> story segment -> next battle
    const advance = (e) => {
      if (e.code !== 'KeyZ' && e.code !== 'Space' && e.code !== 'Enter') return;
      this.input.keyboard.off('keydown', advance);
      this.startDialogue(battle.victory, () => {
        this.startDialogue(battle.story, () => {
          this.scene.restart({ battleIndex: this.battleIndex + 1 });
        });
      });
    };
    this.input.keyboard.on('keydown', advance);
  }
}
