// Week 9 (Vikings): sea serpents, swells, berserkers, axe throwers, the Crossbow Volley and the Kraken.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from './helpers.js';
import { World } from '../src/game/world.js';
import { LevelBuilder } from '../src/game/levelgen.js';
import { buildLevel } from '../src/game/levels.js';
import { TILE, DT, VIEW_W, enemyCapFor } from '../src/game/constants.js';
import { spawnEnemy, damageEnemy } from '../src/game/enemies.js';
import { ENEMY_DEFS } from '../src/game/enemy_defs.js';
import { WEAPONS, eraWeaponFor } from '../src/game/weapons.js';
import { fightBoss } from '../tools/bossbot.js';

function deckLevel() {
  const b = new LevelBuilder({ id: 8, theme: 'fjord', seed: 5 });
  b.flat(20);
  const x0 = b.x;
  b.flat(40);
  const x1 = b.x;
  b.swells(x0, x1, { period: 3, speed: 120, first: 1 });
  b.flat(10);
  b.exit();
  return { level: b.finish(), x0, x1 };
}

function fordLevel() {
  const b = new LevelBuilder({ id: 8, theme: 'fjord', seed: 5 });
  b.flat(14);
  const ford = b.pit(5, { fill: 'water' });
  b.addEnemy('serpent', ford.x0 + 2, { row: b.gy + 1 });
  b.flat(14);
  b.exit();
  return { level: b.finish(), ford };
}

test('sea serpent: lurks out of sight, ripples for at least 0.6 s, leaps in an arc, then dives and waits again', () => {
  const { level, ford } = fordLevel();
  const w = new World(level, { god: true });
  const input = makeInput();
  w.player.x = (ford.x0 - 4) * TILE;
  w.player.y = 13 * TILE;
  w.camera.snap(w.player);
  run(w, input, 2);
  const s = w.enemies.find((e) => e.id === 'serpent');
  assert.ok(s && s.arch === 'breacher');
  assert.equal(s.def.noCap, true, 'lurking serpents do not use up the on-screen enemy cap');
  assert.equal(s.hidden, true, 'it cannot be seen or shot while it lurks');
  let teleAt = null;
  let leapAt = null;
  let top = s.base;
  let dived = false;
  for (let k = 0; k < seconds(10) && !dived; k++) {
    run(w, input, 1);
    if (s.state === 'tele' && teleAt === null) teleAt = w.time;
    if (s.state === 'leap') {
      if (leapAt === null) leapAt = w.time;
      assert.equal(s.hidden, false);
      assert.equal(s.noContact, false);
      top = Math.min(top, s.y);
    }
    if (leapAt !== null && s.state === 'lurk') dived = true;
  }
  assert.ok(teleAt !== null && leapAt !== null && dived);
  assert.ok(leapAt - teleAt >= 0.6, `ripple lasted ${(leapAt - teleAt).toFixed(2)} s`);
  assert.ok(s.base - top > 60 && s.base - top < 130, `it leapt ${(s.base - top).toFixed(0)} px`);
  assert.equal(s.hidden, true, 'and is hidden again');
});

test('sea serpent: a lurking serpent cannot be shot or touched, but one in mid-leap kills on contact', () => {
  const { level, ford } = fordLevel();
  const w = new World(level, { god: false });
  const input = makeInput();
  w.player.x = (ford.x0 + 2) * TILE + 8;
  w.player.y = 13 * TILE;
  w.player.invuln = 0;
  w.camera.snap(w.player);
  const s = w.enemies.find((e) => e.id === 'serpent') || spawnEnemy(w, level.spawns.find((e) => e.type === 'serpent'));
  s.t = 99;
  const hp = s.hp;
  damageEnemy(w, s, 1, { x: s.x, y: s.y - 4, vx: 300, vy: 0 });
  assert.equal(s.hp, hp - 1, 'damage code does not care; it is the hidden flag that stops bullets (below)');
  s.hp = s.maxHp;
  // a bullet fired at a lurking serpent passes through it
  s.state = 'lurk';
  s.hidden = true;
  w.spawnBullet({ x: s.x - 20, y: s.base - 6, vx: 300, vy: 0, dmg: 1, life: 1, kind: 'rifle' });
  run(w, input, seconds(0.3));
  assert.equal(s.hp, s.maxHp, 'bullets pass through a lurking serpent');
  // a lurking serpent does not hurt either
  s.x = w.player.x;
  s.y = s.base + 14;
  run(w, input, 3);
  assert.ok(w.player.alive, 'no contact damage under the water');
  // in mid-leap it kills
  s.state = 'leap';
  s.hidden = false;
  s.noContact = false;
  s.x = w.player.x;
  s.y = w.player.y - 8;
  s.vy = -20;
  s.vx = 0;
  s.trail = [];
  const seen = run(w, input, 4);
  assert.ok(seen.some((e) => e.type === 'playerDied'), 'contact with a leaping serpent is fatal');
});

test('swells: a wave rolls in from the right edge on the period, is jumpable, and a bulwark stops it', () => {
  const { level, x0 } = deckLevel();
  const w = new World(level, { god: false });
  const input = makeInput();
  w.player.x = (x0 + 10) * TILE;
  w.player.y = 13 * TILE;
  w.player.invuln = 0;
  w.camera.snap(w.player);
  let first = null;
  let count = 0;
  const seen = new Set();
  for (let k = 0; k < seconds(8); k++) {
    // a perfect jumper: leave the ground when a swell is close
    const sw = w.ebullets.find((b) => b.kind === 'surf');
    const near = sw && Math.abs(sw.x - w.player.x) < 40 && w.player.grounded;
    const ev = run(w, input, 1, near || !w.player.grounded ? ['jump'] : []);
    assert.ok(!ev.some((e) => e.type === 'playerDied'), 'a well-timed jump clears every swell');
    for (const b of w.ebullets) if (b.kind === 'surf' && !seen.has(b)) {
      seen.add(b);
      count++;
      if (first === null) first = { x: b.x, t: w.time };
    }
  }
  assert.ok(count >= 2, `${count} swells in 8 s`);
  assert.ok(first.x > w.camera.x + VIEW_W - 4, 'the first came in from the right edge');
  // standing still in the open: it kills
  const w2 = new World(level, { god: false });
  w2.player.x = (x0 + 10) * TILE;
  w2.player.y = 13 * TILE;
  w2.player.invuln = 0;
  w2.camera.snap(w2.player);
  const died = run(w2, makeInput(), seconds(8)).some((e) => e.type === 'playerDied');
  assert.ok(died, 'a soldier who stands in the open is swept away');
});

test('swells: a solid bulwark in the swell\'s path stops it, and no swell appears outside the zone', () => {
  const b = new LevelBuilder({ id: 8, theme: 'fjord', seed: 5 });
  b.flat(20);
  const x0 = b.x;
  const deck = b.flat(30);
  b.block(deck.x0 + 14, 2, 1);
  const x1 = b.x;
  b.swells(x0, x1, { period: 3, speed: 120, first: 0.5 });
  b.flat(10);
  b.exit();
  const level = b.finish();
  const w = new World(level, { god: true });
  const input = makeInput();
  w.player.x = (deck.x0 + 6) * TILE;
  w.player.y = 13 * TILE;
  w.camera.snap(w.player);
  const blockX = (deck.x0 + 14) * TILE;
  let reachedBlock = false;
  let passedBlock = false;
  for (let k = 0; k < seconds(8); k++) {
    run(w, input, 1);
    for (const s of w.ebullets) {
      if (s.kind !== 'surf') continue;
      if (s.x < blockX + 40) reachedBlock = true;
      if (s.x < blockX - 4) passedBlock = true;
    }
  }
  assert.ok(reachedBlock && !passedBlock, 'swells die on the bulwark');
  // outside the zone: none
  const w3 = new World(level, { god: true });
  w3.player.x = 8 * TILE;
  w3.player.y = 13 * TILE;
  w3.camera.snap(w3.player);
  run(w3, makeInput(), seconds(6));
  assert.equal(w3.ebullets.filter((e) => e.kind === 'surf').length, 0);
});

test('berserker: speeds up once it is hurt; axe thrower: lobs a spinning axe after a telegraph', () => {
  const d = ENEMY_DEFS.berserker;
  assert.equal(d.enrage, true);
  const b = new LevelBuilder({ id: 8, theme: 'fjord', seed: 5 });
  b.flat(40);
  b.exit();
  const level = b.finish();
  const w = new World(level, { god: true });
  const input = makeInput();
  w.player.x = 30 * TILE;
  w.player.y = 13 * TILE;
  w.camera.snap(w.player);
  const e = spawnEnemy(w, { type: 'berserker', x: 24 * TILE, y: 13 * TILE, face: 1 });
  e.t = 99;
  const dist = (n) => {
    const x0 = e.x;
    run(w, input, n);
    return e.x - x0;
  };
  w.player.x = 38 * TILE;
  const calm = dist(20);
  e.hp = 1;
  const angry = dist(20);
  assert.ok(angry > calm * 1.25, `calm ${calm.toFixed(1)} px vs enraged ${angry.toFixed(1)} px`);
  // the thrower
  const t = spawnEnemy(w, { type: 'axethrower', x: w.player.x - 150, y: 13 * TILE, face: 1, trig: 0 });
  let tele = null;
  let fired = null;
  for (let k = 0; k < seconds(8) && fired === null; k++) {
    run(w, input, 1);
    if (t.state === 'tele' && tele === null) tele = w.time;
    if (w.ebullets.some((x) => x.kind === 'axe')) fired = w.time;
  }
  assert.ok(tele !== null && fired !== null && fired - tele >= 0.6, 'axe throws are telegraphed');
  const ax = w.ebullets.find((x) => x.kind === 'axe');
  assert.ok(ax.g > 0, 'lobbed under gravity');
});

test('Crossbow Volley: the Viking-era weapon fires a fan of three quarrels and is what the E capsule gives in levels 9-12', () => {
  for (const i of [8, 9, 10, 11]) assert.equal(eraWeaponFor(i), 'crossbow');
  assert.equal(eraWeaponFor(7), 'ballista');
  const wd = WEAPONS.crossbow;
  assert.equal(wd.letter, 'E');
  assert.equal(wd.era, 2);
  const w = new World(buildLevel(8), { god: true });
  w.player.slots[0] = 'crossbow';
  w.player.slot = 0;
  const input = makeInput();
  run(w, input, 1, ['fire']);
  const bolts = w.bullets.filter((b) => b.kind === 'crossbow');
  assert.equal(bolts.length, 3);
  const angles = bolts.map((b) => Math.atan2(b.vy, b.vx)).sort((a, b) => a - b);
  assert.ok(angles[2] - angles[0] > 0.2 && angles[2] - angles[0] < 0.35, 'a tight fan');
  assert.ok(wd.cooldown > WEAPONS.rifle.cooldown);
});

test('Level 9: three longship decks under swells, serpents in the fords, and the Kraken at the end', () => {
  const lvl = buildLevel(8);
  assert.equal(lvl.name, 'FJORD RAID');
  assert.equal(lvl.boss.type, 'kraken');
  const sw = lvl.zones.filter((z) => z.type === 'swells');
  assert.equal(sw.length, 1);
  assert.ok(sw[0].x1 - sw[0].x0 >= 60 * TILE, 'the heaving sea covers all three ships');
  const count = (id) => lvl.spawns.filter((s) => s.type === id).length;
  assert.ok(count('serpent') >= 4 && count('berserker') >= 8 && count('axethrower') >= 4);
  assert.ok(enemyCapFor(8) === 10);
});

// ---- the Kraken ----
function krakenWorld(opts = {}) {
  const lvl = buildLevel(8);
  const L = lvl.boss;
  const w = new World(lvl, { start: { x: L.x0 + 3 * TILE, y: L.floorY }, god: true, ...opts });
  const input = makeInput();
  for (let k = 0; k < 120 && !w.boss; k++) run(w, input, 1, ['right']);
  return { w, input, L };
}

test('Kraken: the eye is the weak point and sits above standing height; it closes while the tentacles work', () => {
  const { w, input, L } = krakenWorld();
  const b = w.boss;
  for (let k = 0; k < seconds(8) && b.bs.state === 'enter'; k++) run(w, input, 1);
  for (let k = 0; k < seconds(6) && !b.def.weakBox(b); k++) run(w, input, 1);
  const wb = b.def.weakBox(b);
  assert.ok(wb, 'the eye shows in idle');
  assert.ok(L.floorY - 15 > wb.y1, 'a flat shot from the deck passes beneath it');
  const ledgeMuzzle = L.floorY - 3 * TILE - 15;
  assert.ok(ledgeMuzzle >= wb.y0 && ledgeMuzzle <= wb.y1, 'a shot from a crow\'s-nest ledge lands on it');
  // while the tentacles slam it hides the eye
  b.bs.state = 'idle';
  b.bs.cd = 0;
  b.def.phases[0].attacks = ['slam'];
  b.bs.last = null;
  let shut = 0;
  let open = 0;
  for (let k = 0; k < seconds(4); k++) {
    run(w, input, 1);
    if (b.bs.state === 'tele' || b.bs.state === 'attack') (b.def.weakBox(b) ? open++ : shut++);
  }
  assert.ok(shut > 0 && open === 0, 'eye shut during the slam');
});

test('Kraken: slam marks the deck first and then erupts tentacles; sweep sends jumpable surges; ink is lobbed', () => {
  const { w, input, L } = krakenWorld();
  const b = w.boss;
  for (let k = 0; k < seconds(8) && b.bs.state === 'enter'; k++) run(w, input, 1);
  const trial = (name, probe) => {
    b.bs.state = 'idle';
    b.bs.cd = 0;
    b.def.phases[b.bs.phase].attacks = [name];
    b.bs.last = null;
    w.ebullets.length = 0;
    w.player.x = L.x0 + 150;
    const out = {};
    for (let k = 0; k < seconds(6); k++) {
      run(w, input, 1);
      probe(out);
      if (out.done) break;
    }
    return out;
  };
  const slam = trial('slam', (o) => {
    o.marks = Math.max(o.marks || 0, w.fx.filter((f) => f.k === 'warn').length);
    const n = w.ebullets.filter((e) => e.kind === 'tentacle').length;
    if (n && o.marksAtErupt === undefined) o.marksAtErupt = o.marks;
    if (n) o.done = true;
  });
  assert.ok(slam.done && slam.marks >= 3, `${slam.marks} marks, then the tentacles`);
  const sweep = trial('sweep', (o) => {
    const s = w.ebullets.filter((e) => e.kind === 'surf');
    o.max = Math.max(o.max || 0, s.length);
    if (s.length && !o.x0) o.x0 = s[0].x;
    if (s.length && s[0].vx < 0) o.dir = -1;
    if (b.bs.state === 'idle' && o.x0) o.done = true;
  });
  assert.ok(sweep.x0 > L.x1 - 150 && sweep.dir === -1, 'a surge leaves the Kraken heading for the soldier');
  const ink = trial('ink', (o) => {
    const s = w.ebullets.filter((e) => e.kind === 'spit');
    o.max = Math.max(o.max || 0, s.length);
    o.g = s[0]?.g || o.g;
    if (b.bs.state === 'idle' && o.max) o.done = true;
  });
  assert.ok(ink.max >= 1 && ink.g > 0, 'ink is lobbed in arcs');
});

test('Kraken: boarders come over the side within the enemy cap; a clean kill is within the target time', () => {
  const { w, input } = krakenWorld();
  const b = w.boss;
  for (let k = 0; k < seconds(8) && b.bs.state === 'enter'; k++) run(w, input, 1);
  b.bs.phase = 1;
  b.bs.state = 'idle';
  b.bs.cd = 0;
  b.def.phases[1].attacks = ['boarders'];
  b.bs.last = null;
  let first = null;
  for (let k = 0; k < seconds(5); k++) {
    run(w, input, 1);
    const bs = w.enemies.filter((e) => e.alive && e.id === 'berserker');
    if (!first && bs.length) first = bs.map((e) => e.x);
    assert.ok(w.crowd() <= w.enemyCap);
  }
  assert.equal(first.length, 2);
  assert.ok(first.every((x) => x < w.camera.x), 'from the left side of the deck');
  const lvl = buildLevel(8);
  const r = fightBoss(lvl, { seconds: 300, style: 'ledge' });
  assert.ok(r.killed && r.time >= 40 && r.time <= 120, `rifle kill ${r.time?.toFixed(0)} s`);
  assert.ok(DT > 0);
});
