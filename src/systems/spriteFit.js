// spriteFit.js — TEMPORARY jam helper: auto-shrink oversized sprites.
//
// Any sprite whose longest texture side exceeds its fit max is scaled down
// to fit, so huge art files can't blow up the screen. The fit max defaults
// to FIT_MAX but can be overridden per sprite via `sprite.setData('fitMax', n)`
// (e.g. per enemy type). An optional manual multiplier preserves artistic
// scaling on top of the fit.
//
// Deliberately decoupled: to remove this system later, delete this file and
// replace each `fitSprite(sprite, s)` call with `sprite.setScale(s)`.

export const FIT_MAX = 512;

/**
 * Fit factor for a sprite's texture: shrinks it within its fit max
 * (`sprite.getData('fitMax')`, default FIT_MAX) if the longest texture side
 * exceeds it, else 1. Does not touch the sprite.
 */
export function fitFactor(sprite) {
  const fitMax = sprite.getData('fitMax') ?? FIT_MAX;
  const longest = Math.max(sprite.width, sprite.height);
  return longest > fitMax ? fitMax / longest : 1;
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
