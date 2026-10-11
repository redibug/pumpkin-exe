// Procedural SFX: synthesized with Web Audio API, no asset files.
// All game sounds are defined here as small synth recipes.

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  // Must be called from a user gesture (click/keypress) to unlock audio.
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.enabled = false;
    }
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.5 : 0;
    return this.enabled;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---- primitives ----

  tone({ freq = 440, freqEnd = null, dur = 0.1, type = 'square', vol = 0.15, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const t = this.now() + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.2, delay = 0, filterFreq = 1000, filterEnd = null, type = 'lowpass' }) {
    if (!this.enabled || !this.ctx) return;
    const t = this.now() + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filterFreq, t);
    if (filterEnd) f.frequency.exponentialRampToValueAtTime(Math.max(10, filterEnd), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---- player ----

  buster() {
    this.tone({ freq: 900, freqEnd: 350, dur: 0.08, type: 'square', vol: 0.08 });
  }

  chipSelect() {
    this.tone({ freq: 660, dur: 0.05, type: 'sine', vol: 0.12 });
  }

  chipConfirm() {
    this.tone({ freq: 660, dur: 0.06, type: 'sine', vol: 0.12 });
    this.tone({ freq: 990, dur: 0.08, type: 'sine', vol: 0.12, delay: 0.06 });
  }

  chipCancel() {
    this.tone({ freq: 440, freqEnd: 220, dur: 0.1, type: 'sine', vol: 0.12 });
  }

  cursorMove() {
    this.tone({ freq: 880, dur: 0.03, type: 'sine', vol: 0.06 });
  }

  cannon() {
    this.noise({ dur: 0.25, vol: 0.25, filterFreq: 800, filterEnd: 100 });
    this.tone({ freq: 150, freqEnd: 40, dur: 0.25, type: 'sine', vol: 0.25 });
  }

  sword() {
    this.noise({ dur: 0.15, vol: 0.18, filterFreq: 4000, filterEnd: 800, type: 'bandpass' });
  }

  spread() {
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: 700 + i * 150, freqEnd: 300, dur: 0.07, type: 'square', vol: 0.07, delay: i * 0.04 });
    }
  }

  recover() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      this.tone({ freq: f, dur: 0.12, type: 'sine', vol: 0.12, delay: i * 0.07 });
    });
  }

  railgun() {
    this.tone({ freq: 2000, freqEnd: 200, dur: 0.2, type: 'sawtooth', vol: 0.12 });
    this.noise({ dur: 0.1, vol: 0.1, filterFreq: 6000, type: 'highpass' });
  }

  bombThrow() {
    this.noise({ dur: 0.2, vol: 0.1, filterFreq: 500, filterEnd: 2500, type: 'bandpass' });
  }

  step() {
    this.tone({ freq: 220, dur: 0.04, type: 'sine', vol: 0.05 });
  }

  hurt() {
    this.tone({ freq: 200, freqEnd: 80, dur: 0.2, type: 'sawtooth', vol: 0.2 });
    this.noise({ dur: 0.15, vol: 0.15, filterFreq: 500 });
  }

  // ---- enemies ----

  teleport() {
    this.tone({ freq: 300, freqEnd: 1200, dur: 0.15, type: 'sine', vol: 0.1 });
  }

  spit() {
    this.noise({ dur: 0.08, vol: 0.12, filterFreq: 1200, type: 'bandpass' });
    this.tone({ freq: 400, freqEnd: 150, dur: 0.08, type: 'square', vol: 0.06 });
  }

  warning() {
    this.tone({ freq: 880, dur: 0.08, type: 'square', vol: 0.1 });
    this.tone({ freq: 880, dur: 0.08, type: 'square', vol: 0.1, delay: 0.12 });
  }

  laser() {
    this.tone({ freq: 1500, freqEnd: 3000, dur: 0.12, type: 'sawtooth', vol: 0.12 });
  }

  explosion() {
    this.noise({ dur: 0.4, vol: 0.3, filterFreq: 1000, filterEnd: 60 });
    this.tone({ freq: 100, freqEnd: 30, dur: 0.4, type: 'sine', vol: 0.3 });
  }

  leap() {
    this.noise({ dur: 0.15, vol: 0.08, filterFreq: 800, filterEnd: 2000, type: 'bandpass' });
  }

  scream() {
    // KYAAH: wobbly descending screech
    this.tone({ freq: 1200, freqEnd: 500, dur: 0.35, type: 'sawtooth', vol: 0.1 });
    this.tone({ freq: 1800, freqEnd: 750, dur: 0.35, type: 'square', vol: 0.05 });
  }

  enemyDie() {
    this.tone({ freq: 600, freqEnd: 100, dur: 0.3, type: 'square', vol: 0.12 });
  }

  slam() {
    this.noise({ dur: 0.2, vol: 0.25, filterFreq: 300, filterEnd: 50 });
    this.tone({ freq: 80, freqEnd: 30, dur: 0.25, type: 'sine', vol: 0.28 });
  }

  // ---- UI / flow ----

  battleStart() {
    this.tone({ freq: 220, dur: 0.15, type: 'sawtooth', vol: 0.15 });
    this.tone({ freq: 330, dur: 0.15, type: 'sawtooth', vol: 0.15, delay: 0.12 });
    this.tone({ freq: 440, dur: 0.3, type: 'sawtooth', vol: 0.15, delay: 0.24 });
  }

  victory() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      this.tone({ freq: f, dur: 0.15, type: 'square', vol: 0.1, delay: i * 0.09 });
    });
  }

  gameOver() {
    const notes = [440, 349, 262, 196];
    notes.forEach((f, i) => {
      this.tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.15, delay: i * 0.18 });
    });
  }

  dialogueBlip() {
    this.tone({ freq: 1200, dur: 0.02, type: 'square', vol: 0.03 });
  }

  customOpen() {
    this.tone({ freq: 500, freqEnd: 1000, dur: 0.12, type: 'sine', vol: 0.1 });
  }

  customClose() {
    this.tone({ freq: 1000, freqEnd: 500, dur: 0.12, type: 'sine', vol: 0.1 });
  }
}

export const sound = new SoundSystem();
