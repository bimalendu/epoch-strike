// High score table (top 10).

import { drawBackdrop } from '../ui/backdrop.js';
import { drawText } from '../engine/font.js';
import { VIEW_W } from '../game/constants.js';
import { wantsBack } from '../ui/menu.js';
import { levelName } from '../game/levels.js';

export class HighScoresScene {
  /** @param {{highlight?: number}} params  row to flash (the score the player just earned) */
  constructor(game, { highlight = -1 } = {}) {
    this.game = game;
    this.music = 'title';
    this.highlight = highlight;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    const { input, audio } = this.game;
    if (this.t > 0.4 && (wantsBack(input) || input.pressed.confirm)) {
      if (audio) audio.sfx('menuBack');
      this.game.go('menu');
    }
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t, { rifts: false, horizon: false });
    drawText(ctx, 'HIGH SCORES', VIEW_W / 2, 18, '#ffd23a', 3, 'center', '#7a1c1c');
    const scores = this.game.save.scores;
    if (!scores.length) {
      drawText(ctx, 'NO SCORES YET - GO PLAY!', VIEW_W / 2, 120, '#c8d0e0', 1, 'center', '#000000');
    }
    for (let i = 0; i < 10; i++) {
      const y = 56 + i * 16;
      const s = scores[i];
      const flash = i === this.highlight && Math.floor(this.t * 4) % 2 === 0;
      const col = flash ? '#ffffff' : i === 0 ? '#ffd23a' : '#c8d0e0';
      drawText(ctx, `${String(i + 1).padStart(2, ' ')}.`, 92, y, '#6a6a86', 1, 'left', '#000000');
      if (s) {
        drawText(ctx, s.name, 122, y, col, 1, 'left', '#000000');
        drawText(ctx, String(s.score).padStart(8, '0'), 178, y, col, 1, 'left', '#000000');
        drawText(ctx, levelName(s.level - 1).slice(0, 16), 266, y, '#8be9ff', 1, 'left', '#000000');
      } else {
        drawText(ctx, '---', 122, y, '#44445a', 1, 'left');
      }
    }
    drawText(ctx, 'PRESS ANY BUTTON', VIEW_W / 2, 250, '#6a6a86', 1, 'center');
  }
}
