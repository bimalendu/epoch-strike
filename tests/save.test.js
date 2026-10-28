import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { SaveData, MemoryStorage, SAVE_KEY, DEFAULT_OPTIONS } from '../src/game/save.js';
import { Run } from '../src/game/run.js';

const fresh = () => new SaveData(new MemoryStorage());

test('a new save has sensible defaults', () => {
  const s = fresh();
  assert.equal(s.unlocked, 0);
  assert.deepEqual(s.options, DEFAULT_OPTIONS);
  assert.deepEqual(s.scores, []);
  assert.equal(s.resume, null);
  assert.equal(s.best, 0);
});

test('options, unlocked level and scores persist across loads', () => {
  const storage = new MemoryStorage();
  const a = new SaveData(storage);
  a.setOption('sfx', 0.3);
  a.setOption('difficulty', 'hard');
  a.unlock(4);
  a.addScore('ABC', 12345, 3);
  const b = new SaveData(storage);
  assert.equal(b.options.sfx, 0.3);
  assert.equal(b.options.difficulty, 'hard');
  assert.equal(b.unlocked, 4);
  assert.equal(b.scores[0].name, 'ABC');
  assert.equal(b.best, 12345);
});

test('unlock only ever moves forward', () => {
  const s = fresh();
  s.unlock(5);
  s.unlock(2);
  assert.equal(s.unlocked, 5);
});

test('the high score table keeps the best 10, sorted', () => {
  const s = fresh();
  for (let i = 1; i <= 12; i++) s.addScore('P' + (i % 10), i * 1000, i);
  assert.equal(s.scores.length, 10);
  assert.equal(s.scores[0].score, 12000);
  assert.equal(s.scores[9].score, 3000);
  assert.equal(s.qualifies(2999), false);
  assert.equal(s.qualifies(3001), true);
  assert.equal(s.qualifies(0), false);
  assert.equal(s.addScore('LOW', 100, 1), -1);
  const rank = s.addScore('MID', 7500, 1);
  assert.equal(s.scores[rank].name, 'MID');
  assert.equal(rank, 5);
});

test('initials are cleaned up', () => {
  const s = fresh();
  s.addScore('a<b>cde', 500, 1);
  assert.equal(s.scores[0].name, 'ABC');
});

test('corrupt or hostile save data falls back to defaults', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, '{not json');
  assert.deepEqual(new SaveData(storage).options, DEFAULT_OPTIONS);
  storage.setItem(SAVE_KEY, JSON.stringify({ unlocked: -3, options: { sfx: 9, music: 'loud', difficulty: 'nightmare', shake: 0 }, scores: [{ score: 'x' }, { name: 'ok', score: 50, level: 1 }], resume: { bogus: true } }));
  const s = new SaveData(storage);
  assert.equal(s.unlocked, 0);
  assert.equal(s.options.sfx, 1);
  assert.equal(s.options.music, DEFAULT_OPTIONS.music);
  assert.equal(s.options.difficulty, 'normal');
  assert.equal(s.scores.length, 1);
  assert.equal(s.resume, null);
});

test('the mid-run save round-trips a run', () => {
  const storage = new MemoryStorage();
  const a = new SaveData(storage);
  const run = new Run({ difficulty: 'easy', levelIndex: 2 });
  run.score.add(21000);
  run.loadout = { slots: ['rifle', 'flame'], slot: 1, bombs: 3 };
  a.saveResume(run);
  const b = new SaveData(storage);
  assert.ok(b.resume);
  const back = Run.fromJSON(b.resume);
  assert.equal(back.levelIndex, 2);
  assert.equal(back.score.points, 21000);
  assert.equal(back.lives.lives, run.lives.lives);
  assert.deepEqual(back.loadout, run.loadout);
  b.clearResume();
  assert.equal(new SaveData(storage).resume, null);
});

test('a storage that throws never crashes the game', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('blocked'); },
  };
  const s = new SaveData(broken);
  assert.equal(s.unlocked, 0);
  assert.equal(s.save(), false);
  s.setOption('sfx', 0.5);
  assert.equal(s.options.sfx, 0.5, 'still works in memory for this session');
});
