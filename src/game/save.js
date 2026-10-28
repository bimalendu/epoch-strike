// Save data in localStorage: unlocked levels, options, the top-10 high scores and the mid-run save.
// Anything unreadable falls back to defaults, and storage failures (private mode, quota) never crash the game.

export const SAVE_KEY = 'epoch-strike-save-v1';
const VERSION = 1;
const MAX_SCORES = 10;

export const DEFAULT_OPTIONS = { sfx: 0.8, music: 0.6, difficulty: 'normal', shake: true, fx: 'high', touch: 'auto' };

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

const clamp01 = (v, d) => (typeof v === 'number' && isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

function blank() {
  return { version: VERSION, unlocked: 0, options: { ...DEFAULT_OPTIONS }, scores: [], resume: null, cleared: 0 };
}

function sanitizeScore(s) {
  if (!s || typeof s.score !== 'number' || !isFinite(s.score)) return null;
  return {
    name: String(s.name || 'AAA').toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 3) || 'AAA',
    score: Math.max(0, Math.floor(s.score)),
    level: Math.max(0, Math.floor(s.level || 0)),
    date: typeof s.date === 'string' ? s.date.slice(0, 10) : '',
  };
}

function sanitizeResume(r) {
  if (!r || typeof r !== 'object') return null;
  const l = r.loadout;
  if (!l || !Array.isArray(l.slots)) return null;
  const nums = ['levelIndex', 'score', 'milestones', 'lives', 'medals', 'continuesLeft', 'continuesUsed', 'deaths'];
  for (const k of nums) if (typeof r[k] !== 'number' || !isFinite(r[k])) return null;
  if (!['easy', 'normal', 'hard'].includes(r.difficulty)) return null;
  return { ...r, time: typeof r.time === 'number' ? r.time : 0 };
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
      d.unlocked = Number.isInteger(o.unlocked) && o.unlocked >= 0 ? o.unlocked : 0;
      const op = o.options || {};
      d.options.sfx = clamp01(op.sfx, DEFAULT_OPTIONS.sfx);
      d.options.music = clamp01(op.music, DEFAULT_OPTIONS.music);
      d.options.difficulty = ['easy', 'normal', 'hard'].includes(op.difficulty) ? op.difficulty : 'normal';
      d.options.shake = op.shake !== false;
      d.options.fx = op.fx === 'low' ? 'low' : 'high';
      d.options.touch = ['auto', 'on', 'off'].includes(op.touch) ? op.touch : 'auto';
      d.scores = (Array.isArray(o.scores) ? o.scores : []).map(sanitizeScore).filter(Boolean);
      d.scores.sort((a, b) => b.score - a.score);
      d.scores.length = Math.min(d.scores.length, MAX_SCORES);
      d.resume = sanitizeResume(o.resume);
      d.cleared = Number.isInteger(o.cleared) && o.cleared > 0 ? Math.min(o.cleared, 999) : 0;
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
    if (levelIndex > this.data.unlocked) {
      this.data.unlocked = levelIndex;
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
    if (score <= 0) return false;
    const s = this.data.scores;
    return s.length < MAX_SCORES || score > s[s.length - 1].score;
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

  setOption(key, value) {
    this.data.options[key] = value;
    this.save();
  }
}
