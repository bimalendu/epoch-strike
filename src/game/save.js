// Save data in localStorage: unlocked levels, options, the top-10 high scores and the mid-run save.
// Anything unreadable falls back to defaults, and storage failures (private mode, quota) never crash the game.

import { LIVES, PICKUP_RULES } from './constants.js';
import { levelCount } from './levels.js';
import { WEAPONS } from './weapons.js';

export const SAVE_KEY = 'epoch-strike-save-v1';
const VERSION = 1;
const MAX_SCORES = 10;
const MAX_HINTS = 32;

export const DEFAULT_OPTIONS = { sfx: 0.8, music: 0.6, difficulty: 'normal', shake: true, fx: 'high', touch: 'auto', flashes: 'full', crt: 'off', hud: 'normal' };

/** In-memory stand-in with the localStorage interface (tests, or when real storage is blocked). */
export class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

export function defaultStorage() {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      ls.setItem('__es_probe', '1');
      ls.removeItem('__es_probe');
      return ls;
    }
  } catch (e) {
    // fall through to memory
  }
  return new MemoryStorage();
}

/** The allowed values of every option: setOption refuses anything else, and so does the loader. */
const OPTION_VALID = {
  sfx: (v) => typeof v === 'number' && v >= 0 && v <= 1, // false for NaN and for anything that is not a number
  music: (v) => typeof v === 'number' && v >= 0 && v <= 1,
  difficulty: (v) => ['easy', 'normal', 'hard'].includes(v),
  shake: (v) => typeof v === 'boolean',
  fx: (v) => v === 'low' || v === 'high',
  touch: (v) => ['auto', 'on', 'off'].includes(v),
  flashes: (v) => v === 'full' || v === 'reduced',
  crt: (v) => v === 'off' || v === 'scanlines',
  hud: (v) => v === 'normal' || v === 'large',
};

const clamp01 = (v, d) => (typeof v === 'number' && isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

function blank() {
  return { version: VERSION, unlocked: 0, options: { ...DEFAULT_OPTIONS }, scores: [], resume: null, cleared: 0, hints: [] };
}

function sanitizeScore(s) {
  if (!s || typeof s.score !== 'number' || !isFinite(s.score)) return null;
  const level = Math.floor(Number(s.level || 0));
  return {
    name: String(s.name || 'AAA').toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 3) || 'AAA',
    score: Math.max(0, Math.floor(s.score)),
    level: isFinite(level) ? Math.max(0, level) : 0, // junk such as {} or 'x' would be NaN
    date: typeof s.date === 'string' ? s.date.slice(0, 10) : '',
  };
}

/** The ids of the first-time hints already shown: a short list of short strings, nothing else. */
function sanitizeHints(h) {
  if (!Array.isArray(h)) return [];
  const ids = h.filter((x) => typeof x === 'string' && /^[a-z0-9-]{1,24}$/.test(x));
  return [...new Set(ids)].slice(0, MAX_HINTS);
}

const isInt = (v, lo, hi = Infinity) => Number.isInteger(v) && v >= lo && v <= hi;

/**
 * A mid-run save read back from storage. Anything that could not have come from Run.toJSON() is REJECTED (null, so the
 * menu's Continue is disabled): out-of-range level, negative or fractional counters, unknown weapons, bad slot, bombs
 * missing or out of range. The one exception is a life count above the cap, which is CLAMPED to LIVES.MAX.
 */
function sanitizeResume(r) {
  if (!r || typeof r !== 'object') return null;
  const l = r.loadout;
  if (!l || typeof l !== 'object' || !Array.isArray(l.slots) || l.slots.length !== 2) return null;
  if (!l.slots.every((id) => id === null || (typeof id === 'string' && Object.hasOwn(WEAPONS, id)))) return null;
  if (!isInt(l.slot, 0, 1) || l.slots[l.slot] === null) return null;
  if (!isInt(l.bombs, 0, PICKUP_RULES.MAX_BOMBS)) return null;
  if (!isInt(r.levelIndex, 0, levelCount() - 1)) return null;
  for (const k of ['score', 'milestones', 'medals', 'deaths']) if (!isInt(r[k], 0)) return null;
  if (!isInt(r.lives, 1)) return null; // a run with nobody left is never saved; a negative count is garbage
  if (!isInt(r.continuesLeft, 0, LIVES.CONTINUES) || !isInt(r.continuesUsed, 0, LIVES.CONTINUES)) return null;
  if (!['easy', 'normal', 'hard'].includes(r.difficulty)) return null;
  return {
    difficulty: r.difficulty,
    levelIndex: r.levelIndex,
    score: r.score,
    milestones: r.milestones,
    lives: Math.min(r.lives, LIVES.MAX),
    medals: r.medals,
    continuesLeft: r.continuesLeft,
    continuesUsed: r.continuesUsed,
    deaths: r.deaths,
    time: typeof r.time === 'number' && isFinite(r.time) && r.time >= 0 ? r.time : 0,
    loadout: { slots: [...l.slots], slot: l.slot, bombs: l.bombs },
  };
}

export class SaveData {
  constructor(storage = defaultStorage()) {
    this.storage = storage;
    this.data = this.load();
  }

  load() {
    const d = blank();
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return d;
      const o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return d;
      d.unlocked = Number.isInteger(o.unlocked) && o.unlocked >= 0 ? Math.min(o.unlocked, levelCount()) : 0;
      const op = o.options || {};
      d.options.sfx = clamp01(op.sfx, DEFAULT_OPTIONS.sfx);
      d.options.music = clamp01(op.music, DEFAULT_OPTIONS.music);
      d.options.difficulty = ['easy', 'normal', 'hard'].includes(op.difficulty) ? op.difficulty : 'normal';
      d.options.shake = op.shake !== false;
      d.options.fx = op.fx === 'low' ? 'low' : 'high';
      d.options.touch = ['auto', 'on', 'off'].includes(op.touch) ? op.touch : 'auto';
      d.options.flashes = op.flashes === 'reduced' ? 'reduced' : 'full';
      d.options.crt = op.crt === 'scanlines' ? 'scanlines' : 'off';
      d.options.hud = op.hud === 'large' ? 'large' : 'normal';
      d.scores = (Array.isArray(o.scores) ? o.scores : []).map(sanitizeScore).filter(Boolean);
      d.scores.sort((a, b) => b.score - a.score);
      d.scores.length = Math.min(d.scores.length, MAX_SCORES);
      d.resume = sanitizeResume(o.resume);
      d.cleared = Number.isInteger(o.cleared) && o.cleared > 0 ? Math.min(o.cleared, 999) : 0;
      d.hints = sanitizeHints(o.hints);
    } catch (e) {
      return blank(); // corrupt JSON: start fresh
    }
    return d;
  }

  save() {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      return false;
    }
  }

  get options() {
    return this.data.options;
  }

  /** Highest level index the player may pick in Level Select. */
  get unlocked() {
    return this.data.unlocked;
  }

  unlock(levelIndex) {
    const target = Math.min(levelIndex, levelCount()); // finishing the last level unlocks "level count", never more
    if (target > this.data.unlocked) {
      this.data.unlocked = target;
      this.save();
    }
  }

  /** How many times the whole game has been finished (shown on the main menu). */
  get cleared() {
    return this.data.cleared;
  }

  markCleared() {
    this.data.cleared = Math.min(999, this.data.cleared + 1);
    this.save();
  }

  get scores() {
    return this.data.scores;
  }

  get best() {
    return this.data.scores.length ? this.data.scores[0].score : 0;
  }

  /** Would this score make the top 10? */
  qualifies(score) {
    if (typeof score !== 'number' || !isFinite(score)) return false;
    const points = Math.floor(score); // scores are stored as whole numbers, so compare them that way
    if (points <= 0) return false;
    const s = this.data.scores;
    return s.length < MAX_SCORES || points > s[s.length - 1].score;
  }

  /** Insert a score; returns its rank (0 = best) or -1 if it did not make the list. */
  addScore(name, score, level) {
    if (!this.qualifies(score)) return -1;
    const entry = sanitizeScore({ name, score, level, date: new Date().toISOString() });
    const s = this.data.scores;
    s.push(entry);
    s.sort((a, b) => b.score - a.score); // stable: an equal score ranks below the older one
    s.length = Math.min(s.length, MAX_SCORES);
    this.save();
    return s.indexOf(entry);
  }

  get resume() {
    return this.data.resume;
  }

  saveResume(run) {
    this.data.resume = run.toJSON();
    this.save();
  }

  clearResume() {
    if (this.data.resume) {
      this.data.resume = null;
      this.save();
    }
  }

  hintSeen(id) {
    return this.data.hints.includes(id);
  }

  /** Remember that a first-time hint has been shown, so it never comes back. */
  markHint(id) {
    if (this.hintSeen(id) || this.data.hints.length >= MAX_HINTS) return;
    this.data.hints.push(id);
    this.save();
  }

  /** Change one option. Unknown keys and values outside the option's range are refused (returns false, warns). */
  setOption(key, value) {
    const valid = Object.hasOwn(OPTION_VALID, key) ? OPTION_VALID[key] : null;
    if (!valid || !valid(value)) {
      console.warn(`Ignoring invalid option ${String(key)} = ${String(value)}`);
      return false;
    }
    this.data.options[key] = value;
    this.save();
    return true;
  }
}
