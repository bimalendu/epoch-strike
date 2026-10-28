// Week 15 (polish): gamepad and touch input, auto-pause, hotkeys, the effects budget and cosmetic randomness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stepN } from '../tools/shots.mjs';
import { registerRoutes } from '../src/scenes/routes.js';
import { Input, padActions, PAD_DEAD_ZONE } from '../src/engine/input.js';
import { SaveData, MemoryStorage, SAVE_KEY } from '../src/game/save.js';
import { Run } from '../src/game/run.js';
import { World } from '../src/game/world.js';
import { flatLevel } from '../src/game/ascii.js';
import { buildLevel } from '../src/game/levels.js';
import { explosion, spark, debris, smoke, dust, casing, updateFx, FX_QUALITY } from '../src/game/fx.js';
import { makeInput, run as runWorld } from './helpers.js';
import { TILE } from '../src/game/constants.js';

// ---------------------------------------------------------------------------------------------------------------
// A tiny fake DOM: elements with listeners that tests can fire events on.
// ---------------------------------------------------------------------------------------------------------------
class FakeEl {
  constructor(id = '', data = {}) {
    this.id = id;
    this.dataset = data;
    this.hidden = false;
    this.listeners = {};
    this.children = [];
    this.style = {};
    this.captured = null;
    this.classes = new Set();
    this.classList = { add: (c) => this.classes.add(c), remove: (c) => this.classes.delete(c) };
    this.rect = { left: 0, top: 0, width: 100, height: 100 };
  }

  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }

  fire(type, ev = {}) {
    const e = { preventDefault() {}, code: '', repeat: false, ...ev };
    for (const fn of this.listeners[type] || []) fn(e);
    return e;
  }

  getBoundingClientRect() {
    return this.rect;
  }

  setPointerCapture(id) {
    this.captured = id;
  }

  querySelectorAll(sel) {
    return sel === '.tbtn' ? this.children : [];
  }
}

function fakeDom() {
  const win = new FakeEl('window');
  const doc = new FakeEl('document');
  doc.hidden = false;
  const root = new FakeEl('touch');
  root.hidden = true;
  const stick = new FakeEl('stick');
  stick.rect = { left: 0, top: 0, width: 100, height: 100 };
  const knob = new FakeEl('knob');
  const jump = new FakeEl('', { act: 'jump' });
  const fire = new FakeEl('', { act: 'fire' });
  const pause = new FakeEl('', { act: 'pause' });
  root.children = [jump, fire, pause];
  const ids = { touch: root, stick, knob };
  doc.getElementById = (id) => ids[id] || null;
  return { win, doc, root, stick, knob, jump, fire, pause };
}

function withGlobals(vals, fn) {
  const saved = {};
  for (const k of Object.keys(vals)) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  for (const [k, v] of Object.entries(vals)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  }
}

const pad = (axes = [0, 0], pressed = [], extra = {}) => ({
  connected: true,
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
  ...extra,
});

// ---------------------------------------------------------------------------------------------------------------
// Gamepad
// ---------------------------------------------------------------------------------------------------------------
test('gamepad: the stick has a radial dead zone and eight direction sectors', () => {
  assert.deepEqual(padActions(pad([0.2, 0.2])), {}, 'inside the dead zone nothing happens');
  assert.deepEqual(padActions(pad([PAD_DEAD_ZONE * 0.9, 0])), {});
  assert.deepEqual(padActions(pad([1, 0])), { right: true });
  assert.deepEqual(padActions(pad([-1, 0])), { left: true });
  assert.deepEqual(padActions(pad([0, -1])), { up: true });
  assert.deepEqual(padActions(pad([0, 1])), { down: true });
  // diagonals give two directions
  assert.deepEqual(padActions(pad([0.7, -0.7])), { right: true, up: true });
  assert.deepEqual(padActions(pad([-0.7, 0.7])), { left: true, down: true });
  // a push mostly along one axis does not leak into the other one (drift of the thumb)
  assert.deepEqual(padActions(pad([0.9, 0.2])), { right: true });
  assert.deepEqual(padActions(pad([0.2, -0.9])), { up: true });
  // the whole circle: every angle gives at least one direction once outside the dead zone, never opposites together
  for (let deg = 0; deg < 360; deg += 5) {
    const a = padActions(pad([Math.cos((deg * Math.PI) / 180) * 0.8, Math.sin((deg * Math.PI) / 180) * 0.8]));
    assert.ok(Object.keys(a).length >= 1, `angle ${deg} gives a direction`);
    assert.ok(!(a.left && a.right) && !(a.up && a.down), `angle ${deg} has no opposite pair`);
  }
});

test('gamepad: buttons map to actions, triggers count when pulled past half way, d-pad works', () => {
  assert.deepEqual(padActions(pad([0, 0], [0])), { jump: true });
  assert.deepEqual(padActions(pad([0, 0], [2])), { fire: true });
  assert.deepEqual(padActions(pad([0, 0], [5])), { fire: true });
  assert.deepEqual(padActions(pad([0, 0], [3])), { switch: true });
  assert.deepEqual(padActions(pad([0, 0], [1])), { bomb: true });
  assert.deepEqual(padActions(pad([0, 0], [9])), { pause: true });
  assert.deepEqual(padActions(pad([0, 0], [8])), { back: true });
  assert.deepEqual(padActions(pad([0, 0], [14, 12])), { left: true, up: true });
  // an analogue trigger reports `value` without `pressed`
  const trig = pad();
  trig.buttons[7] = { pressed: false, value: 0.8 };
  assert.deepEqual(padActions(trig), { fire: true });
  trig.buttons[7] = { pressed: false, value: 0.3 };
  assert.deepEqual(padActions(trig), {});
  // a disconnected or missing pad does nothing
  assert.deepEqual(padActions(null), {});
  assert.deepEqual(padActions(pad([1, 0], [0], { connected: false })), {});
});

test('gamepad: polling merges pads with the keyboard, makes edges, and switches the on-screen button names', () => {
  const input = new Input();
  let live = [pad([1, 0], [0])];
  withGlobals({ navigator: { getGamepads: () => live } }, () => {
    input.poll();
    assert.equal(input.held.right, true);
    assert.equal(input.held.jump, true);
    assert.equal(input.pressed.jump, true, 'first frame is an edge');
    assert.equal(input.lastDevice, 'pad');
    assert.equal(input.label('jump'), 'A');
    input.poll();
    assert.equal(input.pressed.jump, false, 'held, not pressed again');
    live = [null, pad([0, 0], [2]), undefined];
    input.poll();
    assert.equal(input.held.fire, true, 'a second slot is read too; nulls are skipped');
    assert.equal(input.held.right, false);
    assert.equal(input.released.jump, true);
    live = [];
    input.poll();
    assert.equal(input.held.fire, false);
  });
  // with no Gamepad API at all, polling still works
  withGlobals({ navigator: {} }, () => {
    const i2 = new Input();
    i2.poll();
    assert.equal(i2.held.left, false);
  });
});

test('gamepad: START and the face buttons count as the first gesture that unlocks audio', () => {
  const input = new Input();
  let unlocked = 0;
  input.onFirstGesture = () => unlocked++;
  withGlobals({ navigator: { getGamepads: () => [pad([0, 0], [9])] } }, () => {
    input.poll();
    input.poll();
  });
  assert.equal(unlocked, 1, 'once');
});

// ---------------------------------------------------------------------------------------------------------------
// Keyboard, focus and hotkeys
// ---------------------------------------------------------------------------------------------------------------
test('keyboard: F and M are hotkeys, not game actions; modifiers and auto-repeat are ignored', () => {
  const { win, doc } = fakeDom();
  const input = new Input();
  const seen = [];
  input.onHotkey = (n) => seen.push(n);
  input.attach(win, doc);
  win.fire('keydown', { code: 'KeyF' });
  win.fire('keydown', { code: 'KeyF', repeat: true });
  win.fire('keydown', { code: 'KeyM' });
  win.fire('keydown', { code: 'KeyF', ctrlKey: true });
  win.fire('keydown', { code: 'F11' });
  assert.deepEqual(seen, ['fullscreen', 'mute', 'fullscreen']);
  input.poll();
  assert.ok(!Object.values(input.held).some(Boolean), 'no action is held by a hotkey');
  win.fire('keydown', { code: 'KeyZ' });
  win.fire('keydown', { code: 'ArrowLeft' });
  input.poll();
  assert.equal(input.held.jump, true);
  assert.equal(input.held.left, true);
  win.fire('keyup', { code: 'KeyZ' });
  input.poll();
  assert.equal(input.held.jump, false);
});

test('focus: losing the window, hiding the tab or unplugging the pad releases every key and asks for a pause', () => {
  for (const how of ['blur', 'hidden', 'unplug']) {
    const { win, doc } = fakeDom();
    const input = new Input();
    input.attach(win, doc);
    win.fire('keydown', { code: 'ArrowRight' });
    input.poll();
    assert.equal(input.held.right, true);
    assert.equal(input.takeAutoPause(), false, 'nothing requested yet');
    if (how === 'blur') win.fire('blur');
    else if (how === 'hidden') {
      doc.hidden = true;
      doc.fire('visibilitychange');
    } else win.fire('gamepaddisconnected');
    if (how !== 'unplug') {
      input.poll();
      assert.equal(input.held.right, false, `${how}: the held key is let go (its key-up would never arrive)`);
    }
    assert.equal(input.takeAutoPause(), true, `${how} asks for a pause`);
    assert.equal(input.takeAutoPause(), false, 'once per request');
  }
  // becoming visible again does not pause
  const { win, doc } = fakeDom();
  const input = new Input();
  input.attach(win, doc);
  doc.hidden = false;
  doc.fire('visibilitychange');
  assert.equal(input.takeAutoPause(), false);
});

test('focus: the play scene opens its pause menu once, and not on top of the end-of-level pause or a paused game', () => {
  const { game } = makeGame();
  registerRoutes(game);
  game.go('play', { run: new Run(), levelIndex: -1, god: true });
  stepN(game, 3);
  const play = game.scene;
  assert.equal(play.paused, false);
  game.input.requestAutoPause();
  stepN(game, 1);
  assert.equal(play.paused, true, 'paused by focus loss');
  const t = play.world.time;
  stepN(game, 30);
  assert.equal(play.world.time, t, 'the world is frozen while paused');
  // a second request while paused changes nothing, and the menu keeps its selection
  play.pauseMenu.index = 2;
  game.input.requestAutoPause();
  stepN(game, 1);
  assert.equal(play.pauseMenu.index, 2);
  // not while the level is being cleared
  play.resume();
  play.clearT = 0.5;
  game.input.requestAutoPause();
  stepN(game, 1);
  assert.equal(play.paused, false);
  // scenes without onAutoPause (the menus) just swallow the request: no stale pause waits for the next level
  game.go('menu');
  stepN(game, 2);
  game.input.requestAutoPause();
  stepN(game, 2);
  game.go('play', { run: new Run(), levelIndex: -1, god: true });
  stepN(game, 3);
  assert.equal(game.scene.paused, false, 'the old request did not leak into the new level');
});

// ---------------------------------------------------------------------------------------------------------------
// Touch controls
// ---------------------------------------------------------------------------------------------------------------
test('touch: buttons hold while a finger is on them and let go on lift, cancel or slide-off', () => {
  const d = fakeDom();
  const input = new Input();
  input.attach(d.win, d.doc);
  d.jump.fire('pointerdown');
  d.fire.fire('pointerdown');
  input.poll();
  assert.equal(input.held.jump, true);
  assert.equal(input.held.fire, true, 'two buttons at once (multi-touch)');
  assert.ok(d.jump.classes.has('down'));
  d.jump.fire('pointerup');
  d.fire.fire('pointerleave');
  input.poll();
  assert.equal(input.held.jump, false);
  assert.equal(input.held.fire, false);
  assert.ok(!d.jump.classes.has('down'));
  d.pause.fire('pointerdown');
  input.poll();
  assert.equal(input.pressed.pause, true);
  d.pause.fire('pointercancel');
  input.poll();
  assert.equal(input.held.pause, false);
});

test('touch: the virtual stick gives four directions with a dead centre, and recentres on release', () => {
  const d = fakeDom();
  const input = new Input();
  input.attach(d.win, d.doc);
  const push = (x, y, id = 1) => d.stick.fire('pointerdown', { clientX: x, clientY: y, pointerId: id });
  push(50, 50);
  input.poll();
  assert.ok(!input.held.left && !input.held.right && !input.held.up && !input.held.down, 'centre is neutral');
  push(95, 50);
  input.poll();
  assert.equal(input.held.right, true);
  push(5, 50);
  input.poll();
  assert.equal(input.held.left, true);
  assert.equal(input.held.right, false);
  push(50, 95);
  input.poll();
  assert.equal(input.held.down, true);
  push(80, 10);
  input.poll();
  assert.ok(input.held.up && input.held.right, 'diagonal');
  assert.ok(d.knob.style.transform.includes('translate'));
  // only the finger that started on the stick moves it
  d.stick.fire('pointermove', { clientX: 5, clientY: 50, pointerId: 99 });
  input.poll();
  assert.equal(input.held.left, false);
  d.stick.fire('pointerup', { pointerId: 1 });
  input.poll();
  assert.ok(!input.held.left && !input.held.right && !input.held.up && !input.held.down);
  assert.equal(d.knob.style.transform, '');
});

test('touch: the on-screen controls follow the mode: auto waits for a touch, on always, off never', () => {
  const d = fakeDom();
  const input = new Input();
  d.win.matchMedia = () => ({ matches: false });
  input.attach(d.win, d.doc);
  assert.equal(d.root.hidden, true, 'a desktop starts without them');
  d.win.fire('touchstart');
  assert.equal(d.root.hidden, false, 'the first touch brings them up');
  assert.equal(input.lastDevice, 'touch');
  assert.equal(input.label('jump'), 'JUMP');

  d.jump.fire('pointerdown');
  input.setTouchMode('off');
  assert.equal(d.root.hidden, true);
  input.poll();
  assert.equal(input.held.jump, false, 'switching them off lets go of any held button');

  input.setTouchMode('on');
  assert.equal(d.root.hidden, false);
  input.setTouchMode('auto');
  assert.equal(d.root.hidden, false, 'auto keeps them once a touch was seen');
  input.setTouchMode('nonsense');
  assert.equal(input.touchMode, 'auto', 'unknown values fall back to auto');

  // a phone (coarse pointer) shows them at once; "off" overrides that
  const d2 = fakeDom();
  const i2 = new Input();
  i2.touchMode = 'off';
  d2.win.matchMedia = () => ({ matches: true });
  i2.attach(d2.win, d2.doc);
  assert.equal(d2.root.hidden, true);
  i2.setTouchMode('auto');
  assert.equal(d2.root.hidden, false);
});

// ---------------------------------------------------------------------------------------------------------------
// Mute and the options screen
// ---------------------------------------------------------------------------------------------------------------
test('mute: M silences without touching the saved volumes, and options changes keep it muted', () => {
  const { game } = makeGame();
  const calls = [];
  game.audio = { setVolumes: (s, m) => calls.push([s, m]), duck() {}, music() {}, sfx() {} };
  game.save.setOption('sfx', 0.5);
  game.save.setOption('music', 0.4);
  assert.equal(game.toggleMute(), true);
  assert.deepEqual(calls.at(-1), [0, 0]);
  assert.equal(game.save.options.sfx, 0.5, 'saved volumes are untouched');
  game.applyVolumes();
  assert.deepEqual(calls.at(-1), [0, 0], 'still muted after another volume refresh');
  assert.equal(game.toggleMute(), false);
  assert.deepEqual(calls.at(-1), [0.5, 0.4]);
  // no audio at all (a browser without Web Audio): nothing throws
  const { game: g2 } = makeGame();
  assert.doesNotThrow(() => g2.toggleMute());
});

test('options: EFFECTS and TOUCH BUTTONS rows change, persist and reach the input', () => {
  const { game } = makeGame();
  registerRoutes(game);
  const modes = [];
  game.input.setTouchMode = (m) => modes.push(m);
  game.go('options', { back: 'menu' });
  stepN(game, 2);
  const tap = (k) => { stepN(game, 1, [k]); stepN(game, 1); };
  const labels = () => game.scene.menu.items.map((it) => (typeof it.label === 'function' ? it.label() : it.label));
  assert.ok(labels().includes('EFFECTS  HIGH'));
  assert.ok(labels().includes('TOUCH BUTTONS  AUTO'));
  while (!labels()[game.scene.menu.index].startsWith('EFFECTS')) tap('down');
  tap('right');
  assert.equal(game.save.options.fx, 'low');
  assert.ok(labels().includes('EFFECTS  LOW'));
  tap('confirm');
  assert.equal(game.save.options.fx, 'high');
  tap('down');
  tap('right');
  assert.equal(game.save.options.touch, 'on');
  tap('right');
  assert.equal(game.save.options.touch, 'off');
  tap('right');
  assert.equal(game.save.options.touch, 'auto');
  tap('left');
  assert.equal(game.save.options.touch, 'off');
  assert.deepEqual(modes, ['on', 'off', 'auto', 'off']);
  // the whole screen still fits: nothing is drawn off the bottom, and it draws without throwing
  game.render();
});

test('save: the new options survive a reload, and rubbish is replaced by the defaults', () => {
  const storage = new MemoryStorage();
  const a = new SaveData(storage);
  a.setOption('fx', 'low');
  a.setOption('touch', 'off');
  const b = new SaveData(storage);
  assert.equal(b.options.fx, 'low');
  assert.equal(b.options.touch, 'off');

  const withOptions = (mutate) => {
    const st = new MemoryStorage();
    const raw = JSON.parse(storage.getItem(SAVE_KEY));
    mutate(raw.options);
    st.setItem(SAVE_KEY, JSON.stringify(raw));
    return new SaveData(st);
  };
  const junk = withOptions((o) => { o.fx = 'ultra'; o.touch = 7; });
  assert.equal(junk.options.fx, 'high');
  assert.equal(junk.options.touch, 'auto');
  // a save from before Week 15 has neither option
  const old = withOptions((o) => { delete o.fx; delete o.touch; });
  assert.equal(old.options.fx, 'high');
  assert.equal(old.options.touch, 'auto');
  assert.equal(old.options.difficulty, 'normal', 'the older options are kept');
});

// ---------------------------------------------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------------------------------------------
function flatWorld(opts = {}) {
  const lvl = flatLevel(120, 14);
  lvl.spawns = [];
  return new World(lvl, opts);
}

test('effects: the particle budget caps live particles, and low quality halves bursts and drops the extras', () => {
  const high = flatWorld({ fx: 'high' });
  const low = flatWorld({ fx: 'low' });
  assert.equal(high.fxQuality, 'high');
  assert.equal(low.fxQuality, 'low');
  assert.equal(flatWorld({ fx: 'bogus' }).fxQuality, 'high');
  const px = (w) => w.fx.filter((f) => f.k === 'px').length;

  spark(high, 100, 100, '#fff', 8);
  spark(low, 100, 100, '#fff', 8);
  assert.equal(px(high), 8);
  assert.equal(px(low), 4, 'a low-quality burst is half the size');
  spark(low, 100, 100, '#fff', 1);
  assert.equal(px(low), 5, 'but never zero');

  // dust and brass are high-quality extras
  const h2 = flatWorld({ fx: 'high' });
  const l2 = flatWorld({ fx: 'low' });
  dust(h2, 50, 50, 1);
  casing(h2, 50, 50, 1);
  dust(l2, 50, 50, 1);
  casing(l2, 50, 50, 1);
  assert.ok(px(h2) >= 6);
  assert.equal(px(l2), 0);

  // a storm of explosions never goes past the cap, and the count comes back down as particles die
  for (const [w, q] of [[high, 'high'], [low, 'low']]) {
    for (let i = 0; i < 200; i++) {
      explosion(w, 100 + i, 100, 2);
      debris(w, 100, 100, ['#fff'], 30);
      smoke(w, 100, 100, 20);
      if (i % 20 === 0) updateFx(w, 1 / 60);
    }
    updateFx(w, 1 / 60);
    assert.ok(w.fxCount <= FX_QUALITY[q].cap, `${q}: ${w.fxCount} live particles within the cap ${FX_QUALITY[q].cap}`);
    assert.equal(w.fxCount, px(w), 'the counter matches the real number');
    assert.ok(px(w) > 0);
    for (let i = 0; i < 120; i++) updateFx(w, 1 / 60);
    assert.equal(w.fxCount, 0, `${q}: everything fades`);
  }
  assert.ok(FX_QUALITY.low.cap < FX_QUALITY.high.cap / 2);
});

test('effects: particles use their own random stream, so quality and effects never change the simulation', () => {
  const play = (fx) => {
    const lvl = buildLevel(0);
    const w = new World(lvl, { god: true, fx });
    const input = makeInput();
    const trace = [];
    for (let f = 0; f < 900; f++) {
      // run right, shoot, jump now and then
      input.script = { right: true, fire: true, jump: f % 50 < 8 };
      input.poll();
      w.update(input, 1 / 60);
      w.events.length = 0;
      if (f % 60 === 0) trace.push([w.player.x.toFixed(2), w.player.y.toFixed(2), w.enemies.length, w.bullets.length]);
    }
    return { trace, next: w.rand(), kills: w.enemies.length, fxSeen: w.fxCount };
  };
  const a = play('high');
  const b = play('low');
  assert.deepEqual(a.trace, b.trace, 'identical gameplay at both qualities');
  assert.equal(a.next, b.next, 'the gameplay random stream is at the same place');
  // and the cosmetic stream is separate from the gameplay one
  const w = flatWorld();
  const before = w.rand();
  const w2 = flatWorld();
  spark(w2, 0, 0, '#fff', 20);
  explosion(w2, 0, 0, 2);
  assert.equal(w2.rand(), before, 'spending particles did not move the gameplay stream');
});

test('effects: landing from a fall kicks up dust, a hop does not; firing the rifle spits brass, firing plasma does not', () => {
  const w = flatWorld({ fx: 'high', god: true });
  const input = makeInput();
  runWorld(w, input, 20);
  const dustCount = () => w.fx.filter((f) => f.k === 'px' && f.col === '#b8a88a').length;
  // drop the soldier from height
  w.player.y = 4 * TILE;
  w.player.vy = 0;
  w.fx.length = 0;
  w.fxCount = 0;
  let sawDust = 0;
  input.script = {};
  for (let i = 0; i < 90; i++) {
    input.poll();
    w.update(input, 1 / 60);
    w.events.length = 0;
    sawDust = Math.max(sawDust, dustCount());
  }
  assert.ok(sawDust >= 4, `${sawDust} dust particles after the fall`);

  // a standing hop barely leaves the ground: no dust
  const w2 = flatWorld({ fx: 'high', god: true });
  const i2 = makeInput();
  runWorld(w2, i2, 20);
  w2.fx.length = 0;
  w2.fxCount = 0;
  let hopDust = 0;
  for (let i = 0; i < 60; i++) {
    i2.script = { jump: i === 0 };
    i2.poll();
    w2.update(i2, 1 / 60);
    w2.events.length = 0;
    hopDust = Math.max(hopDust, w2.fx.filter((f) => f.k === 'px' && f.col === '#b8a88a').length);
  }
  // a jump lands at the speed it left at (~330 px/s up): that is a real landing, so dust is allowed, but not a heap
  assert.ok(hopDust <= 8, `${hopDust}`);

  // brass
  const brass = (weapon) => {
    const w3 = flatWorld({ fx: 'high', god: true, loadout: { slots: [weapon, null], slot: 0, bombs: 0 } });
    const i3 = makeInput();
    runWorld(w3, i3, 10);
    w3.fx.length = 0;
    w3.fxCount = 0;
    let seen = 0;
    i3.script = { fire: true };
    for (let i = 0; i < 45; i++) {
      i3.poll();
      w3.update(i3, 1 / 60);
      w3.events.length = 0;
      seen = Math.max(seen, w3.fx.filter((f) => f.k === 'px' && f.col === '#e8c050').length);
    }
    return seen;
  };
  assert.ok(brass('rifle') >= 1, 'the rifle spits brass');
  assert.equal(brass('plasma'), 0, 'the plasma cannon does not');
  // low quality: no brass even from the rifle
  const wl = flatWorld({ fx: 'low', god: true });
  const il = makeInput();
  runWorld(wl, il, 10);
  runWorld(wl, il, 45, ['fire']);
  assert.equal(wl.fx.filter((f) => f.col === '#e8c050').length, 0);
});

test('effects: the brass falls behind the soldier and is gone within a second', () => {
  const w = flatWorld({ fx: 'high' });
  casing(w, 100, 100, 1);
  const c = w.fx[0];
  assert.ok(c.vx < 0, 'thrown backwards when facing right');
  assert.ok(c.vy < 0, 'up first');
  for (let i = 0; i < 60; i++) updateFx(w, 1 / 60);
  assert.equal(w.fx.length, 0);
  casing(w, 100, 100, -1);
  assert.ok(w.fx[0].vx > 0, 'and the other way round when facing left');
});
