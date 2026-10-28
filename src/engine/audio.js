// Audio without files: sound effects are synthesised sfxr-style into AudioBuffers on first use, and music is a
// small step sequencer (music.js turns track data into notes; the scheduler below plays them with oscillators).
// Everything degrades to a silent no-op when the Web Audio API is missing (Node tests, very old browsers) or not
// yet unlocked by a user gesture.

import { trackBar, songBars, stepSeconds, STEPS_PER_BAR, midiFreq, DRUM_SOUNDS } from './music.js';

const SR = 22050;
const LOOKAHEAD = 0.3; // seconds of music scheduled ahead of the audio clock
const TICK_MS = 60;
const FADE = 0.4; // seconds to fade a track out when another starts

/**
 * Preset parameters:
 *  wave: 'square' | 'saw' | 'tri' | 'sine' | 'noise'
 *  f0/f1: start/end frequency in Hz, curve: >1 slides late, <1 slides early
 *  dur: seconds, vol: 0..1, duty: square pulse width, vib: [rateHz, depthHz]
 *  arp: [multipliers...] stepped every arpStep seconds, decay: 'lin' | 'exp' | 'hold'
 */
export const SFX = {
  jump: { wave: 'square', f0: 280, f1: 620, dur: 0.15, vol: 0.18, duty: 0.4 },
  land: { wave: 'noise', f0: 900, f1: 300, dur: 0.05, vol: 0.12 },
  shoot: { wave: 'square', f0: 1100, f1: 300, dur: 0.08, vol: 0.14, duty: 0.25, curve: 0.6 },
  shootMg: { wave: 'square', f0: 900, f1: 380, dur: 0.05, vol: 0.12, duty: 0.5 },
  shootSpread: { wave: 'saw', f0: 700, f1: 160, dur: 0.14, vol: 0.16 },
  shootLaser: { wave: 'sine', f0: 1800, f1: 400, dur: 0.22, vol: 0.2, vib: [40, 80] },
  shootFlame: { wave: 'noise', f0: 2400, f1: 900, dur: 0.07, vol: 0.1 },
  shootHoming: { wave: 'tri', f0: 300, f1: 900, dur: 0.18, vol: 0.2 },
  shootSpear: { wave: 'saw', f0: 500, f1: 120, dur: 0.2, vol: 0.2, curve: 0.5 },
  shootBolt: { wave: 'tri', f0: 260, f1: 90, dur: 0.22, vol: 0.28 },
  shootTesla: { wave: 'saw', f0: 120, f1: 1800, dur: 0.16, vol: 0.16, vib: [60, 300] },
  shootPlasma: { wave: 'sine', f0: 120, f1: 760, dur: 0.24, vol: 0.28, vib: [18, 30] },
  enemyShoot: { wave: 'square', f0: 500, f1: 200, dur: 0.1, vol: 0.1, duty: 0.5 },
  hit: { wave: 'noise', f0: 3000, f1: 1200, dur: 0.045, vol: 0.14 },
  hitBoss: { wave: 'square', f0: 220, f1: 110, dur: 0.07, vol: 0.12, duty: 0.5 },
  boom: { wave: 'noise', f0: 1400, f1: 120, dur: 0.32, vol: 0.28, decay: 'exp' },
  bigBoom: { wave: 'noise', f0: 900, f1: 50, dur: 0.8, vol: 0.38, decay: 'exp' },
  die: { wave: 'saw', f0: 700, f1: 60, dur: 0.6, vol: 0.26, vib: [14, 30] },
  pickup: { wave: 'square', f0: 520, f1: 520, dur: 0.24, vol: 0.18, duty: 0.5, arp: [1, 1.26, 1.5, 2], arpStep: 0.055 },
  weapon: { wave: 'square', f0: 330, f1: 330, dur: 0.3, vol: 0.2, duty: 0.25, arp: [1, 1.5, 2, 3], arpStep: 0.065 },
  medal: { wave: 'square', f0: 880, f1: 1320, dur: 0.12, vol: 0.14, duty: 0.5, arp: [1, 1.5], arpStep: 0.05 },
  oneup: { wave: 'square', f0: 392, f1: 392, dur: 0.6, vol: 0.2, duty: 0.5, arp: [1, 1.26, 1.5, 2, 1.5, 2, 2.52, 3], arpStep: 0.07 },
  capsule: { wave: 'tri', f0: 600, f1: 300, dur: 0.12, vol: 0.2 },
  bomb: { wave: 'noise', f0: 600, f1: 40, dur: 1.0, vol: 0.4, decay: 'exp' },
  warning: { wave: 'square', f0: 440, f1: 440, dur: 0.9, vol: 0.14, duty: 0.5, arp: [1, 0.7, 1, 0.7], arpStep: 0.22 },
  telegraph: { wave: 'sine', f0: 300, f1: 900, dur: 0.3, vol: 0.14 },
  stomp: { wave: 'noise', f0: 400, f1: 60, dur: 0.3, vol: 0.3, decay: 'exp' },
  roar: { wave: 'saw', f0: 110, f1: 55, dur: 0.7, vol: 0.28, vib: [28, 20] },
  checkpoint: { wave: 'square', f0: 660, f1: 660, dur: 0.3, vol: 0.14, duty: 0.5, arp: [1, 1.5, 2], arpStep: 0.08 },
  rumble: { wave: 'noise', f0: 220, f1: 50, dur: 0.95, vol: 0.2, decay: 'exp' },
  shatter: { wave: 'noise', f0: 3200, f1: 700, dur: 0.28, vol: 0.18, decay: 'exp' },
  rift: { wave: 'sine', f0: 200, f1: 1400, dur: 0.6, vol: 0.2, vib: [12, 120] },
  menuMove: { wave: 'square', f0: 700, f1: 700, dur: 0.04, vol: 0.1, duty: 0.5 },
  menuSelect: { wave: 'square', f0: 500, f1: 1000, dur: 0.12, vol: 0.14, duty: 0.5 },
  menuBack: { wave: 'square', f0: 500, f1: 250, dur: 0.1, vol: 0.12, duty: 0.5 },
  clear: { wave: 'square', f0: 523, f1: 523, dur: 0.9, vol: 0.18, duty: 0.5, arp: [1, 1.26, 1.5, 2, 1.5, 2, 2.52, 3, 4], arpStep: 0.09 },
  gameover: { wave: 'tri', f0: 440, f1: 90, dur: 1.4, vol: 0.28, curve: 0.8 },
  splash: { wave: 'noise', f0: 1800, f1: 400, dur: 0.18, vol: 0.12 },
  steam: { wave: 'noise', f0: 3000, f1: 2000, dur: 0.35, vol: 0.08 },
  swing: { wave: 'noise', f0: 700, f1: 200, dur: 0.12, vol: 0.1 },
  lightning: { wave: 'saw', f0: 2400, f1: 200, dur: 0.12, vol: 0.14, vib: [90, 500] },
};

/** Render a preset to PCM samples (pure function: unit-testable in Node). */
export function renderSfx(p) {
  const n = Math.max(1, Math.floor(p.dur * SR));
  const out = new Float32Array(n);
  const curve = p.curve || 1;
  const duty = p.duty || 0.5;
  let phase = 0;
  let noiseVal = 0;
  let noisePhase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const k = i / n;
    let f = p.f0 + (p.f1 - p.f0) * Math.pow(k, curve);
    if (p.arp) f *= p.arp[Math.min(p.arp.length - 1, Math.floor(t / (p.arpStep || 0.06)))];
    if (p.vib) f += Math.sin(t * p.vib[0] * 2 * Math.PI) * p.vib[1];
    f = Math.max(20, f);
    phase += f / SR;
    phase -= Math.floor(phase);
    let s;
    switch (p.wave) {
      case 'square': s = phase < duty ? 1 : -1; break;
      case 'saw': s = phase * 2 - 1; break;
      case 'tri': s = Math.abs(phase * 4 - 2) - 1; break;
      case 'sine': s = Math.sin(phase * 2 * Math.PI); break;
      default: // noise: sample-and-hold at the frequency rate
        noisePhase += f / SR;
        if (noisePhase >= 1) {
          noisePhase -= Math.floor(noisePhase);
          noiseVal = Math.random() * 2 - 1;
        }
        s = noiseVal;
    }
    let env;
    if (p.decay === 'exp') env = Math.pow(1 - k, 2.2);
    else if (p.decay === 'hold') env = k < 0.8 ? 1 : (1 - k) / 0.2;
    else env = 1 - k;
    const attack = Math.min(1, t / 0.004);
    out[i] = s * env * attack * p.vol;
  }
  return out;
}

export class AudioManager {
  /** @param {Object<string, object>} tracks track data by id (see music.js) */
  constructor(tracks = {}) {
    this.tracks = tracks;
    this.wanted = null; // track id asked for (may be waiting for the first user gesture)
    this.current = null; // { id, track, bus, step, next, stopped }
    this.timer = null;
    this.waves = new Map();
    this.duckLevel = 1;
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.buffers = new Map();
    this.last = new Map();
    this.sfxVol = 0.7;
    this.musicVol = 0.5;
    this.supported = typeof globalThis.AudioContext !== 'undefined' || typeof globalThis.webkitAudioContext !== 'undefined';
  }

  /** Must be called from a user gesture (first key/tap). */
  unlock() {
    if (!this.supported) return;
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      try {
        this.ctx = new AC();
      } catch {
        this.supported = false;
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVol * 0.55 * this.duckLevel;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.wanted && !this.current) this.music(this.wanted);
  }

  setVolumes(sfx, music) {
    if (sfx !== undefined) this.sfxVol = sfx;
    if (music !== undefined) this.musicVol = music;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVol;
    if (this.musicGain) this.musicGain.gain.value = this.musicVol * 0.55 * this.duckLevel;
    if (this.musicVol > 0 && this.wanted && !this.current) this.music(this.wanted);
    if (this.musicVol <= 0 && this.current) this._stopCurrent(0.05);
  }

  sfx(name) {
    if (!this.ctx || this.sfxVol <= 0) return;
    const preset = SFX[name];
    if (!preset) return;
    const now = this.ctx.currentTime;
    const minGap = preset.dur < 0.1 ? 0.03 : 0.05;
    if (now - (this.last.get(name) || -1) < minGap) return;
    this.last.set(name, now);
    let buf = this.buffers.get(name);
    if (!buf) {
      const data = renderSfx(preset);
      buf = this.ctx.createBuffer(1, data.length, SR);
      buf.getChannelData(0).set(data);
      this.buffers.set(name, buf);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.sfxGain);
    src.start();
  }

  // ---------------------------------------------------------------- music

  /** Start a track by id (null stops). Asking for the track that is already playing does nothing. */
  music(id) {
    this.wanted = id || null;
    if (!id) return this._stopCurrent();
    if (this.current && this.current.id === id && !this.current.stopped) return;
    const track = this.tracks[id];
    if (!this.ctx || !track || this.musicVol <= 0) {
      this._stopCurrent();
      return;
    }
    this._stopCurrent();
    const bus = this.ctx.createGain();
    bus.gain.value = 1;
    bus.connect(this.musicGain);
    this.current = { id, track, bus, step: 0, next: this.ctx.currentTime + 0.08, stopped: false };
    this._pump();
    if (!this.timer && typeof setInterval === 'function') {
      this.timer = setInterval(() => this._pump(), TICK_MS);
      if (this.timer && this.timer.unref) this.timer.unref();
    }
  }

  /** Fade the music out and forget the request. */
  stopMusic(fade = FADE) {
    this.wanted = null;
    this._stopCurrent(fade);
  }

  _stopCurrent(fade = FADE) {
    const cur = this.current;
    if (!this.ctx || !cur) {
      this.current = null;
      return;
    }
    cur.stopped = true;
    const now = this.ctx.currentTime;
    cur.bus.gain.cancelScheduledValues(now);
    cur.bus.gain.setValueAtTime(cur.bus.gain.value, now);
    cur.bus.gain.linearRampToValueAtTime(0, now + fade);
    const bus = cur.bus;
    if (typeof setTimeout === 'function') {
      const t = setTimeout(() => {
        try { bus.disconnect(); } catch { /* already gone */ }
      }, (fade + 0.4) * 1000);
      if (t && t.unref) t.unref();
    }
    this.current = null;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Lower the music while a menu is up. */
  duck(on) {
    this.duckLevel = on ? 0.3 : 1;
    if (this.musicGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(this.musicVol * 0.55 * this.duckLevel, now + 0.15);
    }
  }

  /** Schedule every step that falls inside the look-ahead window. */
  _pump() {
    const cur = this.current;
    if (!cur || !this.ctx) return;
    const stepSec = stepSeconds(cur.track);
    const bars = songBars(cur.track);
    const now = this.ctx.currentTime;
    if (cur.next < now - 0.5) cur.next = now + 0.05; // the tab was asleep: do not replay a backlog
    let guard = 0;
    while (cur.next < now + LOOKAHEAD && guard++ < 64) {
      const bar = Math.floor(cur.step / STEPS_PER_BAR) % bars;
      const s = cur.step % STEPS_PER_BAR;
      for (const ev of trackBar(cur.track, bar)) if (ev.step === s) this._playEvent(cur, ev, cur.next, stepSec);
      cur.step = (cur.step + 1) % (bars * STEPS_PER_BAR);
      cur.next += stepSec;
    }
  }

  _playEvent(cur, ev, at, stepSec) {
    const ctx = this.ctx;
    if (ev.drum) {
      let buf = this.buffers.get(`drum:${ev.drum}`);
      if (!buf) {
        const data = renderSfx(DRUM_SOUNDS[ev.drum]);
        buf = ctx.createBuffer(1, data.length, SR);
        buf.getChannelData(0).set(data);
        this.buffers.set(`drum:${ev.drum}`, buf);
      }
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = ev.vol;
      src.buffer = buf;
      src.connect(g);
      g.connect(cur.bus);
      src.start(at);
      return;
    }
    const dur = ev.len * stepSec * 0.96;
    const osc = ctx.createOscillator();
    if (ev.wave === 'square') osc.setPeriodicWave(this._pulse(ev.duty));
    else osc.type = ev.wave === 'saw' ? 'sawtooth' : ev.wave === 'tri' ? 'triangle' : 'sine';
    osc.frequency.value = midiFreq(ev.midi);
    const g = ctx.createGain();
    const peak = ev.vol * 0.35;
    const sus = peak * 0.7;
    const decayEnd = Math.min(0.12, dur * 0.6);
    const rel = Math.min(0.03, dur * 0.3);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.005);
    g.gain.linearRampToValueAtTime(sus, at + decayEnd);
    g.gain.setValueAtTime(sus, at + Math.max(decayEnd, dur - rel));
    g.gain.linearRampToValueAtTime(0, at + dur);
    osc.connect(g);
    g.connect(cur.bus);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** A pulse wave with the given duty cycle as a PeriodicWave (cached). */
  _pulse(duty) {
    const key = Math.round(duty * 1000);
    let w = this.waves.get(key);
    if (!w) {
      const N = 32;
      const real = new Float32Array(N + 1);
      const imag = new Float32Array(N + 1);
      for (let n = 1; n <= N; n++) {
        const k = 2 / (n * Math.PI);
        real[n] = k * Math.sin(n * Math.PI * duty) * Math.cos(n * Math.PI * duty);
        imag[n] = k * Math.sin(n * Math.PI * duty) * Math.sin(n * Math.PI * duty);
      }
      w = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(key, w);
    }
    return w;
  }
}

export function createAudio(tracks) {
  return new AudioManager(tracks);
}
