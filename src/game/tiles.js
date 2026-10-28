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
  SLOPE_DECOR: 12, // reserved
};

const N = 16;
export const SOLID = new Uint8Array(N);
export const ONEWAY = new Uint8Array(N);
export const HURT = new Uint8Array(N);
export const LIQUID = new Uint8Array(N);

[T.SOLID, T.ICE, T.CONV_R, T.CONV_L, T.WALL, T.DOOR].forEach((t) => (SOLID[t] = 1));
ONEWAY[T.PLATFORM] = 1;
[T.SPIKE, T.LAVA].forEach((t) => (HURT[t] = 1));
[T.WATER].forEach((t) => (LIQUID[t] = 1));

/** Conveyor direction for a tile id: +1, -1 or 0. */
export function conveyorDir(t) {
  return t === T.CONV_R ? 1 : t === T.CONV_L ? -1 : 0;
}
