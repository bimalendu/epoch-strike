// The player soldier: run, variable-height jump, prone, drop-through platforms, 8-way aim,
// plus ice, conveyors, water and flipped gravity (used by later levels).

import { PLAYER, TANK, BIKE, TILE, PICKUP_RULES, VIEW_W, VIEW_H } from './constants.js';
import { T, SOLID, LIQUID, conveyorDir } from './tiles.js';
import { moveBody, rectSolid } from './physics.js';
import { spark, dust } from './fx.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y; // feet (bottom of hitbox)
    this.vx = 0;
    this.vy = 0;
    this.w = PLAYER.W;
    this.h = PLAYER.H;
    this.gdir = 1; // +1 normal gravity, -1 flipped (walk on ceilings)
    this.face = 1;
    this.aimX = 1;
    this.aimY = 0;
    this.prone = false;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.drop = 0;
    this.jumping = false;
    this.inWater = false;
    this.inQuick = false;
    this.quickT = 0; // seconds spent in quicksand (drowns at QUICK_DROWN)
    this.anim = 0;
    this.platform = null;
    this.hitWall = 0;
    this.wallDir = 0; // wall jumps: -1 / 1 when a wall is touching the soldier's side in mid-air
    this.wallSide = 0; // the side of the last wall touched (a kick still works for WALL_COYOTE s afterwards)
    this.wallCoyote = 0;
    this.kickT = 0; // seconds left of a wall kick's fixed heading
    this.groundTile = 0;
    this.mode = 'foot'; // 'foot' | 'fly' | 'tank'
    this.tankHp = 0; // hits the tank can still take (mode 'tank')
    this.tankRoad = null; // the tank road zone this tank belongs to (it is left behind at the end of the road)
    this.bikeHp = 0; // hits the hoverbike can still take (mode 'fly')
    this.bikeZone = null; // the hover zone this bike belongs to
    this.alive = true;
    this.invuln = 0;
    this.stateT = 0;
    // loadout: carry two weapons and swap freely (slot 0 starts as the rifle)
    this.slots = ['rifle', null];
    this.slot = 0;
    this.rapid = false; // R pickup: +50% fire rate until death
    this.barrier = 0; // B pickup: seconds of invincibility left
    this.bombs = PICKUP_RULES.START_BOMBS;
  }

  /** Id of the weapon in the active slot. */
  get weapon() {
    return this.slots[this.slot];
  }

  set weapon(id) {
    this.slots[this.slot] = id;
  }

  /**
   * Pick up a weapon. Goes into the empty slot if there is one, otherwise replaces the active weapon.
   * Returns 'dup' (already carried: just switches to it), 'new' or 'swap'.
   */
  giveWeapon(id) {
    const have = this.slots.indexOf(id);
    if (have >= 0) {
      this.slot = have;
      return 'dup';
    }
    const empty = this.slots.indexOf(null);
    if (empty >= 0) {
      this.slots[empty] = id;
      this.slot = empty;
      return 'new';
    }
    this.slots[this.slot] = id;
    return 'swap';
  }

  /** Swap to the other carried weapon. Returns true if there was one. */
  switchWeapon() {
    const other = 1 - this.slot;
    if (!this.slots[other]) return false;
    this.slot = other;
    return true;
  }

  /** Dying drops the active weapon back to the rifle (the other carried weapon is kept). */
  dropToRifle() {
    const other = 1 - this.slot;
    if (this.slots[other] === 'rifle') {
      this.slots[this.slot] = null;
      this.slot = other;
    } else {
      this.slots[this.slot] = 'rifle';
    }
    this.rapid = false;
    this.barrier = 0;
  }

  /** Snapshot of what the player carries between levels. */
  loadout() {
    return { slots: [...this.slots], slot: this.slot, bombs: this.bombs };
  }

  applyLoadout(l) {
    if (!l) return;
    this.slots = [l.slots[0] || 'rifle', l.slots[1] || null];
    this.slot = this.slots[l.slot] ? l.slot : 0;
    this.bombs = l.bombs ?? this.bombs;
  }

  /** Top of the sprite (the sprite is 32px tall; flipped gravity draws it upside-down from the hitbox top). */
  spriteTop() {
    return this.gdir > 0 ? this.y - 32 : this.y - PLAYER.H;
  }

  /** Where the gun arm attaches. */
  shoulder() {
    const top = this.spriteTop();
    if (this.mode === 'fly') return { x: this.x + this.face * 3, y: this.y - 14 }; // the rider's chest
    if (this.mode === 'tank') return { x: this.x + this.face * 3, y: this.y - 15 }; // the turret pivot
    // the sprite is drawn upside-down when gravity is flipped, so a point `k` px below its top is `32 - k` below it there
    const at = (k) => (this.gdir > 0 ? top + k : top + 32 - k);
    if (this.prone) return { x: this.x + this.face * 7, y: top + 26 };
    if (!this.grounded && !this.inWater) return { x: this.x, y: at(16) };
    return { x: this.x + this.face * 2, y: at(11) };
  }

  aimVec() {
    const n = Math.hypot(this.aimX, this.aimY) || 1;
    return { x: this.aimX / n, y: this.aimY / n };
  }

  muzzle() {
    const s = this.shoulder();
    const d = this.aimVec();
    const len = this.mode === 'tank' ? 24 : !this.grounded && !this.inWater ? 10 : 15;
    return { x: s.x + d.x * len, y: s.y + d.y * len, dx: d.x, dy: d.y };
  }

  /** Climb into a fresh tank: wider, slower, with TANK.HP hits of armour. */
  mountTank(road = null) {
    this.mode = 'tank';
    this.tankRoad = road;
    this.tankHp = TANK.HP;
    this.prone = false;
    this.w = TANK.W;
    this.h = TANK.H;
    this.invuln = Math.max(this.invuln, 0.5);
  }

  /** Back on foot (the tank is wrecked, abandoned or the soldier died). */
  leaveTank() {
    if (this.mode !== 'tank') return;
    this.mode = 'foot';
    this.tankHp = 0;
    this.tankRoad = null;
    this.w = PLAYER.W;
    this.h = PLAYER.H;
  }

  /** Climb onto a fresh hoverbike: free flight inside the screen, with BIKE.HP hits of armour. */
  mountBike(zone = null) {
    this.mode = 'fly';
    this.bikeZone = zone;
    this.bikeHp = BIKE.HP;
    this.prone = false;
    this.w = BIKE.W;
    this.h = BIKE.H;
    this.gdir = 1;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.platform = null;
    this.invuln = Math.max(this.invuln, 0.5);
  }

  /** Back on foot (the bike is wrecked, the skyway ends or the soldier died). */
  leaveBike() {
    if (this.mode !== 'fly') return;
    this.mode = 'foot';
    this.bikeHp = 0;
    this.bikeZone = null;
    this.w = PLAYER.W;
    this.h = PLAYER.H;
  }

  hurtBox() {
    if (this.mode === 'fly') return { x0: this.x - 9, y0: this.y - 20, x1: this.x + 9, y1: this.y - 2 }; // the bike and its rider
    if (this.prone) return { x0: this.x - 10, y0: this.y - this.h, x1: this.x + 10, y1: this.y - 1 };
    return { x0: this.x - this.w / 2 + 1, y0: this.y - this.h + 3, x1: this.x + this.w / 2 - 1, y1: this.y - 1 };
  }

  update(world, input, dt) {
    if (!this.alive) return;
    if (this.mode === 'fly') return this.updateFly(world, input, dt);

    const held = input.held;
    const gdir = this.gdir;
    const h = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const up = held.up;
    const down = held.down;

    this.invuln = Math.max(0, this.invuln - dt);
    this.barrier = Math.max(0, this.barrier - dt);
    this.stateT += dt;

    const cx = Math.floor(this.x / TILE);
    this.inWater = !!LIQUID[world.tile(cx, Math.floor((this.y - this.h * 0.5) / TILE))];
    this.inQuick = world.tile(cx, Math.floor((this.y - 2) / TILE)) === T.QUICK;
    this.quickT = this.inQuick ? this.quickT + dt : Math.max(0, this.quickT - dt * 2);
    if (this.quickT > PLAYER.QUICK_DROWN) world.hurtPlayer('quicksand');

    // ---- prone / stand ----
    const tank = this.mode === 'tank';
    const wantProne = !tank && this.grounded && down && h === 0 && gdir === 1 && !this.inWater;
    if (wantProne && !this.prone) {
      this.prone = true;
      this.h = PLAYER.PRONE_H;
    } else if (!wantProne && this.prone) {
      const clear = !rectSolid(world, this.x - this.w / 2, this.y - PLAYER.H, this.x + this.w / 2, this.y - this.h);
      if (clear) {
        this.prone = false;
        this.h = PLAYER.H;
      }
    }

    // ---- facing and 8-way aim ----
    if (h !== 0) this.face = h;
    let ax = this.face;
    let ay = 0;
    if (this.prone) {
      ay = 0;
    } else if (up) {
      ay = -1;
      ax = h ? this.face : 0;
    } else if (down && !tank && (h !== 0 || !this.grounded)) {
      ay = 1;
      ax = h ? this.face : 0;
    }
    if (this.inWater && ay > 0) {
      ay = 0;
      ax = this.face;
    }
    this.aimX = ax;
    this.aimY = ay;

    // ---- wall contact (levels with wall jumps) ----
    const wj = !!world.level.wallJump;
    let wallDir = 0;
    if (wj && !tank && !this.grounded && !this.inWater && gdir === 1) {
      const my = Math.floor((this.y - this.h * 0.5) / TILE);
      if (SOLID[world.tile(Math.floor((this.x + this.w / 2 + 1.5) / TILE), my)]) wallDir = 1;
      else if (SOLID[world.tile(Math.floor((this.x - this.w / 2 - 1.5) / TILE), my)]) wallDir = -1;
    }
    this.wallDir = wallDir;
    if (wallDir) {
      this.wallSide = wallDir;
      this.wallCoyote = PLAYER.WALL_COYOTE;
    } else {
      this.wallCoyote = Math.max(0, this.wallCoyote - dt);
    }
    this.kickT = Math.max(0, this.kickT - dt);

    // ---- horizontal ----
    let speedMul = this.inWater ? PLAYER.WATER_SPEED : 1;
    if (this.inQuick) speedMul *= PLAYER.QUICK_SPEED;
    const target = this.prone ? 0 : h * (tank ? TANK.RUN : PLAYER.RUN) * speedMul;
    if (this.kickT > 0) {
      // a wall kick keeps its heading for a moment
    } else if (this.grounded && this.groundTile === T.ICE) {
      this.vx += (target - this.vx) * Math.min(1, PLAYER.ICE_K * dt);
    } else {
      this.vx = target + (this.grounded ? conveyorDir(this.groundTile) * PLAYER.CONVEYOR : 0);
    }

    // ---- jump / drop ----
    this.drop = Math.max(0, this.drop - dt);
    this.jumpBuf = input.pressed.jump ? PLAYER.BUFFER : Math.max(0, this.jumpBuf - dt);
    this.coyote = this.grounded ? PLAYER.COYOTE : Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0) {
      const standingOnOneWay =
        this.grounded && (world.tile(cx, Math.floor((this.y + 0.5) / TILE)) === T.PLATFORM || this.platform);
      if (down && this.grounded && gdir === 1 && !tank) {
        if (standingOnOneWay) {
          this.drop = PLAYER.DROP_TIME;
          this.grounded = false;
          this.platform = null;
          this.y += 1;
        }
        this.jumpBuf = 0;
      } else if (this.coyote > 0 || (this.inWater && this.grounded)) {
        const jm = this.inWater ? PLAYER.WATER_JUMP : 1;
        this.vy = -(tank ? TANK.JUMP_V : PLAYER.JUMP_V) * jm * gdir;
        this.jumping = true;
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuf = 0;
        if (this.prone) {
          this.prone = false;
          this.h = PLAYER.H;
        }
        world.sfx('jump');
      } else if (wj && this.wallCoyote > 0 && !this.grounded) {
        // wall kick: spring off the wall, up and away
        const side = this.wallSide;
        this.vy = -PLAYER.WALL_JUMP_V;
        this.vx = -side * PLAYER.WALL_KICK;
        this.kickT = PLAYER.WALL_LOCK;
        this.face = -side;
        this.jumping = true;
        this.wallCoyote = 0;
        this.jumpBuf = 0;
        spark(world, this.x + side * (this.w / 2), this.y - this.h * 0.5, '#e8e0d0', 4, 50);
        world.sfx('jump');
      }
    }
    if (this.jumping) {
      if (this.vy * gdir >= 0) this.jumping = false;
      else if (!held.jump) {
        this.vy *= PLAYER.JUMP_CUT;
        this.jumping = false;
      }
    }

    // ---- gravity ----
    this.vy += PLAYER.GRAV * (this.inWater ? PLAYER.WATER_GRAV : 1) * gdir * dt;
    const maxFall = this.inWater ? 170 : PLAYER.MAX_FALL;
    if (gdir > 0) this.vy = Math.min(this.vy, maxFall);
    else this.vy = Math.max(this.vy, -maxFall);
    if (wallDir && this.vy > PLAYER.WALL_SLIDE && h === wallDir) {
      this.vy = PLAYER.WALL_SLIDE; // pressing against a wall: slide down it slowly
      if (world.rand() < 0.25) spark(world, this.x + wallDir * (this.w / 2), this.y - 4, '#d8d0c0', 1, 20);
    }

    // ---- move ----
    const wasGrounded = this.grounded;
    const fallSpeed = Math.abs(this.vy);
    moveBody(world, this, dt);
    this.hitWall = this.hitWall || 0;
    if (this.grounded) {
      const below = gdir > 0 ? Math.floor((this.y + 0.5) / TILE) : Math.floor((this.y - this.h - 0.5) / TILE);
      this.groundTile = world.tile(Math.floor(this.x / TILE), below);
      this.jumping = false;
    } else {
      this.groundTile = 0;
    }
    if (!wasGrounded && this.grounded) {
      world.sfx('land');
      if (fallSpeed > 140) dust(world, this.x, gdir > 0 ? this.y : this.y - this.h, Math.min(1, fallSpeed / 380), this.groundTile === T.ICE ? '#dff4ff' : '#b8a88a');
    }

    // world edges and camera
    const camX = world.camera.x;
    const minX = camX + this.w / 2 + 1;
    if (this.x < minX) this.x = minX;
    let maxX = world.cols * TILE - this.w / 2;
    if (world.camera.lockMax !== null) maxX = Math.min(maxX, world.camera.lockMax + VIEW_W - this.w / 2 - 1); // arena walls
    if (this.x > maxX) this.x = maxX;

    // animation
    if (this.grounded && Math.abs(this.vx) > 1) this.anim += dt * 11;
    else if (!this.grounded) this.anim += dt * 14;
    else this.anim = 0;
  }

  /** The hoverbike: free flight on the stick, kept inside the screen. The bike skims along the road but is never grounded. */
  updateFly(world, input, dt) {
    const held = input.held;
    this.invuln = Math.max(0, this.invuln - dt);
    this.barrier = Math.max(0, this.barrier - dt);
    this.stateT += dt;
    const hx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const hy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (hx !== 0) this.face = hx;
    let ax = this.face;
    let ay = 0;
    if (hy !== 0) {
      ay = hy;
      ax = hx ? this.face : 0;
    }
    this.aimX = ax;
    this.aimY = ay;
    this.prone = false;
    this.inWater = false;
    this.inQuick = false;
    const n = hx && hy ? Math.SQRT1_2 : 1;
    const k = Math.min(1, BIKE.ACCEL * dt);
    this.vx += (hx * BIKE.SPEED * n - this.vx) * k;
    this.vy += (hy * BIKE.SPEED * n - this.vy) * k;
    moveBody(world, this, dt);
    this.grounded = false;
    this.platform = null;
    // the bike cannot leave the screen: the camera pushes it on from the left, the stick holds it back from the right
    const cam = world.camera;
    const hw = this.w / 2;
    if (this.x < cam.x + hw + 1) {
      this.x = cam.x + hw + 1;
      // squeezed against a wall by the scrolling screen: that is a crash
      if (rectSolid(world, this.x - hw, this.y - this.h, this.x + hw, this.y - 1)) world.hurtPlayer('crush');
    }
    if (this.x > cam.x + VIEW_W - hw - 1) this.x = cam.x + VIEW_W - hw - 1;
    if (this.y - this.h < cam.y + 2) {
      this.y = cam.y + 2 + this.h;
      if (this.vy < 0) this.vy = 0;
    }
    if (this.y > cam.y + VIEW_H - 2) this.y = cam.y + VIEW_H - 2;
    this.groundTile = 0;
    this.anim += dt * 14;
  }
}
