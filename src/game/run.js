// A Run is one playthrough: the state that survives from level to level.

import { LIVES, SCORE, PICKUP_RULES } from './constants.js';
import { LivesManager } from './lives.js';
import { ScoreManager } from './score.js';

export function defaultLoadout() {
  return { slots: ['rifle', null], slot: 0, bombs: PICKUP_RULES.START_BOMBS };
}

export class Run {
  constructor({ difficulty = 'normal', levelIndex = 0, hi = 0, practice = false } = {}) {
    this.difficulty = difficulty;
    this.lives = new LivesManager({ difficulty });
    this.score = new ScoreManager(this, { hi });
    this.continuesLeft = LIVES.CONTINUES;
    this.continuesUsed = 0;
    this.levelIndex = levelIndex;
    this.checkpoint = null; // { levelIndex, x, y } of the last checkpoint reached on this level
    this.loadout = defaultLoadout(); // weapons and bombs carried into the next level
    this.deathsThisLevel = 0;
    this.totalDeaths = 0;
    this.medalsThisLevel = 0;
    this.timeThisLevel = 0;
    this.totalTime = 0;
    this.practice = practice; // level-select practice runs don't count for scores
    this.startedAt = Date.now();
  }

  startLevel(index) {
    this.levelIndex = index;
    this.checkpoint = null;
    this.deathsThisLevel = 0;
    this.medalsThisLevel = 0;
    this.timeThisLevel = 0;
  }

  /** The checkpoint to resume from on this level, or null for the level start. */
  resumePoint(index) {
    return this.checkpoint && this.checkpoint.levelIndex === index ? this.checkpoint : null;
  }

  _lifeEvents(r, source) {
    if (r.gained) return [{ type: 'life', source }];
    return [{ type: 'cap', bonus: r.bonus, source }, ...this.score.add(r.bonus).events];
  }

  /**
   * Try to give the player a life. At the 6-life cap no life is added; 5,000 points are paid instead.
   * Returns scene events: { type: 'life', source } or { type: 'cap', bonus } (plus any milestone lives
   * those bonus points trigger).
   */
  earnLife(source) {
    return this._lifeEvents(this.lives.addLife(), source);
  }

  /** A medal: 500 points, and every 10th is worth a life. */
  collectMedal() {
    this.medalsThisLevel++;
    const events = [...this.score.add(SCORE.MEDAL).events];
    const r = this.lives.addMedal();
    if (r) events.push(...this._lifeEvents(r, 'medal'));
    return events;
  }

  /** The hidden 1UP heart. */
  collectOneUp() {
    return this.earnLife('1up');
  }

  /** Remember what the player is carrying so the next level starts with it. */
  captureLoadout(player) {
    this.loadout = player.loadout();
  }

  /** Spend a continue: fresh lives, score back to 0, restart from the last checkpoint. */
  useContinue() {
    if (this.continuesLeft <= 0) return false;
    this.continuesLeft--;
    this.continuesUsed++;
    this.lives.reset();
    this.score.reset();
    this.loadout = defaultLoadout();
    return true;
  }

  /** Bonus points for clearing a level: 2,000 per life left, plus 5,000 for a no-death clear. */
  clearBonus() {
    const perLife = this.lives.lives * SCORE.LEVEL_CLEAR_PER_LIFE;
    const noDeath = this.deathsThisLevel === 0 ? SCORE.NO_DEATH_CLEAR : 0;
    return { perLife, noDeath, total: perLife + noDeath };
  }

  /** A plain-data snapshot for the mid-run save (taken at the start of each level). */
  toJSON() {
    return {
      difficulty: this.difficulty,
      levelIndex: this.levelIndex,
      score: this.score.points,
      milestones: this.score.milestones,
      lives: this.lives.lives,
      medals: this.lives.medals,
      continuesLeft: this.continuesLeft,
      continuesUsed: this.continuesUsed,
      deaths: this.totalDeaths,
      time: Math.round(this.totalTime),
      loadout: this.loadout,
    };
  }

  static fromJSON(o, { hi = 0 } = {}) {
    const run = new Run({ difficulty: o.difficulty, levelIndex: o.levelIndex, hi });
    run.restore(o);
    return run;
  }

  /** Put this run back to a snapshot (used by resume and Restart Level). */
  restore(o) {
    this.difficulty = o.difficulty;
    this.levelIndex = o.levelIndex;
    this.score.points = o.score;
    this.score.milestones = o.milestones;
    this.score.combo = 0;
    this.score.lastKill = -Infinity;
    this.lives.lives = o.lives;
    this.lives.medals = o.medals;
    this.continuesLeft = o.continuesLeft;
    this.continuesUsed = o.continuesUsed;
    this.totalDeaths = o.deaths;
    this.totalTime = o.time || 0;
    this.loadout = { slots: [...o.loadout.slots], slot: o.loadout.slot, bombs: o.loadout.bombs };
    this.checkpoint = null;
  }
}
