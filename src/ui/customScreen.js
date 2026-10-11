// Custom screen UI: chip selection between battles.
// Mixed into BattleScene via Object.assign, so `this` is the scene.
import Phaser from 'phaser';
import { CHIP_MAP } from '../data/chips.js';
import { sound } from '../systems/sound.js';

export const CUSTOM_GAUGE_MS = 10000; // battle time to fill the custom gauge
export const HAND_MAX = 5;            // chip-case slots in the custom screen
export const LOADOUT_MAX = 4;         // selected cards -> the 1-4 chip slots

export const CustomScreenMethods = {
  openCustom(skipKeyGuard = false) {
    sound.customOpen();
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
  },
  drawToHand() {
    sound.chipSelect();
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
  },
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
  },
  activateCustomCursor() {
    sound.cursorMove();
    const cur = this.customCursor;
    if (cur.row === 0) {
      this.toggleCustomSelect();
      this.refreshCustom();
    } else {
      this.confirmCustom();
    }
  },
  toggleCustomSelect() {
    sound.chipSelect();
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
  },
  toggleCustomDiscard() {
    sound.chipSelect();
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
  },
  confirmCustom() {
    sound.chipConfirm();
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
    this.chipAmmo = [null, null, null, null];
    this.rapidFiring = null;
    picked.forEach((id, s) => { this.loadout[s] = id; });
    // picked + tossed cards leave their slots empty (chip case keeps position)
    const gone = new Set([...this.customSelected, ...this.customDiscard]);
    gone.forEach((i) => { this.hand[i] = null; });
    this.updateLoadoutHud();
    this.closeCustomUI();
  },
  cancelCustom() {
    sound.chipCancel();
    this.closeCustomUI(); // gauge stays spent, loadout unchanged
  },
  closeCustomUI() {
    sound.customClose();
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
    // Grace period: bomb spiders restart their move cycle after the custom
    // screen (don't throw immediately)
    for (const e of this.enemies) {
      if (e.type === 'bombspider' && e.alive) {
        e.movesDone = 0;
        e.nextMove = this.time.now + 2000;
      }
    }
  },
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
  },
  fitImageToArea(image, maxW, maxH) {
    const scale = Math.min(maxW / image.width, maxH / image.height);
    image.setDisplaySize(image.width * scale, image.height * scale);
  },
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
};
