// Hazards: quicksand and crushers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { World } from '../../src/game/world.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { solveLevel } from '../../src/game/solver.js';
import { spawnEnemy, damageEnemy } from '../../src/game/enemies.js';
import { T } from '../../src/game/tiles.js';
import { TILE, PLAYER, MAX_QUICKSAND_TILES } from '../../src/game/constants.js';
import { playBot } from '../../tools/bot.js';

function sandLevel(n) {
  const b = new LevelBuilder({ id: 4, theme: 'pyramid', seed: 5 });
  b.flat(10);
  const sand = b.quicksand(n);
  b.flat(12);
  b.exit();
  return { level: b.finish(), sand };
}

test('quicksand: builder shape, limit, and the solver can cross the widest legal pit', () => {
  const { level, sand } = sandLevel(MAX_QUICKSAND_TILES);
  for (let x = sand.x0; x < sand.x1; x++) {
    assert.equal(level.tiles[13 * level.cols + x], T.QUICK, 'sand at the surface row');
    assert.equal(level.tiles[14 * level.cols + x], T.SOLID, 'solid bed one tile down');
  }
  assert.throws(() => sandLevel(MAX_QUICKSAND_TILES + 1), /takes too long/);
  assert.ok(solveLevel(level).goal, 'it can be crossed on foot');
  const r = playBot(level, { seconds: 120 });
  assert.ok(r.cleared && r.falls === 0, 'the bot wades across');
});

test('quicksand slows the player to 45% and a full-width crossing is survivable', () => {
  const { level, sand } = sandLevel(MAX_QUICKSAND_TILES);
  const w = new World(level);
  const input = makeInput();
  w.player.x = (sand.x0 - 2) * TILE;
  w.player.y = 13 * TILE;
  let slow = null;
  let died = false;
  let done = false;
  for (let k = 0; k < seconds(8) && !done; k++) {
    const ev = run(w, input, 1, w.player.x > (sand.x1 + 1) * TILE ? [] : ['right', ...(w.player.grounded && w.player.x > (sand.x1 - 0.8) * TILE ? ['jump'] : [])]);
    if (w.player.inQuick && slow === null) slow = true;
    if (w.player.inQuick) assert.ok(Math.abs(w.player.vx) <= PLAYER.RUN * PLAYER.QUICK_SPEED + 1, `speed ${w.player.vx}`);
    if (ev.some((e) => e.type === 'playerDied')) died = true;
    if (w.player.x > (sand.x1 + 1) * TILE && w.player.grounded) done = true;
  }
  assert.ok(slow && !died && done, 'crossed without drowning');
  assert.ok(w.player.quickT < PLAYER.QUICK_DROWN);
});

test('quicksand: standing still drowns you after QUICK_DROWN seconds, and leaving it drains the meter', () => {
  const { level, sand } = sandLevel(6);
  const w = new World(level);
  const input = makeInput();
  w.player.x = (sand.x0 + 3) * TILE;
  w.player.y = 14 * TILE;
  let t = 0;
  let died = null;
  for (let k = 0; k < seconds(6) && died === null; k++) {
    const ev = run(w, input, 1);
    t += 1 / 60;
    if (ev.some((e) => e.type === 'playerDied')) died = t;
  }
  assert.ok(died !== null, 'drowned');
  assert.ok(Math.abs(died - PLAYER.QUICK_DROWN) < 0.25, `after ${died?.toFixed(2)} s`);
  // out in the open the meter drains
  const w2 = new World(level);
  w2.player.quickT = 2;
  w2.player.x = 4 * TILE;
  run(w2, input, seconds(1.2));
  assert.equal(w2.player.quickT, 0);
  // god mode never drowns
  const w3 = new World(level, { god: true });
  w3.player.x = (sand.x0 + 3) * TILE;
  w3.player.y = 14 * TILE;
  const ev3 = run(w3, input, seconds(5));
  assert.ok(!ev3.some((e) => e.type === 'playerDied'));
});

// ---------------------------------------------------------------- crushers

function crushWorld(extra = {}) {
  const b = new LevelBuilder({ id: 4, theme: 'pyramid', seed: 5 });
  b.flat(40);
  b.exit();
  const lvl = b.finish();
  lvl.spawns = [];
  const w = new World(lvl, extra);
  return w;
}

function addCrusher(w, col, opts = {}) {
  // bottom of the raised block 3 tiles up, floor at row 13
  return spawnEnemy(w, { type: 'crusher', x: col * TILE + 8, y: 10 * TILE - 8, drop: 13 * TILE - (10 * TILE - 8), ...opts });
}

test('crusher: telegraphs for at least 0.6 s, then slams, rests, and rises on a loop', () => {
  const w = crushWorld({ god: true });
  const c = addCrusher(w, 20);
  const input = makeInput();
  w.player.x = 5 * TILE;
  const seen = [];
  let teleT = 0;
  for (let k = 0; k < seconds(8); k++) {
    run(w, input, 1);
    if (!seen.length || seen.at(-1) !== c.state) seen.push(c.state);
    if (c.state === 'tele') teleT += 1 / 60;
  }
  assert.deepEqual(seen.slice(0, 5), ['up', 'tele', 'fall', 'rest', 'rise']);
  assert.ok(teleT >= 0.6 * 2 - 0.1, `winds up for ${teleT.toFixed(2)} s over two cycles`);
  assert.ok(seen.filter((s) => s === 'fall').length >= 2, 'it loops');
  // block lands on the floor
  assert.equal(c.indestructible ?? c.def.indestructible, true);
});

test('crusher kills whoever is under it when it lands, but not a player who runs through in time', () => {
  // standing under it
  let w = crushWorld();
  let c = addCrusher(w, 20);
  const input = makeInput();
  w.player.x = 20 * TILE + 8;
  w.player.y = 13 * TILE;
  w.camera.x = 10 * TILE;
  w.player.invuln = 0;
  const ev = run(w, input, seconds(4));
  assert.ok(ev.some((e) => e.type === 'playerDied'), 'crushed');
  assert.ok(c.alive);
  // timing the run: go under while it is up and winding up (it needs >= 0.8 s to land)
  w = crushWorld();
  c = addCrusher(w, 20, { phase: 0 });
  w.player.x = 17 * TILE;
  w.player.y = 13 * TILE;
  w.camera.x = 10 * TILE;
  let died = false;
  for (let k = 0; k < seconds(6); k++) {
    // wait until the block has just risen out of the way, then dash under
    const go = c.state === 'up' || c.state === 'rise' && c.y < c.top + 20;
    const ev2 = run(w, input, 1, go && w.player.x < 24 * TILE ? ['right'] : []);
    if (ev2.some((e) => e.type === 'playerDied')) died = true;
  }
  assert.ok(!died, 'safe if you cross while it is up');
});

test('crushers cannot be shot, burned or bombed away', () => {
  const w = crushWorld({ god: true });
  const c = addCrusher(w, 20);
  const hp = c.hp;
  damageEnemy(w, c, 50, { x: c.x, y: c.y - 5, vx: 300, vy: 0 });
  damageEnemy(w, c, 50, null, true);
  assert.ok(c.alive && c.hp === hp);
});
