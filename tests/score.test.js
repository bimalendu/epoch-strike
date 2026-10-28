import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { Run } from '../src/game/run.js';
import { ScoreManager } from '../src/game/score.js';
import { LIVES } from '../src/game/constants.js';

test('milestones: first life at 20,000 then every 50,000', () => {
  const run = new Run();
  const s = run.score;
  assert.equal(s.nextMilestone, 20000);
  s.add(19999);
  assert.equal(run.lives.lives, 3);
  s.add(1);
  assert.equal(run.lives.lives, 4);
  assert.equal(s.nextMilestone, 70000);
  s.add(49999);
  assert.equal(run.lives.lives, 4);
  s.add(1);
  assert.equal(run.lives.lives, 5);
  assert.equal(s.nextMilestone, 120000);
});

test('a big jump in score can cross several milestones at once', () => {
  const run = new Run();
  run.score.add(130000); // 20k, 70k and 120k
  assert.equal(run.lives.lives, 6);
});

test('at the 6-life cap a milestone pays 5,000 bonus points instead', () => {
  const run = new Run();
  run.lives.lives = 6;
  const r = run.score.add(20000);
  assert.equal(run.lives.lives, 6);
  assert.ok(r.events.some((e) => e.type === 'cap' && e.bonus === LIVES.CAP_BONUS));
  assert.equal(run.score.points, 25000);
});

test('capped bonus points can themselves reach the next milestone', () => {
  const run = new Run();
  run.lives.lives = 6;
  run.score.add(20000); // -> 25,000 after the bonus
  run.score.add(44000); // 69,000: just below the 70k milestone
  assert.equal(run.score.points, 69000);
  run.score.add(1000); // crosses 70,000: another capped life = +5,000
  assert.equal(run.score.points, 75000);
  assert.equal(run.score.nextMilestone, 120000);
});

test('kill combo: x1, x1.1, x1.2 ... capped at x2, resets after a gap', () => {
  const s = new ScoreManager({ earnLife: () => [] });
  const pts = [];
  let t = 0;
  for (let i = 0; i < 14; i++) {
    pts.push(s.addKill(100, t).points);
    t += 0.5;
  }
  assert.equal(pts[0], 100);
  assert.equal(pts[1], 110);
  assert.equal(pts[2], 120);
  assert.equal(pts[10], 200);
  assert.equal(pts[13], 200, 'capped at x2');
  t += 1.5;
  assert.equal(s.addKill(100, t).points, 100, 'a pause of more than a second breaks the chain');
});

test('score resets on Continue but the high score stays', () => {
  const run = new Run();
  run.score.add(5000);
  assert.equal(run.score.hi, 5000);
  run.useContinue();
  assert.equal(run.score.points, 0);
  assert.equal(run.score.hi, 5000);
  assert.equal(run.score.nextMilestone, 20000, 'milestones start again');
});

test('medals: 500 points each, every 10th is a life; at the cap it pays the bonus', () => {
  const run = new Run();
  for (let i = 0; i < 9; i++) run.collectMedal();
  assert.equal(run.score.points, 4500);
  const ev = run.collectMedal();
  assert.ok(ev.some((e) => e.type === 'life' && e.source === 'medal'));
  assert.equal(run.lives.lives, 4);
  assert.equal(run.medalsThisLevel, 10);
  run.lives.lives = 6;
  for (let i = 0; i < 9; i++) run.collectMedal();
  const before = run.score.points;
  const ev2 = run.collectMedal();
  assert.ok(ev2.some((e) => e.type === 'cap'));
  assert.equal(run.lives.lives, 6);
  assert.ok(run.score.points >= before + 5000);
});

test('the hidden 1UP is a life, or 5,000 points at the cap', () => {
  const run = new Run();
  assert.deepEqual(run.collectOneUp().map((e) => e.type), ['life']);
  assert.equal(run.lives.lives, 4);
  run.lives.lives = 6;
  assert.deepEqual(run.collectOneUp().map((e) => e.type), ['cap']);
  assert.equal(run.score.points, 5000);
});

test('level clear bonus: 2,000 per life left, +5,000 for no deaths', () => {
  const run = new Run();
  run.startLevel(0);
  assert.deepEqual(run.clearBonus(), { perLife: 6000, noDeath: 5000, total: 11000 });
  run.deathsThisLevel = 1;
  run.lives.lives = 2;
  assert.deepEqual(run.clearBonus(), { perLife: 4000, noDeath: 0, total: 4000 });
});

test('a run survives a save round-trip', () => {
  const run = new Run({ difficulty: 'hard' });
  run.score.add(25000);
  run.lives.lives = 5;
  run.lives.medals = 7;
  run.continuesLeft = 1;
  run.totalDeaths = 4;
  run.loadout = { slots: ['rifle', 'spread'], slot: 1, bombs: 2 };
  run.levelIndex = 3;
  const copy = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())));
  assert.equal(copy.difficulty, 'hard');
  assert.equal(copy.score.points, 25000);
  assert.equal(copy.score.nextMilestone, run.score.nextMilestone);
  assert.equal(copy.lives.lives, 5);
  assert.equal(copy.lives.medals, 7);
  assert.equal(copy.continuesLeft, 1);
  assert.equal(copy.totalDeaths, 4);
  assert.deepEqual(copy.loadout, run.loadout);
  assert.equal(copy.levelIndex, 3);
});
