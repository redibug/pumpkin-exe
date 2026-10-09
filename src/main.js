import Phaser from 'phaser';
import TitleScene from './scenes/TitleScene.js';
import BattleScene from './scenes/BattleScene.js';

export const GAME_W = 960;
export const GAME_H = 540;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#05060f',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [TitleScene, BattleScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
