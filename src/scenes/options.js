// Options: volumes, difficulty, screen shake. Opened from the main menu and from the pause menu.

import { Menu, wantsBack } from '../ui/menu.js';
import { drawBackdrop } from '../ui/backdrop.js';
import { drawText } from '../engine/font.js';
import { VIEW_W } from '../game/constants.js';

const DIFFS = ['easy', 'normal', 'hard'];
const DIFF_NOTE = {
  easy: '5 LIVES, SLOWER BULLETS',
  normal: '3 LIVES, AS DESIGNED',
  hard: '3 LIVES, FASTER BULLETS, NO MEDALS',
};

function bar(v) {
  const n = Math.round(v * 10);
  return `[${'#'.repeat(n)}${'-'.repeat(10 - n)}]`;
}

export class OptionsScene {
  /** @param {{back?: string, onClose?: Function}} params  route to return to, or a custom callback */
  constructor(game, { back = 'menu', onClose = null } = {}) {
    this.game = game;
    this.back = back;
    this.onClose = onClose;
    this.t = 0;
    const save = game.save;
    const applyVolumes = () => game.applyVolumes();
    const step = (key, d) => () => {
      const v = Math.round((save.options[key] + d) * 10) / 10;
      save.setOption(key, Math.min(1, Math.max(0, v)));
      applyVolumes();
      if (key === 'sfx' && game.audio) game.audio.sfx('shoot');
    };
    const cycleDiff = (d) => () => {
      const i = DIFFS.indexOf(save.options.difficulty);
      save.setOption('difficulty', DIFFS[(i + d + DIFFS.length) % DIFFS.length]);
    };
    const TOUCH = ['auto', 'on', 'off'];
    const cycleTouch = (d) => () => {
      const i = TOUCH.indexOf(save.options.touch);
      const mode = TOUCH[(i + d + TOUCH.length) % TOUCH.length];
      save.setOption('touch', mode);
      if (game.input.setTouchMode) game.input.setTouchMode(mode);
    };
    const toggleFx = () => save.setOption('fx', save.options.fx === 'low' ? 'high' : 'low');
    this.menu = new Menu(
      [
        { label: () => `SFX    ${bar(save.options.sfx)}`, onLeft: step('sfx', -0.1), onRight: step('sfx', 0.1) },
        { label: () => `MUSIC  ${bar(save.options.music)}`, onLeft: step('music', -0.1), onRight: step('music', 0.1) },
        {
          label: () => `DIFFICULTY  ${save.options.difficulty.toUpperCase()}`,
          onLeft: cycleDiff(-1),
          onRight: cycleDiff(1),
          onSelect: cycleDiff(1),
        },
        {
          label: () => `SCREEN SHAKE  ${save.options.shake ? 'ON' : 'OFF'}`,
          onLeft: () => save.setOption('shake', !save.options.shake),
          onRight: () => save.setOption('shake', !save.options.shake),
          onSelect: () => save.setOption('shake', !save.options.shake),
        },
        { label: () => `EFFECTS  ${save.options.fx.toUpperCase()}`, onLeft: toggleFx, onRight: toggleFx, onSelect: toggleFx },
        { label: () => `TOUCH BUTTONS  ${save.options.touch.toUpperCase()}`, onLeft: cycleTouch(-1), onRight: cycleTouch(1), onSelect: cycleTouch(1) },
        { label: 'BACK', onSelect: () => this.close() },
      ],
      { x: VIEW_W / 2, y: 66, gap: 17 },
    );
  }

  close() {
    if (this.onClose) this.onClose();
    else this.game.go(this.back);
  }

  update(dt) {
    this.t += dt;
    this.menu.update(this.game.input, this.game.audio, dt);
    if (wantsBack(this.game.input)) this.close();
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t, { rifts: false });
    drawText(ctx, 'OPTIONS', VIEW_W / 2, 36, '#ffd23a', 3, 'center', '#7a1c1c');
    this.menu.draw(ctx);
    const d = this.game.save.options.difficulty;
    drawText(ctx, DIFF_NOTE[d], VIEW_W / 2, 200, '#9aa4b8', 1, 'center', '#000000');
    drawText(ctx, 'DIFFICULTY AND EFFECTS APPLY TO NEW RUNS', VIEW_W / 2, 214, '#6a6a86', 1, 'center');
    drawText(ctx, 'F FULLSCREEN   M MUTE', VIEW_W / 2, 242, '#6a6a86', 1, 'center');
  }
}
