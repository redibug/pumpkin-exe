import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../main.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2 - 60, 'PUMPKIN.EXE', {
      fontFamily: 'monospace', fontSize: '64px', color: '#ff9e2c',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 10, 'a net battle in one haunted server', {
      fontFamily: 'monospace', fontSize: '18px', color: '#7fd4ff',
    }).setOrigin(0.5);

    const start = this.add.text(width / 2, height / 2 + 80, '[ PRESS ENTER TO LOG IN ]', {
      fontFamily: 'monospace', fontSize: '22px', color: '#e8f6ff',
    }).setOrigin(0.5);

    this.tweens.add({ targets: start, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Battle'));
    this.input.once('pointerdown', () => this.scene.start('Battle'));
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
