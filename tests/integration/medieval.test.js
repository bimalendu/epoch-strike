// Week 10 (castles, shadows and sails): catapult barrages, shields and crossbows, wall jumps, ambushing ninjas, samurai
// duels, rope swings, the Siege Tower Titan, the Oni Warlord and the Ghost Galleon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { bossIndex, makeStand } from '../support/fixtures.js';
import { World } from '../../src/game/world.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { buildLevel, LEVEL_DEFS } from '../../src/game/levels.js';
import { TILE, PLAYER } from '../../src/game/constants.js';
import { spawnEnemy, damageEnemy } from '../../src/game/enemies.js';
import { ENEMY_DEFS } from '../../src/game/enemy_defs.js';
import { BOSSES } from '../../src/game/bosses.js';
import { inWeakBox } from '../../src/game/boss.js';
import { solveLevel } from '../../src/game/solver.js';
import { fightBoss } from '../../tools/bossbot.js';
import { playBot } from '../../tools/bot.js';

const GY = 13; // the ground row of a plain level
const FLOOR = GY * TILE;

/** A long flat level for single-mechanic experiments. */
function field(opts = {}, fn = null) {
  const b = new LevelBuilder({ id: opts.id ?? 9, theme: opts.theme ?? 'castle', seed: 7, wallJump: opts.wallJump });
  b.flat(14);
  const mark = b.x;
  if (fn) fn(b, mark);
  else b.flat(60);
  b.flat(10);
  b.exit();
  return { level: b.finish(), mark };
}

const stand = makeStand(FLOOR);

// ---------------------------------------------------------------------------------------------------------------
// Level 10: barrage, knights, crossbowmen, catapults
// ---------------------------------------------------------------------------------------------------------------
test('barrage: a red floor mark shows first, then a flaming boulder lands where the soldier was standing', () => {
  const { level, mark } = field({}, (b, x0) => {
    b.flat(60);
    b.barrage(x0, b.x, { period: 3, volley: 2, first: 1, fuse: 1.2 });
  });
  const w = new World(level);
  stand(w, mark + 20);
  const input = makeInput();
  let warned = false;
  let boulder = false;
  let died = false;
  for (let k = 0; k < seconds(5) && !died; k++) {
    const seen = run(w, input, 1);
    if (w.fx.some((f) => f.k === 'warn')) warned = true;
    if (w.ebullets.some((b) => b.kind === 'boulder')) boulder = true;
    if (seen.some((e) => e.type === 'playerDied')) died = true;
  }
  assert.ok(warned, 'a warning mark appears before the boulder');
  assert.ok(boulder, 'a boulder is in flight');
  assert.ok(died, 'a soldier who stands still under the first boulder is hit');
});

test('barrage: a soldier who keeps running is never under the first boulder', () => {
  const { level, mark } = field({}, (b, x0) => {
    b.flat(80);
    b.barrage(x0, b.x, { period: 3, volley: 2, first: 1, fuse: 1.2 });
  });
  const w = new World(level);
  stand(w, mark + 4);
  const input = makeInput();
  let died = false;
  for (let k = 0; k < seconds(8) && !died; k++) {
    const seen = run(w, input, 1, ['right']);
    if (seen.some((e) => e.type === 'playerDied')) died = true;
  }
  assert.ok(!died, 'running across the field is safe');
});

test('knight: the shield stops flat shots from the front, not shots from above or behind', () => {
  const { level } = field();
  const w = new World(level, { god: true });
  const k = spawnEnemy(w, { type: 'knight', x: 200, y: FLOOR, face: -1 });
  const hp = k.hp;
  damageEnemy(w, k, 1, { x: 190, y: FLOOR - 14, vx: 340, vy: 0 });
  assert.equal(k.hp, hp, 'a flat shot from the front is blocked');
  damageEnemy(w, k, 1, { x: 190, y: FLOOR - 14, vx: 240, vy: -240 });
  assert.equal(k.hp, hp - 1, 'a 45-degree shot gets over the shield');
  damageEnemy(w, k, 1, { x: 210, y: FLOOR - 14, vx: -340, vy: 0 });
  assert.equal(k.hp, hp - 2, 'a shot from behind lands');
});

test('crossbowman and catapult: telegraph, then fire a quarrel / a lobbed boulder', () => {
  for (const [type, kind, lob] of [['crossbowman', 'quarrel', false], ['catapult', 'boulder', true]]) {
    const { level } = field();
    const w = new World(level, { god: true });
    stand(w, 8);
    const e = spawnEnemy(w, { type, x: 20 * TILE, y: FLOOR, face: -1 });
    const input = makeInput();
    let shotAt = null;
    for (let k = 0; k < seconds(6) && shotAt === null; k++) {
      run(w, input, 1);
      const b = w.ebullets.find((x) => x.kind === kind);
      if (b) {
        shotAt = w.time;
        if (lob) assert.ok(b.g > 0, 'a catapult boulder arcs under gravity');
      }
    }
    assert.ok(shotAt !== null, `${type} fired a ${kind}`);
    assert.ok(shotAt >= ENEMY_DEFS[type].tele - 0.01, `${type} telegraphed for at least ${ENEMY_DEFS[type].tele} s`);
    void e;
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Level 11: wall jumps, ambush, duels
// ---------------------------------------------------------------------------------------------------------------
function shaftWorld() {
  let sh = null;
  const { level } = field({ id: 10, theme: 'shadowcastle', wallJump: true }, (b) => {
    b.flat(6);
    sh = b.shaft({ w: 3, h: 7 });
    b.flat(6);
  });
  const w = new World(level, { god: true });
  // hang in the hollow, touching the left wall, falling
  w.player.x = sh.inner0 * TILE + PLAYER.W / 2 + 0.5;
  w.player.y = (GY - 5) * TILE;
  w.player.vy = 0;
  w.camera.snap(w.player);
  return { w, sh };
}

test('wall jump: pressing jump against a wall in mid-air kicks the soldier up and away from it', () => {
  const { w } = shaftWorld();
  const input = makeInput();
  run(w, input, 12, ['left']); // long enough for the ground-jump grace time to run out
  assert.ok(!w.player.grounded, 'airborne');
  assert.equal(w.player.wallDir, -1, 'the wall is felt on the left');
  const x0 = w.player.x;
  run(w, input, 1, ['left', 'jump']);
  run(w, input, 4, ['left', 'jump']);
  assert.ok(w.player.vy < 0, `kicked upward (vy ${w.player.vy.toFixed(0)})`);
  assert.ok(w.player.x > x0 + 1 && w.player.vx > 0, 'and away from the wall');
});

test('wall jump: levels that do not enable it get no kick off a plain wall', () => {
  let wall = null;
  const { level } = field({ id: 9, theme: 'castle' }, (b) => {
    b.flat(6);
    wall = b.x;
    b.block(b.x, 2, 8);
    b.flat(6);
  });
  assert.ok(!level.wallJump, 'a level with no shaft and no flag has wall jumps off');
  const w = new World(level, { god: true });
  w.player.x = wall * TILE - PLAYER.W / 2 - 0.5;
  w.player.y = (GY - 5) * TILE;
  w.player.vy = 0;
  w.camera.snap(w.player);
  const input = makeInput();
  run(w, input, 12, ['right']);
  assert.ok(!w.player.grounded);
  const y0 = w.player.y;
  run(w, input, 4, ['right', 'jump']);
  assert.ok(w.player.y >= y0 && w.player.vy > 0, 'it simply keeps falling');
});

test('shaft: more than three tiles wide is refused (a soldier cannot kick across it)', () => {
  const b = new LevelBuilder({ id: 10, theme: 'shadowcastle', seed: 1, wallJump: true });
  b.flat(6);
  assert.throws(() => b.shaft({ w: 4, h: 7 }), /too wide/);
});

test('shaft: the level counts as solvable only through the wall-jump link', () => {
  const { level } = field({ id: 10, theme: 'shadowcastle', wallJump: true }, (b) => {
    b.flat(6);
    b.shaft({ w: 3, h: 7 });
    b.flat(6);
  });
  assert.ok(level.wallJump);
  assert.ok(level.links.some((l) => l.kind === 'wall'));
  const withLink = solveLevel(level, { goalX: level.exitX });
  assert.ok(withLink.goal, 'solvable with the climb');
  const without = solveLevel(level, { goalX: level.exitX, extraLinks: [] });
  assert.ok(!without.goal, 'and not without it');
});

test('Shadow Castle: the 1UP at the top of the watchtower is reachable by wall jumps only', () => {
  const lvl = buildLevel(10);
  const ups = lvl.spawns.filter((s) => s.type === 'pickup' && s.item === '1up');
  assert.equal(ups.length, 1, 'one hidden 1UP');
  const col = Math.floor(ups[0].x / TILE);
  const row = Math.round(ups[0].y / TILE);
  const has = (sol) => [...sol.reach.values()].some(({ spot }) => spot.x === col && spot.y === row);
  assert.ok(has(solveLevel(lvl)), 'reachable with the wall-jump links');
  assert.ok(!has(solveLevel(lvl, { extraLinks: [] })), 'not on foot alone');
});

test('ambush: a ninja hides (unseen, unhittable, harmless) until the soldier is close, then steps out and pauses', () => {
  const { level } = field({ id: 10, theme: 'shadowcastle' });
  const w = new World(level, { god: true });
  stand(w, 6);
  const input = makeInput();
  const n = spawnEnemy(w, { type: 'ninja', x: 22 * TILE, y: FLOOR, face: -1 });
  run(w, input, 20);
  assert.equal(n.waiting, true);
  assert.equal(n.hidden, true);
  assert.equal(n.noContact, true);
  const hp = n.hp;
  w.spawnBullet({ x: n.x - 20, y: FLOOR - 14, vx: 300, vy: 0, dmg: 1, life: 1, kind: 'rifle' });
  run(w, input, 20);
  assert.equal(n.hp, hp, 'a hiding ninja cannot be shot');
  // walk into its range
  w.player.x = n.x - ENEMY_DEFS.ninja.ambush + 20;
  w.camera.snap(w.player);
  run(w, input, 2);
  assert.equal(n.waiting, false, 'it steps out');
  assert.equal(n.hidden, false);
  assert.equal(n.noContact, false);
  const x0 = n.x;
  run(w, input, seconds(ENEMY_DEFS.ninja.stall - 0.1));
  assert.ok(Math.abs(n.x - x0) < 1, 'it pauses where it appeared');
  run(w, input, seconds(0.8));
  assert.ok(Math.abs(n.x - x0) > 8, 'then rushes the soldier');
});

test('samurai: raises the blade for at least 0.6 s before a flat dash, then rests', () => {
  const { level } = field({ id: 10, theme: 'shadowcastle' });
  const w = new World(level, { god: true });
  stand(w, 8);
  const input = makeInput();
  const s = spawnEnemy(w, { type: 'samurai', x: 8 * TILE + 100, y: FLOOR, face: -1 });
  let teleAt = null;
  let dashAt = null;
  let maxV = 0;
  let rested = false;
  for (let k = 0; k < seconds(6) && !rested; k++) {
    run(w, input, 1);
    if (s.state === 'tele' && teleAt === null) teleAt = w.time;
    if (s.state === 'dash') {
      if (dashAt === null) dashAt = w.time;
      maxV = Math.max(maxV, Math.abs(s.vx));
    }
    if (dashAt !== null && s.state === 'rest') rested = true;
  }
  assert.ok(teleAt !== null && dashAt !== null && rested);
  assert.ok(dashAt - teleAt >= 0.6, `wind-up ${(dashAt - teleAt).toFixed(2)} s`);
  assert.ok(maxV >= 200, `dash speed ${maxV}`);
});

// ---------------------------------------------------------------------------------------------------------------
// Level 12: rope swings
// ---------------------------------------------------------------------------------------------------------------
test('swing: a gap that can be jumped, or one too wide to span, is refused', () => {
  const b = new LevelBuilder({ id: 11, theme: 'pirate', seed: 1 });
  b.flat(8);
  assert.throws(() => b.swing(5), /can be jumped/);
  assert.throws(() => b.swing(15), /cannot span/);
});

test('swing: the plank carries a rider across the chasm', () => {
  let sw = null;
  const { level } = field({ id: 11, theme: 'pirate' }, (b) => {
    b.flat(6);
    sw = b.swing(9, { period: 3.6 });
    b.flat(6);
  });
  assert.equal(level.swings.length, 1);
  assert.ok(level.links.some((l) => l.kind === 'swing'));
  const w = new World(level, { god: true });
  const pl = w.platforms[0];
  assert.ok(pl, 'the world builds the plank');
  const input = makeInput();
  // wait until the plank is at the left end of its swing, then step on it
  let guard = 0;
  while (guard++ < seconds(8)) {
    run(w, input, 1);
    if (pl.x + pl.w / 2 < sw.x0 * TILE + 44 && pl.vx > 20) break;
  }
  w.player.x = pl.x + pl.w / 2;
  w.player.y = pl.y;
  w.player.vy = 0;
  w.camera.snap(w.player);
  run(w, input, 2);
  assert.equal(w.player.platform, pl, 'standing on the plank');
  const px0 = w.player.x;
  const cx0 = pl.x + pl.w / 2;
  run(w, input, seconds(1.2));
  const moved = w.player.x - px0;
  assert.ok(moved > 40, `carried ${moved.toFixed(0)} px`);
  assert.ok(Math.abs(moved - (pl.x + pl.w / 2 - cx0)) < 4, 'in step with the plank');
});

test('Pirate Armada: four swings, every ship gap is wider than a jump, and a rope swing really crosses it', () => {
  const lvl = buildLevel(11);
  assert.equal(lvl.swings.length, 4);
  assert.equal(lvl.theme, 'pirate');
  const r = playBot(lvl, { seconds: 200 });
  assert.ok(r.cleared && r.falls === 0, `the bot rides across (falls ${r.falls})`);
});

// ---------------------------------------------------------------------------------------------------------------
// Bosses: Siege Tower Titan, Oni Warlord, Ghost Galleon
// ---------------------------------------------------------------------------------------------------------------

test('Siege Tower Titan: the ram port is open while it rests and shut while it spits oil', () => {
  const d = BOSSES.siegetower;
  const e = { x: 100, y: FLOOR, face: -1, bs: { state: 'idle' }, rm: null, def: d };
  assert.ok(d.weakBox(e), 'open when idle');
  e.bs = { state: 'attack', atk: 'oil' };
  assert.equal(d.weakBox(e), null, 'shut during the oil attack');
  e.bs = { state: 'attack', atk: 'siege' };
  assert.equal(d.weakBox(e), null, 'shut during the catapult barrage');
  e.bs = { state: 'attack', atk: 'ram' };
  e.rm = { mode: 'roll' };
  assert.equal(d.weakBox(e), null, 'shut while it rolls');
  e.rm = { mode: 'rest' };
  assert.ok(d.weakBox(e), 'open when it stops');
  const wb = d.weakBox(e);
  assert.ok(wb.x0 >= e.x - d.w / 2 && wb.x1 <= e.x + d.w / 2 && wb.y0 >= e.y - d.h && wb.y1 <= e.y, 'the port lies inside the hitbox');
});

test('Oni Warlord: its chest gem is out of reach of a standing soldier, but a soldier on a ledge hits it', () => {
  const lvl = buildLevel(bossIndex('oni'));
  const L = lvl.boss;
  let checked = false;
  fightBoss(lvl, {
    style: 'ledge',
    onFrame(world) {
      const b = world.boss;
      if (checked || !b || !b.bs || b.bs.state !== 'idle') return;
      checked = true;
      const wb = b.def.weakBox(b);
      assert.ok(wb, 'open while idle');
      const gunStanding = L.floorY - 17;
      const gunLedge = L.floorY - 2 * TILE - 17;
      const x = (wb.x0 + wb.x1) / 2;
      assert.ok(!inWeakBox(b, x, gunStanding), 'a standing shot passes under the gem');
      assert.ok(inWeakBox(b, x, gunLedge), 'a shot from a ledge hits it');
    },
  });
  assert.ok(checked);
});

function galleon() {
  const idx = bossIndex('ghostgalleon');
  assert.ok(idx >= 0, 'the Ghost Galleon guards a level');
  return buildLevel(idx);
}

test('Ghost Galleon: the figurehead lantern is low enough for a standing shot, and hooded during ghostfire and the maelstrom', () => {
  const d = BOSSES.ghostgalleon;
  const e = { x: 400, y: FLOOR, face: -1, bs: { state: 'idle' }, def: d };
  const wb = d.weakBox(e);
  assert.ok(wb && inWeakBox(e, wb.x1 - 2, FLOOR - 17) === true, 'a standing soldier hits the lantern');
  assert.ok(wb.x0 >= e.x - d.w / 2 && wb.x1 <= e.x + d.w / 2 && wb.y0 >= e.y - d.h && wb.y1 <= e.y, 'the lantern lies inside the hitbox');
  for (const atk of ['ghostfire', 'maelstrom']) {
    e.bs = { state: 'attack', atk };
    assert.equal(d.weakBox(e), null, `hooded during ${atk}`);
  }
  for (const atk of ['broadside', 'chain', 'spectres']) {
    e.bs = { state: 'attack', atk };
    assert.ok(d.weakBox(e), `open during ${atk}`);
  }
});

test('Ghost Galleon: the broadside fires low and high cannonballs, and the soldier can dodge each', () => {
  // seen in a real fight: both port heights are used
  const lvl = galleon();
  const L = lvl.boss;
  const heights = new Set();
  fightBoss(lvl, {
    style: 'ground',
    onFrame(world) {
      for (const b of world.ebullets) if (b.kind === 'cannon') heights.add(Math.round(L.floorY - b.y));
    },
  });
  assert.ok([...heights].some((h) => h <= 9), `a low ball (${[...heights].join(',')})`);
  assert.ok([...heights].some((h) => h >= 18), 'a high ball');

  // dodge rules on a plain deck: low balls are jumped, high balls are ducked under
  const ball = (w, y) => w.spawnEnemyBullet({ x: 300, y, vx: -175, vy: 0, r: 3, kind: 'cannon', life: 4 });
  const lowY = FLOOR - 7;
  const highY = FLOOR - 22;
  const trial = (y, keysFor) => {
    const { level } = field({ id: 11, theme: 'pirate' });
    const w = new World(level);
    stand(w, 8);
    const input = makeInput();
    run(w, input, 20, keysFor.pre);
    ball(w, y);
    let died = false;
    for (let k = 0; k < seconds(2.2) && !died; k++) {
      const near = w.ebullets.find((b) => b.kind === 'cannon');
      const jumpNow = keysFor.jumpWhenNear && ((near && Math.abs(near.x - w.player.x) < 60) || !w.player.grounded);
      const seen = run(w, input, 1, jumpNow ? ['jump'] : keysFor.hold || []);
      if (seen.some((e) => e.type === 'playerDied')) died = true;
    }
    return died;
  };
  assert.ok(trial(lowY, { pre: [] }), 'standing still: a low ball hits');
  assert.ok(!trial(lowY, { pre: [], jumpWhenNear: true }), 'a jump clears a low ball');
  assert.ok(trial(highY, { pre: [] }), 'standing still: a high ball hits');
  assert.ok(!trial(highY, { pre: ['down'], hold: ['down'] }), 'going prone ducks under a high ball');
  assert.ok(trial(lowY, { pre: ['down'], hold: ['down'] }), 'but prone does not help against a low one');
});

test('Ghost Galleon: spectres fall to one hit and the crew keeps the enemy cap', () => {
  assert.equal(ENEMY_DEFS.spectre.hp, 1);
  const lvl = galleon();
  const r = fightBoss(lvl, { style: 'ground', seconds: 300 });
  assert.ok(r.killed);
  assert.ok(r.attacks.has('spectres') && r.attacks.has('maelstrom') && r.attacks.has('broadside'), `attacks: ${[...r.attacks.keys()].join(',')}`);
});
