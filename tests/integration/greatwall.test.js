// Week 9 (China): firework launchers, terracotta guards, kite soldiers and the Dragon Kite Fortress.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { spawnArena } from '../support/fixtures.js';
import { World } from '../../src/game/world.js';
import { flatLevel } from '../../src/game/ascii.js';
import { buildLevel } from '../../src/game/levels.js';
import { TILE, DT } from '../../src/game/constants.js';
import { spawnEnemy, damageEnemy } from '../../src/game/enemies.js';
import { ENEMY_DEFS } from '../../src/game/enemy_defs.js';
import { launchRocket, fuseForRise } from '../../src/game/rocket.js';
import { fightBoss } from '../../tools/bossbot.js';

const FLOOR = 14 * TILE;

const arena = spawnArena;

test('firecrate: hisses for at least 0.6 s, then a rocket climbs and bursts into falling sparks', () => {
  const w = arena([{ type: 'firecrate', x: 12 * TILE, y: FLOOR, trig: 0 }]);
  const input = makeInput();
  w.player.x = 6 * TILE;
  w.camera.snap(w.player);
  run(w, input, 2);
  const c = w.enemies.find((e) => e.id === 'firecrate');
  assert.ok(c && c.arch === 'launcher');
  let teleAt = null;
  let rocketAt = null;
  let burstAt = null;
  let rocketTop = FLOOR;
  let sparks = 0;
  for (let k = 0; k < seconds(8) && burstAt === null; k++) {
    run(w, input, 1);
    if (c.state === 'tele' && teleAt === null) teleAt = w.time;
    const r = w.ebullets.find((b) => b.kind === 'rocket');
    if (r) {
      if (rocketAt === null) rocketAt = w.time;
      rocketTop = Math.min(rocketTop, r.y);
    }
    const s = w.ebullets.filter((b) => b.kind === 'spark');
    if (s.length) {
      burstAt = w.time;
      sparks = s.length;
      assert.ok(s.every((b) => b.g > 0), 'sparks fall under gravity');
    }
  }
  assert.ok(teleAt !== null && rocketAt !== null, 'it telegraphed, then fired');
  assert.ok(rocketAt - teleAt >= 0.6, `fuse lasted ${(rocketAt - teleAt).toFixed(2)} s`);
  assert.ok(burstAt !== null && sparks >= 6, `${sparks} sparks`);
  const rise = FLOOR - c.h - rocketTop;
  assert.ok(Math.abs(rise - ENEMY_DEFS.firecrate.rise) < 12, `rocket climbed ${rise.toFixed(0)} px, wanted ${ENEMY_DEFS.firecrate.rise}`);
  assert.ok(Math.abs(burstAt - rocketAt - fuseForRise(ENEMY_DEFS.firecrate.rise)) < 0.12, 'it bursts at the top of its climb');
});

test('rocket sparks hurt a soldier standing under the burst, but not one a few tiles away', () => {
  const trial = (dx) => {
    const w = arena([], { god: false });
    const input = makeInput();
    w.player.x = 20 * TILE;
    w.player.y = FLOOR;
    w.player.invuln = 0;
    w.camera.snap(w.player);
    run(w, input, 2);
    launchRocket(w, w.player.x + dx, FLOOR - 20, { tx: w.player.x + dx, ty: FLOOR - 104, fuse: fuseForRise(84), n: 6 });
    const seen = run(w, input, seconds(3));
    return seen.some((e) => e.type === 'playerDied');
  };
  assert.equal(trial(0), true, 'standing right under it');
  assert.equal(trial(110), false, 'well clear of it');
});

test('terracotta guard: stands like a statue until the soldier is close, and its shield stops flat shots only', () => {
  const w = arena([{ type: 'terracotta', x: 30 * TILE, y: FLOOR, trig: 0 }]);
  const input = makeInput();
  w.player.x = 10 * TILE;
  w.camera.snap(w.player);
  run(w, input, 30);
  const g = w.enemies.find((e) => e.id === 'terracotta');
  const x0 = g.x;
  run(w, input, seconds(1.5));
  assert.equal(g.x, x0, 'it does not move while the soldier is far away');
  w.player.x = x0 - 70;
  run(w, input, seconds(1));
  assert.ok(g.x < x0 - 5, 'it wakes and walks toward the soldier');
  g.face = -1; // shield toward the soldier on the left
  const hp = g.hp;
  damageEnemy(w, g, 1, { x: g.x - 6, y: g.y - 14, vx: 340, vy: 0 });
  assert.equal(g.hp, hp, 'a flat shot from the front is blocked');
  damageEnemy(w, g, 1, { x: g.x - 6, y: g.y - 30, vx: 240, vy: 240 });
  assert.equal(g.hp, hp - 1, 'a shot angled down over the shield lands');
});

test('kite soldier: drops firecrackers only while it is over the soldier', () => {
  const w = arena([], { god: true });
  const input = makeInput();
  w.player.x = 30 * TILE;
  w.player.y = FLOOR;
  w.camera.snap(w.player);
  run(w, input, 2);
  const k = spawnEnemy(w, { type: 'kitesoldier', x: w.player.x - 150, y: FLOOR - 90, face: 1 });
  let earliest = null;
  let drops = 0;
  for (let t = 0; t < seconds(8); t++) {
    run(w, input, 1);
    const c = w.ebullets.find((b) => b.kind === 'cracker' && !b.seen);
    if (c) {
      c.seen = true;
      drops++;
      if (earliest === null) earliest = Math.abs(c.x - w.player.x);
    }
    k.t = Math.min(k.t, 0.2); // keep it eager
  }
  assert.ok(drops >= 1, 'it bombs the soldier as it passes');
  assert.ok(earliest <= 48, `the first cracker fell ${earliest?.toFixed(0)} px from the soldier`);
});

test('Level 8: the forced march, the crates, the guards and the kites are all there', () => {
  const lvl = buildLevel(7);
  assert.equal(lvl.name, 'THE GREAT WALL');
  assert.equal(lvl.boss.type, 'dragonkite');
  assert.ok(lvl.zones.some((z) => z.type === 'autoscroll'), 'a forced march');
  const count = (id) => lvl.spawns.filter((s) => s.type === id).length;
  assert.ok(count('firecrate') >= 6 && count('terracotta') >= 6 && count('kitesoldier') >= 5);
  assert.ok(lvl.prompts.some((p) => /ROCKET/.test(p.text)), 'the rocket prompt');
});

// ---- the Dragon Kite Fortress ----
function bossWorld(opts = {}) {
  const lvl = buildLevel(7);
  const L = lvl.boss;
  const w = new World(lvl, { start: { x: L.x0 + 3 * TILE, y: L.floorY }, god: true, ...opts });
  const input = makeInput();
  for (let k = 0; k < 120 && !w.boss; k++) run(w, input, 1, ['right']);
  return { w, input, L };
}

test('Dragon Kite Fortress: it flies, so a shot has to climb to reach it', () => {
  const { w, input, L } = bossWorld();
  const b = w.boss;
  for (let k = 0; k < seconds(8) && b.bs.state === 'enter'; k++) run(w, input, 1);
  assert.ok(b.y < L.floorY - 40, `hovering at ${L.floorY - b.y} px above the floor`);
  assert.ok(b.hitBox().y1 < L.floorY - 40, 'the whole box is above head height');
  for (let k = 0; k < seconds(6) && !b.def.weakBox(b); k++) run(w, input, 1);
  const wb = b.def.weakBox(b);
  assert.ok(wb, 'the pearl shows');
  const muzzleOnFloor = L.floorY - 15;
  assert.ok(muzzleOnFloor > wb.y1, 'a flat shot from the floor passes beneath its head while it hovers');
});

test('Dragon Kite Fortress: pearl open while idle, breathing and after a crash; shut during rockets and the dive', () => {
  const { w, input } = bossWorld();
  const b = w.boss;
  for (let k = 0; k < seconds(8) && b.bs.state === 'enter'; k++) run(w, input, 1);
  const open = { };
  for (let k = 0; k < seconds(40); k++) {
    run(w, input, 1, ['up']);
    const key = `${b.bs.state}:${b.bs.atk || ''}${b.dv ? ':' + b.dv.mode : ''}`;
    open[key] = open[key] || [0, 0];
    open[key][b.def.weakBox(b) ? 0 : 1]++;
    if (b.bs.state === 'dying') break;
  }
  const isOpen = (key) => open[key] && open[key][0] > 0 && open[key][1] === 0;
  const isShut = (key) => open[key] && open[key][0] === 0 && open[key][1] > 0;
  assert.ok(isOpen('idle:'), JSON.stringify(open));
  assert.ok(isShut('attack:rockets') || !open['attack:rockets'], 'rockets: shut');
  assert.ok(isShut('attack:lunge:dive') || !open['attack:lunge:dive'], 'diving: shut');
  assert.ok(open['attack:lunge:crash'] ? isOpen('attack:lunge:crash') : true, 'crashed: open');
});

test('Dragon Kite Fortress: the lunge lands on the mark, crashes, and sends shockwaves along the floor', () => {
  const { w, input, L } = bossWorld();
  const b = w.boss;
  for (let k = 0; k < seconds(8) && b.bs.state === 'enter'; k++) run(w, input, 1);
  b.bs.state = 'idle';
  b.bs.cd = 0;
  b.def.phases[0].attacks = ['lunge'];
  b.bs.last = null;
  w.player.x = L.x0 + 200;
  let crashed = false;
  let waves = 0;
  let mark = null;
  let teleLen = 0;
  for (let k = 0; k < seconds(12) && !crashed; k++) {
    run(w, input, 1);
    if (b.bs.state === 'tele') teleLen = Math.max(teleLen, b.bs.teleMax);
    if (!mark && b.lx !== undefined) mark = b.lx;
    if (b.dv && b.dv.mode === 'crash') {
      crashed = true;
      waves = w.ebullets.filter((e) => e.kind === 'wave').length;
    }
  }
  assert.ok(crashed, 'it dived and crashed');
  assert.ok(teleLen >= 0.6, 'with a telegraph');
  assert.ok(Math.abs(b.x - mark) < 6, 'on the marked spot');
  assert.ok(Math.abs(b.y - L.floorY) < 3, 'on the floor');
  assert.equal(waves, 2, 'one shockwave each way');
  // the open head is low enough for a flat shot from a standing soldier
  const wb = b.def.weakBox(b);
  assert.ok(wb && L.floorY - 15 >= wb.y0 && L.floorY - 15 <= wb.y1, 'a standing soldier can hit it while it is down');
});

test('Dragon Kite Fortress: rockets burst over the soldier and the floor marks warn first', () => {
  const { w, input, L } = bossWorld();
  const b = w.boss;
  for (let k = 0; k < seconds(8) && b.bs.state === 'enter'; k++) run(w, input, 1);
  b.bs.state = 'idle';
  b.bs.cd = 0;
  b.def.phases[0].attacks = ['rockets'];
  b.bs.last = null;
  w.player.x = L.x0 + 160;
  let marks = 0;
  let rockets = 0;
  let sparks = 0;
  let firstMarkBeforeRocket = null;
  for (let k = 0; k < seconds(8); k++) {
    run(w, input, 1);
    const nm = w.fx.filter((f) => f.k === 'warn').length;
    marks = Math.max(marks, nm);
    const r = w.ebullets.filter((e) => e.kind === 'rocket').length;
    if (r && firstMarkBeforeRocket === null) firstMarkBeforeRocket = nm > 0;
    rockets = Math.max(rockets, r);
    sparks = Math.max(sparks, w.ebullets.filter((e) => e.kind === 'spark').length);
  }
  assert.ok(rockets >= 1 && sparks >= 6, `${rockets} rockets, ${sparks} sparks at once`);
  assert.equal(firstMarkBeforeRocket, true, 'a floor mark is already showing when the first rocket flies');
  assert.ok(marks >= 2, 'several marks');
});

test('Dragon Kite Fortress: summon calls kite soldiers in from both edges, within the enemy cap', () => {
  const { w, input } = bossWorld();
  const b = w.boss;
  for (let k = 0; k < seconds(8) && b.bs.state === 'enter'; k++) run(w, input, 1);
  b.bs.phase = 1;
  b.bs.state = 'idle';
  b.bs.cd = 0;
  b.def.phases[1].attacks = ['summon'];
  b.bs.last = null;
  let first = null;
  let most = 0;
  for (let k = 0; k < seconds(9); k++) {
    run(w, input, 1);
    const ks = w.enemies.filter((e) => e.alive && e.id === 'kitesoldier');
    if (!first && ks.length) first = ks.map((e) => e.x);
    most = Math.max(most, ks.length);
    assert.ok(w.crowd() <= w.enemyCap, 'within the enemy cap');
  }
  assert.equal(first.length, 2, 'two kites per call');
  assert.ok(first.some((x) => x < w.camera.x) && first.some((x) => x > w.camera.x + 480), 'one from each edge');
  assert.ok(most >= 2);
});

test('Dragon Kite Fortress: an ideal rifle fight is a clean kill, and a better weapon is faster', () => {
  const lvl = buildLevel(7);
  const rifle = fightBoss(lvl, { seconds: 300, style: 'under' });
  assert.ok(rifle.killed && rifle.time >= 40 && rifle.time <= 120, `rifle kill ${rifle.time?.toFixed(0)} s`);
  assert.ok(DT > 0);
});

// ---- set dressing ----
test('props: the builder stands them on the ground, and drawing them puts pixels on the screen (and nothing in the sim)', async () => {
  const { LevelBuilder } = await import('../../src/game/levelgen.js');
  const { SoftCanvas } = await import('../../tools/softcanvas.js');
  const { drawProps, PROPS } = await import('../../src/game/art/props.js');
  const b = new LevelBuilder({ id: 8, theme: 'fjord', seed: 1 });
  b.flat(20);
  b.prop('mast', 6);
  b.prop('prow', 10, { dir: -1 });
  b.prop('banner', 14, { h: 70 });
  b.exit();
  const lvl = b.finish();
  assert.equal(lvl.props.length, 3);
  assert.equal(lvl.props[0].y, 13 * TILE);
  assert.equal(lvl.props[0].x, 6 * TILE + TILE / 2);
  for (const kind of Object.keys(PROPS)) {
    const c = new SoftCanvas(480, 270);
    const w = { level: { props: [{ kind, x: 240, y: 200 }] }, time: 1 };
    drawProps(c.getContext('2d'), w, 0, 0);
    let px = 0;
    for (let i = 3; i < c.data.length; i += 4) if (c.data[i] > 0) px++;
    assert.ok(px > 60, `${kind} draws ${px} pixels`);
  }
  // props never block a soldier or a bullet: the same level with and without them solves identically
  const w = new World(lvl, { god: true });
  w.player.x = 5 * TILE;
  w.player.y = 13 * TILE;
  run(w, makeInput(), 120, ['right']);
  assert.ok(w.player.x > 12 * TILE, 'walked straight through the mast');
});
