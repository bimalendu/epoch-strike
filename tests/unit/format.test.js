// Unit tests for the small pure helpers that scenes use to present a run: results.formatTime (m:ss clock) and the
// ending's endingRank / endingBonus (rank letter and game-clear bonuses). They take plain objects, so no scene is built.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime } from '../../src/scenes/results.js';
import { endingRank, endingBonus, ENDING_BONUS } from '../../src/scenes/ending.js';

const runWith = (totalDeaths, continuesUsed) => ({ totalDeaths, continuesUsed });

test('formatTime shows minutes and zero-padded seconds', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(5), '0:05');
  assert.equal(formatTime(59), '0:59');
  assert.equal(formatTime(60), '1:00');
  assert.equal(formatTime(75), '1:15');
  assert.equal(formatTime(600), '10:00');
});

test('formatTime rounds to the nearest second, so 59.5 s carries into the next minute', () => {
  assert.equal(formatTime(75.4), '1:15');
  assert.equal(formatTime(75.6), '1:16');
  assert.equal(formatTime(59.4), '0:59');
  assert.equal(formatTime(59.5), '1:00');
});

test('formatTime clamps negative times to 0:00', () => {
  assert.equal(formatTime(-1), '0:00');
  assert.equal(formatTime(-0.4), '0:00');
  assert.equal(formatTime(-3600), '0:00');
});

test('formatTime has no hours field: an hour or more keeps counting minutes', () => {
  assert.equal(formatTime(3599), '59:59');
  assert.equal(formatTime(3600), '60:00');
  assert.equal(formatTime(3661), '61:01');
  assert.equal(formatTime(7200), '120:00');
});

test('endingRank S needs zero deaths, whatever the continues', () => {
  assert.equal(endingRank(runWith(0, 0)), 'S');
  assert.equal(endingRank(runWith(0, 3)), 'S');
});

test('endingRank A: no continue and at most 15 deaths; 16 deaths drops to B', () => {
  assert.equal(endingRank(runWith(1, 0)), 'A');
  assert.equal(endingRank(runWith(15, 0)), 'A', '15 deaths is the last A');
  assert.equal(endingRank(runWith(16, 0)), 'B', '16 deaths is the first B');
  assert.equal(endingRank(runWith(200, 0)), 'B', 'deaths alone never push the rank below B');
});

test('endingRank B: at most one continue; a second continue means C', () => {
  assert.equal(endingRank(runWith(1, 1)), 'B', 'one continue costs the A even with one death');
  assert.equal(endingRank(runWith(15, 1)), 'B');
  assert.equal(endingRank(runWith(40, 1)), 'B');
  assert.equal(endingRank(runWith(1, 2)), 'C');
  assert.equal(endingRank(runWith(16, 3)), 'C');
});

test('endingBonus: the clear bonus is always paid, the other two only for a clean run', () => {
  assert.deepEqual(endingBonus(runWith(0, 0)), {
    clear: ENDING_BONUS.CLEAR, noContinue: ENDING_BONUS.NO_CONTINUE, noDeath: ENDING_BONUS.NO_DEATH, total: 175000,
  });
  assert.deepEqual(endingBonus(runWith(1, 0)), { clear: 50000, noContinue: 25000, noDeath: 0, total: 75000 });
  assert.deepEqual(endingBonus(runWith(0, 1)), { clear: 50000, noContinue: 0, noDeath: 100000, total: 150000 });
  assert.deepEqual(endingBonus(runWith(30, 3)), { clear: 50000, noContinue: 0, noDeath: 0, total: 50000 });
});

test('endingBonus total always equals the sum of its parts', () => {
  for (const deaths of [0, 1, 15, 16]) {
    for (const cont of [0, 1, 3]) {
      const b = endingBonus(runWith(deaths, cont));
      assert.equal(b.total, b.clear + b.noContinue + b.noDeath, `${deaths} deaths, ${cont} continues`);
    }
  }
});
