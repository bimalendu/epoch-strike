// The natural landscape painters for the parallax layers: ridged mountain ranges with lit and shadowed faces, mesas, sea stacks and
// arches, forests with several species, reeds, waterfalls, lakes, and the sky furniture (cumulus, stratus and cirrus cloud,
// the sun or moon, light shafts, fog banks and the aurora).
//
// They follow the layer rules in scenery.js: each paints one tileable 480x270 canvas from an options object `o`
// ({ c, y: baseline, a: amplitude, seed, ...extras }), using rectangles only. Soft edges are made with an ordered dither
// (a 4x4 Bayer matrix) rather than transparency, because the browser and the software canvas blend alpha slightly differently
// and the parity check allows only a sliver of difference. Anything placed by the random stream is also painted one screen
// to the left and right when it is close to an edge, so nothing is cut off at the seam where the layer tiles.

import { rng, hash2 } from '../../engine/rng.js';
import { VIEW_W, VIEW_H } from '../constants.js';
import { shade, mix } from './common.js';
import { wrapNoise, ridged, warped, smooth, gullies, terraced, sampleWrap } from './noise.js';

const W = VIEW_W;
const H = VIEW_H;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Does the ordered dither put a pixel at (x, y) for a coverage of `density` (0..1)? */
export function dithered(x, y, density) {
  return density > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** Call `draw(x)` for a shape centred on x with the given half width, and again one screen over if it crosses the seam. */
export function placeWrapped(draw, x, half) {
  draw(x);
  if (x - half < 0) draw(x + W);
  if (x + half > W) draw(x - W);
}

/** A disc of dithered pixels: `density` 1 is solid. */
function ditherDisc(p, cx, cy, r, color, density) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r && dithered(x, y, density)) p.rect(x, y, 1, 1, color);
    }
  }
}

/** Pick a key by weight from [[key, weight], ...] with a roll in 0..1. */
function pickWeighted(list, roll) {
  const total = list.reduce((s, e) => s + e[1], 0);
  let t = roll * total;
  for (const [key, weight] of list) {
    t -= weight;
    if (t < 0) return key;
  }
  return list[list.length - 1][0];
}

// ---- landforms ----

/**
 * A mountain range: ridged noise with the crests warped and cut by gullies, lit on the faces that look toward the light
 * (the left) and shadowed on the others, with strata streaks, a snowline that follows the height and the lean of the ground,
 * and an optional dark band of forest at the foot.
 */
function ridges(p, o) {
  const raw = smooth(warped(ridged(o.seed, o.cells || 4, o.octaves || 3), o.seed, o.warp ?? 16), 1);
  let lo = 1;
  let hi = 0;
  for (let x = 0; x < W; x++) {
    lo = Math.min(lo, raw[x]);
    hi = Math.max(hi, raw[x]);
  }
  for (let x = 0; x < W; x++) raw[x] = Math.pow((raw[x] - lo) / (hi - lo || 1), o.sharp ?? 1.3); // use the full height range, crests sharper than valleys
  const h = gullies(raw, o.seed, o.gullies ?? 8, 0.16, 5);
  const lit = shade(o.c, o.lit ?? 0.1);
  const dark = shade(o.c, -(o.shadow ?? 0.2));
  const mid = mix(lit, dark, 0.5);
  const snowLine = o.snow ? o.snowAt ?? 0.62 : 2;
  const top = (x) => Math.round(o.y - h[(x + W) % W] * o.a);
  for (let x = 0; x < W; x++) {
    const t = top(x);
    const lean = top(x - 2) - top(x + 2); // positive: the ground rises to the right here, so the face looks left, toward the light
    const face = lean > 1.2 ? lit : lean < -1.2 ? dark : mid;
    p.rect(x, t, 1, H - t, face);
    // strata and erosion streaks down the face
    if ((x + Math.floor(h[x] * 9)) % 3 === 0) {
      const len = 6 + Math.floor(hash2(x, 3, o.seed) * 22);
      p.rect(x, t + 3, 1, Math.min(len, H - t), face === lit ? shade(lit, 0.08) : shade(face, -0.1));
    }
    if (o.snow && h[x] > snowLine) {
      const depth = Math.min(14, Math.round((h[x] - snowLine) * o.a * 0.7) + 2 + Math.floor(hash2(x, 5, o.seed) * 3));
      p.rect(x, t, 1, depth, face === dark ? shade(o.snow, -0.16) : o.snow);
      if (face !== dark) p.rect(x, t, 1, 1, shade(o.snow, 0.4)); // a lit crest
    }
  }
  if (o.trees) {
    // the dark teeth of the forest at the foot of the range
    const base = o.y - Math.round(o.a * (o.treeline ?? 0.14));
    for (let x = 0; x < W; x++) p.rect(x, base - 2 - Math.floor(hash2(x >> 1, 4, o.seed) * 4), 1, H, o.trees);
  }
}

/**
 * Flat-topped mesas and buttes: each is a wide plateau with a narrower tier on top, ragged edges, banded cliffs with a shaded side,
 * and a skirt of fallen rock at the foot that spreads well beyond the cliff.
 */
function mesa(p, o) {
  const r = rng(o.seed);
  const bands = o.bands || [o.c, shade(o.c, -0.12), shade(o.c, 0.1), shade(o.c, -0.2)];
  const ground = o.ground || shade(o.c, -0.15);
  p.rect(0, o.y, W, H - o.y, ground);
  const n = o.n || 3;
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(((i + 0.3 + r() * 0.4) / n) * W);
    const w = Math.floor((o.w || 70) * (0.7 + r() * 0.6));
    const hh = Math.floor(o.a * (0.55 + r() * 0.45));
    const tier = r() < 0.7; // a second, narrower step on top
    const tierW = Math.floor(w * (0.45 + r() * 0.2));
    const tierH = Math.floor(hh * 0.28);
    const lean = Math.floor((r() - 0.5) * 12);
    placeWrapped((x) => {
      const talus = Math.floor(hh * 0.34);
      // the skirt of scree, a long slope in the colour of the lower cliff fading into the ground
      for (let row = 0; row < talus; row++) {
        const grow = Math.floor((talus - row) * 1.9);
        const edge = Math.floor(hash2(row, i, o.seed) * 3);
        p.rect(x - w / 2 - grow + edge, o.y - row - 1, w + grow * 2 - edge * 2, 1, mix(bands[1], ground, row / talus));
      }
      for (let row = 0; row < hh; row++) {
        const y = o.y - hh + row;
        const ragL = Math.floor(hash2(row >> 1, i, o.seed) * 4);
        const ragR = Math.floor(hash2(row >> 1, i + 9, o.seed) * 4);
        const band = bands[Math.floor((row + Math.floor(hash2(i, row >> 3, o.seed) * 3)) / 6) % bands.length];
        const x0 = x - Math.floor(w / 2) + ragL + Math.floor((row / hh) * 3);
        const x1 = x + Math.floor(w / 2) - ragR - Math.floor((row / hh) * 3);
        p.rect(x0, y, x1 - x0, 1, band);
        p.rect(x1 - Math.floor((x1 - x0) * 0.24), y, Math.floor((x1 - x0) * 0.24), 1, shade(band, -0.18)); // the shadowed side
        p.px(x0, y, shade(band, 0.14));
      }
      p.rect(x - w / 2 - 1, o.y - hh - 1, w + 2, 3, o.cap || shade(o.c, 0.18));
      p.rect(x - w / 2 - 1, o.y - hh + 2, w + 2, 1, shade(o.c, -0.3));
      if (tier) {
        for (let row = 0; row < tierH; row++) {
          const y = o.y - hh - tierH + row;
          const band = bands[(Math.floor(row / 5) + 1) % bands.length];
          const x0 = x - Math.floor(tierW / 2) + lean + Math.floor(hash2(row, i + 3, o.seed) * 3);
          const x1 = x + Math.floor(tierW / 2) + lean - Math.floor(hash2(row, i + 4, o.seed) * 3);
          p.rect(x0, y, x1 - x0, 1, band);
          p.rect(x1 - Math.floor((x1 - x0) * 0.26), y, Math.floor((x1 - x0) * 0.26), 1, shade(band, -0.18));
        }
        p.rect(x - Math.floor(tierW / 2) + lean - 1, o.y - hh - tierH - 1, tierW + 2, 2, o.cap || shade(o.c, 0.18));
      }
    }, cx, w);
  }
}

/**
 * Sea stacks and hoodoos: weathered towers that are broad at the foot and narrow unevenly toward the top, with ledges, a shaded
 * flank and a scatter of fallen blocks at the base. `hoodoo: true` gives each a caprock of harder stone; `cap` puts grass on top.
 */
function spires(p, o) {
  const r = rng(o.seed);
  if (o.ground !== false) p.rect(0, o.y, W, H - o.y, o.ground || shade(o.c, -0.2));
  const n = o.n || 6;
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(((i + r() * 0.7) / n) * W);
    const bw = 12 + Math.floor(r() * 12);
    const hh = Math.floor(o.a * (0.5 + r() * 0.5));
    const bulge = 0.55 + r() * 0.3; // where a harder layer juts out
    const tilt = (r() - 0.5) * 0.5;
    placeWrapped((x) => {
      for (let row = 0; row < hh; row++) {
        const t = row / hh; // 0 at the foot
        const shoulder = o.hoodoo && Math.abs(t - bulge) < 0.05 ? 3 : 0;
        const wobble = hash2(i, row >> 2, o.seed) * (1 - (row & 3) / 4) + hash2(i, (row >> 2) + 1, o.seed) * ((row & 3) / 4); // smooth along the height
        const dome = t > 0.9 ? Math.round((t - 0.9) * 10 * bw * 0.4) : 0; // the top rounds off
        const half = Math.max(2, Math.round((bw / 2) * (1 - t * 0.55) + shoulder + (wobble - 0.5) * 5 - dome));
        const y = o.y - row - 1;
        const mx = x + Math.round(tilt * row * 0.3); // the stack leans
        p.rect(mx - half, y, half * 2, 1, o.c);
        p.rect(mx + Math.floor(half * 0.2), y, half - Math.floor(half * 0.2), 1, shade(o.c, -0.2));
        p.px(mx - half, y, shade(o.c, 0.15));
      }
      if (o.cap) p.rect(x + Math.round(tilt * hh * 0.3) - 3, o.y - hh - 1, 6, 2, o.cap); // grass or snow on top
      // fallen blocks round the foot
      for (let k = 0; k < 3; k++) p.rect(x - bw + Math.floor(hash2(k, i, o.seed) * bw * 2), o.y - 2, 3 + (k % 2) * 2, 2, shade(o.c, -0.1));
    }, cx, bw);
  }
  if (o.sea) {
    p.rect(0, o.y, W, H - o.y, o.sea);
    for (let x = 0; x < W; x += 3) if (dithered(x, 0, 0.5)) p.rect(x, o.y, 2, 1, o.foam || '#ffffff');
  }
}

/** A natural arch: a mass of rock with an elliptical window cut through it, so the layers behind show in the opening. */
function arches(p, o) {
  const r = rng(o.seed);
  const n = o.n || 2;
  p.rect(0, o.y, W, H - o.y, o.ground || shade(o.c, -0.15));
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(((i + 0.35 + r() * 0.3) / n) * W);
    const w = Math.floor((o.w || 110) * (0.8 + r() * 0.4));
    const hh = Math.floor(o.a * (0.7 + r() * 0.3));
    placeWrapped((x) => {
      for (let row = 0; row < hh; row++) {
        const t = row / hh;
        const half = Math.round((w / 2) * Math.sqrt(Math.max(0.05, 1 - Math.pow(t * 0.98, 2.4))));
        const y = o.y - row - 1;
        p.rect(x - half, y, half * 2, 1, row % 9 < 2 ? shade(o.c, -0.08) : o.c);
        p.rect(x + Math.floor(half * 0.35), y, half - Math.floor(half * 0.35), 1, shade(o.c, -0.2));
        p.px(x - half, y, shade(o.c, 0.15));
      }
      // the window
      const wr = Math.floor(w * 0.27);
      const wh = Math.floor(hh * 0.55);
      for (let row = 0; row < wh; row++) {
        const half = Math.round(wr * Math.sqrt(1 - Math.pow(row / wh, 2)));
        p.ctx.clearRect(x - half, o.y - row - 1, half * 2, 1);
      }
    }, cx, w / 2);
  }
}

/** Canyon walls and terraced rims: stepped heights, a different rock colour per terrace, a lit tread and a shaded face at each step. */
function canyon(p, o) {
  const t = terraced(smooth(warped(wrapNoise(o.seed, o.cells || 4, 3), o.seed, 20), 2), o.steps || 5, 0.22);
  const bands = o.bands || [shade(o.c, -0.2), shade(o.c, -0.1), o.c, shade(o.c, 0.08), shade(o.c, 0.16)];
  for (let x = 0; x < W; x++) {
    const hgt = t[x] * o.a;
    const top = Math.round(o.y - hgt);
    const step = Math.min(bands.length - 1, Math.floor(t[x] * (o.steps || 5) * 0.999));
    const wall = Math.abs(t[(x + 1) % W] - t[(x + W - 1) % W]) * o.a > 2;
    p.rect(x, top, 1, H - top, wall ? shade(bands[step], -0.2) : bands[step]);
    p.rect(x, top, 1, 1, shade(bands[step], 0.2));
    if (!wall && (x + step * 2) % 5 === 0) p.rect(x, top + 3, 1, 9, shade(bands[step], -0.1)); // strata
  }
}

// ---- plants ----

/** Each species draws one tree standing at (x, base) with height h. `c` is its leaf colour, `k` its trunk colour. */
const TREES = {
  conifer(p, x, base, h, c, k) {
    p.rect(x - 1, base - Math.floor(h * 0.18), 2, Math.floor(h * 0.18), k);
    const tiers = Math.max(3, Math.floor(h / 7));
    for (let t = 0; t < tiers; t++) {
      const w = Math.max(1, Math.round(((tiers - t) / tiers) * h * 0.26));
      const y = base - Math.floor(h * 0.12) - Math.floor(((t + 1) / tiers) * h * 0.88);
      const th = Math.ceil((h * 0.88) / tiers) + 1;
      p.rect(x - w, y, w * 2 + 1, th, c);
      p.rect(x - w, y, w, th, shade(c, 0.1));
    }
  },
  birch(p, x, base, h, c, k) {
    p.rect(x - 1, base - h, 2, h, '#e8e4d8');
    for (let y = base - h + 2; y < base; y += 5) p.rect(x - 1, y, 2, 1, '#3a3a38');
    const rad = Math.max(4, Math.floor(h * 0.3));
    p.ellipse(x, base - h + 1, rad, Math.floor(rad * 1.2), c);
    p.ellipse(x - 2, base - h - 1, Math.floor(rad * 0.6), Math.floor(rad * 0.7), shade(c, 0.16));
    void k;
  },
  oak(p, x, base, h, c, k) {
    p.rect(x - 2, base - Math.floor(h * 0.55), 4, Math.floor(h * 0.55), k);
    const rad = Math.floor(h * 0.3);
    p.ellipse(x, base - Math.floor(h * 0.62), rad, Math.floor(rad * 0.85), c);
    p.ellipse(x - Math.floor(rad * 0.7), base - Math.floor(h * 0.5), Math.floor(rad * 0.65), Math.floor(rad * 0.5), c);
    p.ellipse(x + Math.floor(rad * 0.7), base - Math.floor(h * 0.5), Math.floor(rad * 0.65), Math.floor(rad * 0.5), c);
    p.ellipse(x - 2, base - Math.floor(h * 0.7), Math.floor(rad * 0.5), Math.floor(rad * 0.4), shade(c, 0.14));
  },
  palm(p, x, base, h, c, k) {
    for (let y = 0; y < h; y++) p.rect(x + Math.round(Math.sin(y * 0.09) * 2), base - y - 1, 2, 1, k);
    const tx = x + Math.round(Math.sin(h * 0.09) * 2);
    for (let f = -3; f <= 3; f++) {
      p.line(tx, base - h, tx + f * 4, base - h - 4 + Math.abs(f) * 3, c, 2);
      p.rect(tx + f * 4 - 1, base - h - 5 + Math.abs(f) * 3, 3, 2, shade(c, 0.1));
    }
  },
  /** A cycad or tree fern: a short scaly trunk and a crown of arching fronds. */
  cycad(p, x, base, h, c, k) {
    const trunk = Math.floor(h * 0.5);
    p.rect(x - 2, base - trunk, 4, trunk, k);
    for (let y = base - trunk + 2; y < base; y += 3) p.rect(x - 2, y, 4, 1, shade(k, -0.25));
    for (let f = -4; f <= 4; f++) {
      const len = Math.floor(h * 0.4) - Math.abs(f);
      p.line(x, base - trunk, x + f * 3, base - trunk - Math.max(2, len - Math.abs(f) * 2), c, 1);
      p.rect(x + f * 3 - 1, base - trunk - Math.max(2, len - Math.abs(f) * 2) + 1, 3, 2, shade(c, f < 0 ? 0.12 : -0.08));
    }
  },
  baobab(p, x, base, h, c, k) {
    for (let y = 0; y < h * 0.65; y++) {
      const half = Math.round(3 + 4 * Math.sin((y / (h * 0.65)) * Math.PI * 0.75 + 0.6) + (y < 6 ? 2 : 0));
      p.rect(x - half, base - y - 1, half * 2, 1, y % 7 === 0 ? shade(k, -0.15) : k);
      p.rect(x + Math.floor(half * 0.3), base - y - 1, half - Math.floor(half * 0.3), 1, shade(k, -0.18));
    }
    const top = base - Math.floor(h * 0.65);
    for (const [dx, dy, r] of [[-7, -3, 4], [0, -6, 5], [7, -2, 4], [-3, -1, 3], [4, -4, 3]]) p.ellipse(x + dx, top + dy, r, Math.floor(r * 0.8), c);
    p.line(x, top + 2, x - 7, top - 3, k, 1);
    p.line(x, top + 2, x + 7, top - 2, k, 1);
  },
  bush(p, x, base, h, c) {
    const rad = Math.max(3, Math.floor(h * 0.5));
    p.ellipse(x, base - Math.floor(rad * 0.6), rad, Math.floor(rad * 0.7), c);
    p.ellipse(x - Math.floor(rad * 0.3), base - Math.floor(rad * 0.9), Math.floor(rad * 0.55), Math.floor(rad * 0.4), shade(c, 0.16));
  },
  willow(p, x, base, h, c, k) {
    p.rect(x - 1, base - Math.floor(h * 0.6), 3, Math.floor(h * 0.6), k);
    const rad = Math.floor(h * 0.34);
    p.ellipse(x, base - Math.floor(h * 0.62), rad, Math.floor(rad * 0.6), c);
    for (let s = -rad; s <= rad; s += 2) {
      const len = Math.floor(rad * 0.9 * (1 - Math.abs(s) / (rad + 2))) + 3 + (hash2(s, x, 9) < 0.5 ? 2 : 0);
      p.rect(x + s, base - Math.floor(h * 0.62), 1, len, hash2(s, x, 4) < 0.4 ? shade(c, 0.12) : c);
    }
  },
  /** A tall, narrow, dark tree: a Mediterranean cypress. */
  cypress(p, x, base, h, c, k) {
    p.rect(x - 1, base - 3, 2, 3, k);
    const half = Math.max(2, Math.floor(h * 0.1));
    for (let row = 0; row < h; row++) {
      const t = row / h;
      const w = Math.max(1, Math.round(half * Math.sin(Math.min(1, t * 1.15 + 0.1) * Math.PI * 0.9) + 1));
      p.rect(x - w, base - 3 - row, w * 2, 1, c);
      p.rect(x - w, base - 3 - row, Math.ceil(w * 0.7), 1, shade(c, 0.12));
    }
  },
  dead(p, x, base, h, c, k) {
    p.rect(x - 1, base - h, 2, h, k);
    for (const [dy, dir, len] of [[0.35, -1, 8], [0.55, 1, 9], [0.75, -1, 6], [0.9, 1, 5]]) {
      const y = base - Math.floor(h * dy);
      p.line(x, y, x + dir * len, y - Math.floor(len * 0.6), k, 1);
    }
    void c;
  },
};

/**
 * A band of woodland: `o.species` lists [kind, weight] pairs, so a forest can be mostly conifer with some birch. Leaf colours
 * vary a little from tree to tree, and a line of undergrowth hides the feet of the trunks.
 */
function forest(p, o) {
  const r = rng(o.seed);
  const species = o.species || [['oak', 1]];
  const n = o.n || 14;
  const trunk = o.trunk || shade(o.c, -0.45);
  const under = o.under ?? 0.5;
  p.rect(0, o.y, W, H - o.y, shade(o.c, -0.22));
  const bumps = wrapNoise(o.seed + 5, 18, 2);
  for (let x = 0; x < W; x++) {
    const top = o.y - Math.round(bumps[x] * 7 * under) - 1;
    p.rect(x, top, 1, o.y - top + 1, shade(o.c, -0.22));
  }
  for (let i = 0; i < n; i++) {
    const x = Math.floor(((i + r() * 0.8) / n) * W);
    const kind = pickWeighted(species, r());
    const h = Math.floor(o.a * (0.55 + r() * 0.45));
    const c = shade(o.c, (r() - 0.5) * 0.22);
    placeWrapped((px) => TREES[kind](p, px, o.y + 3, h, c, trunk), x, Math.floor(h * 0.4));
  }
  // undergrowth in front of the trunks
  for (let x = 0; x < W; x++) {
    const top = o.y - Math.round(bumps[(x + 90) % W] * 8 * under);
    p.rect(x, top, 1, 6, shade(o.c, -0.05 + (x % 5 === 0 ? 0.1 : 0)));
  }
}

/** Clumps of reeds and cattails along a bank. */
function reeds(p, o) {
  const r = rng(o.seed);
  p.rect(0, o.y, W, H - o.y, shade(o.c, -0.3));
  const clumps = o.n || 16;
  for (let i = 0; i < clumps; i++) {
    const cx = Math.floor(((i + r() * 0.8) / clumps) * W);
    const count = 3 + Math.floor(r() * 4);
    placeWrapped((x) => {
      for (let s = 0; s < count; s++) {
        const sx = x + s * 2 - count;
        const hh = Math.floor(o.a * (0.45 + r() * 0.55));
        const lean = Math.round((r() - 0.5) * 3);
        const col = s % 2 ? shade(o.c, -0.12) : o.c;
        p.rect(sx, o.y - hh, 1, hh + 1, col);
        p.rect(sx + lean, o.y - hh - 1, 1, 2, col);
        if (o.heads && r() < 0.5) p.rect(sx + lean - 1, o.y - hh - 5, 2, 5, o.heads);
      }
    }, cx, 8);
  }
}

// ---- water ----

/** Where a waterfall layer's falling water is on its canvas: the animated shimmer is drawn over exactly this rectangle. */
export function fallRect(o) {
  const w = o.fw || 12;
  const x = Math.floor(W * (o.at ?? 0.5)) - Math.floor(w / 2);
  return { x, y: o.y - o.a, w, h: o.a };
}

/** A cliff with a waterfall coming over its lip, falling in streaks and ending in a foam pool and a veil of mist. */
function waterfall(p, o) {
  const f = fallRect(o);
  const rock = o.rock || shade(o.c, -0.55);
  const half = (f.w + (o.cliff ?? 70)) / 2;
  const cx = f.x + f.w / 2;
  const lip = f.y;
  const r = rng(o.seed);
  p.rect(0, o.y, W, H - o.y, shade(rock, -0.1));
  // the cliff: a plateau across the middle with ragged shoulders that slope away to the ground
  for (let x = Math.floor(cx - half * 1.5); x <= Math.ceil(cx + half * 1.5); x++) {
    const d = Math.abs(x - cx) / half;
    const ragged = Math.floor(hash2(x >> 1, 6, o.seed) * 4);
    const top = Math.min(o.y, lip + Math.round(Math.max(0, d - 0.5) * o.a * 0.85) + ragged);
    if (top >= o.y) continue;
    const px = (x + W) % W;
    const shadow = x > cx + half * 0.25;
    for (let y = top; y < o.y; y++) {
      const band = (y - lip) % 13 < 2;
      const col = band ? shade(rock, -0.15) : rock;
      p.rect(px, y, 1, 1, shadow ? shade(col, -0.22) : col);
    }
    p.rect(px, top, 1, 1, shade(rock, 0.22));
    if (o.moss && d > 0.2 && hash2(x, 7, o.seed) < 0.7) p.rect(px, top - 1 - Math.floor(hash2(x, 8, o.seed) * 3), 1, 3, o.moss); // shrubs on the lip
  }
  // the falling water: a pale sheet with darker and brighter streaks
  p.rect(f.x, lip, f.w, f.h, o.c);
  for (let s = 0; s < f.w; s += 2) {
    const col = r() < 0.5 ? shade(o.c, 0.28) : shade(o.c, -0.12);
    for (let y = lip; y < o.y; y += 6 + Math.floor(r() * 5)) p.rect(f.x + s, y, 1, 3 + Math.floor(r() * 4), col);
  }
  p.rect(f.x - 1, lip - 1, f.w + 2, 2, shade(o.c, 0.4)); // a lip of white water
  // the pool and its mist
  const pool = o.pool || shade(o.c, -0.25);
  p.ellipse(f.x + Math.floor(f.w / 2), o.y, f.w + 12, 4, pool);
  p.ellipse(f.x + Math.floor(f.w / 2), o.y - 1, f.w + 4, 2, o.foam || '#ffffff');
  ditherDisc(p, f.x + f.w / 2, o.y - 6, f.w * 1.1, o.foam || '#ffffff', 0.33);
  ditherDisc(p, f.x + f.w / 2, o.y - 4, f.w * 0.7, o.foam || '#ffffff', 0.5);
}

/** A still lake: a band of water with rows of ripples, reeds at the shore and, if `glitter`, a trail of sparkle under the sun. */
function lake(p, o) {
  p.rect(0, o.y, W, H - o.y, o.c);
  const r = rng(o.seed);
  for (let y = o.y + 3, row = 0; y < H; y += 4 + Math.floor(row * 0.5), row++) {
    for (let x = Math.floor(r() * 12); x < W; x += 10 + Math.floor(r() * 16)) p.rect(x, y, 3 + Math.floor(r() * 7), 1, row % 2 ? shade(o.c, 0.14) : shade(o.c, -0.1));
  }
  p.rect(0, o.y, W, 1, shade(o.c, 0.3)); // the far shore's line of light
  if (o.glitter) {
    const gx = Math.floor(W * (o.sunAt ?? 0.5));
    for (let y = o.y + 2; y < H; y += 3) {
      const half = 3 + Math.floor((y - o.y) * 0.25);
      for (let x = gx - half; x < gx + half; x += 2) if (dithered(x, y, 0.45)) p.rect(x, y, 2, 1, o.glitter);
    }
  }
}

// ---- the sky ----

/** One soft-edged cloud puff: a shadow ellipse, the body a pixel or two above it, and a highlight toward the light. */
function puff(p, cx, cy, rx, ry, c, shadow, light) {
  p.ellipse(cx, cy + 2, rx, ry, shadow);
  p.ellipse(cx, cy, rx, ry, c);
  p.ellipse(cx - Math.floor(rx * 0.25), cy - Math.floor(ry * 0.35), Math.max(1, Math.floor(rx * 0.55)), Math.max(1, Math.floor(ry * 0.5)), light);
}

/** Cumulus: heaped, lobed clouds with flat grey bottoms. */
function cumulus(p, o) {
  const r = rng(o.seed);
  const shadow = o.shadow || shade(o.c, -0.2);
  const light = o.light || shade(o.c, 0.1);
  const n = o.n || 4;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(((i + 0.2 + r() * 0.6) / n) * W);
    const y = o.y + Math.floor(r() * o.a);
    const w = (o.w || 56) * (0.7 + r() * 0.6);
    placeWrapped((cx) => {
      const lobes = 4 + Math.floor(r() * 3);
      for (let k = 0; k < lobes; k++) {
        const t = k / (lobes - 1);
        const bump = Math.sin(t * Math.PI); // taller in the middle
        puff(p, cx + Math.round((t - 0.5) * w), y - Math.round(bump * 7 + r() * 3), Math.round(w * 0.2 + bump * 8), Math.round(5 + bump * 6), o.c, shadow, light);
      }
      p.rect(cx - Math.floor(w * 0.5), y + 3, Math.floor(w), 3, shadow); // the flat base
      p.rect(cx - Math.floor(w * 0.5) + 2, y + 2, Math.floor(w) - 4, 2, o.c);
    }, x, w);
  }
}

/** Stratus: long flat bands with ragged ends, a pixel of shadow along the bottom. */
function stratus(p, o) {
  const r = rng(o.seed);
  const n = o.n || 4;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(((i + r() * 0.5) / n) * W);
    const y = o.y + Math.floor(r() * o.a);
    const len = 90 + Math.floor(r() * 120);
    placeWrapped((sx) => {
      for (let row = 0; row < 4; row++) {
        const inset = row === 0 || row === 3 ? 10 + Math.floor(r() * 10) : Math.floor(r() * 6);
        p.rect(sx + inset, y + row, len - inset * 2, 1, row === 3 ? o.shadow || shade(o.c, -0.14) : o.c);
      }
      for (let k = 0; k < len; k += 4) if (dithered(k, y, 0.4)) p.rect(sx + k, y - 1, 2, 1, o.c);
    }, x, len);
  }
}

/** Cirrus: high thin streaks that sweep up and over to one side. */
function cirrus(p, o) {
  const r = rng(o.seed);
  const n = o.n || 6;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(((i + r() * 0.8) / n) * W);
    const y = o.y + Math.floor(r() * o.a);
    const len = 30 + Math.floor(r() * 50);
    placeWrapped((sx) => {
      for (let k = 0; k < len; k++) {
        const curve = Math.round(Math.pow(k / len, 2) * 6);
        if (k % 7 < 5) p.px(sx + k, y - curve, o.c);
        if (k % 3 === 0) p.px(sx + k, y - curve + 2, shade(o.c, -0.08));
        if (k % 4 === 1 && dithered(k, y, 0.5)) p.px(sx + k + 2, y - curve + 4, o.c);
      }
    }, x, len);
  }
}

/** The sun or the moon, with a halo of dithered rings. `at` is how far across the screen it sits; `crescent` shades the moon. */
function celestial(p, o) {
  const cx = Math.floor(W * (o.at ?? 0.7));
  const cy = o.y;
  const r = o.r || 12;
  if (o.halo) {
    ditherDisc(p, cx, cy, r * 3.4, o.halo, 0.12);
    ditherDisc(p, cx, cy, r * 2.4, o.halo, 0.24);
    ditherDisc(p, cx, cy, r * 1.6, o.halo, 0.45);
  }
  if (o.crescent) {
    // the lit part of the disc not covered by a second disc pushed toward the shadow side
    const cut = o.crescent;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      const cutHalf = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      const left = cx - half;
      const cutLeft = cx + cut - cutHalf;
      if (cutLeft > left) p.rect(left, cy + dy, Math.min(cutLeft, cx + half) - left, 1, o.c);
    }
  } else {
    p.ellipse(cx, cy, r, r, o.c);
    if (o.core) p.ellipse(cx - 1, cy - 1, Math.floor(r * 0.65), Math.floor(r * 0.65), o.core);
    if (o.craters) {
      for (const [dx, dy, cr] of [[-4, -3, 3], [3, 3, 4], [4, -5, 2], [-5, 4, 2]]) p.ellipse(cx + Math.round((dx * r) / 12), cy + Math.round((dy * r) / 12), Math.max(1, Math.round((cr * r) / 12)), Math.max(1, Math.round((cr * r) / 12)), shade(o.c, -0.14));
    }
  }
}

/** Shafts of light slanting down through the canopy or a cave mouth, as dithered bands that fade toward the ground. */
function rays(p, o) {
  const r = rng(o.seed);
  const n = o.n || 4;
  for (let i = 0; i < n; i++) {
    const x0 = Math.floor(((i + r() * 0.6) / n) * W);
    const w0 = 6 + Math.floor(r() * 8);
    const grow = 0.12 + r() * 0.1;
    const lean = o.lean ?? 0.45;
    const density = 0.25 + r() * 0.2;
    placeWrapped((sx) => {
      for (let y = 0; y < o.a; y += 1) {
        const fade = 1 - y / o.a;
        const cx = sx + Math.round(lean * y);
        const width = Math.round(w0 + grow * y);
        for (let x = cx; x < cx + width; x++) if (dithered(x, y + o.y, density * fade)) p.px(x, o.y + y, o.c);
      }
    }, x0, 60);
  }
}

/** Banks of low fog: bands of dithered 2x2 blocks that thicken and thin along the screen. */
function fogbank(p, o) {
  const bands = o.bands || 2;
  const lump = wrapNoise(o.seed, o.cells || 5, 2);
  for (let b = 0; b < bands; b++) {
    const y0 = o.y + Math.floor((b * o.a) / bands);
    const thick = Math.floor(o.a / bands) + 4;
    for (let y = 0; y < thick; y += 2) {
      const profile = Math.sin((y / thick) * Math.PI); // densest in the middle of the band
      for (let x = 0; x < W; x += 2) {
        const density = profile * (0.1 + lump[(x + b * 77) % W] * (o.density ?? 1.1));
        if (dithered(x >> 1, (y0 + y) >> 1, density)) p.rect(x, y0 + y, 2, 2, o.c);
      }
    }
  }
}

/**
 * The northern lights: curtains of vertical streaks that sway along the screen. Each streak is brightest where the curtain hangs
 * lowest and thins into dither as it climbs, colour passing from the first colour at the foot to the second at the top.
 */
function aurora(p, o) {
  const sway = wrapNoise(o.seed, 3, 2);
  const lumps = wrapNoise(o.seed + 11, 8, 2);
  const [low, mid, high] = o.colors || [o.c, mix(o.c, o.c2 || o.c, 0.5), o.c2 || o.c];
  for (let x = 0; x < W; x += 2) {
    const base = Math.round(o.y + (sway[x] - 0.5) * o.a * 0.7);
    const len = Math.round((0.3 + lumps[x] * 0.7) * o.a);
    const streak = 0.55 + 0.45 * Math.sin(x * 1.3 + lumps[x] * 9); // vertical rays within the curtain
    const solidLow = Math.floor(len * 0.35 * streak);
    const solidMid = Math.floor(len * 0.25 * streak);
    p.rect(x, base - solidLow, 2, solidLow, low);
    p.rect(x, base - solidLow - solidMid, 2, solidMid, mid);
    const top = base - solidLow - solidMid;
    for (let y = top; y > base - len; y -= 2) {
      const t = (top - y) / Math.max(1, len - solidLow - solidMid); // 0 where the solid part ends, 1 at the very top
      if (dithered(x >> 1, y >> 1, (1 - t) * 0.75 * streak)) p.rect(x, y, 2, 2, t < 0.5 ? mid : high);
    }
    p.rect(x, base, 2, 1, shade(low, 0.25)); // the bright lower edge
  }
}

export const NATURE = {
  ridges,
  mesa,
  spires,
  arches,
  canyon,
  forest,
  reeds,
  waterfall,
  lake,
  cumulus,
  stratus,
  cirrus,
  celestial,
  rays,
  fogbank,
  aurora,
};

export { TREES, ditherDisc, sampleWrap, VIEW_H };
