// Visual polish: hit flashes, combat juice, world rendering, HUD feedback.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { SoftCanvas } from '../tools/softcanvas.js';
import { drawEnemy } from '../src/game/art/enemies.js';
import { ENEMY_DEFS } from '../src/game/enemy_defs.js';
import { Enemy } from '../src/game/enemies.js';
import { hitMix } from '../src/game/art/hit.js';
import { lightenedCopy } from '../src/engine/gfx.js';
import { makeGame, stepN } from '../tools/shots.mjs';
import { registerRoutes } from '../src/scenes/routes.js';
import { HIT_STOP, BOSS_SLOWMO } from '../src/scenes/play.js';
import { Run } from '../src/game/run.js';
import { World } from '../src/game/world.js';
import { LevelBuilder } from '../src/game/levelgen.js';
import { killEnemy } from '../src/game/enemies.js';
import { drawFx } from '../src/game/art/fx.js';
import { makeInput, run as runWorld } from './helpers.js';

/** Total brightness and number of visible pixels of a canvas. */
function measure(c) {
  let sum = 0;
  let px = 0;
  for (let i = 0; i < c.data.length; i += 4) {
    if (c.data[i + 3] === 0) continue;
    px++;
    sum += c.data[i] + c.data[i + 1] + c.data[i + 2];
  }
  return { sum, px };
}

function drawDef(def, flash) {
  const c = new SoftCanvas(120, 120);
  const e = new Enemy(def, 60, 80, { face: 1 });
  e.ang = -1;
  e.open = true;
  if (def.arch === 'breacher') {
    e.base = 90;
    e.state = 'leap';
    e.vy = -60;
    e.trail = Array.from({ length: 12 }, (_, i) => ({ x: 60 - i * 2, y: 76 + i * 3 }));
  }
  e.flash = flash;
  drawEnemy(c.getContext('2d'), e, 0, 0);
  return measure(c);
}

// nothing flashes that a bullet cannot hurt: the stone blocks, and an icicle (one hit point, it shatters)
const NEVER_FLASH = new Set(['crusher', 'press', 'icicle']);

test('hit flash: every enemy and boss is brighter for a moment after a hit, and keeps its outline', () => {
  for (const def of Object.values(ENEMY_DEFS)) {
    if (NEVER_FLASH.has(def.id)) continue;
    const calm = drawDef(def, 0);
    const hit = drawDef(def, 0.11);
    assert.equal(hit.px, calm.px, `${def.id}: the flash must not change the silhouette`);
    assert.ok(hit.sum > calm.sum, `${def.id}: ${hit.sum} should be brighter than ${calm.sum}`);
  }
});

test('hit flash: full strength for the first frames only, and a boss only brightens', () => {
  const grunt = { def: { boss: false }, flash: 0.12 };
  const late = { def: { boss: false }, flash: 0.03 };
  const boss = { def: { boss: true }, flash: 0.08 };
  assert.ok(hitMix(grunt) > hitMix(boss) && hitMix(boss) > 0);
  assert.equal(hitMix(late), 0, 'the flash ends before e.flash runs out');
  assert.equal(hitMix({ def: { boss: false }, flash: 0 }), 0);
});

test('lightenedCopy mixes colours toward white and keeps alpha', () => {
  const src = new SoftCanvas(2, 1);
  src.data.set([200, 100, 0, 255, 0, 0, 0, 0]);
  const out = lightenedCopy(src, 0.5);
  assert.deepEqual([...out.data.slice(0, 4)], [228, 178, 128, 255]);
  assert.equal(out.data[7], 0, 'a transparent pixel stays transparent');
});

function flatWorld() {
  const b = new LevelBuilder({ id: 1, theme: 'jungle', name: 'flat', seed: 3 });
  b.flat(60);
  b.exit();
  return new World(b.finish(), { god: false });
}

function playScene() {
  const { game, canvas } = makeGame();
  registerRoutes(game);
  game.go('play', { run: new Run(), levelIndex: -1, god: true });
  stepN(game, 1);
  return { game, canvas, world: () => game.scene.world };
}

test('muzzle flash: a shot adds a flash in the weapon colour that is drawn along the aim and gone within a few frames', () => {
  const w = flatWorld();
  const input = makeInput();
  runWorld(w, input, 5);
  runWorld(w, input, 1, ['fire']);
  const f = w.fx.find((x) => x.k === 'muzzle');
  assert.ok(f, 'firing leaves a muzzle flash');
  assert.equal(f.col, '#ffe66b', 'the rifle flashes in its own colour');
  assert.ok(f.dx > 0.9, 'aimed forward');
  const c = new SoftCanvas(480, 270);
  drawFx(c.getContext('2d'), w, w.camera.rx, w.camera.ry);
  assert.ok(measure(c).px >= 8, 'it draws a few pixels');
  runWorld(w, input, 8);
  assert.ok(!w.fx.includes(f), 'the first flash has faded');
});

test('kills: a pop ring and pieces in the enemy\'s own colours', () => {
  const w = flatWorld();
  const def = ENEMY_DEFS.trooper;
  const e = new Enemy(def, 100, 100, {});
  w.enemies.push(e);
  killEnemy(w, e);
  assert.ok(w.fx.some((f) => f.k === 'ring' && f.col === '#ffffff'), 'a white pop ring');
  const own = new Set(Object.values(def.pal).filter((v) => typeof v === 'string'));
  assert.ok(w.fx.some((f) => f.k === 'px' && own.has(f.col)), 'debris in the trooper\'s colours');
});

test('respawn: the soldier beams in with a column of light', () => {
  const w = flatWorld();
  w.killPlayer('test');
  w.fx.length = 0;
  w.respawnPlayer(w.player.x, w.player.y);
  assert.ok(w.fx.some((f) => f.k === 'beam'));
  runWorld(w, makeInput(), 40);
  assert.ok(!w.fx.some((f) => f.k === 'beam'), 'it is over in under a second');
});

test('hit-stop: a death holds the world still for a few frames, then time runs again', () => {
  const { game, world } = playScene();
  const w = world();
  w.killPlayer('test');
  stepN(game, 1); // the scene reads the death and starts the hit-stop
  const t0 = w.time;
  stepN(game, HIT_STOP.death);
  assert.equal(w.time, t0, 'nothing moved during the hit-stop');
  stepN(game, 3);
  assert.ok(w.time > t0, 'the world is running again');
});

test('boss events: a phase change freezes briefly, and a boss going down plays in slow motion', () => {
  const { game, world } = playScene();
  const w = world();
  const scene = game.scene;
  scene.onEvent({ type: 'bossPhase', id: 'x', phase: 1 });
  assert.equal(scene.freezeF, HIT_STOP.phase);
  stepN(game, HIT_STOP.phase);
  scene.onEvent({ type: 'bossDying', id: 'x' });
  stepN(game, HIT_STOP.bossDown); // the freeze first
  const t0 = w.time;
  const n = Math.round(BOSS_SLOWMO * 60);
  stepN(game, n);
  const advanced = Math.round((w.time - t0) * 60);
  assert.ok(advanced >= n / 2 - 2 && advanced <= n / 2 + 2, `half speed: ${advanced} world frames in ${n} scene frames`);
  stepN(game, 30);
  assert.equal(scene.slowT <= 0, true);
});
