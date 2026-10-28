// Unit tests for music.js (scales, patterns, song form, the shared note envelope, tempo maths) and the live scheduler in
// audio.js driven through a fake Web Audio context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS } from '../../src/game/tracks.js';
import {
  SCALES, STEPS_PER_BAR, degreeMidi, midiFreq, parsePattern, lineNotes, trackBar, trackBars, loopSeconds, renderTrack,
  songBars, songSeconds, trackPasses, stepSeconds, noteGain,
} from '../../src/engine/music.js';
import { AudioManager } from '../../src/engine/audio.js';
import { LEVEL_DEFS } from '../../src/game/levels.js';
import { registerRoutes } from '../../src/scenes/routes.js';
import { makeGame, stepN } from '../../tools/shots.mjs';
import { Run } from '../../src/game/run.js';

test('degrees map onto the scale, across octaves and below the root', () => {
  const t = { root: 50, mode: 'minor' };
  assert.equal(degreeMidi(t, 0), 50);
  assert.equal(degreeMidi(t, 2), 53);
  assert.equal(degreeMidi(t, 7), 62);
  assert.equal(degreeMidi(t, -1), 48); // the note below the root is the minor 7th of the octave under
  assert.equal(degreeMidi(t, 9), 65);
  assert.ok(Math.abs(midiFreq(69) - 440) < 1e-9);
  for (const [name, sc] of Object.entries(SCALES)) {
    assert.equal(sc.length, 7, `${name} has 7 degrees`);
    for (let i = 1; i < sc.length; i++) assert.ok(sc[i] >= sc[i - 1], `${name} ascends`);
  }
});

test('patterns: tokens, holds and rests', () => {
  assert.equal(parsePattern('x...x...x...x...').length, 16);
  assert.equal(parsePattern('0 . 2 . 4 . 2 . 4 . 7 . 4 . 2 .').length, 16);
  assert.throws(() => parsePattern('0 . 2'), /16 steps/);
  const n = lineNotes('4 - - - . . 2 - 5 . . . . . . .');
  assert.deepEqual(n, [
    { step: 0, len: 4, degree: 4 },
    { step: 6, len: 2, degree: 2 },
    { step: 8, len: 1, degree: 5 },
  ]);
  assert.throws(() => lineNotes('q . . . . . . . . . . . . . . .'), /bad token/);
});

test('every track is well-formed, in range, and a sensible length', () => {
  const ids = Object.keys(TRACKS);
  for (const need of ['title', 'jungle', 'volcano', 'glacier', 'cave', 'boss']) assert.ok(ids.includes(need), `${need} exists`);
  for (const [id, t] of Object.entries(TRACKS)) {
    assert.ok(t.bpm >= 80 && t.bpm <= 190, `${id} tempo ${t.bpm}`);
    assert.ok(SCALES[t.mode], `${id} mode`);
    const bars = trackBars(t);
    assert.ok(bars >= 4 && bars <= 32, `${id} bars`);
    const secs = loopSeconds(t);
    assert.ok(secs >= 8 && secs <= 90, `${id} loop ${secs.toFixed(1)} s`);
    let melodic = 0;
    let drums = 0;
    for (let b = 0; b < songBars(t); b++) { // every arranged bar of the whole song form
      for (const ev of trackBar(t, b)) {
        assert.ok(ev.step >= 0 && ev.step < STEPS_PER_BAR, `${id} step`);
        if (ev.drum) {
          drums++;
          continue;
        }
        melodic++;
        assert.ok(ev.midi >= 28 && ev.midi <= 100, `${id} bar ${b} ${ev.voice} midi ${ev.midi}`);
        assert.ok(ev.step + ev.len <= STEPS_PER_BAR, `${id} note stays inside its bar`);
        assert.ok(ev.vol > 0 && ev.vol <= 1);
      }
    }
    assert.ok(melodic > bars * 4, `${id} has a tune`);
    assert.ok(songSeconds(t) >= 40 && songSeconds(t) <= 170, `${id} song ${songSeconds(t).toFixed(1)} s`);
    void drums;
    assert.ok(t.bass, `${id} has bass`);
  }
});

test('every level and boss names a track that exists', () => {
  for (const d of LEVEL_DEFS) {
    assert.ok(TRACKS[d.music], `${d.name} music "${d.music}"`);
    if (d.bossMusic) assert.ok(TRACKS[d.bossMusic]);
  }
  assert.ok(TRACKS.boss);
});

test('tracks render to audible, unclipped, deterministic audio', () => {
  for (const [id, t] of Object.entries(TRACKS)) {
    const a = renderTrack(t, { sampleRate: 8000 });
    const b = renderTrack(t, { sampleRate: 8000 });
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      assert.ok(Number.isFinite(a[i]));
      peak = Math.max(peak, Math.abs(a[i]));
      sum += a[i] * a[i];
      if (a[i] !== b[i]) assert.fail(`${id} is not deterministic at ${i}`);
    }
    const rms = Math.sqrt(sum / a.length);
    assert.ok(peak < 0.98, `${id} peak ${peak.toFixed(2)} does not clip`);
    assert.ok(rms > 0.02, `${id} rms ${rms.toFixed(3)} is audible`);
  }
});

test('song form: four passes, pass A is the data as written, the others are arranged differently and deterministically', () => {
  for (const [id, t] of Object.entries(TRACKS)) {
    const n = trackBars(t);
    assert.equal(trackPasses(t), 4, `${id} passes`);
    assert.equal(songBars(t), n * 4);
    const key = (evs) => JSON.stringify(evs.map((e) => [e.step, e.drum || e.midi, e.voice || '', e.vol.toFixed(3), e.len || 0]));
    // the song wraps
    assert.equal(key(trackBar(t, 0)), key(trackBar(t, songBars(t))));
    assert.equal(key(trackBar(t, -1)), key(trackBar(t, songBars(t) - 1)));
    // each later pass differs from pass A somewhere
    for (let pass = 1; pass < 4; pass++) {
      let differs = false;
      for (let b = 0; b < n; b++) if (key(trackBar(t, b)) !== key(trackBar(t, pass * n + b))) differs = true;
      assert.ok(differs, `${id} pass ${pass} is arranged differently`);
    }
    // calling twice gives the same events (no hidden state)
    assert.equal(key(trackBar(t, n + 3)), key(trackBar(t, n + 3)));
  }
});

test('song form: the breakdown drops the beat, the finale doubles the lead, every pass ends with a fill', () => {
  const t = TRACKS.jungle;
  const n = trackBars(t);
  const count = (evs, f) => evs.filter(f).length;
  // pass C, first half: no kick, no snare, no lead
  const c0 = trackBar(t, 2 * n + 0);
  assert.equal(count(c0, (e) => e.drum === 'kick' || e.drum === 'snare'), 0, 'beat is out');
  assert.equal(count(c0, (e) => e.voice === 'lead'), 0, 'lead is out');
  assert.ok(count(c0, (e) => e.voice === 'bass') > 0, 'bass carries on');
  // pass C, second half: the beat and lead are back, and the last bar builds with a snare roll
  const c1 = trackBar(t, 2 * n + n - 2);
  assert.ok(count(c1, (e) => e.drum === 'kick') > 0 && count(c1, (e) => e.voice === 'lead') > 0, 'back in');
  const roll = trackBar(t, 2 * n + n - 1).filter((e) => e.drum === 'snare').sort((a, b) => a.step - b.step);
  assert.ok(roll.length >= 12, `roll has ${roll.length} hits`);
  assert.ok(roll[roll.length - 1].vol > roll[0].vol, 'the roll swells');
  // pass D: the lead is doubled an octave up all the way through
  const a = trackBar(t, 0).filter((e) => e.voice === 'lead');
  const d = trackBar(t, 3 * n).filter((e) => e.voice === 'lead');
  const doubled = a.filter((e) => e.midi + 12 <= 96); // notes that would go shrill are left single
  assert.ok(doubled.length > 0 && d.length === a.length + doubled.length, `${d.length} lead events from ${a.length}`);
  for (const e of doubled) assert.ok(d.some((x) => x.step === e.step && x.midi === e.midi + 12), 'octave double');
  // pass B: only the second half is doubled
  assert.equal(trackBar(t, n + 0).filter((e) => e.voice === 'lead').length, trackBar(t, 0).filter((e) => e.voice === 'lead').length);
  const lateA = trackBar(t, n - 2).filter((e) => e.voice === 'lead');
  assert.equal(trackBar(t, n + n - 2).filter((e) => e.voice === 'lead').length, lateA.length + lateA.filter((e) => e.midi + 12 <= 96).length);
  // fills: the last bar of A and B has a snare on the last four steps
  for (const pass of [0, 1]) {
    const last = trackBar(t, pass * n + n - 1).filter((e) => e.drum === 'snare' && e.step >= 12);
    assert.equal(last.length, 4, `pass ${pass} fill`);
  }
});

test('song form: a track with a single lead voice keeps a thin breakdown instead of going silent', () => {
  const t = { name: 'thin', bpm: 120, root: 48, mode: 'minor', chords: [0, 0, 5, 4], lead: { bars: ['0 . 2 . 4 . 2 . 0 . . . . . . .'] }, bass: { style: 'pulse' } };
  const quiet = trackBar(t, 2 * 4 + 0).filter((e) => e.voice === 'lead');
  assert.ok(quiet.length > 0, 'the lead stays, quieter');
  assert.ok(quiet[0].vol < trackBar(t, 0).filter((e) => e.voice === 'lead')[0].vol);
  assert.equal(trackBar(t, 5).filter((e) => e.drum).length, 0, 'no drums are invented');
});

// ---------------------------------------------------------------- live scheduler with a fake Web Audio

function fakeContext() {
  const log = { osc: 0, src: 0, started: [], gains: [] };
  const param = (v = 0) => ({
    value: v,
    setValueAtTime(x) { this.value = x; },
    linearRampToValueAtTime(x) { this.value = x; },
    cancelScheduledValues() {},
  });
  const node = () => ({ connect() {}, disconnect() {} });
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: node(),
    resume() {},
    createGain() { const g = { ...node(), gain: param(1) }; log.gains.push(g); return g; },
    createOscillator() {
      log.osc++;
      const o = { ...node(), type: 'sine', frequency: param(440), setPeriodicWave() {}, start(t) { log.started.push(t); }, stop() {} };
      return o;
    },
    createBufferSource() { log.src++; return { ...node(), start(t) { log.started.push(t); } }; },
    createBuffer(ch, n) { const d = new Float32Array(n); return { getChannelData: () => d }; },
    createPeriodicWave() { return {}; },
  };
  return { ctx, log };
}

function liveAudio() {
  const a = new AudioManager(TRACKS);
  const { ctx, log } = fakeContext();
  globalThis.AudioContext = function AC() { return ctx; };
  a.supported = true;
  a.unlock();
  delete globalThis.AudioContext;
  return { a, ctx, log };
}

test('the scheduler plays notes ahead of the clock and keeps going as time passes', () => {
  const { a, ctx, log } = liveAudio();
  a.music('jungle');
  assert.equal(a.current.id, 'jungle');
  const first = log.started.length;
  assert.ok(first > 0, 'notes were scheduled immediately');
  assert.ok(Math.max(...log.started) <= ctx.currentTime + 0.5, 'only a short look-ahead');
  for (let i = 0; i < 40; i++) {
    ctx.currentTime += 0.1;
    a._pump();
  }
  assert.ok(log.started.length > first * 5, 'more notes as time advances');
  assert.ok(log.osc > 0 && log.src > 0, 'both tones and drums');
  a.stopMusic(0);
  clearInterval(a.timer);
});

test('asking for the same track again does nothing; a new track replaces it', () => {
  const { a, log } = liveAudio();
  a.music('jungle');
  const n = log.started.length;
  a.music('jungle');
  assert.equal(log.started.length, n, 'no restart');
  const old = a.current;
  a.music('boss');
  assert.equal(a.current.id, 'boss');
  assert.ok(old.stopped, 'the old one is fading out');
  a.music(null);
  assert.equal(a.current, null);
  a.music('nonexistent');
  assert.equal(a.current, null, 'unknown tracks are ignored');
});

test('a track requested before the first gesture starts once audio unlocks', () => {
  const a = new AudioManager(TRACKS);
  a.music('title');
  assert.equal(a.current, null);
  assert.equal(a.wanted, 'title');
  const { ctx } = fakeContext();
  globalThis.AudioContext = function AC() { return ctx; };
  a.supported = true;
  a.unlock();
  delete globalThis.AudioContext;
  assert.equal(a.current && a.current.id, 'title');
  a.stopMusic(0);
  assert.equal(a.wanted, null);
});

test('volume 0 silences the music and raising it brings the track back', () => {
  const { a } = liveAudio();
  a.music('cave');
  assert.ok(a.current);
  a.setVolumes(undefined, 0);
  assert.equal(a.current, null);
  a.setVolumes(undefined, 0.6);
  assert.equal(a.current && a.current.id, 'cave');
  a.duck(true);
  assert.ok(a.musicGain.gain.value < 0.6 * 0.55);
  a.duck(false);
  a.stopMusic(0);
});

test('scenes pick the music: title screen, level, boss, silence on results', () => {
  const calls = [];
  const audio = {
    music: (id) => calls.push(['music', id]),
    stopMusic: () => calls.push(['stop']),
    duck: (on) => calls.push(['duck', on]),
    sfx: () => {},
    setVolumes: () => {},
  };
  const { game } = makeGame();
  game.audio = audio;
  registerRoutes(game);
  const last = (kind) => calls.filter((c) => c[0] === kind).at(-1);
  game.go('title');
  stepN(game, 1);
  assert.deepEqual(last('music'), ['music', 'title']);
  game.go('menu');
  stepN(game, 1);
  assert.deepEqual(last('music'), ['music', 'title']);
  const run = new Run();
  game.go('play', { run, levelIndex: 0, god: true });
  stepN(game, 1);
  assert.deepEqual(last('music'), ['music', LEVEL_DEFS[0].music], 'the level picks its track');
  // the boss arena switches to the boss track, and its death stops the music
  const w = game.scene.world;
  w.events.push({ type: 'bossStart', id: 'trex' });
  stepN(game, 1);
  assert.deepEqual(last('music'), ['music', 'boss']);
  w.events.push({ type: 'bossDying', id: 1 });
  stepN(game, 1);
  assert.deepEqual(last('stop'), ['stop']);
  // pausing ducks the music, resuming restores it
  stepN(game, 1, ['pause']);
  stepN(game, 1, []);
  assert.equal(game.scene.paused, true);
  assert.deepEqual(last('duck'), ['duck', true]);
  game.scene.resume();
  assert.deepEqual(last('duck'), ['duck', false]);
  game.go('results', { run, levelIndex: 0, world: game.scene.world });
  stepN(game, 1);
  assert.deepEqual(last('music'), ['music', null], 'results are silent');
});

// ---------------------------------------------------------------- tempo and envelope

test('stepSeconds is one 16th note: 60 / bpm / 4, so a faster tempo gives shorter steps', () => {
  assert.equal(stepSeconds({ bpm: 120 }), 0.125);
  assert.equal(stepSeconds({ bpm: 60 }), 0.25);
  assert.equal(stepSeconds({ bpm: 240 }), 0.0625);
  assert.ok(stepSeconds({ bpm: 150 }) < stepSeconds({ bpm: 100 }));
});

test('loop and song lengths follow the tempo: four 16th steps per beat, 16 steps per bar', () => {
  const t = { name: 'x', bpm: 120, root: 48, mode: 'minor', chords: [0, 0, 5, 4], lead: { bars: ['0 . 2 . 4 . 2 . 0 . . . . . . .'] }, bass: { style: 'pulse' } };
  assert.equal(trackBars(t), 4);
  assert.equal(loopSeconds(t), 4 * 16 * 0.125, 'four bars of 16 steps at 0.125 s');
  assert.equal(loopSeconds(t), 8, 'four 4/4 bars at 120 bpm last 8 seconds');
  assert.equal(songSeconds(t), loopSeconds(t) * trackPasses(t));
  assert.ok(Math.abs(loopSeconds({ ...t, bpm: 240 }) - 4) < 1e-9, 'double tempo, half the time');
});

test('every real track keeps its tempo-derived step inside a sane range for the scheduler look-ahead', () => {
  for (const [id, t] of Object.entries(TRACKS)) {
    const step = stepSeconds(t);
    assert.ok(step > 0.05 && step < 0.2, `${id} step ${step}`);
  }
});

test('noteGain is silent at t = 0, so a note never starts with a click', () => {
  assert.equal(noteGain(0, 0.5), 0);
});

test('noteGain reaches full level right after the 5 ms attack and then decays towards the 70% sustain', () => {
  const peak = noteGain(0.005, 1);
  assert.ok(peak > 0.97 && peak <= 1, `peak ${peak}`);
  assert.ok(noteGain(0.0025, 1) < peak, 'still ramping up halfway through the attack');
  let prev = peak;
  for (let t = 0.01; t < 0.9; t += 0.01) {
    const g = noteGain(t, 1);
    assert.ok(g <= prev + 1e-12, `non-increasing before the release at t=${t.toFixed(2)}`);
    assert.ok(g >= 0.7 - 1e-9, `never under the sustain level at t=${t.toFixed(2)}`);
    prev = g;
  }
  assert.ok(Math.abs(noteGain(0.9, 1) - 0.7) < 0.001, 'settled at the sustain');
});

test('noteGain fades linearly over the last 30 ms and is exactly zero at t = dur', () => {
  const dur = 0.5;
  const sustainAt = (t) => 0.7 + 0.3 * Math.exp(-t * 14);
  assert.ok(Math.abs(noteGain(dur - 0.03, dur) - sustainAt(dur - 0.03)) < 1e-9, 'the release begins at full sustain');
  assert.ok(Math.abs(noteGain(dur - 0.015, dur) - sustainAt(dur - 0.015) / 2) < 1e-9, 'half way through the release it is half');
  assert.equal(noteGain(dur, dur), 0);
});

test('noteGain stays at zero for t after the note has ended', () => {
  assert.equal(noteGain(0.51, 0.5), 0);
  assert.equal(noteGain(10, 0.5), 0);
});

test('noteGain for a note shorter than its own attack and release never leaves 0..1', () => {
  for (const dur of [0.001, 0.004, 0.02]) {
    for (let t = 0; t <= dur + 0.05; t += dur / 20) {
      const g = noteGain(t, dur);
      assert.ok(g >= 0 && g <= 1, `dur ${dur} t ${t}: ${g}`);
    }
  }
});

// ---------------------------------------------------------------- scheduler behaviour that is deliberately pinned

test('PINNED: music keeps scheduling while the game is paused (pausing only ducks the volume)', () => {
  const { a, ctx, log } = liveAudio();
  a.music('jungle');
  a.duck(true); // what the pause menu does
  const before = log.started.length;
  for (let i = 0; i < 20; i++) {
    ctx.currentTime += 0.1;
    a._pump();
  }
  assert.ok(log.started.length > before, 'notes are still queued while ducked');
  assert.equal(a.current.id, 'jungle', 'the track was not stopped');
  assert.equal(a.musicGain.gain.value, a.musicVol * 0.55 * 0.3, 'only the gain changed');
  a.duck(false);
  assert.equal(a.musicGain.gain.value, a.musicVol * 0.55);
  a.stopMusic(0);
  clearInterval(a.timer);
});

test('a tab that slept for a long time does not replay the backlog: only the look-ahead window is queued', () => {
  const { a, ctx, log } = liveAudio();
  a.music('jungle');
  const before = log.started.length;
  ctx.currentTime += 600; // ten minutes asleep
  a._pump();
  const queued = log.started.slice(before);
  assert.ok(queued.length > 0, 'it picks up again');
  assert.ok(Math.min(...queued) >= ctx.currentTime, 'nothing is scheduled in the past');
  assert.ok(Math.max(...queued) <= ctx.currentTime + 0.5, 'and nothing far ahead either');
  a.stopMusic(0);
  clearInterval(a.timer);
});

test('the scheduler steps through the song at the track tempo', () => {
  const { a, ctx } = liveAudio();
  a.music('jungle');
  const step = stepSeconds(TRACKS.jungle);
  const s0 = a.current.step;
  const bars = 2;
  for (let t = 0; t < step * 16 * bars; t += 0.1) { // the audio clock advances in small ticks, as the 60 ms timer would see it
    ctx.currentTime += 0.1;
    a._pump();
  }
  const advanced = (a.current.step - s0 + songBars(TRACKS.jungle) * 16) % (songBars(TRACKS.jungle) * 16);
  assert.ok(advanced >= 32 && advanced <= 36, `advanced ${advanced} steps for two bars plus look-ahead`);
  a.stopMusic(0);
  clearInterval(a.timer);
});
