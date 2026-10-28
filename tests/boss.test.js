import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from './helpers.js';
import { World } from '../src/game/world.js';
import { buildLevel, LEVEL_DEFS } from '../src/game/levels.js';
import { BOSSES } from '../src/game/bosses.js';
import { MIN_BOSS_TELE, shockwave } from '../src/game/boss.js';
import { damageEnemy } from '../src/game/enemies.js';
import { TILE, DT } from '../src/game/constants.js';
import { fightBoss, arenaLedges } from '../tools/bossbot.js';

// how the ideal-player bot has to fight each boss (default: stand and shoot)
const STYLE = { bear: 'ledge', sphinx: 'ledge', champion: 'ledge', dragonkite: 'under', kraken: 'ledge', siegetower: 'ground', oni: 'ledge', ghostgalleon: 'ground', locomotive: 'ground', furnace: 'ground', zeppelin: 'under', silomech: 'ledge', gunship: 'under' };

const bossLevels = LEVEL_DEFS.map((d, i) => [d, i]).filter(([, i]) => buildLevel(i).boss);

function arenaWorld(index, opts = {}) {
  const lvl = buildLevel(index);
  const L = lvl.boss;
  return new World(lvl, { start: { x: L.x0 + 3 * TILE, y: L.floorY }, ...opts });
}

test('every boss def follows the framework rules', () => {
  for (const d of Object.values(BOSSES)) {
    assert.equal(d.arch, 'boss');
    assert.ok(d.boss && d.name && d.hp >= 40 && d.w > 0 && d.h > 0, `${d.id}: basics`);
    assert.equal(d.phases[0].hp, 1, `${d.id}: phase 1 starts at full health`);
    assert.ok(d.phases.length >= 2 && d.phases.length <= 3, `${d.id}: 2-3 phases`);
    for (let i = 1; i < d.phases.length; i++) assert.ok(d.phases[i].hp < d.phases[i - 1].hp, `${d.id}: thresholds fall`);
    assert.equal(typeof d.weakBox, 'function', `${d.id}: has a weak point`);
    const used = new Set(d.phases.flatMap((p) => p.attacks));
    for (const name of used) {
      const a = d.attacks[name];
      assert.ok(a, `${d.id}: attack ${name} exists`);
      assert.ok(a.tele >= MIN_BOSS_TELE, `${d.id}.${name}: telegraph ${a.tele}s is under ${MIN_BOSS_TELE}s`);
      assert.ok(a.dur > 0);
    }
    assert.ok(used.size >= 3, `${d.id}: at least three different attacks`);
    for (const p of d.phases) assert.ok(p.cd[0] > 0 && p.cd[1] >= p.cd[0]);
  }
});

for (const [def, i] of bossLevels) {
  const id = buildLevel(i).boss.type;
  test(`boss ${id} (level ${i + 1}): arena trigger locks the camera and spawns it outside the player's reach`, () => {
    const w = arenaWorld(i, { god: true });
    const input = makeInput();
    const L = w.level.boss;
    assert.equal(w.boss, null);
    for (let k = 0; k < 120 && !w.boss; k++) run(w, input, 1, ['right']);
    assert.ok(w.boss, 'boss spawned when the player walked in');
    assert.equal(w.boss.id, id);
    assert.equal(w.camera.lockMin, L.cam);
    assert.ok(w.boss.x > L.x1 - 60, 'it starts at the right edge');
    assert.equal(w.enemies.filter((e) => !e.def.boss).length, 0, 'the arena was swept clear of other enemies');
    void def;
  });

  test(`boss ${id}: invulnerable while it walks in, then takes damage; weak point beats armour`, () => {
    const w = arenaWorld(i, { god: true });
    const input = makeInput();
    for (let k = 0; k < 120 && !w.boss; k++) run(w, input, 1, ['right']);
    run(w, input, 5);
    const b = w.boss;
    assert.equal(b.bs.state, 'enter');
    const hp0 = b.hp;
    damageEnemy(w, b, 5, { x: b.x, y: b.cy, vx: 300, vy: 0 });
    assert.equal(b.hp, hp0, 'no damage during the intro');
    // wait for the fight to begin
    for (let k = 0; k < seconds(8) && b.bs.state === 'enter'; k++) run(w, input, 1);
    assert.notEqual(b.bs.state, 'enter');
    // park it in a known state with the weak point open
    for (let k = 0; k < seconds(6) && !b.def.weakBox(b); k++) run(w, input, 1);
    const wb = b.def.weakBox(b);
    assert.ok(wb, 'a weak point opens up at some point');
    const before = b.hp;
    damageEnemy(w, b, 1, { x: (wb.x0 + wb.x1) / 2, y: (wb.y0 + wb.y1) / 2, vx: 300, vy: 0 });
    assert.equal(before - b.hp, 1, 'weak point: full damage');
    const mid = b.hp;
    damageEnemy(w, b, 1, { x: wb.x1 + 80, y: wb.y0 - 60, vx: 300, vy: 0 });
    assert.ok(Math.abs(mid - b.hp - b.def.armor) < 1e-9, 'armour: chip damage only');
  });

  test(`boss ${id}: full fight with the rifle ends in a clean kill inside the target time`, () => {
    const lvl = buildLevel(i);
    const r = fightBoss(lvl, { weapon: null, seconds: 300, style: STYLE[id] });
    assert.ok(r.killed, 'the bot killed it');
    assert.ok(r.time >= 40 && r.time <= 120, `ideal rifle kill time ${r.time?.toFixed(1)}s should be 40-120 s`);
    assert.deepEqual(r.phases, [...Array(lvl.boss ? BOSSES[id].phases.length : 0).keys()], 'every phase was visited, in order');
    assert.ok(r.attacks.size >= 3, `attacks used: ${[...r.attacks.keys()].join(',')}`);
    const types = r.events.map((e) => e.type);
    for (const t of ['bossStart', 'bossDying', 'bossDefeated', 'levelClear']) assert.ok(types.includes(t), t);
    assert.ok(types.indexOf('bossStart') < types.indexOf('bossDying') && types.indexOf('bossDying') < types.indexOf('bossDefeated') && types.indexOf('bossDefeated') < types.indexOf('levelClear'));
    assert.equal(r.events.find((e) => e.type === 'bossDefeated').noDeath, true);
    assert.ok(r.world.cleared && r.world.boss === null);
  });

  test(`boss ${id}: a better weapon shortens the fight`, () => {
    const lvl = buildLevel(i);
    const rifle = fightBoss(lvl, { seconds: 300, style: STYLE[id] });
    const spread = fightBoss(lvl, { weapon: 'spread', seconds: 300, style: STYLE[id] });
    assert.ok(spread.killed && spread.time < rifle.time * 0.75, `rifle ${rifle.time?.toFixed(0)}s vs spread ${spread.time?.toFixed(0)}s`);
  });
}

test('shockwaves hurt a standing player but can be jumped', () => {
  const lvl = buildLevel(0);
  const L = lvl.boss;
  const mk = () => new World(lvl, { start: { x: L.x0 + 100, y: L.floorY } });
  // standing still: hit
  let w = mk();
  let input = makeInput();
  run(w, input, 2);
  shockwave(w, L.x0 + 220, L.floorY, -1, 150);
  const seen = run(w, input, seconds(2));
  assert.ok(seen.some((e) => e.type === 'playerDied'), 'standing in its path kills');
  // jumping as it arrives: clear
  w = mk();
  input = makeInput();
  run(w, input, 2);
  shockwave(w, L.x0 + 220, L.floorY, -1, 150);
  let died = false;
  let jumped = false;
  for (let k = 0; k < seconds(2); k++) {
    const wave = w.ebullets.find((b) => b.kind === 'wave');
    const near = wave && Math.abs(wave.x - w.player.x) < 34 && w.player.grounded;
    if (near && !jumped) jumped = true;
    const seenNow = run(w, input, 1, near || !w.player.grounded ? ['jump'] : []);
    if (seenNow.some((e) => e.type === 'playerDied')) died = true;
  }
  assert.ok(jumped && !died, 'a well-timed jump clears the wave');
});

test('a clean boss kill earns a life through the play scene, a messy one does not', async () => {
  const { makeGame, stepN } = await import('../tools/shots.mjs');
  const { registerRoutes } = await import('../src/scenes/routes.js');
  const { Run } = await import('../src/game/run.js');
  const { game } = makeGame();
  registerRoutes(game);
  const runA = new Run();
  game.go('play', { run: runA, levelIndex: 0, god: true });
  stepN(game, 5);
  const before = runA.lives.lives;
  game.scene.onEvent({ type: 'bossDefeated', id: 'trex', noDeath: true });
  assert.equal(runA.lives.lives, before + 1);
  game.scene.onEvent({ type: 'bossDefeated', id: 'trex', noDeath: false });
  assert.equal(runA.lives.lives, before + 1, 'no second life');
  assert.ok(DT > 0);
});

test('the era weapon (Fire Spear) beats the rifle against the Cave Bear Hive', () => {
  const lvl = buildLevel(3);
  const rifle = fightBoss(lvl, { seconds: 300, style: 'ledge' });
  const spear = fightBoss(lvl, { weapon: 'spear', seconds: 300, style: 'ledge' });
  assert.ok(spear.killed && spear.time < rifle.time * 0.8, `rifle ${rifle.time?.toFixed(0)}s vs spear ${spear.time?.toFixed(0)}s`);
  assert.ok(spear.time >= 25, `the boss still lasts ${spear.time?.toFixed(0)}s against the era weapon`);
});

test('Cave Bear Hive: its hive sits above standing fire, so shooting from the ground barely scratches it', () => {
  const lvl = buildLevel(3);
  const ground = fightBoss(lvl, { seconds: 100, style: 'ground' });
  const ledge = fightBoss(lvl, { seconds: 100, style: 'ledge' });
  assert.ok(ledge.killed, 'from a ledge it dies inside 100 s');
  assert.ok(!ground.killed, 'standing on the floor it does not');
  // the arena has two ledges, one each side, low enough to jump onto
  const ledges = arenaLedges(lvl);
  assert.equal(ledges.length, 2);
  for (const l of ledges) assert.ok(lvl.boss.floorY - l.y <= 2 * TILE && l.x1 - l.x0 >= 4 * TILE);
  // and the weak box lines up with a soldier standing on one
  const w = arenaWorld(3, { god: true });
  const input = makeInput();
  for (let k = 0; k < 120 && !w.boss; k++) run(w, input, 1, ['right']);
  const b = w.boss;
  for (let k = 0; k < seconds(8) && !b.def.weakBox(b); k++) run(w, input, 1);
  const wb = b.def.weakBox(b);
  const muzzleOnLedge = lvl.boss.floorY - 2 * TILE - 21; // shoulder height of a standing soldier on the ledge
  const muzzleOnFloor = lvl.boss.floorY - 21;
  assert.ok(muzzleOnLedge >= wb.y0 && muzzleOnLedge <= wb.y1, 'ledge fire lands on the hive');
  assert.ok(muzzleOnFloor > wb.y1, 'floor fire passes beneath it');
});

test('bats from the hive: the swarm attack releases cave bats up to the enemy cap', () => {
  const w = arenaWorld(3, { god: true });
  const input = makeInput();
  for (let k = 0; k < 120 && !w.boss; k++) run(w, input, 1, ['right']);
  const b = w.boss;
  for (let k = 0; k < seconds(8) && b.bs.state === 'enter'; k++) run(w, input, 1);
  b.bs.state = 'idle';
  b.bs.cd = 0;
  // force the swarm
  b.def.phases[0].attacks.splice(0, 3, 'swarm');
  try {
    let bats = 0;
    for (let k = 0; k < seconds(6); k++) {
      run(w, input, 1);
      bats = Math.max(bats, w.enemies.filter((e) => e.alive && e.id === 'bat').length);
    }
    assert.ok(bats >= 2 && bats <= w.enemyCap, `${bats} bats at once`);
  } finally {
    b.def.phases[0].attacks.splice(0, 1, 'swipe', 'swarm', 'lunge');
  }
});
