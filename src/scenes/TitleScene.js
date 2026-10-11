import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../main.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  preload() {
    this.load.audio('mus-title', 'assets/audio/Jam Network Title Theme.mp3');
  }

  create() {
    this.events.once('shutdown', () => {
      if (this._titleMus) { this._titleMus.stop(); this._titleMus.destroy(); this._titleMus = null; }
    });
    // title music (starts on first interaction to satisfy autoplay policy)
    const startMus = () => {
      if (!this._musStarted) {
        this._musStarted = true;
        this._titleMus = this.sound.add('mus-title', { loop: true, volume: 0.4 });
        this._titleMus.play();
      }
    };
    this.input.once('pointerdown', startMus);
    this.input.keyboard.once('keydown', startMus);
    // also catch clicks anywhere on the page (outside the canvas)
    const pageClick = () => { startMus(); document.removeEventListener('pointerdown', pageClick); };
    document.addEventListener('pointerdown', pageClick);
    this.events.once('shutdown', () => document.removeEventListener('pointerdown', pageClick));
    const { width, height } = this.scale;
    const cx = width / 2;

    // Animated background: dark gradient + drifting particles
    this.cameras.main.setBackgroundColor('#0a0a1a');
    // floating ember particles
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const p = this.add.circle(x, y, Phaser.Math.Between(1, 3), 0xff9e2c, 0.3);
      this.tweens.add({
        targets: p,
        y: y - Phaser.Math.Between(50, 150),
        x: x + Phaser.Math.Between(-30, 30),
        alpha: 0,
        duration: Phaser.Math.Between(2000, 5000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
        onRepeat: () => {
          p.setPosition(Phaser.Math.Between(0, width), height + 10);
          p.setAlpha(0.3);
        },
      });
    }

    // "JAM NETWORK" header
    this.add.text(cx, height / 2 - 140, 'JAM NETWORK', {
      fontFamily: 'monospace', fontSize: '28px', color: '#7fd4ff',
      letterSpacing: 8,
    }).setOrigin(0.5);

    // Main title with glow
    const title = this.add.text(cx, height / 2 - 70, 'PUMPKIN.EXE', {
      fontFamily: 'monospace', fontSize: '72px', color: '#ff9e2c',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    // glow via shadow
    title.setShadow(0, 0, '#ff6f00', 20, true, true);
    // subtle pulse
    this.tweens.add({
      targets: title, scale: 1.03, duration: 1200, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Decorative divider
    this.add.text(cx, height / 2 - 20, '━'.repeat(24), {
      fontFamily: 'monospace', fontSize: '16px', color: '#3a3a5a',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(cx, height / 2 + 10, 'a net battle in one haunted server', {
      fontFamily: 'monospace', fontSize: '18px', color: '#9dbb2e', fontStyle: 'italic',
    }).setOrigin(0.5);

    // Press start (blinking)
    const start = this.add.text(cx, height / 2 + 80, '[ PRESS ENTER TO LOG IN ]', {
      fontFamily: 'monospace', fontSize: '22px', color: '#e8f6ff',
    }).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    // Footer: controls hint
    this.add.text(cx, height - 40, 'Arrows/WASD move · X buster · Z chip · SHIFT custom · Gamepad supported', {
      fontFamily: 'monospace', fontSize: '13px', color: '#5a5a7a',
    }).setOrigin(0.5);

    // Version
    this.add.text(width - 16, height - 16, 'v1.0 jam build', {
      fontFamily: 'monospace', fontSize: '12px', color: '#3a3a5a',
    }).setOrigin(1, 1);

    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Battle'));
    // note: click only starts the music (not the game) so the title theme is audible
  }

  update() {
    // gamepad: Start (9) or A (0) to start
    const pads = this.input.gamepad?.gamepads;
    if (!pads) return;
    for (const p of pads) {
      if (p && p.connected && (p.buttons[9]?.pressed || p.buttons[0]?.pressed)) {
        this.scene.start('Battle');
        break;
      }
    }
  }
}
