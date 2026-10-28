// Score: points, the kill combo, and life milestones (20,000 then every 50,000: 70k, 120k, 170k...).
// A milestone at the 6-life cap pays the 5,000 bonus instead (see Run.earnLife).

import { LIVES, SCORE } from './constants.js';

export class ScoreManager {
  /** @param {{earnLife: Function}} run  gets asked for a life each time a milestone is crossed */
  constructor(run, { hi = 0 } = {}) {
    this.run = run;
    this.points = 0;
    this.hi = hi;
    this.milestones = 0; // milestones already paid out
    this.combo = 0;
    this.lastKill = -Infinity;
  }

  /** Points needed for the next life milestone. */
  get nextMilestone() {
    return LIVES.FIRST_EXTRA + this.milestones * LIVES.EXTRA_EVERY;
  }

  reset() {
    this.points = 0;
    this.milestones = 0;
    this.combo = 0;
    this.lastKill = -Infinity;
  }

  /** Current combo multiplier (x1 for a lone kill, +10% per chained kill, up to x2). */
  get multiplier() {
    return Math.min(SCORE.COMBO_MAX, 1 + this.combo * SCORE.COMBO_STEP);
  }

  /**
   * Score a kill at world time `now` (seconds). Kills within a second of each other chain a combo.
   * Returns { points, mult, events } where events lists lives earned along the way.
   */
  addKill(base, now) {
    this.combo = now - this.lastKill <= SCORE.COMBO_WINDOW ? this.combo + 1 : 0;
    this.lastKill = now;
    const mult = this.multiplier;
    const r = this.add(Math.round(base * mult));
    return { ...r, mult };
  }

  /** Add points directly (medals, bonuses). Returns { points, events }. */
  add(n) {
    this.points += n;
    const events = [];
    while (this.points >= this.nextMilestone) {
      this.milestones++;
      events.push(...this.run.earnLife('score'));
    }
    if (this.points > this.hi) this.hi = this.points;
    return { points: n, events };
  }
}
