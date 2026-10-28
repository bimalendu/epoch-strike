// Unit tests for engine/input.js: keyboard, gamepad and touch all feed one set of logical actions. A tiny fake DOM
// stands in for the window, so no browser is needed. Moved here from the polish integration suite, then extended with
// releaseAll, unknown tokens/devices, simultaneous confirm+back and the pressed-vs-held edge semantics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Input, padActions, PAD_DEAD_ZONE, ACTIONS } from '../../src/engine/input.js';
import { rng } from '../../src/engine/rng.js';

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
// Added with the unit-test pass: releaseAll, unknown tokens/devices, simultaneous confirm + back, pressed vs held
// ---------------------------------------------------------------------------------------------------------------
test('releaseAll lets go of keys, touch buttons and the touch classes in one go', () => {
  const d = fakeDom();
  const input = new Input();
  input.attach(d.win, d.doc);
  d.win.fire('keydown', { code: 'ArrowLeft' });
  d.win.fire('keydown', { code: 'KeyX' });
  d.jump.fire('pointerdown');
  input.poll();
  assert.ok(input.held.left && input.held.fire && input.held.jump);
  assert.ok(d.jump.classes.has('down'));
  input.releaseAll();
  input.poll();
  for (const a of ACTIONS) assert.equal(input.held[a], false, `${a} released`);
  assert.ok(!d.jump.classes.has('down'), 'the on-screen button pops back up');
  assert.equal(input.released.left, true, 'a release edge is reported once');
});

test('releaseAll is safe before attach and without a touch overlay', () => {
  const input = new Input();
  assert.doesNotThrow(() => input.releaseAll());
  input._touchRoot = {}; // no querySelectorAll
  assert.doesNotThrow(() => input.releaseAll());
});

test('fill replaces known tokens per device and leaves unknown ones readable', () => {
  const input = new Input();
  assert.equal(input.fill('Press {jump} to jump, {fire} to shoot'), 'Press Z to jump, X to shoot');
  input.lastDevice = 'pad';
  assert.equal(input.fill('Press {jump}'), 'Press A');
  // an unknown token is not an error: it shows the upper-cased action name
  assert.equal(input.fill('Press {dance}'), 'Press DANCE');
  assert.equal(input.fill('no tokens here'), 'no tokens here');
  assert.equal(input.fill('{jump}{jump}'), 'AA', 'every token is replaced');
});

test('label for an unknown device falls back to the keyboard names', () => {
  const input = new Input();
  input.lastDevice = 'hologram';
  assert.equal(input.label('jump'), 'Z');
  assert.equal(input.label('bomb'), 'V');
  assert.equal(input.label('teleport'), 'TELEPORT', 'an unknown action is its upper-cased name');
});

test('confirm and back held together are both reported, and neither hides the other', () => {
  const input = new Input();
  input.setScript({ confirm: true, back: true });
  input.poll();
  assert.equal(input.held.confirm, true);
  assert.equal(input.held.back, true);
  assert.equal(input.pressed.confirm, true);
  assert.equal(input.pressed.back, true);
  input.poll();
  assert.equal(input.held.confirm && input.held.back, true, 'still held');
  assert.equal(input.pressed.confirm || input.pressed.back, false, 'no new edge while held');
});

test('jump and fire also confirm, and switch also goes back, as presses but not as held actions', () => {
  const input = new Input();
  input.setScript({ jump: true });
  input.poll();
  assert.equal(input.pressed.confirm, true);
  assert.equal(input.held.confirm, false, 'held.confirm only follows the real confirm key');
  input.setScript({ switch: true });
  input.poll();
  assert.equal(input.pressed.back, true);
  assert.equal(input.held.back, false);
  input.setScript({ fire: true });
  input.poll();
  assert.equal(input.pressed.confirm, true);
});

test('pressed fires for one frame only; held lasts while the key is down; released fires on the frame it lifts', () => {
  const input = new Input();
  const frames = [];
  for (const down of [false, true, true, true, false, false]) {
    input.setScript({ fire: down });
    input.poll();
    frames.push([input.pressed.fire, input.held.fire, input.released.fire]);
  }
  assert.deepEqual(frames, [
    [false, false, false],
    [true, true, false],
    [false, true, false],
    [false, true, false],
    [false, false, true],
    [false, false, false],
  ]);
});

test('a script replaces physical input completely', () => {
  const d = fakeDom();
  const input = new Input();
  input.attach(d.win, d.doc);
  d.win.fire('keydown', { code: 'ArrowRight' });
  input.setScript({ jump: true });
  input.poll();
  assert.equal(input.held.right, false, 'the physical key is ignored while scripted');
  assert.equal(input.held.jump, true);
  input.setScript(null);
  input.poll();
  assert.equal(input.held.right, true, 'and comes back when the script ends');
});

test('unmapped keys do nothing, and two keys for one action release only when both are up', () => {
  const d = fakeDom();
  const input = new Input();
  input.attach(d.win, d.doc);
  d.win.fire('keydown', { code: 'KeyQ' });
  input.poll();
  assert.ok(!Object.values(input.held).some(Boolean));
  d.win.fire('keydown', { code: 'ArrowLeft' });
  d.win.fire('keydown', { code: 'KeyA' });
  input.poll();
  assert.equal(input.held.left, true);
  d.win.fire('keyup', { code: 'ArrowLeft' });
  input.poll();
  assert.equal(input.held.left, true, 'the A key still holds it');
  d.win.fire('keyup', { code: 'KeyA' });
  input.poll();
  assert.equal(input.held.left, false);
});

test('Space, Backspace and the arrows are kept from scrolling or navigating the page', () => {
  const d = fakeDom();
  const input = new Input();
  input.attach(d.win, d.doc);
  const prevented = [];
  for (const code of ['Space', 'Backspace', 'ArrowUp', 'KeyZ']) {
    d.win.fire('keydown', { code, preventDefault: () => prevented.push(code) });
  }
  assert.deepEqual(prevented, ['Space', 'Backspace', 'ArrowUp']);
});

test('the first key press unlocks audio once', () => {
  const d = fakeDom();
  const input = new Input();
  let n = 0;
  input.onFirstGesture = () => n++;
  input.attach(d.win, d.doc);
  d.win.fire('keydown', { code: 'KeyZ' });
  d.win.fire('keydown', { code: 'KeyX' });
  d.win.fire('pointerdown');
  assert.equal(n, 1);
});

test('a pad that never reports buttons or axes does not crash padActions', () => {
  assert.deepEqual(padActions({ connected: true }), {});
  assert.deepEqual(padActions({}), {}, 'a missing connected flag counts as connected');
  assert.deepEqual(padActions({ axes: [NaN, 0], buttons: [] }), {}, 'NaN stick values give no direction');
});

test('the dead zone boundary is exclusive: exactly at the threshold gives no direction, just past it does', () => {
  assert.deepEqual(padActions(pad([PAD_DEAD_ZONE, 0])), {});
  assert.deepEqual(padActions(pad([PAD_DEAD_ZONE + 0.01, 0])), { right: true });
});

// ---------------------------------------------------------------------------------------------------------------
// Property test: random keyboard and focus events against a model of what the keys should mean. Fixed seed, so a failure
// replays exactly; the keys are listed here independently of the source's table, so the table is checked too.
// ---------------------------------------------------------------------------------------------------------------
test('property: held, pressed and released always agree with the keys down, whatever order keys, blur and polls arrive in (200 seeded runs)', () => {
  const MODEL = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyZ: 'jump', Space: 'jump', KeyX: 'fire', KeyJ: 'fire', KeyC: 'switch', KeyK: 'switch', KeyV: 'bomb', KeyL: 'bomb',
    Escape: 'pause', KeyP: 'pause', Enter: 'confirm', Backspace: 'back',
  };
  const codes = [...Object.keys(MODEL), 'KeyQ', 'Tab', 'F5']; // some keys the game does not use
  const r = rng(7771);
  for (let run = 0; run < 200; run++) {
    const { win, doc } = fakeDom();
    const input = new Input();
    input.attach(win, doc);
    const down = new Set();
    let prev = {};
    for (let step = 0; step < 60; step++) {
      const what = r.int(0, 9);
      const code = r.pick(codes);
      if (what <= 3) { win.fire('keydown', { code }); down.add(code); }
      else if (what <= 6) { win.fire('keyup', { code }); down.delete(code); }
      else if (what === 7) { win.fire('blur'); down.clear(); }
      else if (what === 8) { win.fire('keydown', { code, repeat: true }); down.add(code); } // auto-repeat changes nothing
      input.poll();
      const want = {};
      for (const c of down) if (MODEL[c]) want[MODEL[c]] = true;
      for (const a of ACTIONS) {
        const ctx = `run ${run} step ${step} action ${a}`;
        assert.equal(input.held[a], !!want[a], `held: ${ctx}`);
        // jump and fire also press confirm, and switch also presses back; every other press is a plain edge
        const edge = !!want[a] && !prev[a];
        const alias = (a === 'confirm' && (!!want.jump && !prev.jump || !!want.fire && !prev.fire)) || (a === 'back' && !!want.switch && !prev.switch);
        assert.equal(input.pressed[a], edge || alias, `pressed: ${ctx}`);
        assert.equal(input.released[a], !want[a] && !!prev[a], `released: ${ctx}`);
      }
      prev = want;
    }
    input.releaseAll();
    input.poll();
    assert.ok(ACTIONS.every((a) => !input.held[a]), 'nothing stays held after releaseAll');
  }
});
