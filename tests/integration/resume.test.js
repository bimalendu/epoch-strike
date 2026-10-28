// Continue after a restart: play, drop the Game, build a brand-new Game on the same storage (as a page reload does) and
// check that the main menu's CONTINUE brings the run back; and that damaged or impossible saves leave CONTINUE disabled.
//
// What a resume is: the PlayScene writes a snapshot of the Run when a level STARTS (not at checkpoints). Continue
// therefore returns to the start of the level the player was on, with the lives, score, medals, continues and weapons
// they had walking in. Progress made inside the level since then is not kept, and neither is the checkpoint.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepN, tap } from '../support/fixtures.js';
import { SoftCanvas } from '../../tools/softcanvas.js';
import { Input } from '../../src/engine/input.js';
import { Game } from '../../src/game/game.js';
import { registerRoutes } from '../../src/scenes/routes.js';
import { PlayScene } from '../../src/scenes/play.js';
import { MenuScene } from '../../src/scenes/menu.js';
import { Run } from '../../src/game/run.js';
import { SaveData, MemoryStorage, SAVE_KEY } from '../../src/game/save.js';
import { levelCount, levelName } from '../../src/game/levels.js';
import { VIEW_W, VIEW_H, LIVES } from '../../src/game/constants.js';

/** A new Game (a "page load") reading the given storage. */
function boot(storage) {
  const input = new Input();
  input.script = {};
  const game = new Game({ canvas: new SoftCanvas(VIEW_W, VIEW_H), input, save: new SaveData(storage) });
  registerRoutes(game);
  return game;
}

/** Opens the main menu on a fresh page load and returns the game. */
function openMenu(storage) {
  const game = boot(storage);
  game.go('menu');
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene);
  return game;
}

const continueItem = (game) => game.scene.menu.items[1];

/** Plays level `levelIndex` from its start with a particular state, then steps up to its first checkpoint. */
function playSession(storage, { levelIndex = 3, configure = () => {} } = {}) {
  const game = boot(storage);
  const run = new Run({ difficulty: 'hard' });
  configure(run);
  game.go('play', { run, levelIndex, god: true });
  stepN(game, 2);
  const scene = game.scene;
  const cp = scene.world.level.checkpoints[0];
  scene.world.player.x = cp.x + 4;
  scene.world.player.y = cp.y;
  stepN(game, 3);
  assert.ok(run.checkpoint, 'the first checkpoint was reached');
  return { game, run, scene };
}

test('Continue brings back the level, lives, score, medals, continues and weapons the run walked in with', () => {
  const storage = new MemoryStorage();
  const { run } = playSession(storage, {
    configure: (r) => {
      r.score.add(36000);
      r.lives.lives = 4;
      r.lives.medals = 7;
      r.continuesLeft = 1;
      r.continuesUsed = 2;
      r.totalDeaths = 5;
      r.loadout = { slots: ['spread', 'laser'], slot: 1, bombs: 2 };
    },
  });
  assert.equal(run.levelIndex, 3);

  const game = openMenu(storage); // the page was reloaded
  assert.equal(continueItem(game).enabled(), true);
  assert.equal(game.scene.menu.index, 1, 'Continue is pre-selected');
  assert.equal(continueItem(game).label(), `CONTINUE ${levelName(3)}`);
  tap(game, 'confirm');
  stepN(game, 2);

  assert.ok(game.scene instanceof PlayScene);
  const back = game.scene.run;
  assert.equal(game.scene.levelIndex, 3);
  assert.equal(back.levelIndex, 3);
  assert.equal(back.difficulty, 'hard');
  assert.equal(back.score.points, 36000);
  assert.equal(back.lives.lives, 4);
  assert.equal(back.lives.medals, 7);
  assert.equal(back.continuesLeft, 1);
  assert.equal(back.continuesUsed, 2);
  assert.equal(back.totalDeaths, 5);
  assert.deepEqual(back.loadout, { slots: ['spread', 'laser'], slot: 1, bombs: 2 });
  const p = game.scene.world.player;
  assert.equal(p.weapon, 'laser', 'the second slot is the active one');
  assert.deepEqual(p.slots, ['spread', 'laser']);
  assert.equal(p.bombs, 2);
});

test('a resumed level starts at the level start: the checkpoint and in-level progress are not part of the save', () => {
  const storage = new MemoryStorage();
  const { run, scene } = playSession(storage);
  run.score.add(9999); // earned after the level started
  assert.ok(run.checkpoint.x > scene.world.level.spawn.x);

  const game = openMenu(storage);
  tap(game, 'confirm');
  stepN(game, 2);
  const resumed = game.scene;
  assert.equal(resumed.run.score.points, 0, 'the score is the one the level started with');
  assert.equal(resumed.run.checkpoint, null, 'no checkpoint is remembered across a reload');
  assert.ok(Math.abs(resumed.world.player.x - resumed.world.level.spawn.x) < 8, 'back at the start of the level');
  assert.ok(resumed.world.checkpoints.every((c) => !c.hit));
});

test('a resumed run does not overwrite its own save (fromSave), and quitting to the menu keeps Continue available', () => {
  const storage = new MemoryStorage();
  playSession(storage);
  const before = storage.getItem(SAVE_KEY);
  const game = openMenu(storage);
  tap(game, 'confirm');
  stepN(game, 2);
  assert.equal(storage.getItem(SAVE_KEY), before);
  game.go('menu');
  stepN(game, 2);
  assert.equal(continueItem(game).enabled(), true);
});

test('finishing a level and moving on to the next writes a new snapshot that Continue then uses', () => {
  const storage = new MemoryStorage();
  const game = boot(storage);
  const run = new Run();
  run.loadout = { slots: ['rifle', 'machine'], slot: 1, bombs: 1 };
  game.go('play', { run, levelIndex: 0, god: true });
  stepN(game, 2);
  const w = game.scene.world;
  run.score.add(1500);
  game.go('results', { run, levelIndex: 0, world: w }); // level 1 ends with a boss: go straight to its results
  stepN(game, 60 * 6); // let the rows count up
  tap(game, 'confirm');
  stepN(game, 2);
  assert.ok(game.scene instanceof PlayScene);
  assert.equal(game.scene.levelIndex, 1);

  const reloaded = openMenu(storage);
  assert.equal(continueItem(reloaded).label(), `CONTINUE ${levelName(1)}`);
  tap(reloaded, 'confirm');
  stepN(reloaded, 2);
  assert.equal(reloaded.scene.levelIndex, 1);
  assert.ok(reloaded.scene.run.score.points >= 1500 + 2000 * 3, 'the clear bonus was banked before the snapshot');
  assert.equal(reloaded.scene.run.loadout.slots[1], 'machine', 'the carried weapon came along');
});

test('a game over or a finished run clears the save, so a reload has nothing to continue', () => {
  const storage = new MemoryStorage();
  playSession(storage);
  assert.ok(new SaveData(storage).resume, 'there is a save while the run is alive');
  const game = boot(storage);
  const run = new Run();
  game.go('runEnd', { run });
  stepN(game, 2);
  assert.equal(new SaveData(storage).resume, null);
  assert.equal(continueItem(openMenu(storage)).enabled(), false);
});

// ---------------------------------------------------------------------------------------------------------------
// Damaged and impossible saves
// ---------------------------------------------------------------------------------------------------------------

/** A snapshot that passes validation, to be damaged one field at a time. */
function goodSnapshot() {
  const r = new Run({ difficulty: 'normal', levelIndex: 2 });
  r.score.add(5000);
  return { ...JSON.parse(JSON.stringify(r.toJSON())), loadout: { slots: ['rifle', 'spread'], slot: 0, bombs: 2 } };
}

/** The menu after a page load whose storage holds exactly this resume (or raw text). */
function menuWith(resume, raw = null) {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, raw ?? JSON.stringify({ version: 1, unlocked: 3, resume }));
  return openMenu(storage);
}

test('a sound hand-made snapshot enables Continue (the baseline for the damaged ones below)', () => {
  const game = menuWith(goodSnapshot());
  assert.equal(continueItem(game).enabled(), true);
});

const DAMAGED = {
  'invalid JSON': { raw: '{"resume": {"levelIndex": 2' },
  'a resume that is not an object': { resume: 'level 3' },
  'a resume that is an array': { resume: [] },
  'a level past the last': { over: { levelIndex: 999 } },
  'a negative level': { over: { levelIndex: -1 } },
  'a fractional level': { over: { levelIndex: 2.5 } },
  'zero lives': { over: { lives: 0 } },
  'negative lives': { over: { lives: -2 } },
  'a negative score': { over: { score: -1 } },
  'a text score': { over: { score: '5000' } },
  'a null score': { over: { score: null } },
  'more continues than a run is given': { over: { continuesLeft: LIVES.CONTINUES + 1 } },
  'an unknown difficulty': { over: { difficulty: 'nightmare' } },
  'a loadout with three slots': { loadout: { slots: ['rifle', null, 'spread'], slot: 0, bombs: 1 } },
  'a loadout with an unknown weapon': { loadout: { slots: ['rifle', 'bfg'], slot: 0, bombs: 1 } },
  'a loadout pointing at an empty slot': { loadout: { slots: ['rifle', null], slot: 1, bombs: 1 } },
  'a loadout slot out of range': { loadout: { slots: ['rifle', 'spread'], slot: 2, bombs: 1 } },
  'bombs below zero': { loadout: { slots: ['rifle', null], slot: 0, bombs: -1 } },
  'bombs above the maximum': { loadout: { slots: ['rifle', null], slot: 0, bombs: 4 } },
  'no loadout at all': { over: { loadout: undefined } },
};

for (const [name, spec] of Object.entries(DAMAGED)) {
  test(`${name}: Continue stays disabled, the menu opens on START, and the save itself is intact`, () => {
    let game;
    if (spec.raw) game = menuWith(null, spec.raw);
    else if ('resume' in spec) game = menuWith(spec.resume);
    else game = menuWith({ ...goodSnapshot(), ...(spec.over || {}), ...(spec.loadout ? { loadout: spec.loadout } : {}) });
    assert.equal(continueItem(game).enabled(), false);
    assert.equal(game.save.resume, null);
    assert.equal(game.scene.menu.index, 0, 'the menu does not pre-select a disabled Continue');
    assert.equal(continueItem(game).label(), 'CONTINUE', 'and shows no level name');
    // pressing confirm on the (skipped) entry cannot start a run: move down and the cursor jumps over it
    tap(game, 'down');
    assert.notEqual(game.scene.menu.index, 1);
    // one damaged field must not take the rest of the save with it
    if (!spec.raw) assert.equal(game.save.unlocked, 3, 'unlocked levels survive a bad resume');
  });
}

test('a life count above the cap is clamped, not rejected: Continue works with the maximum', () => {
  const game = menuWith({ ...goodSnapshot(), lives: 99 });
  assert.equal(continueItem(game).enabled(), true);
  tap(game, 'confirm');
  stepN(game, 2);
  assert.equal(game.scene.run.lives.lives, LIVES.MAX);
});

test('a missing or negative clock keeps the run and starts the clock at zero', () => {
  for (const time of [undefined, -5]) {
    const game = menuWith({ ...goodSnapshot(), time });
    assert.equal(continueItem(game).enabled(), true);
    tap(game, 'confirm');
    stepN(game, 2);
    assert.equal(game.scene.run.totalTime, 0);
  }
});

test('Continue can be started on levels from every part of the game', () => {
  for (let i = 0; i < levelCount(); i += 5) {
    const game = menuWith({ ...goodSnapshot(), levelIndex: i });
    tap(game, 'confirm');
    stepN(game, 2);
    assert.ok(game.scene instanceof PlayScene, `level ${i + 1}`);
    assert.equal(game.scene.levelIndex, i);
  }
});
