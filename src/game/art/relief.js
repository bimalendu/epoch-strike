// Terrain relief: the parts of the ground that are not a square tile. Grass, snow and moss growing up out of the surface
// (a "fringe"), roots, icicles and stalactites hanging from an overhang (an "underside"), the layers of soil and rock
// below the surface (strata) and the little plants and stones that sit on top (decor).
//
// The painters take a `tops` (fringes) or `bottoms` (undersides) array giving, for each of the 16 columns, the y where the
// ground surface (or the lip of the overhang) is in the painter being drawn on. A flat tile uses a 16x8 strip with every
// column at the strip's edge; a slope cell passes its own diagonal. Everything is rectangles.

import { Painter } from '../../engine/gfx.js';
import { hash2 } from '../../engine/rng.js';
import { shade } from './common.js';

/** How far (px) a fringe rises above its tile and an underside hangs below it. The tile layer clears and repaints this much around a changed cell. */
export const RELIEF_REACH = 8;

const hv = (v, i) => hash2(v, i, 131);

/** Fill column x from the surface at `top` up by `ht` px (clipped to the painter), with a lighter tip. */
function blade(p, x, top, ht, c, tip = null) {
  const h = Math.min(ht, top);
  if (h <= 0) return;
  p.rect(x, top - h, 1, h, c);
  if (tip && h >= 2) p.px(x, top - h, tip);
}

// ---- fringes: growth on top of the ground ----
export const FRINGES = {
  /** Blades of grass in uneven clumps. */
  grass(p, c, v, tops) {
    const dark = shade(c, -0.18);
    const tip = shade(c, 0.3);
    for (let x = 0; x < 16; x++) {
      const clump = hv(v, 40 + (x >> 2)) > 0.55 ? 1 : 0;
      const ht = Math.floor(hv(v, x) * 3.2) + clump;
      blade(p, x, tops[x], ht, x & 1 ? dark : c, tip);
    }
  },
  /** Rounded drifts of snow, a pixel of shadow under each lump. */
  snow(p, c, v, tops) {
    const phase = hv(v, 3) * 6;
    for (let x = 0; x < 16; x++) {
      const ht = Math.max(0, Math.round(1.6 + 1.6 * Math.sin(x * 0.6 + phase) + hv(v, x) * 0.8));
      blade(p, x, tops[x], ht, c, '#ffffff');
      if (ht > 0 && tops[x] - ht >= 0) p.px(x, tops[x] - 1, shade(c, -0.12));
    }
  },
  /** A lip of wind-blown sand, ripples a pixel or two high. */
  sand(p, c, v, tops) {
    const o = Math.floor(hv(v, 1) * 6);
    for (let x = 0; x < 16; x++) {
      const ht = (x + o) % 9 < 2 ? 2 : (x + o) % 6 < 2 ? 1 : 0;
      blade(p, x, tops[x], ht, c, shade(c, 0.2));
    }
  },
  /** Moss: short, dark and fuzzy. */
  moss(p, c, v, tops) {
    for (let x = 0; x < 16; x++) {
      const r = hv(v, x);
      blade(p, x, tops[x], r < 0.55 ? 1 + (hv(v, x + 50) < 0.35 ? 1 : 0) : 0, r < 0.2 ? shade(c, -0.2) : c);
    }
  },
  /** A few loose stones lying on the surface, each column of a stone resting on the ground under it. */
  rubble(p, c, v, tops) {
    for (let i = 0; i < 3; i++) {
      const x0 = Math.floor(hv(v, i * 3) * 13);
      const w = 2 + Math.floor(hv(v, i * 3 + 1) * 2);
      const ht = 1 + Math.floor(hv(v, i * 3 + 2) * 2);
      for (let x = x0; x < x0 + w; x++) {
        if (tops[x] - ht < 0) continue;
        p.rect(x, tops[x] - ht, 1, ht, i & 1 ? shade(c, -0.15) : c);
        if (x === x0) p.px(x, tops[x] - ht, shade(c, 0.3));
      }
    }
  },
  /** Weeds pushing up through cracks: sparse thin stalks with a leaf. */
  weed(p, c, v, tops) {
    for (let x = 0; x < 16; x++) {
      if (hv(v, x) > 0.22) continue;
      const ht = 2 + Math.floor(hv(v, x + 30) * 3);
      blade(p, x, tops[x], ht, c);
      const leaf = x < 15 ? x + 1 : x - 1;
      if (tops[x] - ht + 1 >= 0) p.px(leaf, tops[x] - ht + 1, shade(c, 0.2));
    }
  },
};

// ---- undersides: what hangs below an overhang ----
/** Fill column x from `from` down by `len` px, with a darker tip. */
function strand(p, x, from, len, c, tip = null) {
  const h = Math.min(len, p.h - from);
  if (h <= 0) return;
  p.rect(x, from, 1, h, c);
  if (tip && h >= 2) p.px(x, from + h - 1, tip);
}

/** A hanging spike `len` px long, `w` px wide at the root, narrowing to a point. */
function spike(p, cx, from, len, w, c, lit) {
  for (let r = 0; r < len; r++) {
    const rw = Math.max(1, Math.round(w * (1 - r / len)));
    if (from + r >= p.h) break;
    p.rect(cx - Math.floor(rw / 2), from + r, rw, 1, c);
  }
  if (from + 1 < p.h) p.px(cx - Math.floor(w / 2), from + 1, lit);
}

export const UNDERSIDES = {
  /** Roots and rootlets. */
  roots(p, c, v, bottoms) {
    for (let x = 0; x < 16; x += 3) {
      if (hv(v, x) > 0.7) continue;
      const len = 2 + Math.floor(hv(v, x + 20) * 6);
      strand(p, x, bottoms[x], len, c, shade(c, -0.3));
      if (len > 4 && x < 15) p.px(x + 1, bottoms[x] + len - 3, c);
    }
  },
  /** Icicles. */
  icicle(p, c, v, bottoms) {
    for (let i = 0; i < 4; i++) {
      const cx = i * 4 + 1 + Math.floor(hv(v, i) * 2);
      spike(p, cx, bottoms[cx], 3 + Math.floor(hv(v, i + 9) * 5), 3, c, '#ffffff');
    }
  },
  /** Stalactites: broader and shorter than icicles, in the colour of the rock. */
  stalactite(p, c, v, bottoms) {
    for (let i = 0; i < 3; i++) {
      const cx = 2 + i * 5 + Math.floor(hv(v, i) * 2);
      spike(p, cx, bottoms[cx], 3 + Math.floor(hv(v, i + 9) * 4), 4, c, shade(c, 0.25));
    }
  },
  /** Drips of seepage ending in a bead. */
  drip(p, c, v, bottoms) {
    for (let x = 1; x < 16; x += 4) {
      if (hv(v, x) > 0.65) continue;
      const len = 1 + Math.floor(hv(v, x + 20) * 3);
      strand(p, x, bottoms[x], len, c);
      p.px(x, bottoms[x] + len + 1, shade(c, 0.35));
    }
  },
  /** Hanging vines with the odd leaf. */
  vine(p, c, v, bottoms) {
    for (let x = 1; x < 16; x += 4) {
      if (hv(v, x) > 0.75) continue;
      const len = 3 + Math.floor(hv(v, x + 20) * 6);
      strand(p, x, bottoms[x], len, shade(c, -0.15));
      p.px(x + 1, bottoms[x] + 2, c);
      p.px(x - 1, bottoms[x] + len - 2, c);
    }
  },
};

const stripCache = new Map();
const FLAT_TOPS = new Array(16).fill(RELIEF_REACH);
const FLAT_BOTTOMS = new Array(16).fill(0);

/** A 16x8 strip that sits on top of a tile (the growth reaches up into the cell above). */
export function fringeStrip(themeId, fringe, v) {
  const key = `${themeId}|fringe|${v}`;
  let c = stripCache.get(key);
  if (!c) {
    const p = new Painter(16, RELIEF_REACH);
    FRINGES[fringe.shape](p, fringe.c, v, FLAT_TOPS);
    c = p.canvas;
    stripCache.set(key, c);
  }
  return c;
}

/** A 16x8 strip that hangs below a tile with an open bottom. */
export function undersideStrip(themeId, under, v) {
  const key = `${themeId}|under|${v}`;
  let c = stripCache.get(key);
  if (!c) {
    const p = new Painter(16, RELIEF_REACH);
    UNDERSIDES[under.shape](p, under.c, v, FLAT_BOTTOMS);
    c = p.canvas;
    stripCache.set(key, c);
  }
  return c;
}

// ---- strata ----
/** How many tiles of ground lie above each band: topsoil to 2 tiles down, subsoil to 6, then bedrock. */
export const STRATA_DEPTHS = [2, 6];

/** The band (0 topsoil, 1 subsoil, 2 bedrock) of a tile `depth` filled tiles below the surface. */
export function strataBand(depth) {
  return depth < STRATA_DEPTHS[0] ? 0 : depth < STRATA_DEPTHS[1] ? 1 : 2;
}

/** The style of a ground tile in a deeper band: its colours darken, and `sub` / `deep` override them where a theme sets them. */
export function strataStyle(s, band) {
  if (!band) return s;
  const base = band === 1 ? s.sub || shade(s.base, -0.13) : s.deep || shade(s.base, -0.27);
  return { ...s, base, dark: shade(s.dark, -0.1 * band), light: shade(base, 0.14), top: undefined, vein: band === 2 ? s.vein : undefined };
}

/** Stones, roots and the odd fossil embedded in deeper soil. */
export function paintStrata(p, s, band, v) {
  if (!band) return;
  for (let i = 0; i < band + 1; i++) {
    const x = 1 + Math.floor(hv(v, i * 5) * 11);
    const y = 2 + Math.floor(hv(v, i * 5 + 1) * 11);
    p.rect(x, y, 3, 2, shade(s.base, band === 1 ? 0.12 : -0.2));
    p.px(x, y, shade(s.base, 0.3));
  }
  if (band === 1 && s.under && s.under.shape === 'roots' && hv(v, 70) < 0.5) {
    const x = Math.floor(hv(v, 71) * 13) + 1;
    p.rect(x, 0, 1, 5, s.under.c);
    p.px(x + 1, 3, s.under.c);
  }
  if (band === 2 && hv(v, 80) < 0.35) {
    // a fossil: the outline of a small fish
    const x = 2 + Math.floor(hv(v, 81) * 6);
    const y = 4 + Math.floor(hv(v, 82) * 7);
    const bone = shade(s.base, 0.35);
    p.rect(x + 1, y - 1, 3, 1, bone);
    p.rect(x, y, 5, 1, bone);
    p.rect(x + 1, y + 1, 3, 1, bone);
    p.px(x + 5, y - 1, bone);
    p.px(x + 5, y + 1, bone);
    p.px(x + 1, y, shade(s.base, -0.3));
  }
}

// ---- decor: small things that sit on the ground ----
export const DECOR = {
  tuft(p, c) {
    p.rect(1, 3, 1, 3, c); p.rect(3, 1, 1, 5, c); p.rect(5, 2, 1, 4, c); p.rect(7, 4, 1, 2, c);
    p.rect(3, 1, 1, 1, shade(c, 0.35));
  },
  flower(p, c) {
    p.rect(3, 3, 1, 4, '#3a8a3a'); p.rect(2, 1, 3, 3, c); p.rect(3, 2, 1, 1, '#ffffff');
  },
  pebbles(p, c) {
    p.rect(1, 3, 3, 2, c); p.rect(1, 3, 3, 1, shade(c, 0.3)); p.rect(5, 4, 2, 1, shade(c, -0.2));
  },
  bones(p, c) {
    p.rect(1, 3, 6, 1, c); p.rect(0, 2, 2, 3, c); p.rect(6, 2, 2, 3, c); p.rect(3, 1, 2, 2, c);
  },
  crystal(p, c) {
    p.rect(2, 2, 2, 5, c); p.rect(1, 4, 1, 3, shade(c, -0.25)); p.rect(4, 3, 1, 4, shade(c, -0.25));
    p.rect(2, 1, 1, 1, shade(c, 0.5)); p.px(2, 3, '#ffffff');
  },
  snowpile(p, c) {
    p.rect(1, 4, 6, 2, c); p.rect(2, 3, 4, 1, c); p.rect(1, 5, 6, 1, shade(c, -0.1));
  },
  /** A fern frond: a stem with leaflets stepping up and out. */
  fern(p, c) {
    p.rect(3, 2, 1, 5, shade(c, -0.25));
    p.rect(1, 5, 2, 1, c); p.rect(4, 5, 2, 1, c); p.rect(0, 4, 2, 1, c); p.rect(5, 4, 3, 1, c);
    p.rect(1, 3, 2, 1, c); p.rect(4, 3, 2, 1, c); p.rect(2, 1, 3, 1, shade(c, 0.25));
  },
  /** A toadstool. */
  mushroom(p, c) {
    p.rect(3, 4, 2, 3, '#e8e0cc'); p.rect(1, 2, 6, 2, c); p.rect(2, 1, 4, 1, c);
    p.px(2, 2, '#ffffff'); p.px(5, 3, '#ffffff'); p.rect(1, 4, 6, 1, shade(c, -0.3));
  },
  /** Reeds, or cattails, with a brown head. */
  reeds(p, c) {
    p.rect(1, 2, 1, 5, c); p.rect(4, 0, 1, 7, c); p.rect(6, 3, 1, 4, c);
    p.rect(4, 0, 1, 2, '#6a4a2a'); p.rect(1, 2, 1, 1, '#6a4a2a');
  },
  /** A small cactus with one arm. */
  cactus(p, c) {
    p.rect(3, 1, 2, 6, c); p.rect(1, 3, 2, 1, c); p.rect(1, 2, 1, 2, c); p.rect(5, 4, 2, 1, c); p.rect(6, 3, 1, 2, c);
    p.rect(3, 1, 1, 6, shade(c, 0.2)); p.px(3, 0, '#ff9ac8');
  },
  /** A cushion of moss. */
  moss(p, c) {
    p.rect(1, 4, 6, 2, c); p.rect(2, 3, 4, 1, c); p.rect(1, 5, 6, 1, shade(c, -0.25)); p.px(3, 3, shade(c, 0.3)); p.px(5, 4, shade(c, 0.3));
  },
  /** Kelp fronds on the seabed. */
  kelp(p, c) {
    p.rect(1, 3, 1, 4, c); p.rect(2, 1, 1, 4, shade(c, 0.15)); p.rect(4, 2, 1, 5, c); p.rect(5, 0, 1, 4, shade(c, 0.15)); p.rect(6, 4, 1, 3, c);
  },
  /** A shell on the sand. */
  shell(p, c) {
    p.rect(2, 4, 4, 2, c); p.rect(3, 3, 2, 1, c); p.rect(2, 5, 4, 1, shade(c, -0.25)); p.px(3, 4, shade(c, 0.4)); p.px(5, 4, shade(c, -0.15));
  },
  /** A shard of ice. */
  shard(p, c) {
    p.rect(3, 1, 2, 6, c); p.rect(2, 3, 1, 4, shade(c, -0.2)); p.rect(5, 4, 1, 3, shade(c, -0.2)); p.px(3, 0, '#ffffff'); p.px(3, 2, '#ffffff');
  },
  /** Dry, bent grass. */
  drygrass(p, c) {
    p.rect(1, 3, 1, 3, c); p.rect(2, 2, 1, 1, c); p.rect(3, 1, 1, 5, c); p.rect(4, 0, 1, 1, c); p.rect(5, 2, 1, 4, c); p.rect(6, 3, 1, 1, c);
    p.px(3, 1, shade(c, 0.3));
  },
  /** A weed growing out of a crack. */
  weed(p, c) {
    p.rect(3, 3, 1, 4, c); p.rect(1, 3, 2, 1, c); p.rect(4, 2, 2, 1, c); p.rect(2, 2, 1, 1, shade(c, 0.3)); p.px(5, 1, shade(c, 0.3));
  },
};

const decorCache = new Map();
/** The 8x7 sprite for a decor kind in a colour (an unknown kind draws pebbles). */
export function decorSprite(kind, color) {
  const key = `${kind}|${color}`;
  let c = decorCache.get(key);
  if (!c) {
    const p = new Painter(8, 7);
    (DECOR[kind] || DECOR.pebbles)(p, color);
    c = p.canvas;
    decorCache.set(key, c);
  }
  return c;
}

/** Paint every relief sprite a theme can use, so none is made while the level is played. */
export function warmRelief(themeId, theme) {
  const s = theme.tiles.solid;
  for (let v = 0; v < 4; v++) {
    if (s.fringe) fringeStrip(themeId, s.fringe, v);
    if (s.under) undersideStrip(themeId, s.under, v);
  }
  for (const d of theme.decor || []) decorSprite(d.k, d.c);
}
