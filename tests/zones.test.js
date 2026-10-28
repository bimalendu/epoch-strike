import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from './helpers.js';
import { World } from '../src/game/world.js';
import { LevelBuilder } from '../src/game/levelgen.js';
import { solveLevel } from '../src/game/solver.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { T } from '../src/game/tiles.js';
import { TILE, VIEW_W } from '../src/game/constants.js';

/** Flat ground, then a lava-rise zone with a high platform road over it, then ground again. */
function lavaLevel({ highRoad = true } = {}) {
  const b = new LevelBuilder({ id: 1, theme: 'volcano', seed: 5 });
  b.flat(10);
  const x0 = b.x;
  b.flat(40);
  const x1 = b.x;
  if (highRoad) for (let k = 0; k < 6; k++) b.platform(x0 + 1 + k * 7, 10, 5);
  b.lavaRise(x0, x1, { endRow: 11, interval: 2 });
  b.flat(12);
  b.exit();
  return { level: b.finish(), x0, x1 };
}

test('lava rises one row per interval once the player reaches the zone, up to endRow', () => {
  const { level, x0 } = lavaLevel();
  const w = new World(level, { god: true });
  const input = makeInput();
  const row = (y) => w.tile(x0 + 3, y);
  run(w, input, seconds(3)); // before the zone: nothing happens
  assert.equal(row(16), T.SOLID);
  w.player.x = (x0 + 2) * TILE;
  w.player.y = 10 * TILE;
  run(w, input, seconds(2.2));
  assert.equal(row(16), T.LAVA, 'bottom row flooded after one interval');
  assert.equal(row(15), T.SOLID, 'but not yet the next one');
  run(w, input, seconds(14));
  for (let y = 11; y < 17; y++) assert.equal(row(y), T.LAVA, `row ${y} is lava at the end`);
  assert.notEqual(row(10), T.LAVA, 'rises no further than endRow');
  assert.ok(w.tilesDirty === false || w.tilesDirty === true);
});

test('rising lava kills a player left on the valley floor but not one on the high road', () => {
  const { level, x0 } = lavaLevel();
  // low: stand on the valley floor
  let w = new World(level);
  let input = makeInput();
  w.player.x = (x0 + 3) * TILE;
  w.player.y = 13 * TILE;
  w.camera.x = (x0 - 4) * TILE; // keep the camera on the zone so the player is not clamped away
  w.camera.lockMin = w.camera.lockMax = w.camera.x;
  const lowEvents = run(w, input, seconds(12));
  assert.ok(lowEvents.some((e) => e.type === 'playerDied' || e.type === 'hazard'), 'burned');
  // high: stand on a platform
  w = new World(level);
  input = makeInput();
  w.player.x = (x0 + 3) * TILE;
  w.player.y = 10 * TILE;
  w.camera.x = (x0 - 4) * TILE;
  w.camera.lockMin = w.camera.lockMax = w.camera.x;
  const highEvents = run(w, input, seconds(14));
  assert.ok(!highEvents.some((e) => e.type === 'playerDied' || e.type === 'hazard'), 'survives on the platform');
});

test('solver judges a lava zone by its final terrain', () => {
  assert.ok(solveLevel(lavaLevel({ highRoad: true }).level).goal, 'the high road is a route');
  assert.equal(solveLevel(lavaLevel({ highRoad: false }).level).goal, null, 'valley floor alone melts, so no route');
});

test('autoscroll keeps pushing the camera and drags a player who stands still', () => {
  const b = new LevelBuilder({ id: 1, seed: 5 });
  b.flat(10);
  b.flat(60);
  b.autoscroll(10, 70, 60);
  b.flat(30);
  b.exit();
  const w = new World(b.finish(), { god: true });
  const input = makeInput();
  w.player.x = 11 * TILE;
  w.camera.x = 6 * TILE;
  w.camera.lockMin = null;
  const x0 = w.camera.x;
  run(w, input, seconds(3));
  assert.ok(w.camera.x - x0 > 150 && w.camera.x - x0 < 200, `camera moved ${w.camera.x - x0}px in 3 s at 60 px/s`);
  assert.ok(w.player.x >= w.camera.x + 5, 'the player is held inside the screen');
  assert.ok(w.player.x < w.camera.x + VIEW_W, 'and was not left behind');
});

test('autoscroll lets a fast player pull ahead', () => {
  const b = new LevelBuilder({ id: 1, seed: 5 });
  b.flat(10); b.flat(60); b.autoscroll(10, 70, 30); b.flat(30); b.exit();
  const w = new World(b.finish(), { god: true });
  const input = makeInput();
  w.player.x = 11 * TILE;
  w.camera.x = 6 * TILE;
  run(w, input, seconds(3), ['right']);
  assert.ok(w.camera.x - 6 * TILE > 30 * 3 + 20, 'camera follows a running player faster than the minimum');
});

// ---- icicles ----
function iceWorld(extra = []) {
  const b = new LevelBuilder({ id: 2, theme: 'glacier', seed: 5 });
  b.flat(40);
  b.exit();
  const lvl = b.finish();
  lvl.spawns = extra;
  return new World(lvl);
}

test('icicle: hangs until the player is beneath it, shakes for >=0.7 s, falls, and kills', () => {
  const w = iceWorld([{ type: 'icicle', x: 12 * TILE, y: 5 * TILE, trig: 0 }]);
  const input = makeInput();
  run(w, input, 2);
  const ic = w.enemies[0];
  assert.equal(ic.state, 'idle');
  run(w, input, seconds(1));
  assert.equal(ic.state, 'idle', 'player far away: it hangs');
  w.player.x = 12 * TILE;
  w.player.y = 13 * TILE;
  let teleT = 0;
  let died = false;
  for (let k = 0; k < seconds(3); k++) {
    const ev = run(w, input, 1);
    if (ic.alive && ic.state === 'tele') teleT += 1 / 60;
    if (ev.some((e) => e.type === 'playerDied')) died = true;
  }
  assert.ok(teleT >= 0.7, `warning shake ${teleT.toFixed(2)}s`);
  assert.ok(died, 'standing under it is fatal');
  assert.equal(ic.alive, false, 'it shattered on the ground');
});

test('icicle: moving away in time avoids it, and a shot destroys it early', () => {
  const w = iceWorld([{ type: 'icicle', x: 12 * TILE, y: 5 * TILE, trig: 0 }]);
  const input = makeInput();
  run(w, input, 2);
  w.player.x = 12 * TILE;
  w.player.y = 13 * TILE;
  run(w, input, 5); // triggers
  const ic = w.enemies[0];
  assert.equal(ic.state, 'tele');
  const ev = [];
  for (let k = 0; k < seconds(2.5); k++) ev.push(...run(w, input, 1, ['right']));
  assert.ok(!ev.some((e) => e.type === 'playerDied'), 'ran out from under it');

  const w2 = iceWorld([{ type: 'icicle', x: 12 * TILE, y: 5 * TILE, trig: 0 }]);
  run(w2, makeInput(), 2);
  const ic2 = w2.enemies[0];
  w2.player.x = 12 * TILE;
  w2.player.y = 13 * TILE;
  w2.player.face = 1;
  // aim straight up and shoot it
  const inp = makeInput();
  run(w2, inp, 20, ['up', 'fire']);
  assert.equal(ic2.alive, false, 'shot out of the air');
});

test('ice is slippery: stopping takes distance, and it is solid', () => {
  const b = new LevelBuilder({ id: 2, seed: 5 });
  b.flat(40, { tile: T.ICE });
  b.exit();
  const w = new World(b.finish(), { god: true });
  const input = makeInput();
  run(w, input, 30, ['right']);
  const x = w.player.x;
  run(w, input, 10); // let go
  assert.ok(w.player.x - x > 8, `slid ${w.player.x - x}px after letting go`);
  void spawnEnemy;
});
