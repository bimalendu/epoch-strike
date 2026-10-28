// Minimal software implementation of the Canvas 2D subset the game uses.
// Lets tests and `npm run shots` render real frames in Node (no browser, no dependencies).
// Supported: fillStyle (#rgb, #rrggbb, rgb(), rgba()), globalAlpha, fillRect, clearRect,
// drawImage (3/5/9 args), save/restore, translate, scale. Everything else is a harmless no-op.

import { setCanvasFactory } from '../src/engine/gfx.js';

function parseColor(v) {
  if (typeof v !== 'string') return [0, 0, 0, 1];
  if (v[0] === '#') {
    let h = v.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s));
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? p[3] : 1];
  }
  return [0, 0, 0, 1];
}

class SoftCtx {
  constructor(canvas) {
    this.canvas = canvas;
    this._fs = '#000000';
    this._rgba = [0, 0, 0, 1];
    this.globalAlpha = 1;
    this.imageSmoothingEnabled = false;
    this.m = { sx: 1, sy: 1, tx: 0, ty: 0 };
    this.stack = [];
  }

  set fillStyle(v) {
    this._fs = v;
    this._rgba = parseColor(v);
  }
  get fillStyle() {
    return this._fs;
  }

  save() {
    this.stack.push({ m: { ...this.m }, a: this.globalAlpha, fs: this._fs });
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    this.m = s.m;
    this.globalAlpha = s.a;
    this.fillStyle = s.fs;
  }
  translate(x, y) {
    this.m.tx += this.m.sx * x;
    this.m.ty += this.m.sy * y;
  }
  scale(x, y) {
    this.m.sx *= x;
    this.m.sy *= y;
  }

  _blend(i, r, g, b, a) {
    const d = this.canvas.data;
    if (a >= 1) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      return;
    }
    if (a <= 0) return;
    const da = d[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    d[i] = (r * a + d[i] * da * (1 - a)) / oa;
    d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa;
    d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }

  fillRect(x, y, w, h) {
    const m = this.m;
    let x0 = Math.round(m.tx + m.sx * x), x1 = Math.round(m.tx + m.sx * (x + w));
    let y0 = Math.round(m.ty + m.sy * y), y1 = Math.round(m.ty + m.sy * (y + h));
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    x1 = Math.min(this.canvas.width, x1); y1 = Math.min(this.canvas.height, y1);
    const [r, g, b, ca] = this._rgba;
    const a = ca * this.globalAlpha;
    const W = this.canvas.width;
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) this._blend((py * W + px) * 4, r, g, b, a);
    }
  }

  clearRect(x, y, w, h) {
    const m = this.m;
    let x0 = Math.round(m.tx + m.sx * x), x1 = Math.round(m.tx + m.sx * (x + w));
    let y0 = Math.round(m.ty + m.sy * y), y1 = Math.round(m.ty + m.sy * (y + h));
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    x1 = Math.min(this.canvas.width, x1); y1 = Math.min(this.canvas.height, y1);
    const W = this.canvas.width;
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * W + px) * 4;
        this.canvas.data[i] = this.canvas.data[i + 1] = this.canvas.data[i + 2] = this.canvas.data[i + 3] = 0;
      }
    }
  }

  drawImage(img, a, b, c, d, e, f, g, h) {
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
    if (arguments.length <= 3) { dx = a; dy = b; dw = img.width; dh = img.height; }
    else if (arguments.length <= 5) { dx = a; dy = b; dw = c; dh = d; }
    else { sx = a; sy = b; sw = c; sh = d; dx = e; dy = f; dw = g; dh = h; }
    const m = this.m;
    let x0 = Math.round(m.tx + m.sx * dx), x1 = Math.round(m.tx + m.sx * (dx + dw));
    let y0 = Math.round(m.ty + m.sy * dy), y1 = Math.round(m.ty + m.sy * (dy + dh));
    const flipX = x0 > x1, flipY = y0 > y1;
    if (flipX) [x0, x1] = [x1, x0];
    if (flipY) [y0, y1] = [y1, y0];
    const tw = x1 - x0, th = y1 - y0;
    if (tw <= 0 || th <= 0) return;
    const src = img.data, SW = img.width, W = this.canvas.width;
    const ga = this.globalAlpha;
    for (let py = Math.max(0, y0); py < Math.min(this.canvas.height, y1); py++) {
      let v = (py - y0 + 0.5) / th;
      if (flipY) v = 1 - v;
      const srow = Math.min(img.height - 1, Math.max(0, sy + Math.floor(v * sh)));
      for (let px = Math.max(0, x0); px < Math.min(W, x1); px++) {
        let u = (px - x0 + 0.5) / tw;
        if (flipX) u = 1 - u;
        const scol = Math.min(SW - 1, Math.max(0, sx + Math.floor(u * sw)));
        const si = (srow * SW + scol) * 4;
        const sa = (src[si + 3] / 255) * ga;
        if (sa > 0) this._blend((py * W + px) * 4, src[si], src[si + 1], src[si + 2], sa);
      }
    }
  }

  // harmless no-ops for anything else a caller might touch
  beginPath() {}
  closePath() {}
  rect() {}
  clip() {}
  fill() {}
  stroke() {}
  setTransform() {}
}

export class SoftCanvas {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
    this._ctx = null;
    this.style = {};
  }
  getContext() {
    if (!this._ctx) this._ctx = new SoftCtx(this);
    return this._ctx;
  }
  addEventListener() {}
  removeEventListener() {}
}

export function installSoftCanvas() {
  setCanvasFactory((w, h) => new SoftCanvas(w, h));
}
