// Tile ids and their physical properties.

export const T = {
  AIR: 0,
  SOLID: 1, // ground / terrain
  PLATFORM: 2, // one-way: land from above, jump up through, drop down with Down+Jump
  SPIKE: 3, // kills on touch
  WATER: 4, // slows, restricts aiming
  LAVA: 5, // kills on touch
  ICE: 6, // solid, slippery
  CONV_R: 7, // solid conveyor moving right
  CONV_L: 8, // solid conveyor moving left
  QUICK: 9, // quicksand: slows and drowns if you stay too long
  WALL: 10, // solid decorative wall / building / brick
  DOOR: 11, // boss gate (solid while closed)
  // Walkable slopes. The suffix names the side that rises (`_R`: uphill to the right). A 22.5-degree ramp climbs one tile
  // over two cells (LO is the lower cell, HI the upper); a steep slope climbs two tiles over one column (LO under HI).
  // The angles are nominal: the geometry is 1:2, 1:1 and 2:1, which is what a 16 px grid can express.
  RAMP45_R: 12,
  RAMP45_L: 13,
  RAMP22_R_LO: 14,
  RAMP22_R_HI: 15,
  RAMP22_L_HI: 16,
  RAMP22_L_LO: 17,
  STEEP_R_LO: 18,
  STEEP_R_HI: 19,
  STEEP_L_LO: 20,
  STEEP_L_HI: 21,
};

const N = 32;
export const SOLID = new Uint8Array(N);
export const ONEWAY = new Uint8Array(N);
export const HURT = new Uint8Array(N);
export const LIQUID = new Uint8Array(N);
/** Slope tiles: walkable ground whose surface is a line across the cell. They are deliberately not in SOLID. */
export const SLOPE = new Uint8Array(N);
/** The steep subset of SLOPE: the soldier slides down these and cannot climb them. */
export const STEEP = new Uint8Array(N);

/** Surface height (px above the cell's bottom edge) at the cell's left and right edges, before clamping to 0..16. */
const SLOPE_LINE = {
  [T.RAMP45_R]: [0, 16],
  [T.RAMP45_L]: [16, 0],
  [T.RAMP22_R_LO]: [0, 8],
  [T.RAMP22_R_HI]: [8, 16],
  [T.RAMP22_L_HI]: [16, 8],
  [T.RAMP22_L_LO]: [8, 0],
  [T.STEEP_R_LO]: [0, 32],
  [T.STEEP_R_HI]: [-16, 16],
  [T.STEEP_L_LO]: [32, 0],
  [T.STEEP_L_HI]: [16, -16],
};

[T.SOLID, T.ICE, T.CONV_R, T.CONV_L, T.WALL, T.DOOR].forEach((t) => (SOLID[t] = 1));
ONEWAY[T.PLATFORM] = 1;
[T.SPIKE, T.LAVA].forEach((t) => (HURT[t] = 1));
[T.WATER].forEach((t) => (LIQUID[t] = 1));
for (const id of Object.keys(SLOPE_LINE)) SLOPE[id] = 1;
[T.STEEP_R_LO, T.STEEP_R_HI, T.STEEP_L_LO, T.STEEP_L_HI].forEach((t) => (STEEP[t] = 1));

/**
 * Height of a slope tile's surface at `localX` (0..16 px from the cell's left edge), in px above the cell's bottom edge.
 * 0 means the cell is empty at that column (the upper half of a steep slope before the surface starts) and 16 means
 * it is full. Returns -1 for a tile that is not a slope.
 */
export function floorHeight(id, localX) {
  const line = SLOPE_LINE[id];
  if (!line) return -1;
  const h = line[0] + ((line[1] - line[0]) * localX) / 16;
  return h < 0 ? 0 : h > 16 ? 16 : h;
}

/** Which way is uphill on a slope tile: +1 for right, -1 for left, 0 for a tile that is not a slope. */
export function uphillDir(id) {
  const line = SLOPE_LINE[id];
  return line ? Math.sign(line[1] - line[0]) : 0;
}

/** Conveyor direction for a tile id: +1, -1 or 0. */
export function conveyorDir(t) {
  return t === T.CONV_R ? 1 : t === T.CONV_L ? -1 : 0;
}
