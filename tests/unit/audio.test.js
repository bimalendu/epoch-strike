// Unit tests for audio.js: the synthesised sound-effect presets and the AudioManager (unlock, volumes, rate limiting, ducking) on a fake context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SFX, renderSfx, AudioManager } from '../../src/engine/audio.js';

test('every sound effect preset renders finite, non-silent samples within range', () => {
  for (const [name, preset] of Object.entries(SFX)) {
    const data = renderSfx(preset);
    assert.ok(data.length > 100, `${name} has samples`);
    let peak = 0;
    for (const s of data) {
      assert.ok(Number.isFinite(s), `${name} finite`);
      peak = Math.max(peak, Math.abs(s));
    }
    assert.ok(peak > 0.02, `${name} audible (peak ${peak})`);
    assert.ok(peak <= 1.0, `${name} does not clip (peak ${peak})`);
  }
});

test('AudioManager is a safe no-op without Web Audio', () => {
  const a = new AudioManager();
  a.unlock();
  a.sfx('shoot');
  a.setVolumes(0.5, 0.5);
  assert.equal(a.ctx, null);
});

// ---------------------------------------------------------------------------------------------------------------
// AudioManager against a fake AudioContext: unlock, volumes, rate-limited sfx, ducking
// ---------------------------------------------------------------------------------------------------------------
function fakeCtx(state = 'running') {
  const log = { sources: 0, started: 0, buffers: 0, resumed: 0 };
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, disconnect() {} });
  const ctx = {
    currentTime: 10,
    state,
    destination: node(),
    resume() { log.resumed++; this.state = 'running'; },
    createGain() { return { ...node(), gain: param() }; },
    createBuffer(ch, n) { log.buffers++; const d = new Float32Array(n); return { getChannelData: () => d }; },
    createBufferSource() { log.sources++; return { ...node(), start() { log.started++; } }; },
    createOscillator() { return { ...node(), frequency: param(), setPeriodicWave() {}, start() {}, stop() {} }; },
    createPeriodicWave() { return {}; },
  };
  return { ctx, log };
}

/** An unlocked manager on a fake context. */
function unlocked(state) {
  const { ctx, log } = fakeCtx(state);
  const a = new AudioManager({});
  globalThis.AudioContext = function AC() { return ctx; };
  a.supported = true;
  a.unlock();
  delete globalThis.AudioContext;
  return { a, ctx, log };
}

test('every sfx preset has a positive duration, a volume in 0..1 and a known waveform', () => {
  for (const [name, p] of Object.entries(SFX)) {
    assert.ok(p.dur > 0 && p.dur <= 1.5, `${name} dur`);
    assert.ok(p.vol > 0 && p.vol <= 1, `${name} vol`);
    assert.ok(['square', 'saw', 'tri', 'sine', 'noise'].includes(p.wave), `${name} wave`);
    assert.ok(p.f0 > 0 && p.f1 > 0, `${name} frequencies`);
  }
});

test('renderSfx makes dur * 22050 samples and at least one sample for a zero-length preset', () => {
  assert.equal(renderSfx({ wave: 'sine', f0: 440, f1: 440, dur: 0.1, vol: 0.5 }).length, Math.floor(0.1 * 22050));
  assert.equal(renderSfx({ wave: 'sine', f0: 440, f1: 440, dur: 0, vol: 0.5 }).length, 1);
});

test('renderSfx fades to silence at the end and starts with a short attack, never with a click', () => {
  const d = renderSfx({ wave: 'square', f0: 300, f1: 300, dur: 0.2, vol: 0.5 });
  assert.equal(d[0], 0, 'the first sample is silent (attack)');
  assert.ok(Math.abs(d[d.length - 1]) < 0.01, 'the tail has faded');
});

test('renderSfx of a non-noise preset is deterministic', () => {
  const p = SFX.jump;
  assert.deepEqual(renderSfx(p), renderSfx(p));
});

test('before unlock there is no context, and sfx and music requests are silent no-ops', () => {
  const a = new AudioManager({ t: { bpm: 120 } });
  a.supported = true;
  assert.equal(a.ctx, null);
  assert.doesNotThrow(() => { a.sfx('jump'); a.duck(true); a.stopMusic(); });
});

test('unlock creates the context once, and later unlocks reuse it', () => {
  const { a, ctx } = unlocked();
  const first = a.ctx;
  assert.equal(first, ctx);
  a.unlock();
  assert.equal(a.ctx, first);
});

test('unlock resumes a context the browser left suspended', () => {
  const { log } = unlocked('suspended');
  assert.equal(log.resumed, 1);
  assert.equal(unlocked('running').log.resumed, 0);
});

test('a constructor that throws marks audio unsupported instead of crashing', () => {
  const a = new AudioManager();
  globalThis.AudioContext = function AC() { throw new Error('blocked'); };
  a.supported = true;
  try {
    assert.doesNotThrow(() => a.unlock());
  } finally {
    delete globalThis.AudioContext;
  }
  assert.equal(a.supported, false);
  assert.equal(a.ctx, null);
  assert.doesNotThrow(() => a.sfx('jump'));
});

test('setVolumes updates the gains, and an undefined argument leaves that channel alone', () => {
  const { a } = unlocked();
  a.setVolumes(0.3, 0.8);
  assert.equal(a.sfxGain.gain.value, 0.3);
  assert.equal(a.musicGain.gain.value, 0.8 * 0.55);
  a.setVolumes(undefined, 0.2);
  assert.equal(a.sfxGain.gain.value, 0.3, 'sfx untouched');
  assert.equal(a.musicGain.gain.value, 0.2 * 0.55);
  a.setVolumes(0.9);
  assert.equal(a.musicVol, 0.2, 'music untouched');
});

test('volumes set before unlock are applied to the gains when the context appears', () => {
  const a = new AudioManager({});
  a.setVolumes(0.4, 0.6);
  const { ctx } = fakeCtx();
  globalThis.AudioContext = function AC() { return ctx; };
  a.supported = true;
  a.unlock();
  delete globalThis.AudioContext;
  assert.equal(a.sfxGain.gain.value, 0.4);
  assert.equal(a.musicGain.gain.value, 0.6 * 0.55);
});

test('sfx plays a synthesised buffer, builds it only once per name, and ignores unknown names', () => {
  const { a, log } = unlocked();
  a.sfx('jump');
  assert.equal(log.started, 1);
  assert.equal(log.buffers, 1);
  a.ctx.currentTime += 1;
  a.sfx('jump');
  assert.equal(log.started, 2);
  assert.equal(log.buffers, 1, 'the buffer is cached');
  a.sfx('no-such-sound');
  assert.equal(log.started, 2);
});

test('the same sfx cannot retrigger inside its minimum gap, while different sfx are independent', () => {
  const { a, log } = unlocked();
  a.sfx('land'); // 0.05 s long: gap 0.03 s
  a.ctx.currentTime += 0.01;
  a.sfx('land');
  assert.equal(log.started, 1, 'too soon');
  a.sfx('hit');
  assert.equal(log.started, 2, 'another sound is not blocked');
  a.ctx.currentTime += 0.03;
  a.sfx('land');
  assert.equal(log.started, 3, 'after the gap it plays again');
  a.sfx('boom'); // longer than 0.1 s: gap 0.05 s
  a.ctx.currentTime += 0.04;
  a.sfx('boom');
  assert.equal(log.started, 4, 'long sounds use the 0.05 s gap');
});

test('sfx is silent at sfx volume 0 and comes back when the volume does', () => {
  const { a, log } = unlocked();
  a.setVolumes(0, undefined);
  a.sfx('jump');
  assert.equal(log.started, 0);
  a.setVolumes(0.5, undefined);
  a.sfx('jump');
  assert.equal(log.started, 1);
});

test('duck lowers the music gain to 30% and restores it, without touching the stored volume', () => {
  const { a } = unlocked();
  a.setVolumes(undefined, 0.8);
  a.duck(true);
  assert.ok(Math.abs(a.musicGain.gain.value - 0.8 * 0.55 * 0.3) < 1e-12);
  assert.equal(a.musicVol, 0.8);
  a.setVolumes(undefined, 0.8);
  assert.ok(Math.abs(a.musicGain.gain.value - 0.8 * 0.55 * 0.3) < 1e-12, 'a volume change while ducked stays ducked');
  a.duck(false);
  assert.ok(Math.abs(a.musicGain.gain.value - 0.8 * 0.55) < 1e-12);
});

test('duck before unlock is remembered and applied when the context is created', () => {
  const a = new AudioManager({});
  a.setVolumes(undefined, 1);
  a.duck(true);
  const { ctx } = fakeCtx();
  globalThis.AudioContext = function AC() { return ctx; };
  a.supported = true;
  a.unlock();
  delete globalThis.AudioContext;
  assert.ok(Math.abs(a.musicGain.gain.value - 0.55 * 0.3) < 1e-12);
});
