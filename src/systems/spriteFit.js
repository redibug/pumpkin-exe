// spriteFit.js — TEMPORARY jam helper: auto-shrink oversized sprites.
//
// Any sprite whose longest texture side exceeds FIT_MAX px is scaled down
// to fit, so huge art files can't blow up the screen. An optional manual
// multiplier preserves artistic scaling on top of the fit.
//
// Deliberately decoupled: to remove this system later, delete this file and
// replace each `fitSprite(sprite, s)` call with `sprite.setScale(s)`.

export const FIT_MAX = 512;

/**
 * Fit factor for a sprite's texture: shrinks it within FIT_MAX px if the
 * longest texture side exceeds it, else 1. Does not touch the sprite.
 */
export function fitFactor(sprite) {
  const longest = Math.max(sprite.width, sprite.height);
  return longest > FIT_MAX ? FIT_MAX / longest : 1;
}

/**
 * Fit a sprite's texture within FIT_MAX px, then apply manualScale.
 * Must be called after the texture is loaded (e.g. in Scene.create()).
 * @returns the final scale applied — handy for tweens that animate scale.
 */
export function fitSprite(sprite, manualScale = 1) {
  const scale = fitFactor(sprite) * manualScale;
  sprite.setScale(scale);
  return scale;
}
