// A small vertical menu used by every screen: up/down to move, confirm to select, left/right to adjust.

import { drawText } from '../engine/font.js';

export class Menu {
  /**
   * items: [{ label: string | () => string, enabled?: boolean | () => boolean,
   *           onSelect?(), onLeft?(), onRight?() }]
   */
  constructor(items, { x = 240, y = 100, gap = 17, align = 'center', scale = 1 } = {}) {
    this.items = items;
    this.x = x;
    this.y = y;
    this.gap = gap;
    this.align = align;
    this.scale = scale;
    this.index = 0;
    this.t = 0;
    this.index = this.firstEnabled(0, 1);
  }

  enabled(i) {
    const it = this.items[i];
    return typeof it.enabled === 'function' ? it.enabled() : it.enabled !== false;
  }

  /** Find the next enabled index from `from` going in direction `dir` (wraps). */
  firstEnabled(from, dir) {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      const i = (((from + dir * k) % n) + n) % n;
      if (this.enabled(i)) return i;
    }
    return 0;
  }

  label(i) {
    const l = this.items[i].label;
    return typeof l === 'function' ? l() : l;
  }

  update(input, audio, dt = 1 / 60) {
    this.t += dt;
    const pr = input.pressed;
    const sfx = (n) => audio && audio.sfx(n);
    if (pr.down) {
      this.index = this.firstEnabled(this.index + 1, 1);
      sfx('menuMove');
    } else if (pr.up) {
      this.index = this.firstEnabled(this.index - 1, -1);
      sfx('menuMove');
    }
    const it = this.items[this.index];
    if (pr.left && it.onLeft) {
      it.onLeft();
      sfx('menuMove');
    } else if (pr.right && it.onRight) {
      it.onRight();
      sfx('menuMove');
    } else if (pr.confirm && it.onSelect && this.enabled(this.index)) {
      sfx('menuSelect');
      it.onSelect();
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.items.length; i++) {
      const sel = i === this.index;
      const on = this.enabled(i);
      const color = !on ? '#555566' : sel ? '#ffd23a' : '#c8d0e0';
      const text = this.label(i);
      const y = this.y + i * this.gap;
      drawText(ctx, text, this.x, y, color, this.scale, this.align, '#000000');
      if (sel) {
        // pointer to the left of the selection
        const w = text.length * 6 * this.scale;
        const lx = this.align === 'center' ? this.x - w / 2 - 10 : this.x - 10;
        drawText(ctx, '>', lx, y, color, this.scale, 'left', '#000000');
      }
    }
  }
}

/** True when the player wants to leave the current screen. */
export function wantsBack(input) {
  return input.pressed.back || input.pressed.pause;
}
