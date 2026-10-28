// Main menu: Start, Continue (when a mid-run save exists), Level Select, Options, Controls, High Scores, Credits.
// LEFT RIGHT LEFT RIGHT BOMB reveals (or hides again) the developer's GOD MODE entry for the rest of the session.

import { Menu } from '../ui/menu.js';
import { ComboTracker, GOD_COMBO } from '../ui/combo.js';
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
    this.combo = new ComboTracker(GOD_COMBO);
    this.godFlash = 0; // seconds of blinking left after GOD MODE is revealed
    this.menu = this.buildMenu();
    if (game.save.resume) this.menu.index = 1; // most likely what a returning player wants
  }

  buildMenu() {
    const { game } = this;
    const save = game.save;
    const items = [
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
    ];
    if (game.godMenu) {
      const blink = () => (this.godFlash > 0 && Math.floor(this.godFlash * 8) % 2 === 0 ? '#ffffff' : '#ff5a4a');
      items.splice(3, 0, { label: 'GOD MODE', color: blink, onSelect: () => game.go('levelselect', { god: true }) });
    }
    return new Menu(items, { x: VIEW_W / 2, y: 96, gap: 18 });
  }

  /** The developer sequence was typed: show or hide GOD MODE, keeping the cursor on the same entry. */
  toggleGod() {
    const { game } = this;
    const kept = this.menu.label(this.menu.index);
    game.godMenu = !game.godMenu;
    this.menu = this.buildMenu();
    const i = this.menu.items.findIndex((_, k) => this.menu.label(k) === kept);
    if (i >= 0) this.menu.index = i;
    this.godFlash = game.godMenu ? 1.5 : 0;
    if (game.audio) game.audio.sfx(game.godMenu ? 'oneup' : 'menuBack');
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
    this.godFlash = Math.max(0, this.godFlash - dt);
    if (this.combo.update(this.game.input, dt)) this.toggleGod();
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
