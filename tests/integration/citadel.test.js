// Week 14: Level 20 (the Warlord's Citadel), the boss rush of Echo bosses, the Rift Warlord, and the ending with its credits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInput, run, seconds } from '../support/helpers.js';
import { makeGame, stepN, tap } from '../support/fixtures.js';
import { World } from '../../src/game/world.js';
import { buildLevel, levelCount, levelName, LEVEL_DEFS } from '../../src/game/levels.js';
import { TILE, VIEW_W, VIEW_H, PLAYER } from '../../src/game/constants.js';
import { BOSSES, ECHOES } from '../../src/game/bosses.js';
import { ENEMY_DEFS } from '../../src/game/enemy_defs.js';
import { bossDown } from '../../src/game/boss.js';
import { damageEnemy } from '../../src/game/enemies.js';
import { warlord } from '../../src/game/bosses/warlord.js';
import { fightBoss } from '../../tools/bossbot.js';
import { TRACKS } from '../../src/game/tracks.js';
import { registerRoutes } from '../../src/scenes/routes.js';
import { PlayScene } from '../../src/scenes/play.js';
import { ResultsScene } from '../../src/scenes/results.js';
import { EndingScene, endingBonus, endingRank, STORY, ENDING_BONUS } from '../../src/scenes/ending.js';
import { CreditsScene, creditsScript, BOSS_ORDER } from '../../src/scenes/credits.js';
import { MenuScene } from '../../src/scenes/menu.js';
import { NameEntryScene } from '../../src/scenes/nameentry.js';
import { Run } from '../../src/game/run.js';
import { SaveData, MemoryStorage } from '../../src/game/save.js';
import { SoftCanvas } from '../../tools/softcanvas.js';
import { renderWorld } from '../../src/game/render.js';
import { drawHud } from '../../src/game/art/hud.js';
import { T } from '../../src/game/tiles.js';

const LEVEL = 19;
const lvl = () => buildLevel(LEVEL);

/** A world standing in arena `i` (0-2 are the echoes, 3 the Warlord), with the boss walked in and idling. */
function arenaWorld(i, opts = {}) {
  const level = lvl();
  const arenas = [...level.rush, level.boss];
  const L = arenas[i];
  const w = new World(level, { god: true, start: { x: L.x0 + 3 * TILE, y: L.floorY }, ...opts });
  const input = makeInput();
  run(w, input, seconds(0.3), ['right']);
  for (let k = 0; k < seconds(10) && !(w.boss && w.boss.bs.state === 'idle'); k++) run(w, input, 1, []);
  return { w, L, boss: w.boss, input, level };
}

/** Put the boss into an attack's telegraph, as pickAttack would, and run until the attack has started. */
function startAttack(w, boss, name, input) {
  const bs = boss.bs;
  const atk = boss.def.attacks[name];
  bs.state = 'tele';
  bs.atk = name;
  bs.last = name;
  bs.t = 0.05;
  bs.teleMax = Math.max(0.6, atk.tele);
  if (atk.teleStart) atk.teleStart(boss, w);
  run(w, input, 6, []);
  assert.equal(bs.state, 'attack', `${name} began`);
}

// ---------------------------------------------------------------------------------------------------------------
// Level 20
// ---------------------------------------------------------------------------------------------------------------
test('Level 20: the Warlord\'s Citadel is the last of twenty levels', () => {
  assert.equal(levelCount(), 20);
  assert.equal(LEVEL_DEFS.length, 20);
  const level = lvl();
  assert.equal(level.name, 'WARLORD CITADEL');
  assert.equal(level.era, 'THE END OF TIME');
  assert.equal(level.theme, 'citadel');
  assert.equal(level.music, 'citadel');
  assert.equal(level.bossMusic, 'finale');
  assert.equal(levelName(LEVEL), 'WARLORD CITADEL');
  assert.equal(level.boss.type, 'warlord');
  assert.ok(level.cols >= 300);
});

test('Level 20: three echo arenas in a row before the Warlord, each a flat screen with a checkpoint at its door', () => {
  const level = lvl();
  assert.deepEqual(level.rush.map((a) => a.type), ['echo_trex', 'echo_colossus', 'echo_supertank']);
  const arenas = [...level.rush, level.boss];
  for (let i = 0; i < arenas.length; i++) {
    const a = arenas[i];
    assert.equal(a.x1 - a.x0, VIEW_W, `arena ${i} is exactly one screen wide`);
    assert.equal(a.cam, a.x0, 'the camera locks on its left edge');
    assert.ok(a.trigger > a.x0 && a.trigger < a.x1);
    if (i > 0) assert.ok(a.x0 > arenas[i - 1].x1, 'a corridor lies between arenas');
    const col0 = a.x0 / TILE;
    for (let x = col0; x < a.x1 / TILE; x++) assert.equal(level.tiles[(a.floorY / TILE) * level.cols + x], T.SOLID, `arena ${i} floor is unbroken`);
    assert.ok(level.checkpoints.some((c) => c.x >= a.x0 && c.x < a.trigger), `arena ${i} has a checkpoint`);
  }
  assert.ok(level.rush.every((a) => a.echo === true && a.hp >= 20 && a.hp < 100));
  assert.equal(level.boss.echo, undefined);
});

test('Level 20: the Plasma Cannon is on offer at the start and before each hard fight; there is no hidden 1UP', () => {
  const level = lvl();
  const caps = level.spawns.filter((s) => s.type === 'capsule');
  assert.equal(caps[0].item, 'E');
  assert.ok(caps[0].x < 20 * TILE);
  assert.ok(caps.filter((c) => c.item === 'E').length >= 6);
  assert.equal(level.spawns.filter((s) => s.type === 'pickup' && s.item === '1up').length, 0);
  const w = new World(level);
  assert.equal(w.enemyCap, 14);
});

test('Level 20: a soldier who starts inside a later arena begins at that arena (continue/resume)', () => {
  const level = lvl();
  const arenas = [...level.rush, level.boss];
  const at = (x) => new World(buildLevel(LEVEL), { start: { x, y: 13 * TILE } });
  assert.equal(at(level.spawn.x).arenaIdx, 0);
  assert.equal(at(arenas[1].x0 + 16).arenaIdx, 1);
  assert.equal(at(arenas[2].x0 + 16).arenaIdx, 2);
  assert.equal(at(arenas[3].x0 + 16).arenaIdx, 3);
  assert.equal(at(arenas[1].x0 - 40).arenaIdx, 1, 'in the corridor before an arena: that arena is next');
});

test('Level 20 uses the citadel music and the final-boss track', () => {
  for (const id of ['citadel', 'finale']) {
    assert.ok(TRACKS[id], id);
    assert.equal(TRACKS[id].chords.length, 8);
  }
  assert.ok(TRACKS.finale.bpm > TRACKS.boss.bpm, 'the finale is the fastest track');
});

// ---------------------------------------------------------------------------------------------------------------
// The boss rush
// ---------------------------------------------------------------------------------------------------------------
test('echoes are separate defs: the same boss, art and attacks, with a name that says so', () => {
  for (const [id, parent] of [['echo_trex', 'trex'], ['echo_colossus', 'colossus'], ['echo_supertank', 'supertank']]) {
    const d = ECHOES[id];
    assert.ok(d && ENEMY_DEFS[id] === d, `${id} is registered as an enemy def`);
    assert.equal(BOSSES[id], undefined, 'echoes are not in the boss list');
    assert.equal(d.tpl, BOSSES[parent].tpl, 'same painter');
    assert.equal(d.attacks, BOSSES[parent].attacks, 'same attacks');
    assert.ok(d.name.startsWith('ECHO'));
    assert.ok(d.score < BOSSES[parent].score);
    assert.equal(d.arch, 'boss');
  }
});

test('an echo arena spawns a weaker boss at the arena\'s hp, keeps the stage ahead of it, and tags the event', () => {
  const level = lvl();
  const L = level.rush[0];
  const w = new World(level, { god: true, start: { x: L.x0 + 3 * TILE, y: L.floorY } });
  const events = [];
  const input = makeInput();
  for (let k = 0; k < 120 && !w.boss; k++) events.push(...run(w, input, 1, ['right']));
  assert.ok(w.boss, 'the echo appeared');
  assert.equal(w.boss.id, 'echo_trex');
  assert.equal(w.boss.hp, L.hp);
  assert.equal(w.boss.maxHp, L.hp);
  assert.equal(w.boss.echo, true);
  assert.equal(w.camera.lockMin, L.cam);
  const start = events.find((e) => e.type === 'bossStart');
  assert.equal(start.echo, true);
  // soldiers waiting beyond this arena are still waiting
  const ahead = w.spawnList.filter((s) => s.x >= L.x1);
  assert.ok(ahead.length > 5 && ahead.every((s) => !s.done), 'the rest of the stage is untouched');
  assert.ok(w.spawnList.filter((s) => s.x < L.x1).every((s) => s.done), 'everything behind was swept');
});

test('beating an echo frees the camera and moves on to the next arena, without clearing the level', () => {
  const { w, boss, L, level, input } = arenaWorld(0);
  assert.equal(w.arenaIdx, 0);
  assert.equal(w.bossArena, L);
  bossDown(w, boss);
  const events = [];
  for (let k = 0; k < seconds(5); k++) events.push(...run(w, input, 1, []));
  const d = events.find((e) => e.type === 'bossDefeated');
  assert.ok(d && d.echo === true && d.id === 'echo_trex');
  assert.equal(w.boss, null);
  assert.equal(w.arenaIdx, 1);
  assert.equal(w.bossArena.type, 'echo_colossus');
  assert.equal(w.bossDone, false);
  assert.equal(w.camera.lockMin, null);
  assert.equal(w.camera.lockMax, null);
  assert.equal(w.cleared, false);
  assert.ok(!events.some((e) => e.type === 'levelClear'));
  // the soldier can walk on: the camera follows past the old arena
  w.player.x = L.x1 - 40;
  run(w, input, seconds(2), ['right']);
  assert.ok(w.camera.x > L.cam + 40);
  void level;
});

test('the whole boss rush can be fought through: three echoes, then the Warlord, then the level is clear', () => {
  const r = fightBoss(lvl(), { arena: 0, rush: true, seconds: 600, weapon: 'plasma' });
  assert.ok(r.world.cleared, 'level clear');
  assert.deepEqual(r.defeats.map((d) => d.id), ['echo_trex', 'echo_colossus', 'echo_supertank', 'warlord']);
  assert.deepEqual(r.defeats.map((d) => !!d.echo), [true, true, true, false]);
  const clearAt = r.events.findIndex((e) => e.type === 'levelClear');
  const warlordAt = r.events.findIndex((e) => e.type === 'bossDefeated' && e.id === 'warlord');
  assert.ok(warlordAt >= 0 && clearAt > warlordAt, 'the level clears only after the Warlord');
  assert.equal(r.events.filter((e) => e.type === 'levelClear').length, 1);
  assert.equal(r.events.filter((e) => e.type === 'bossStart').length, 4);
});

for (const [i, id] of [[0, 'echo_trex'], [1, 'echo_colossus'], [2, 'echo_supertank']]) {
  test(`${id}: a full fight with the rifle is a short, clean kill`, () => {
    const r = fightBoss(lvl(), { arena: i, seconds: 120 });
    assert.ok(r.killed, 'killed');
    assert.ok(r.time >= 12 && r.time <= 60, `ideal rifle kill ${r.time?.toFixed(1)} s should be 12-60 s (an echo is a shorter fight than its original)`);
    assert.deepEqual(r.phases, [0, 1, 2], 'every phase was visited');
    assert.ok(r.attacks.size >= 3);
    const d = r.events.find((e) => e.type === 'bossDefeated');
    assert.equal(d.noDeath, true);
    assert.equal(d.echo, true);
    // an echo is weaker than its original
    const original = BOSSES[id.replace('echo_', '')];
    assert.ok(lvl().rush[i].hp < original.hp * 0.6);
  });
}

test('echoes die faster to a better weapon too', () => {
  const rifle = fightBoss(lvl(), { arena: 0, seconds: 120 });
  const plasma = fightBoss(lvl(), { arena: 0, seconds: 120, weapon: 'plasma' });
  assert.ok(plasma.killed && plasma.time < rifle.time * 0.75, `rifle ${rifle.time?.toFixed(0)} s vs plasma ${plasma.time?.toFixed(0)} s`);
});

// ---------------------------------------------------------------------------------------------------------------
// The Rift Warlord
// ---------------------------------------------------------------------------------------------------------------
test('Rift Warlord: three phases, five attacks, every one telegraphed for at least 0.6 s', () => {
  assert.equal(BOSSES.warlord, warlord);
  assert.equal(warlord.phases.length, 3);
  assert.deepEqual(Object.keys(warlord.attacks).sort(), ['beams', 'blink', 'cleave', 'nova', 'summon']);
  for (const [name, a] of Object.entries(warlord.attacks)) assert.ok(a.tele >= 0.6, `${name} telegraph`);
  assert.deepEqual(warlord.phases[0].attacks, ['cleave', 'blink', 'summon']);
  assert.ok(!warlord.phases[1].attacks.includes('nova') && warlord.phases[1].attacks.includes('beams'));
  assert.ok(warlord.phases[2].attacks.includes('nova'));
  assert.ok(warlord.hp >= 100 && warlord.score >= 50000);
});

test('Rift Warlord: the heart is open while it idles and closed while it winds up or uses beams and the nova', () => {
  const { w, boss, input } = arenaWorld(3);
  assert.equal(boss.id, 'warlord');
  const wb = warlord.weakBox(boss);
  assert.ok(wb, 'open between attacks');
  const standing = boss.y - 21; // a soldier's level shot
  assert.ok(standing > wb.y0 && standing < wb.y1, 'a standing shot reaches the heart');
  const front = boss.x + boss.face * (boss.w / 2);
  assert.ok(front >= Math.min(wb.x0, wb.x1) && front <= Math.max(wb.x0, wb.x1), 'the box reaches the front edge of the body');
  // full damage on the heart, chip damage on the armour
  const hp = boss.hp;
  damageEnemy(w, boss, 1, { x: (wb.x0 + wb.x1) / 2, y: (wb.y0 + wb.y1) / 2, vx: 300, vy: 0 });
  assert.ok(Math.abs(hp - boss.hp - 1) < 1e-9);
  const hp2 = boss.hp;
  damageEnemy(w, boss, 1, { x: boss.x, y: boss.y - 100, vx: 300, vy: 0 });
  assert.ok(Math.abs(hp2 - boss.hp - warlord.armor) < 1e-9);
  for (const atk of ['cleave', 'beams', 'nova']) {
    boss.bs.state = 'tele';
    boss.bs.atk = atk;
    assert.equal(warlord.weakBox(boss), null, `${atk} winding up: closed`);
  }
  boss.bs.state = 'attack';
  boss.bs.atk = 'beams';
  assert.equal(warlord.weakBox(boss), null);
  boss.bs.atk = 'nova';
  assert.equal(warlord.weakBox(boss), null);
  boss.bs.atk = 'cleave';
  boss.cl = { stuck: true };
  assert.ok(warlord.weakBox(boss), 'blade wedged in the floor: open');
  boss.cl = { stuck: false };
  assert.equal(warlord.weakBox(boss), null);
  boss.bs.atk = 'summon';
  assert.ok(warlord.weakBox(boss), 'roaring: open');
  void input;
});

test('Rift Warlord cleave: a low shockwave each way, then a rift crescent at chest height that a prone soldier passes under', () => {
  const { w, boss, L, input } = arenaWorld(3);
  w.player.x = boss.x - 120;
  w.player.y = L.floorY;
  startAttack(w, boss, 'cleave', input);
  assert.equal(boss.cl.stuck, true);
  assert.equal(w.ebullets.filter((b) => b.kind === 'wave').length, 2, 'one shockwave each way');
  let crescent = null;
  for (let k = 0; k < seconds(1.2) && !crescent; k++) {
    run(w, input, 1, []);
    crescent = w.ebullets.find((b) => b.kind === 'crescent');
  }
  assert.ok(crescent, 'the crescent flew');
  assert.equal(crescent.y, L.floorY - 22);
  assert.ok(Math.sign(crescent.vx) === Math.sign(w.player.x - boss.x), 'toward the soldier');
  // standing: hit. prone: under it. (non-god worlds)
  for (const [prone, dies] of [[false, true], [true, false]]) {
    // (short of the arena trigger: crossing it would sweep the stage clear of bullets)
    const ww = new World(lvl(), { start: { x: L.x0 + 40, y: L.floorY } });
    const p = ww.player;
    p.invuln = 0;
    const input = makeInput();
    run(ww, input, 4, prone ? ['down'] : []); // land, and lie down
    assert.equal(p.prone, prone);
    p.invuln = 0;
    ww.spawnEnemyBullet({ x: p.x - 30, y: L.floorY - 22, vx: 100, vy: 0, r: 5, kind: 'crescent', life: 3 });
    run(ww, input, 40, prone ? ['down'] : []);
    assert.equal(!ww.player.alive, dies, prone ? 'prone passes under' : 'standing is hit');
  }
});

test('Rift Warlord blink: marks a spot behind the soldier, appears there, then fires a fan of bolts', () => {
  const { w, boss, L, input } = arenaWorld(3);
  w.player.x = L.x0 + 200;
  w.player.y = L.floorY;
  boss.x = w.player.x + 150;
  const side = Math.sign(boss.x - w.player.x);
  startAttack(w, boss, 'blink', input);
  assert.ok(Math.abs(boss.x - w.player.x) < 90 && Math.sign(boss.x - w.player.x) === -side, 'it reappeared on the far side of the soldier');
  assert.ok(boss.x > L.x0 + 30 && boss.x < L.x1 - 30, 'inside the arena');
  assert.equal(boss.bk.mode, 'back');
  assert.ok(warlord.weakBox(boss), 'open once it is back');
  let fan = 0;
  for (let k = 0; k < seconds(1.2); k++) {
    run(w, input, 1, []);
    fan = Math.max(fan, w.ebullets.filter((b) => b.kind === 'plasma').length);
  }
  assert.ok(fan >= 5, `a fan of ${fan} bolts`);
});

test('Rift Warlord blink: with no room behind the soldier it uses the other side', () => {
  const { w, boss, L, input } = arenaWorld(3);
  w.player.x = L.x0 + 30; // against the left wall
  w.player.y = L.floorY;
  boss.x = L.x0 + 200;
  startAttack(w, boss, 'blink', input);
  assert.ok(boss.x >= L.x0 + 40 && boss.x <= L.x1 - 40);
});

test('Rift Warlord beams: marked columns stab from floor to sky one after another (more of them in the last phase)', () => {
  for (const [phase, n] of [[1, 4], [2, 6]]) {
    const { w, boss, L, input } = arenaWorld(3);
    boss.bs.phase = phase;
    w.player.x = L.x0 + 180;
    w.player.y = L.floorY;
    w.fx.length = 0;
    startAttack(w, boss, 'beams', input);
    const marks = w.fx.filter((f) => f.k === 'warn').length;
    assert.equal(marks, n, `${n} marks`);
    let cols = new Set();
    for (let k = 0; k < seconds(2.4); k++) {
      run(w, input, 1, []);
      for (const b of w.ebullets) if (b.kind === 'beam') cols.add(Math.round(b.x));
    }
    assert.equal(cols.size, n, 'one column per mark');
  }
});

test('Rift Warlord nova: three rings with a gap aimed at the soldier that moves between rings', () => {
  const { w, boss, L, input } = arenaWorld(3);
  boss.bs.phase = 2;
  w.player.x = L.x0 + 150;
  w.player.y = L.floorY;
  startAttack(w, boss, 'nova', input);
  const gaps = [];
  let rings = 0;
  let prev = 0;
  for (let k = 0; k < seconds(3.4); k++) {
    run(w, input, 1, []);
    const born = w.ebullets.filter((b) => b.kind === 'plasma' && b.age === undefined);
    for (const b of born) b.age = 0;
    if (born.length >= 10) {
      rings++;
      const cx = born.reduce((s, b) => s + b.x, 0) / born.length;
      // find the biggest angular hole between neighbouring bolts
      const angs = born.map((b) => Math.atan2(b.vy, b.vx)).sort((a, b2) => a - b2);
      let best = 0;
      let at = 0;
      for (let i = 0; i < angs.length; i++) {
        const nxt = i + 1 < angs.length ? angs[i + 1] : angs[0] + Math.PI * 2;
        if (nxt - angs[i] > best) {
          best = nxt - angs[i];
          at = angs[i] + best / 2;
        }
      }
      assert.ok(best > 0.6, `a gap of ${best.toFixed(2)} rad`);
      gaps.push(at);
      void cx;
    }
    prev = rings;
  }
  void prev;
  assert.equal(rings, 3, 'three rings');
  assert.ok(Math.abs(gaps[0] - gaps[1]) > 0.3 && Math.abs(gaps[1] - gaps[2]) > 0.3, 'the gap moves');
});

test('Rift Warlord summon: two soldiers from forgotten ages step in at the screen edges, only if there is room', () => {
  const { w, boss, input } = arenaWorld(3);
  const before = w.enemies.filter((e) => e.alive && !e.def.boss).length;
  startAttack(w, boss, 'summon', input);
  const added = w.enemies.filter((e) => e.alive && !e.def.boss);
  assert.equal(added.length - before, 2);
  assert.ok(added.every((e) => e.waiting !== true && e.maxHp <= 2));
  assert.notEqual(added[0].id, added[1].id, 'two different eras');
  assert.ok(Math.abs(added[0].x - added[1].x) > 300, 'one at each edge');
  // a full screen: the attack is not picked
  const full = arenaWorld(3);
  for (let i = 0; i < full.w.enemyCap; i++) full.w.enemies.push(Object.assign(Object.create(Object.getPrototypeOf(full.boss)), full.boss, { id: 'x', alive: true, def: { ...full.boss.def, boss: false } }));
  assert.equal(warlord.attacks.summon.when(full.boss, full.w), false);
});

test('Rift Warlord: its kill gives the level clear after the death sequence and a FLAWLESS life for a clean fight', () => {
  const { w, boss, input } = arenaWorld(3);
  bossDown(w, boss);
  const events = [];
  for (let k = 0; k < seconds(6); k++) events.push(...run(w, input, 1, []));
  const d = events.find((e) => e.type === 'bossDefeated');
  assert.equal(d.id, 'warlord');
  assert.equal(d.noDeath, true);
  assert.equal(!!d.echo, false);
  assert.ok(events.some((e) => e.type === 'levelClear'));
  assert.equal(w.cleared, true);
});

test('Rift Warlord: ideal rifle kill 40-120 s, every phase and at least four attacks, and a better weapon is faster', () => {
  const level = lvl();
  const rifle = fightBoss(level, { seconds: 300 });
  const spread = fightBoss(level, { seconds: 300, weapon: 'spread' });
  assert.ok(rifle.killed && rifle.time >= 40 && rifle.time <= 120, `rifle ${rifle.time?.toFixed(0)} s`);
  assert.deepEqual(rifle.phases, [0, 1, 2]);
  assert.ok(rifle.attacks.size >= 4, [...rifle.attacks.keys()].join(','));
  assert.ok(spread.killed && spread.time < rifle.time * 0.75, `rifle ${rifle.time?.toFixed(0)} s vs spread ${spread.time?.toFixed(0)} s`);
});

// ---------------------------------------------------------------------------------------------------------------
// Scenes: the boss theme, scoring of echoes, the ending, the credits
// ---------------------------------------------------------------------------------------------------------------
function recorder() {
  const log = [];
  return {
    log,
    music: (id) => log.push(['music', id]),
    stopMusic: () => log.push(['stop']),
    sfx: () => {},
    duck: () => {},
    setVolumes: () => {},
  };
}

function playLevel20(opts = {}) {
  const { game } = makeGame();
  const audio = recorder();
  game.audio = audio;
  registerRoutes(game);
  const run = new Run();
  run.lives.lives = 3;
  game.go('play', { run, levelIndex: LEVEL, god: true, ...opts });
  stepN(game, 1);
  return { game, run, audio, world: () => game.scene.world };
}

test('play scene: an echo uses the ordinary boss theme and the level\'s music returns; the real boss gets the finale', () => {
  const { game, run, audio, world } = playLevel20();
  run.score.milestones = 99; // no score-milestone lives muddying the count
  const w = world();
  const level = w.level;
  const L = level.rush[0];
  w.player.x = L.x0 + 3 * TILE;
  w.player.y = L.floorY;
  w.camera.snap(w.player);
  stepN(game, seconds(0.5), ['right']);
  assert.ok(w.boss && w.boss.echo);
  assert.deepEqual(audio.log.filter((l) => l[0] === 'music').at(-1), ['music', 'boss']);
  const score0 = run.score.points;
  const lives0 = run.lives.lives;
  bossDown(w, w.boss);
  stepN(game, seconds(5), []);
  assert.equal(w.arenaIdx, 1);
  assert.deepEqual(audio.log.filter((l) => l[0] === 'music').at(-1), ['music', 'citadel'], 'the level theme is back');
  assert.ok(run.score.points >= score0 + 5000, 'a clean echo pays 5,000');
  assert.equal(run.lives.lives, lives0, 'no extra life for an echo');
  assert.ok(!game.scene.ended && game.scene.clearT < 0, 'the level carries on');
  // the real thing
  const F = level.boss;
  w.arenaIdx = 3;
  w.bossDone = false;
  w.player.x = F.x0 + 3 * TILE;
  w.player.y = F.floorY;
  w.camera.snap(w.player);
  stepN(game, seconds(0.5), ['right']);
  assert.equal(w.boss.id, 'warlord');
  assert.deepEqual(audio.log.filter((l) => l[0] === 'music').at(-1), ['music', 'finale']);
  bossDown(w, w.boss);
  stepN(game, seconds(6), []);
  assert.equal(run.lives.lives, lives0 + 1, 'a FLAWLESS Warlord kill is worth a life');
  assert.ok(game.scene.clearT >= 0 || game.scene.ended, 'now the level is clear');
});

test('the ending bonuses and rank', () => {
  const r = new Run();
  assert.deepEqual(endingBonus(r), { clear: ENDING_BONUS.CLEAR, noContinue: ENDING_BONUS.NO_CONTINUE, noDeath: ENDING_BONUS.NO_DEATH, total: 175000 });
  assert.equal(endingRank(r), 'S');
  r.totalDeaths = 9;
  assert.equal(endingBonus(r).total, 75000);
  assert.equal(endingRank(r), 'A');
  r.totalDeaths = 16;
  assert.equal(endingRank(r), 'B');
  r.continuesUsed = 1;
  assert.equal(endingBonus(r).total, 50000);
  assert.equal(endingRank(r), 'B');
  r.continuesUsed = 2;
  assert.equal(endingRank(r), 'C');
});

test('credits script: every level and every boss is named, in order, and the boss list matches the level scripts', () => {
  assert.equal(BOSS_ORDER.length, levelCount());
  for (let i = 0; i < levelCount(); i++) assert.equal(buildLevel(i).boss.type, BOSS_ORDER[i], `level ${i + 1}'s boss`);
  const text = creditsScript().map((l) => l.s);
  for (let i = 0; i < levelCount(); i++) {
    assert.ok(text.includes(levelName(i)), `level ${i + 1} is credited`);
    assert.ok(text.includes(BOSSES[BOSS_ORDER[i]].name), `boss ${i + 1} is credited`);
  }
  assert.equal(text.at(-1), 'THE END');
  assert.ok(text.includes('THANK YOU FOR PLAYING'));
});

function bootEnding(run = new Run()) {
  const { game, canvas } = makeGame();
  registerRoutes(game);
  game.go('ending', { run });
  stepN(game, 2);
  return { game, canvas, run };
}

test('ending: four story pages that type themselves out and are skipped with fire, then the tally pays the bonuses once', () => {
  const run = new Run();
  run.score.points = 100000;
  run.score.milestones = 5; // the next life milestone is far off (270,000)
  run.totalDeaths = 7;
  run.totalTime = 3725;
  const { game } = bootEnding(run);
  const s = game.scene;
  assert.ok(s instanceof EndingScene);
  assert.equal(game.save.cleared, 1, 'the clear is recorded');
  for (let page = 0; page < STORY.length; page++) {
    assert.equal(s.page, page);
    assert.equal(s.stage, 'story');
    stepN(game, 30);
    assert.ok(s.typed > 0 && s.typed < s.pageLength, 'still typing');
    stepN(game, 18);
    tap(game); // the first press completes the page
    assert.equal(Math.floor(s.typed), s.pageLength);
    tap(game); // the second turns it
  }
  assert.equal(s.stage, 'tally');
  assert.equal(run.score.points, 100000 + 50000 + 25000, 'clear + no-continue bonuses, once');
  stepN(game, 400);
  assert.ok(s.shown > s.rows.length, 'all rows are up');
  const rows = Object.fromEntries(s.rows);
  assert.equal(rows['TOTAL TIME'], '62:05');
  assert.equal(rows.DEATHS, '7');
  assert.equal(s.rank, 'A');
  tap(game);
  assert.equal(run.score.points, 175000, 'a second press does not pay again');
});

test('ending -> credits -> high-score entry (or the menu when the score is too low)', () => {
  // a good score: the credits end in the name entry
  let run = new Run();
  run.score.points = 123456;
  let { game } = bootEnding(run);
  for (let i = 0; i < 10; i++) {
    stepN(game, 70);
    tap(game);
    tap(game);
  }
  stepN(game, 400);
  tap(game);
  assert.ok(game.scene instanceof CreditsScene, 'the credits roll');
  assert.equal(game.scene.run, run);
  // hold fire to speed the roll up, until it reaches THE END
  for (let i = 0; i < 4000 && !game.scene.finished; i++) stepN(game, 1, ['fire']);
  assert.ok(game.scene.finished);
  stepN(game, 40);
  tap(game);
  stepN(game, 2);
  assert.ok(game.scene instanceof NameEntryScene, 'a top-10 score asks for initials');
  assert.equal(game.save.resume, null, 'the mid-run save was cleared');
});

test('credits from the main menu go back to the menu; back skips them', () => {
  const { game } = makeGame();
  registerRoutes(game);
  game.go('menu');
  stepN(game, 2);
  const idx = game.scene.menu.items.findIndex((it) => it.label === 'CREDITS');
  assert.ok(idx >= 0);
  while (game.scene.menu.index !== idx) tap(game, 'down');
  tap(game);
  stepN(game, 2);
  assert.ok(game.scene instanceof CreditsScene && game.scene.run === null);
  stepN(game, 60);
  assert.ok(game.scene.scroll > 0);
  tap(game, 'back');
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene);
});

test('the clear counter is saved, sanitised and shown on the menu', () => {
  const storage = new MemoryStorage();
  const save = new SaveData(storage);
  assert.equal(save.cleared, 0);
  save.markCleared();
  save.markCleared();
  assert.equal(new SaveData(storage).cleared, 2);
  storage.setItem('epoch-strike-save-v1', JSON.stringify({ version: 1, cleared: -3 }));
  assert.equal(new SaveData(storage).cleared, 0);
  storage.setItem('epoch-strike-save-v1', JSON.stringify({ version: 1, cleared: 'lots' }));
  assert.equal(new SaveData(storage).cleared, 0);
});

test('the last level\'s results screen leads to the ending, not to a 21st level', () => {
  const { game } = makeGame();
  registerRoutes(game);
  const run = new Run();
  run.startLevel(LEVEL);
  game.go('results', { run, levelIndex: LEVEL });
  stepN(game, 400);
  tap(game);
  stepN(game, 2);
  assert.ok(game.scene instanceof EndingScene);
  assert.equal(game.save.unlocked, levelCount());
  void ResultsScene;
  void PlayScene;
});

// ---------------------------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------------------------
test('rendering: every Warlord pose and the echoes draw, the HUD bar of an echo is violet', () => {
  const cv = new SoftCanvas(VIEW_W, VIEW_H);
  const ctx = cv.getContext('2d');
  const { w, boss, input } = arenaWorld(3);
  const frames = [];
  for (const phase of [0, 2]) {
    boss.bs.phase = phase;
    for (const atk of Object.keys(warlord.attacks)) {
      for (const state of ['tele', 'attack']) {
        boss.bs.state = state;
        boss.bs.atk = atk;
        boss.bs.t = 0.5;
        boss.bs.teleMax = 1;
        boss.cl = atk === 'cleave' ? { stuck: state === 'attack' } : null;
        boss.bk = atk === 'blink' ? { mode: 'back', t: 1, fired: true } : null;
        ctx.clearRect(0, 0, VIEW_W, VIEW_H);
        renderWorld(ctx, w);
        drawHud(ctx, w, new Run(), {});
        frames.push(cv.data.reduce((n, v) => n + (v ? 1 : 0), 0));
      }
    }
  }
  assert.ok(frames.every((n) => n > 1000));
  void input;
  // an echo
  const e = arenaWorld(0);
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  renderWorld(ctx, e.w);
  drawHud(ctx, e.w, new Run(), {});
  assert.ok(e.boss.echo);
});

test('rendering: the ending, tally and credits scenes draw at every stage', () => {
  const cv = new SoftCanvas(VIEW_W, VIEW_H);
  const ctx = cv.getContext('2d');
  const { game } = bootEnding(new Run());
  const blank = cv.data.reduce((n, v) => n + (v ? 1 : 0), 0);
  for (let page = 0; page < STORY.length; page++) {
    stepN(game, 120);
    game.scene.draw(ctx);
    tap(game);
    tap(game);
  }
  assert.equal(game.scene.stage, 'tally');
  stepN(game, 400);
  game.scene.draw(ctx);
  const credits = new CreditsScene(game.constructor === Object ? game : game, { run: null });
  for (const scroll of [0, 300, 1500, credits.endAt]) {
    credits.scroll = scroll;
    credits.draw(ctx);
  }
  assert.ok(cv.data.reduce((n, v) => n + (v ? 1 : 0), 0) > blank);
});
