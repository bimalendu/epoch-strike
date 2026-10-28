// Toasts: short banners that slide down under the score ("CHECKPOINT", "LAST LIFE"). One at a time, a small queue behind it.

import { drawText } from '../engine/font.js';
import { VIEW_W } from '../game/constants.js';

const IN = 0.2; // seconds sliding in
const OUT = 0.25; // seconds fading out
const MAX_QUEUE = 3;

export class Toasts {
  constructor() {
    this.cur = null; // { text, color, big, t, hold }
    this.queue = [];
  }

  /** Queue a banner. A text that is already showing or waiting is not added twice. */
  push(text, { color = '#ffffff', big = false, hold = 1.3 } = {}) {
    if ((this.cur && this.cur.text === text) || this.queue.some((q) => q.text === text)) return;
    if (this.queue.length >= MAX_QUEUE) this.queue.shift();
    this.queue.push({ text, color, big, t: 0, hold });
  }

  update(dt) {
    if (!this.cur && this.queue.length) this.cur = this.queue.shift();
    const c = this.cur;
    if (!c) return;
    c.t += dt;
    if (c.t >= IN + c.hold + OUT) this.cur = null;
  }

  /** 0..1 slide-in/fade-out progress of the toast on screen. */
  get visible() {
    const c = this.cur;
    if (!c) return 0;
    if (c.t < IN) return c.t / IN;
    return c.t < IN + c.hold ? 1 : Math.max(0, 1 - (c.t - IN - c.hold) / OUT);
  }

  /** `y` is where the banner rests; it slides down into place from a few pixels above. */
  draw(ctx, y) {
    const c = this.cur;
    if (!c) return;
    const a = this.visible;
    const scale = c.big ? 2 : 1;
    const w = c.text.length * 6 * scale + 14;
    const h = 7 * scale + 8;
    const ease = 1 - (1 - Math.min(1, c.t / IN)) ** 2;
    const top = Math.round(y - 12 * (1 - ease));
    ctx.globalAlpha = 0.6 * a;
    ctx.fillStyle = '#000000';
    ctx.fillRect(Math.round((VIEW_W - w) / 2), top, w, h);
    ctx.globalAlpha = a;
    ctx.fillStyle = c.color;
    ctx.fillRect(Math.round((VIEW_W - w) / 2), top, w, 1);
    drawText(ctx, c.text, VIEW_W / 2, top + 4, c.color, scale, 'center', '#000000');
    ctx.globalAlpha = 1;
  }
}
