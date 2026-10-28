// GameOverScene: the "CONTINUE?" countdown. A continue gives a fresh set of lives and restarts
// at the last checkpoint; with none left (or when the timer runs out) the run ends.

import { renderWorld } from '../game/render.js';
import { drawText } from '../engine/font.js';
import { VIEW_W, VIEW_H } from '../game/constants.js';

export const CONTINUE_SECONDS = 10;
const END_SECONDS = 5; // how long the final "GAME OVER" waits before leaving

export class GameOverScene {
  constructor(game, { run, levelIndex = run.levelIndex, world = null } = {}) {
    this.game = game;
    this.music = null;
    this.run = run;
    this.levelIndex = levelIndex;
    this.world = world; // frozen backdrop
    this.canContinue = run.continuesLeft > 0;
    this.t = this.canContinue ? CONTINUE_SECONDS : END_SECONDS;
    this.age = 0;
    this.done = false;
  }

  enter() {
    if (this.game.audio) this.game.audio.sfx('gameover');
  }

  update(dt) {
    if (this.done) return;
    const { input } = this.game;
    this.age += dt;
    this.t -= dt;
    if (this.canContinue && this.age > 0.25 && input.pressed.confirm) {
      this.continueRun();
    } else if (this.t <= 0 || (this.age > 0.5 && input.pressed.back)) {
      this.finish();
    } else if (!this.canContinue && this.age > 1 && input.pressed.confirm) {
      this.finish();
    }
  }

  continueRun() {
    this.done = true;
    this.run.useContinue();
    this.game.go('play', { run: this.run, levelIndex: this.levelIndex, resume: true });
  }

  finish() {
    this.done = true;
    this.game.go('runEnd', { run: this.run });
  }

  /** Whole seconds left on the countdown, for display. */
  get secondsLeft() {
    return Math.max(0, Math.ceil(this.t));
  }

  draw(ctx) {
    if (this.world) renderWorld(ctx, this.world);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    const cx = VIEW_W / 2;
    if (this.canContinue) {
      drawText(ctx, 'CONTINUE?', cx, 70, '#ffffff', 3, 'center', '#7a1c1c');
      drawText(ctx, String(this.secondsLeft), cx, 108, '#ffd54a', 6, 'center', '#000000');
      drawText(ctx, `CONTINUES LEFT ${this.run.continuesLeft}`, cx, 160, '#c8d0e0', 1, 'center');
      drawText(ctx, 'PRESS JUMP OR FIRE', cx, 182, '#ffffff', 1, 'center');
    } else {
      drawText(ctx, 'GAME OVER', cx, 100, '#ff5a4a', 4, 'center', '#000000');
      drawText(ctx, 'NO CONTINUES LEFT', cx, 150, '#c8d0e0', 1, 'center');
    }
  }
}
