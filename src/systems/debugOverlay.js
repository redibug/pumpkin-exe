// debugOverlay.js — TEMPORARY jam tuning rig (hide before shipping).
// DOM panel with live fields for the perspective params. Editing a field
// updates the in-memory params and redraws the grid; the Save button writes
// grid-config.local.json (gitignored personal tuning) via the vite dev
// middleware (falls back to a download outside the dev server).

const FIELDS = [
  { key: 'cx', label: 'vanish x', step: 1 },
  { key: 'horizon', label: 'horizon y', step: 1 },
  { key: 'ground', label: 'ground y', step: 1 },
  { key: 'base', label: 'tile w', step: 1 },
  { key: 'zNear', label: 'z near', step: 0.05 },
  { key: 'zFar', label: 'z far', step: 0.05 },
  { key: 'thickness', label: 'slab px', step: 1 },
];

const COLORS = [
  { key: 'pink', label: 'player' },
  { key: 'cyan', label: 'enemy' },
];

/**
 * @param {object} opts
 * @param {() => object} opts.getValues - current param values
 * @param {(key: string, value: number|string) => void} opts.onChange - field edited
 * @returns {{ el: HTMLElement, setVisible(v: boolean): void, refresh(): void }}
 */
export function createDebugOverlay({ getValues, onChange }) {
  const el = document.createElement('div');
  el.id = 'debug-overlay';
  el.style.cssText = [
    'position:absolute', 'top:8px', 'right:8px', 'z-index:10',
    'background:rgba(8,10,20,0.92)', 'border:1px solid #3a4a6a',
    'border-radius:8px', 'padding:10px 12px', 'color:#cfe0ff',
    'font:12px/1.7 monospace', 'width:212px', 'user-select:none',
  ].join(';');

  const title = document.createElement('div');
  title.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
  title.innerHTML = '<b style="color:#ffd166">GRID DEBUG</b>';
  const close = document.createElement('button');
  close.textContent = '×';
  close.title = 'hide (press D to bring back)';
  close.style.cssText = 'background:none;border:none;color:#8fa3c8;font-size:16px;cursor:pointer;padding:0 2px;';
  title.appendChild(close);
  el.appendChild(title);

  const inputs = {};
  for (const f of FIELDS) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    const lab = document.createElement('span');
    lab.textContent = f.label;
    lab.style.color = '#8fa3c8';
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = String(f.step);
    inp.style.cssText = 'width:84px;background:#101828;color:#e8f6ff;border:1px solid #3a4a6a;border-radius:4px;padding:2px 6px;font:12px monospace;';
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      if (Number.isFinite(v)) onChange(f.key, v);
    });
    // don't let game keys fire while typing
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    row.appendChild(lab);
    row.appendChild(inp);
    el.appendChild(row);
    inputs[f.key] = inp;
  }

  // tile base colors: native color pickers
  const colorInputs = {};
  for (const f of COLORS) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    const lab = document.createElement('span');
    lab.textContent = f.label + ' tile';
    lab.style.color = '#8fa3c8';
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.style.cssText = 'width:84px;height:24px;background:#101828;border:1px solid #3a4a6a;border-radius:4px;padding:1px 3px;cursor:pointer;';
    inp.addEventListener('input', () => onChange(f.key, inp.value));
    row.appendChild(lab);
    row.appendChild(inp);
    el.appendChild(row);
    colorInputs[f.key] = inp;
  }

  const saveRow = document.createElement('div');
  saveRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;align-items:center;';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '💾 save local';
  saveBtn.title = 'writes grid-config.local.json (gitignored personal tuning)';
  saveBtn.style.cssText = 'flex:1;background:#1d3a5f;color:#e8f6ff;border:1px solid #3a6a9a;border-radius:4px;padding:4px;cursor:pointer;font:12px monospace;';
  const status = document.createElement('span');
  status.style.cssText = 'font-size:11px;color:#8fa3c8;';
  saveRow.appendChild(saveBtn);
  saveRow.appendChild(status);
  el.appendChild(saveRow);

  saveBtn.addEventListener('click', async () => {
    status.textContent = 'saving…';
    status.style.color = '#8fa3c8';
    try {
      const res = await fetch('/__grid-config-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getValues(), null, 2),
      });
      if (!res.ok) throw new Error('no endpoint');
      status.textContent = 'saved ✓';
      status.style.color = '#81c784';
    } catch {
      // outside the dev server: download the JSON instead
      const blob = new Blob([JSON.stringify(getValues(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'grid-config.local.json';
      a.click();
      URL.revokeObjectURL(a.href);
      status.textContent = 'downloaded';
      status.style.color = '#ffd166';
    }
    setTimeout(() => { status.textContent = ''; }, 2500);
  });

  const hint = document.createElement('div');
  hint.textContent = 'D toggles panel';
  hint.style.cssText = 'margin-top:6px;font-size:10px;color:#5a6a8a;';
  el.appendChild(hint);

  function refresh() {
    const vals = getValues();
    for (const f of FIELDS) {
      if (document.activeElement !== inputs[f.key]) {
        inputs[f.key].value = vals[f.key];
      }
    }
    for (const f of COLORS) {
      colorInputs[f.key].value = vals[f.key];
    }
  }
  function setVisible(v) {
    el.style.display = v ? 'block' : 'none';
  }
  close.addEventListener('click', () => setVisible(false));

  refresh();
  return { el, setVisible, refresh };
}
