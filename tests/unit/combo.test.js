// The cheat-code detector behind the hidden GOD MODE entry: pure, so plain objects stand in for the input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ComboTracker, GOD_COMBO } from '../../src/ui/combo.js';

const DT = 1 / 60;

/** Feed the actions one per frame (with a blank frame between); returns how many times the combo fired. */
function feed(tracker, actions, gap = 1) {
  let fired = 0;
  for (const a of actions) {
    if (tracker.update({ pressed: { [a]: true } }, DT)) fired++;
    for (let i = 0; i < gap; i++) if (tracker.update({ pressed: {} }, DT)) fired++;
  }
  return fired;
}

test('the god sequence is LEFT RIGHT LEFT RIGHT BOMB', () => {
  assert.deepEqual(GOD_COMBO, ['left', 'right', 'left', 'right', 'bomb']);
});

test('the exact sequence fires once, on the last press, and then starts over', () => {
  const t = new ComboTracker(GOD_COMBO);
  assert.equal(feed(t, GOD_COMBO.slice(0, 4)), 0, 'not before the last action');
  assert.equal(feed(t, ['bomb']), 1);
  assert.equal(feed(t, ['bomb']), 0, 'it does not fire again by itself');
  assert.equal(feed(t, GOD_COMBO), 1, 'but can be typed again');
});

test('a wrong action restarts the sequence', () => {
  const t = new ComboTracker(GOD_COMBO);
  assert.equal(feed(t, ['left', 'right', 'up', 'left', 'right', 'bomb']), 0);
});

test('a wrong action that is the first step still counts as step one', () => {
  const t = new ComboTracker(GOD_COMBO);
  assert.equal(feed(t, ['left', 'left', 'right', 'left', 'right', 'bomb']), 1);
});

test('waiting longer than the window between presses restarts it', () => {
  const t = new ComboTracker(GOD_COMBO, { window: 1 });
  assert.equal(feed(t, ['left', 'right', 'left']), 0);
  for (let i = 0; i < 70; i++) t.update({ pressed: {} }, DT);
  assert.equal(feed(t, ['right', 'bomb']), 0, 'the pause forgot the first three');
  assert.equal(feed(t, GOD_COMBO), 1, 'a quick sequence works');
});

test('holding a button down is one press, not several', () => {
  const t = new ComboTracker(['left', 'right']);
  assert.equal(feed(t, ['left'], 0), 0);
  assert.equal(t.update({ pressed: { right: true } }, DT), true);
});
