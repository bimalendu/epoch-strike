// Parallax scenery layers: tileable 480x270 silhouettes painted once per theme.
// A layer is { k: kind, c: colour, y: baseline from top (px), a: amplitude, s: scroll speed, seed, ...extras }.

import { Painter } from '../../engine/gfx.js';
import { rng, hash2 } from '../../engine/rng.js';
import { VIEW_W, VIEW_H } from '../constants.js';
import { shade } from './common.js';

const W = VIEW_W;
const H = VIEW_H;

/** Smooth noise array of length W that wraps around, values in 0..1. */
function wrapNoise(seed, cells, octaves = 2) {
  const out = new Float32Array(W);
  for (let o = 0; o < octaves; o++) {
    const n = cells * (1 << o);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(hash2(i, o, seed));
    const amp = 1 / (1 << o);
    for (let x = 0; x < W; x++) {
      const f = (x / W) * n;
      const i = Math.floor(f);
      const t = f - i;
      const s = t * t * (3 - 2 * t);
      out[x] += (pts[i % n] * (1 - s) + pts[(i + 1) % n] * s) * amp;
    }
  }
  const norm = 2 - 1 / (1 << (octaves - 1));
  for (let x = 0; x < W; x++) out[x] /= norm;
  return out;
}

function columns(p, o, heightAt, color, cap) {
  for (let x = 0; x < W; x++) {
    const top = Math.round(o.y - heightAt(x));
    p.rect(x, top, 1, H - top, color);
    if (cap && heightAt(x) > o.a * cap.at) p.rect(x, top, 1, cap.h || 3, cap.c);
  }
}

const PAINTERS = {
  mountains(p, o) {
    const n = wrapNoise(o.seed, o.cells || 5, 3);
    columns(p, o, (x) => n[x] * o.a, o.c, o.cap ? { c: o.cap, at: 0.62, h: 4 } : null);
    if (o.shade) {
      for (let x = 0; x < W; x++) {
        const top = Math.round(o.y - n[x] * o.a);
        if (n[(x + 3) % W] < n[x]) p.rect(x, top + 2, 1, 7, shade(o.c, -0.07));
      }
    }
  },

  hills(p, o) {
    const n = wrapNoise(o.seed, o.cells || 4, 1);
    columns(p, o, (x) => n[x] * o.a, o.c, null);
  },

  dunes(p, o) {
    columns(p, o, (x) => (Math.sin((x / W) * Math.PI * 2 * (o.cells || 3) + o.seed) * 0.5 + 0.5) * o.a, o.c, null);
  },

  // canopy trees: trunk + blobs (palm = fronds)
  trees(p, o) {
    const r = rng(o.seed);
    const n = o.n || 14;
    p.rect(0, o.y, W, H - o.y, o.c);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(((i + r() * 0.6) / n) * W);
      const th = Math.floor(o.a * (0.55 + r() * 0.45));
      const base = o.y + 4;
      p.rect(x - 2, base - th, 4, th, shade(o.c, -0.25));
      if (o.palm) {
        for (let k = -3; k <= 3; k++) {
          const len = 14 - Math.abs(k) * 2;
          p.line(x, base - th, x + k * 4, base - th - 2 + Math.abs(k) * 2, o.c, 2);
          p.rect(x + k * 4 - 1, base - th - 3 + Math.abs(k) * 2, 3, 2, o.c);
          void len;
        }
      } else {
        const rad = 10 + Math.floor(r() * 7);
        p.ellipse(x, base - th - 2, rad, Math.floor(rad * 0.8), o.c);
        p.ellipse(x - rad / 2, base - th + 3, Math.floor(rad * 0.7), Math.floor(rad * 0.55), o.c);
        p.ellipse(x + rad / 2, base - th + 3, Math.floor(rad * 0.7), Math.floor(rad * 0.55), o.c);
        p.ellipse(x - 3, base - th - 5, Math.floor(rad * 0.5), Math.floor(rad * 0.4), shade(o.c, 0.1));
      }
    }
  },

  pines(p, o) {
    const r = rng(o.seed);
    const n = o.n || 16;
    p.rect(0, o.y + 6, W, H - o.y, o.c);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(((i + r() * 0.5) / n) * W);
      const th = Math.floor(o.a * (0.6 + r() * 0.4));
      const base = o.y + 6;
      p.rect(x - 1, base - 4, 2, 4, shade(o.c, -0.3));
      const tier = Math.max(4, Math.floor(th / 4));
      for (let t = 0; t < 4; t++) {
        // lowest tier widest, tapering to the tip
        const w = 3 + (3 - t) * 3 + Math.floor(th / 12);
        const yy = base - 5 - (t + 1) * tier + 2;
        p.rect(x - w, yy, w * 2 + 1, tier + 1, o.c);
        if (o.snow) p.rect(x - w + 1, yy, w * 2 - 1, 2, o.snow);
      }
    }
  },

  pillars(p, o) {
    const n = o.n || 8;
    const w = o.w || 8;
    p.rect(0, o.y + o.a - 6, W, H, shade(o.c, -0.1));
    for (let i = 0; i < n; i++) {
      const x = Math.floor((i + 0.5) * (W / n)) - w / 2;
      const top = o.y;
      p.rect(x, top, w, H - top, o.c);
      p.rect(x - 2, top, w + 4, 4, shade(o.c, 0.12)); // capital
      p.rect(x - 1, top + 4, w + 2, 2, shade(o.c, -0.1));
      for (let k = 2; k < w - 1; k += 3) p.rect(x + k, top + 6, 1, H - top, shade(o.c, -0.12)); // fluting
      if (o.broken && i % 3 === 1) p.rect(x - 3, top - 2, w + 6, 12, o.bg || '#000000');
    }
    if (o.lintel) p.rect(0, o.y - 4, W, 4, shade(o.c, 0.05));
  },

  castle(p, o) {
    const r = rng(o.seed);
    p.rect(0, o.y, W, H - o.y, o.c);
    for (let x = 0; x < W; x += 8) p.rect(x, o.y - 4, 5, 4, o.c); // crenellations
    const towers = o.n || 5;
    for (let i = 0; i < towers; i++) {
      const x = Math.floor(((i + 0.3 + r() * 0.4) / towers) * W);
      const th = o.a * (0.6 + r() * 0.4);
      p.rect(x - 8, o.y - th, 16, th, shade(o.c, -0.05));
      for (let k = 0; k < 3; k++) p.rect(x - 8 + k * 6, o.y - th - 4, 4, 4, o.c);
      p.rect(x - 1, o.y - th + 8, 2, 5, o.window || shade(o.c, -0.4));
      if (o.roof) {
        for (let k = 0; k < 8; k++) p.rect(x - 8 + k, o.y - th - 4 - (8 - k), 16 - k * 2, 1, o.roof);
      }
    }
  },

  city(p, o) {
    const r = rng(o.seed);
    let x = 0;
    while (x < W) {
      const bw = 14 + Math.floor(r() * 22);
      const bh = Math.floor(o.a * (0.35 + r() * 0.65));
      const w = Math.min(bw, W - x);
      p.rect(x, o.y - bh, w, H - (o.y - bh), o.c);
      p.rect(x, o.y - bh, w, 1, shade(o.c, 0.12));
      if (o.win) {
        for (let wy = o.y - bh + 4; wy < o.y - 3; wy += 6) {
          for (let wx = x + 3; wx < x + w - 3; wx += 5) {
            if (r() < (o.lit ?? 0.35)) p.rect(wx, wy, 2, 3, r() < 0.15 ? o.win2 || o.win : o.win);
          }
        }
      }
      if (r() < 0.3) p.rect(x + Math.floor(w / 2), o.y - bh - 8, 1, 8, o.c);
      x += w + Math.floor(r() * 4);
    }
  },

  pyramids(p, o) {
    const r = rng(o.seed);
    p.rect(0, o.y, W, H - o.y, o.c);
    const n = o.n || 3;
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(((i + 0.5) / n) * W + (r() - 0.5) * 30);
      const hh = o.a * (0.6 + r() * 0.4);
      for (let y = 0; y < hh; y++) {
        const half = Math.floor((hh - y) * 0.9);
        p.rect(cx - half, o.y - hh + y, half * 2, 1, o.c);
        if (y % 5 === 0) p.rect(cx - half, o.y - hh + y, half * 2, 1, shade(o.c, 0.08));
      }
      p.rect(cx, o.y - hh, Math.floor(hh * 0.9), hh, shade(o.c, -0.1)); // shaded face
    }
  },

  // sails and masts on the horizon
  ships(p, o) {
    const r = rng(o.seed);
    p.rect(0, o.y, W, H - o.y, o.c);
    const n = o.n || 4;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(((i + 0.5) / n) * W);
      const hh = o.a * (0.7 + r() * 0.3);
      p.rect(x, o.y - hh, 2, hh, shade(o.c, -0.2));
      p.rect(x - 8, o.y - hh + 4, 16, hh * 0.6, shade(o.c, 0.08)); // sail
      p.rect(x - 10, o.y - 2, 22, 3, shade(o.c, -0.25)); // hull
    }
  },

  chimneys(p, o) {
    const r = rng(o.seed);
    p.rect(0, o.y, W, H - o.y, o.c);
    const n = o.n || 6;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(((i + r() * 0.5) / n) * W);
      const hh = o.a * (0.5 + r() * 0.5);
      p.rect(x, o.y - hh, 8, hh, shade(o.c, 0.04));
      p.rect(x - 1, o.y - hh, 10, 3, shade(o.c, 0.14));
      if (o.smoke) {
        p.ctx.globalAlpha = 0.5;
        p.ellipse(x + 8, o.y - hh - 6, 6, 4, o.smoke);
        p.ellipse(x + 14, o.y - hh - 12, 8, 5, o.smoke);
        p.ctx.globalAlpha = 1;
      }
    }
    for (let x = 0; x < W; x += 24) p.rect(x, o.y - 10 - (x % 3) * 2, 20, 12, shade(o.c, 0.02));
  },

  clouds(p, o) {
    const r = rng(o.seed);
    const n = o.n || 6;
    p.ctx.globalAlpha = o.alpha ?? 0.85;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(((i + r() * 0.7) / n) * W);
      const y = o.y + Math.floor(r() * o.a);
      const w = 16 + Math.floor(r() * 18);
      p.ellipse(x, y, w, 5, o.c);
      p.ellipse(x - w / 2, y + 2, Math.floor(w * 0.6), 4, o.c);
      p.ellipse(x + w / 2, y + 2, Math.floor(w * 0.6), 4, o.c);
    }
    p.ctx.globalAlpha = 1;
  },

  stars(p, o) {
    const r = rng(o.seed);
    for (let i = 0; i < (o.n || 60); i++) {
      const x = Math.floor(r() * W);
      const y = o.y + Math.floor(r() * o.a);
      p.rect(x, y, 1, 1, r() < 0.2 ? '#ffffff' : o.c);
    }
  },

  // hanging stalactites / rising stalagmites (caves)
  cave(p, o) {
    const n = wrapNoise(o.seed, o.cells || 9, 2);
    for (let x = 0; x < W; x++) {
      const hang = Math.round(n[x] * o.a);
      p.rect(x, 0, 1, hang, o.c);
      const rise = Math.round(n[(x + 160) % W] * o.a * 0.6);
      p.rect(x, H - rise, 1, rise, shade(o.c, -0.08));
    }
  },

  volcano(p, o) {
    const cx = Math.floor(W * (o.at ?? 0.62));
    const hh = o.a;
    for (let y = 0; y < hh; y++) {
      const half = Math.floor(14 + y * 1.6);
      p.rect(cx - half, o.y - hh + y, half * 2, 1, o.c);
    }
    if (o.glow) {
      p.ellipse(cx, o.y - hh + 2, 14, 4, o.glow);
      p.ctx.globalAlpha = 0.4;
      p.ellipse(cx, o.y - hh - 6, 20, 9, o.glow);
      p.ctx.globalAlpha = 1;
    }
    if (o.smoke) {
      p.ctx.globalAlpha = 0.55;
      p.ellipse(cx + 8, o.y - hh - 16, 14, 8, o.smoke);
      p.ellipse(cx + 22, o.y - hh - 30, 18, 10, o.smoke);
      p.ctx.globalAlpha = 1;
    }
  },

  pagodas(p, o) {
    const r = rng(o.seed);
    p.rect(0, o.y, W, H - o.y, o.c);
    const n = o.n || 3;
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(((i + 0.5) / n) * W + (r() - 0.5) * 20);
      for (let t = 0; t < 4; t++) {
        const w = 22 - t * 4;
        const y = o.y - 10 - t * 14;
        p.rect(cx - w, y, w * 2, 3, shade(o.c, 0.1));
        p.rect(cx - w + 2, y - 2, w * 2 - 4, 2, o.c);
        p.rect(cx - w + 4, y + 3, w * 2 - 8, 11, o.c);
        p.rect(cx - w - 3, y, 3, 2, o.c);
        p.rect(cx + w, y, 3, 2, o.c);
      }
      p.rect(cx, o.y - 70, 1, 8, o.c);
    }
  },

  waves(p, o) {
    p.rect(0, o.y, W, H - o.y, o.c);
    for (let y = o.y; y < H; y += 6) {
      for (let x = (y * 7) % 20; x < W; x += 20) p.rect(x, y, 8, 1, shade(o.c, 0.18));
    }
  },

  // crowd / far wall of an arena
  arena(p, o) {
    p.rect(0, o.y, W, H - o.y, o.c);
    for (let row = 0; row < 4; row++) {
      for (let x = 0; x < W; x += 6) {
        const hh = hash2(x, row, o.seed);
        p.rect(x + (row % 2) * 3, o.y + row * 8 + 2, 4, 4, hh > 0.5 ? o.c2 || shade(o.c, 0.3) : shade(o.c, 0.15));
      }
    }
  },

  mist(p, o) {
    p.ctx.globalAlpha = o.alpha ?? 0.3;
    p.rect(0, o.y, W, o.a, o.c);
    p.ctx.globalAlpha = 1;
  },
};

const cache = new Map();

/** Render a scenery layer to a canvas (cached by theme+index). */
export function sceneryLayer(key, layer) {
  let c = cache.get(key);
  if (c) return c;
  const p = new Painter(W, H);
  const fn = PAINTERS[layer.k];
  if (fn) fn(p, { seed: 1, a: 40, y: 150, ...layer });
  c = p.canvas;
  cache.set(key, c);
  return c;
}

export function clearSceneryCache() {
  cache.clear();
}
