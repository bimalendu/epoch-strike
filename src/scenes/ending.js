// The ending: after the Rift Warlord falls and the last results screen is dismissed, four story pages play over the
// backdrop, then the final tally (with the game-clear bonuses and a rank), then the credits. Bonuses are paid once, when
// the tally opens, so the score the player is asked to enter on the high-score table includes them.

import { drawBackdrop } from '../ui/backdrop.js';
import { drawText } from '../engine/font.js';
import { VIEW_W, VIEW_H } from '../game/constants.js';
import { formatTime } from './results.js';

export const ENDING_BONUS = { CLEAR: 50000, NO_CONTINUE: 25000, NO_DEATH: 100000 };

/** The game-clear bonuses for a finished run. */
export function endingBonus(run) {
  const clear = ENDING_BONUS.CLEAR;
  const noContinue = run.continuesUsed === 0 ? ENDING_BONUS.NO_CONTINUE : 0;
  const noDeath = run.totalDeaths === 0 ? ENDING_BONUS.NO_DEATH : 0;
  return { clear, noContinue, noDeath, total: clear + noContinue + noDeath };
}

/** S: not a single death. A: no continue and at most 15 deaths. B: at most one continue. C: finished. */
export function endingRank(run) {
  if (run.totalDeaths === 0) return 'S';
  if (run.continuesUsed === 0 && run.totalDeaths <= 15) return 'A';
  if (run.continuesUsed <= 1) return 'B';
  return 'C';
}

export const STORY = [
  ['THE RIFT WARLORD FALLS.', '', 'ITS HEART SHATTERS, AND THE RIFT IN THE SKY', 'SHUDDERS AND BEGINS TO CLOSE.'],
  ['ONE BY ONE THE AGES FALL BACK INTO PLACE:', '', 'THE DINOSAURS TO THEIR JUNGLES, THE LEGIONS TO THEIR WALLS,', 'THE SAMURAI, THE PIRATES AND THE SOLDIERS OF EVERY WAR.'],
  ['THE LAST SOLDIER STANDS ALONE AT THE END OF TIME.', '', 'THEN A FLASH OF LIGHT, AND THE QUIET', 'OF AN ORDINARY MORNING.'],
  ['EPOCH STRIKE', '', 'THE END'],
];

const CHARS_PER_SECOND = 38;

export class EndingScene {
  constructor(game, { run }) {
    this.game = game;
    this.music = 'title';
    this.run = run;
    this.page = 0;
    this.typed = 0; // characters of the current page shown so far
    this.stage = 'story'; // 'story' -> 'tally'
    this.t = 0;
    this.tallyT = 0;
    this.shown = 0;
    this.bonus = endingBonus(run);
    this.rank = endingRank(run);
    this.rows = [];
    this.left = false;
  }

  enter() {
    if (this.game.audio) this.game.audio.sfx('clear');
    this.game.save.markCleared();
  }

  get pageText() {
    return STORY[this.page].join('\n');
  }

  get pageLength() {
    return this.pageText.length;
  }

  update(dt) {
    if (this.left) return;
    this.t += dt;
    const pressed = this.game.input.pressed;
    if (this.stage === 'story') {
      this.typed = Math.min(this.pageLength, this.typed + CHARS_PER_SECOND * dt);
      if (pressed.confirm && this.t > 0.3) {
        if (this.typed < this.pageLength) {
          this.typed = this.pageLength;
        } else if (this.page + 1 < STORY.length) {
          this.page++;
          this.typed = 0;
        } else {
          this.openTally();
        }
      }
      return;
    }
    // tally: rows count up one at a time
    this.tallyT += dt;
    const target = Math.min(this.rows.length + 1, Math.floor(this.tallyT / 0.5));
    if (target > this.shown) {
      this.shown = target;
      if (this.game.audio) this.game.audio.sfx('medal');
    }
    if (pressed.confirm && this.tallyT > 0.3) {
      if (this.shown <= this.rows.length) this.shown = this.rows.length + 1;
      else this.finish();
    }
  }

  /** Pay the clear bonuses and set up the final tally. */
  openTally() {
    const { run } = this;
    this.stage = 'tally';
    this.tallyT = 0;
    run.score.add(this.bonus.total);
    this.rows = [
      ['GAME CLEAR BONUS', `+${this.bonus.clear}`],
      ['NO CONTINUE BONUS', this.bonus.noContinue ? `+${this.bonus.noContinue}` : '-'],
      ['NO DEATH BONUS', this.bonus.noDeath ? `+${this.bonus.noDeath}` : '-'],
      ['DEATHS', String(run.totalDeaths)],
      ['CONTINUES USED', String(run.continuesUsed)],
      ['TOTAL TIME', formatTime(run.totalTime)],
      ['DIFFICULTY', run.difficulty.toUpperCase()],
    ];
    if (this.game.audio) this.game.audio.sfx('oneup');
  }

  finish() {
    this.left = true;
    this.game.go('credits', { run: this.run });
  }

  draw(ctx) {
    const cx = VIEW_W / 2;
    if (this.stage === 'story') {
      drawBackdrop(ctx, this.t, { rifts: this.page < 2, horizon: this.page >= 1 });
      const lines = this.pageText.slice(0, Math.floor(this.typed)).split('\n');
      const last = this.page === STORY.length - 1;
      lines.forEach((ln, i) => {
        const big = last && i === 0;
        drawText(ctx, ln, cx, big ? 70 : 84 + i * 14, big ? '#ffd23a' : '#e8ecf8', big ? 4 : 1, 'center', big ? '#7a1c1c' : '#000000');
      });
      if (this.typed >= this.pageLength && Math.floor(this.t * 2) % 2 === 0) drawText(ctx, 'PRESS FIRE', cx, VIEW_H - 24, '#9aa4b8', 1, 'center', '#000000');
      return;
    }
    drawBackdrop(ctx, this.t, { rifts: false, horizon: false });
    drawText(ctx, 'EPOCH STRIKE COMPLETE', cx, 20, '#ffd23a', 2, 'center', '#7a1c1c');
    drawText(ctx, `FINAL SCORE ${String(this.run.score.points).padStart(7, '0')}`, cx, 46, '#ffffff', 1, 'center', '#000000');
    this.rows.forEach((r, i) => {
      if (i >= this.shown) return;
      const y = 68 + i * 16;
      drawText(ctx, r[0], 110, y, '#c8d0e0', 1, 'left', '#000000');
      drawText(ctx, r[1], 370, y, '#ffffff', 1, 'right', '#000000');
    });
    if (this.shown > this.rows.length) {
      drawText(ctx, `RANK ${this.rank}`, cx, 192, this.rank === 'S' ? '#ffd23a' : '#8be9ff', 3, 'center', '#000000');
      if (Math.floor(this.t * 2) % 2 === 0) drawText(ctx, 'PRESS FIRE', cx, 238, '#ffffff', 1, 'center', '#000000');
    }
  }
}
