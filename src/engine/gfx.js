// Canvas abstraction. In the browser this is a real <canvas>; in Node (tests, screenshots)
// tools/softcanvas.js installs a software canvas through setCanvasFactory().
// Game code only uses: fillStyle, globalAlpha, fillRect, clearRect, drawImage, save/restore,
// translate and scale - a small subset the software canvas implements exactly.

let factory = null;

export function setCanvasFactory(fn) {
  factory = fn;
}

export function createCanvas(w, h) {
  if (factory) return factory(w, h);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  throw new Error('No canvas factory installed (call setCanvasFactory in Node)');
}

export function ctx2d(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Draw an image at integer pixel position, optionally mirrored about its own centre. */
export function blit(ctx, img, x, y, flipX = false, flipY = false) {
  x = Math.round(x);
  y = Math.round(y);
  if (!flipX && !flipY) {
    ctx.drawImage(img, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x + (flipX ? img.width : 0), y + (flipY ? img.height : 0));
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/**
 * Pixel-art painter used to build every sprite procedurally.
 * All drawing is axis-aligned rectangles so the look stays crisp and the software canvas can mirror it.
 */
export class Painter {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.canvas = createCanvas(w, h);
    this.ctx = ctx2d(this.canvas);
  }

  rect(x, y, w, h, color) {
    if (!color) return this;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    return this;
  }

  px(x, y, color) {
    return this.rect(x, y, 1, 1, color);
  }

  /** Filled ellipse drawn as scanlines. */
  ellipse(cx, cy, rx, ry, color) {
    if (!color) return this;
    this.ctx.fillStyle = color;
    for (let y = -ry; y <= ry; y++) {
      const k = Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001)));
      const half = Math.round(rx * k);
      this.ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
    }
    return this;
  }

  /** Thick pixel line (Bresenham with a square brush). */
  line(x0, y0, x1, y1, color, t = 1) {
    if (!color) return this;
    this.ctx.fillStyle = color;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 4096; i++) {
      this.ctx.fillRect(x0, y0, t, t);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  /** 1px outline rectangle. */
  frame(x, y, w, h, color) {
    this.rect(x, y, w, 1, color);
    this.rect(x, y + h - 1, w, 1, color);
    this.rect(x, y, 1, h, color);
    this.rect(x + w - 1, y, 1, h, color);
    return this;
  }
}

/** Draw a thick pixel line directly onto a context (used for aimed weapon barrels, beams). */
export function lineTo(ctx, x0, y0, x1, y1, color, t = 1) {
  ctx.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 2048; i++) {
    ctx.fillRect(x0, y0, t, t);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
