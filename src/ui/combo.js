// Detects a short sequence of logical actions (a cheat code) typed on a menu. Pure: it reads `input.pressed` and nothing else.

import { ACTIONS } from '../engine/input.js';

/** The developer sequence on the main menu that reveals or hides GOD MODE. */
export const GOD_COMBO = ['left', 'right', 'left', 'right', 'bomb'];

export class ComboTracker {
  /**
   * @param {string[]} seq the actions to press in order
   * @param {{window?: number}} opts the most seconds allowed between two presses
   */
  constructor(seq, { window = 1.5 } = {}) {
    this.seq = seq;
    this.window = window;
    this.step = 0; // how many actions of the sequence have been matched
    this.idle = 0; // seconds since the last press
  }

  /** Call once per frame. Returns true on the frame the sequence is completed (then starts over). */
  update(input, dt) {
    this.idle += dt;
    if (this.step > 0 && this.idle > this.window) this.step = 0;
    for (const a of ACTIONS) {
      if (!input.pressed[a]) continue;
      this.idle = 0;
      if (a === this.seq[this.step]) this.step++;
      else this.step = a === this.seq[0] ? 1 : 0;
      if (this.step === this.seq.length) {
        this.step = 0;
        return true;
      }
    }
    return false;
  }
}
