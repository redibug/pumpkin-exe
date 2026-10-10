// debugGameplay.js — TEMPORARY jam debug panel (hide before shipping).
// Gameplay-related debug controls (separate from the visual debug overlay).
// - Skip Dialogue: LOCAL-ONLY toggle, persisted in localStorage (never in
//   the repo). When on, startDialogue returns immediately.
// - Skip to Next Battle: jumps to the next battle via scene restart.

const SKIP_KEY = 'pumpkin-debug-skip-dialogue';

export function isDialogueSkipped() {
  try {
    return localStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDialogueSkipped(v) {
  try {
    if (v) localStorage.setItem(SKIP_KEY, '1');
    else localStorage.removeItem(SKIP_KEY);
  } catch {
    // localStorage unavailable (e.g. file:// in some browsers): ignore
  }
}

/**
 * @param {object} opts
 * @param {() => void} opts.onSkipBattle - skip to the next battle
 * @returns {{ el: HTMLElement, setVisible(v: boolean): void }}
 */
export function createDebugGameplay({ onSkipBattle }) {
  const el = document.createElement('div');
  el.id = 'debug-gameplay';
  el.style.cssText = [
    'position:absolute', 'top:8px', 'left:8px', 'z-index:10',
    'background:rgba(8,10,20,0.92)', 'border:1px solid #3a4a6a',
    'border-radius:8px', 'padding:10px 12px', 'color:#cfe0ff',
    'font:12px/1.7 monospace', 'width:220px', 'user-select:none',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'DEBUG · gameplay (G)';
  title.style.cssText = 'color:#00e5ff;font-weight:bold;margin-bottom:8px;';
  el.appendChild(title);

  // Skip dialogue (local-only via localStorage)
  const skipRow = document.createElement('label');
  skipRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px;';
  const skipBox = document.createElement('input');
  skipBox.type = 'checkbox';
  skipBox.checked = isDialogueSkipped();
  skipBox.title = 'Local-only: stored in this browser, never committed';
  skipBox.onchange = () => setDialogueSkipped(skipBox.checked);
  const skipLabel = document.createElement('span');
  skipLabel.textContent = 'Skip all dialogue (local)';
  skipRow.append(skipBox, skipLabel);
  el.appendChild(skipRow);

  // Skip to next battle
  const skipBtn = document.createElement('button');
  skipBtn.textContent = 'Skip to next battle →';
  skipBtn.style.cssText = [
    'width:100%', 'padding:6px', 'background:#0d1b33', 'color:#e8f6ff',
    'border:1px solid #00e5ff', 'border-radius:4px', 'cursor:pointer',
    'font:12px monospace',
  ].join(';');
  skipBtn.onclick = onSkipBattle;
  el.appendChild(skipBtn);

  const hint = document.createElement('div');
  hint.textContent = 'hide before shipping';
  hint.style.cssText = 'color:#5a6a8a;font-size:10px;margin-top:8px;';
  el.appendChild(hint);

  return {
    el,
    setVisible(v) { el.style.display = v ? 'block' : 'none'; },
  };
}
