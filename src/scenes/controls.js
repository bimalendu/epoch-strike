// Controls reference screen.

import { drawBackdrop } from '../ui/backdrop.js';
import { drawText } from '../engine/font.js';
import { VIEW_W } from '../game/constants.js';
import { wantsBack } from '../ui/menu.js';

export const CONTROLS = [
  ['MOVE', 'ARROWS / WASD', 'D-PAD / STICK'],
  ['JUMP', 'Z / SPACE', 'A'],
  ['FIRE (HOLD)', 'X / J', 'X / RT'],
  ['SWITCH WEAPON', 'C / K', 'Y / LB'],
  ['SMART BOMB', 'V / L', 'B'],
  ['PAUSE', 'ESC / P', 'START'],
  ['DROP DOWN', 'DOWN + JUMP', 'DOWN + A'],
  ['PRONE', 'DOWN', 'DOWN'],
  ['AIM 8 WAYS', 'HOLD DIRECTIONS', 'HOLD DIRECTIONS'],
];

export class ControlsScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    const { input, audio } = this.game;
    if (wantsBack(input) || input.pressed.confirm) {
      if (audio) audio.sfx('menuBack');
      this.game.go('menu');
    }
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t, { rifts: false, horizon: false });
    drawText(ctx, 'CONTROLS', VIEW_W / 2, 20, '#ffd23a', 3, 'center', '#7a1c1c');
    drawText(ctx, 'KEYBOARD', 214, 58, '#9aa4b8', 1, 'left');
    drawText(ctx, 'GAMEPAD', 346, 58, '#9aa4b8', 1, 'left');
    CONTROLS.forEach((r, i) => {
      const y = 72 + i * 15;
      drawText(ctx, r[0], 40, y, '#ffffff', 1, 'left', '#000000');
      drawText(ctx, r[1], 214, y, '#ffd23a', 1, 'left', '#000000');
      drawText(ctx, r[2], 346, y, '#8be9ff', 1, 'left', '#000000');
    });
    drawText(ctx, 'F FULLSCREEN   M MUTE   THE GAME PAUSES WHEN YOU LEAVE THE WINDOW', VIEW_W / 2, 216, '#9aa4b8', 1, 'center');
    drawText(ctx, 'TOUCH: ON-SCREEN STICK AND BUTTONS APPEAR ON PHONES', VIEW_W / 2, 230, '#9aa4b8', 1, 'center');
    drawText(ctx, 'PRESS ANY BUTTON TO GO BACK', VIEW_W / 2, 250, '#6a6a86', 1, 'center');
  }
}
