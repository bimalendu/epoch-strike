// Unit tests for save.js (options, unlocked level, high scores, mid-run resume, storage fallback) and its round trip with Run.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../support/helpers.js';
import { SaveData, MemoryStorage, SAVE_KEY, DEFAULT_OPTIONS } from '../../src/game/save.js';
import { Run } from '../../src/game/run.js';
import { WEAPONS } from '../../src/game/weapons.js';
import { levelCount } from '../../src/game/levels.js';
import { defaultStorage } from '../../src/game/save.js';
import { LIVES, PICKUP_RULES } from '../../src/game/constants.js';
import { rng } from '../../src/engine/rng.js';

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

// ---------------------------------------------------------------------------------------------------------------
// Validation of what comes back from storage, score-table edge cases, setOption and the storage fallback.
// Resume data is either REJECTED (Continue is disabled) or, for a life count above the cap, CLAMPED.
// ---------------------------------------------------------------------------------------------------------------

/** A valid resume snapshot (what Run.toJSON writes), with optional overrides. */
function goodResume(over = {}, loadoutOver = {}) {
  const r = new Run({ difficulty: 'normal', levelIndex: 3 });
  r.score.add(30000);
  r.lives.medals = 4;
  r.totalDeaths = 2;
  r.totalTime = 123.4;
  return { ...JSON.parse(JSON.stringify(r.toJSON())), ...over, loadout: { slots: ['rifle', 'spread'], slot: 1, bombs: 2, ...loadoutOver } };
}

/** Load a save whose stored JSON holds the given top-level fields. */
function loadWith(fields) {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(fields));
  return new SaveData(storage);
}

const resumeOf = (r) => loadWith({ resume: r }).resume;

test('a valid resume is accepted unchanged and unknown extra fields are dropped', () => {
  const good = goodResume();
  assert.deepEqual(resumeOf({ ...good, cheat: true }), good);
});

test('a resume whose numbers are negative is rejected, so Continue stays disabled', () => {
  for (const key of ['levelIndex', 'score', 'milestones', 'lives', 'medals', 'continuesLeft', 'continuesUsed', 'deaths']) {
    assert.equal(resumeOf(goodResume({ [key]: -1 })), null, `negative ${key}`);
  }
});

test('a resume with zero lives is rejected: a run cannot be saved with nobody left to play', () => {
  assert.equal(resumeOf(goodResume({ lives: 0 })), null);
});

test('a resume with a level index outside the game is rejected', () => {
  assert.equal(resumeOf(goodResume({ levelIndex: levelCount() })), null);
  assert.equal(resumeOf(goodResume({ levelIndex: 9999 })), null);
  assert.equal(resumeOf(goodResume({ levelIndex: 1.5 })), null, 'not a whole level');
  assert.ok(resumeOf(goodResume({ levelIndex: levelCount() - 1 })), 'the last level is fine');
  assert.ok(resumeOf(goodResume({ levelIndex: 0 })), 'the first level is fine');
});

test('a resume with more lives than the cap is clamped to the cap, not rejected', () => {
  assert.equal(resumeOf(goodResume({ lives: LIVES.MAX + 1 })).lives, LIVES.MAX);
  assert.equal(resumeOf(goodResume({ lives: 9999 })).lives, LIVES.MAX);
  assert.equal(resumeOf(goodResume({ lives: LIVES.MAX })).lives, LIVES.MAX);
});

test('a resume with a fractional life count or fractional counters is rejected', () => {
  for (const key of ['lives', 'score', 'milestones', 'medals', 'continuesLeft', 'continuesUsed', 'deaths']) {
    assert.equal(resumeOf(goodResume({ [key]: 1.5 })), null, `fractional ${key}`);
  }
});

test('a resume that claims more continues than a run is given is rejected', () => {
  assert.equal(resumeOf(goodResume({ continuesLeft: LIVES.CONTINUES + 1 })), null);
  assert.equal(resumeOf(goodResume({ continuesUsed: LIVES.CONTINUES + 1 })), null);
  assert.ok(resumeOf(goodResume({ continuesLeft: 0, continuesUsed: LIVES.CONTINUES })));
});

test('a resume with the wrong value types is rejected', () => {
  assert.equal(resumeOf(goodResume({ score: '100' })), null);
  assert.equal(resumeOf(goodResume({ lives: null })), null);
  assert.equal(resumeOf(goodResume({ difficulty: 'nightmare' })), null);
  assert.equal(resumeOf('resume'), null);
  assert.equal(resumeOf([]), null);
});

test('a resume with a missing or negative clock keeps the run but restarts the clock at zero', () => {
  const good = goodResume();
  delete good.time;
  assert.equal(resumeOf(good).time, 0);
  assert.equal(resumeOf(goodResume({ time: -50 })).time, 0);
  assert.equal(resumeOf(goodResume({ time: 'soon' })).time, 0);
});

test('a resume whose weapon slot is out of range is rejected', () => {
  for (const slot of [-1, 2, 0.5, '0', null]) assert.equal(resumeOf(goodResume({}, { slot })), null, `slot ${slot}`);
  assert.ok(resumeOf(goodResume({}, { slot: 0 })));
});

test('a resume that names an unknown weapon is rejected, and every real weapon id is accepted', () => {
  assert.equal(resumeOf(goodResume({}, { slots: ['rifle', 'bfg9000'] })), null);
  assert.equal(resumeOf(goodResume({}, { slots: [42, null], slot: 0 })), null);
  assert.equal(resumeOf(goodResume({}, { slots: ['__proto__', null], slot: 0 })), null, 'inherited object keys are not weapons');
  for (const id of Object.keys(WEAPONS)) assert.ok(resumeOf(goodResume({}, { slots: [id, null], slot: 0 })), `weapon ${id}`);
});

test('a resume whose slot list is not exactly two entries, or whose active slot is empty, is rejected', () => {
  assert.equal(resumeOf(goodResume({}, { slots: ['rifle'] })), null);
  assert.equal(resumeOf(goodResume({}, { slots: ['rifle', null, 'spread'] })), null);
  assert.equal(resumeOf(goodResume({}, { slots: ['rifle', null], slot: 1 })), null, 'the active slot must hold a weapon');
  assert.ok(resumeOf(goodResume({}, { slots: [null, 'spread'], slot: 1 })), 'an empty inactive slot is normal');
});

test('a resume with missing or out-of-range bombs is rejected', () => {
  const noBombs = goodResume();
  delete noBombs.loadout.bombs;
  assert.equal(resumeOf(noBombs), null);
  assert.equal(resumeOf(goodResume({}, { bombs: -1 })), null);
  assert.equal(resumeOf(goodResume({}, { bombs: PICKUP_RULES.MAX_BOMBS + 1 })), null);
  assert.equal(resumeOf(goodResume({}, { bombs: 1.5 })), null);
  assert.equal(resumeOf(goodResume({}, { bombs: '2' })), null);
  assert.ok(resumeOf(goodResume({}, { bombs: 0 })));
  assert.ok(resumeOf(goodResume({}, { bombs: PICKUP_RULES.MAX_BOMBS })));
});

test('a resume with no loadout, or a loadout that is not an object, is rejected', () => {
  const g = goodResume();
  delete g.loadout;
  assert.equal(resumeOf(g), null);
  assert.equal(resumeOf({ ...goodResume(), loadout: 'rifle' }), null);
  assert.equal(resumeOf({ ...goodResume(), loadout: { slots: 'rifle', slot: 0, bombs: 1 } }), null);
});

test('a rejected resume leaves the rest of the save (options, scores, unlocked) intact', () => {
  const s = loadWith({ unlocked: 5, scores: [{ name: 'AAA', score: 900, level: 1 }], resume: goodResume({ lives: -4 }) });
  assert.equal(s.resume, null);
  assert.equal(s.unlocked, 5);
  assert.equal(s.best, 900);
});

test('unlocked is capped at the number of levels (finishing the last level unlocks exactly that many)', () => {
  assert.equal(loadWith({ unlocked: 5000 }).unlocked, levelCount());
  assert.equal(loadWith({ unlocked: levelCount() }).unlocked, levelCount());
  assert.equal(loadWith({ unlocked: levelCount() - 1 }).unlocked, levelCount() - 1);
  const s = fresh();
  s.unlock(levelCount() + 50);
  assert.equal(s.unlocked, levelCount(), 'unlock() obeys the same cap');
});

test('unlocked drops non-integers and negatives to zero', () => {
  for (const bad of [-1, 2.5, '3', null, NaN, {}]) assert.equal(loadWith({ unlocked: bad }).unlocked, 0, `unlocked ${bad}`);
});

test('the clear counter is capped at 999 and drops anything that is not a positive whole number', () => {
  assert.equal(loadWith({ cleared: 5 }).cleared, 5);
  assert.equal(loadWith({ cleared: 100000 }).cleared, 999);
  for (const bad of [1.5, -2, '4', null, NaN, 0]) assert.equal(loadWith({ cleared: bad }).cleared, 0, `cleared ${bad}`);
  const s = loadWith({ cleared: 999 });
  s.markCleared();
  assert.equal(s.cleared, 999, 'markCleared stops at the cap');
});

test('a tied score ranks below the older entry', () => {
  const s = fresh();
  s.addScore('OLD', 5000, 1);
  s.addScore('NEW', 5000, 1);
  assert.equal(s.scores[0].name, 'OLD');
  assert.equal(s.scores[1].name, 'NEW');
  assert.equal(s.addScore('TOP', 5000, 1), 2, 'a third tie goes to the bottom of the tie');
});

test('qualifies is strict at equality once the table is full, and always true while there is room', () => {
  const s = fresh();
  assert.equal(s.qualifies(1), true, 'an empty table takes anything above zero');
  for (let i = 1; i <= 10; i++) s.addScore('AAA', i * 100, 1);
  assert.equal(s.qualifies(100), false, 'equal to the 10th place does not displace it');
  assert.equal(s.addScore('TIE', 100, 1), -1);
  assert.equal(s.qualifies(101), true);
  assert.equal(s.scores[9].score, 100);
});

test('zero, negative, fractional-below-one and non-finite scores never qualify', () => {
  const s = fresh();
  for (const bad of [0, -1, -0.5, 0.4, NaN, Infinity, -Infinity, undefined, '500']) {
    assert.equal(s.qualifies(bad), false, `qualifies(${bad})`);
    assert.equal(s.addScore('BAD', bad, 1), -1, `addScore(${bad})`);
  }
  assert.deepEqual(s.scores, [], 'nothing was stored');
});

test('fractional scores are floored when stored, and compared after flooring', () => {
  const s = fresh();
  assert.equal(s.addScore('FRC', 1234.9, 2), 0);
  assert.equal(s.scores[0].score, 1234);
  for (let i = 0; i < 9; i++) s.addScore('AAA', 2000 + i, 1);
  assert.equal(s.scores.length, 10);
  assert.equal(s.qualifies(1234.9), false, 'it ties with 1234, the lowest entry');
});

test('stored scores that are negative, fractional or oddly named are cleaned when loaded', () => {
  const s = loadWith({ scores: [
    { name: 'x', score: -5, level: 1 },
    { name: 'a-b-c-d', score: 77.9, level: -3.5, date: 12345 },
    { name: '', score: 10, level: 'x' },
  ] });
  assert.deepEqual(s.scores.map((e) => e.score), [77, 10, 0]);
  assert.equal(s.scores[0].name, 'ABC');
  assert.equal(s.scores[0].level, 0);
  assert.equal(s.scores[0].date, '');
  assert.equal(s.scores[1].name, 'AAA', 'an empty name becomes AAA');
});

test('setOption stores every valid value and persists it', () => {
  const storage = new MemoryStorage();
  const s = new SaveData(storage);
  const valid = { sfx: 0.25, music: 1, difficulty: 'hard', shake: false, fx: 'low', touch: 'on', flashes: 'reduced', crt: 'scanlines', hud: 'large' };
  for (const [k, v] of Object.entries(valid)) assert.equal(s.setOption(k, v), true, k);
  assert.deepEqual(new SaveData(storage).options, valid);
});

test('setOption rejects unknown keys and leaves the options unchanged', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const s = fresh();
  assert.equal(s.setOption('godmode', true), false);
  assert.equal(s.setOption('__proto__', { sfx: 1 }), false);
  assert.equal(s.setOption('toString', 'x'), false, 'inherited names are not options');
  assert.deepEqual(s.options, DEFAULT_OPTIONS);
  assert.ok(!('godmode' in s.options));
  assert.equal(warn.mock.callCount(), 3, 'each rejection is reported in the console');
});

test('setOption rejects invalid values and keeps the previous one', (t) => {
  t.mock.method(console, 'warn', () => {});
  const s = fresh();
  const bad = {
    sfx: [-0.1, 1.1, NaN, Infinity, '0.5', null],
    music: [2, -1, undefined],
    difficulty: ['nightmare', '', 'EASY', 1],
    shake: ['yes', 1, null],
    fx: ['medium', true],
    touch: ['maybe', 0],
    flashes: ['none', false],
    crt: ['on', true],
    hud: ['huge', 2],
  };
  for (const [k, values] of Object.entries(bad)) {
    for (const v of values) {
      assert.equal(s.setOption(k, v), false, `${k}=${String(v)}`);
      assert.equal(s.options[k], DEFAULT_OPTIONS[k], `${k} unchanged after ${String(v)}`);
    }
  }
});

test('setOption accepts the edge values of the volume range', () => {
  const s = fresh();
  assert.equal(s.setOption('sfx', 0), true);
  assert.equal(s.setOption('sfx', 1), true);
  assert.equal(s.options.sfx, 1);
});

test('a rejected setOption does not write to storage', (t) => {
  t.mock.method(console, 'warn', () => {});
  const writes = [];
  const storage = { getItem: () => null, setItem: (k, v) => writes.push(v), removeItem() {} };
  const s = new SaveData(storage);
  s.setOption('sfx', 7);
  s.setOption('nope', 1);
  assert.equal(writes.length, 0);
  s.setOption('sfx', 0.5);
  assert.equal(writes.length, 1);
});

/** Run `fn` with globalThis.localStorage replaced by `ls` (or removed when undefined). */
function withLocalStorage(ls, fn) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved);
    else delete globalThis.localStorage;
  }
}

test('defaultStorage uses localStorage when it works, probing it without leaving a trace', () => {
  const store = new Map();
  const ls = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  withLocalStorage(ls, () => assert.equal(defaultStorage(), ls));
  assert.equal(store.size, 0, 'the probe key was removed again');
});

test('defaultStorage falls back to memory when localStorage.setItem throws (private mode, quota)', () => {
  const ls = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} };
  withLocalStorage(ls, () => {
    const s = defaultStorage();
    assert.ok(s instanceof MemoryStorage);
    s.setItem('k', 1);
    assert.equal(s.getItem('k'), '1');
  });
});

test('defaultStorage falls back to memory when touching localStorage itself throws, or it is absent', () => {
  const blocked = {};
  Object.defineProperty(blocked, 'localStorage', { get() { throw new Error('SecurityError'); } });
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('SecurityError'); }, configurable: true });
  try {
    assert.ok(defaultStorage() instanceof MemoryStorage);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved);
    else delete globalThis.localStorage;
  }
  withLocalStorage(undefined, () => assert.ok(defaultStorage() instanceof MemoryStorage));
  withLocalStorage(null, () => assert.ok(defaultStorage() instanceof MemoryStorage));
});

test('a SaveData built on a throwing localStorage still works for the session', () => {
  const ls = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() {} };
  withLocalStorage(ls, () => {
    const s = new SaveData();
    s.setOption('difficulty', 'easy');
    s.addScore('ZED', 321, 1);
    assert.equal(s.options.difficulty, 'easy');
    assert.equal(s.best, 321);
  });
});

test('hints persist, ignore duplicates and stop at 32', () => {
  const storage = new MemoryStorage();
  const s = new SaveData(storage);
  s.markHint('jump');
  s.markHint('jump');
  assert.equal(new SaveData(storage).data.hints.length, 1);
  assert.equal(s.hintSeen('jump'), true);
  assert.equal(s.hintSeen('fire'), false);
  for (let i = 0; i < 40; i++) s.markHint('h' + i);
  assert.equal(s.data.hints.length, 32);
});

test('hints from storage are filtered to short lowercase ids and de-duplicated', () => {
  const s = loadWith({ hints: ['ok', 'ok', 'Bad Id', 5, '', 'a'.repeat(25), 'fine-1'] });
  assert.deepEqual(s.data.hints, ['ok', 'fine-1']);
  assert.deepEqual(loadWith({ hints: 'nope' }).data.hints, []);
});

// ---------------------------------------------------------------------------------------------------------------
// Run.restore / Run.fromJSON: defence in depth for snapshots that did not go through the loader.
// ---------------------------------------------------------------------------------------------------------------
test('Run.restore clamps lives to the cap and never goes negative', () => {
  assert.equal(Run.fromJSON(goodResume({ lives: 99 })).lives.lives, LIVES.MAX);
  assert.equal(Run.fromJSON(goodResume({ lives: -5 })).lives.lives, 0);
  assert.equal(Run.fromJSON(goodResume({ lives: 4 })).lives.lives, 4);
});

test('Run.restore clamps bombs into 0..max and falls back to the starting bombs when missing', () => {
  assert.equal(Run.fromJSON(goodResume({}, { bombs: 99 })).loadout.bombs, PICKUP_RULES.MAX_BOMBS);
  assert.equal(Run.fromJSON(goodResume({}, { bombs: -2 })).loadout.bombs, 0);
  assert.equal(Run.fromJSON(goodResume({}, { bombs: undefined })).loadout.bombs, PICKUP_RULES.START_BOMBS);
  assert.equal(Run.fromJSON(goodResume({}, { bombs: NaN })).loadout.bombs, PICKUP_RULES.START_BOMBS);
});

test('Run.restore repairs a loadout the way the player does: rifle in slot 0, active slot must hold a weapon', () => {
  assert.deepEqual(Run.fromJSON(goodResume({}, { slots: [null, null], slot: 0 })).loadout.slots, ['rifle', null]);
  assert.equal(Run.fromJSON(goodResume({}, { slots: ['rifle', null], slot: 1 })).loadout.slot, 0, 'an empty active slot falls back to slot 0');
  assert.equal(Run.fromJSON(goodResume({}, { slots: ['rifle', 'spread'], slot: 7 })).loadout.slot, 0);
  assert.equal(Run.fromJSON(goodResume({}, { slots: ['rifle', 'spread'], slot: 1 })).loadout.slot, 1);
});

test('Run.restore copies the loadout so the snapshot and the run do not share arrays', () => {
  const snap = goodResume();
  const run = Run.fromJSON(snap);
  run.loadout.slots[0] = 'flame';
  assert.equal(snap.loadout.slots[0], 'rifle');
});

test('Run.restore resets the combo and the checkpoint', () => {
  const run = new Run();
  run.score.addKill(100, 1);
  run.score.addKill(100, 1.2);
  run.checkpoint = { levelIndex: 0, x: 10, y: 10 };
  run.restore(goodResume());
  assert.equal(run.score.combo, 0);
  assert.equal(run.checkpoint, null);
  assert.equal(run.score.lastKill, -Infinity);
});

test('a resume that survives the loader round-trips through Run.fromJSON exactly', () => {
  const stored = resumeOf(goodResume({ lives: 5, difficulty: 'hard', continuesLeft: 1, continuesUsed: 2 }));
  const run = Run.fromJSON(stored);
  assert.deepEqual(run.toJSON(), stored);
});

// ---------------------------------------------------------------------------------------------------------------
// Property test: whatever is in storage, the loader never throws and always hands the game valid data. The cases are a
// good save with a few fields replaced by junk, plus raw garbage; the seed is fixed, so a failure replays exactly.
// ---------------------------------------------------------------------------------------------------------------

test('a saved score whose level is not a number loads as level 0, never NaN (the scores screen looks the level name up)', () => {
  for (const level of [{}, 'x', [1, 2], { slots: 'no' }, null, undefined, -5, 1e999]) {
    const s = loadWith({ scores: [{ name: 'ABC', score: 10, level }] });
    assert.equal(s.scores.length, 1);
    assert.equal(s.scores[0].level, 0, `level ${JSON.stringify(level)}`);
  }
  assert.equal(loadWith({ scores: [{ name: 'ABC', score: 10, level: '4' }] }).scores[0].level, 4, 'a numeric string still counts');
});

const JUNK = [null, true, false, 0, -1, 0.5, 7, 1e308, -1e308, 'x', '', 'normal', 'AAA', [], [null], {}, { slots: 'no' }];

/** Replaces one random field somewhere in `value` (up to three levels down) with junk, or deletes it. */
function corrupt(value, r) {
  let node = value;
  for (let depth = 0; depth < 3; depth++) {
    const keys = Object.keys(node);
    if (!keys.length) return; // an earlier corruption emptied it
    const key = r.pick(keys);
    const child = node[key];
    if (child && typeof child === 'object' && depth < 2 && r.chance(0.6)) {
      node = child;
      continue;
    }
    if (r.chance(0.2)) delete node[key];
    else node[key] = r.pick(JUNK);
    return;
  }
}

test('property: any mangled save loads without throwing and every field comes out valid (500 seeded cases)', () => {
  const r = rng(20240531);
  const base = () => ({
    version: 1,
    unlocked: 5,
    cleared: 3,
    options: { ...DEFAULT_OPTIONS },
    scores: [{ name: 'ABC', score: 900, level: 2, date: '2024-01-01' }, { name: 'ZZ', score: 100, level: 1, date: '' }],
    hints: ['jump', 'fire'],
    resume: goodResume(),
  });
  let kept = 0;
  for (let n = 0; n < 500; n++) {
    const doc = base();
    for (let k = r.int(1, 4); k > 0; k--) corrupt(doc, r);
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, r.chance(0.05) ? r.pick(['{', '[1,2', 'null', '"s"', '123', '']) : JSON.stringify(doc));
    const label = `case ${n}: ${storage.getItem(SAVE_KEY).slice(0, 160)}`;
    let s;
    assert.doesNotThrow(() => { s = new SaveData(storage); }, label);
    assert.ok(Number.isInteger(s.unlocked) && s.unlocked >= 0 && s.unlocked <= levelCount(), `unlocked: ${label}`);
    for (const key of Object.keys(DEFAULT_OPTIONS)) assert.equal(typeof s.options[key], typeof DEFAULT_OPTIONS[key], `option ${key}: ${label}`);
    assert.ok(s.options.sfx >= 0 && s.options.sfx <= 1 && s.options.music >= 0 && s.options.music <= 1, `volumes: ${label}`);
    assert.ok(['easy', 'normal', 'hard'].includes(s.options.difficulty), `difficulty: ${label}`);
    assert.ok(s.scores.length <= 10, `score table length: ${label}`);
    for (let i = 0; i < s.scores.length; i++) {
      assert.match(s.scores[i].name, /^[A-Z0-9 ]{1,3}$/, `score name: ${label}`);
      assert.ok(Number.isInteger(s.scores[i].score) && s.scores[i].score >= 0, `score value: ${label}`);
      if (i) assert.ok(s.scores[i - 1].score >= s.scores[i].score, `scores sorted: ${label}`);
    }
    if (s.resume) {
      kept++;
      assert.doesNotThrow(() => Run.fromJSON(s.resume), `resume restores: ${label}`);
      assert.ok(s.resume.lives >= 1 && s.resume.lives <= LIVES.MAX, `resume lives: ${label}`);
    }
    // whatever came out, saving it and loading it again changes nothing
    s.save();
    assert.equal(JSON.stringify(new SaveData(storage).data), JSON.stringify(s.data), `save/load round trip: ${label}`);
  }
  assert.ok(kept > 100 && kept < 500, `the generator hits both outcomes for the resume (kept ${kept} of 500)`);
});
