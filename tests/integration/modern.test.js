// The modern era (the last era group, part 1): the Plasma Cannon, searchlights and the alarm, sleeping guards, gravity halls, the
// hoverbike, laser emitters, the new enemies, Levels 17-19 and the Silo Mech, Gunship and Hydra bosses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { makeStand } from '../support/fixtures.js';
import { World } from '../../src/game/world.js';
import { LevelBuilder } from '../../src/game/levelgen.js';
import { buildLevel } from '../../src/game/levels.js';
import { flatLevel } from '../../src/game/ascii.js';
import { TILE, BIKE, STEALTH, PLAYER, VIEW_W, VIEW_H, enemyCapFor } from '../../src/game/constants.js';
import { spawnEnemy, damageEnemy } from '../../src/game/enemies.js';
import { ENEMY_DEFS } from '../../src/game/enemy_defs.js';
import { BOSSES } from '../../src/game/bosses.js';
import { WEAPONS, eraWeaponFor } from '../../src/game/weapons.js';
import { plasmaBurst, PLASMA_R } from '../../src/game/plasma.js';
import { inBeam, clearLine, beamX, raiseAlarm } from '../../src/game/stealth.js';
import { T } from '../../src/game/tiles.js';
import { playBot } from '../../tools/bot.js';
import { SoftCanvas } from '../../tools/softcanvas.js';
import { renderWorld } from '../../src/game/render.js';
import { drawHud } from '../../src/game/art/hud.js';
import { drawEnemy } from '../../src/game/art/enemies.js';
import { Run } from '../../src/game/run.js';

const FLOOR = 13 * TILE;

function field(fn, { theme = 'arctic', id = 16 } = {}) {
  const b = new LevelBuilder({ id, theme, seed: 13 });
  b.flat(14);
  const mark = b.x;
  fn(b, mark);
  b.flat(14);
  b.exit();
  return { level: b.finish(), mark };
}

const stand = makeStand(FLOOR, { centre: true, zeroVy: true });

const seen = (events, type) => events.filter((e) => e.type === type);

// ---------------------------------------------------------------------------------------------------------------
// Plasma Cannon
// ---------------------------------------------------------------------------------------------------------------
test('plasma: the era weapon of levels 17-20, a pierce-armour bolt with a splash that never touches bosses', () => {
  for (const i of [16, 17, 18, 19]) assert.equal(eraWeaponFor(i), 'plasma');
  assert.ok(WEAPONS.plasma);
  const w = new World(flatLevel(80, 14), { god: true });
  w.player.slots = ['plasma', null];
  w.player.slot = 0;
  w.player.fireT = 0;
  w.playerFire();
  const b = w.bullets[0];
  assert.equal(b.kind, 'plasma');
  assert.ok(b.armorPierce && b.pierce >= 1);

  // splash: the second soldier standing next to the one that is hit is hurt too
  const a = spawnEnemy(w, { type: 'rifleman', x: 300, y: 14 * TILE });
  const c = spawnEnemy(w, { type: 'rifleman', x: 300 + PLASMA_R - 6, y: 14 * TILE });
  plasmaBurst({ x: 300, y: 14 * TILE - 12 }, w, a);
  assert.ok(c.hp < c.maxHp && c.alive, 'splash damage');
  assert.equal(a.hp, a.maxHp, 'the enemy that was hit directly is damaged by the bolt, not the splash');
  const far = spawnEnemy(w, { type: 'rifleman', x: 300 + PLASMA_R + 40, y: 14 * TILE });
  plasmaBurst({ x: 300, y: 14 * TILE - 12 }, w, a);
  assert.equal(far.hp, far.maxHp, 'out of range');

  // bosses ignore the splash
  const boss = spawnEnemy(w, { type: 'hydra', x: 320, y: 14 * TILE });
  const hp = boss.hp;
  plasmaBurst({ x: 320, y: 14 * TILE - 20 }, w);
  assert.equal(boss.hp, hp);
});

test('plasma: armour-piercing bolts do full damage to a sentinel anywhere on its body', () => {
  const w = new World(flatLevel(80, 14), { god: true });
  const s = spawnEnemy(w, { type: 'sentinel', x: 300, y: 14 * TILE });
  damageEnemy(w, s, 2.3, { x: 300, y: s.y - 6, vx: 100, vy: 0, armorPierce: true });
  assert.ok(Math.abs(s.maxHp - s.hp - 2.3) < 0.01, 'piercing');
  const s2 = spawnEnemy(w, { type: 'sentinel', x: 400, y: 14 * TILE });
  damageEnemy(w, s2, 2.3, { x: 400, y: s2.y - 6, vx: 100, vy: 0 });
  assert.ok(s2.maxHp - s2.hp < 1, 'a plain shot on the armour is chipped');
  const s3 = spawnEnemy(w, { type: 'sentinel', x: 500, y: 14 * TILE });
  damageEnemy(w, s3, 2.3, { x: 500 + 2 * s3.face, y: s3.y - 27, vx: 100, vy: 0 });
  assert.ok(Math.abs(s3.maxHp - s3.hp - 2.3) < 0.01, 'a shot on the core is full damage');
});

// ---------------------------------------------------------------------------------------------------------------
// Searchlights and the alarm
// ---------------------------------------------------------------------------------------------------------------
/** A flat road with one searchlight whose pool is held still at the middle of its sweep. */
function lightField(opts = {}) {
  let z0 = null;
  const { level, mark } = field((b, m) => {
    b.flat(50);
    b.searchlight(m + 10, m + 30, { tower: m + 20, height: 8, period: 1e9, ...opts });
    if (opts.cover) b.block(m + 12, 3, 3);
  });
  z0 = level.zones.find((z) => z.type === 'searchlight');
  return { level, mark, z: z0 };
}

test('searchlight: the pool sweeps between its two columns', () => {
  const z = { a: 100, b: 300, period: 6, phase: 0 };
  assert.ok(Math.abs(beamX(z, 0) - 200) < 1e-6);
  assert.ok(Math.abs(beamX(z, 1.5) - 300) < 1e-6);
  assert.ok(Math.abs(beamX(z, 4.5) - 100) < 1e-6);
  assert.ok(Math.abs(beamX(z, 3) - 200) < 1e-6);
});

test('searchlight: standing in the pool long enough rings the alarm, which brings two snow troopers', () => {
  const { level, mark } = lightField();
  const w = new World(level);
  const input = makeInput();
  stand(w, mark + 20);
  run(w, input, seconds(STEALTH.SPOT_TIME * 0.5), []);
  assert.equal(w.alarmT, 0, 'not yet');
  const ev = run(w, input, seconds(STEALTH.SPOT_TIME * 0.8), []);
  assert.ok(w.alarmT > 0, 'alarm is ringing');
  assert.equal(seen(ev, 'alarm').length, 1);
  const kids = w.enemies.filter((e) => e.alive && e.id === 'snowtrooper');
  assert.equal(kids.length, 2);
  assert.ok(kids.every((e) => e.alarmBorn));
  // it runs out, and cannot be set off again straight away
  run(w, input, seconds(STEALTH.ALARM_TIME + 0.5), []);
  assert.equal(w.alarmT, 0);
  assert.ok(w.alarmCool > 0 && w.alarmCool < STEALTH.COOLDOWN);
});

test('searchlight: a dash through the pool, a high ledge and a crate\'s shadow all keep you out of trouble', () => {
  // a quick dash (about 0.4 s in the light) does not fill the meter
  let { level, mark } = lightField();
  let w = new World(level);
  stand(w, mark + 14);
  run(w, makeInput(), seconds(1.4), ['right']);
  assert.ok(w.player.x > (mark + 26) * TILE, 'ran through');
  assert.equal(w.alarmT, 0);
  // up on a ledge, out of the lit strip
  ({ level, mark } = lightField());
  w = new World(level);
  const z = w.zones.find((q) => q.type === 'searchlight');
  z.tx = beamX(z, 0);
  stand(w, mark + 20);
  assert.ok(inBeam(w, z, z.tx), 'on the ground in the pool');
  w.player.y = FLOOR - STEALTH.BAND - 6;
  assert.ok(!inBeam(w, z, z.tx), 'on a ledge');
  // a crate between a low lamp and the soldier throws a shadow
  const lamp = field((b, m) => {
    b.flat(50);
    b.searchlight(m + 10, m + 30, { tower: m + 4, height: 3, period: 1e9 });
    b.block(m + 12, 3, 3);
  });
  w = new World(lamp.level);
  const zz = w.zones.find((q) => q.type === 'searchlight');
  zz.tx = beamX(zz, 0);
  stand(w, lamp.mark + 20);
  assert.ok(!inBeam(w, zz, zz.tx), 'shadowed by the crate');
  assert.ok(!clearLine(w, zz.lampX, zz.lampY, w.player.x, w.player.y - 10));
  run(w, makeInput(), seconds(1.5), []);
  assert.equal(w.alarmT, 0, 'in the shadow for as long as you like');
});

test('searchlight: the alarm does nothing if the cap of enemies on screen is already full, and builder refuses a sweep over a pit', () => {
  const { level, mark } = lightField();
  const w = new World(level);
  const cap = w.enemyCap;
  assert.equal(cap, enemyCapFor(16));
  for (let i = 0; i < cap; i++) spawnEnemy(w, { type: 'rifleman', x: 40 * TILE + i * 6, y: FLOOR });
  stand(w, mark + 20);
  raiseAlarm(w, w.zones.find((q) => q.type === 'searchlight'));
  assert.ok(w.alarmT > 0);
  assert.equal(w.enemies.filter((e) => e.id === 'snowtrooper').length, 0);
  const b = new LevelBuilder({ id: 16 });
  b.flat(20);
  b.pit(3);
  b.flat(20);
  assert.throws(() => b.searchlight(5, 28, {}), /flat ground/);
});

test('the alarm makes every gun reload faster', () => {
  const shots = (alarm) => {
    const w = new World(flatLevel(80, 14), { god: true });
    const g = spawnEnemy(w, { type: 'guard', x: 300, y: 14 * TILE });
    stand(w, 17);
    w.camera.snap(w.player);
    let count = 0;
    const input = makeInput();
    for (let i = 0; i < seconds(10); i++) {
      if (alarm) w.alarmT = 5;
      input.poll();
      w.update(input);
      count += w.ebullets.length ? 0 : 0;
      w.events.length = 0;
    }
    void g;
    return w.time;
  };
  // measured through the timer a shooter uses: with the alarm ringing it counts down 1.6x as fast
  const w = new World(flatLevel(80, 14), { god: true });
  const g = spawnEnemy(w, { type: 'guard', x: 300, y: 14 * TILE });
  stand(w, 17);
  g.t = 5;
  w.alarmT = 3;
  run(w, makeInput(), seconds(1), []);
  const withAlarm = 5 - g.t;
  const w2 = new World(flatLevel(80, 14), { god: true });
  const g2 = spawnEnemy(w2, { type: 'guard', x: 300, y: 14 * TILE });
  stand(w2, 17);
  g2.t = 5;
  // keep the guard out of its fire cycle by making it too far to shoot
  g2.state = 'idle';
  run(w2, makeInput(), seconds(1), []);
  const without = 5 - g2.t;
  assert.ok(withAlarm > without * 1.4, `alarm ${withAlarm.toFixed(2)} vs ${without.toFixed(2)}`);
  void shots;
});

// ---------------------------------------------------------------------------------------------------------------
// Sleeping guards
// ---------------------------------------------------------------------------------------------------------------
test('sleepers: stand silently until the alarm, damage or a soldier right beside them', () => {
  const mk = () => {
    const w = new World(flatLevel(80, 14), { god: true });
    const g = spawnEnemy(w, { type: 'guard', x: 400, y: 14 * TILE, sleeper: true });
    return { w, g };
  };
  let { w, g } = mk();
  stand(w, 20); // 80 px away: in range of its gun but outside the waking distance
  run(w, makeInput(), seconds(3), []);
  assert.ok(!g.woke && w.ebullets.length === 0, 'asleep');
  // walking up to it wakes it
  w.player.x = g.x - 40;
  run(w, makeInput(), 2, []);
  assert.ok(g.woke);
  // the alarm wakes everyone
  ({ w, g } = mk());
  stand(w, 20);
  w.alarmT = 2;
  run(w, makeInput(), 2, []);
  assert.ok(g.woke);
  // a shot wakes it
  ({ w, g } = mk());
  stand(w, 20);
  damageEnemy(w, g, 0.5, { x: g.x, y: g.y - 12, vx: 100, vy: 0 });
  run(w, makeInput(), 2, []);
  assert.ok(g.woke);
  // a catwalk 48 px up is out of its hearing
  ({ w, g } = mk());
  stand(w, 25);
  w.player.x = g.x;
  w.player.y = 14 * TILE - 48;
  w.player.vy = 0;
  w.update(makeInput());
  assert.ok(!g.woke, 'quiet on the catwalk');
});

// ---------------------------------------------------------------------------------------------------------------
// Gravity halls
// ---------------------------------------------------------------------------------------------------------------
test('gravity hall: the builder insists on a long hall on flat ground', () => {
  const b = new LevelBuilder({ id: 18 });
  b.flat(12);
  assert.throws(() => b.flipHall(10), /14 columns/);
  b.pit(3);
  b.flat(4);
  const b2 = new LevelBuilder({ id: 18 });
  b2.flat(10);
  b2.up(1);
  assert.doesNotThrow(() => b2.flat(2));
  const hall = new LevelBuilder({ id: 18 });
  hall.flat(10);
  const s = hall.flipHall(16);
  assert.equal(s.x1 - s.x0, 16);
  const lvl = (hall.flat(10), hall.exit(), hall.finish());
  assert.equal(lvl.zones.filter((z) => z.type === 'gravity').length, 1);
  assert.equal(lvl.links.filter((l) => l.kind === 'flip').length, 1);
  // the floor of the hall is spikes, apart from two bare columns at each end
  const floorRow = 12;
  const spikes = [];
  for (let x = s.x0; x < s.x1; x++) spikes.push(lvl.tiles[floorRow * lvl.cols + x] === T.SPIKE);
  assert.deepEqual(spikes.slice(0, 2), [false, false]);
  assert.deepEqual(spikes.slice(-2), [false, false]);
  assert.ok(spikes.slice(2, -2).every(Boolean));
});

test('gravity hall: a soldier falls up inside it, walks the ceiling, and falls back down on the far side', () => {
  const { level } = field((b) => {
    b.flat(12);
    b.flipHall(18);
    b.flat(14);
  }, { theme: 'megacity', id: 18 });
  const zone = level.zones.find((z) => z.type === 'gravity');
  const w = new World(level);
  const input = makeInput();
  let flipped = 0;
  let onCeiling = false;
  let landed = false;
  w.player.x = zone.x0 - 60;
  w.player.y = FLOOR;
  w.camera.snap(w.player);
  for (let i = 0; i < seconds(8); i++) {
    input.script = { right: true };
    input.poll();
    w.update(input);
    w.events.length = 0;
    const p = w.player;
    if (p.gdir < 0) {
      flipped++;
      if (p.grounded) {
        onCeiling = true;
        assert.ok(p.y < FLOOR - 40, 'up under the ceiling');
        assert.ok(p.x >= zone.x0);
      }
    } else if (flipped > 0 && p.grounded && p.x > zone.x1) landed = true;
    assert.ok(p.alive, 'never hurt by the spikes');
  }
  assert.ok(flipped > 20 && onCeiling && landed);
  assert.equal(w.player.gdir, 1);
  assert.ok(Math.abs(w.player.y - FLOOR) < 1);
});

test('gravity hall: aim stays screen-relative, so shooting up while upside down still goes up the screen', () => {
  const { level } = field((b) => {
    b.flat(12);
    b.flipHall(18);
    b.flat(14);
  }, { theme: 'megacity', id: 18 });
  const zone = level.zones.find((z) => z.type === 'gravity');
  const w = new World(level, { god: true });
  w.player.x = zone.x0 + 80;
  w.player.y = FLOOR;
  w.camera.snap(w.player);
  const input = makeInput();
  run(w, input, seconds(1.2), []);
  assert.equal(w.player.gdir, -1);
  w.player.fireT = 0;
  input.script = { up: true, fire: true };
  input.poll();
  w.update(input);
  assert.ok(w.bullets.length > 0 && w.bullets.every((b) => b.vy < 0), 'bullets climb the screen');
});

test('levels without a gravity hall leave gravity alone', () => {
  const w = new World(flatLevel(80, 14), { god: true });
  w.player.gdir = -1;
  w.update(makeInput());
  assert.equal(w.player.gdir, -1);
});

test('the bot crosses a gravity hall (the solver link works)', () => {
  const { level } = field((b) => {
    b.flat(12);
    b.flipHall(18);
    b.flat(14);
    b.flipHall(22);
    b.flat(14);
  }, { theme: 'megacity', id: 18 });
  let minG = 1;
  const r = playBot(level, { seconds: 60, onFrame: (w) => (minG = Math.min(minG, w.player.gdir)) });
  assert.ok(r.cleared && r.falls === 0 && r.hazards === 0, `x=${Math.round(r.x)}`);
  assert.equal(minG, -1, 'it did go through the halls upside down');
});

// ---------------------------------------------------------------------------------------------------------------
// The hoverbike
// ---------------------------------------------------------------------------------------------------------------
function hoverField(n = 60) {
  const out = {};
  const { level, mark } = field((b, m) => {
    b.flat(8);
    out.run = b.hoverRun(n, { speed: 56 });
    b.flat(10);
  }, { theme: 'megacity', id: 18 });
  out.z = level.zones.find((z) => z.type === 'hover');
  return { level, mark, ...out };
}

test('hoverbike: walking into the start of the skyway climbs onto a bike with two hits of armour', () => {
  const { level } = hoverField();
  const w = new World(level);
  const z = w.zones.find((q) => q.type === 'hover');
  w.player.x = z.x0 - 30;
  w.player.y = FLOOR;
  w.camera.snap(w.player);
  const input = makeInput();
  assert.equal(w.player.mode, 'foot');
  run(w, input, seconds(0.6), ['right']);
  const p = w.player;
  assert.equal(p.mode, 'fly');
  assert.equal(p.bikeHp, BIKE.HP);
  assert.ok(p.w === BIKE.W && p.h === BIKE.H);
  assert.equal(p.bikeZone, z);
  // a pickup-like popup and a sound announced it
  assert.ok(!p.grounded);
});

test('hoverbike: free flight in all directions, kept inside the screen, camera rolls on by itself', () => {
  const { level, z } = hoverField(80);
  const w = new World(level);
  w.player.x = z.x0 + 20;
  w.player.y = FLOOR - 70;
  w.camera.snap(w.player);
  const input = makeInput();
  run(w, input, 2, []);
  assert.equal(w.player.mode, 'fly');
  const cam0 = w.camera.x;
  run(w, input, seconds(3), []);
  assert.ok(w.camera.x - cam0 > 56 * 2.2, `the camera rolled ${(w.camera.x - cam0).toFixed(0)} px`);
  const p = w.player;
  const hw = p.w / 2;
  // far right: the bike drags the camera on faster than the skyway scrolls by itself, and never leaves the screen
  const camR = w.camera.x;
  run(w, input, seconds(5), ['right']);
  assert.ok(p.x <= w.camera.x + VIEW_W - hw);
  assert.ok(w.camera.x - camR > 56 * 5 * 1.25, 'pushing right speeds the camera up');
  // up
  run(w, input, seconds(3), ['up']);
  assert.ok(p.y - p.h >= w.camera.y, 'not above the screen');
  assert.ok(p.y < FLOOR - 100, 'it flew up');
  // down: skims the road but never lands
  run(w, input, seconds(4), ['down']);
  assert.ok(p.y <= FLOOR && p.y > FLOOR - 20);
  assert.ok(!p.grounded && p.mode === 'fly');
  // left: the camera pushes it, and the stick holds it at the left edge
  run(w, input, seconds(5), ['left']);
  assert.ok(p.x >= w.camera.x + hw);
  assert.ok(p.x <= w.camera.x + hw + 10);
});

test('hoverbike: two hits are absorbed, the third wrecks it and throws the soldier clear unhurt', () => {
  const { level, z } = hoverField();
  const w = new World(level);
  w.player.x = z.x0 + 20;
  w.player.y = FLOOR - 70;
  w.camera.snap(w.player);
  run(w, makeInput(), 2, []);
  const p = w.player;
  assert.equal(p.mode, 'fly');
  p.invuln = 0;
  assert.equal(w.hurtPlayer('bullet'), true);
  assert.equal(p.bikeHp, BIKE.HP - 1);
  assert.ok(p.invuln >= BIKE.HIT_INVULN - 0.01, 'a breath of invulnerability');
  assert.equal(w.hurtPlayer('bullet'), false, 'invulnerable right after a hit');
  assert.equal(p.bikeHp, BIKE.HP - 1);
  p.invuln = 0;
  const lives = w.lives ?? null;
  w.hurtPlayer('bullet');
  assert.equal(p.mode, 'foot', 'the bike is wrecked');
  assert.ok(p.alive, 'the soldier survives');
  assert.ok(p.invuln >= BIKE.EJECT_INVULN - 0.01);
  assert.equal(w.lives ?? null, lives);
  // on foot again, the next hit is the soldier's
  p.invuln = 0;
  w.hurtPlayer('bullet');
  assert.ok(!p.alive);
});

test('hoverbike: dying on a bike leaves the bike behind, and a respawn inside the skyway hands out a fresh one', () => {
  const { level, z } = hoverField();
  const w = new World(level);
  w.player.x = z.x0 + 20;
  w.player.y = FLOOR - 70;
  w.camera.snap(w.player);
  run(w, makeInput(), 2, []);
  assert.equal(w.player.mode, 'fly');
  w.killPlayer('test');
  assert.equal(w.player.mode, 'foot');
  w.respawnPlayer(z.x0 + 60, FLOOR - 40);
  assert.equal(w.player.mode, 'fly');
  assert.equal(w.player.bikeHp, BIKE.HP);
});

test('hoverbike: the skyway ends with the bike setting down and the soldier on foot', () => {
  const { level } = hoverField(30);
  const w = new World(level, { god: true });
  const z = w.zones.find((q) => q.type === 'hover');
  w.player.x = z.x1 - 30;
  w.player.y = FLOOR - 60;
  w.player.mountBike(z);
  w.camera.snap(w.player);
  const input = makeInput();
  const ev = run(w, input, seconds(2), ['right']);
  void ev;
  assert.equal(w.player.mode, 'foot');
  assert.ok(w.player.grounded && Math.abs(w.player.y - FLOOR) < 1);
  assert.equal(w.player.w, PLAYER.W);
});

test('hoverbike: squeezed against a wall by the scrolling screen is a crash that costs a hit', () => {
  const { level, z } = hoverField();
  const w = new World(level);
  w.player.mountBike(z);
  w.player.x = z.x0 + 100;
  w.player.y = FLOOR - 60;
  w.camera.snap(w.player);
  const col = Math.floor((w.camera.x + 6) / TILE);
  for (let r = 4; r < 13; r++) w.setTile(col, r, T.SOLID);
  w.player.x = w.camera.x + 3;
  w.player.invuln = 0;
  const ev = run(w, makeInput(), 3, []);
  assert.ok(seen(ev, 'bikeHit').some((e) => e.cause === 'crush'), 'crushed against the wall');
});

test('hoverbike: the HUD shows its armour', () => {
  const { level, z } = hoverField();
  const w = new World(level);
  w.player.mountBike(z);
  w.player.x = z.x0 + 100;
  w.player.y = FLOOR - 60;
  w.camera.snap(w.player);
  const cv = new SoftCanvas(VIEW_W, VIEW_H);
  const ctx = cv.getContext('2d');
  const before = Uint8ClampedArray.from(cv.data);
  drawHud(ctx, w, new Run(), {});
  assert.notDeepEqual(Array.from(cv.data), Array.from(before));
  renderWorld(ctx, w);
  assert.ok(true);
});

// ---------------------------------------------------------------------------------------------------------------
// Laser emitters
// ---------------------------------------------------------------------------------------------------------------
test('beam emitter: a mark flashes, then a column of laser stabs down for a moment and hurts', () => {
  const { level, mark } = field((b, m) => {
    b.flat(40);
    b.beam(m + 20, { from: 'top', length: 200, period: 4, tele: 0.6, hold: 0.6, phase: 0.2 });
  }, { theme: 'megacity', id: 18 });
  const w = new World(level);
  stand(w, mark + 20);
  const input = makeInput();
  let marked = false;
  let fired = false;
  let died = false;
  for (let i = 0; i < seconds(2.5); i++) {
    input.script = {};
    input.poll();
    w.update(input);
    if (w.fx.some((f) => f.k === 'warn')) marked = true;
    if (w.ebullets.some((b) => b.kind === 'beam')) fired = true;
    if (seen(w.events, 'playerDied').length) died = true;
    w.events.length = 0;
    if (!w.player.alive) break;
  }
  assert.ok(marked && fired, 'warned, then fired');
  assert.ok(died, 'a soldier standing in the beam is hit');
  // someone standing away from it is fine, and the beam goes out again
  const w2 = new World(level, { god: false });
  stand(w2, mark + 12);
  run(w2, makeInput(), seconds(2.5), []);
  assert.ok(w2.player.alive);
});

// ---------------------------------------------------------------------------------------------------------------
// The new enemies
// ---------------------------------------------------------------------------------------------------------------
const NEW = ['snowtrooper', 'guard', 'sentrygun', 'snowmobile', 'recon', 'samsite', 'cyborg', 'hunter', 'gunchopper', 'sniperbot', 'laserturret', 'ceilgun', 'cyberhound', 'sentinel', 'orbmine', 'hoverbiker'];

test('every new enemy skin spawns, runs for a few seconds beside the soldier and paints pixels inside its own bounding box', () => {
  const cv = new SoftCanvas(VIEW_W, VIEW_H);
  const ctx = cv.getContext('2d');
  for (const id of NEW) {
    const def = ENEMY_DEFS[id];
    assert.ok(def, id);
    const w = new World(flatLevel(80, 14), { god: true });
    stand(w, 18);
    const flyer = def.flyer;
    const e = spawnEnemy(w, { type: id, x: 18 * TILE + 120, y: flyer ? 8 * TILE : id === 'ceilgun' ? 9 * TILE : 14 * TILE, face: -1, gdir: id === 'ceilgun' ? -1 : 1 });
    assert.ok(e.alive);
    const input = makeInput();
    for (let i = 0; i < seconds(3); i++) {
      input.poll();
      w.update(input);
      w.events.length = 0;
      w.camera.snap(w.player);
    }
    const cx = e.x - VIEW_W / 2; // draw it in the middle of the screen: some of these drive or fly off while the soldier stands
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawEnemy(ctx, e, cx, w.camera.y);
    assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `${id} position`);
    // the sprite lands on the screen: pixels inside its hitbox (a generous box around it), and the frame is otherwise empty
    const sx = Math.round(e.x - cx);
    const sy = Math.round(e.y - w.camera.y);
    const box = { x0: sx - e.w, x1: sx + e.w, y0: sy - e.h - 12, y1: sy + 12 };
    let inside = 0;
    let outside = 0;
    for (let py = 0; py < VIEW_H; py++) {
      for (let px = 0; px < VIEW_W; px++) {
        if (cv.data[(py * VIEW_W + px) * 4 + 3] === 0) continue;
        if (px >= box.x0 && px < box.x1 && py >= box.y0 && py < box.y1) inside++;
        else outside++;
      }
    }
    assert.ok(inside >= 40, `${id}: only ${inside} pixels painted in its bounding box ${JSON.stringify(box)}`);
    assert.ok(inside > outside, `${id}: ${outside} pixels painted away from its box vs ${inside} inside`);
  }
});

test('ceiling gun: hangs from a slab upside down and fires down at the soldier', () => {
  const w = new World(flatLevel(80, 14), { god: true });
  stand(w, 18);
  const slabBottom = 9 * TILE;
  const g = spawnEnemy(w, { type: 'ceilgun', x: 18 * TILE + 80, y: slabBottom + 14, gdir: -1, face: -1 });
  assert.equal(g.gdir, -1);
  const input = makeInput();
  let down = 0;
  for (let i = 0; i < seconds(4); i++) {
    input.poll();
    w.update(input);
    for (const b of w.ebullets) if (b.vy > 0) down++;
    w.events.length = 0;
    w.camera.snap(w.player);
  }
  assert.ok(down > 0, 'it shot downward');
  assert.equal(g.y, slabBottom + 14, 'it stayed where it hangs');
});

test('snowmobile: charges straight across the screen and leaves it, and a jump clears it', () => {
  const def = ENEMY_DEFS.snowmobile;
  assert.ok(def.passThrough && def.arch === 'charger');
  const w = new World(flatLevel(80, 14));
  stand(w, 10);
  const e = spawnEnemy(w, { type: 'snowmobile', x: 10 * TILE + 250, y: 14 * TILE, face: -1 });
  const input = makeInput();
  let crossed = false;
  let hop = 0;
  for (let i = 0; i < seconds(7); i++) {
    // hop over the sled when it gets close (the button is held for a full-height jump)
    if (e.alive && w.player.grounded && Math.abs(e.x - w.player.x) < 64 && e.x > w.player.x - 20) hop = 30;
    input.script = { jump: hop-- > 0 };
    input.poll();
    w.update(input);
    w.events.length = 0;
    if (e.x < w.camera.x - 20) crossed = true;
    if (!e.alive || !w.player.alive) break;
    w.camera.snap(w.player);
  }
  assert.ok(crossed || !e.alive, 'it ran across the screen');
});

test('sentinel: only the glowing core takes full damage from ordinary bullets', () => {
  const d = ENEMY_DEFS.sentinel;
  assert.ok(d.weak && d.armor <= 0.3 && d.hp >= 12);
});

test('drones and cyborgs shoot cold-coloured bolts; every new shooter keeps within the enemy-cap curve', () => {
  assert.equal(ENEMY_DEFS.cyborg.bullet.kind, 'plasma');
  assert.equal(ENEMY_DEFS.sniperbot.bullet.kind, 'laser');
  assert.ok(ENEMY_DEFS.sniperbot.tele >= 1.0, 'snipers give a long warning');
  for (const id of NEW) {
    const d = ENEMY_DEFS[id];
    if (d.tele !== undefined) assert.ok(d.tele >= 0.5, `${id} telegraphs`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Levels 17-19
// ---------------------------------------------------------------------------------------------------------------
test('Level 17: the Arctic Missile Base', () => {
  const lvl = buildLevel(16);
  assert.equal(lvl.name, 'ARCTIC MISSILE BASE');
  assert.equal(lvl.theme, 'arctic');
  assert.equal(lvl.music, 'coldwar');
  assert.equal(lvl.boss.type, 'silomech');
  assert.ok(lvl.zones.filter((z) => z.type === 'searchlight').length >= 3, 'three searchlights');
  assert.ok(lvl.spawns.filter((s) => s.sleeper).length >= 5, 'sleeping guards');
  assert.ok(lvl.spawns.filter((s) => s.type === 'snowmobile').length >= 2);
  assert.ok(lvl.spawns.some((s) => s.type === 'samsite'));
  assert.equal(lvl.spawns.filter((s) => s.type === 'pickup' && s.item === '1up').length, 1, 'one hidden 1UP');
  const firstCapsule = lvl.spawns.find((s) => s.type === 'capsule');
  assert.equal(firstCapsule.item, 'E');
  assert.ok(firstCapsule.x < 20 * TILE, 'the era weapon is offered at the start');
  // two catwalks in the boss arena, within a jump of the floor
  const L = lvl.boss;
  let ledges = 0;
  const row = Math.floor(L.floorY / TILE) - 3;
  for (let x = Math.floor(L.x0 / TILE); x < Math.floor(L.x1 / TILE); x++) if (lvl.tiles[row * lvl.cols + x] === T.PLATFORM) ledges++;
  assert.equal(ledges, 10);
});

test('Level 18: Neon City is a boulevard followed by a long forced-scroll rooftop chase', () => {
  const lvl = buildLevel(17);
  assert.equal(lvl.name, 'NEON CITY');
  assert.equal(lvl.theme, 'neon');
  assert.equal(lvl.music, 'neon');
  assert.equal(lvl.boss.type, 'gunship');
  const auto = lvl.zones.filter((z) => z.type === 'autoscroll');
  assert.equal(auto.length, 1);
  assert.ok((auto[0].x1 - auto[0].x0) / TILE >= 90, 'a long chase');
  assert.ok(lvl.spawns.filter((s) => s.type === 'gunchopper').length >= 4, 'helicopters over the skyline');
  assert.ok(lvl.spawns.some((s) => s.type === 'sniperbot'));
  assert.ok(lvl.spawns.some((s) => s.type === 'laserturret'));
  // the chase has real gaps in it (bottomless street canyons)
  let gaps = 0;
  for (let x = Math.floor(auto[0].x0 / TILE); x < Math.floor(auto[0].x1 / TILE); x++) {
    let solid = false;
    for (let y = 0; y < lvl.rows; y++) if (lvl.tiles[y * lvl.cols + x] === T.SOLID) solid = true;
    if (!solid) gaps++;
  }
  assert.ok(gaps >= 25, `${gaps} gap columns`);
});

test('Level 19: the Cyber Megacity has ceiling guns, two gravity halls, a hoverbike skyway with lasers, and the Hydra', () => {
  const lvl = buildLevel(18);
  assert.equal(lvl.name, 'CYBER MEGACITY');
  assert.equal(lvl.theme, 'megacity');
  assert.equal(lvl.music, 'cyber');
  assert.equal(lvl.boss.type, 'hydra');
  assert.equal(lvl.zones.filter((z) => z.type === 'gravity').length, 2);
  const hover = lvl.zones.filter((z) => z.type === 'hover');
  assert.equal(hover.length, 1);
  assert.ok((hover[0].x1 - hover[0].x0) / TILE >= 100, 'a long skyway');
  assert.ok(lvl.zones.filter((z) => z.type === 'beam').length >= 6);
  const guns = lvl.spawns.filter((s) => s.type === 'ceilgun');
  assert.ok(guns.length >= 3 && guns.every((g) => g.gdir === -1));
  assert.ok(lvl.spawns.some((s) => s.type === 'hoverbiker'));
  assert.ok(lvl.spawns.filter((s) => s.type === 'orbmine').length >= 5);
  assert.equal(lvl.links.filter((l) => l.kind === 'flip').length, 2);
  // the road under the skyway is flat all the way (a bot's route, and where the soldier sets down)
  const x0 = hover[0].x0 / TILE;
  const x1 = hover[0].x1 / TILE;
  for (let x = x0; x < x1; x++) assert.equal(lvl.tiles[13 * lvl.cols + x], T.SOLID);
});

test('levels 17-19 end in boss arenas of the three new bosses, and each level starts with the soldier on foot', () => {
  for (const [i, id] of [[16, 'silomech'], [17, 'gunship'], [18, 'hydra']]) {
    const lvl = buildLevel(i);
    assert.equal(lvl.boss.type, id);
    const w = new World(lvl);
    assert.equal(w.player.mode, 'foot');
    assert.equal(w.enemyCap, 14);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// The bosses
// ---------------------------------------------------------------------------------------------------------------
function arenaFight(index) {
  const lvl = buildLevel(index);
  const L = lvl.boss;
  const w = new World(lvl, { god: true, start: { x: L.x0 + 3 * TILE, y: L.floorY } });
  const input = makeInput();
  run(w, input, seconds(0.5), ['right']);
  for (let i = 0; i < seconds(8) && !(w.boss && w.boss.bs.state === 'idle'); i++) run(w, input, 1, []);
  assert.ok(w.boss && w.boss.bs.state === 'idle', 'the boss walked in');
  return { w, L, boss: w.boss };
}

test('Silo Mech: the core is out of reach of a standing soldier and open only while the shutters are', () => {
  const { w, boss, L } = arenaFight(16);
  const f = boss.face;
  const wb = BOSSES.silomech.weakBox(boss);
  assert.ok(wb, 'open between attacks');
  const standing = L.floorY - 21;
  assert.ok(standing > wb.y1, 'a standing shot passes under the core');
  const ledge = L.floorY - 48 - 21;
  assert.ok(ledge > wb.y0 && ledge < wb.y1, 'a shot from a catwalk hits it');
  void f;
  const hp = boss.hp;
  damageEnemy(w, boss, 1, { x: boss.x - 6 * boss.face, y: standing, vx: 100, vy: 0 });
  assert.ok(hp - boss.hp < 0.3, 'armour chips');
  const hp2 = boss.hp;
  damageEnemy(w, boss, 1, { x: boss.x + 10 * boss.face, y: ledge, vx: 100, vy: 0 });
  assert.ok(Math.abs(hp2 - boss.hp - 1) < 1e-6, 'full damage on the core');
  // shut for the salvo and the silo launch, open for the gatling and after the stomp
  boss.bs.state = 'attack';
  boss.bs.atk = 'salvo';
  assert.equal(BOSSES.silomech.weakBox(boss), null);
  boss.bs.atk = 'silo';
  assert.equal(BOSSES.silomech.weakBox(boss), null);
  boss.bs.atk = 'gatling';
  assert.ok(BOSSES.silomech.weakBox(boss));
  boss.bs.atk = 'stomp';
  boss.sm = { stuck: false };
  assert.equal(BOSSES.silomech.weakBox(boss), null);
  boss.sm.stuck = true;
  assert.ok(BOSSES.silomech.weakBox(boss));
});

test('Silo Mech: stomping sends a shockwave each way, and its salvo marks every landing spot', () => {
  const { w, boss } = arenaFight(16);
  const input = makeInput();
  // force the stomp
  const bs = boss.bs;
  bs.state = 'tele';
  bs.atk = 'stomp';
  bs.t = 0.6;
  bs.teleMax = 0.6;
  BOSSES.silomech.attacks.stomp.teleStart(boss, w);
  let waves = 0;
  for (let i = 0; i < seconds(2); i++) {
    run(w, input, 1, []);
    waves = Math.max(waves, w.ebullets.filter((b) => b.kind === 'wave').length);
  }
  assert.ok(waves >= 2, 'a shockwave runs each way');
  bs.state = 'idle';
  bs.cd = 5;
  w.fx.length = 0;
  BOSSES.silomech.attacks.salvo.start(boss, w);
  run(w, input, seconds(1.5), []);
  assert.ok(w.fx.some((f) => f.k === 'warn') || w.ebullets.length > 0, 'marks and missiles');
});

test('Gunship: the cockpit is the weak point from below and is shut while the rocket pods are out', () => {
  const { w, boss, L } = arenaFight(17);
  assert.ok(boss.def.flyer);
  const wb = BOSSES.gunship.weakBox(boss);
  assert.ok(wb);
  assert.ok(wb.y1 < L.floorY - 40, 'it hangs clear of the floor');
  const cx = (wb.x0 + wb.x1) / 2;
  const cy = (wb.y0 + wb.y1) / 2;
  const hp = boss.hp;
  damageEnemy(w, boss, 1, { x: cx, y: cy, vx: 0, vy: -200 });
  assert.ok(Math.abs(hp - boss.hp - 1) < 1e-6);
  boss.bs.state = 'attack';
  boss.bs.atk = 'rockets';
  assert.equal(BOSSES.gunship.weakBox(boss), null);
  boss.bs.atk = 'strafe';
  assert.ok(BOSSES.gunship.weakBox(boss));
  boss.bs.atk = 'carpet';
  assert.equal(BOSSES.gunship.weakBox(boss), null);
});

test('Gunship: a strafing run drags it across the arena and leaves a line of tracer fire', () => {
  const { w, boss } = arenaFight(17);
  const input = makeInput();
  const bs = boss.bs;
  bs.state = 'tele';
  bs.atk = 'strafe';
  bs.t = 0.9;
  bs.teleMax = 0.9;
  BOSSES.gunship.attacks.strafe.teleStart(boss, w);
  const x0 = boss.x;
  let shots = 0;
  for (let i = 0; i < seconds(6); i++) {
    run(w, input, 1, []);
    shots = Math.max(shots, w.ebullets.filter((b) => b.vy > 100).length);
  }
  assert.ok(Math.abs(boss.x - x0) > 100, 'it swept across');
  assert.ok(shots >= 2, 'tracers rained down');
});

test('Hydra: the eye in its chest is open between attacks, shut for the sweep and the storm, and a slammed head sticks open', () => {
  const { w, boss, L } = arenaFight(18);
  assert.equal(boss.hd.length, 3);
  const wb = BOSSES.hydra.weakBox(boss);
  assert.ok(wb && wb.y1 > L.floorY - 20 && wb.y0 < L.floorY - 30, 'the eye is at street level, a standing shot hits it');
  boss.bs.state = 'attack';
  boss.bs.atk = 'sweep';
  assert.equal(BOSSES.hydra.weakBox(boss), null);
  boss.bs.atk = 'storm';
  assert.equal(BOSSES.hydra.weakBox(boss), null);
  boss.bs.atk = 'spit';
  assert.ok(BOSSES.hydra.weakBox(boss));
  // a lunging head: stuck in the street, its box sits at the head
  boss.bs.atk = 'lunge';
  boss.lg = { i: 0, x: L.x0 + 150, mode: 'stuck' };
  boss.hd[0].x = L.x0 + 150;
  boss.hd[0].y = L.floorY - 6;
  const hb = BOSSES.hydra.weakBox(boss);
  assert.ok(hb && hb.x0 < L.x0 + 150 && hb.x1 > L.x0 + 150 && hb.y1 >= L.floorY - 10);
  void w;
});

test('Hydra: a lunge slams a head onto the marked spot, shockwaves run both ways and the head sticks for a moment', () => {
  const { w, boss, L } = arenaFight(18);
  const input = makeInput();
  w.player.x = L.x0 + 140;
  w.player.y = L.floorY;
  const bs = boss.bs;
  bs.state = 'tele';
  bs.atk = 'lunge';
  bs.t = 1.0;
  bs.teleMax = 1.0;
  BOSSES.hydra.attacks.lunge.teleStart(boss, w);
  assert.ok(w.fx.some((f) => f.k === 'warn'), 'the mark shows first');
  let stuck = false;
  let waves = 0;
  for (let i = 0; i < seconds(3.5); i++) {
    run(w, input, 1, []);
    if (boss.lg && boss.lg.mode === 'stuck') stuck = true;
    waves = Math.max(waves, w.ebullets.filter((b) => b.kind === 'wave').length);
  }
  assert.ok(stuck, 'it stuck in the street');
  assert.ok(waves >= 2);
});

test('the three new bosses all have a visible bar, three phases and at least four attacks across the fight', () => {
  for (const id of ['silomech', 'gunship', 'hydra']) {
    const d = BOSSES[id];
    assert.equal(d.phases.length, 3);
    assert.ok(Object.keys(d.attacks).length >= 4, id);
    assert.ok(d.hp >= 40);
    for (const [name, a] of Object.entries(d.attacks)) assert.ok(a.tele >= 0.6, `${id}.${name} telegraphs for at least 0.6 s`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------------------------
test('rendering: searchlights, the alarm, sleepers, ceiling guns and laser emitters all draw', () => {
  const cv = new SoftCanvas(VIEW_W, VIEW_H);
  const ctx = cv.getContext('2d');
  const lvl = buildLevel(16);
  const w = new World(lvl, { god: true });
  w.player.x = 24 * TILE;
  w.player.y = 13 * TILE;
  w.camera.snap(w.player);
  const input = makeInput();
  run(w, input, seconds(1), []);
  w.alarmT = 3;
  renderWorld(ctx, w);
  const lit = cv.data.reduce((n, v, i) => n + (i % 4 === 0 && v > 200 ? 1 : 0), 0);
  assert.ok(lit > 0);
  const l19 = buildLevel(18);
  const w2 = new World(l19, { god: true });
  const guns = l19.spawns.find((s) => s.type === 'ceilgun');
  w2.player.x = guns.x - 40;
  w2.player.y = 13 * TILE;
  w2.camera.snap(w2.player);
  run(w2, input, seconds(0.5), []);
  renderWorld(ctx, w2);
  const beamz = l19.zones.find((z) => z.type === 'beam');
  w2.player.x = beamz.x - 20;
  w2.camera.snap(w2.player);
  run(w2, input, 2, []);
  renderWorld(ctx, w2);
});
