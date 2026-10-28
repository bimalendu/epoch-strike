// Boss painters: every boss draws in every state and phase, shows damage as the fight goes on, and its weak point
// looks different open and closed. Art only: the tests never run the boss AI, they set the pose by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { run, makeInput } from './helpers.js';
import { World } from '../src/game/world.js';
import { buildLevel, LEVEL_DEFS } from '../src/game/levels.js';
import { TILE } from '../src/game/constants.js';
import { enemyFrames } from '../src/game/art/enemies.js';
import { SoftCanvas } from '../tools/softcanvas.js';

const W = 520, H = 330;
const bossLevels = LEVEL_DEFS.map((d, i) => i).filter((i) => buildLevel(i).boss);

function spawnBoss(index) {
  const lvl = buildLevel(index);
  const L = lvl.boss;
  const w = new World(lvl, { god: true, start: { x: L.x0 + 3 * TILE, y: L.floorY } });
  const input = makeInput();
  for (let k = 0; k < 200 && !w.boss; k++) run(w, input, 1, ['right']);
  assert.ok(w.boss, `level ${index + 1}: boss spawned`);
  return w.boss;
}

function render(e, pose = {}) {
  const f = enemyFrames(e.def);
  const c = new SoftCanvas(W, H);
  const ctx = c.getContext('2d');
  const bs = e.bs;
  const keep = { ...bs };
  Object.assign(bs, { state: 'idle', phase: 0, atk: null, t: 1, teleMax: 1, age: 3, ...pose });
  f.draw(ctx, e, e.x - W / 2, e.y - (H - 20), f);
  Object.assign(bs, keep);
  return c.data;
}

const sum = (data) => {
  let s = 0;
  for (let i = 0; i < data.length; i++) s = (s * 31 + data[i]) >>> 0;
  return s;
};

for (const i of bossLevels) {
  const id = buildLevel(i).boss.type;

  test(`boss art ${id}: draws in every state, attack and phase`, () => {
    const e = spawnBoss(i);
    const attacks = [null, ...Object.keys(e.def.attacks)];
    for (const state of ['enter', 'idle', 'tele', 'attack', 'phase', 'dying']) {
      for (const phase of [0, 1, 2]) {
        for (const atk of state === 'tele' || state === 'attack' ? attacks : [null]) {
          for (const t of state === 'dying' ? [3, 1.5, 0.1] : [0.5]) {
            assert.doesNotThrow(() => render(e, { state, phase, atk, t }), `${state}/${phase}/${atk}/${t}`);
          }
        }
      }
    }
  });

  test(`boss art ${id}: it looks more damaged in later phases, and open differs from closed`, () => {
    const e = spawnBoss(i);
    const real = e.def.weakBox;
    try {
      const a = sum(render(e, { phase: 0 }));
      const b = sum(render(e, { phase: 2 }));
      assert.notEqual(a, b, 'phase 3 is drawn differently from phase 1');
      e.def.weakBox = () => null;
      const closed = sum(render(e, { phase: 0 }));
      e.def.weakBox = () => ({ x0: e.x - 5, x1: e.x + 5, y0: e.y - 40, y1: e.y - 30 });
      const open = sum(render(e, { phase: 0 }));
      assert.notEqual(open, closed, 'the weak point reads differently when open');
    } finally {
      e.def.weakBox = real;
    }
  });
}

for (const i of bossLevels) {
  const id = buildLevel(i).boss.type;

  test(`boss art ${id}: it idles with life and collapses while it dies`, () => {
    const e = spawnBoss(i);
    // idle life: a breath, a blink or a puff changes the picture over a few seconds
    const idle = new Set();
    for (let age = 3; age < 6.4; age += 0.2) idle.add(sum(render(e, { state: 'idle', age })));
    assert.ok(idle.size >= 3, `idle shows ${idle.size} different pictures in 3.4 s`);
    // the death collapse: sinks, chars and throws parts off as the dying timer runs out
    const early = sum(render(e, { state: 'dying', phase: 2, t: 2.9, age: 10 }));
    const late = sum(render(e, { state: 'dying', phase: 2, t: 0.1, age: 10 }));
    assert.notEqual(early, late, 'the dying pose changes over the death');
  });
}
