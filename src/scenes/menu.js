// Main menu: Start, Continue (when a mid-run save exists), Level Select, Options, Controls, High Scores, Credits.

import { Menu } from '../ui/menu.js';
import { drawBackdrop } from '../ui/backdrop.js';
import { drawText } from '../engine/font.js';
import { VIEW_W } from '../game/constants.js';
import { Run } from '../game/run.js';
import { levelName } from '../game/levels.js';

export class MenuScene {
  constructor(game) {
    this.game = game;
    this.music = 'title';
    this.t = 0;
    const save = game.save;
    this.menu = new Menu(
      [
        { label: 'START', onSelect: () => this.start() },
        {
          label: () => (save.resume ? `CONTINUE ${levelName(save.resume.levelIndex)}` : 'CONTINUE'),
          enabled: () => !!save.resume,
          onSelect: () => this.resume(),
        },
        { label: 'LEVEL SELECT', onSelect: () => game.go('levelselect') },
        { label: 'OPTIONS', onSelect: () => game.go('options', { back: 'menu' }) },
        { label: 'CONTROLS', onSelect: () => game.go('controls') },
        { label: 'HIGH SCORES', onSelect: () => game.go('scores') },
        { label: 'CREDITS', onSelect: () => game.go('credits') },
      ],
      { x: VIEW_W / 2, y: 96, gap: 18 },
    );
    if (save.resume) this.menu.index = 1; // most likely what a returning player wants
  }

  start() {
    const { save } = this.game;
    const run = new Run({ difficulty: save.options.difficulty, hi: save.best });
    this.game.go('play', { run, levelIndex: 0 });
  }

  resume() {
    const { save } = this.game;
    const run = Run.fromJSON(save.resume, { hi: save.best });
    this.game.go('play', { run, levelIndex: run.levelIndex, resume: true, fromSave: true });
  }

  update(dt) {
    this.t += dt;
    this.menu.update(this.game.input, this.game.audio, dt);
    if (this.game.input.pressed.back) this.game.go('title');
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t, { rifts: false });
    drawText(ctx, 'EPOCH STRIKE', VIEW_W / 2, 36, '#ffd23a', 3, 'center', '#7a1c1c');
    this.menu.draw(ctx);
    const d = this.game.save.options.difficulty.toUpperCase();
    const cleared = this.game.save.cleared;
    drawText(ctx, `DIFFICULTY: ${d}${cleared ? `   CLEARED X${cleared}` : ''}`, VIEW_W / 2, 238, '#9aa4b8', 1, 'center', '#000000');
  }
}
