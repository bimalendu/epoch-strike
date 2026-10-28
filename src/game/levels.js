// The level list. Real levels (Week 5 onward) are described as data and built by levelgen.js;
// the development testbed level stays at index -1 for experiments.

import { levelFromAscii } from './ascii.js';
import { dinoJungle } from './levels/l01_dino_jungle.js';
import { volcanoRun } from './levels/l02_volcano_run.js';
import { frozenGlacier } from './levels/l03_frozen_glacier.js';
import { caveTribes } from './levels/l04_cave_tribes.js';
import { pyramid } from './levels/l05_pyramid.js';
import { troy } from './levels/l06_troy.js';
import { colosseum } from './levels/l07_colosseum.js';
import { greatWall } from './levels/l08_greatwall.js';
import { fjord } from './levels/l09_fjord.js';
import { castle } from './levels/l10_castle.js';
import { shadowCastle } from './levels/l11_shadow.js';
import { armada } from './levels/l12_armada.js';
import { train } from './levels/l13_train.js';
import { factory } from './levels/l14_factory.js';
import { trench } from './levels/l15_trench.js';
import { coast } from './levels/l16_coast.js';
import { missileBase } from './levels/l17_missile_base.js';
import { neonCity } from './levels/l18_neon_city.js';
import { cyberCity } from './levels/l19_cyber_megacity.js';
import { citadel } from './levels/l20_citadel.js';

const MARK_ENEMIES = { r: 'grunt', s: 'rifleman' };

/** Gray-box sandbox used by early weeks and by tests. */
export function testLevel() {
  const rows = 17;
  const cols = 120;
  const g = Array.from({ length: rows }, () => Array(cols).fill('.'));
  const put = (x, y, ch) => { if (g[y]) g[y][x] = ch; };
  for (let x = 0; x < cols; x++) for (let y = 14; y < rows; y++) put(x, y, '#');
  for (let x = 20; x < 23; x++) for (let y = 14; y < rows; y++) put(x, y, '.');
  for (let x = 40; x < 45; x++) for (let y = 14; y < rows; y++) put(x, y, '.');
  for (let x = 28; x < 31; x++) put(x, 13, '#');
  for (let x = 29; x < 31; x++) put(x, 12, '#');
  for (let x = 50; x < 58; x++) put(x, 11, '=');
  for (let x = 54; x < 62; x++) put(x, 8, '=');
  for (let x = 66; x < 69; x++) put(x, 13, '^');
  for (let x = 74; x < 84; x++) { put(x, 13, '~'); put(x, 12, '~'); }
  for (let x = 88; x < 98; x++) put(x, 14, 'I');
  for (let x = 100; x < 106; x++) put(x, 14, '>');
  for (let x = 106; x < 112; x++) put(x, 14, '<');
  for (let y = 11; y < 14; y++) put(116, y, '#');
  put(2, 13, 'P');
  [[14, 'r'], [26, 's'], [34, 'r'], [36, 'r'], [48, 's'], [60, 'r'], [64, 's'], [90, 'r'], [100, 's'], [110, 'r']].forEach(([x, c]) => put(x, 13, c));
  const lvl = levelFromAscii(g.map((r) => r.join('')), { name: 'Testbed', id: -1 });
  lvl.spawns = lvl.marks
    .filter((m) => MARK_ENEMIES[m.ch])
    .map((m) => ({ type: MARK_ENEMIES[m.ch], x: m.x, y: m.y }));
  // pickups: flying capsules (shoot to release), floating medals and a hidden 1UP
  const cap = (x, y, item) => lvl.spawns.push({ type: 'capsule', x: x * 16, y: y * 16, item, face: -1 });
  cap(24, 6, 'S');
  cap(52, 5, 'M');
  cap(70, 6, 'R');
  cap(94, 5, 'B');
  cap(104, 6, 'random');
  const item = (x, y, it) => lvl.spawns.push({ type: 'pickup', item: it, x: x * 16 + 8, y: y * 16 });
  item(16, 13, 'bomb');
  [[52, 10], [54, 10], [56, 10], [58, 10]].forEach(([x, y]) => item(x, y, 'medal'));
  item(60, 7, '1up'); // hidden up on the high platform
  lvl.exitX = 113 * 16;
  lvl.checkpoints = [{ x: 48 * 16, y: 14 * 16 }, { x: 86 * 16, y: 14 * 16 }];
  return lvl;
}

/** Level definitions: filled in from Week 5. */
export const LEVEL_DEFS = [
  dinoJungle,
  volcanoRun,
  frozenGlacier,
  caveTribes,
  pyramid,
  troy,
  colosseum,
  greatWall,
  fjord,
  castle,
  shadowCastle,
  armada,
  train,
  factory,
  trench,
  coast,
  missileBase,
  neonCity,
  cyberCity,
  citadel,
  // <<LEVEL_DEFS>> (registry: levels are appended above this line)
];

export function levelCount() {
  return LEVEL_DEFS.length;
}

/** Display name for menus and cards: "TESTBED" for -1, otherwise the level's own name. */
export function levelName(index) {
  if (index < 0) return 'TESTBED';
  const d = LEVEL_DEFS[index];
  return d && d.name ? d.name : `LEVEL ${index + 1}`;
}

/** Index a new run begins at: level 1, or the testbed while the real levels are not written yet. */
export function firstLevel() {
  return levelCount() > 0 ? 0 : -1;
}

/** Build the playable level for an index; -1 is the testbed. */
export function buildLevel(index) {
  if (index < 0) return testLevel();
  const def = LEVEL_DEFS[index];
  if (!def) throw new Error(`No level ${index}`);
  return def.build ? def.build(def) : testLevel();
}
