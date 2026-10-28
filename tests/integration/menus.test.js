// Menu and screen flow through the real Game and scene routes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stepN, tap } from '../support/fixtures.js';
import { registerRoutes } from '../../src/scenes/routes.js';
import { TitleScene } from '../../src/scenes/title.js';
import { MenuScene } from '../../src/scenes/menu.js';
import { PlayScene } from '../../src/scenes/play.js';
import { OptionsScene } from '../../src/scenes/options.js';
import { ControlsScene } from '../../src/scenes/controls.js';
import { HighScoresScene } from '../../src/scenes/scores.js';
import { LevelSelectScene } from '../../src/scenes/levelselect.js';
import { NameEntryScene } from '../../src/scenes/nameentry.js';
import { ResultsScene, formatTime } from '../../src/scenes/results.js';
import { Run } from '../../src/game/run.js';
import { TILE } from '../../src/game/constants.js';

function boot() {
  const { game, canvas } = makeGame();
  registerRoutes(game);
  game.go('title');
  stepN(game, 2);
  return { game, canvas };
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
  tap(game, 'confirm'); // first entry: level 1
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

// ---------------------------------------------------------------------------------------------------------------
// Routes between the menu, the level select and the results screen
// ---------------------------------------------------------------------------------------------------------------

test('menu -> title: the back button returns to the title screen', () => {
  const { game } = boot();
  game.go('menu');
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene);
  tap(game, 'back');
  stepN(game, 2);
  assert.ok(game.scene instanceof TitleScene);
});

test('menu -> level select: the LEVEL SELECT item opens the practice list with the first level on the cursor', () => {
  const { game } = boot();
  game.go('menu');
  stepN(game, 2);
  selectItem(game, 'LEVEL SELECT');
  assert.ok(game.scene instanceof LevelSelectScene);
  assert.equal(game.scene.menu.index, 0);
  game.render();
});

test('level select: locked levels show ??? and the cursor steps over them to BACK', () => {
  const { game } = boot();
  game.save.unlock(1); // levels 1 and 2 are open
  game.go('levelselect');
  stepN(game, 2);
  const m = game.scene.menu;
  const last = m.items.length - 1;
  assert.ok(m.enabled(0) && m.enabled(1) && !m.enabled(2), 'only the first two levels are open');
  assert.match(m.label(2), /^03 \?\?\?$/);
  tap(game, 'down');
  assert.equal(m.index, 1);
  tap(game, 'down');
  assert.equal(m.index, last, 'level 3 and beyond are skipped');
  assert.equal(m.label(last), 'BACK');
});

test('level select -> menu: the BACK item and the back button both return to the main menu', () => {
  const { game } = boot();
  game.go('levelselect');
  stepN(game, 2);
  const last = game.scene.menu.items.length - 1;
  assert.equal(game.scene.menu.items[last].label, 'BACK');
  tap(game, 'up'); // wraps from the first entry to BACK (every other level is locked)
  assert.equal(game.scene.menu.index, last);
  tap(game, 'confirm');
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene, 'BACK item');

  game.go('levelselect');
  stepN(game, 2);
  tap(game, 'back');
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene, 'back button');
});

test('results in practice mode go back to level select, bank no unlock and leave the mid-run save alone', () => {
  const { game } = boot();
  game.go('levelselect');
  stepN(game, 2);
  tap(game, 'confirm'); // practice level 1
  stepN(game, 2);
  const play = game.scene;
  assert.equal(play.run.practice, true);
  assert.equal(game.save.resume, null);
  game.go('results', { run: play.run, levelIndex: 0, world: play.world });
  stepN(game, 60 * 6); // let the rows count up
  assert.ok(game.scene instanceof ResultsScene);
  tap(game, 'confirm');
  stepN(game, 2);
  assert.ok(game.scene instanceof LevelSelectScene);
  assert.equal(game.save.unlocked, 0, 'practice never unlocks the next level');
  assert.equal(game.save.resume, null, 'and never writes a mid-run save');
  assert.equal(game.save.scores.length, 0);
});

test('results of a real run move on to the next level and unlock it (the counterpart of the practice route)', () => {
  const { game } = boot();
  const run = new Run();
  run.levelIndex = 0;
  game.go('results', { run, levelIndex: 0 });
  stepN(game, 60 * 6);
  tap(game, 'confirm');
  stepN(game, 2);
  assert.ok(game.scene instanceof PlayScene);
  assert.equal(game.scene.levelIndex, 1);
  assert.equal(game.save.unlocked, 1);
});

// ---------------------------------------------------------------------------------------------------------------
// Screen contents that only show after some input: saved scores, revealed result rows, name entry edges
// ---------------------------------------------------------------------------------------------------------------

/** Renders the current scene and returns a copy of the pixels in the given band of rows. */
function bandOf(game, canvas, y0, y1) {
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  game.render();
  return canvas.data.slice(y0 * canvas.width * 4, y1 * canvas.width * 4);
}

const brightPixels = (band) => {
  let n = 0;
  for (let i = 0; i < band.length; i += 4) if (band[i] > 200 && band[i + 1] > 200) n++;
  return n;
};

test('the high score table draws each saved entry (name, score, level) and "---" for empty rows', () => {
  const { game, canvas } = boot();
  game.go('scores');
  stepN(game, 2);
  const empty = bandOf(game, canvas, 52, 70);
  game.save.addScore('ABC', 123456, 3);
  game.go('scores');
  stepN(game, 2);
  const filled = bandOf(game, canvas, 52, 70);
  assert.notDeepEqual(Buffer.from(filled), Buffer.from(empty), 'the first row changes once a score is saved');
  assert.ok(brightPixels(filled) > 40, 'name, score and level name are drawn in a readable colour');
});

test('the results screen shows each bonus row as it is counted and the total with PRESS FIRE at the end', () => {
  const { game, canvas } = boot();
  const run = new Run();
  game.go('play', { run, levelIndex: -1, god: true });
  stepN(game, 2);
  const w = game.scene.world;
  w.player.x = w.level.exitX + 4;
  w.player.y = 14 * TILE;
  stepN(game, 130);
  assert.ok(game.scene instanceof ResultsScene);
  const rowsBand = () => brightPixels(bandOf(game, canvas, 80, 190));
  const early = rowsBand();
  stepN(game, 240);
  const late = rowsBand();
  assert.ok(late > early + 20, `rows appear as they reveal (${early} -> ${late} bright pixels)`);
  const totalBand = () => brightPixels(bandOf(game, canvas, 200, 222));
  assert.ok(totalBand() > 40, 'TOTAL BONUS is on screen after the reveal');
});

test('name entry: left and right stop at the ends, confirm steps right before accepting, back steps left but not past the first letter', () => {
  const { game } = boot();
  const run = new Run();
  run.score.add(500);
  game.go('nameentry', { run });
  stepN(game, 30);
  const scene = game.scene;
  tap(game, 'left');
  assert.equal(scene.pos, 0, 'left of the first letter stays put');
  tap(game, 'back');
  assert.equal(scene.pos, 0, 'back on the first letter does nothing');
  tap(game, 'right');
  tap(game, 'right');
  tap(game, 'right');
  assert.equal(scene.pos, 2, 'right of the last letter stays put');
  tap(game, 'left');
  assert.equal(scene.pos, 1);
  tap(game, 'back');
  assert.equal(scene.pos, 0, 'back steps left');
  tap(game, 'confirm');
  assert.equal(scene.pos, 1, 'confirm moves on to the next letter');
  assert.equal(game.save.scores.length, 0, 'nothing is saved until the last letter is confirmed');
  tap(game, 'confirm');
  tap(game, 'confirm');
  stepN(game, 2);
  assert.equal(game.save.scores.length, 1);
  assert.ok(game.scene instanceof HighScoresScene);
});
