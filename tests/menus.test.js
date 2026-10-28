// Menu and screen flow through the real Game and scene routes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stepN } from '../tools/shots.mjs';
import { registerRoutes } from '../src/scenes/routes.js';
import { TitleScene } from '../src/scenes/title.js';
import { MenuScene } from '../src/scenes/menu.js';
import { PlayScene } from '../src/scenes/play.js';
import { OptionsScene } from '../src/scenes/options.js';
import { ControlsScene } from '../src/scenes/controls.js';
import { HighScoresScene } from '../src/scenes/scores.js';
import { LevelSelectScene } from '../src/scenes/levelselect.js';
import { NameEntryScene } from '../src/scenes/nameentry.js';
import { ResultsScene, formatTime } from '../src/scenes/results.js';
import { Run } from '../src/game/run.js';
import { TILE } from '../src/game/constants.js';

function boot() {
  const { game, canvas } = makeGame();
  registerRoutes(game);
  game.go('title');
  stepN(game, 2);
  return { game, canvas };
}

/** Press one action for a single frame, then release for a frame so the next press is an edge. */
function tap(game, key) {
  stepN(game, 1, [key]);
  stepN(game, 1, []);
}

function menuIndex(game, label) {
  return game.scene.menu.items.findIndex((it) => (typeof it.label === 'function' ? it.label() : it.label) === label);
}

function selectItem(game, label) {
  const target = menuIndex(game, label);
  assert.ok(target >= 0, `menu has ${label}`);
  while (game.scene.menu.index !== target) tap(game, 'down');
  tap(game, 'confirm');
  stepN(game, 2);
}

test('title -> main menu on confirm', () => {
  const { game } = boot();
  assert.ok(game.scene instanceof TitleScene);
  stepN(game, 20);
  tap(game, 'confirm');
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene);
});

test('menu navigation wraps and skips the disabled Continue', () => {
  const { game } = boot();
  game.go('menu');
  stepN(game, 2);
  const m = game.scene.menu;
  assert.equal(m.index, 0);
  tap(game, 'down');
  assert.equal(m.items[m.index].label, 'LEVEL SELECT', 'Continue is skipped without a save');
  tap(game, 'up');
  tap(game, 'up');
  assert.equal(m.items[m.index].label, 'CREDITS', 'wraps to the bottom');
});

test('Start begins a new run with the difficulty from the options', () => {
  const { game } = boot();
  game.save.setOption('difficulty', 'easy');
  game.go('menu');
  stepN(game, 2);
  selectItem(game, 'START');
  assert.ok(game.scene instanceof PlayScene);
  assert.equal(game.scene.run.difficulty, 'easy');
  assert.equal(game.scene.run.lives.lives, 5);
  assert.ok(game.save.resume, 'the level start was saved');
});

test('Continue resumes the saved run', () => {
  const { game } = boot();
  const run = new Run();
  run.score.add(21000);
  run.lives.lives = 4;
  run.levelIndex = -1;
  game.save.saveResume(run);
  game.go('menu');
  stepN(game, 2);
  assert.equal(game.scene.menu.index, 1, 'Continue is pre-selected when a save exists');
  tap(game, 'confirm');
  stepN(game, 2);
  assert.ok(game.scene instanceof PlayScene);
  assert.equal(game.scene.run.score.points, 21000);
  assert.equal(game.scene.run.lives.lives, 4);
});

test('options change and persist settings', () => {
  const { game } = boot();
  game.go('menu');
  stepN(game, 2);
  selectItem(game, 'OPTIONS');
  assert.ok(game.scene instanceof OptionsScene);
  tap(game, 'left'); // SFX volume down
  assert.equal(game.save.options.sfx, 0.7);
  tap(game, 'down');
  tap(game, 'right'); // music up
  assert.equal(game.save.options.music, 0.7);
  tap(game, 'down');
  tap(game, 'right');
  assert.equal(game.save.options.difficulty, 'hard');
  tap(game, 'down');
  tap(game, 'confirm');
  assert.equal(game.save.options.shake, false);
  // volume bounds
  for (let i = 0; i < 20; i++) {
    tap(game, 'up');
    tap(game, 'up');
    tap(game, 'up');
  }
  assert.ok(game.save.options.sfx >= 0 && game.save.options.sfx <= 1);
  tap(game, 'back');
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene);
});

test('controls and high score screens open and close', () => {
  const { game } = boot();
  game.go('menu');
  stepN(game, 2);
  selectItem(game, 'CONTROLS');
  assert.ok(game.scene instanceof ControlsScene);
  game.render();
  tap(game, 'back');
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene);
  selectItem(game, 'HIGH SCORES');
  assert.ok(game.scene instanceof HighScoresScene);
  game.render();
  stepN(game, 30);
  tap(game, 'back');
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene);
});

test('level select starts a practice run that never touches the mid-run save', () => {
  const { game } = boot();
  game.go('levelselect');
  stepN(game, 2);
  assert.ok(game.scene instanceof LevelSelectScene);
  game.render();
  tap(game, 'confirm'); // first entry: the testbed while no real levels exist
  stepN(game, 2);
  assert.ok(game.scene instanceof PlayScene);
  assert.equal(game.scene.run.practice, true);
  assert.equal(game.save.resume, null);
});

test('pause menu: resume, restart level, quit', () => {
  const { game } = boot();
  const run = new Run();
  game.go('play', { run, levelIndex: -1, god: true });
  stepN(game, 2);
  const w = game.scene.world;
  const t0 = w.tick;
  tap(game, 'pause');
  assert.equal(game.scene.paused, true);
  stepN(game, 20);
  assert.equal(w.tick, t0, 'the world is frozen while paused');
  game.render();
  // resume via the menu
  tap(game, 'confirm');
  assert.equal(game.scene.paused, false);
  // earn some score, then restart: score returns to the level-start value
  run.score.add(500);
  tap(game, 'pause');
  tap(game, 'down');
  tap(game, 'confirm');
  stepN(game, 2);
  assert.ok(game.scene instanceof PlayScene);
  assert.notEqual(game.scene.world, w, 'a fresh world');
  assert.equal(run.score.points, 0, 'restored to the level-start score');
  // quit to menu keeps the mid-run save
  tap(game, 'pause');
  tap(game, 'down');
  tap(game, 'down');
  tap(game, 'down');
  tap(game, 'confirm');
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene);
});

test('pause -> options -> back returns to the same paused level', () => {
  const { game } = boot();
  game.go('play', { run: new Run(), levelIndex: -1, god: true });
  stepN(game, 2);
  const play = game.scene;
  tap(game, 'pause');
  tap(game, 'down');
  tap(game, 'down');
  tap(game, 'confirm');
  stepN(game, 2);
  assert.ok(game.scene instanceof OptionsScene);
  tap(game, 'back');
  stepN(game, 2);
  assert.equal(game.scene, play);
  assert.equal(play.paused, true);
});

test('clearing a level shows the results with the bonuses, then moves on', () => {
  const { game } = boot();
  const run = new Run();
  game.go('play', { run, levelIndex: -1, god: true });
  stepN(game, 2);
  const w = game.scene.world;
  w.player.x = w.level.exitX + 4;
  w.player.y = 14 * TILE;
  stepN(game, 4);
  assert.equal(w.cleared, true);
  stepN(game, 120);
  assert.ok(game.scene instanceof ResultsScene);
  assert.equal(game.scene.bonus.total, 3 * 2000 + 5000);
  game.render();
  stepN(game, 240); // let the rows count up
  tap(game, 'confirm');
  stepN(game, 2);
  assert.equal(run.score.points, 11000, 'the bonus is banked when moving on');
});

test('name entry: choose initials and land on the high score table', () => {
  const { game } = boot();
  const run = new Run();
  run.score.add(3000);
  game.go('nameentry', { run });
  stepN(game, 30);
  assert.ok(game.scene instanceof NameEntryScene);
  tap(game, 'up'); // A -> B
  tap(game, 'right');
  tap(game, 'up');
  tap(game, 'up'); // C
  tap(game, 'right');
  tap(game, 'down'); // A -> 9
  game.render();
  tap(game, 'confirm');
  stepN(game, 2);
  assert.ok(game.scene instanceof HighScoresScene);
  assert.equal(game.save.scores[0].name, 'BC9');
  assert.equal(game.save.scores[0].score, 3000);
});

test('time formatting', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(75.4), '1:15');
  assert.equal(formatTime(600), '10:00');
});
