// Procedural 16x16 tile art. A "style" is { kind, ...palette }; the painter adds an exposed-edge mask so
// ground gets a grassy / snowy / glowing top where it meets the air, shaded sides, and speckle variants.
// Everything is rects, so it renders the same in the browser and in the software canvas.

import { Painter } from '../../engine/gfx.js';
import { hash2 } from '../../engine/rng.js';
import { shade } from './common.js';
import { SLOPE, floorHeight, slopeSpan } from '../tiles.js';
import { strataStyle, paintStrata, FRINGES } from './relief.js';

export const TOP = 1;
export const LEFT = 2;
export const RIGHT = 4;
export const BOTTOM = 8;

const cache = new Map();

/** The ground kinds that read as earth rather than masonry: they get rounded corners and strata. */
const ORGANIC = { earth: 1, rock: 1, sand: 1 };

function h(v, i) {
  return hash2(v, i, 77);
}

function specks(p, v, color, n, w = 2) {
  for (let i = 0; i < n; i++) {
    p.rect(Math.floor(h(v, i * 2) * (16 - w)), 2 + Math.floor(h(v, i * 2 + 1) * 12), w, 1, color);
  }
}

function edges(p, s, mask) {
  if (mask & LEFT) p.rect(0, 0, 1, 16, shade(s.base, -0.28));
  if (mask & RIGHT) p.rect(15, 0, 1, 16, shade(s.base, -0.28));
  if (mask & BOTTOM) p.rect(0, 15, 16, 1, shade(s.base, -0.4));
}

// ---- ground kinds ----
const KINDS = {
  // soil with a grass (or snow, moss...) cap
  earth(p, s, mask, v) {
    p.rect(0, 0, 16, 16, s.base);
    specks(p, v, s.dark, 4);
    specks(p, v + 9, s.light || shade(s.base, 0.18), 3, 1);
    if (mask & TOP) {
      p.rect(0, 0, 16, 4, s.top);
      p.rect(0, 3, 16, 1, s.topDark || shade(s.top, -0.3));
      for (let x = 0; x < 16; x += 2) {
        const d = Math.floor(h(v, x + 40) * 3);
        if (d > 0) p.rect(x, 4, 2, d, s.top);
      }
      p.rect(0, 0, 16, 1, shade(s.top, 0.25));
    }
    edges(p, s, mask);
  },
  // masonry: staggered blocks with mortar
  stone(p, s, mask, v) {
    p.rect(0, 0, 16, 16, s.base);
    const mortar = s.dark;
    p.rect(0, 7, 16, 1, mortar);
    p.rect(0, 15, 16, 1, mortar);
    const off = (v & 1) * 4;
    p.rect((4 + off) % 16, 0, 1, 7, mortar);
    p.rect((12 + off) % 16, 8, 1, 7, mortar);
    p.rect(1, 1, 5, 1, s.light || shade(s.base, 0.2));
    p.rect(9, 9, 5, 1, s.light || shade(s.base, 0.2));
    specks(p, v, shade(s.base, -0.1), 2, 1);
    if (mask & TOP) {
      p.rect(0, 0, 16, 2, s.top || shade(s.base, 0.3));
      p.rect(0, 2, 16, 1, s.dark);
    }
    edges(p, s, mask);
  },
  // rough rock / cave wall / lava rock
  rock(p, s, mask, v) {
    p.rect(0, 0, 16, 16, s.base);
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(h(v, i) * 11);
      const y = 3 + Math.floor(h(v, i + 20) * 10);
      p.rect(x, y, 4, 2, s.dark);
      p.rect(x, y, 4, 1, s.light || shade(s.base, 0.12));
    }
    if (s.vein && h(v, 61) < 0.3) {
      const x = Math.floor(h(v, 60) * 10) + 2;
      p.rect(x, 5, 1, 3, s.vein);
      p.rect(x + 1, 8, 1, 2, s.vein);
    }
    if (mask & TOP) {
      p.rect(0, 0, 16, 3, s.top || shade(s.base, 0.25));
      p.rect(0, 3, 16, 1, s.dark);
    }
    edges(p, s, mask);
  },
  // dunes and desert rock
  sand(p, s, mask, v) {
    p.rect(0, 0, 16, 16, s.base);
    for (let y = 3; y < 16; y += 4) {
      const o = Math.floor(h(v, y) * 10);
      p.rect(o, y, 6, 1, s.dark);
      p.rect((o + 8) % 12, y + 2, 4, 1, s.light || shade(s.base, 0.18));
    }
    if (mask & TOP) {
      p.rect(0, 0, 16, 3, s.top || shade(s.base, 0.22));
      p.rect(0, 3, 16, 1, s.dark);
    }
    edges(p, s, mask);
  },
  // riveted plates, hulls, train roofs
  metal(p, s, mask, v) {
    p.rect(0, 0, 16, 16, s.base);
    p.rect(0, 0, 16, 1, s.light || shade(s.base, 0.25));
    p.rect(0, 15, 16, 1, s.dark);
    p.rect(0, 0, 1, 16, shade(s.base, 0.1));
    p.rect(15, 0, 1, 16, s.dark);
    for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
      p.rect(x, y, 2, 2, s.dark);
      p.px(x, y, s.light || shade(s.base, 0.3));
    }
    if (s.stripe && v % 3 === 0) p.rect(0, 7, 16, 2, s.stripe);
    if (mask & TOP) {
      p.rect(0, 0, 16, 2, s.top || shade(s.base, 0.35));
    }
  },
  // wooden planks (ship decks, bridges)
  wood(p, s, mask, v) {
    p.rect(0, 0, 16, 16, s.base);
    for (let y = 0; y < 16; y += 5) {
      p.rect(0, y, 16, 1, s.dark);
      p.rect(Math.floor(h(v, y) * 12), y + 2, 1, 3, s.dark);
    }
    p.rect(0, 1, 16, 1, s.light || shade(s.base, 0.18));
    specks(p, v, shade(s.base, -0.12), 2, 3);
    if (mask & TOP) p.rect(0, 0, 16, 2, s.top || shade(s.base, 0.3));
    edges(p, s, mask);
  },
  // dark panels with a glowing edge (future cities)
  neon(p, s, mask, v) {
    p.rect(0, 0, 16, 16, s.base);
    p.rect(1, 1, 14, 14, shade(s.base, 0.07));
    p.rect(0, 0, 16, 1, s.dark);
    p.rect(0, 15, 16, 1, s.dark);
    if (h(v, 3) > 0.5) p.rect(3, 6, 10, 1, shade(s.glow, -0.55));
    if (h(v, 4) > 0.6) p.rect(5, 10, 6, 1, shade(s.glow, -0.55));
    if (mask & TOP) {
      p.rect(0, 0, 16, 2, s.glow);
      p.rect(0, 2, 16, 1, shade(s.glow, -0.6));
    }
    edges(p, s, mask);
  },
};

// ---- one-way platforms (5px slabs at the top of the tile) ----
const PLATFORMS = {
  wood(p, s) {
    p.rect(0, 0, 16, 5, s.base);
    p.rect(0, 0, 16, 1, s.light || shade(s.base, 0.3));
    p.rect(0, 4, 16, 1, s.dark);
    p.rect(5, 1, 1, 3, s.dark);
    p.rect(11, 1, 1, 3, s.dark);
  },
  stone(p, s) {
    p.rect(0, 0, 16, 5, s.base);
    p.rect(0, 0, 16, 1, s.light || shade(s.base, 0.3));
    p.rect(0, 4, 16, 1, s.dark);
    p.rect(8, 1, 1, 4, s.dark);
  },
  metal(p, s) {
    p.rect(0, 0, 16, 5, s.base);
    p.rect(0, 0, 16, 1, s.light || shade(s.base, 0.35));
    for (let x = 1; x < 16; x += 3) p.rect(x, 2, 2, 2, s.dark);
  },
  neon(p, s) {
    p.rect(0, 1, 16, 3, s.base);
    p.rect(0, 0, 16, 1, s.glow);
    p.rect(0, 4, 16, 1, shade(s.glow, -0.5));
  },
  ice(p, s) {
    p.rect(0, 0, 16, 5, s.base);
    p.rect(0, 0, 16, 1, '#ffffff');
    p.rect(2, 2, 4, 1, shade(s.base, 0.4));
  },
};

function paintIce(p, mask, v) {
  p.rect(0, 0, 16, 16, '#8fd0ea');
  p.rect(0, 0, 16, 3, '#d8f4ff');
  p.rect(0, 3, 16, 1, '#b4e4f6');
  p.rect(3 + (v % 4), 6, 1, 4, '#bdeaf8');
  p.rect(9, 9, 4, 1, '#bdeaf8');
  p.rect(0, 15, 16, 1, '#6aa8c8');
  if (mask & LEFT) p.rect(0, 0, 1, 16, '#6aa8c8');
  if (mask & RIGHT) p.rect(15, 0, 1, 16, '#6aa8c8');
}

function paintSpike(p, s, v) {
  const col = s.spike || '#c8ccd8';
  const dark = shade(col, -0.45);
  for (let i = 0; i < 4; i++) {
    const x = i * 4;
    p.rect(x, 12, 4, 4, dark);
    p.rect(x + 1, 8, 2, 4, col);
    p.rect(x + 1, 4, 2, 4, col);
    p.px(x + 1, 3, col);
    p.px(x + 2, 4, '#ffffff');
  }
}

function paintDoor(p, s) {
  p.rect(0, 0, 16, 16, '#3a3d4a');
  p.rect(0, 0, 16, 1, '#6a6e80');
  p.rect(0, 0, 1, 16, '#6a6e80');
  p.rect(15, 0, 1, 16, '#22242c');
  for (let y = 3; y < 16; y += 6) p.rect(3, y, 10, 2, '#22242c');
  p.rect(7, 0, 2, 16, '#555a6c');
}

function paintConveyor(p, s, dir) {
  p.rect(0, 0, 16, 16, '#4a4d5c');
  p.rect(0, 0, 16, 5, '#2c2e3a');
  p.rect(0, 0, 16, 1, '#8a8ea2');
  for (let x = 0; x < 16; x += 4) {
    const px = dir > 0 ? x : 12 - x;
    p.rect(px, 2, 2, 1, '#e8c23a');
  }
  p.rect(0, 5, 16, 1, '#22242c');
}

function paintQuick(p, s, v) {
  p.rect(0, 0, 16, 16, s.quick || '#b8985a');
  specks(p, v, '#8a6e3a', 5, 2);
  p.rect(0, 0, 16, 2, '#d8bc7c');
}

/** Thickness (px) of the cap along the surface of a slope, by ground kind. */
const CAP_DEPTH = { earth: 4, stone: 2, rock: 3, sand: 3, metal: 2, wood: 2, neon: 2 };

/** The colour of the lit cap of a ground style. */
function capColor(s) {
  return s.kind === 'neon' ? s.glow : s.top || shade(s.base, s.kind === 'stone' ? 0.3 : 0.22);
}

/**
 * A slope cell: the ground's own texture, cut off along the slope's line (cleared above it, one pixel column at a time) with
 * the kind's cap running down the diagonal and, for earth, a fringe of blades on top of it.
 */
function paintSlope(p, s, id, v, fringe) {
  KINDS[s.kind](p, s, 0, v);
  const cap = capColor(s);
  const depth = CAP_DEPTH[s.kind];
  const lowCap = s.topDark || shade(cap, -0.3);
  const tops = []; // where each column's growth starts: 0 (nowhere to grow) where the surface is not in this cell
  const [from, to] = slopeSpan(id);
  for (let x = 0; x < 16; x++) {
    const top = 16 - Math.round(floorHeight(id, x + 0.5));
    // no cap where the surface is not in this cell (the lower half of a steep slope is buried by the cell above it)
    const buried = top >= 16 || x + 0.5 < from || x + 0.5 > to;
    tops.push(buried ? 0 : top);
    if (top > 0) p.ctx.clearRect(x, 0, 1, top);
    if (buried) continue;
    p.rect(x, top, 1, depth, cap);
    p.px(x, top + depth, lowCap);
    p.px(x, top, shade(cap, 0.2));
  }
  if (fringe) fringe.paint(p, fringe.c, v, tops);
}

/** Nibble the exposed top corners of organic ground: a two pixel chamfer, so earth does not end in square blocks. */
function chamfer(p, mask) {
  if (!(mask & TOP)) return;
  if (mask & LEFT) {
    p.ctx.clearRect(0, 0, 2, 1);
    p.ctx.clearRect(0, 1, 1, 1);
  }
  if (mask & RIGHT) {
    p.ctx.clearRect(14, 0, 2, 1);
    p.ctx.clearRect(15, 1, 1, 1);
  }
}

/**
 * Get the sprite for a tile in a theme.
 * `band` is the strata band of ground tiles (0 topsoil, 1 subsoil, 2 bedrock; see relief.js).
 * @param theme  theme object (see themes.js) with theme.tiles = { solid, wall, platform, spike... }
 */
export function tileSprite(theme, id, mask, variant, T, band = 0) {
  const v = variant & 3; // the cache is keyed by this, so the painters must only ever see this
  const key = `${theme.id}|${id}|${mask}|${v}|${band}`;
  let c = cache.get(key);
  if (c) return c;
  const p = new Painter(16, 16);
  const ts = theme.tiles;
  if (SLOPE[id]) {
    const s = ts.solid;
    paintSlope(p, s, id, v, s.fringe && { paint: FRINGES[s.fringe.shape], c: s.fringe.c });
    c = p.canvas;
    cache.set(key, c);
    return c;
  }
  switch (id) {
    case T.SOLID: {
      const s = ORGANIC[ts.solid.kind] ? strataStyle(ts.solid, band) : ts.solid;
      KINDS[s.kind](p, s, mask, v);
      if (ORGANIC[s.kind]) {
        paintStrata(p, s, band, v);
        chamfer(p, mask);
      }
      break;
    }
    case T.WALL:
      KINDS[(ts.wall || ts.solid).kind](p, ts.wall || ts.solid, mask, v);
      break;
    case T.PLATFORM:
      PLATFORMS[(ts.platform || { kind: 'wood' }).kind](p, ts.platform || { base: '#8a6a3a', dark: '#4a3220' });
      break;
    case T.ICE:
      paintIce(p, mask, v);
      break;
    case T.SPIKE:
      paintSpike(p, ts, v);
      break;
    case T.DOOR:
      paintDoor(p, ts);
      break;
    case T.CONV_R:
      paintConveyor(p, ts, 1);
      break;
    case T.CONV_L:
      paintConveyor(p, ts, -1);
      break;
    case T.QUICK:
      paintQuick(p, ts, v);
      break;
    default:
      p.rect(0, 0, 16, 16, '#ff00ff');
  }
  c = p.canvas;
  cache.set(key, c);
  return c;
}
