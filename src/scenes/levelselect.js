// Level select: practice any unlocked level. Practice runs never touch scores or the mid-run save.
// In god mode (the hidden developer entry) every level is open and the runs are invincible.

import { Menu, wantsBack } from '../ui/menu.js';
import { drawBackdrop } from '../ui/backdrop.js';
import { drawText } from '../engine/font.js';
import { VIEW_W } from '../game/constants.js';
import { Run } from '../game/run.js';
import { levelCount, levelName } from '../game/levels.js';

export class LevelSelectScene {
  constructor(game, { god = false } = {}) {
    this.game = game;
    this.god = god;
    this.music = 'title';
    this.t = 0;
    const { save } = game;
    const n = levelCount();
    const open = (i) => god || i <= save.unlocked;
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push({
        label: () => `${String(i + 1).padStart(2, '0')} ${open(i) ? levelName(i) : '???'}`,
        enabled: () => open(i),
        onSelect: () => this.play(i),
      });
    }
    items.push({ label: 'BACK', onSelect: () => game.go('menu') });
    // long lists scroll: show a window of 9 rows
    this.items = items;
    this.menu = new Menu(items, { x: VIEW_W / 2, y: 60, gap: 16 });
  }

  play(levelIndex) {
    const { save } = this.game;
    const run = new Run({ difficulty: save.options.difficulty, hi: save.best, practice: true, god: this.god, levelIndex });
    this.game.go('play', { run, levelIndex });
  }

  update(dt) {
    this.t += dt;
    this.menu.update(this.game.input, this.game.audio, dt);
    if (wantsBack(this.game.input)) this.game.go('menu');
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t, { rifts: false, horizon: false });
    drawText(ctx, this.god ? 'GOD MODE' : 'LEVEL SELECT', VIEW_W / 2, 20, '#ffd23a', 3, 'center', '#7a1c1c');
    // scroll window
    const rows = 10;
    const m = this.menu;
    const start = Math.max(0, Math.min(m.items.length - rows, m.index - Math.floor(rows / 2)));
    const view = new Menu(m.items.slice(start, start + rows), { x: VIEW_W / 2, y: 52, gap: 17 });
    view.index = m.index - start;
    view.t = m.t;
    view.draw(ctx);
    drawText(ctx, this.god ? 'INVINCIBLE PRACTICE: SCORES DO NOT COUNT' : 'PRACTICE: SCORES DO NOT COUNT', VIEW_W / 2, 250, '#6a6a86', 1, 'center');
  }
}
