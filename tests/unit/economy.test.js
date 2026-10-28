// Week 16 (balance): the lives economy of the whole game, read from the level data.
//
// The design plan fixes the rules (3 lives, cap 6, 10 medals = a life, 20,000 then every 50,000 points, one hidden 1UP per
// era group, a life for a flawless boss kill) and asks for one outcome: the average player has about 4 lives entering
// Level 13. The level data decides how many medals and points there are to earn. `tools/economy.mjs` models that; these
// tests keep it from drifting when a level is edited. The death rates behind "average" are assumptions (see the tool).
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { levelSupply, simulate, breakEvenDeaths, MODELS } from '../../tools/economy.mjs';
import { LEVEL_DEFS } from '../../src/game/levels.js';
import { LIVES, DIFFICULTY } from '../../src/game/constants.js';

const supply = LEVEL_DEFS.map((_, i) => levelSupply(i));

test('every level hands out a sensible number of medals, and every era group hides exactly one 1UP', () => {
  assert.equal(supply.length, 20);
  supply.forEach((s, i) => {
    assert.ok(s.medals >= 6 && s.medals <= 25, `level ${i + 1} has ${s.medals} medals`);
    assert.ok(s.oneups <= 1, `level ${i + 1} hides ${s.oneups} 1UPs`);
    assert.ok(s.enemies >= 10, `level ${i + 1} has ${s.enemies} enemies placed`);
    assert.ok(s.boss > 0, `level ${i + 1} has a boss worth points`);
  });
  for (let g = 0; g < 5; g++) {
    const n = supply.slice(g * 4, g * 4 + 4).reduce((a, s) => a + s.oneups, 0);
    assert.equal(n, 1, `era group ${g + 1} hides one 1UP`);
  }
  const total = supply.reduce((a, s) => a + s.medals, 0);
  assert.ok(total >= 200 && total <= 320, `${total} medals in the game`);
});

test('boss and enemy points rise through the game (later eras are worth more)', () => {
  const group = (g, key) => supply.slice(g * 4, g * 4 + 4).reduce((a, s) => a + s[key], 0);
  for (let g = 1; g < 5; g++) {
    assert.ok(group(g, 'boss') > group(g - 1, 'boss'), `boss points of group ${g + 1}`);
  }
  assert.ok(group(4, 'kills') > group(0, 'kills'));
});

test('the supply of lives pays for about two deaths a level: the average player has ~4 lives entering Level 13', () => {
  const be = breakEvenDeaths(supply);
  assert.ok(be >= 1.7 && be <= 2.6, `break-even ${be.toFixed(2)} deaths per level`);
  // and the doubly-checked statement: at exactly that rate the model lands on the target
  const r = simulate({ base: be, ramp: 0, flawless: 0.2 }, supply);
  assert.ok(Math.abs(r.rows[12].entering - 4) < 0.05, `${r.rows[12].entering.toFixed(2)} lives entering Level 13`);
  // a player who loses a life per level or fewer is soon capped; one who loses four never keeps up (needs Continues)
  const skilled = simulate({ base: 1, ramp: 0, flawless: 0.5 }, supply);
  assert.ok(skilled.rows[12].entering >= 5.5, `skilled player: ${skilled.rows[12].entering.toFixed(1)}`);
  const casual = simulate({ base: 4, ramp: 0, flawless: 0.05 }, supply);
  assert.ok(casual.rows[12].entering <= 1.5, `casual player: ${casual.rows[12].entering.toFixed(1)}`);
  assert.ok(MODELS.average.base > 1.5 && MODELS.average.base < 2.6, 'the stated average is about two deaths a level');
});

test('the economy model never goes outside the rules: lives stay between 1 and the cap, points only ever grow', () => {
  for (const model of Object.values(MODELS)) {
    const r = simulate(model, supply);
    let prev = -1;
    for (const row of r.rows) {
      assert.ok(row.entering >= 1 && row.entering <= LIVES.MAX, `entering ${row.entering}`);
      assert.ok(row.after >= 1 && row.after <= LIVES.MAX);
      assert.ok(row.points >= prev, 'points never fall');
      prev = row.points;
    }
  }
});

test('difficulty: Easy starts with more lives and slower bullets, Hard has no medals and faster bullets', () => {
  assert.equal(LIVES.START.easy, 5);
  assert.equal(LIVES.START.normal, 3);
  assert.equal(LIVES.START.hard, 3);
  assert.ok(DIFFICULTY.easy.bulletMul < DIFFICULTY.normal.bulletMul && DIFFICULTY.normal.bulletMul < DIFFICULTY.hard.bulletMul);
  assert.equal(DIFFICULTY.hard.medals, false);
  assert.equal(DIFFICULTY.easy.medals && DIFFICULTY.normal.medals, true);
  // Hard gives up the medal lives, so its supply is smaller: at the same death rate it ends up lower
  const noMedals = supply.map((s) => ({ ...s, medals: 0 }));
  const normal = simulate({ base: 2, ramp: 0, flawless: 0.2 }, supply);
  const hard = simulate({ base: 2, ramp: 0, flawless: 0.2 }, noMedals);
  assert.ok(hard.rows[12].entering < normal.rows[12].entering);
});
