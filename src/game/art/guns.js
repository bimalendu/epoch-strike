// Player gun sprites: one per weapon, pre-baked at five angles (-90, -45, 0, 45, 90 degrees from "pointing right").
// The aim is 8-way, so the other three directions are the same sprites mirrored by `blit`.
//
// A gun is a list of segments along the barrel axis: [from, offset, to, offset, thickness, colour], where `from`/`to` are
// pixels away from the shoulder along the aim and `offset` is pixels toward the underside of the gun. Segments are laid
// down in order, so later ones draw over earlier ones. Add a weapon at the sentinel; an id with no art uses the rifle's.

import { Painter } from '../../engine/gfx.js';
import { bake, PAD } from './bake.js';

export const GUN = '#2a2a2e', GUNL = '#9a9aa6';
const WOOD = '#7a4a1e', WOODL = '#a8702e', STEEL = '#8e929e', DARK = '#17171c';

const R = 22; // radius of the working canvas around the shoulder
const SIZE = R * 2 + 1;
const ANGLES = [-90, -45, 0, 45, 90];

export const GUN_ART = {};

GUN_ART.rifle = [
  [2, 1, 7, 1, 3, WOOD],
  [2, 0, 7, 0, 1, WOODL],
  [6, 0, 13, 0, 3, GUN],
  [7, 3, 9, 3, 3, GUN], // magazine
  [6, 0, 13, 0, 1, '#4a4a54'],
  [12, 0, 17, 0, 1, GUNL],
  [17, -1, 17, -1, 1, '#ffe66b'], // front sight
];

GUN_ART.machine = [
  [2, 1, 7, 1, 3, WOOD],
  [6, 0, 14, 0, 4, GUN],
  [6, -1, 14, -1, 1, '#4a4a54'],
  [8, 3, 10, 4, 5, '#3a3a44'], // drum magazine
  [9, 3, 9, 4, 1, '#cfe8ff'],
  [14, 0, 18, 0, 2, GUNL],
  [18, -1, 18, 1, 1, DARK],
];

GUN_ART.spread = [
  [2, 1, 6, 1, 3, WOOD],
  [5, 0, 12, 0, 4, '#3a4a3a'],
  [5, -1, 12, -1, 1, '#7dff7a'],
  [12, -2, 17, -2, 1, GUNL],
  [12, 0, 17, 0, 1, GUNL],
  [12, 2, 17, 2, 1, GUNL],
  [12, -2, 12, 2, 1, DARK],
];

GUN_ART.laser = [
  [2, 0, 6, 0, 3, '#2a4a60'],
  [5, 0, 13, 0, 3, '#dfeaf6'],
  [5, -1, 13, -1, 1, '#ffffff'],
  [7, 1, 11, 1, 1, '#5ad8ff'],
  [13, 0, 17, 0, 2, '#5ad8ff'],
  [17, 0, 18, 0, 2, '#ffffff'],
];

GUN_ART.flame = [
  [2, 0, 6, 0, 3, GUN],
  [3, 3, 9, 3, 4, '#a63a1a'], // fuel tank
  [3, 2, 9, 2, 1, '#e87a3a'],
  [6, 0, 14, 0, 3, STEEL],
  [14, 0, 17, 0, 2, DARK],
  [17, -1, 18, -1, 2, '#ff9a1e'], // pilot light
  [18, -2, 18, -2, 1, '#ffe27a'],
];

GUN_ART.homing = [
  [1, 0, 13, 0, 5, '#4a5a3a'], // launch tube
  [1, -2, 13, -2, 1, '#7a8a62'],
  [4, 0, 4, 0, 5, '#2a3a1a'],
  [9, 0, 9, 0, 5, '#2a3a1a'],
  [13, 0, 15, 0, 5, DARK],
  [14, 0, 17, 0, 3, '#b58aff'], // warhead showing
  [17, 0, 17, 0, 1, '#ffffff'],
];

GUN_ART.spear = [
  [0, 0, 18, 0, 1, WOOD],
  [0, -1, 18, -1, 1, WOODL],
  [8, -1, 9, 1, 1, '#c8302a'], // grip wrap
  [16, 0, 18, 0, 3, '#ffb04a'],
  [18, 0, 20, 0, 1, '#ffe27a'],
  [17, -2, 17, -2, 1, '#ff6a1e'],
];

GUN_ART.ballista = [
  [2, 1, 7, 1, 3, WOOD],
  [4, 0, 14, 0, 3, WOODL],
  [4, 1, 14, 1, 1, WOOD],
  [10, -5, 10, 5, 1, DARK], // limbs
  [9, -4, 9, 4, 1, STEEL],
  [14, 0, 17, 0, 2, STEEL], // bolt
  [17, 0, 18, 0, 1, '#e8d8a0'],
];

GUN_ART.crossbow = [
  [2, 1, 7, 1, 3, WOOD],
  [3, 0, 12, 0, 2, WOODL],
  [11, -5, 12, 5, 1, DARK],
  [11, -4, 11, 4, 1, STEEL],
  [7, -4, 12, 0, 1, '#c8d8f0'], // string pulled back
  [7, 4, 12, 0, 1, '#c8d8f0'],
  [8, 0, 16, 0, 1, '#e8f0ff'], // bolt
  [16, 0, 17, 0, 1, '#ffffff'],
];

GUN_ART.tesla = [
  [2, 0, 6, 0, 3, '#2a3a50'],
  [5, 0, 12, 0, 4, '#4a6a8a'],
  [7, -2, 7, 2, 1, '#9ad8ff'], // coil rings
  [9, -2, 9, 2, 1, '#9ad8ff'],
  [11, -2, 11, 2, 1, '#9ad8ff'],
  [12, 0, 15, 0, 2, STEEL],
  [16, 0, 17, 0, 4, '#9ad8ff'], // charged orb
  [16, 0, 17, 0, 2, '#ffffff'],
];

GUN_ART.plasma = [
  [2, 0, 6, 0, 3, '#3a2a4a'],
  [5, 0, 13, 0, 5, '#5a3a7a'],
  [5, -2, 13, -2, 1, '#8a6aaa'],
  [6, 0, 12, 0, 1, '#ff9af0'], // glowing core stripe
  [13, 0, 16, 0, 6, DARK], // flared muzzle ring
  [14, 0, 17, 0, 2, '#ff9af0'],
];
// <<GUN_ART>>

/** Lay one gun down on a canvas, pointing `deg` degrees from "right" (negative = up). */
function paint(segs, deg) {
  const p = new Painter(SIZE, SIZE);
  const th = (deg * Math.PI) / 180;
  const dx = Math.cos(th), dy = Math.sin(th);
  const nx = -dy, ny = dx;
  for (const [a0, o0, a1, o1, t, col] of segs) {
    const h = t >> 1;
    p.line(
      R + dx * a0 + nx * o0 - h, R + dy * a0 + ny * o0 - h,
      R + dx * a1 + nx * o1 - h, R + dy * a1 + ny * o1 - h,
      col, t,
    );
  }
  return p.canvas;
}

const cache = new Map();

/** The five baked sprites of a weapon's gun, from -90 to 90 degrees. The shoulder is at (R + PAD, R + PAD) of each. */
export function gunSprites(id) {
  let g = cache.get(id);
  if (!g) {
    const segs = GUN_ART[id] || GUN_ART.rifle;
    g = ANGLES.map((deg) => bake(paint(segs, deg)));
    cache.set(id, g);
  }
  return g;
}

export const GUN_ORIGIN = R + PAD;

/** Which of the five sprites points along an aim with this (unit) vertical component, and whether to mirror it. */
export function gunIndex(ax, ay) {
  const deg = (Math.atan2(ay, Math.abs(ax)) * 180) / Math.PI;
  return Math.max(0, Math.min(4, Math.round(deg / 45) + 2));
}
