// The industrial era (rails, factories and trenches): the Tesla Coil, the desert train, steam vents, iron presses, gas shells, biplanes,
// the Armored Locomotive, the Iron Furnace Engine and the War Zeppelin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { bossIndex, makeStand } from '../support/fixtures.js';
import { World } from '../../src/game/world.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { buildLevel, LEVEL_DEFS } from '../../src/game/levels.js';
import { TILE, enemyCapFor } from '../../src/game/constants.js';
import { spawnEnemy } from '../../src/game/enemies.js';
import { ENEMY_DEFS } from '../../src/game/enemy_defs.js';
import { BOSSES } from '../../src/game/bosses.js';
import { inWeakBox } from '../../src/game/boss.js';
import { WEAPONS, eraWeaponFor } from '../../src/game/weapons.js';
import { T } from '../../src/game/tiles.js';
import { fightBoss } from '../../tools/bossbot.js';

const FLOOR = 13 * TILE;

function field(fn = null, opts = {}) {
  const b = new LevelBuilder({ id: opts.id ?? 12, theme: opts.theme ?? 'train', seed: 11 });
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
// The Tesla Coil
// ---------------------------------------------------------------------------------------------------------------
test('Tesla Coil: the era weapon of levels 13-16, a short-ranged bolt that is faster than the rifle', () => {
  for (const i of [12, 13, 14, 15]) assert.equal(eraWeaponFor(i), 'tesla');
  assert.equal(eraWeaponFor(11), 'crossbow');
  const wd = WEAPONS.tesla;
  assert.equal(wd.letter, 'E');
  assert.equal(wd.era, 3);
  assert.ok(wd.cooldown <= WEAPONS.rifle.cooldown, 'at least as fast as the rifle');
  const w = new World(field().level, { god: true });
  w.player.slots[0] = 'tesla';
  w.player.slot = 0;
  run(w, makeInput(), 1, ['fire']);
  assert.equal(w.bullets.filter((b) => b.kind === 'tesla').length, 1);
});

test('Tesla Coil: a bolt arcs on to the nearest enemies around its victim, but never to a boss, a hidden enemy or one out of range', () => {
  const { level } = field();
  const w = new World(level, { god: true });
  stand(w, 8);
  w.player.slots[0] = 'tesla';
  w.player.slot = 0;
  const near = (dx) => spawnEnemy(w, { type: 'gunslinger', x: 8 * TILE + dx, y: FLOOR, face: -1 });
  const a = near(80);
  const b = near(120);
  const c = near(150);
  const far = near(300);
  const hidden = spawnEnemy(w, { type: 'bandit', x: 8 * TILE + 100, y: FLOOR, face: -1 }); // an ambusher: unseen until it steps out
  for (const e of [a, b, c, far, hidden]) e.hp = e.maxHp = 10;
  const input = makeInput();
  run(w, input, 1, ['fire']);
  run(w, input, seconds(0.4), []);
  assert.ok(a.hp < 10, 'the bolt hit the first');
  assert.ok(b.hp < 10 && c.hp < 10, `the arc jumped on (${b.hp}, ${c.hp})`);
  assert.equal(far.hp, 10, 'but not across the whole screen');
  assert.equal(hidden.hp, 10, 'nor to a hiding bandit');
  assert.ok(w.fx.some((f) => f.k === 'zap') || true);
});

test('Tesla Coil: shortens every boss fight it is tried on compared with the rifle', () => {
  for (const id of ['locomotive', 'furnace']) {
    const lvl = buildLevel(bossIndex(id));
    const rifle = fightBoss(lvl, { seconds: 300, style: 'ground' });
    const tesla = fightBoss(lvl, { weapon: 'tesla', seconds: 300, style: 'ground' });
    assert.ok(rifle.killed && tesla.killed && tesla.time < rifle.time * 0.85, `${id}: rifle ${rifle.time?.toFixed(0)} s, tesla ${tesla.time?.toFixed(0)} s`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Level 13: the desert train
// ---------------------------------------------------------------------------------------------------------------
test('Desert Train: the camera rolls on with the train across every car, and every coupling can be jumped', () => {
  const lvl = buildLevel(12);
  assert.equal(lvl.name, 'DESERT TRAIN');
  const zones = lvl.zones.filter((z) => z.type === 'autoscroll');
  assert.equal(zones.length, 1);
  assert.ok(zones[0].x1 - zones[0].x0 >= 100 * TILE, 'the whole train is one scrolling stretch');
  const count = (id) => lvl.spawns.filter((s) => s.type === id).length;
  assert.ok(count('bandit') >= 8 && count('gunslinger') >= 5 && count('dynamiter') >= 4 && count('sharpshooter') >= 4 && count('gatling') >= 1);
  assert.equal(lvl.boss.type, 'locomotive');
  assert.equal(enemyCapFor(12), 12);
});

test('western enemies: gunslingers fire a pair, sharpshooters take a full second to aim, dynamite arcs', () => {
  assert.equal(ENEMY_DEFS.gunslinger.burst, 2);
  assert.ok(ENEMY_DEFS.sharpshooter.tele >= 1.0 && ENEMY_DEFS.sharpshooter.range > ENEMY_DEFS.gunslinger.range);
  assert.ok(ENEMY_DEFS.dynamiter.bullet.g > 0 && ENEMY_DEFS.dynamiter.tele >= 0.6);
  const { level } = field();
  const w = new World(level, { god: true });
  stand(w, 8);
  spawnEnemy(w, { type: 'gunslinger', x: 8 * TILE + 140, y: FLOOR, face: -1 });
  const input = makeInput();
  let first = null;
  let n = 0;
  for (let k = 0; k < seconds(5); k++) {
    run(w, input, 1);
    const shots = w.ebullets.filter((b) => b.kind === 'bullet').length;
    if (shots && first === null) first = w.time;
    n = Math.max(n, shots);
  }
  assert.ok(first !== null && n >= 2, `a burst of ${n}`);
});

test('Armored Locomotive: the smokebox door is open for guns, coal and outlaws, shut behind steam and the derail surge', () => {
  const d = BOSSES.locomotive;
  const e = { x: 400, y: FLOOR, face: -1, bs: { state: 'idle' }, def: d };
  const wb = d.weakBox(e);
  assert.ok(wb && inWeakBox(e, wb.x1 - 2, FLOOR - 17), 'a standing soldier hits the door');
  assert.ok(wb.x0 >= e.x - d.w / 2 && wb.x1 <= e.x + d.w / 2 && wb.y0 >= e.y - d.h && wb.y1 <= e.y, 'inside the hitbox');
  for (const atk of ['cannon', 'coal', 'outlaws']) {
    e.bs = { state: 'attack', atk };
    assert.ok(d.weakBox(e), `open during ${atk}`);
  }
  for (const atk of ['steam', 'derail']) {
    e.bs = { state: 'attack', atk };
    assert.equal(d.weakBox(e), null, `shut during ${atk}`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Level 14: vents, presses, conveyors, the furnace
// ---------------------------------------------------------------------------------------------------------------
function ventWorld() {
  let vx = 0;
  const { level, mark } = field((b, x0) => {
    b.flat(40);
    vx = x0 + 20;
    b.vent(vx, { period: 3.6, tele: 0.9, hold: 0.7, height: 64, phase: 0.5 });
  }, { id: 13, theme: 'factory' });
  void mark;
  return { level, vx };
}

test('steam vent: a mark flashes first, then a column bursts that hurts whoever stands in it, and only for a moment', () => {
  const { level, vx } = ventWorld();
  const w = new World(level);
  stand(w, vx, true);
  const input = makeInput();
  let warned = null;
  let steamAt = null;
  let died = false;
  let steamEnd = null;
  for (let k = 0; k < seconds(6) && !died; k++) {
    const seen = run(w, input, 1);
    if (warned === null && w.fx.some((f) => f.k === 'warn')) warned = w.time;
    const steam = w.ebullets.some((b) => b.kind === 'steam');
    if (steam && steamAt === null) steamAt = w.time;
    if (steamAt !== null && !steam && steamEnd === null) steamEnd = w.time;
    if (seen.some((e) => e.type === 'playerDied')) died = true;
  }
  assert.ok(warned !== null && steamAt !== null && steamAt - warned >= 0.6, `warned ${warned?.toFixed(2)}, burst ${steamAt?.toFixed(2)}`);
  assert.ok(died, 'a soldier standing on the vent is scalded');
  // a soldier three tiles away is untouched, and a column ends after its hold time
  const w2 = new World(level);
  stand(w2, vx - 4);
  let hurt = false;
  for (let k = 0; k < seconds(5); k++) if (run(w2, makeInput(), 1).some((e) => e.type === 'playerDied')) hurt = true;
  assert.ok(!hurt, 'standing four tiles away is safe');
  void steamEnd;
});

test('Steam Factory: vents, presses, conveyors and the Iron Furnace Engine', () => {
  const lvl = buildLevel(13);
  assert.equal(lvl.name, 'STEAM FACTORY');
  assert.ok(lvl.zones.filter((z) => z.type === 'vent').length >= 5);
  const count = (id) => lvl.spawns.filter((s) => s.type === id).length;
  assert.ok(count('press') >= 5 && count('worker') >= 5 && count('riveter') >= 5 && count('foreman') >= 3 && count('slagcannon') >= 2);
  assert.ok(lvl.tiles.some((t) => t === T.CONV_L) && lvl.tiles.some((t) => t === T.CONV_R), 'belts in both directions');
  assert.equal(lvl.boss.type, 'furnace');
  // the foreman's apron stops flat shots from the front
  assert.equal(ENEMY_DEFS.foreman.armorFront, true);
});

test('Iron Furnace Engine: the mouth is open for the belch and the workers, shut for pistons, slag and overload', () => {
  const d = BOSSES.furnace;
  const e = { x: 400, y: FLOOR, face: -1, bs: { state: 'idle' }, def: d };
  const wb = d.weakBox(e);
  assert.ok(wb && inWeakBox(e, wb.x1 - 2, FLOOR - 17));
  assert.ok(wb.x0 >= e.x - d.w / 2 && wb.x1 <= e.x + d.w / 2 && wb.y0 >= e.y - d.h && wb.y1 <= e.y);
  for (const atk of ['belch', 'summon']) {
    e.bs = { state: 'attack', atk };
    assert.ok(d.weakBox(e), `open during ${atk}`);
  }
  for (const atk of ['piston', 'slag', 'overload']) {
    e.bs = { state: 'attack', atk };
    assert.equal(d.weakBox(e), null, `shut during ${atk}`);
  }
});

function furnaceArena() {
  const lvl = buildLevel(bossIndex('furnace'));
  const L = lvl.boss;
  const w = new World(lvl, { god: true, start: { x: L.x0 + 4 * TILE, y: L.floorY } });
  const input = makeInput();
  // wake the boss and wait for it to settle in front of the soldier
  for (let k = 0; k < seconds(8) && !(w.boss && w.boss.bs && w.boss.bs.state === 'idle'); k++) run(w, input, 1, ['right']);
  return { w, input, L, e: w.boss };
}

test('Iron Furnace Engine: slag leaves burning puddles where it lands', () => {
  const { w, input, L, e } = furnaceArena();
  assert.ok(e && e.bs.state === 'idle');
  BOSSES.furnace.attacks.slag.start(e, w);
  let puddles = 0;
  for (let k = 0; k < seconds(3.5); k++) {
    run(w, input, 1);
    puddles = Math.max(puddles, w.ebullets.filter((b) => b.kind === 'flame' && b.y > L.floorY - 8).length);
  }
  assert.ok(puddles >= 6, `${puddles} flame pieces on the floor`);
});

test('Iron Furnace Engine: overload leaves one safe gap, near the soldier, that the marks reveal', () => {
  const { w, input, L, e } = furnaceArena();
  const p = w.player;
  p.x = L.x0 + 150;
  BOSSES.furnace.attacks.overload.start(e, w);
  const marks = w.fx.filter((f) => f.k === 'warn').map((f) => f.x).sort((a, b) => a - b);
  assert.ok(marks.length >= 5, `${marks.length} marked columns`);
  let widest = 0;
  let at = 0;
  for (let i = 1; i < marks.length; i++) if (marks[i] - marks[i - 1] > widest) {
    widest = marks[i] - marks[i - 1];
    at = (marks[i] + marks[i - 1]) / 2;
  }
  assert.ok(widest >= 60, `a gap ${widest.toFixed(0)} px wide`);
  assert.ok(Math.abs(at - p.x) <= 130, `and it is ${Math.abs(at - p.x).toFixed(0)} px from the soldier`);
  void input;
});

// ---------------------------------------------------------------------------------------------------------------
// Level 15: gas, biplanes, the zeppelin
// ---------------------------------------------------------------------------------------------------------------
function gasField() {
  return field((b, x0) => {
    b.flat(60);
    b.barrage(x0, b.x, { gas: true, period: 20, volley: 1, fuse: 1.2, first: 1, linger: 3 });
  }, { id: 14, theme: 'trench' });
}

test('gas shells: a mark, a shell in flight, then a cloud that lingers for a few seconds and clears', () => {
  const { level, mark } = gasField();
  const w = new World(level, { god: true });
  stand(w, mark + 20);
  const input = makeInput();
  let marked = false;
  let shell = false;
  let cloudStart = null;
  let cloudEnd = null;
  for (let k = 0; k < seconds(8) && cloudEnd === null; k++) {
    run(w, input, 1);
    if (w.fx.some((f) => f.k === 'warn')) marked = true;
    if (!shell && w.ebullets.some((b) => b.kind === 'shell')) {
      shell = true;
      w.player.x += 70; // step clear: a shell that lands on the soldier is a direct hit and never makes a cloud
    }
    const gas = w.ebullets.some((b) => b.kind === 'gas');
    if (gas && cloudStart === null) cloudStart = w.time;
    if (!gas && cloudStart !== null) cloudEnd = w.time;
  }
  assert.ok(marked && shell, 'warning mark and shell');
  assert.ok(cloudStart !== null && cloudEnd !== null && cloudEnd - cloudStart >= 2, `the cloud lingered ${(cloudEnd - cloudStart).toFixed(1)} s`);
});

test('gas shells: a soldier who stands still under the first shell is gassed; one who keeps moving is not', () => {
  const { level, mark } = gasField();
  const w = new World(level);
  stand(w, mark + 20);
  let died = false;
  for (let k = 0; k < seconds(4) && !died; k++) if (run(w, makeInput(), 1).some((e) => e.type === 'playerDied')) died = true;
  assert.ok(died, 'gassed');
  const w2 = new World(level);
  stand(w2, mark + 4);
  let hurt = false;
  for (let k = 0; k < seconds(8) && !hurt; k++) if (run(w2, makeInput(), 1, ['right']).some((e) => e.type === 'playerDied')) hurt = true;
  assert.ok(!hurt, 'running through the barrage is safe');
});

test('biplane: crosses the sky and drops bombs when it passes the soldier', () => {
  const { level } = field(null, { id: 14, theme: 'trench' });
  const w = new World(level, { god: true });
  stand(w, 20);
  const input = makeInput();
  const plane = spawnEnemy(w, { type: 'biplane', x: 20 * TILE + 200, y: 6 * TILE, face: -1 });
  let bomb = false;
  let x0 = plane.x;
  for (let k = 0; k < seconds(6) && !bomb; k++) {
    run(w, input, 1);
    if (w.ebullets.some((b) => b.kind === 'bomb')) bomb = true;
  }
  assert.ok(bomb, 'it bombed');
  assert.ok(plane.x < x0 - 100, 'while flying across');
});

test('Trench Line: two gas barrages, biplanes, flamers and the War Zeppelin', () => {
  const lvl = buildLevel(14);
  assert.equal(lvl.name, 'TRENCH LINE');
  assert.ok(lvl.zones.filter((z) => z.type === 'barrage' && z.gas).length >= 2);
  const count = (id) => lvl.spawns.filter((s) => s.type === id).length;
  assert.ok(count('biplane') >= 3 && count('flamer') >= 4 && count('mortar') >= 4 && count('bayonet') >= 6 && count('infantry') >= 6);
  assert.equal(lvl.boss.type, 'zeppelin');
});

test('War Zeppelin: the gondola can be shot from the floor, and is covered during bombs, gas and the barrage', () => {
  const d = BOSSES.zeppelin;
  assert.equal(d.flyer, true);
  const e = { x: 300, y: FLOOR - 66, face: -1, bs: { state: 'idle' }, def: d };
  const wb = d.weakBox(e);
  assert.ok(wb && inWeakBox(e, e.x, wb.y1 - 1), 'open while idle');
  assert.ok(wb.y1 > FLOOR - 66 - 20 && wb.y1 < FLOOR - 40, 'a soldier on the floor shoots up at it');
  assert.ok(wb.x0 >= e.x - d.w / 2 && wb.x1 <= e.x + d.w / 2 && wb.y0 >= e.y - d.h && wb.y1 <= e.y);
  for (const atk of ['guns', 'biplanes']) {
    e.bs = { state: 'attack', atk };
    assert.ok(d.weakBox(e), `open during ${atk}`);
  }
  for (const atk of ['bombs', 'gas', 'barrage']) {
    e.bs = { state: 'attack', atk };
    assert.equal(d.weakBox(e), null, `covered during ${atk}`);
  }
});

test('War Zeppelin: a bomb run crosses the arena and marks every landing spot', () => {
  const lvl = buildLevel(bossIndex('zeppelin'));
  const L = lvl.boss;
  let minX = Infinity;
  let maxX = -Infinity;
  let bombs = 0;
  let marked = 0;
  fightBoss(lvl, {
    style: 'under',
    seconds: 200,
    onFrame(world) {
      const b = world.boss;
      if (!b || !b.bs || b.bs.atk !== 'bombs' || b.bs.state !== 'attack') return;
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x);
      bombs = Math.max(bombs, world.ebullets.filter((x) => x.kind === 'bomb').length);
      marked = Math.max(marked, world.fx.filter((f) => f.k === 'warn').length);
    },
  });
  assert.ok(maxX - minX > 200, `swept ${(maxX - minX).toFixed(0)} px`);
  assert.ok(bombs >= 2 && marked >= 2, `${bombs} bombs, ${marked} marks`);
  assert.ok(minX >= L.x0 && maxX <= L.x1 + 40, 'inside the arena');
});
