// Unit tests for lives.js and the Run continues: starting lives per difficulty, the cap and its bonus, medals, losing lives.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { LivesManager } from '../../src/game/lives.js';
import { Run } from '../../src/game/run.js';
import { LIVES } from '../../src/game/constants.js';

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

// ---------------------------------------------------------------------------------------------------------------
// Edge cases: unknown difficulty, medal progress, reset, counters
// ---------------------------------------------------------------------------------------------------------------
test('an unknown or missing difficulty starts with the normal number of lives', () => {
  assert.equal(new LivesManager({ difficulty: 'nightmare' }).lives, LIVES.START.normal);
  assert.equal(new LivesManager({ difficulty: undefined }).lives, LIVES.START.normal);
  assert.equal(new LivesManager({ difficulty: '' }).lives, LIVES.START.normal);
  assert.equal(new LivesManager({ difficulty: 'EASY' }).lives, LIVES.START.normal, 'ids are case sensitive');
  assert.equal(new LivesManager().lives, LIVES.START.normal);
});

test('a run on an unknown difficulty still gets a working lives manager and a continue restores the normal count', () => {
  const run = new Run({ difficulty: 'nightmare' });
  assert.equal(run.lives.lives, 3);
  run.lives.loseLife();
  run.useContinue();
  assert.equal(run.lives.lives, 3);
});

test('medalProgress counts 0-9 towards the next life and wraps after the 10th medal', () => {
  const l = new LivesManager();
  assert.equal(l.medalProgress, 0);
  const seen = [];
  for (let i = 0; i < 25; i++) {
    l.addMedal();
    seen.push(l.medalProgress);
  }
  assert.deepEqual(seen.slice(0, 11), [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1]);
  assert.equal(seen.at(-1), 5, '25 medals = two lives and 5 towards the next');
  assert.equal(l.lives, 5);
});

test('medalProgress follows the medal counter even when it was set directly (a resumed run)', () => {
  const l = new LivesManager();
  l.medals = 23;
  assert.equal(l.medalProgress, 3);
  l.medals = 10;
  assert.equal(l.medalProgress, 0);
});

test('the 10th medal only returns a result when it earns a life, earlier ones return null', () => {
  const l = new LivesManager();
  const results = [];
  for (let i = 0; i < 20; i++) results.push(l.addMedal());
  assert.equal(results.filter(Boolean).length, 2);
  assert.ok(results[9] && results[19]);
  assert.equal(results[0], null);
});

test('reset restores the starting lives and medal count, but not the all-time lives-gained counter', () => {
  const l = new LivesManager({ difficulty: 'easy' });
  l.addLife();
  l.addMedal();
  l.loseLife();
  l.reset();
  assert.equal(l.lives, 5);
  assert.equal(l.medals, 0);
  assert.equal(l.livesGained, 1);
});

test('livesGained counts real lives only, not capped ones', () => {
  const l = new LivesManager();
  for (let i = 0; i < 10; i++) l.addLife();
  assert.equal(l.lives, LIVES.MAX);
  assert.equal(l.livesGained, 3);
});

test('addLife at five lives reaches the cap exactly and the next one is the bonus', () => {
  const l = new LivesManager();
  l.lives = LIVES.MAX - 1;
  assert.equal(l.addLife().gained, true);
  assert.equal(l.lives, LIVES.MAX);
  assert.equal(l.addLife().bonus, LIVES.CAP_BONUS);
});

test('empty is true at zero and stays false while any life is left', () => {
  const l = new LivesManager();
  l.lives = 1;
  assert.equal(l.empty, false);
  l.lives = 0;
  assert.equal(l.empty, true);
});

test('useContinue also resets the medal counter and the loadout, and gives nothing back once out of continues', () => {
  const run = new Run();
  run.lives.medals = 7;
  run.loadout = { slots: ['rifle', 'flame'], slot: 1, bombs: 3 };
  run.useContinue();
  assert.equal(run.lives.medals, 0);
  assert.deepEqual(run.loadout, { slots: ['rifle', null], slot: 0, bombs: 1 });
  run.useContinue();
  run.useContinue();
  run.lives.lives = 1;
  assert.equal(run.useContinue(), false);
  assert.equal(run.lives.lives, 1, 'a refused continue changes nothing');
  assert.equal(run.continuesUsed, LIVES.CONTINUES);
});
