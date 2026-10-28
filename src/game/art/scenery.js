// Parallax scenery layers: tileable 480x270 silhouettes painted once per theme.
// A layer is { k: kind, c: colour, y: baseline from top (px), a: amplitude, s: scroll speed, seed, ...extras }.

import { Painter } from '../../engine/gfx.js';
import { rng, hash2 } from '../../engine/rng.js';
import { VIEW_W, VIEW_H } from '../constants.js';
import { shade, mix } from './common.js';
import { wrapNoise } from './noise.js';
import { NATURE, placeWrapped } from './scenery_nature.js';

const W = VIEW_W;
const H = VIEW_H;

function columns(p, o, heightAt, color, cap) {
  for (let x = 0; x < W; x++) {
    const top = Math.round(o.y - heightAt(x));
    p.rect(x, top, 1, H - top, color);
    if (cap && heightAt(x) > o.a * cap.at) p.rect(x, top, 1, cap.h || 3, cap.c);
  }
}

const PAINTERS = {
  dunes(p, o) {
    columns(p, o, (x) => (Math.sin((x / W) * Math.PI * 2 * (o.cells || 3) + o.seed) * 0.5 + 0.5) * o.a, o.c, null);
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
      placeWrapped((px) => {
        p.rect(px - 8, o.y - th, 16, th, shade(o.c, -0.05));
        for (let k = 0; k < 3; k++) p.rect(px - 8 + k * 6, o.y - th - 4, 4, 4, o.c);
        p.rect(px - 1, o.y - th + 8, 2, 5, o.window || shade(o.c, -0.4));
        if (o.roof) {
          for (let k = 0; k < 8; k++) p.rect(px - 8 + k, o.y - th - 4 - (8 - k), 16 - k * 2, 1, o.roof);
        }
      }, x, 10);
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
      placeWrapped((px) => {
        for (let y = 0; y < hh; y++) {
          const half = Math.floor(y * 0.9);
          const row = o.y - hh + y;
          p.rect(px - half, row, half * 2, 1, y % 5 === 0 ? shade(o.c, 0.08) : o.c);
          p.rect(px, row, half, 1, y % 5 === 0 ? shade(o.c, -0.04) : shade(o.c, -0.12)); // the face in shadow
        }
      }, cx, hh);
    }
  },

  // ships on the horizon: a hull, two masts, billowing sails and a pennant, in a row of different sizes
  ships(p, o) {
    const r = rng(o.seed);
    p.rect(0, o.y, W, H - o.y, o.c);
    const n = o.n || 4;
    const dark = shade(o.c, -0.28);
    for (let i = 0; i < n; i++) {
      const x0 = Math.floor(((i + 0.3 + r() * 0.4) / n) * W);
      const hh = Math.floor(o.a * (0.6 + r() * 0.4));
      const len = 22 + Math.floor(r() * 12);
      placeWrapped((x) => {
        // the hull: wider at the deck than at the keel, with the bow and stern lifting
        for (let row = 0; row < 6; row++) {
          const inset = Math.floor((5 - row) * 0.9);
          p.rect(x - len / 2 + (5 - row) * 0 + inset, o.y - 6 + row, len - inset * 2, 1, row === 0 ? shade(o.c, -0.12) : dark);
        }
        p.rect(x + len / 2 - 3, o.y - 9, 4, 3, dark);
        for (const mast of [-len * 0.22, len * 0.2]) {
          const mx = Math.round(x + mast);
          p.rect(mx, o.y - hh, 1, hh - 5, dark);
          // two tiers of square sails, with a gap between them and above the deck
          let top = o.y - 9;
          for (const [halfW, tall] of [[6, Math.floor(hh * 0.3)], [5, Math.floor(hh * 0.24)]]) {
            for (let row = 0; row < tall; row++) {
              const bulge = row > 1 && row < tall - 1 ? 1 : 0;
              p.rect(mx - halfW - bulge, top - tall + row, halfW * 2 + bulge * 2, 1, row === 0 ? dark : shade(o.c, 0.16 - (row / tall) * 0.08));
            }
            top -= tall + 2;
          }
          p.rect(mx + 1, o.y - hh, 3, 2, shade(o.c, 0.2)); // a pennant
        }
      }, x0, 22);
    }
  },

  chimneys(p, o) {
    const r = rng(o.seed);
    p.rect(0, o.y, W, H - o.y, o.c);
    const n = o.n || 6;
    for (let i = 0; i < n; i++) {
      const x0 = Math.floor(((i + r() * 0.5) / n) * W);
      const hh = o.a * (0.5 + r() * 0.5);
      placeWrapped((x) => {
        p.rect(x, o.y - hh, 8, hh, shade(o.c, 0.04));
        p.rect(x - 1, o.y - hh, 10, 3, shade(o.c, 0.14));
        if (o.smoke) {
          p.ctx.globalAlpha = 0.5;
          p.ellipse(x + 8, o.y - hh - 6, 6, 4, o.smoke);
          p.ellipse(x + 14, o.y - hh - 12, 8, 5, o.smoke);
          p.ctx.globalAlpha = 1;
        }
      }, x0, 24);
    }
    for (let x = 0; x < W; x += 24) p.rect(x, o.y - 10 - (x % 3) * 2, 20, 12, shade(o.c, 0.02));
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
      const cx0 = Math.floor(((i + 0.5) / n) * W + (r() - 0.5) * 20);
      placeWrapped((cx) => {
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
      }, cx0, 28);
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

};

Object.assign(PAINTERS, NATURE);

const cache = new Map();

const HEX = /^#[0-9a-f]{6}$/i;
const NO_HAZE = new Set(['stars', 'cumulus', 'stratus', 'cirrus', 'celestial', 'rays', 'fogbank', 'aurora']); // lights and weather in the sky do not fade into it

/**
 * Atmospheric depth: a far layer (a slow `s`) is mixed toward the sky colour at its horizon, so distance reads as haze.
 * The nearest layers (s >= 0.5) are untouched. `theme.haze` is the strength at the farthest (default 0.35, 0 = none).
 */
function hazed(o, theme) {
  const k = theme.haze ?? 0.35;
  if (!k || !o.c || NO_HAZE.has(o.k)) return o;
  const amt = k * (1 - Math.min(1, (o.s || 0.1) / 0.5));
  if (amt <= 0.01) return o;
  const bands = theme.sky;
  const horizon = bands[Math.max(0, Math.min(bands.length - 1, Math.floor(o.y / Math.ceil(H / bands.length))))];
  // every colour a layer carries fades with it, not just its main one: snow caps, roofs, lit windows, rock bands
  const out = { ...o };
  for (const key of Object.keys(out)) {
    const v = out[key];
    if (typeof v === 'string' && HEX.test(v)) out[key] = mix(v, horizon, amt);
    else if (Array.isArray(v) && v.length && v.every((e) => typeof e === 'string' && HEX.test(e))) out[key] = v.map((e) => mix(e, horizon, amt));
  }
  return out;
}

/** Render a scenery layer to a canvas (cached by theme+index). Pass the theme to fade far layers into the sky. */
export function sceneryLayer(key, layer, theme = null) {
  let c = cache.get(key);
  if (c) return c;
  const p = new Painter(W, H);
  const fn = PAINTERS[layer.k];
  if (fn) {
    const o = { seed: 1, a: 40, y: 150, ...layer };
    fn(p, theme ? hazed(o, theme) : o);
  }
  c = p.canvas;
  cache.set(key, c);
  return c;
}
