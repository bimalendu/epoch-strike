// Options -> audio: changing a volume on the Options screen (a real OptionsScene driven by key presses) must reach the
// AudioManager's gain nodes, through the Game's applyVolumes, on a fake AudioContext. Also: the saved volumes are applied
// when the game starts, mute silences without touching the saved values, and ducking (pause) stays in force.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepN, tap } from '../support/fixtures.js';
import { SoftCanvas } from '../../tools/softcanvas.js';
import { Input } from '../../src/engine/input.js';
import { Game } from '../../src/game/game.js';
import { registerRoutes } from '../../src/scenes/routes.js';
import { OptionsScene } from '../../src/scenes/options.js';
import { PlayScene } from '../../src/scenes/play.js';
import { Run } from '../../src/game/run.js';
import { SaveData, MemoryStorage } from '../../src/game/save.js';
import { AudioManager } from '../../src/engine/audio.js';
import { VIEW_W, VIEW_H } from '../../src/game/constants.js';

const MUSIC_SCALE = 0.55; // the music bus sits under the effects (see AudioManager)

/** A minimal AudioContext: gain params remember the last value set, and sources just count their starts. */
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, disconnect() {} });
  const log = { started: 0 };
  return {
    log,
    ctx: {
      currentTime: 10,
      state: 'running',
      destination: node(),
      resume() {},
      createGain() { return { ...node(), gain: param() }; },
      createBuffer(ch, n) { const d = new Float32Array(n); return { getChannelData: () => d }; },
      createBufferSource() { return { ...node(), start() { log.started++; } }; },
      createOscillator() { return { ...node(), frequency: param(), setPeriodicWave() {}, start() {}, stop() {} }; },
      createPeriodicWave() { return {}; },
    },
  };
}

/** A Game wired to a real AudioManager on the fake context, already unlocked (as after the first key press). */
function bootWithAudio(saved = {}) {
  const storage = new MemoryStorage();
  const save = new SaveData(storage);
  for (const [k, v] of Object.entries(saved)) save.setOption(k, v);
  const { ctx, log } = fakeContext();
  const audio = new AudioManager({});
  globalThis.AudioContext = function AC() { return ctx; };
  audio.supported = true;
  try {
    audio.unlock();
  } finally {
    delete globalThis.AudioContext;
  }
  const input = new Input();
  input.script = {};
  const game = new Game({ canvas: new SoftCanvas(VIEW_W, VIEW_H), input, audio, save });
  registerRoutes(game);
  return { game, audio, log, save, storage };
}

function openOptions(game) {
  game.go('options', { back: 'menu' });
  stepN(game, 2);
  assert.ok(game.scene instanceof OptionsScene);
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('the saved volumes are applied to the gains when the game starts', () => {
  const { audio } = bootWithAudio({ sfx: 0.3, music: 0.9 });
  assert.ok(near(audio.sfxGain.gain.value, 0.3));
  assert.ok(near(audio.musicGain.gain.value, 0.9 * MUSIC_SCALE));
});

test('SFX left/right on the Options screen move the effects gain by 0.1 and save it', () => {
  const { game, audio, save } = bootWithAudio({ sfx: 0.8 });
  openOptions(game);
  tap(game, 'left');
  assert.ok(near(audio.sfxGain.gain.value, 0.7));
  assert.equal(save.options.sfx, 0.7);
  tap(game, 'left');
  assert.ok(near(audio.sfxGain.gain.value, 0.6));
  tap(game, 'right');
  assert.ok(near(audio.sfxGain.gain.value, 0.7));
});

test('MUSIC left/right move the music gain (on its own scale) and leave the effects alone', () => {
  const { game, audio, save } = bootWithAudio({ sfx: 0.8, music: 0.6 });
  openOptions(game);
  tap(game, 'down'); // MUSIC row
  tap(game, 'right');
  assert.equal(save.options.music, 0.7);
  assert.ok(near(audio.musicGain.gain.value, 0.7 * MUSIC_SCALE));
  assert.ok(near(audio.sfxGain.gain.value, 0.8), 'sfx untouched');
});

test('the volume stops at 0 and at 1: gains never go outside the range', () => {
  const { game, audio } = bootWithAudio({ sfx: 0.2, music: 0.9 });
  openOptions(game);
  for (let i = 0; i < 6; i++) tap(game, 'left');
  assert.ok(near(audio.sfxGain.gain.value, 0));
  tap(game, 'down');
  for (let i = 0; i < 6; i++) tap(game, 'right');
  assert.ok(near(audio.musicGain.gain.value, 1 * MUSIC_SCALE));
});

test('moving the SFX volume plays a test shot, and not at all once the volume reaches zero', () => {
  const { game, audio } = bootWithAudio({ sfx: 0.2 });
  const played = [];
  const real = audio.sfx.bind(audio);
  audio.sfx = (name) => { played.push(name); real(name); };
  openOptions(game);
  tap(game, 'right');
  assert.ok(played.includes('shoot'), 'a test shot at the new level');
  tap(game, 'left');
  tap(game, 'left');
  tap(game, 'left'); // down to 0
  assert.equal(audio.sfxVol, 0);
  const ctxStarts = [];
  audio.ctx.createBufferSource = () => ({ connect() {}, disconnect() {}, start() { ctxStarts.push(1); } });
  audio.ctx.currentTime += 1;
  tap(game, 'left'); // already at 0: the shot is requested but silent
  assert.equal(ctxStarts.length, 0);
});

test('a volume chosen in Options survives a restart: a new Game on the same storage starts at that level', () => {
  const { game, storage } = bootWithAudio({ sfx: 0.8 });
  openOptions(game);
  tap(game, 'left');
  tap(game, 'left');
  const next = new SaveData(storage);
  const { ctx } = fakeContext();
  const audio = new AudioManager({});
  globalThis.AudioContext = function AC() { return ctx; };
  audio.supported = true;
  audio.unlock();
  delete globalThis.AudioContext;
  const input = new Input();
  input.script = {};
  new Game({ canvas: new SoftCanvas(VIEW_W, VIEW_H), input, audio, save: next });
  assert.ok(near(audio.sfxGain.gain.value, 0.6));
});

test('mute silences both gains without touching the saved volumes, and unmute restores them', () => {
  const { game, audio, save } = bootWithAudio({ sfx: 0.5, music: 0.5 });
  assert.equal(game.toggleMute(), true);
  assert.equal(audio.sfxGain.gain.value, 0);
  assert.equal(audio.musicGain.gain.value, 0);
  assert.equal(save.options.sfx, 0.5);
  assert.equal(save.options.music, 0.5);
  assert.equal(game.toggleMute(), false);
  assert.ok(near(audio.sfxGain.gain.value, 0.5));
  assert.ok(near(audio.musicGain.gain.value, 0.5 * MUSIC_SCALE));
});

test('changing a volume while muted keeps the game silent (the mute is not undone by the slider)', () => {
  const { game, audio, save } = bootWithAudio({ sfx: 0.5 });
  game.toggleMute();
  openOptions(game);
  tap(game, 'right');
  assert.equal(save.options.sfx, 0.6, 'the choice is saved');
  assert.equal(audio.sfxGain.gain.value, 0, 'but nothing is heard');
  game.toggleMute();
  assert.ok(near(audio.sfxGain.gain.value, 0.6), 'and unmuting uses the new value');
});

test('Options opened from the pause menu: the music is audible at the new level while adjusting, ducked again on return, full after resume', () => {
  const { game, audio } = bootWithAudio({ music: 0.6 });
  game.go('play', { run: new Run(), levelIndex: -1, god: true });
  stepN(game, 2);
  assert.ok(game.scene instanceof PlayScene);
  const play = game.scene;
  tap(game, 'pause');
  assert.ok(near(audio.musicGain.gain.value, 0.6 * MUSIC_SCALE * 0.3), 'ducked under the pause menu');
  tap(game, 'down');
  tap(game, 'down');
  tap(game, 'confirm'); // OPTIONS
  stepN(game, 2);
  assert.ok(game.scene instanceof OptionsScene);
  tap(game, 'down'); // MUSIC row
  tap(game, 'right');
  assert.ok(near(audio.musicGain.gain.value, 0.7 * MUSIC_SCALE), 'leaving the play scene lifts the duck, so the new level can be heard');
  tap(game, 'back');
  stepN(game, 2);
  assert.equal(game.scene, play);
  assert.ok(near(audio.musicGain.gain.value, 0.7 * MUSIC_SCALE * 0.3), 'back at the pause menu: ducked again');
  tap(game, 'pause'); // leave the pause menu
  tap(game, 'confirm');
  assert.ok(near(audio.musicGain.gain.value, 0.7 * MUSIC_SCALE), 'full level again after resuming');
});
