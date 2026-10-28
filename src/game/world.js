// The simulation: one World per level attempt. Pure game logic with no DOM access,
// so tests and bots can run it headlessly.

import { DT, TILE, VIEW_W, VIEW_H, DEATH_Y_MARGIN, PLAYER, DIFFICULTY, PICKUP_RULES, enemyCapFor } from './constants.js';
import { SOLID, ONEWAY, HURT, T } from './tiles.js';
import { rectHas, overlap } from './physics.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { rng } from '../engine/rng.js';
import { weaponDef } from './weapons.js';
import { spawnEnemy, updateEnemies, damageEnemy } from './enemies.js';
import { spawnPickup, updatePickups } from './pickups.js';
import './bosses.js'; // registers every boss def and the boss archetype
import { spark, flash, corpse, popup, explosion, updateFx, casing } from './fx.js';
import { launchRocket, gasCloud } from './rocket.js';
import { makeSwing, stepSwing } from './swing.js';
import { TANK_GUN, hitTank, crushable, tankZoneAt } from './tank.js';
import { hitBike, hoverZoneAt } from './bike.js';
import { updateSearchlight, updateAlarm } from './stealth.js';

// tiles the baked terrain layer does not draw (the liquids are drawn live): swaps among them never touch the layer
const LIQUID_OR_AIR = new Uint8Array(16);
[T.AIR, T.WATER, T.LAVA].forEach((t) => (LIQUID_OR_AIR[t] = 1));

const CASING_WEAPONS = new Set(['rifle', 'machine', 'spread']); // the guns that spit brass

export class World {
  constructor(level, opts = {}) {
    this.level = level;
    this.cols = level.cols;
    this.rows = level.rows;
    this.tiles = level.tiles;
    this.tilesDirty = false; // tiles changed since the terrain art was baked (see art/tilelayer.js) ...
    this.dirtyTiles = []; // ... and which ones
    this.opts = opts;
    this.audio = opts.audio || null;
    this.rand = rng((level.seed || 1) * 7919 + 13);
    this.fxRand = rng((level.seed || 1) * 104729 + 7); // cosmetic randomness: particles never touch the gameplay stream
    this.fxQuality = opts.fx === 'low' ? 'low' : 'high';
    this.fxCount = 0; // live particles (kept by updateFx), checked against the quality's budget
    this.tick = 0;
    this.time = 0;
    this.events = []; // consumed by the scene each frame: { type, ... }
    this.platforms = (level.swings || []).map((sw, i) => makeSwing(sw, i)); // moving planks (rope swings)
    this.autoscroll = null;
    this.arena = null; // the wave arena being fought right now (a 'waves' zone), if any
    this.chariot = false; // the soldier is riding a chariot (cosmetic; see the 'chariot' zone)
    this.zones = (level.zones || []).map((z) => ({ ...z })); // runtime copies: zones carry state
    this.gravityZones = this.zones.filter((z) => z.type === 'gravity');
    this.alarmT = 0; // seconds the base stays on alert after a searchlight caught the soldier (see stealth.js)
    this.alarmCool = 0; // seconds before another alarm can ring
    this.god = !!opts.god;
    this.shakeEnabled = opts.shake !== false;

    this.diffName = opts.difficulty || 'normal';
    this.diff = DIFFICULTY[this.diffName] || DIFFICULTY.normal;
    this.bulletMul = this.diff.bulletMul * (level.bulletScale || 1);
    this.enemyCap = level.enemyCap ?? enemyCapFor(level.id ?? -1);

    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.fx = [];
    this.pickups = [];
    this.bombFlash = 0; // white screen flash after a smart bomb
    this.cleared = false; // the level exit was reached (or the boss fell)
    this.boss = null; // the boss fighting right now
    this.bossDone = false;
    // boss arenas in order: the echo fights of a boss rush (level.rush), then the level's own boss (level.boss)
    this.arenas = [...(level.rush || []), ...(level.boss ? [level.boss] : [])];
    this.arenaIdx = 0;
    this.bossDeaths = 0; // player deaths during the boss fight (a clean kill earns a life)
    this.timers = []; // delayed actions: { t, fn }, see after()
    this.clearTimer = 0;
    this.spawnList = (level.spawns || []).map((s) => ({ ...s, done: false }));

    const start = opts.start || level.spawn;
    // checkpoints at or before the start position count as already reached
    this.checkpoints = (level.checkpoints || []).map((c) => ({ ...c, hit: !!opts.start && c.x <= start.x }));
    this.checkpoint = opts.start ? { x: start.x, y: start.y } : null;
    this.player = new Player(start.x, start.y);
    this.player.safeX = start.x;
    this.player.safeY = start.y;
    this.player.fireT = 0;
    this.player.applyLoadout(opts.loadout);
    this.deathT = 0;
    this.camera = new Camera(this);
    this.camera.snap(this.player);
    // a world that starts inside (or past) an arena of a boss rush begins at that arena
    const first = this.arenas.findIndex((a) => a.x1 > start.x);
    this.arenaIdx = first < 0 ? Math.max(0, this.arenas.length - 1) : first;
    this.skipSpawnsBefore(this.camera.x - 64);
    this.supplyTank(start.x);
    this.supplyBike(start.x);
  }

  /** A soldier who starts or respawns inside a tank zone that supplies one is handed a fresh tank. */
  supplyTank(x) {
    const z = tankZoneAt(this, x);
    if (z && z.supply !== false) this.player.mountTank(z);
  }

  /** The same for a hoverbike zone: anyone who starts or respawns inside it is handed a fresh bike. */
  supplyBike(x) {
    const z = hoverZoneAt(this, x);
    if (z && z.supply !== false) this.player.mountBike(z);
  }

  // ---- tile access ----
  tile(tx, ty) {
    if (tx < 0 || tx >= this.cols) return 1; // map edges are walls
    if (ty < 0 || ty >= this.rows) return 0;
    return this.tiles[ty * this.cols + tx];
  }

  setTile(tx, ty, id) {
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return;
    const i = ty * this.cols + tx;
    const old = this.tiles[i];
    if (old === id) return;
    this.tiles[i] = id;
    // the baked terrain art only shows solid-ish tiles: air <-> water <-> lava swaps never change it
    if (!LIQUID_OR_AIR[old] || !LIQUID_OR_AIR[id]) {
      this.tilesDirty = true;
      this.dirtyTiles.push(i);
    }
  }

  solidAtPx(x, y) {
    return !!SOLID[this.tile(Math.floor(x / TILE), Math.floor(y / TILE))];
  }

  onScreen(x, y, margin = 0) {
    const c = this.camera;
    return x >= c.x - margin && x <= c.x + VIEW_W + margin && y >= c.y - margin && y <= c.y + VIEW_H + margin;
  }

  sfx(name) {
    if (this.audio) this.audio.sfx(name);
    this.events.push({ type: 'sfx', name });
  }

  /**
   * Level zones: forced scrolling and rising lava.
   *   { type: 'autoscroll', x0, x1, speed }                      camera pushes on while the player is inside
   *   { type: 'swells', x0, x1, floorY, period, speed, first }   a swell rolls along the deck every `period` s
   *   { type: 'barrage', x0, x1, floorY, period, volley, spread, fuse, first }
   *                                                               siege catapults off screen lob flaming boulders that land
   *                                                               (marked on the floor) where the soldier is standing
   *   { type: 'lavaRise', x0, x1, endRow, interval }             once the player reaches x0, lava climbs one row every
   *                                                               `interval` s (turning air, ground and platforms to lava)
   *                                                               until row `endRow`; a rumble warns one second ahead
   */
  updateZones(dt) {
    if (!this.zones.length) return;
    const px = this.player.x;
    let auto = null;
    for (const z of this.zones) {
      if ((z.type === 'autoscroll' || z.type === 'chariot') && px >= z.x0 && px < z.x1) auto = z;
      if (z.type === 'waves') {
        this.updateArena(z, dt);
        continue;
      }
      if (z.type === 'swells') {
        this.updateSwells(z, dt);
        continue;
      }
      if (z.type === 'barrage') {
        this.updateBarrage(z, dt);
        continue;
      }
      if (z.type === 'vent') {
        this.updateVent(z, dt);
        continue;
      }
      if (z.type === 'searchlight') {
        updateSearchlight(this, z, dt);
        continue;
      }
      if (z.type === 'beam') {
        this.updateBeam(z, dt);
        continue;
      }
      if (z.type === 'hover') {
        const pl = this.player;
        if (px >= z.x0 && px < z.x1) auto = z; // the camera rolls on while the soldier is over the skyway
        if (!pl.alive) continue;
        // the boarding pad at the start of the skyway: a soldier on foot climbs onto the parked hoverbike
        if (pl.mode === 'foot' && z.supply !== false && px >= z.x0 && px < z.x0 + 3 * TILE) {
          pl.mountBike(z);
          popup(this, pl.x, pl.y - 40, 'HOVERBIKE!', '#4af0ff');
          this.sfx('weapon');
        }
        // the end of the skyway: the bike sets down and the soldier goes on foot
        if (pl.mode === 'fly' && pl.bikeZone === z && px >= z.x1) {
          pl.leaveBike();
          pl.vy = 0;
          pl.grounded = false;
          popup(this, pl.x, pl.y - 36, 'ON FOOT', '#ffffff');
          this.sfx('capsule');
        }
        continue;
      }
      if (z.type === 'tank') {
        const pl = this.player;
        if (!pl.alive) continue;
        // the boarding area at the start of the tank road: a soldier on foot climbs into the parked tank
        if (pl.mode === 'foot' && z.supply !== false && px >= z.x0 && px < z.x0 + 3 * TILE) {
          pl.mountTank(z);
          popup(this, pl.x, pl.y - 40, 'TANK!', '#ffd23a');
          this.sfx('weapon');
        }
        // the end of the tank road: the soldier climbs out and goes on foot
        if (pl.mode === 'tank' && pl.tankRoad === z && z.dismount !== false && px >= z.x1) {
          pl.leaveTank();
          pl.vy = -160;
          pl.grounded = false;
          popup(this, pl.x, pl.y - 36, 'ON FOOT', '#ffffff');
          this.sfx('capsule');
        }
        continue;
      }
      if (z.type !== 'lavaRise') continue;
      if (!z.on) {
        if (px < z.x0) continue;
        z.on = true;
        z.row = this.rows;
        z.t = 0;
      }
      if (z.row <= z.endRow) continue;
      z.t += dt;
      if (z.t >= z.interval - 1 && !z.warned) {
        z.warned = true;
        this.sfx('rumble');
        this.camera.shake(2, 1);
      }
      if (z.t >= z.interval) {
        z.t = 0;
        z.warned = false;
        z.row--;
        for (let x = Math.floor(z.x0 / TILE); x < Math.ceil(z.x1 / TILE); x++) {
          const t = this.tile(x, z.row);
          if (t === T.AIR || t === T.SOLID || t === T.PLATFORM || t === T.WATER || t === T.ICE) this.setTile(x, z.row, T.LAVA);
        }
        this.events.push({ type: 'lavaRise', row: z.row });
      }
    }
    this.autoscroll = auto ? { active: true, speed: auto.speed } : null;
    this.chariot = !!auto && auto.type === 'chariot';
  }

  /**
   * A heaving sea: while the soldier is inside the zone a swell rolls in from the right edge of the screen every
   * `period` seconds, low along the deck, and has to be jumped (blocks stop it, so a bulwark is cover).
   *   { type: 'swells', x0, x1, floorY, period, speed }
   */
  /**
   * A steam vent in the floor: every `period` seconds a flashing mark appears, `tele` seconds later a column of scalding
   * steam (`height` px) bursts up for `hold` seconds. Dormant while off screen. { type: 'vent', x, floorY, period, tele, hold, height, phase }
   */
  updateVent(z, dt) {
    if (z.t === undefined) z.t = z.phase ?? 0.8;
    if (!this.onScreen(z.x, z.floorY - 8, 40)) return;
    z.t -= dt;
    if (z.t > 0) return;
    z.t = z.period;
    const tele = z.tele ?? 0.9;
    this.fx.push({ k: 'warn', x: z.x, y: z.floorY, t: 0, life: tele, max: tele });
    this.after(tele, () => {
      this.sfx('boom');
      for (let y = z.floorY - 4; y > z.floorY - (z.height ?? 64); y -= 9) {
        this.spawnEnemyBullet({ x: z.x, y, vx: 0, vy: 0, r: 4, kind: 'steam', col: '#e8f0f8', persist: true, ghost: true, life: z.hold ?? 0.7 });
      }
    });
  }

  /**
   * A laser emitter: a flashing mark, then a beam of light stabs down from the ceiling (or up from the floor) for `hold`
   * seconds. { type: 'beam', x, y (the emitter), dir: 1 down / -1 up, length, period, tele, hold, phase }
   */
  updateBeam(z, dt) {
    if (z.t === undefined) z.t = z.phase ?? 0.8;
    if (!this.onScreen(z.x, z.y, 60)) return;
    z.t -= dt;
    if (z.t > 0) return;
    z.t = z.period;
    const tele = z.tele ?? 0.9;
    const tipY = z.y + z.dir * z.length;
    this.fx.push({ k: 'warn', x: z.x, y: tipY, t: 0, life: tele, max: tele });
    this.after(tele, () => {
      this.sfx('lightning');
      for (let i = 0; i < z.length; i += 8) {
        this.spawnEnemyBullet({ x: z.x, y: z.y + z.dir * (i + 3), vx: 0, vy: 0, r: 4, kind: 'beam', col: z.col || '#ff4ad8', persist: true, ghost: true, life: z.hold ?? 0.6 });
      }
    });
  }

  /** Catapult fire: boulders arc in from the right and land on the soldier's spot; a floor mark shows where, `fuse` s ahead. */
  updateBarrage(z, dt) {
    const p = this.player;
    if (!p.alive || p.x < z.x0 || p.x >= z.x1) {
      z.t = z.first ?? 1.6;
      return;
    }
    if (z.t === undefined) z.t = z.first ?? 1.6;
    z.t -= dt;
    if (z.t > 0) return;
    z.t = z.period;
    const cam = this.camera;
    const n = z.volley || 1;
    const fuse = z.fuse || 1.35;
    for (let i = 0; i < n; i++) {
      // the first boulder is aimed at the soldier, the others fall to either side of that spot
      const off = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (z.spread || 64);
      const tx = Math.max(cam.x + 22, Math.min(cam.x + VIEW_W - 22, p.x + off));
      const delay = i * 0.28;
      this.after(delay, () => {
        const c = this.camera;
        const x0 = c.x + VIEW_W + 34;
        const y0 = z.floorY - 64;
        this.fx.push({ k: 'warn', x: tx, y: z.floorY, t: 0, life: fuse, max: fuse });
        if (z.gas) launchRocket(this, x0, y0, { tx, ty: z.floorY - 3, fuse, kind: 'shell', r: 3, col: '#a8c858', onBurst: (w, bx) => gasCloud(w, bx, z.floorY, z.linger) });
        else if (z.shell) launchRocket(this, x0, y0, { tx, ty: z.floorY - 3, fuse, n: 7, burstSpeed: 64, col: '#ffb02e', kind: 'shell', r: 3 }); // naval gunfire
        else launchRocket(this, x0, y0, { tx, ty: z.floorY - 3, fuse, n: 6, burstSpeed: 58, col: '#ff8a1e', kind: 'boulder', r: 4 });
      });
    }
    this.sfx('rumble');
  }

  updateSwells(z, dt) {
    const px = this.player.x;
    if (!this.player.alive || px < z.x0 || px >= z.x1) {
      z.t = z.first ?? 1.6;
      return;
    }
    if (z.t === undefined) z.t = z.first ?? 1.6;
    z.t -= dt;
    if (z.t > 0) return;
    z.t = z.period;
    const cam = this.camera;
    this.spawnEnemyBullet({
      x: cam.x + VIEW_W + 12,
      y: z.floorY - 6,
      vx: -z.speed * this.bulletMul,
      vy: 0,
      r: 6,
      kind: 'surf',
      persist: true,
      life: 9,
    });
    this.camera.shake(1.5, 0.25);
    this.sfx('rumble');
  }

  /**
   * A wave arena: when the player walks in, the camera slides onto the arena and locks; waves of enemies then run in
   * from both edges, one wave at a time (the next starts a moment after the last is dead). The lock lifts when
   * the final wave is down. States: idle -> locking -> fighting -> done.
   *   { type: 'waves', x0, floorY, waves: [[{ type, side: 'L'|'R', y?, item? } | { type, dx, y }, ...], ...] }
   *   (a wave member with `dx` (tiles from the arena's left edge) and `y` appears in place: archers on ledges)
   */
  updateArena(z, dt) {
    const cam = this.camera;
    if (z.state === 'done') return;
    if (!z.state) z.state = 'idle';
    if (z.state === 'idle') {
      if (this.player.x >= z.x1) {
        z.state = 'done'; // started past it (a checkpoint, a test): there is nothing left to fight
        return;
      }
      if (!this.player.alive || this.player.x < z.x0 + 3 * TILE) return;
      z.state = 'locking';
      cam.lockMax = z.x0; // the camera may not run on past the arena
      this.arena = z;
    }
    if (z.state === 'locking') {
      cam.x += (z.x0 - cam.x) * Math.min(1, 8 * dt);
      if (z.x0 - cam.x > 1) return;
      cam.x = z.x0;
      cam.lockMin = z.x0;
      z.state = 'fighting';
      z.wave = -1;
      z.gap = 0.9;
      this.ebullets.length = 0;
      this.sfx('warning');
    }
    if (this.enemies.some((e) => e.alive && e.arenaZone === z)) return;
    z.gap -= dt;
    if (z.gap > 0) return;
    z.wave++;
    if (z.wave >= z.waves.length) {
      z.state = 'done';
      cam.lockMin = cam.lockMax = null;
      this.arena = null;
      this.sfx('clear');
      this.events.push({ type: 'arenaClear', x: this.player.x, y: this.player.y - 30 });
      return;
    }
    const slots = { L: 0, R: 0 };
    for (const s of z.waves[z.wave]) {
      if (s.dx !== undefined) {
        // stationary shooters appear in place (on a ledge, say) instead of running in from the edge
        const e = spawnEnemy(this, { ...s, x: z.x0 + s.dx * TILE + TILE / 2, y: s.y ?? z.floorY, face: this.player.x >= z.x0 + s.dx * TILE ? 1 : -1 });
        e.arenaZone = z;
        flash(this, e.x, e.cy, '#ffffff');
        continue;
      }
      const side = s.side === 'L' ? 'L' : 'R';
      const k = slots[side]++;
      const x = side === 'L' ? cam.x - 14 - k * 26 : cam.x + VIEW_W + 14 + k * 26;
      const e = spawnEnemy(this, { ...s, x, y: s.y ?? z.floorY, face: side === 'L' ? 1 : -1 });
      e.arenaZone = z;
    }
    z.gap = 1.0;
    this.events.push({ type: 'arenaWave', n: z.wave + 1, of: z.waves.length });
  }

  /** Run `fn` after `sec` seconds of game time (attack scripts use this for delayed eruptions and drops). */
  after(sec, fn) {
    this.timers.push({ t: sec, fn });
  }

  updateTimers(dt) {
    if (!this.timers.length) return;
    const due = [];
    for (const t of this.timers) {
      t.t -= dt;
      if (t.t <= 0) due.push(t);
    }
    if (due.length) {
      this.timers = this.timers.filter((t) => t.t > 0);
      for (const t of due) t.fn();
    }
  }

  /** The boss arena that is next (or being fought): an echo arena of a boss rush, then the level's own boss. */
  get bossArena() {
    return this.arenas[this.arenaIdx] || null;
  }

  /** An echo of a boss rush has fallen: lift the camera lock and look ahead to the next arena. */
  nextArena() {
    this.arenaIdx = Math.min(this.arenas.length - 1, this.arenaIdx + 1);
    this.bossDone = false;
    this.bossDeaths = 0;
    this.camera.lockMin = this.camera.lockMax = null;
    this.ebullets.length = 0;
  }

  /** Start the boss fight when the player walks into the arena: lock the camera, sweep the stage, spawn the boss. */
  checkBoss() {
    const L = this.bossArena;
    if (!L || this.boss || this.bossDone || !this.player.alive) return;
    if (this.player.x < L.trigger) return;
    if (L.triggerY !== undefined && this.player.y > L.triggerY) return; // tower: stand on the arena floor first
    const cam = this.camera;
    cam.lockMin = cam.lockMax = L.cam;
    for (const e of this.enemies) if (e.alive) e.alive = false;
    // the stage ahead of an echo arena keeps its soldiers for later
    for (const s of this.spawnList) if (!L.echo || s.x < L.x1) s.done = true;
    this.ebullets.length = 0;
    this.bossDeaths = 0;
    const b = spawnEnemy(this, { type: L.type, x: L.spawnX, y: L.floorY, face: -1 });
    if (L.hp) b.hp = b.maxHp = L.hp; // an echo is a weaker copy of an old boss
    if (L.echo) b.echo = true;
    this.boss = b;
    this.sfx('warning');
    this.events.push({ type: 'bossStart', id: L.type, echo: !!L.echo });
  }

  skipSpawnsBefore(x) {
    for (const s of this.spawnList) if (s.x < x) s.done = true;
  }

  // ---- bullets ----
  spawnBullet(b) {
    b.w = b.w || 4;
    b.h = b.h || 4;
    b.pierce = b.pierce || 0;
    b.hits = null;
    this.bullets.push(b);
    return b;
  }

  spawnEnemyBullet(b) {
    b.r = b.r || 2;
    b.life = b.life || 6;
    this.ebullets.push(b);
    return b;
  }

  // ---- player ----
  playerFire() {
    const p = this.player;
    const wd = p.mode === 'tank' ? TANK_GUN : weaponDef(p.weapon);
    const m = p.muzzle();
    wd.fire(this, m, p);
    p.fireT = wd.cooldown / (p.rapid && p.mode !== 'tank' ? 1.5 : 1);
    this.lightPulse = 1; // muzzle flash: lights up dark caves for a moment
    this.sfx(wd.sfx || 'shoot');
    flash(this, m.x, m.y, '#fff7c2');
    if (p.mode !== 'tank' && CASING_WEAPONS.has(p.weapon)) casing(this, m.x - p.face * 5, m.y + 1, p.face);
  }

  killPlayer(cause) {
    const p = this.player;
    if (!p.alive) return;
    p.alive = false;
    this.deathT = 0;
    this.deathCause = cause;
    corpse(this, p);
    p.leaveTank();
    p.leaveBike();
    p.dropToRifle();
    this.sfx('die');
    if (this.boss) this.bossDeaths++;
    this.camera.shake(3, 0.3);
    this.events.push({ type: 'playerDied', cause });
  }

  /** Damage that respects invulnerability and god mode. */
  hurtPlayer(cause) {
    const p = this.player;
    if (!p.alive || this.god || p.invuln > 0 || p.barrier > 0) return false;
    if (hitTank(this, cause) || hitBike(this, cause)) return true; // a tank or a hoverbike soaks it up
    this.killPlayer(cause);
    return true;
  }

  respawnPlayer(x, y) {
    const p = this.player;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = p.vy = 0;
    p.prone = false;
    p.h = PLAYER.H;
    p.gdir = 1;
    p.invuln = PLAYER.RESPAWN_INVULN;
    p.quickT = 0;
    p.fireT = 0;
    p.jumping = false;
    this.deathT = 0;
    this.supplyTank(x);
    this.supplyBike(x);
    this.ebullets.length = 0; // fair respawn: no bullets left hanging in the air
  }

  /** Where to put the player after a death: the last stable ground, kept inside the camera. */
  respawnPoint() {
    const p = this.player;
    let x = p.safeX;
    const cam = this.camera;
    x = Math.max(x, cam.x + 24);
    x = Math.min(x, cam.x + VIEW_W - 24);
    return { x, y: p.safeY };
  }

  /**
   * Gravity halls (Level 19): inside a 'gravity' zone a soldier on foot is pulled to the ceiling and walks along it; the
   * moment they step out of the zone gravity returns and they fall to the floor on the other side. The tank and the
   * hoverbike are never flipped.
   */
  updateGravity() {
    if (!this.gravityZones.length) return; // levels without halls leave gravity alone (tests may set it by hand)
    const p = this.player;
    let want = 1;
    if (p.mode === 'foot') {
      for (const z of this.gravityZones) if (p.x >= z.x0 && p.x < z.x1) want = -1;
    }
    if (want !== p.gdir) {
      p.gdir = want;
      p.grounded = false;
      p.coyote = 0;
      p.jumping = false;
      if (p.alive) {
        this.sfx('rift');
        popup(this, p.x, p.y - 40, want < 0 ? 'GRAVITY FLIP' : 'GRAVITY NORMAL', '#4af0ff');
      }
    }
  }

  /** Move the rope-swing planks and carry the soldier along if they are standing on one. */
  updatePlatforms(dt) {
    const p = this.player;
    for (const pl of this.platforms) {
      const riding = p.alive && p.platform === pl;
      const { dx, dy } = stepSwing(pl, dt);
      if (riding) {
        p.x += dx;
        p.y += dy;
      }
      pl.prevX = pl.x;
      pl.prevY = pl.y; // the plank has already moved: landing checks compare against where it is now
    }
  }

  // ---- main step ----
  update(input, dt = DT) {
    this.tick++;
    this.time += dt;
    const p = this.player;
    if (this.platforms.length) this.updatePlatforms(dt);
    this.updateGravity();

    p.update(this, input, dt);
    this.camera.update(this, p, dt);

    // firing
    p.fireT = Math.max(0, p.fireT - dt);
    if (p.alive && input.held.fire && p.fireT <= 0) this.playerFire();

    // weapon swap and smart bomb
    if (p.alive) {
      if (input.pressed.switch && p.switchWeapon()) this.sfx('capsule');
      if (input.pressed.bomb) this.useBomb();
    }
    if (this.bombFlash > 0) this.bombFlash = Math.max(0, this.bombFlash - dt);

    this.lightPulse = Math.max(0, (this.lightPulse || 0) - dt * 6);
    updateAlarm(this, dt);
    this.updateTimers(dt);
    this.updateZones(dt);
    this.activateSpawns();
    this.updateCheckpoints();
    this.checkExit();
    this.checkBoss();
    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0 && !this.cleared) {
        this.cleared = true;
        this.events.push({ type: 'levelClear' });
      }
    }
    updateEnemies(this, dt);
    updatePickups(this, dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);
    updateFx(this, dt);

    if (p.alive) {
      this.trackSafeSpot();
      this.checkContacts();
      // death by falling out of the world (always lethal), spikes / lava (blocked by invulnerability)
      if (p.y > this.rows * TILE + DEATH_Y_MARGIN) {
        this.events.push({ type: 'fell' });
        if (!this.god) this.killPlayer('fell');
      }
      const hb = p.hurtBox();
      if (rectHas(this, HURT, hb.x0, hb.y0, hb.x1, hb.y1)) {
        this.events.push({ type: 'hazard' });
        this.hurtPlayer('hazard');
      }
    } else {
      this.deathT += dt;
    }

    // cleanup
    compact(this.enemies, (e) => e.alive);
    compact(this.bullets, (b) => !b.dead);
    compact(this.ebullets, (b) => !b.dead);
  }

  trackSafeSpot() {
    const p = this.player;
    // Remember the last stable ground the player stood on (not a moving platform) for respawning.
    const g = p.groundTile;
    if (p.gdir < 0 || p.mode === 'fly') return; // ceilings and the air are not safe ground
    if (p.grounded && !p.platform && (SOLID[g] || ONEWAY[g])) {
      const ahead = this.tile(Math.floor((p.x + p.face * 12) / TILE), Math.floor((p.y + 2) / TILE));
      if ((SOLID[ahead] || ONEWAY[ahead]) && this.onScreen(p.x, p.y, -10)) {
        p.safeX = p.x;
        p.safeY = p.y;
      }
    }
  }

  /** The smart bomb: wipes enemy bullets and hits everything on screen hard. */
  useBomb() {
    const p = this.player;
    if (!p.alive || p.bombs <= 0) return false;
    p.bombs--;
    this.sfx('bomb');
    this.camera.shake(6, 0.6);
    this.bombFlash = 0.5;
    for (const b of this.ebullets) b.dead = true;
    for (const e of this.enemies) {
      if (!e.alive || e.hidden || e.def.noBomb) continue;
      if (!this.onScreen(e.x, e.cy, 0)) continue;
      explosion(this, e.x, e.cy, 0);
      damageEnemy(this, e, PICKUP_RULES.BOMB_DAMAGE, null, true);
    }
    this.events.push({ type: 'bomb' });
    return true;
  }

  /** Simple level exit used by the testbed; real levels end at the boss door (Week 6). */
  checkExit() {
    const x = this.level.exitX;
    const y = this.level.exitY;
    if (this.cleared || !this.player.alive) return;
    if (y !== undefined && this.player.y <= y) {
      this.cleared = true;
      this.events.push({ type: 'levelClear' });
      return;
    }
    if (x === undefined) return;
    if (this.player.x >= x) {
      this.cleared = true;
      this.events.push({ type: 'levelClear' });
    }
  }

  updateCheckpoints() {
    const p = this.player;
    if (!p.alive) return;
    for (const c of this.checkpoints) {
      if (!c.hit && p.x >= c.x) {
        c.hit = true;
        this.checkpoint = { x: c.x, y: c.y };
        this.sfx('checkpoint');
        popup(this, p.x, p.y - 40, 'CHECKPOINT', '#8be9ff');
        this.events.push({ type: 'checkpoint', x: c.x, y: c.y });
      }
    }
  }

  activateSpawns() {
    const cam = this.camera;
    const right = cam.x + VIEW_W;
    const bottom = cam.y + VIEW_H;
    for (const s of this.spawnList) {
      if (s.done) continue;
      const trig = s.trig !== undefined ? s.trig : s.x - 24;
      if (s.x < cam.x - 120) {
        s.done = true;
      } else if (right >= trig && (!cam.tall || (s.y > cam.y - 80 && s.y < bottom + 80))) {
        if (s.type === 'pickup') {
          s.done = true;
          spawnPickup(this, s.item, s.x, s.y, { float: true });
        } else if (s.type === 'capsule' || this.crowd() < this.enemyCap) {
          s.done = true;
          spawnEnemy(this, s);
        } // else: the screen is full, this one waits (and is dropped once it is behind the camera)
      }
    }
  }

  /** Enemies that count toward the on-screen cap (capsules and decorations do not). */
  crowd() {
    let n = 0;
    for (const e of this.enemies) if (e.alive && !e.def.noCap && !e.waiting) n++;
    return n;
  }

  /** The tutorial prompt for the player's position, or null. */
  promptAt(x = this.player.x) {
    const y = this.player.y;
    for (const pr of this.level.prompts || []) {
      if (x >= pr.x0 && x < pr.x1 && (pr.y0 === undefined || (y >= pr.y0 && y < pr.y1))) return pr.text;
    }
    return null;
  }

  checkContacts() {
    const p = this.player;
    const hb = p.hurtBox();
    for (const e of this.enemies) {
      if (!e.alive || e.hidden || e.noContact || e.def.contact === false) continue;
      if (overlap(hb, e.contactBox())) {
        if (crushable(this, e)) continue;
        if (this.hurtPlayer('enemy')) return;
      }
    }
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      if (b.update) b.update(b, this, dt);
      if (b.g) b.vy += b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || !this.onScreen(b.x, b.y, 40)) {
        b.dead = true;
        continue;
      }
      if (!b.ghost && this.solidAtPx(b.x, b.y)) {
        spark(this, b.x, b.y, '#d8d0c0', 2, 40);
        if (b.onWall) b.onWall(b, this);
        b.dead = true;
        continue;
      }
      const box = { x0: b.x - b.w / 2, y0: b.y - b.h / 2, x1: b.x + b.w / 2, y1: b.y + b.h / 2 };
      for (const e of this.enemies) {
        if (!e.alive || e.hidden) continue;
        if (b.hits && b.hits.has(e)) continue;
        if (!overlap(box, e.hitBox())) continue;
        if (b.onHit) b.onHit(b, this, e);
        damageEnemy(this, e, b.dmg, b);
        if (b.pierce > 0) {
          b.pierce--;
          (b.hits || (b.hits = new Set())).add(e);
        } else {
          b.dead = true;
          break;
        }
      }
    }
  }

  updateEnemyBullets(dt) {
    const p = this.player;
    const hb = p.alive ? p.hurtBox() : null;
    for (const b of this.ebullets) {
      if (b.update) b.update(b, this, dt);
      if (b.g) b.vy += b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || !this.onScreen(b.x, b.y, 60)) {
        b.dead = true;
        continue;
      }
      if (!b.ghost && this.solidAtPx(b.x, b.y)) {
        spark(this, b.x, b.y, '#ff9a6a', 2, 40);
        b.dead = true;
        continue;
      }
      if (hb) {
        const r = b.r;
        if (b.x + r > hb.x0 && b.x - r < hb.x1 && b.y + r > hb.y0 && b.y - r < hb.y1) {
          if (this.hurtPlayer('bullet')) b.dead = true;
          else if (!b.persist) b.dead = true;
        }
      }
    }
  }
}

function compact(list, keep) {
  let w = 0;
  for (let i = 0; i < list.length; i++) if (keep(list[i])) list[w++] = list[i];
  list.length = w;
}
