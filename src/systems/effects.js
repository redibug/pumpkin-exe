// Visual effects: teleport, dissolve, hit flash, tile highlight.
// Mixed into BattleScene via Object.assign, so `this` is the scene.
import Phaser from 'phaser';
import { tileCorners } from './grid.js';
import { sound } from './sound.js';

export const EffectsMethods = {
  teleportMove(sprite, col, row, manual, onDone) {
    sound.teleport();
    if (sprite.getData('teleporting')) {
      this.placeFighter(sprite, col, row, manual); // fallback: instant pop
      if (onDone) onDone();
      return;
    }
    sprite.setData('teleporting', true);
    this.playTeleportFrames(sprite, 'out', () => {
      // abort if the sprite died mid-teleport
      if (!sprite.getData('teleporting')) return;
      this.placeFighter(sprite, col, row, manual);
      this.playTeleportFrames(sprite, 'in', () => {
        sprite.setData('teleporting', false);
        if (onDone) onDone();
      });
    });
  },
  dissolveSprite(sprite, onDone) {
    const DURATION = 700;
    const TARGET_PX = 10;

    const frame = sprite.frame;
    const fw = frame.width, fh = frame.height;
    // Use the sprite's actual displayed bounds (accounts for origin, scale)
    const bounds = sprite.getBounds();
    const dispW = bounds.width, dispH = bounds.height;
    const cols = Phaser.Math.Clamp(Math.round(dispW / TARGET_PX), 3, 30);
    const rows = Phaser.Math.Clamp(Math.round(dispH / TARGET_PX), 3, 30);
    // Exact fractional source size; canvas uses rounded integers, and the
    // image scale is adjusted to compensate so chunks tile exactly.
    const cwSrc = fw / cols, chSrc = fh / rows;
    const cw = Math.max(1, Math.round(cwSrc)), ch = Math.max(1, Math.round(chSrc));
    const chunkW = dispW / cols, chunkH = dispH / rows;
    const adjX = cwSrc / cw, adjY = chSrc / ch; // scale correction
    const key = sprite.texture.key;
    const depth = sprite.depth;
    const scaleX = sprite.scaleX * adjX, scaleY = sprite.scaleY * adjY;
    const srcImg = sprite.texture.getSourceImage();

    sprite.setVisible(false);

    const chunks = [];
    const texPrefix = `dissolve-${key}-${Phaser.Utils.String.UUID().slice(0, 8)}`;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // bake the chunk region into its own texture
        const ck = `${texPrefix}-${c}-${r}`;
        const tex = this.textures.createCanvas(ck, cw, ch);
        const ctx = tex.getContext();
        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(srcImg, c * cwSrc, r * chSrc, cwSrc, chSrc, 0, 0, cw, ch);
        tex.refresh();

        const cx = bounds.x + (c + 0.5) * chunkW;
        const cy = bounds.y + (r + 0.5) * chunkH;
        const img = this.add.image(cx, cy, ck);
        img.setOrigin(0.5, 0.5).setScale(scaleX, scaleY).setDepth(depth + 1);

        const scatterAt = (r / rows) * 0.45 + Math.random() * 0.15;
        const dissolveAt = scatterAt + 0.2 + Math.random() * 0.2;
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 18;
        chunks.push({
          img, texKey: ck, ox: cx, oy: cy,
          dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist - 12,
          scatterAt, dissolveAt,
        });
      }
    }

    const progress = { t: 0 };
    const tw = this.tweens.add({
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
        for (const ch of chunks) {
          ch.img.destroy();
          this.textures.remove(ch.texKey);
        }
        if (onDone) onDone();
      },
    });
    // Delete animations don't affect game timing; keep playing during dialogue.
    tw._noPause = true;
  },
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
      // abort if the sprite died mid-teleport (damageEnemy clears the flag)
      if (!sprite.getData('teleporting')) {
        objs.forEach((o) => { if (o.active) o.destroy(); });
        return;
      }
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
    // store strips so damageEnemy can clean them up if the sprite dies
    sprite.setData('teleportObjs', objs);
    tick();
  },
  highlightTile(c, r, color, alpha = 0.4) {
    const g = this.add.graphics().setDepth(5);
    const [tl, tr, br, bl] = tileCorners(c, r);
    g.fillStyle(color, alpha);
    g.fillPoints([tl, tr, br, bl], true);
    g.lineStyle(3, color, 1);
    g.strokePoints([tl, tr, br, bl, tl].map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
    return g;
  },
  flash(target, color) {
    target.setTintFill(color);
    // Use a tween (not delayedCall) so the flash isn't frozen by time.paused.
    // Marked _noPause so it continues during dialogue.
    const tw = this.tweens.add({
      targets: {},
      duration: 120,
      onComplete: () => { if (target.active) target.clearTint(); },
    });
    tw._noPause = true;
  },
  playSwordSlash(x, y, color = 0x4fc3f7, scale = 1) {
    // Crescent slash arc: draws in fast, fades out. Additive for glow.
    const g = this.add.graphics();
    g.lineStyle(10, color, 1);
    // arc from upper-right sweeping to lower-left (a backhand slash)
    const r = 55;
    g.arc(0, 0, r, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(50), false);
    g.strokePath();
    // inner bright core
    g.lineStyle(4, 0xffffff, 0.9);
    g.arc(0, 0, r, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(50), false);
    g.strokePath();
    g.setPosition(x, y);
    g.setScale(scale);
    g.setDepth(25);
    g.setBlendMode(Phaser.BlendModes.ADD);
    g.setAlpha(0);
    // slash in: scale up + fade in fast, then fade out
    this.tweens.add({
      targets: g, alpha: 1, scaleX: scale * 1.15, scaleY: scale * 1.15,
      duration: 70, ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: g, alpha: 0,
          duration: 130, ease: 'Quad.easeIn',
          onComplete: () => { if (g.active) g.destroy(); },
        });
      },
    });
    return g;
  },
  playExplosion(x, y, scale = 1, depth = 20) {
    // Sprite-sheet explosion: 8 frames, additive blend for glow.
    const spr = this.add.sprite(x, y, 'explosion', 0);
    spr.setDepth(depth);
    spr.setScale(scale);
    spr.setBlendMode(Phaser.BlendModes.ADD);
    // Step through frames manually for precise timing
    const frameTime = 50; // ms per frame = 400ms total
    let frame = 0;
    const timer = this.time.addEvent({
      delay: frameTime, repeat: 7,
      callback: () => {
        frame++;
        if (frame < 8 && spr.active) {
          spr.setFrame(frame);
        } else {
          timer.remove();
          if (spr.active) spr.destroy();
        }
      },
    });
    return spr;
  }
};
