// Initials entry for a score that made the top 10.

import { drawBackdrop } from '../ui/backdrop.js';
import { drawText } from '../engine/font.js';
import { VIEW_W } from '../game/constants.js';
import { levelCount } from '../game/levels.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class NameEntryScene {
  constructor(game, { run }) {
    this.game = game;
    this.music = 'title';
    this.run = run;
    this.letters = [0, 0, 0];
    this.pos = 0;
    this.t = 0;
    this.done = false;
  }

  get name() {
    return this.letters.map((i) => ALPHABET[i]).join('');
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    const pr = this.game.input.pressed;
    const sfx = (n) => this.game.audio && this.game.audio.sfx(n);
    const n = ALPHABET.length;
    if (pr.up) {
      this.letters[this.pos] = (this.letters[this.pos] + 1) % n;
      sfx('menuMove');
    } else if (pr.down) {
      this.letters[this.pos] = (this.letters[this.pos] + n - 1) % n;
      sfx('menuMove');
    } else if (pr.right) {
      this.pos = Math.min(2, this.pos + 1);
      sfx('menuMove');
    } else if (pr.left) {
      this.pos = Math.max(0, this.pos - 1);
      sfx('menuMove');
    } else if (this.t > 0.3 && pr.confirm) {
      if (this.pos < 2) {
        this.pos++;
        sfx('menuMove');
      } else {
        this.accept();
      }
    } else if (pr.back && this.pos > 0) {
      this.pos--;
    }
  }

  accept() {
    this.done = true;
    const { save } = this.game;
    const level = Math.max(1, this.run.levelIndex + 1);
    const rank = save.addScore(this.name, this.run.score.points, level);
    if (this.game.audio) this.game.audio.sfx('menuSelect');
    this.game.go('scores', { highlight: rank });
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t, { rifts: false, horizon: false });
    const cx = VIEW_W / 2;
    drawText(ctx, 'NEW HIGH SCORE!', cx, 40, '#ffd23a', 3, 'center', '#7a1c1c');
    drawText(ctx, String(this.run.score.points).padStart(7, '0'), cx, 84, '#ffffff', 3, 'center', '#000000');
    drawText(ctx, 'ENTER YOUR INITIALS', cx, 124, '#c8d0e0', 1, 'center', '#000000');
    for (let i = 0; i < 3; i++) {
      const x = cx - 40 + i * 40;
      const cur = i === this.pos;
      drawText(ctx, ALPHABET[this.letters[i]], x, 150, cur ? '#ffd23a' : '#ffffff', 4, 'center', '#000000');
      ctx.fillStyle = cur && Math.floor(this.t * 3) % 2 === 0 ? '#ffd23a' : '#555566';
      ctx.fillRect(x - 12, 182, 24, 3);
    }
    drawText(ctx, 'UP/DOWN LETTER  LEFT/RIGHT MOVE  FIRE OK', cx, 226, '#6a6a86', 1, 'center');
  }
}
