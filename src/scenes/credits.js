// The credits roll. Reached from the ending (then on to the high-score entry) and from the main menu. Everything in the
// game is made by code from free parts, and the credits say so.

import { drawBackdrop } from '../ui/backdrop.js';
import { drawText } from '../engine/font.js';
import { VIEW_W, VIEW_H } from '../game/constants.js';
import { LEVEL_DEFS, levelName } from '../game/levels.js';
import { BOSSES } from '../game/bosses.js';

/** The boss of each level, in level order (a test keeps this in step with the level scripts). */
export const BOSS_ORDER = ['trex', 'golem', 'mammoth', 'bear', 'sphinx', 'colossus', 'champion', 'dragonkite', 'kraken', 'siegetower', 'oni', 'ghostgalleon', 'locomotive', 'furnace', 'zeppelin', 'supertank', 'silomech', 'gunship', 'hydra', 'warlord'];

const LINE = 12;

/** The scrolling script: { k: 'title' | 'head' | 'text' | 'dim' | 'gap', s }. */
export function creditsScript() {
  const out = [];
  const add = (k, s = '') => out.push({ k, s });
  add('title', 'EPOCH STRIKE');
  add('dim', 'A JOURNEY THROUGH 20 AGES OF EARTH');
  add('gap');
  add('head', 'DESIGN AND CODE');
  add('text', 'BUILT WITH CLAUDE CODE');
  add('gap');
  add('head', 'ART');
  add('text', 'EVERY SPRITE, TILE AND BACKDROP');
  add('text', 'IS DRAWN BY CODE');
  add('gap');
  add('head', 'MUSIC AND SOUND');
  add('text', 'SYNTHESISED LIVE IN THE BROWSER');
  add('text', 'FROM PATTERNS OF NOTES');
  add('gap');
  add('head', 'TECHNOLOGY');
  add('text', 'PLAIN HTML5 CANVAS AND JAVASCRIPT');
  add('text', 'NO LIBRARIES. NO DOWNLOADED ASSETS');
  add('text', 'ONLY FREE TOOLS WERE USED');
  add('gap');
  add('head', 'THE AGES AND THEIR GUARDIANS');
  LEVEL_DEFS.forEach((d, i) => {
    add('dim', `LEVEL ${i + 1}`);
    add('text', levelName(i));
    const boss = BOSSES[BOSS_ORDER[i]];
    if (boss) add('text', boss.name);
    add('gap');
  });
  add('head', 'WEAPONS OF THE AGES');
  add('text', 'FIRE SPEAR  BALLISTA BOLT  CROSSBOW VOLLEY');
  add('text', 'TESLA COIL  PLASMA CANNON');
  add('gap');
  add('head', 'THANK YOU FOR PLAYING');
  add('gap');
  add('title', 'THE END');
  return out;
}

export class CreditsScene {
  /** @param {{run?: Run}} params  a finished run goes on to the high-score entry; no run goes back to the menu */
  constructor(game, { run = null } = {}) {
    this.game = game;
    this.music = 'title';
    this.run = run;
    this.script = creditsScript();
    this.scroll = 0;
    this.t = 0;
    this.left = false;
    // the whole script, laid out top to bottom
    this.height = this.script.reduce((h, l) => h + (l.k === 'title' ? 34 : l.k === 'head' ? 22 : l.k === 'gap' ? 14 : LINE), 0);
    this.endAt = this.height + 40; // scroll position at which "THE END" has risen to the middle of the screen
  }

  get finished() {
    return this.scroll >= this.endAt - VIEW_H / 2;
  }

  update(dt) {
    if (this.left) return;
    this.t += dt;
    const { input } = this.game;
    const speed = input.held.fire || input.held.down || input.held.confirm ? 96 : 26;
    if (!this.finished) this.scroll += speed * dt;
    if (this.t > 0.5 && (input.pressed.back || (this.finished && input.pressed.confirm))) this.leave();
    if (this.finished && this.t > 0.5 && !this.waitFrom) this.waitFrom = this.t;
    if (this.waitFrom && this.t - this.waitFrom > 12) this.leave();
  }

  leave() {
    this.left = true;
    if (this.game.audio) this.game.audio.sfx('menuBack');
    if (this.run) this.game.go('runEnd', { run: this.run });
    else this.game.go('menu');
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t, { rifts: false, horizon: false });
    const cx = VIEW_W / 2;
    let y = VIEW_H + 8 - this.scroll;
    for (const l of this.script) {
      const h = l.k === 'title' ? 34 : l.k === 'head' ? 22 : l.k === 'gap' ? 14 : LINE;
      if (y > -40 && y < VIEW_H + 8) {
        if (l.k === 'title') drawText(ctx, l.s, cx, y, '#ffd23a', 3, 'center', '#7a1c1c');
        else if (l.k === 'head') drawText(ctx, l.s, cx, y, '#8be9ff', 2, 'center', '#000000');
        else if (l.k === 'text') drawText(ctx, l.s, cx, y, '#ffffff', 1, 'center', '#000000');
        else if (l.k === 'dim') drawText(ctx, l.s, cx, y, '#9aa4b8', 1, 'center', '#000000');
      }
      y += h;
    }
    if (this.finished && Math.floor(this.t * 2) % 2 === 0) drawText(ctx, 'PRESS FIRE', cx, VIEW_H - 18, '#ffffff', 1, 'center', '#000000');
    else if (!this.finished) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, VIEW_H - 14, VIEW_W, 14);
      drawText(ctx, 'HOLD FIRE TO SPEED UP    BACK TO SKIP', cx, VIEW_H - 11, '#6a6a86', 1, 'center');
    }
  }
}
