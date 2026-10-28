// End-to-end journeys: whole stretches of the game driven through the real scenes (title, menu, play, results, ending,
// credits, name entry, scores, game over, level select) with scripted input, exactly as a player would see them. Only
// the player's skill is faked:
//   - `tools/bot.js` (the same level-crossing bot the level tests use) walks each level on foot, in god mode;
//   - a boss that has finished its entrance is finished off with one big hit through `damageEnemy` (the fight itself is
//     covered by the boss tests), so the campaign journey stays well under a few seconds.
// Everything else is the production path: scene routing, the Run, the save and the high-score table.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js'; // installs the software canvas
import { makeGame, stepN, tap } from '../support/fixtures.js';
import { registerRoutes } from '../../src/scenes/routes.js';
import { TitleScene } from '../../src/scenes/title.js';
import { MenuScene } from '../../src/scenes/menu.js';
import { PlayScene } from '../../src/scenes/play.js';
import { ResultsScene } from '../../src/scenes/results.js';
import { EndingScene, ENDING_BONUS } from '../../src/scenes/ending.js';
import { CreditsScene } from '../../src/scenes/credits.js';
import { NameEntryScene } from '../../src/scenes/nameentry.js';
import { HighScoresScene } from '../../src/scenes/scores.js';
import { GameOverScene } from '../../src/scenes/gameover.js';
import { LevelSelectScene } from '../../src/scenes/levelselect.js';
import { OptionsScene } from '../../src/scenes/options.js';
import { SaveData } from '../../src/game/save.js';
import { Run } from '../../src/game/run.js';
import { levelCount } from '../../src/game/levels.js';
import { LIVES } from '../../src/game/constants.js';
import { damageEnemy } from '../../src/game/enemies.js';
import { bossInvulnerable } from '../../src/game/boss.js';
import { Bot } from '../../tools/bot.js';

const FPS = 60;

/**
 * A game with every route registered, parked on the title scene. With `god` every play scene it creates is in god
 * mode (so the bot can cross a level without dying); scenes still pick the run, level and score exactly as in the game.
 */
function boot({ god = false } = {}) {
  const { game } = makeGame();
  registerRoutes(game);
  if (god) {
    const play = game.routes.play;
    game.routes.play = (params) => play({ ...params, god: true });
  }
  game.go('title');
  stepN(game, 30);
  return game;
}

/** Step with `keys` held until `done()` is true; fails (with `what`) if it takes more than `maxSeconds` of game time. */
function waitFor(game, done, what, { keys = [], maxSeconds = 30 } = {}) {
  const max = maxSeconds * FPS;
  for (let i = 0; i < max && !done(); i++) stepN(game, 1, keys);
  assert.ok(done(), `timed out waiting for ${what} (now in ${game.scene && game.scene.constructor.name})`);
}

/** Tap `key` until the cursor of the current menu scene sits on the item labelled `label`. */
function selectMenuItem(game, label) {
  const menu = game.scene.menu;
  const text = (i) => (typeof menu.items[i].label === 'function' ? menu.items[i].label() : menu.items[i].label);
  for (let i = 0; i < menu.items.length && text(menu.index) !== label; i++) tap(game, 'down');
  assert.equal(text(menu.index), label, `cursor is on ${label}`);
}

/**
 * Drive the current play scene until it hands over to another scene: the bot walks, and as soon as the boss has finished
 * its entrance it is knocked out with one hit. Returns how far (in pixels) the soldier got from the start.
 */
function crossLevel(game) {
  const scene = game.scene;
  assert.ok(scene instanceof PlayScene, `a play scene is up (found ${scene && scene.constructor.name})`);
  const bot = new Bot(scene.level);
  const startX = scene.world.player.x;
  let farthest = startX;
  const max = 600 * FPS;
  for (let i = 0; game.scene === scene && i < max; i++) {
    const w = scene.world;
    let keys = {};
    if (w.boss) {
      if (!bossInvulnerable(w.boss)) damageEnemy(w, w.boss, 1e6, null);
    } else if (!w.cleared) {
      keys = bot.act(w);
    }
    game.input.script = keys;
    game.step();
    farthest = Math.max(farthest, w.player.x);
  }
  assert.notEqual(game.scene, scene, `level ${scene.levelIndex + 1} ended`);
  return farthest - startX;
}

/** On the results screen: wait for the rows to count up, then press fire to move on. Returns the bonus that was banked. */
function dismissResults(game) {
  const results = game.scene;
  assert.ok(results instanceof ResultsScene, `results are up (found ${results && results.constructor.name})`);
  waitFor(game, () => results.shown > results.rows.length, 'the results to count up');
  const bonus = results.bonus.total;
  tap(game, 'fire');
  return bonus;
}

// ---------------------------------------------------------------------------------------------------------------
// The whole campaign
// ---------------------------------------------------------------------------------------------------------------
test('campaign: title, New Game, all 20 levels crossed, results, ending, credits, initials and the high-score table', () => {
  const game = boot({ god: true });
  const { save } = game;
  const levels = levelCount();
  assert.equal(levels, 20);
  assert.ok(game.scene instanceof TitleScene);
  assert.equal(save.unlocked, 0);
  assert.deepEqual(save.scores, []);

  // title -> menu -> START
  tap(game, 'confirm');
  assert.ok(game.scene instanceof MenuScene);
  assert.equal(game.scene.menu.items[game.scene.menu.index].label, 'START', 'a fresh save puts the cursor on START');
  tap(game, 'confirm');
  assert.ok(game.scene instanceof PlayScene);
  const run = game.scene.run;
  assert.equal(run.practice, false);
  assert.equal(game.scene.levelIndex, 0);

  for (let i = 0; i < levels; i++) {
    const scene = game.scene;
    assert.ok(scene instanceof PlayScene, `level ${i + 1} is playing`);
    assert.equal(scene.levelIndex, i);
    // the mid-run save is refreshed at the start of every level of a real run
    assert.equal(save.resume.levelIndex, i, `the mid-run save points at level ${i + 1}`);
    assert.equal(save.resume.score, run.score.points);

    const walked = crossLevel(game);
    assert.ok(walked > 100, `level ${i + 1}: the soldier crossed ${Math.round(walked)} px on foot`);
    assert.ok(scene.world.cleared, `level ${i + 1} was cleared`);
    assert.equal(run.totalDeaths, 0, 'god mode: no deaths');

    const before = run.score.points;
    const bonus = dismissResults(game);
    // the bonus is banked exactly once; if it pushes the score over a bonus-life milestone while the lives are already
    // at the cap, the game pays LIVES.CAP_BONUS points in place of the extra life, so allow whole multiples of that
    const gained = run.score.points - before - bonus;
    assert.ok(gained >= 0 && gained % LIVES.CAP_BONUS === 0, `level ${i + 1}: the clear bonus (${bonus}) is banked once (score rose by ${run.score.points - before})`);
    assert.equal(save.unlocked, i + 1, `level ${i + 1} unlocks the next`);
    if (i + 1 < levels) assert.equal(game.scene.levelIndex, i + 1, 'results lead straight into the next level');
  }

  // the ending: four story pages, then the final tally
  assert.ok(game.scene instanceof EndingScene);
  const ending = game.scene;
  assert.equal(save.cleared, 1, 'finishing the game is counted');
  const preBonus = run.score.points;
  for (let i = 0; i < 40 && ending.stage === 'story'; i++) tap(game, 'fire');
  assert.equal(ending.stage, 'tally');
  const clearBonus = ENDING_BONUS.CLEAR + ENDING_BONUS.NO_CONTINUE + ENDING_BONUS.NO_DEATH;
  const paid = run.score.points - preBonus - clearBonus;
  assert.ok(paid >= 0 && paid % LIVES.CAP_BONUS === 0, 'a clean run earns all three game-clear bonuses (plus cap payouts, if any)');
  waitFor(game, () => ending.shown > ending.rows.length, 'the tally to count up');
  assert.equal(ending.rank, 'S', 'no deaths, no continues');
  assert.deepEqual(ending.rows.find((r) => r[0] === 'DEATHS'), ['DEATHS', '0']);
  assert.deepEqual(ending.rows.find((r) => r[0] === 'CONTINUES USED'), ['CONTINUES USED', '0']);
  tap(game, 'fire');

  // the credits roll (holding fire speeds them up), then a tap leaves
  assert.ok(game.scene instanceof CreditsScene);
  assert.equal(game.scene.run, run, 'the credits carry the finished run to the initials');
  waitFor(game, () => game.scene.finished, 'the credits to finish', { keys: ['fire'] });
  tap(game, 'confirm');
  assert.ok(game.scene instanceof NameEntryScene, 'a score on an empty table qualifies for initials');
  assert.equal(save.resume, null, 'the finished run left no mid-run save');

  // initials: H R D
  stepN(game, 30);
  for (let i = 0; i < 7; i++) tap(game, 'up');
  tap(game, 'confirm');
  for (let i = 0; i < 17; i++) tap(game, 'up');
  tap(game, 'confirm');
  for (let i = 0; i < 3; i++) tap(game, 'up');
  assert.equal(game.scene.name, 'HRD');
  tap(game, 'confirm');
  assert.ok(game.scene instanceof HighScoresScene);
  assert.equal(game.scene.highlight, 0, 'the new entry is on top and flashes');

  // the table, and the save as a second page load would read it back
  const reloaded = new SaveData(save.storage);
  assert.equal(reloaded.unlocked, levels);
  assert.equal(reloaded.cleared, 1);
  assert.equal(reloaded.resume, null);
  assert.equal(reloaded.scores.length, 1);
  assert.equal(reloaded.scores[0].name, 'HRD');
  assert.equal(reloaded.scores[0].score, run.score.points);
  assert.equal(reloaded.scores[0].level, levels, 'the entry records the level reached');
  assert.ok(run.score.points > clearBonus, 'the score includes the kills and level bonuses, not only the game-clear bonuses');

  // any button leaves the table for the menu, where Continue is gone and the clear count shows
  stepN(game, 30);
  tap(game, 'fire');
  assert.ok(game.scene instanceof MenuScene);
  const cont = game.scene.menu.items.find((it) => typeof it.label === 'function');
  assert.equal(cont.enabled(), false, 'CONTINUE is disabled after a finished run');
});

// ---------------------------------------------------------------------------------------------------------------
// Game over on Hard
// ---------------------------------------------------------------------------------------------------------------
test('game over on Hard: lose every life, spend every continue, then the run ends in initials and the score table', () => {
  const game = boot();
  const { save } = game;

  // Options (reached through the menu) -> DIFFICULTY -> HARD, then back
  tap(game, 'confirm'); // title -> menu
  selectMenuItem(game, 'OPTIONS');
  tap(game, 'confirm');
  assert.ok(game.scene instanceof OptionsScene);
  tap(game, 'down');
  tap(game, 'down');
  tap(game, 'right'); // normal -> hard
  assert.equal(save.options.difficulty, 'hard');
  tap(game, 'back');
  assert.ok(game.scene instanceof MenuScene);
  tap(game, 'confirm'); // START
  assert.ok(game.scene instanceof PlayScene);
  const run = game.scene.run;
  assert.equal(run.difficulty, 'hard');
  assert.equal(run.lives.lives, LIVES.START.hard);
  assert.equal(run.continuesLeft, LIVES.CONTINUES);
  assert.ok(save.resume, 'a real run writes the mid-run save at the start of the level');

  const startLives = LIVES.START.hard;
  for (let round = 0; round <= LIVES.CONTINUES; round++) {
    const lastRound = round === LIVES.CONTINUES;
    assert.ok(game.scene instanceof PlayScene, `round ${round}: playing`);
    run.score.add(1000); // something to lose with the continue, or to enter on the table at the very end
    // die until the lives are gone and the Continue screen takes over
    for (let i = 0; i < 120 * FPS && !(game.scene instanceof GameOverScene); i++) {
      const w = game.scene.world;
      if (w.player.alive) w.killPlayer('journey');
      stepN(game, 1);
    }
    assert.ok(game.scene instanceof GameOverScene, `round ${round}: the last life ends in the Game Over scene`);
    assert.equal(run.lives.lives, 0);
    assert.equal(game.scene.canContinue, !lastRound, `round ${round}: continues are offered until they run out`);
    stepN(game, 70); // the scene ignores input for the first moment
    if (!lastRound) {
      tap(game, 'jump'); // CONTINUE
      assert.ok(game.scene instanceof PlayScene, `round ${round}: continue goes back to the level`);
      assert.equal(run.lives.lives, startLives, 'fresh lives');
      assert.equal(run.score.points, 0, 'a continue starts the score over');
      assert.equal(run.continuesLeft, LIVES.CONTINUES - round - 1);
    }
  }
  assert.equal(run.continuesUsed, LIVES.CONTINUES);
  assert.equal(run.totalDeaths, startLives * (LIVES.CONTINUES + 1), 'every life of every continue was lost');
  assert.equal(run.score.points, 1000);
  assert.ok(save.resume, 'the mid-run save is still there until the run is over');

  // no continues left: the plain GAME OVER, then the run ends in the initials screen
  tap(game, 'jump');
  assert.ok(game.scene instanceof NameEntryScene, 'a score of 1,000 on an empty table qualifies');
  assert.equal(save.resume, null, 'a finished run clears the mid-run save');
  stepN(game, 30);
  for (let i = 0; i < 7; i++) tap(game, 'up');
  tap(game, 'confirm');
  tap(game, 'confirm');
  tap(game, 'confirm');
  assert.ok(game.scene instanceof HighScoresScene);
  assert.equal(game.scene.highlight, 0);
  assert.deepEqual(
    save.scores.map(({ name, score, level }) => ({ name, score, level })),
    [{ name: 'HAA', score: 1000, level: 1 }],
  );
  assert.equal(new SaveData(save.storage).options.difficulty, 'hard', 'the difficulty choice persisted');
  assert.equal(save.unlocked, 0, 'no level was cleared');
});

// ---------------------------------------------------------------------------------------------------------------
// Practice mode
// ---------------------------------------------------------------------------------------------------------------
test('practice: level select, play, results and back to level select, without touching the mid-run save, unlocks or scores', () => {
  const game = boot({ god: true });
  const { save } = game;

  // a player part-way through a real run, with two levels' worth of unlocks and one score on the table
  const other = new Run({ difficulty: 'normal', levelIndex: 4 });
  other.score.add(12345);
  save.saveResume(other);
  save.unlock(2);
  save.addScore('AAA', 500, 1);
  const resumeBefore = structuredClone(save.resume);
  const scoresBefore = structuredClone(save.scores);

  tap(game, 'confirm'); // title -> menu
  assert.ok(game.scene instanceof MenuScene);
  assert.equal(game.scene.menu.index, 1, 'with a mid-run save the cursor starts on CONTINUE');
  selectMenuItem(game, 'LEVEL SELECT');
  tap(game, 'confirm');
  assert.ok(game.scene instanceof LevelSelectScene);

  // locked levels are skipped by the cursor: 3 downs from level 1 pass levels 2 and 3 and land on BACK
  const menu = game.scene.menu;
  for (let i = 0; i < 3; i++) tap(game, 'down');
  assert.equal(menu.items[menu.index].label, 'BACK');
  tap(game, 'down');
  assert.equal(menu.index, 0, 'and the cursor wraps to level 1');

  tap(game, 'confirm'); // practise level 1
  assert.ok(game.scene instanceof PlayScene);
  const run = game.scene.run;
  assert.equal(run.practice, true);
  assert.equal(game.scene.levelIndex, 0);
  assert.deepEqual(save.resume, resumeBefore, 'starting a practice level does not overwrite the mid-run save');

  run.score.add(9000); // more than the best score on the table: still must not be offered the initials
  assert.ok(run.score.points > save.best);
  crossLevel(game);
  dismissResults(game);

  assert.ok(game.scene instanceof LevelSelectScene, 'practice results lead back to level select, not to the next level');
  assert.deepEqual(save.resume, resumeBefore, 'the mid-run save is untouched');
  assert.equal(save.unlocked, 2, 'practice unlocks nothing');
  assert.deepEqual(save.scores, scoresBefore, 'practice never scores');
  assert.deepEqual(new SaveData(save.storage).resume, resumeBefore, 'and nothing was written to storage either');

  // BACK returns to the main menu, where the real run can still be continued
  stepN(game, 10);
  tap(game, 'back');
  assert.ok(game.scene instanceof MenuScene);
  assert.equal(game.scene.menu.items[1].enabled(), true, 'CONTINUE is still available');
});
