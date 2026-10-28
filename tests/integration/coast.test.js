// The beach and the tank: Level 16, the rideable tank, landmines, bunkers and anti-tank guns, naval gunfire,
// fighters and the Super-Heavy Tank.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { makeStand } from '../support/fixtures.js';
import { World } from '../../src/game/world.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { buildLevel } from '../../src/game/levels.js';
import { TILE, TANK, PLAYER, enemyCapFor } from '../../src/game/constants.js';
import { spawnEnemy, damageEnemy } from '../../src/game/enemies.js';
import { ENEMY_DEFS } from '../../src/game/enemy_defs.js';
import { BOSSES } from '../../src/game/bosses.js';
import { inWeakBox } from '../../src/game/boss.js';
import { eraWeaponFor } from '../../src/game/weapons.js';
import { T } from '../../src/game/tiles.js';
import { fightBoss } from '../../tools/bossbot.js';

const FLOOR = 13 * TILE;

function field(fn = null, opts = {}) {
  const b = new LevelBuilder({ id: opts.id ?? 15, theme: 'beach', seed: 12 });
  b.flat(14);
  const mark = b.x;
  if (fn) fn(b, mark);
  else b.flat(60);
  b.flat(10);
  b.exit();
  return { level: b.finish(), mark };
}

/** A flat beach with a tank road of 36 columns that starts 4 columns in. */
function roadField(opts = {}) {
  const road = { x0: 0, x1: 0 };
  const { level } = field((b, x0) => {
    b.flat(50);
    road.x0 = x0 + 4;
    road.x1 = x0 + 40;
    b.tankRoad(road.x0, road.x1, opts);
  });
  return { level, road };
}

/** A world whose soldier has just climbed into the road's tank and been moved `dx` tiles along it. */
function mounted(level, road, opts = {}, dx = 6) {
  const w = new World(level, opts);
  w.player.x = (road.x0 + 1) * TILE;
  w.player.y = FLOOR;
  w.camera.snap(w.player);
  run(w, makeInput(), 2, []);
  assert.equal(w.player.mode, 'tank', 'boarded');
  w.player.x = (road.x0 + dx) * TILE;
  w.camera.snap(w.player);
  return w;
}

const stand = makeStand(FLOOR);

const seen = (events, type) => events.filter((e) => e.type === type);

// ---------------------------------------------------------------------------------------------------------------
// The rideable tank
// ---------------------------------------------------------------------------------------------------------------
test('tank: walking into the start of a tank road boards the parked tank, and it is wider and slower than a soldier', () => {
  const { level, road } = roadField();
  const w = new World(level);
  assert.equal(w.player.mode, 'foot');
  stand(w, road.x0 - 3);
  const input = makeInput();
  run(w, input, seconds(0.6), ['right']);
  const p = w.player;
  assert.equal(p.mode, 'tank');
  assert.equal(p.tankHp, TANK.HP);
  assert.ok(p.w === TANK.W && p.h === TANK.H && p.w > PLAYER.W && TANK.RUN < PLAYER.RUN);
  // top speed is the tank's, not the soldier's
  const x0 = p.x;
  run(w, input, seconds(0.5), ['right']);
  const v = (p.x - x0) / 0.5;
  assert.ok(v <= TANK.RUN + 2 && v > TANK.RUN * 0.8, `speed ${v.toFixed(0)}`);
});

test('tank: it ends at the road end (the soldier climbs out) and a tank picked up elsewhere is never taken away', () => {
  const { level, road } = roadField();
  const w = mounted(level, road, { god: true });
  const input = makeInput();
  assert.equal(w.player.mode, 'tank');
  assert.equal(w.player.tankRoad && w.player.tankRoad.x0, road.x0 * TILE, 'the tank belongs to its road');
  w.player.x = road.x1 * TILE + 4;
  run(w, input, 3, []);
  assert.equal(w.player.mode, 'foot', 'on foot after the road');
  assert.equal(w.player.w, PLAYER.W);
  // a spare tank (a pickup far from any road) is kept wherever it is driven
  const lvl = buildLevel(15);
  const w2 = new World(lvl, { god: true });
  const spare = w2.level.spawns.filter((s) => s.type === 'pickup' && s.item === 'tank');
  assert.ok(spare.length >= 2, 'a tank at the start of the road and a spare one before the boss');
  const far = spare.reduce((a, s) => (s.x > a.x ? s : a));
  w2.player.x = far.x;
  w2.player.y = far.y;
  w2.camera.snap(w2.player);
  run(w2, input, seconds(0.3), []);
  assert.equal(w2.player.mode, 'tank', 'picked up the spare tank');
  assert.equal(w2.player.tankRoad, null);
  run(w2, input, seconds(1.5), ['right']);
  assert.equal(w2.player.mode, 'tank', 'and it was not dismounted straight away');
});

test('tank: it soaks four hits, then blows up and throws the soldier clear alive', () => {
  const { level, road } = roadField();
  const w = mounted(level, road);
  const p = w.player;
  assert.equal(p.mode, 'tank');
  for (let i = 1; i <= TANK.HP - 1; i++) {
    p.invuln = 0;
    assert.ok(w.hurtPlayer('enemy'));
    assert.ok(p.alive && p.mode === 'tank' && p.tankHp === TANK.HP - i, `hit ${i}`);
    assert.ok(p.invuln > 0.5, 'a short grace after each hit');
  }
  p.invuln = 0;
  w.hurtPlayer('enemy');
  assert.ok(p.alive, 'the soldier survives the wreck');
  assert.equal(p.mode, 'foot');
  assert.ok(p.invuln >= TANK.EJECT_INVULN - 0.01, 'and is invulnerable for a moment');
  assert.ok(p.vy < 0, 'thrown upward');
  assert.ok(seen(w.events, 'tankLost').length === 1);
  // on foot again, the next hit is fatal
  p.invuln = 0;
  w.hurtPlayer('enemy');
  assert.ok(!p.alive);
});

test('tank: falling and drowning are still fatal; a tank does not drop through platforms or lie prone', () => {
  const { level, road } = roadField();
  for (const cause of ['fell', 'quicksand']) {
    const w = mounted(level, road);
    w.player.invuln = 0;
    w.hurtPlayer(cause);
    assert.ok(!w.player.alive, `${cause} kills even a tank`);
  }
  const w = mounted(level, road, { god: true });
  const input = makeInput();
  run(w, input, seconds(0.3), ['down']);
  assert.ok(!w.player.prone && w.player.h === TANK.H, 'no ducking in a tank');
});

test('tank: the cannon fires a shell whose blast also hurts enemies standing next to the target, but never a boss', () => {
  const { level, road } = roadField();
  const w = mounted(level, road, { god: true });
  const input = makeInput();
  const x = w.player.x;
  const a = spawnEnemy(w, { type: 'garrison', x: x + 120, y: FLOOR, face: -1 });
  const b = spawnEnemy(w, { type: 'garrison', x: x + 134, y: FLOOR, face: -1 });
  const far = spawnEnemy(w, { type: 'garrison', x: x + 200, y: FLOOR, face: -1 });
  for (const e of [a, b, far]) {
    e.hp = e.maxHp = 10;
    e.def = { ...e.def, fireEvery: 99, firstDelay: 99 };
  }
  run(w, input, 1, ['fire']);
  assert.equal(w.bullets.filter((q) => q.kind === 'tankshell').length, 1);
  run(w, input, seconds(0.6), []);
  assert.ok(a.hp <= 10 - TANK.SHELL_DMG, `hit directly (${a.hp})`);
  assert.ok(b.hp < 10 && b.hp > a.hp, `caught in the blast (${b.hp})`);
  assert.equal(far.hp, 10, 'but only nearby');
  // the cannon is slow: holding fire gives one shell per cooldown
  w.bullets.length = 0;
  let shells = 0;
  const before = w.time;
  while (w.time - before < 2.0) {
    run(w, input, 1, ['fire']);
    shells = Math.max(shells, w.bullets.filter((q) => q.kind === 'tankshell').length);
  }
  assert.ok(shells <= 2, `cooldown ${TANK.COOLDOWN} s, at most two shells in flight (${shells})`);
});

test('tank: driving into infantry crushes them without hurting the tank, but a runner that is not a soldier on foot still bites', () => {
  const { level, road } = roadField();
  const w = mounted(level, road);
  const input = makeInput();
  const g = spawnEnemy(w, { type: 'garrison', x: w.player.x + 30, y: FLOOR, face: -1 });
  g.def = { ...g.def, fireEvery: 99, firstDelay: 99 };
  const s = spawnEnemy(w, { type: 'stormtrooper', x: w.player.x + 70, y: FLOOR, face: -1 });
  run(w, input, seconds(1.2), ['right']);
  assert.ok(!g.alive && !s.alive, 'both crushed');
  assert.equal(w.player.tankHp, TANK.HP, 'the tank was not scratched');
  assert.ok(w.player.alive && w.player.mode === 'tank');
  // heavy things are not crushable
  assert.ok(!ENEMY_DEFS.bunker.crush && !ENEMY_DEFS.atgun.crush && !ENEMY_DEFS.mine.crush);
  assert.ok(!BOSSES.supertank.crush);
});

test('tank: a soldier who dies inside a tank zone respawns in a fresh tank, outside it on foot', () => {
  const { level, road } = roadField();
  const w = new World(level);
  stand(w, road.x0 + 10);
  run(w, makeInput(), 2, []);
  w.player.tankHp = 1;
  w.player.invuln = 0;
  w.killPlayer('fell');
  w.respawnPlayer((road.x0 + 12) * TILE, FLOOR);
  assert.equal(w.player.mode, 'tank');
  assert.equal(w.player.tankHp, TANK.HP, 'a fresh tank');
  w.killPlayer('fell');
  w.respawnPlayer(3 * TILE, FLOOR);
  assert.equal(w.player.mode, 'foot');
});

test('tankRoad(): refuses a road with a pit or a step in it', () => {
  const gap = new LevelBuilder({ id: 15, theme: 'beach', seed: 1 });
  gap.flat(10);
  gap.pit(3);
  gap.flat(10);
  assert.throws(() => gap.tankRoad(5, 20), /flat|blocked/);
  const step = new LevelBuilder({ id: 15, theme: 'beach', seed: 1 });
  step.flat(10);
  step.up(2);
  step.flat(10);
  assert.throws(() => step.tankRoad(5, 20), /flat/);
  const ok = new LevelBuilder({ id: 15, theme: 'beach', seed: 1 });
  ok.flat(30);
  assert.doesNotThrow(() => ok.tankRoad(5, 25));
});

// ---------------------------------------------------------------------------------------------------------------
// Landmines
// ---------------------------------------------------------------------------------------------------------------
function mineField(count = 1, gap = 0) {
  let mx = 0;
  const { level } = field((b, x0) => {
    b.flat(60);
    mx = (x0 + 24) * TILE + 8;
  });
  const w = new World(level);
  const mines = [];
  for (let i = 0; i < count; i++) mines.push(spawnEnemy(w, { type: 'mine', x: mx + i * gap, y: FLOOR, face: 1 }));
  return { w, mines, mx };
}

test('mine: it pops up and warns for at least 0.45 s before it bursts, and a soldier who stays on top of it is hurt', () => {
  const { w, mines, mx } = mineField();
  const m = mines[0];
  w.player.x = mx - 10;
  w.player.y = FLOOR;
  w.camera.snap(w.player);
  const input = makeInput();
  run(w, input, seconds(0.1), []);
  assert.equal(m.state, 'tele', 'triggered by a soldier close by');
  assert.ok(w.player.alive);
  run(w, input, seconds(0.35), []);
  assert.ok(m.alive && w.player.alive, 'still warning at 0.45 s');
  run(w, input, seconds(0.3), []);
  assert.ok(!m.alive && !w.player.alive, 'the burst caught the soldier who stood there');
});

test('mine: running on is safe, and a mine shot from a distance bursts harmlessly', () => {
  const { w, mines, mx } = mineField();
  w.player.x = mx - 60;
  w.player.y = FLOOR;
  w.camera.snap(w.player);
  const input = makeInput();
  run(w, input, seconds(1.5), ['right']);
  assert.ok(w.player.alive, 'ran straight over it');
  assert.ok(!mines[0].alive, 'and it went off behind them');
  const far = mineField();
  far.w.player.x = far.mx - 110;
  far.w.player.y = FLOOR;
  far.w.camera.snap(far.w.player);
  damageEnemy(far.w, far.mines[0], 1, { x: far.mx - 100, y: FLOOR - 4, vx: 100, vy: 0 });
  run(far.w, input, 2, []);
  assert.ok(!far.mines[0].alive && far.w.player.alive, 'shot from afar');
});

test('mine: a burst sets off the next mine a beat later; a mine hurts a tank for one hit, not the whole tank', () => {
  const { w, mines, mx } = mineField(2, 18);
  const input = makeInput();
  damageEnemy(w, mines[0], 1, { x: mx, y: FLOOR - 4, vx: 0, vy: 0 });
  assert.ok(!mines[0].alive);
  assert.equal(mines[1].state, 'tele', 'its neighbour was set off');
  run(w, input, seconds(0.4), []);
  assert.ok(!mines[1].alive, 'and burst');
  const { level, road } = roadField();
  const t = mounted(level, road, {}, 10);
  const m = spawnEnemy(t, { type: 'mine', x: t.player.x + 6, y: FLOOR, face: 1 });
  run(t, input, seconds(1.0), []);
  assert.ok(!m.alive && t.player.alive && t.player.mode === 'tank' && t.player.tankHp === TANK.HP - 1);
});

// ---------------------------------------------------------------------------------------------------------------
// Bunkers, anti-tank guns, naval gunfire, fighters
// ---------------------------------------------------------------------------------------------------------------
test('bunker: its slit opens and shuts on a cycle and it only fires with the slit open', () => {
  const { level } = field();
  const w = new World(level, { god: true });
  stand(w, 8);
  const e = spawnEnemy(w, { type: 'bunker', x: 8 * TILE + 150, y: FLOOR, face: -1 });
  const input = makeInput();
  let opened = 0;
  let closed = 0;
  let wasOpen = false;
  let shotsWhileShut = 0;
  let shots = 0;
  let prev = 0;
  for (let i = 0; i < seconds(14); i++) {
    run(w, input, 1);
    const n = w.ebullets.filter((b) => b.kind === 'bullet').length;
    if (n > prev) {
      shots += n - prev;
      if (!e.open) shotsWhileShut++;
    }
    prev = n;
    if (e.open && !wasOpen) opened++;
    if (!e.open && wasOpen) closed++;
    wasOpen = !!e.open;
  }
  assert.ok(opened >= 3 && closed >= 3, `cycled ${opened}/${closed} times`);
  assert.ok(shots >= 8, `fired ${shots} bullets`);
  assert.equal(shotsWhileShut, 0, 'never with the slit shut');
  assert.equal(ENEMY_DEFS.bunker.tele >= 0.5, true);
});

test('anti-tank gun: telegraphs for a full second and fires a flat, fast shell at the soldier', () => {
  const { level } = field();
  const w = new World(level, { god: true });
  stand(w, 8);
  const e = spawnEnemy(w, { type: 'atgun', x: 8 * TILE + 160, y: FLOOR, face: -1 });
  void e;
  const input = makeInput();
  let first = null;
  let shell = null;
  for (let i = 0; i < seconds(6) && !shell; i++) {
    run(w, input, 1);
    shell = w.ebullets.find((b) => b.kind === 'shell') || null;
    if (shell && first === null) first = w.time;
  }
  assert.ok(shell, 'it fired');
  assert.ok(first >= 1.0, `not before its telegraph (${first?.toFixed(2)} s)`);
  assert.ok(shell.vx < 0 && Math.abs(shell.vy) < 0.3 * Math.abs(shell.vx), 'flat, towards the soldier');
  assert.ok(Math.hypot(shell.vx, shell.vy) > 200, 'fast');
});

test('naval gunfire: a mark shows where each shell will land and the shell bursts into sparks there', () => {
  const { level, mark } = field((b) => {
    b.flat(50);
    b.barrage(b.x - 50, b.x, { shell: true, period: 3, volley: 2, spread: 60, fuse: 1.2, first: 0.5 });
  });
  void mark;
  const w = new World(level, { god: true });
  stand(w, 22);
  const input = makeInput();
  let marks = 0;
  let sawShell = false;
  let burst = 0;
  for (let i = 0; i < seconds(5); i++) {
    run(w, input, 1);
    marks = Math.max(marks, w.fx.filter((f) => f.k === 'warn').length);
    for (const b of w.ebullets) if (b.kind === 'shell') sawShell = true;
    burst = Math.max(burst, w.ebullets.filter((b) => b.kind === 'spark').length);
  }
  assert.ok(marks >= 1, 'landing marks');
  assert.ok(sawShell, 'shells flew');
  assert.ok(burst >= 6, `the burst scattered sparks (${burst})`);
});

test('fighter: swoops across and drops bombs', () => {
  const { level } = field();
  const w = new World(level, { god: true });
  stand(w, 8);
  const f = spawnEnemy(w, { type: 'fighter', x: 8 * TILE + 200, y: FLOOR - 90, face: -1 });
  void f;
  const input = makeInput();
  let bombs = 0;
  for (let i = 0; i < seconds(8); i++) {
    run(w, input, 1);
    bombs = Math.max(bombs, w.ebullets.filter((b) => b.kind === 'bomb').length);
  }
  assert.ok(bombs >= 1, 'bombs fell');
});

// ---------------------------------------------------------------------------------------------------------------
// The Super-Heavy Tank
// ---------------------------------------------------------------------------------------------------------------
test('Super-Heavy Tank: the driver port is open when idle, on the roof gun and unloading troops, shut behind its other attacks', () => {
  const d = BOSSES.supertank;
  const e = { x: 500, y: FLOOR, face: -1, bs: { state: 'idle' }, def: d };
  const wb = d.weakBox(e);
  assert.ok(wb && inWeakBox(e, wb.x0 + 2, FLOOR - 17), 'a standing soldier hits the port');
  assert.ok(wb.x0 >= e.x - d.w / 2 && wb.x1 <= e.x + d.w / 2 && wb.y0 >= e.y - d.h && wb.y1 <= e.y, 'inside the hitbox');
  assert.ok(wb.y1 >= FLOOR - 17 && wb.y0 <= FLOOR - 17, 'at standing height');
  for (const atk of ['mg', 'troops']) {
    e.bs = { state: 'attack', atk };
    assert.ok(d.weakBox(e), `open during ${atk}`);
  }
  for (const atk of ['cannon', 'mortar', 'crush', 'flame']) {
    e.bs = { state: 'attack', atk };
    assert.equal(d.weakBox(e), null, `shut during ${atk}`);
  }
  assert.equal(d.phases.length, 3);
  assert.ok(d.hp >= 120 && d.armor > 0);
});

test('Super-Heavy Tank: the cannon sends a low shell (jump it) and a high shell (duck it) 0.9 s apart', () => {
  const lvl = buildLevel(15);
  const L = lvl.boss;
  const w = new World(lvl, { god: true });
  const d = BOSSES.supertank;
  const e = { x: L.x1 - 78, y: L.floorY, face: -1, bs: { state: 'attack', atk: 'cannon', phase: 0 }, def: d, hp: 150, maxHp: 150 };
  d.attacks.cannon.start(e, w);
  d.attacks.cannon.tick(e, w, 0.2);
  assert.equal(w.ebullets.length, 1);
  const low = w.ebullets[0];
  d.attacks.cannon.tick(e, w, 1.2);
  assert.equal(w.ebullets.length, 2);
  const high = w.ebullets[1];
  assert.ok(Math.abs(low.y - (L.floorY - 9)) < 1 && Math.abs(high.y - (L.floorY - 22)) < 1);
  // geometry against the soldier's hurt box: the low shell hits standing and prone, the high one only a standing soldier
  const p = w.player;
  const overlap = (hb, b) => b.y + b.r > hb.y0 && b.y - b.r < hb.y1;
  p.x = L.x0 + 100;
  p.y = L.floorY;
  p.prone = false;
  p.h = PLAYER.H;
  const standing = p.hurtBox();
  p.prone = true;
  p.h = PLAYER.PRONE_H;
  const prone = p.hurtBox();
  assert.ok(overlap(standing, low) && overlap(prone, low), 'the low shell cannot be ducked');
  assert.ok(overlap(standing, high) && !overlap(prone, high), 'the high shell passes over a prone soldier');
  assert.ok(low.vx < 0 && high.vx < 0);
});

test('Super-Heavy Tank: crush throws a ground shockwave, flame leaves a gap beside the soldier, troops are only dropped when there is room', () => {
  const lvl = buildLevel(15);
  const L = lvl.boss;
  const w = new World(lvl, { god: true });
  const d = BOSSES.supertank;
  const e = { x: L.x1 - 78, y: L.floorY, face: -1, vx: 0, bs: { state: 'attack', atk: 'crush', phase: 1 }, def: d, hp: 100, maxHp: 150 };
  d.attacks.crush.start(e, w);
  d.attacks.crush.tick(e, w, 0.6);
  const wave = w.ebullets.find((b) => b.kind === 'wave');
  assert.ok(wave && wave.vx < 0 && wave.y > L.floorY - 8, 'a low wave to jump');
  assert.ok(d.attacks.crush.when(e, w), 'phase 2 and up');
  assert.ok(!d.attacks.crush.when({ ...e, bs: { phase: 0 } }, w), 'not in phase 1');
  // flame: columns across the sand with the soldier's own column left open
  const f = new World(lvl, { god: true });
  const p = f.player;
  p.x = e.x - 90 - 3 * 34;
  p.y = L.floorY;
  const fe = { ...e, bs: { state: 'attack', atk: 'flame', phase: 2 } };
  d.attacks.flame.start(fe, f);
  f.update(makeInput(), 1 / 60);
  run(f, makeInput(), seconds(1.4), []);
  const cols = new Set(f.ebullets.filter((b) => b.kind === 'flame').map((b) => Math.round(b.x)));
  assert.ok(cols.size >= 4 && cols.size <= 6, `${cols.size} columns`);
  assert.ok(![...cols].some((x) => Math.abs(x - p.x) < 17), 'none on the soldier');
  // troops
  const roomy = new World(lvl, { god: true });
  assert.ok(d.attacks.troops.when(e, roomy), 'room for two more');
  roomy.enemyCap = 3;
  for (let i = 0; i < 3; i++) spawnEnemy(roomy, { type: 'garrison', x: L.x0 + 40 + i * 20, y: L.floorY, face: 1 });
  assert.ok(!d.attacks.troops.when(e, roomy), 'not when the field is crowded');
});

test('Super-Heavy Tank: an ideal rifle soldier kills it in 40-120 s and the Tesla Coil is quicker', () => {
  const lvl = buildLevel(15);
  const rifle = fightBoss(lvl, { seconds: 300, style: 'ground' });
  assert.ok(rifle.killed, 'killed');
  assert.ok(rifle.time >= 40 && rifle.time <= 120, `rifle ${rifle.time.toFixed(0)} s`);
  const tesla = fightBoss(lvl, { weapon: 'tesla', seconds: 300, style: 'ground' });
  assert.ok(tesla.killed && tesla.time < rifle.time, `tesla ${tesla.time.toFixed(0)} s`);
  assert.ok(rifle.phases.length >= 3 || rifle.phases.size >= 3, 'all three phases were reached');
});

// ---------------------------------------------------------------------------------------------------------------
// Level 16
// ---------------------------------------------------------------------------------------------------------------
test('Coastal Assault: the level is laid out as designed', () => {
  const lvl = buildLevel(15);
  assert.equal(lvl.name, 'COASTAL ASSAULT');
  assert.equal(lvl.boss.type, 'supertank');
  assert.equal(enemyCapFor(15), 12);
  assert.equal(eraWeaponFor(15), 'tesla');
  const count = (id) => lvl.spawns.filter((s) => s.type === id).length;
  assert.ok(count('mine') >= 8, `mines (${count('mine')})`);
  assert.ok(count('bunker') >= 3 && count('atgun') >= 3, 'bunkers and anti-tank guns');
  assert.ok(count('garrison') >= 5 && count('grenadier') >= 3 && count('bazooka') >= 3 && count('stormtrooper') >= 2, 'infantry');
  assert.ok(count('fighter') >= 3, 'fighters');
  assert.equal(lvl.zones.filter((z) => z.type === 'tank').length, 1, 'one tank road');
  assert.equal(lvl.zones.filter((z) => z.type === 'barrage' && z.shell).length >= 2, true, 'naval gunfire');
  const ups = lvl.spawns.filter((s) => s.type === 'pickup' && s.item === '1up');
  assert.equal(ups.length, 1, 'the group-4 hidden extra life');
  assert.ok(lvl.checkpoints.length >= 8);
  // the secret life is reachable only up on the seawall ledges, not on the ground
  assert.ok(ups[0].y < 11 * TILE, 'high up');
  // the road itself is solid, flat ground
  const road = lvl.zones.find((z) => z.type === 'tank');
  const col = Math.floor(road.x0 / TILE);
  let ground = -1;
  for (let y = 0; y < lvl.rows; y++) if (lvl.tiles[y * lvl.cols + col] !== T.AIR) { ground = y; break; }
  for (let x = col; x < Math.floor(road.x1 / TILE); x++) assert.notEqual(lvl.tiles[ground * lvl.cols + x], T.AIR);
});

test('Coastal Assault: the bot can walk the whole level to the boss gate in a tank-friendly time', () => {
  const lvl = buildLevel(15);
  const w = new World(lvl, { god: true });
  const input = makeInput();
  let frames = 0;
  let holdJumpUntil = 0;
  const gate = lvl.boss.x0 - 4 * TILE;
  while (w.player.x < gate && frames < seconds(140)) {
    // run right, always firing; hop (holding the button for a full-height jump) when a wall or a gap is in the way
    const p = w.player;
    const keys = ['right', 'fire'];
    const groundAhead = w.solidAtPx(p.x + 24, p.y + 2);
    if (p.grounded && (frames % 50 === 0 || p.hitWall || !groundAhead)) holdJumpUntil = frames + 30;
    if (frames < holdJumpUntil) keys.push('jump');
    run(w, input, 1, keys);
    frames++;
  }
  assert.ok(w.player.alive, 'god mode soldier is alive');
  assert.ok(frames < seconds(140), 'reached the boss gate');
});
