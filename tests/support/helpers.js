// Shared test utilities: software canvas, scripted input and frame runners.
import { installSoftCanvas } from '../../tools/softcanvas.js';
import { Input } from '../../src/engine/input.js';
import { DT } from '../../src/game/constants.js';

installSoftCanvas();

export function makeInput() {
  const i = new Input();
  i.script = {};
  return i;
}

/**
 * Hold the given actions for n frames, updating the world each frame. Returns events seen.
 * `sfx` events are dropped unless `{ keepSfx: true }` is passed, so tests can assert on sounds when they need to.
 */
export function run(world, input, n, keys = [], { keepSfx = false } = {}) {
  const script = {};
  for (const k of keys) script[k] = true;
  input.script = script;
  const seen = [];
  for (let i = 0; i < n; i++) {
    input.poll();
    world.update(input, DT);
    for (const e of world.events) if (keepSfx || e.type !== 'sfx') seen.push(e);
    world.events.length = 0;
  }
  return seen;
}

export function seconds(s) {
  return Math.round(s / DT);
}
