// Scene-flow tests: death -> respawn -> checkpoint -> game over -> continue, driven through Game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeGame, stepN } from '../../tools/shots.mjs';
import { registerRoutes } from '../../src/scenes/routes.js';
import { PlayScene, RESPAWN_DELAY, GAMEOVER_DELAY, HIT_STOP } from '../../src/scenes/play.js';
import { GameOverScene, CONTINUE_SECONDS } from '../../src/scenes/gameover.js';
import { MenuScene } from '../../src/scenes/menu.js';
import { NameEntryScene } from '../../src/scenes/nameentry.js';
import { Run } from '../../src/game/run.js';
import { TILE, PLAYER } from '../../src/game/constants.js';

const FPS = 60;
// a death also holds the whole game still for HIT_STOP.death frames, so every wait gets that much slack
const frames = (s) => Math.ceil(s * FPS) + 2 + HIT_STOP.death;

function start(opts = {}) {
  const { game, canvas } = makeGame();
  registerRoutes(game);
  const run = opts.run || new Run();
  game.go('play', { run, levelIndex: -1, god: true, ...opts.params });
  stepN(game, 1);
  return { game, canvas, run, world: () => game.scene.world };
}

test('dying costs a life and respawns the player with invulnerability and the base rifle', () => {
  const { game, run, world } = start();
  const w = world();
  w.player.weapon = 'spread';
  w.killPlayer('test');
  stepN(game, 2);
  assert.equal(run.lives.lives, 2);
  assert.equal(run.deathsThisLevel, 1);
  assert.equal(w.player.alive, false);
  stepN(game, frames(RESPAWN_DELAY));
  assert.equal(w.player.alive, true);
  assert.ok(w.player.invuln > 1, 'respawn invulnerability');
  assert.equal(w.player.weapon, 'rifle');
});

test('respawn clears enemy bullets and stays inside the camera', () => {
  const { game, world } = start();
  const w = world();
  w.spawnEnemyBullet({ x: w.player.x + 30, y: w.player.y - 10, vx: 0, vy: 0, life: 20 });
  w.killPlayer('test');
  stepN(game, frames(RESPAWN_DELAY));
  assert.equal(w.ebullets.length, 0);
  assert.ok(w.player.x >= w.camera.x && w.player.x <= w.camera.x + 480);
});

test('invulnerable players cannot be hurt, then can after it wears off', () => {
  const { game, world } = start({ params: { god: false } });
  const w = world();
  w.enemies.length = 0;
  w.player.invuln = 1;
  assert.equal(w.hurtPlayer('enemy'), false);
  assert.equal(w.player.alive, true);
  stepN(game, frames(PLAYER.RESPAWN_INVULN));
  w.player.invuln = 0;
  assert.equal(w.hurtPlayer('enemy'), true);
  assert.equal(w.player.alive, false);
});

test('running out of lives leads to the Continue screen', () => {
  const { game, run, world } = start();
  for (let i = 0; i < 2; i++) {
    world().killPlayer('test');
    stepN(game, frames(RESPAWN_DELAY));
  }
  assert.equal(run.lives.lives, 1);
  world().killPlayer('test');
  stepN(game, frames(GAMEOVER_DELAY) + 2);
  assert.ok(game.scene instanceof GameOverScene);
  assert.equal(game.scene.canContinue, true);
  assert.equal(run.lives.empty, true);
});

test('Continue restores lives, costs one continue and restarts the level', () => {
  const { game, run } = start();
  run.lives.lives = 1;
  game.scene.world.killPlayer('test');
  stepN(game, frames(GAMEOVER_DELAY) + 2);
  assert.ok(game.scene instanceof GameOverScene);
  stepN(game, 20); // let the input guard time pass
  stepN(game, 1, ['jump']);
  stepN(game, 2);
  assert.ok(game.scene instanceof PlayScene);
  assert.equal(run.lives.lives, 3);
  assert.equal(run.continuesLeft, 2);
  assert.equal(game.scene.world.player.alive, true);
});

test('Continue resumes from the last checkpoint', () => {
  const { game, run, world } = start();
  const w = world();
  assert.equal(w.checkpoints.length, 2);
  w.player.x = 48 * TILE + 4;
  w.player.y = 14 * TILE;
  stepN(game, 2);
  assert.equal(w.checkpoints[0].hit, true);
  assert.equal(w.checkpoints[1].hit, false);
  assert.equal(run.checkpoint.x, 48 * TILE);
  run.lives.lives = 1;
  w.killPlayer('test');
  stepN(game, frames(GAMEOVER_DELAY) + 2);
  stepN(game, 20);
  stepN(game, 1, ['fire']);
  stepN(game, 2);
  const w2 = game.scene.world;
  assert.notEqual(w2, w);
  assert.ok(Math.abs(w2.player.x - 48 * TILE) < 4, `resumed at ${w2.player.x}`);
  assert.equal(w2.checkpoints[0].hit, true, 'already-reached checkpoint is not re-triggered');
});

test('a fresh level start ignores old checkpoints', () => {
  const run = new Run();
  run.checkpoint = { levelIndex: -1, x: 48 * TILE, y: 14 * TILE };
  const { game } = start({ run, params: { resume: false } });
  assert.ok(game.scene.world.player.x < 10 * TILE);
});

test('the Continue countdown running out ends the run (back to the menu)', () => {
  const { game, run } = start();
  run.lives.lives = 1;
  game.scene.world.killPlayer('test');
  stepN(game, frames(GAMEOVER_DELAY) + 2);
  const go = game.scene;
  assert.ok(go instanceof GameOverScene);
  stepN(game, frames(CONTINUE_SECONDS));
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene);
  assert.equal(game.save.resume, null, 'a finished run leaves no mid-run save');
});

test('a final game over with a qualifying score asks for initials', () => {
  const { game, run } = start();
  run.score.add(1234);
  run.continuesLeft = 0;
  run.lives.lives = 1;
  game.scene.world.killPlayer('test');
  stepN(game, frames(GAMEOVER_DELAY) + 2);
  stepN(game, 70);
  stepN(game, 1, ['jump']);
  stepN(game, 2);
  assert.ok(game.scene instanceof NameEntryScene);
});

test('no continues left: Game Over without the countdown', () => {
  const run = new Run();
  run.continuesLeft = 0;
  const { game } = start({ run });
  run.lives.lives = 1;
  game.scene.world.killPlayer('test');
  stepN(game, frames(GAMEOVER_DELAY) + 2);
  assert.ok(game.scene instanceof GameOverScene);
  assert.equal(game.scene.canContinue, false);
  stepN(game, 70); // the final screen ignores input for a second so a button-mash can't skip it
  stepN(game, 1, ['jump']);
  stepN(game, 2);
  assert.ok(game.scene instanceof MenuScene, 'confirm leaves the Game Over screen');
});

test('pause freezes the simulation', () => {
  const { game, world } = start();
  const t0 = world().tick;
  stepN(game, 1, ['pause']);
  stepN(game, 30);
  const frozen = world().tick;
  assert.ok(frozen - t0 <= 1);
  stepN(game, 1, ['pause']);
  stepN(game, 10);
  assert.ok(world().tick > frozen);
});

/** A hash of the whole frame, plus how many distinct colours it holds (a blank or one-colour frame has very few). */
function frameOf(game, canvas) {
  canvas.getContext('2d').clearRect(0, 0, 480, 270);
  game.render();
  const colours = new Set();
  for (let i = 0; i < canvas.data.length; i += 4) colours.add((canvas.data[i] << 16) | (canvas.data[i + 1] << 8) | canvas.data[i + 2]);
  return { hash: createHash('sha1').update(canvas.data).digest('hex'), colours: colours.size, opaque: canvas.data.filter((v, i) => i % 4 === 3 && v > 0).length };
}

test('every scene on the death path draws its own, non-blank picture (play, pause, continue, game over)', () => {
  const { game, canvas, run } = start();
  stepN(game, 200); // past the level card
  const shots = {};
  shots.play = frameOf(game, canvas);
  stepN(game, 1, ['pause']);
  stepN(game, 1);
  assert.equal(game.scene.paused, true);
  shots.pause = frameOf(game, canvas);
  stepN(game, 1, ['pause']);
  stepN(game, 1);
  run.lives.lives = 1;
  game.scene.world.killPlayer('test');
  stepN(game, frames(GAMEOVER_DELAY) + 2);
  assert.ok(game.scene instanceof GameOverScene);
  shots.continue = frameOf(game, canvas);
  run.continuesLeft = 0;
  game.go('gameover', { run, levelIndex: -1 });
  stepN(game, 2);
  shots.final = frameOf(game, canvas);

  assert.equal(canvas.width, 480);
  for (const [name, f] of Object.entries(shots)) {
    assert.equal(f.opaque, 480 * 270, `${name} covers the whole screen`);
    assert.ok(f.colours >= 3, `${name} is not blank (${f.colours} colours)`); // the Game Over screen is plain: background, text, outline
  }
  assert.ok(shots.play.colours >= 20, 'the level itself is rich');
  const hashes = Object.values(shots).map((f) => f.hash);
  assert.equal(new Set(hashes).size, hashes.length, 'every scene looks different from the others');
});
