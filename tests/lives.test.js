import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { LivesManager } from '../src/game/lives.js';
import { Run } from '../src/game/run.js';
import { LIVES } from '../src/game/constants.js';

test('starting lives follow difficulty: easy 5, normal 3, hard 3', () => {
  assert.equal(new LivesManager({ difficulty: 'easy' }).lives, 5);
  assert.equal(new LivesManager({ difficulty: 'normal' }).lives, 3);
  assert.equal(new LivesManager({ difficulty: 'hard' }).lives, 3);
});

test('lives never exceed 6; a life earned at the cap pays 5000 bonus instead', () => {
  const l = new LivesManager();
  assert.deepEqual(l.addLife(), { gained: true, capped: false, bonus: 0 });
  assert.deepEqual(l.addLife(), { gained: true, capped: false, bonus: 0 });
  assert.deepEqual(l.addLife(), { gained: true, capped: false, bonus: 0 });
  assert.equal(l.lives, 6);
  const r = l.addLife();
  assert.equal(r.gained, false);
  assert.equal(r.capped, true);
  assert.equal(r.bonus, LIVES.CAP_BONUS);
  assert.equal(l.lives, 6);
});

test('losing lives floors at zero and flags empty', () => {
  const l = new LivesManager();
  assert.equal(l.loseLife(), 2);
  assert.equal(l.loseLife(), 1);
  assert.equal(l.empty, false);
  assert.equal(l.loseLife(), 0);
  assert.equal(l.empty, true);
  assert.equal(l.loseLife(), 0);
});

test('every 10th medal is worth a life', () => {
  const l = new LivesManager();
  for (let i = 0; i < 9; i++) assert.equal(l.addMedal(), null);
  assert.equal(l.medalProgress, 9);
  const r = l.addMedal();
  assert.equal(r.gained, true);
  assert.equal(l.lives, 4);
  assert.equal(l.medalProgress, 0);
  // at the cap the 10th medal pays the bonus instead
  while (l.lives < 6) l.addLife();
  for (let i = 0; i < 9; i++) l.addMedal();
  const cap = l.addMedal();
  assert.equal(cap.capped, true);
  assert.equal(l.lives, 6);
});

test('continues: three per run, each restores the starting lives', () => {
  const run = new Run();
  run.lives.loseLife();
  run.lives.loseLife();
  run.lives.loseLife();
  assert.equal(run.lives.empty, true);
  assert.equal(run.useContinue(), true);
  assert.equal(run.lives.lives, 3);
  assert.equal(run.continuesLeft, 2);
  assert.equal(run.useContinue(), true);
  assert.equal(run.useContinue(), true);
  assert.equal(run.continuesLeft, 0);
  assert.equal(run.useContinue(), false);
  assert.equal(run.continuesUsed, 3);
});

test('a continue on easy restores 5 lives', () => {
  const run = new Run({ difficulty: 'easy' });
  while (!run.lives.empty) run.lives.loseLife();
  run.useContinue();
  assert.equal(run.lives.lives, 5);
});
