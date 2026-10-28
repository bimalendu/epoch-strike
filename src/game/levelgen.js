// LevelBuilder: levels are written as short scripts of terrain commands and entity placements, not hand-drawn
// grids. Every command enforces the movement limits from constants.js (longest gap, tallest step), and the
// solver (solver.js) checks that the finished level can be crossed on foot.
//
//   const b = new LevelBuilder(def);
//   b.flat(12);                       // ground for 12 tiles
//   const s = b.flat(30);             // a Seg: place things relative to its start
//   s.enemy('raptor', 12);            // on the ground, 12 tiles in
//   s.enemy('drone', 20, { row: 6 }); // in the air, at tile row 6
//   b.pit(3);                         // a 3-tile gap
//   const level = b.finish();
//
// Terrain rows: ground surface is at `b.gy` (the row of the top solid tile); an entity "standing on row r"
// has its feet at y = r * TILE.

import { TILE, VIEW_W, MAX_GAP_TILES, MAX_STEP_UP_TILES, MAX_QUICKSAND_TILES } from './constants.js';

const VIEW_COLS = VIEW_W / TILE;
const MAX_SHAFT_TILES = 3; // widest hollow a wall-kick zig-zag can climb // a boss arena is one screen wide
import { T } from './tiles.js';

export const DEFAULT_ROWS = 17;
export const DEFAULT_GY = 13; // ground surface row for normal levels (feet at y = 208)

/** A stretch of terrain just laid down; entity helpers place things relative to its start column. */
export class Seg {
  constructor(b, x0, x1) {
    this.b = b;
    this.x0 = x0;
    this.x1 = x1;
  }

  get len() {
    return this.x1 - this.x0;
  }

  col(dx) {
    return this.x0 + dx;
  }

  /** Enemy standing on the ground (or at an explicit tile row for fliers and platform dwellers). */
  enemy(type, dx, opts = {}) {
    this.b.addEnemy(type, this.x0 + dx, opts);
    return this;
  }

  /** `n` enemies spaced `gap` tiles apart. */
  enemies(type, dx, n, gap, opts = {}) {
    for (let i = 0; i < n; i++) this.b.addEnemy(type, this.x0 + dx + i * gap, opts);
    return this;
  }

  /** A flying capsule carrying `item` that crosses the screen at tile row `row`. */
  capsule(item, dx, row = 7) {
    this.b.addCapsule(item, this.x0 + dx, row);
    return this;
  }

  /** A wall torch at tile row `row`: lights dark levels (r = light radius in px). */
  torch(dx, row, r = 56) {
    this.b.addTorch(this.x0 + dx, row, r);
    return this;
  }

  /** A pickup placed in the level (floating). */
  pickup(item, dx, row) {
    this.b.addPickup(item, this.x0 + dx, row);
    return this;
  }

  /** `n` medals in a row (or an arc when `arc` > 0). */
  medals(dx, row, n = 3, step = 2, arc = 0) {
    for (let i = 0; i < n; i++) {
      const lift = arc ? Math.round(Math.sin((i / Math.max(1, n - 1)) * Math.PI) * arc) : 0;
      this.b.addPickup('medal', this.x0 + dx + i * step, row - lift);
    }
    return this;
  }

  checkpoint(dx = 0) {
    this.b.addCheckpoint(this.x0 + dx);
    return this;
  }

  prompt(text, dx = 0, len = 14) {
    this.b.addPrompt(text, this.x0 + dx, len);
    return this;
  }

  /** Raw placement of anything in the spawn list. */
  spawn(spec, dx) {
    this.b.addSpawn({ ...spec, x: (this.x0 + dx) * TILE + TILE / 2 });
    return this;
  }
}

export class LevelBuilder {
  /**
   * @param {object} def level definition: { name, era, theme, seed, music, bulletScale, ... }
   * @param {{rows?: number, gy?: number}} opts
   */
  constructor(def = {}, { rows = DEFAULT_ROWS, gy = DEFAULT_GY } = {}) {
    this.def = def;
    this.rows = rows;
    this.gy = gy; // current ground surface row
    this.laidGy = gy; // surface row of the last ground laid, so steps up that follow each other add up
    this.x = 0; // cursor column
    this.columns = []; // columns[x] = Uint8Array(rows)
    this.surface = []; // surface[x] = row of the top walkable tile, or -1 for a pit
    this.spawns = [];
    this.checkpoints = [];
    this.prompts = [];
    this.exitX = undefined;
    this.lights = []; // torches: { x, y, r }
    this.zones = []; // named regions the world logic uses: autoscroll, arenas, water...
    this.swings = []; // rope-swing planks (see swing.js)
    this.links = []; // extra moves the solver may use (wall-jump shafts): { from: [col,row], to: [col,row], kind, data }
    this.props = []; // set dressing: ship masts, prows, banners (see art/props.js)
    this.extra = {}; // free-form data copied into the level (boss door column, scroll speed...)
    this.groundTile = T.SOLID;
  }

  // ---- raw tile access ----
  col(x) {
    let c = this.columns[x];
    if (!c) {
      c = new Uint8Array(this.rows);
      this.columns[x] = c;
      if (this.surface[x] === undefined) this.surface[x] = -1;
    }
    return c;
  }

  set(x, y, id) {
    if (y < 0 || y >= this.rows || x < 0) return this;
    this.col(x)[y] = id;
    return this;
  }

  get(x, y) {
    const c = this.columns[x];
    return c && y >= 0 && y < this.rows ? c[y] : 0;
  }

  /** Fill a rectangle of tiles (x0,y0 inclusive; width w, height h). */
  rect(x0, y0, w, h, id) {
    for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) this.set(x, y, id);
    return this;
  }

  // ---- terrain ----
  /** Ground for `n` columns at the current height. Returns the Seg. */
  flat(n, { tile = this.groundTile, top = null } = {}) {
    const x0 = this.x;
    for (let i = 0; i < n; i++) {
      const x = x0 + i;
      this.col(x);
      for (let y = this.gy; y < this.rows; y++) this.set(x, y, tile);
      if (top !== null) this.set(x, this.gy, top);
      this.surface[x] = this.gy;
    }
    this.laidGy = this.gy;
    this.x += n;
    return new Seg(this, x0, this.x);
  }

  /** Step the ground up by `dh` tiles (at most MAX_STEP_UP_TILES). */
  up(dh) {
    // the rise counts from the last ground laid, so up(3) straight after up(3) is a 6-tile cliff and is refused
    const rise = this.laidGy - (this.gy - dh);
    if (dh > MAX_STEP_UP_TILES || rise > MAX_STEP_UP_TILES) throw new Error(`step up of ${Math.max(dh, rise)} tiles is more than the player can climb`);
    this.gy -= dh;
    return this;
  }

  down(dh) {
    this.gy += dh;
    return this;
  }

  /** A raised block of ground: up(h), flat(w), down(h). */
  hill(w, h) {
    this.up(h);
    const s = this.flat(w);
    this.down(h);
    return s;
  }

  /**
   * A pit `n` tiles wide (n <= MAX_GAP_TILES). `fill` puts a hazard at the bottom:
   * 'spikes' | 'water' | 'lava' | null (bottomless). 'water' is a shallow ford with a riverbed, not a drop.
   */
  pit(n, { fill = null } = {}) {
    if (n > MAX_GAP_TILES) throw new Error(`pit of ${n} tiles is wider than the player can jump`);
    const x0 = this.x;
    for (let i = 0; i < n; i++) {
      const x = x0 + i;
      this.col(x);
      this.surface[x] = -1;
      if (fill === 'spikes') this.set(x, this.rows - 1, T.SPIKE);
      else if (fill === 'lava') for (let y = this.rows - 2; y < this.rows; y++) this.set(x, y, T.LAVA);
      else if (fill === 'water') {
        // a ford: one tile of water over a solid riverbed two tiles below the banks (wade through, climb out)
        this.set(x, this.gy + 1, T.WATER);
        for (let y = this.gy + 2; y < this.rows; y++) this.set(x, y, T.SOLID);
      }
    }
    this.x += n;
    return new Seg(this, x0, this.x);
  }

  /**
   * A quicksand pit `n` tiles wide: one tile deep, slows the player to 45% and drowns them after QUICK_DROWN seconds
   * of standing in it, so it must be crossed without stopping (the limit keeps the crossing well inside that).
   */
  quicksand(n) {
    if (n > MAX_QUICKSAND_TILES) throw new Error(`quicksand of ${n} tiles takes too long to cross`);
    const x0 = this.x;
    for (let i = 0; i < n; i++) {
      const x = x0 + i;
      this.col(x);
      for (let y = this.gy + 1; y < this.rows; y++) this.set(x, y, this.groundTile);
      this.set(x, this.gy, T.QUICK);
      this.surface[x] = this.gy + 1;
    }
    this.x += n;
    return new Seg(this, x0, this.x);
  }

  /** Spikes standing on the ground, `n` tiles wide, starting `dx` tiles into the last flat segment. */
  spikes(seg, dx, n = 2) {
    for (let i = 0; i < n; i++) {
      const x = seg.x0 + dx + i;
      this.set(x, this.surface[x] - 1, T.SPIKE);
    }
    return this;
  }

  /** A floating platform. kind: 'one-way' (default) or 'solid'. */
  platform(x, row, len, { kind = 'one-way', tile = null } = {}) {
    const id = tile ?? (kind === 'solid' ? this.groundTile : T.PLATFORM);
    for (let i = 0; i < len; i++) this.set(x + i, row, id);
    return new Seg(this, x, x + len);
  }

  /** A wall of solid tiles standing on the ground (jumpable when h <= MAX_STEP_UP_TILES). */
  block(x, w, h, tile = this.groundTile) {
    const g = this.surface[x] >= 0 ? this.surface[x] : this.gy;
    for (let i = 0; i < w; i++) for (let j = 1; j <= h; j++) this.set(x + i, g - j, tile);
    return this;
  }

  /**
   * A rope swing across a chasm too wide to jump (more than MAX_GAP_TILES): a plank on ropes swings between the two ledges,
   * reaching each edge (a few pixels short of it) at the ends of its swing. Step on when it comes in, ride across, step
   * off. `period` is seconds per full swing (the plank crosses once per half period). Registers the crossing as a solver
   * link ('swing') so the level still counts as crossable.
   */
  swing(gap, { len = 140, period = 3.8, plank = 3, margin = 8, fill = null, phase = 0 } = {}) {
    if (gap <= MAX_GAP_TILES) throw new Error(`a gap of ${gap} tiles can be jumped: use pit()`);
    if (gap > 14) throw new Error(`a swing cannot span ${gap} tiles`);
    const gy = this.gy;
    const x0 = this.x;
    for (let i = 0; i < gap; i++) {
      const x = x0 + i;
      this.col(x);
      this.surface[x] = -1;
      if (fill === 'spikes') this.set(x, this.rows - 1, T.SPIKE);
    }
    this.x += gap;
    const X0 = x0 * TILE;
    const X1 = this.x * TILE;
    const W = plank * TILE;
    const cl = X0 + margin + W / 2;
    const cr = X1 - margin - W / 2;
    const cx = (cl + cr) / 2;
    const A = (cr - cl) / 2;
    const theta = Math.asin(Math.min(0.95, A / len));
    const ay = gy * TILE - len * Math.cos(theta);
    const i = this.swings.length;
    this.swings.push({ ax: cx, ay, len, theta, period, phase, w: W });
    this.links.push({ from: [x0 - 1, gy], to: [this.x, gy], kind: 'swing', data: { i, dir: 1, y: gy * TILE } });
    return { x0, x1: this.x, index: i };
  }

  /**
   * A wall-jump shaft (levels with `wallJump: true`): a stone tower you walk into through a doorway, with a hollow `w`
   * tiles wide inside it. The left wall is two tiles taller than the right one, so the way out is to kick off the walls,
   * zig-zagging upward, and land on top of the right wall (`h` tiles above the floor) before dropping down the far side.
   * Registers the climb as a solver link, so the level still counts as crossable.
   */
  shaft({ w = 3, h = 7, wall = T.WALL, through = false } = {}) {
    if (w > MAX_SHAFT_TILES) throw new Error(`a shaft ${w} tiles wide is too wide to kick across`);
    const gy = this.gy;
    const xa = this.x;
    const inner0 = xa + 2; // first hollow column
    const xr = inner0 + w; // the low right wall starts here
    // left wall (2 thick): solid from two tiles above the right wall down to the door lintel, a doorway below it
    for (let x = xa; x < xa + 2; x++) {
      this.col(x);
      for (let y = gy - h - 2; y <= gy - 3; y++) this.set(x, y, wall);
      for (let y = gy; y < this.rows; y++) this.set(x, y, this.groundTile);
      this.surface[x] = gy;
    }
    // the hollow: ground floor, open to the sky
    for (let x = inner0; x < xr; x++) {
      this.col(x);
      for (let y = gy; y < this.rows; y++) this.set(x, y, this.groundTile);
      this.surface[x] = gy;
    }
    // right wall (2 thick), h tiles tall; a `through` shaft has a doorway at the foot of this wall too, so the main road
    // runs straight through the hollow and the climb up to the wall top is optional (a place for a secret)
    for (let x = xr; x < xr + 2; x++) {
      this.col(x);
      for (let y = gy - h; y < this.rows; y++) {
        const door = through && y >= gy - 2 && y < gy;
        this.set(x, y, door ? T.AIR : y < gy ? wall : this.groundTile);
      }
      this.surface[x] = through ? gy : gy - h;
    }
    this.x = xr + 2;
    this.links.push({
      from: [inner0 + Math.floor(w / 2), gy],
      to: [xr + 1, gy - h],
      kind: 'wall',
      data: { x0: inner0 * TILE, x1: xr * TILE, exit: 1, topY: (gy - h) * TILE },
    });
    return { x0: xa, inner0, xr, x1: this.x, top: gy - h };
  }

  // ---- entities ----
  /** y (pixels, feet) of the ground at column x, falling back to the current surface. */
  groundY(x) {
    const s = this.surface[x];
    return (s >= 0 ? s : this.gy) * TILE;
  }

  addSpawn(spec) {
    this.spawns.push(spec);
    return spec;
  }

  addEnemy(type, col, opts = {}) {
    const { row, ...rest } = opts;
    const y = row !== undefined ? row * TILE : this.groundY(col);
    return this.addSpawn({ type, x: col * TILE + TILE / 2, y, ...rest });
  }

  addCapsule(item, col, row = 7) {
    return this.addSpawn({ type: 'capsule', item, x: col * TILE, y: row * TILE, face: -1 });
  }

  addPickup(item, col, row) {
    return this.addSpawn({ type: 'pickup', item, x: col * TILE + TILE / 2, y: row * TILE });
  }

  addTorch(col, row, r = 56) {
    this.lights.push({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2, r });
  }

  /** Set dressing standing on the ground at `col` (kind: 'mast' | 'prow' | 'banner'; opts: dir, h). It does nothing in play. */
  prop(kind, col, opts = {}) {
    this.props.push({ kind, x: col * TILE + TILE / 2, y: this.groundY(col), ...opts });
    return this;
  }

  addCheckpoint(col, row) {
    this.checkpoints.push({ x: col * TILE, y: row !== undefined ? row * TILE : this.groundY(col) });
  }

  /** A tutorial caption shown while the player is between columns `col` and `col + len` (and, in towers, rows `rows`). */
  addPrompt(text, col, len, { rows = null } = {}) {
    const p = { text, x0: col * TILE, x1: (col + len) * TILE };
    if (rows) {
      p.y0 = rows[0] * TILE;
      p.y1 = rows[1] * TILE;
    }
    this.prompts.push(p);
  }

  /** End of a level that has no boss (a trigger line near the last column). Levels with a boss use bossArena(). */
  exit() {
    this.exitX = this.x * TILE - TILE * 2;
  }

  /** Forced scrolling between two columns: the camera keeps moving at `speed` px/s while the player is inside. */
  autoscroll(x0, x1, speed = 40) {
    this.zones.push({ type: 'autoscroll', x0: x0 * TILE, x1: x1 * TILE, speed });
    return this;
  }

  /**
   * A chariot ride: forced scrolling like autoscroll(), with the soldier standing on a racing chariot.
   * The chariot is cosmetic (the soldier keeps all their moves), but it sets the pace of the stretch.
   */
  chariot(x0, x1, speed = 70) {
    this.zones.push({ type: 'chariot', x0: x0 * TILE, x1: x1 * TILE, speed });
    return this;
  }

  /**
   * A wave arena on a flat floor one screen wide. The camera locks when the player walks in and the waves run in from
   * the left ('L') and right ('R') edges; the lock lifts when the last wave is dead. Each wave is a list of
   * { type, side, y?, item? }. Keep every wave at or below the level's enemy cap.
   */
  arenaWaves(waves, { cols = VIEW_COLS } = {}) {
    const seg = this.flat(cols);
    this.addCheckpoint(seg.x0 + 1);
    this.zones.push({ type: 'waves', x0: seg.x0 * TILE, x1: seg.x1 * TILE, floorY: this.gy * TILE, waves });
    return seg;
  }

  /**
   * A heaving sea (longship decks): swells roll along the deck from the right every `period` seconds while the soldier is
   * between the two columns. They are jumped like shockwaves; solid blocks stop them.
   */
  swells(x0, x1, { period = 4.2, speed = 105, first = 1.8 } = {}) {
    this.zones.push({ type: 'swells', x0: x0 * TILE, x1: x1 * TILE, floorY: this.gy * TILE, period, speed, first });
    return this;
  }

  /**
   * A steam vent in the floor at column `col` (see World.updateVent): a flashing mark, then a column of steam too tall to
   * jump. Stagger `phase` between neighbours to make a rhythm; each cycle leaves `period - tele - hold` seconds to cross.
   */
  vent(col, { period = 3.6, tele = 0.9, hold = 0.7, height = 64, phase = 0.8 } = {}) {
    this.zones.push({ type: 'vent', x: col * TILE + TILE / 2, floorY: this.groundY(col), period, tele, hold, height, phase });
    return this;
  }

  /**
   * A tank road between two columns (Level 16): a soldier who walks into the first three columns climbs into a tank and
   * drives it to the end, where they climb out. The tank hops but cannot jump a gap or climb a step, so the road must be
   * flat ground with no pits, spikes or steps (this throws if it is not). `supply: false` makes it a road for a tank
   * brought in some other way (a tank pickup); `dismount: false` lets the tank carry on past x1.
   */
  tankRoad(x0, x1, { supply = true, dismount = true } = {}) {
    for (let x = x0; x < x1; x++) {
      if (this.surface[x] !== this.surface[x0] || this.surface[x] < 0) throw new Error(`tank road is not flat at column ${x}`);
      for (let y = 0; y < this.rows; y++) {
        const t = this.get(x, y);
        if (t === T.SPIKE || t === T.LAVA || (t !== T.AIR && y < this.surface[x] && !(t === T.PLATFORM))) {
          throw new Error(`tank road is blocked at column ${x}, row ${y}`);
        }
      }
    }
    this.zones.push({ type: 'tank', x0: x0 * TILE, x1: x1 * TILE, supply, dismount });
    if (supply) this.addPickup('tank', x0 + 1, this.surface[x0]);
    return this;
  }

  /**
   * A searchlight tower on the road (see stealth.js): a pool of light sweeps along the ground between columns `xa` and `xb`.
   * A soldier who stays in the light for a moment sets off the alarm; high ledges and the shadow of a solid block are safe.
   * The lamp sits on a tower at column `tower` (default: the middle of the sweep) `height` tiles above the ground. The
   * alarm is watched while the soldier is between `xa - reach` and `xb + reach`.
   */
  searchlight(xa, xb, { tower = null, height = 8, period = 6.5, phase = 0, reach = 8, troop = 'snowtrooper' } = {}) {
    const col = tower ?? Math.round((xa + xb) / 2);
    const floorY = this.groundY(xa);
    for (let x = xa; x <= xb; x++) if (this.surface[x] !== this.surface[xa] || this.surface[x] < 0) throw new Error('a searchlight sweeps over flat ground');
    this.zones.push({
      type: 'searchlight',
      x0: (xa - reach) * TILE,
      x1: (xb + reach) * TILE,
      a: xa * TILE + TILE / 2,
      b: xb * TILE + TILE / 2,
      lampX: col * TILE + TILE / 2,
      lampY: floorY - height * TILE,
      floorY,
      period,
      phase,
      troop,
    });
    return this;
  }

  /**
   * A gravity hall (Level 19): `n` columns with a solid ceiling `ceil` rows thick and a floor of spikes, so the only way
   * through is along the ceiling. While the soldier is inside the hall gravity is flipped: they fall up, walk along the
   * underside of the ceiling and, when they step out, fall back down onto the ground beyond (which must be flat for at
   * least 8 columns). The first and last two columns of floor are bare so entering and leaving is safe. Registers the
   * crossing as a solver link ('flip').
   */
  flipHall(n, { ceil = 6 } = {}) {
    if (n < 14) throw new Error('a gravity hall must be at least 14 columns long');
    const gy = this.gy;
    const from = this.x - 1;
    if (this.surface[from] !== gy) throw new Error('a gravity hall starts on flat ground');
    const x0 = this.x;
    for (let i = 0; i < n; i++) {
      const x = x0 + i;
      this.col(x);
      for (let y = gy; y < this.rows; y++) this.set(x, y, this.groundTile);
      for (let y = 0; y < ceil; y++) this.set(x, y, this.groundTile);
      const spiked = i >= 2 && i < n - 2;
      if (spiked) this.set(x, gy - 1, T.SPIKE);
      this.surface[x] = spiked ? -1 : gy;
    }
    this.x += n;
    this.zones.push({ type: 'gravity', x0: x0 * TILE, x1: this.x * TILE, ceilY: ceil * TILE, floorY: gy * TILE });
    this.links.push({ from: [from, gy], to: [this.x + 3, gy], kind: 'flip', data: { x0: x0 * TILE, x1: this.x * TILE } });
    return new Seg(this, x0, this.x);
  }

  /**
   * A hoverbike skyway (Level 19): `n` columns of flat road. A soldier who walks onto the first columns climbs onto a
   * hoverbike and flies it over the road while the camera rolls on at `speed`; at the far end the bike sets down and the
   * soldier is on foot again. `lane` is the height (px above the road) a bot flies at. Beams and flyers fill the sky.
   */
  hoverRun(n, { speed = 56, lane = 78 } = {}) {
    const seg = this.flat(n);
    this.zones.push({ type: 'hover', x0: seg.x0 * TILE, x1: seg.x1 * TILE, speed, lane: this.gy * TILE - lane, floorY: this.gy * TILE });
    this.addCheckpoint(seg.x0 + 1);
    return seg;
  }

  /**
   * A laser emitter over column `col` (see World.updateBeam): a mark flashes, then a beam stabs `length` px out of the
   * ceiling (`from: 'top'`, row 0) or the road (`from: 'floor'`) for `hold` seconds. Stagger `phase` to make a rhythm.
   */
  beam(col, { from = 'top', length = 100, period = 3.4, tele = 0.9, hold = 0.6, phase = 0.8, col: color = '#ff4ad8' } = {}) {
    const top = from === 'top';
    this.zones.push({ type: 'beam', x: col * TILE + TILE / 2, y: top ? 0 : this.groundY(col), dir: top ? 1 : -1, length, period, tele, hold, phase, col: color });
    return this;
  }

  /**
   * Catapult fire between two columns: every `period` seconds, `volley` flaming boulders arc in from off screen and land
   * where the soldier stands (a floor mark appears `fuse` seconds ahead and the first boulder is aimed at the soldier, so
   * a soldier who keeps moving is never under it). Each boulder bursts into falling sparks on landing; with `gas: true` the
   * shells are artillery rounds that leave a cloud of poison gas lingering for `linger` seconds instead.
   */
  barrage(x0, x1, { period = 3.6, volley = 2, spread = 64, fuse = 1.35, first = 1.8, gas = false, linger = 3.4, shell = false } = {}) {
    this.zones.push({ type: 'barrage', x0: x0 * TILE, x1: x1 * TILE, floorY: this.gy * TILE, period, volley, spread, fuse, first, gas, linger, shell });
    return this;
  }

  /**
   * Rising lava between two columns. Once the player reaches x0 the lava climbs one row every `interval`
   * seconds until row `endRow` (everything at or below that row inside the zone is lava at the end).
   * Keep a route above `endRow` or the solver (and the player) will refuse the level.
   */
  lavaRise(x0, x1, { endRow = 11, interval = 5 } = {}) {
    this.zones.push({ type: 'lavaRise', x0: x0 * TILE, x1: x1 * TILE, endRow, interval });
    return this;
  }

  /**
   * A boss arena: the last screen of the level, a flat floor exactly one screen wide. The camera locks onto it when
   * the player walks in, the boss spawns at the right edge and walks in, and the level ends when it dies.
   * Also drops a checkpoint at the arena entrance.
   */
  bossArena(type, { cols = VIEW_COLS } = {}) {
    const seg = this.flat(cols);
    const x0 = seg.x0 * TILE;
    const x1 = seg.x1 * TILE;
    this.addCheckpoint(seg.x0 + 1);
    this.extra.boss = {
      type,
      trigger: x0 + 4 * TILE, // the player is well inside the arena
      cam: x0,
      x0,
      x1,
      floorY: this.gy * TILE,
      spawnX: x1 - 30,
    };
    return seg;
  }

  /**
   * A boss rush (Level 20): an arena like bossArena() whose boss is an ECHO, a weaker copy of an old boss with `hp` health.
   * Beating it frees the camera and the level goes on to the next arena; the level's own bossArena() comes last. The
   * trigger is two tiles inside the arena (so a soldier cannot skip it by running past the left edge).
   */
  echoArena(type, { hp, cols = VIEW_COLS } = {}) {
    const seg = this.flat(cols);
    const x0 = seg.x0 * TILE;
    const x1 = seg.x1 * TILE;
    this.addCheckpoint(seg.x0 + 1);
    (this.extra.rush = this.extra.rush || []).push({
      type,
      echo: true,
      hp,
      trigger: x0 + 4 * TILE,
      cam: x0,
      x0,
      x1,
      floorY: this.gy * TILE,
      spawnX: x1 - 30,
    });
    return seg;
  }

  /**
   * Tower levels climb instead of run: the whole level is one screen wide (`this.x` columns) and many rows tall.
   * The level ends when the player reaches row `row` (a trigger line near the top).
   */
  exitTop(row) {
    this.extra.exitY = row * TILE;
    return this;
  }

  /**
   * The boss arena at the top of a tower: a floor across the whole width at `row`. The boss spawns once the player
   * is standing on it. The camera still follows vertically, so the fight happens at the top of the tower.
   */
  bossArenaAt(type, row, { entry = [2, 8] } = {}) {
    const cols = this.x;
    for (let x = 0; x < cols; x++) {
      this.col(x);
      const through = x >= entry[0] && x < entry[1]; // a one-way strip the climber rises through
      this.set(x, row, through ? T.PLATFORM : this.groundTile);
      if (!through) this.set(x, row + 1, this.groundTile);
    }
    this.extra.boss = {
      type,
      trigger: 4 * TILE,
      triggerY: row * TILE + 2,
      cam: 0,
      x0: 0,
      x1: cols * TILE,
      floorY: row * TILE,
      spawnX: cols * TILE - 30,
    };
    this.addCheckpoint(2, row);
    return this;
  }

  // ---- finishing ----
  finish() {
    const cols = this.x;
    const rows = this.rows;
    const tiles = new Uint8Array(cols * rows);
    for (let x = 0; x < cols; x++) {
      const c = this.columns[x];
      if (!c) continue;
      for (let y = 0; y < rows; y++) tiles[y * cols + x] = c[y];
    }
    // player starts on the first walkable column, two tiles in
    const sx = Math.min(cols - 1, 2);
    const sRow = this.surface[sx] >= 0 ? this.surface[sx] : this.gy;
    const spawns = this.spawns.slice().sort((a, b) => a.x - b.x);
    const d = this.def;
    return {
      id: d.id,
      name: d.name,
      era: d.era,
      theme: d.theme || 'jungle',
      seed: d.seed || d.id || 1,
      music: d.music,
      bossMusic: d.bossMusic,
      bulletScale: d.bulletScale || 1,
      cols,
      rows,
      tiles,
      spawn: { x: sx * TILE + TILE / 2, y: sRow * TILE },
      spawns,
      checkpoints: this.checkpoints.slice().sort((a, b) => a.x - b.x),
      prompts: this.prompts,
      exitX: this.exitX,
      zones: this.zones,
      lights: this.lights,
      props: this.props,
      swings: this.swings.length ? this.swings : undefined,
      links: this.links.length ? this.links : undefined,
      wallJump: this.links.some((l) => l.kind === 'wall') || this.def.wallJump || undefined,
      ...this.extra,
    };
  }
}
