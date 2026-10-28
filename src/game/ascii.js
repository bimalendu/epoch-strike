// Build a level from ASCII art. Used by tests and the test fixture level.
//   #  solid      =  one-way platform   ^  spikes     ~  water     L  lava
//   I  ice        >  conveyor right     <  conveyor left            :  quicksand
//   W  wall       P  player spawn (feet at bottom of the cell)
//   /  45-degree ramp up to the right     \  45-degree ramp up to the left
//   1 2  22-degree ramp up to the right (low cell, high cell)     4 3  22-degree ramp up to the left (low cell, high cell)
//   5 6  steep slope up to the right (low cell, high cell)     7 8  steep slope up to the left (low cell, high cell)
// Any other non-space/non-dot character is returned in `marks` so callers can place entities.

import { TILE } from './constants.js';
import { T } from './tiles.js';

const MAP = {
  '#': T.SOLID, '=': T.PLATFORM, '^': T.SPIKE, '~': T.WATER, L: T.LAVA, I: T.ICE,
  '>': T.CONV_R, '<': T.CONV_L, ':': T.QUICK, W: T.WALL,
  '/': T.RAMP45_R, '\\': T.RAMP45_L,
  1: T.RAMP22_R_LO, 2: T.RAMP22_R_HI, 3: T.RAMP22_L_HI, 4: T.RAMP22_L_LO,
  5: T.STEEP_R_LO, 6: T.STEEP_R_HI, 7: T.STEEP_L_LO, 8: T.STEEP_L_HI,
};

export function levelFromAscii(lines, extra = {}) {
  const rows = lines.length;
  const cols = Math.max(...lines.map((l) => l.length));
  const tiles = new Uint8Array(cols * rows);
  const marks = [];
  let spawn = { x: 24, y: 64 };
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const ch = lines[ty][tx] || '.';
      if (MAP[ch] !== undefined) tiles[ty * cols + tx] = MAP[ch];
      else if (ch === 'P') spawn = { x: tx * TILE + TILE / 2, y: (ty + 1) * TILE };
      else if (ch !== '.' && ch !== ' ') marks.push({ ch, tx, ty, x: tx * TILE + TILE / 2, y: (ty + 1) * TILE });
    }
  }
  return { cols, rows, tiles, spawn, marks, theme: 'jungle', seed: 1, ...extra };
}

/** Handy flat arena for tests: floor at the given row of a 17-row map. */
export function flatLevel(cols = 60, floorRow = 14, extra = {}) {
  const lines = [];
  for (let y = 0; y < 17; y++) lines.push((y >= floorRow ? '#' : '.').repeat(cols));
  const rowP = floorRow - 1;
  lines[rowP] = 'P' + lines[rowP].slice(1);
  return levelFromAscii(lines, extra);
}
