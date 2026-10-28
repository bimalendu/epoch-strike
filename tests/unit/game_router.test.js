// Unit tests for the Game shell (src/game/game.js): route lookup, the scene lifecycle (enter/update/exit), mute and the
// volume plumbing to the audio manager. Scenes here are tiny stubs, so nothing but Game itself is under test. A static
// scan at the end makes sure every route name a scene asks for is actually registered in scenes/routes.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeGame, stepN } from '../support/fixtures.js';
import { registerRoutes } from '../../src/scenes/routes.js';
import { Game } from '../../src/game/game.js';
import { SaveData, MemoryStorage } from '../../src/game/save.js';
import { Input } from '../../src/engine/input.js';
import { SoftCanvas } from '../../tools/softcanvas.js';

/** A scene stub that records every lifecycle call into `log`. */
function stubScene(name, log, extra = {}) {
  return {
    name,
    enter() { log.push(`${name}:enter`); },
    exit() { log.push(`${name}:exit`); },
    update(dt) { log.push(`${name}:update`); this.lastDt = dt; },
    draw() { log.push(`${name}:draw`); },
    ...extra,
  };
}

/** A recording stand-in for AudioManager. */
function fakeAudio() {
  const calls = [];
  return { calls, setVolumes: (s, m) => calls.push(['vol', s, m]), music: (id) => calls.push(['music', id]) };
}

test('go() with an unregistered route throws an error that names the route', () => {
  const { game } = makeGame();
  assert.throws(() => game.go('nope'), /No route "nope"/);
  assert.equal(game._next, null, 'a failed go() leaves nothing queued');
});

test('go() passes its params to the route factory and queues the scene it returns', () => {
  const { game } = makeGame();
  const seen = [];
  game.routes.a = (p) => { seen.push(p); return stubScene('a', []); };
  game.go('a', { level: 3 });
  game.go('a');
  assert.deepEqual(seen, [{ level: 3 }, {}], 'params default to an empty object');
  assert.ok(game._next);
  assert.equal(game.scene, null, 'the switch itself happens on the next step()');
});

test('a scene is entered once, updated every step and exited once when replaced', () => {
  const { game } = makeGame();
  const log = [];
  game.routes.a = () => stubScene('a', log);
  game.routes.b = () => stubScene('b', log);
  game.go('a');
  stepN(game, 3);
  assert.deepEqual(log, ['a:enter', 'a:update', 'a:update', 'a:update']);
  log.length = 0;
  game.go('b');
  stepN(game, 2);
  assert.deepEqual(log, ['a:exit', 'b:enter', 'b:update', 'b:update'], 'old exit, new enter, then updates');
  assert.equal(game.frame, 5);
});

test('update receives the fixed 1/60 s step', () => {
  const { game } = makeGame();
  const s = stubScene('a', []);
  game.setScene(s);
  stepN(game, 1);
  assert.equal(s.lastDt, 1 / 60);
});

test('scenes without enter/exit hooks are fine, and render() draws the current one only', () => {
  const { game } = makeGame();
  const log = [];
  game.setScene({ update() { log.push('u'); }, draw() { log.push('d'); } });
  assert.doesNotThrow(() => stepN(game, 1));
  game.render();
  game.setScene({ update() { log.push('u2'); }, draw() { log.push('d2'); } });
  stepN(game, 1);
  game.render();
  assert.deepEqual(log, ['u', 'd', 'u2', 'd2']);
});

test('step() and render() with no scene do nothing but count frames', () => {
  const { game } = makeGame();
  assert.doesNotThrow(() => { stepN(game, 2); game.render(); });
  assert.equal(game.frame, 2);
});

test('going to the same route twice exits the old instance and enters a fresh one', () => {
  const { game } = makeGame();
  const log = [];
  let n = 0;
  game.routes.a = () => stubScene(`a${++n}`, log);
  game.go('a');
  stepN(game, 1);
  game.go('a');
  stepN(game, 1);
  assert.deepEqual(log, ['a1:enter', 'a1:update', 'a1:exit', 'a2:enter', 'a2:update']);
});

test('only the last go() before a step wins, and the skipped scene is never entered', () => {
  const { game } = makeGame();
  const log = [];
  game.routes.a = () => stubScene('a', log);
  game.routes.b = () => stubScene('b', log);
  game.go('a');
  game.go('b');
  stepN(game, 1);
  assert.deepEqual(log, ['b:enter', 'b:update']);
});

test('a scene with a music property picks the track (null = silence); one without keeps what is playing', () => {
  const { game } = makeGame();
  const audio = fakeAudio();
  game.audio = audio;
  game.setScene(stubScene('a', [], { music: 'jungle' }));
  stepN(game, 1);
  game.setScene(stubScene('b', [], {}));
  stepN(game, 1);
  game.setScene(stubScene('c', [], { music: null }));
  stepN(game, 1);
  assert.deepEqual(audio.calls.filter((c) => c[0] === 'music'), [['music', 'jungle'], ['music', null]]);
});

test('an auto-pause request reaches a scene that handles it, once, and is swallowed by one that does not', () => {
  const { game } = makeGame();
  let pauses = 0;
  game.setScene(stubScene('a', [], { onAutoPause: () => pauses++ }));
  stepN(game, 1);
  game.input.requestAutoPause();
  stepN(game, 3);
  assert.equal(pauses, 1);
  game.setScene(stubScene('b', []));
  stepN(game, 1);
  game.input.requestAutoPause();
  assert.doesNotThrow(() => stepN(game, 1));
  assert.equal(game.input.takeAutoPause(), false, 'the request was consumed even though the scene ignored it');
});

test('the saved volumes reach the audio manager when the game is built', () => {
  const save = new SaveData(new MemoryStorage());
  save.setOption('sfx', 0.2);
  save.setOption('music', 0.9);
  const audio = fakeAudio();
  new Game({ canvas: new SoftCanvas(480, 270), input: new Input(), audio, save });
  assert.deepEqual(audio.calls, [['vol', 0.2, 0.9]]);
});

test('the saved touch-controls mode is applied to the input at construction', () => {
  const save = new SaveData(new MemoryStorage());
  save.setOption('touch', 'off');
  const input = new Input();
  new Game({ canvas: new SoftCanvas(480, 270), input, save });
  assert.equal(input.touchMode, 'off');
});

test('toggleMute flips the flag, returns the new state and zeroes then restores the volumes', () => {
  const { game } = makeGame();
  const audio = fakeAudio();
  game.audio = audio;
  game.save.setOption('sfx', 0.5);
  game.save.setOption('music', 0.4);
  assert.equal(game.toggleMute(), true);
  assert.deepEqual(audio.calls.at(-1), ['vol', 0, 0]);
  assert.equal(game.toggleMute(), false);
  assert.deepEqual(audio.calls.at(-1), ['vol', 0.5, 0.4]);
  assert.equal(game.save.options.sfx, 0.5, 'the saved volumes were never touched');
});

test('applyVolumes while muted keeps the sound off, and un-muting uses the latest saved value', () => {
  const { game } = makeGame();
  const audio = fakeAudio();
  game.audio = audio;
  game.toggleMute();
  game.save.setOption('sfx', 0.9);
  game.applyVolumes();
  assert.deepEqual(audio.calls.at(-1), ['vol', 0, 0], 'a volume change in Options cannot unmute');
  game.toggleMute();
  assert.deepEqual(audio.calls.at(-1), ['vol', 0.9, game.save.options.music]);
});

test('mute and applyVolumes are safe without an audio manager', () => {
  const { game } = makeGame();
  assert.equal(game.audio, null);
  assert.doesNotThrow(() => game.toggleMute());
  assert.equal(game.muted, true);
  assert.doesNotThrow(() => game.applyVolumes());
});

test('applyDisplay hands the saved options to the page hook, and is a no-op without one', () => {
  const { game } = makeGame();
  assert.doesNotThrow(() => game.applyDisplay());
  let got = null;
  game.onDisplay = (o) => { got = o; };
  game.save.setOption('crt', 'scanlines');
  game.applyDisplay();
  assert.equal(got.crt, 'scanlines');
});

test('registerRoutes registers every scene factory that the game navigates to', () => {
  const { game } = makeGame();
  registerRoutes(game);
  const expected = ['title', 'menu', 'play', 'gameover', 'results', 'options', 'controls', 'scores', 'levelselect', 'runEnd', 'nameentry', 'ending', 'credits'];
  for (const name of expected) assert.equal(typeof game.routes[name], 'function', `route ${name}`);
  assert.deepEqual(Object.keys(game.routes).sort(), [...expected].sort(), 'no unexpected routes');
});

test('every route name a scene navigates to (game.go or back:) is registered in routes.js', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../../src/scenes');
  const { game } = makeGame();
  registerRoutes(game);
  const used = new Map(); // route -> first file that uses it
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js') && n !== 'routes.js')) {
    const src = readFileSync(join(dir, f), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//')) // comments may mention go('name')
      .join('\n');
    for (const m of src.matchAll(/\.go\(\s*['"]([A-Za-z]+)['"]/g)) if (!used.has(m[1])) used.set(m[1], f);
    for (const m of src.matchAll(/\bback:\s*['"]([A-Za-z]+)['"]/g)) if (!used.has(m[1])) used.set(m[1], f);
  }
  assert.ok(used.size >= 8, `the scan found the navigation calls (${used.size})`);
  for (const [name, file] of used) assert.equal(typeof game.routes[name], 'function', `${file} navigates to "${name}" but no such route is registered`);
});
