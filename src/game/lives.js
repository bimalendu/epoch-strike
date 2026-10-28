// Lives rules (from the design plan): start with 3 (Easy: 5), never more than 6.
// A life earned at the cap converts to bonus points instead, so earning stays rewarding.

import { LIVES } from './constants.js';

export class LivesManager {
  constructor({ difficulty = 'normal' } = {}) {
    this.difficulty = difficulty;
    this.max = LIVES.MAX;
    this.startLives = LIVES.START[difficulty] ?? LIVES.START.normal;
    this.lives = this.startLives;
    this.medals = 0;
    this.livesGained = 0;
  }

  /** Back to the starting state (used by Continue). */
  reset() {
    this.lives = this.startLives;
    this.medals = 0;
  }

  /**
   * Try to add one life.
   * Returns { gained, capped, bonus }: at the cap no life is added and `bonus` points are due.
   */
  addLife() {
    if (this.lives >= this.max) return { gained: false, capped: true, bonus: LIVES.CAP_BONUS };
    this.lives++;
    this.livesGained++;
    return { gained: true, capped: false, bonus: 0 };
  }

  /** Lose a life (called when the player dies). Returns the lives remaining. */
  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    return this.lives;
  }

  /** Collect a medal; every 10th medal is worth a life. Returns the addLife() result or null. */
  addMedal() {
    this.medals++;
    if (this.medals % LIVES.MEDALS_PER_LIFE === 0) return this.addLife();
    return null;
  }

  get medalProgress() {
    return this.medals % LIVES.MEDALS_PER_LIFE;
  }

  get empty() {
    return this.lives <= 0;
  }
}
