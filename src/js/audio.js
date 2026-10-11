'use strict';
// ───────────────────────── sound ─────────────────────────
// Everything is synthesised with WebAudio: no audio files to load.
const Sound = {
  ac: null, master: null, mus: null, fx: null, noise: null,
  music: true, sfx: true, playing: false, timer: 0, step: 0, next: 0, song: null,

  init() {
    if (this.ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ac = new AC(); } catch (e) { return false; }
    const ac = this.ac;
    this.master = ac.createGain(); this.master.gain.value = 0.9; this.master.connect(ac.destination);
    this.mus = ac.createGain(); this.mus.gain.value = 0; this.mus.connect(this.master);
    this.fx = ac.createGain(); this.fx.gain.value = 0.5; this.fx.connect(this.master);
    const len = ac.sampleRate * 0.25, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.song = makeSong();
    return true;
  },
  unlock() {
    if (!this.init()) return;
    if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    if (this.music && !this.playing) this.startMusic();
  },
  note(freq, t, dur, { type = 'sine', gain = 0.2, dest = this.fx, attack = 0.005, slide = 0 } = {}) {
    const ac = this.ac;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  },
  hat(t, gain, dest = this.mus) {
    const ac = this.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + 0.06);
  },
  play(name) {
    if (!this.sfx || !this.ac || this.ac.state !== 'running') return;
    const t = this.ac.currentTime + 0.01, n = (m) => 440 * Math.pow(2, (m - 69) / 12);
    switch (name) {
      case 'click': this.note(n(84), t, 0.06, { type: 'triangle', gain: 0.12 }); break;
      case 'tab': this.note(n(79), t, 0.05, { type: 'triangle', gain: 0.1 }); break;
      case 'coin': this.note(n(88), t, 0.07, { type: 'square', gain: 0.05 }); this.note(n(93), t + 0.07, 0.25, { type: 'square', gain: 0.05 }); break;
      case 'buy': [72, 76, 79, 84, 88].forEach((m, i) => this.note(n(m), t + i * 0.07, 0.35, { type: 'triangle', gain: 0.16 })); this.play('coin'); break;
      case 'sell': [84, 79, 76, 84].forEach((m, i) => this.note(n(m), t + i * 0.08, 0.3, { type: 'triangle', gain: 0.15 })); break;
      case 'error': this.note(n(50), t, 0.22, { type: 'sawtooth', gain: 0.06, slide: 0.7 }); break;
      case 'ach': [67, 72, 76, 79, 84].forEach((m, i) => this.note(n(m), t + i * 0.1, i === 4 ? 0.9 : 0.25, { type: 'triangle', gain: 0.17 })); this.note(n(60), t + 0.4, 0.9, { type: 'sine', gain: 0.12 }); break;
      case 'news': this.note(n(76), t, 0.12, { type: 'sine', gain: 0.12 }); this.note(n(81), t + 0.12, 0.2, { type: 'sine', gain: 0.12 }); break;
      case 'bad': this.note(n(64), t, 0.18, { type: 'triangle', gain: 0.14 }); this.note(n(60), t + 0.16, 0.35, { type: 'triangle', gain: 0.14 }); break;
    }
  },
  setMusic(on) {
    this.music = on;
    if (!this.ac) return;
    if (on) this.startMusic(); else this.stopMusic();
  },
  startMusic() {
    if (!this.ac || this.playing) return;
    this.playing = true;
    this.mus.gain.cancelScheduledValues(this.ac.currentTime);
    this.mus.gain.setTargetAtTime(0.32, this.ac.currentTime, 0.6);
    this.next = this.ac.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 60);
  },
  stopMusic() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    this.mus.gain.setTargetAtTime(0, this.ac.currentTime, 0.15);
  },
  schedule() {
    const ac = this.ac, spb = 60 / 104 / 2; // eighth notes at 104 bpm
    const n = (m) => 440 * Math.pow(2, (m - 69) / 12);
    while (this.next < ac.currentTime + 0.25) {
      const t = this.next, s = this.step % this.song.length, ev = this.song[s];
      const o = { dest: this.mus };
      if (ev.chord) ev.chord.forEach((m) => this.note(n(m), t, spb * 7, { ...o, type: 'triangle', gain: 0.035, attack: 0.03 }));
      if (ev.bass != null) this.note(n(ev.bass), t, spb * 1.6, { ...o, type: 'sine', gain: 0.16, attack: 0.01 });
      if (ev.mel != null) {
        this.note(n(ev.mel), t, spb * 1.4, { ...o, type: 'triangle', gain: 0.07 });
        this.note(n(ev.mel + 12), t, spb * 0.6, { ...o, type: 'sine', gain: 0.025 });
      }
      if (s % 2 === 1) this.hat(t, 0.02);
      this.step++; this.next += spb;
    }
  },
};

function makeSong() {
  // eight bars of eighth notes over I–vi–IV–V in C, a plucky pentatonic tune on top
  const bars = [[48, [60, 64, 67]], [45, [57, 60, 64]], [41, [57, 60, 65]], [43, [59, 62, 67]], [48, [60, 64, 67]], [40, [59, 64, 67]], [41, [57, 60, 65]], [43, [59, 62, 65, 67]]];
  const rhythms = [[1, 0, 1, 0, 1, 1, 0, 1], [1, 0, 0, 1, 0, 1, 1, 0], [1, 1, 0, 1, 0, 0, 1, 0], [1, 0, 1, 1, 0, 1, 0, 0]];
  const r = mulberry32(2012);
  const scale = [72, 74, 76, 79, 81, 84, 86, 88];
  let cur = 76;
  const out = [];
  bars.forEach(([root, chord], b) => {
    const rh = rhythms[b === 7 ? 3 : Math.floor(r() * 3)];
    for (let i = 0; i < 8; i++) {
      const ev = {};
      if (i === 0) ev.chord = chord.map((m) => m + 12);
      if (i === 0 || i === 4) ev.bass = root;
      if (i === 6) ev.bass = root + 12;
      if (rh[i]) {
        const tones = scale.filter((m) => chord.some((c) => (m - c) % 12 === 0));
        const pool = (i % 2 === 0 ? tones : scale).filter((m) => Math.abs(m - cur) <= 5);
        cur = pool.length ? pool[Math.floor(r() * pool.length)] : tones[0];
        ev.mel = cur;
      }
      out.push(ev);
    }
  });
  return out;
}
