// Results screen after a level: score, time, medals, deaths and the clear bonuses (2,000 per life left,
// 5,000 for a no-death clear). The bonus is added to the score when the player moves on.

import { drawBackdrop } from '../ui/backdrop.js';
import { drawText } from '../engine/font.js';
import { VIEW_W } from '../game/constants.js';
import { levelCount, levelName } from '../game/levels.js';

export function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class ResultsScene {
  constructor(game, { run, levelIndex, world = null }) {
    this.game = game;
    this.music = null;
    this.run = run;
    this.levelIndex = levelIndex;
    this.world = world;
    this.bonus = run.clearBonus();
    this.rows = [
      ['SCORE', String(run.score.points).padStart(7, '0')],
      ['TIME', formatTime(run.timeThisLevel)],
      ['MEDALS', String(run.medalsThisLevel)],
      ['DEATHS', String(run.deathsThisLevel)],
      [`LIVES LEFT X${run.lives.lives}`, `+${this.bonus.perLife}`],
      ['NO DEATH BONUS', this.bonus.noDeath ? `+${this.bonus.noDeath}` : '-'],
    ];
    this.t = 0;
    this.shown = 0;
    this.left = false;
  }

  enter() {
    if (this.game.audio) this.game.audio.sfx('clear');
  }

  update(dt) {
    this.t += dt;
    const target = Math.min(this.rows.length + 1, Math.floor(this.t / 0.45));
    if (target > this.shown) {
      this.shown = target;
      if (this.game.audio) this.game.audio.sfx('medal');
    }
    if (this.left) return;
    if (this.game.input.pressed.confirm && this.t > 0.25) {
      if (this.shown <= this.rows.length) {
        this.shown = this.rows.length + 1; // skip the count-up
      } else {
        this.next();
      }
    }
  }

  /** Bank the bonus, unlock the next level and move on. */
  next() {
    this.left = true;
    const { run, game } = this;
    const events = run.score.add(this.bonus.total).events;
    if (events.some((e) => e.type === 'life') && game.audio) game.audio.sfx('oneup');
    if (this.world) run.captureLoadout(this.world.player);
    run.totalTime += run.timeThisLevel;
    const idx = this.levelIndex;
    if (run.practice) {
      game.go('levelselect', { god: run.god });
      return;
    }
    if (idx >= 0) game.save.unlock(idx + 1);
    if (idx >= 0 && idx + 1 < levelCount()) {
      game.go('play', { run, levelIndex: idx + 1 });
    } else {
      game.go('ending', { run }); // the last level is clear: story, final tally, credits
    }
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t, { rifts: false, horizon: false });
    const cx = VIEW_W / 2;
    drawText(ctx, 'LEVEL CLEAR', cx, 24, '#ffd23a', 3, 'center', '#7a1c1c');
    drawText(ctx, levelName(this.levelIndex), cx, 56, '#8be9ff', 1, 'center', '#000000');
    this.rows.forEach((r, i) => {
      if (i >= this.shown) return;
      const y = 84 + i * 18;
      drawText(ctx, r[0], 120, y, '#c8d0e0', 1, 'left', '#000000');
      drawText(ctx, r[1], 360, y, '#ffffff', 1, 'right', '#000000');
    });
    if (this.shown > this.rows.length) {
      drawText(ctx, `TOTAL BONUS +${this.bonus.total}`, cx, 204, '#ffd23a', 2, 'center', '#000000');
      if (Math.floor(this.t * 2) % 2 === 0) drawText(ctx, 'PRESS FIRE', cx, 238, '#ffffff', 1, 'center', '#000000');
    }
  }
}
