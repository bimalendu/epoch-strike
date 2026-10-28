// Title screen: logo over the animated backdrop; any confirm goes to the main menu.

import { drawBackdrop } from '../ui/backdrop.js';
import { drawText } from '../engine/font.js';
import { VIEW_W, VIEW_H } from '../game/constants.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.music = 'title';
  }

  update(dt) {
    this.t += dt;
    if (this.game.input.pressed.confirm && this.t > 0.2) {
      if (this.game.audio) this.game.audio.sfx('menuSelect');
      this.game.go('menu');
    }
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t);
    const cx = VIEW_W / 2;
    drawText(ctx, 'EPOCH', cx, 56, '#ffd23a', 6, 'center', '#7a1c1c');
    drawText(ctx, 'STRIKE', cx, 102, '#ff5a4a', 6, 'center', '#3a0c0c');
    drawText(ctx, 'ONE SOLDIER. TWENTY ERAS.', cx, 150, '#c8d0e0', 1, 'center', '#000000');
    if (Math.floor(this.t * 2) % 2 === 0) drawText(ctx, 'PRESS FIRE OR ENTER', cx, 178, '#ffffff', 1, 'center', '#000000');
    const best = this.game.save.best;
    if (best > 0) drawText(ctx, `BEST ${String(best).padStart(7, '0')}`, cx, 196, '#9aa4b8', 1, 'center', '#000000');
    drawText(ctx, 'FREE AND OPEN SOURCE', cx, VIEW_H - 12, '#6a6a86', 1, 'center');
  }
}
