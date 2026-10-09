// dialogue.js — MMBN-style dialogue system (jam day 1).
//
// A text window slides in at the top of the screen; text appears teletype-
// style with a per-character mugshot on the configured side. While a script
// is playing, BattleScene pauses the game (physics, tweens, timers, anims)
// and routes update() to the dialogue instead.
//
// Script format: [{ speaker: 'bugchan', text: '...' }, ...]
// Advance: SPACE / ENTER / Z / click. First press completes the line.

export const CHARACTERS = {
  bugchan:  { name: 'Bugchan',       mugshot: 'mug-bugchan',  side: 'left',  color: '#ff9ecf' },
  mel:      { name: 'Mel',           mugshot: null,           side: 'left',  color: '#e8f6ff' },
  pumpkin:  { name: 'PUMPKIN.EXE',   mugshot: 'mug-pumpkin',  side: 'right', color: '#ffb74d' },
  mandrake: { name: 'RUTABAGA.MND',  mugshot: 'mug-mandrake', side: 'right', color: '#ce93d8' },
};

const CPS = 48; // teletype characters per second
const PANEL = { x: 40, y: 14, w: 880, h: 140 };
const MUG_SIZE = 104;
const MUG_MARGIN = 14;
const FONT = 'monospace';

export class DialogueUI {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.script = [];
    this.lineIndex = -1;
    this.fullText = '';
    this.shown = 0;
    this.blink = 0;

    const c = this.container = scene.add.container(0, 0).setDepth(1000).setVisible(false);

    // panel
    const g = scene.add.graphics();
    g.fillStyle(0x0a0f1e, 0.96);
    g.fillRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 10);
    g.lineStyle(2, 0x4fc3f7, 1);
    g.strokeRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 10);
    c.add(g);

    // mugshot frame + image (repositioned per speaker side)
    this.mugFrame = scene.add.graphics();
    c.add(this.mugFrame);
    this.mug = scene.add.image(0, 0, 'mug-bugchan').setDisplaySize(MUG_SIZE, MUG_SIZE);
    c.add(this.mug);

    // speaker name + body text
    this.nameText = scene.add.text(0, PANEL.y + 14, '', {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff',
    });
    c.add(this.nameText);
    this.bodyText = scene.add.text(0, PANEL.y + 44, '', {
      fontFamily: FONT, fontSize: '16px', color: '#e8f6ff',
      wordWrap: { width: 700 },
    });
    c.add(this.bodyText);

    // "more" indicator
    this.hint = scene.add.text(PANEL.x + PANEL.w - 28, PANEL.y + PANEL.h - 28, '▼', {
      fontFamily: FONT, fontSize: '18px', color: '#4fc3f7',
    }).setVisible(false);
    c.add(this.hint);

    // advance input
    scene.input.keyboard.on('keydown-SPACE', () => this.advance());
    scene.input.keyboard.on('keydown-ENTER', () => this.advance());
    scene.input.keyboard.on('keydown-Z', () => this.advance());
    scene.input.on('pointerdown', () => this.advance());
  }

  isActive() {
    return this.active;
  }

  start(script, onDone) {
    this.script = script;
    this.onDone = onDone || null;
    this.lineIndex = -1;
    this.active = true;
    this.container.setVisible(true);
    this.nextLine();
  }

  layoutFor(side, hasMug) {
    const cy = PANEL.y + PANEL.h / 2;
    if (hasMug && side === 'left') {
      const mx = PANEL.x + MUG_MARGIN + MUG_SIZE / 2;
      this.mug.setPosition(mx, cy).setVisible(true);
      this.mugFrame.clear();
      this.mugFrame.lineStyle(2, 0x4fc3f7, 1);
      this.mugFrame.strokeRect(mx - MUG_SIZE / 2 - 4, cy - MUG_SIZE / 2 - 4, MUG_SIZE + 8, MUG_SIZE + 8);
      this.mugFrame.setVisible(true);
      const tx = PANEL.x + MUG_MARGIN * 2 + MUG_SIZE + 8;
      this.nameText.setX(tx);
      this.bodyText.setX(tx).setWordWrapWidth(PANEL.x + PANEL.w - MUG_MARGIN - tx);
    } else if (hasMug) {
      const mx = PANEL.x + PANEL.w - MUG_MARGIN - MUG_SIZE / 2;
      this.mug.setPosition(mx, cy).setVisible(true);
      this.mugFrame.clear();
      this.mugFrame.lineStyle(2, 0x4fc3f7, 1);
      this.mugFrame.strokeRect(mx - MUG_SIZE / 2 - 4, cy - MUG_SIZE / 2 - 4, MUG_SIZE + 8, MUG_SIZE + 8);
      this.mugFrame.setVisible(true);
      const tx = PANEL.x + MUG_MARGIN;
      this.nameText.setX(tx);
      this.bodyText.setX(tx).setWordWrapWidth(mx - MUG_SIZE / 2 - MUG_MARGIN - tx);
    } else {
      this.mug.setVisible(false);
      this.mugFrame.setVisible(false);
      const tx = PANEL.x + MUG_MARGIN + 8;
      this.nameText.setX(tx);
      this.bodyText.setX(tx).setWordWrapWidth(PANEL.x + PANEL.w - MUG_MARGIN - tx);
    }
  }

  nextLine() {
    this.lineIndex++;
    if (this.lineIndex >= this.script.length) {
      this.finish();
      return;
    }
    const { speaker, text } = this.script[this.lineIndex];
    const ch = CHARACTERS[speaker] || CHARACTERS.mel;
    this.fullText = text;
    this.shown = 0;
    this.mug.setTexture(ch.mugshot || 'mug-bugchan');
    this.layoutFor(ch.side, !!ch.mugshot);
    this.nameText.setText(ch.name).setColor(ch.color);
    this.bodyText.setText('');
    this.hint.setVisible(false);
  }

  update(delta) {
    if (!this.active) return;
    if (this.shown < this.fullText.length) {
      this.shown = Math.min(this.fullText.length, this.shown + (delta / 1000) * CPS);
      this.bodyText.setText(this.fullText.slice(0, Math.floor(this.shown)));
      if (this.shown >= this.fullText.length) this.hint.setVisible(true);
    } else {
      // blink the "more" arrow
      this.blink += delta;
      this.hint.setAlpha(0.35 + 0.65 * Math.abs(Math.sin(this.blink / 280)));
    }
  }

  advance() {
    if (!this.active) return;
    if (this.shown < this.fullText.length) {
      this.shown = this.fullText.length;
      this.bodyText.setText(this.fullText);
      this.hint.setVisible(true);
    } else {
      this.nextLine();
    }
  }

  finish() {
    this.active = false;
    this.container.setVisible(false);
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  }
}

// ---- battle scripts (Mel: edit freely, simple words, short lines) ----
export const SCRIPTS = {
  intro: [
    { speaker: 'mel', text: 'Bugchan, I jacked you into the cyberworld. Something is wrong in there...' },
    { speaker: 'bugchan', text: 'Whoa! Pumpkins everywhere! And they look mad!' },
    { speaker: 'pumpkin', text: 'I AM PUMPKIN.EXE! THIS HARVEST IS MINE, LITTLE BUG!' },
    { speaker: 'bugchan', text: 'Not on my watch! Mel, send chips! I will debug this gourd!' },
  ],
  mandrakeGag: [
    { speaker: 'mandrake', text: 'KYAAAH!!' },
    { speaker: 'bugchan', text: "Phew... smells like grandma's root cellar in here!" },
  ],
  victory: [
    { speaker: 'pumpkin', text: 'NO... MY HARVEST... ROTTING...' },
    { speaker: 'bugchan', text: 'Virus deleted! Good work, Mel!' },
  ],
  defeat: [
    { speaker: 'bugchan', text: 'Ow... I need to reboot... sorry, Mel...' },
    { speaker: 'mel', text: "It's okay, Bugchan. Jack out. We'll try again." },
  ],
};
