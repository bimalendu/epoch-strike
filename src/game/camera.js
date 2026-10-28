// Side-scrolling camera: only moves forward (like Contra), supports arena locks, auto-scroll
// sections and vertical follow for tall levels.

import { TILE, VIEW_W, VIEW_H } from './constants.js';

export class Camera {
  constructor(world) {
    this.world = world;
    this.x = 0;
    this.y = 0;
    this.minX = 0;
    this.maxX = Math.max(0, world.cols * TILE - VIEW_W);
    this.maxY = Math.max(0, world.rows * TILE - VIEW_H);
    this.tall = world.rows * TILE > VIEW_H + 40;
    this.lockMin = null; // arena lock: camera x must stay inside [lockMin, lockMax]
    this.lockMax = null;
    this.shakeT = 0;
    this.shakeMag = 0;
    this.ox = 0; // render offset from shake
    this.oy = 0;
  }

  snap(p) {
    this.x = Math.min(this.maxX, Math.max(0, p.x - VIEW_W * 0.42));
    this.y = this.tall ? Math.min(this.maxY, Math.max(0, p.y - VIEW_H * 0.58)) : 0;
  }

  update(world, p, dt) {
    if (world.autoscroll && world.autoscroll.active) {
      // forced scroll: at least `speed`, faster if the player runs ahead
      const target = p.x - VIEW_W * 0.42;
      this.x = Math.max(this.x + world.autoscroll.speed * dt, target > this.x ? this.x + (target - this.x) * Math.min(1, 10 * dt) : this.x);
    } else {
      const target = p.x - VIEW_W * 0.42;
      if (target > this.x) this.x += (target - this.x) * Math.min(1, 10 * dt);
    }
    let lo = this.minX;
    let hi = this.maxX;
    if (this.lockMin !== null) lo = Math.max(lo, this.lockMin);
    if (this.lockMax !== null) hi = Math.min(hi, this.lockMax);
    if (hi < lo) hi = lo;
    this.x = Math.min(hi, Math.max(lo, this.x));

    if (this.tall) {
      const target = p.y - VIEW_H * 0.58;
      this.y += (target - this.y) * Math.min(1, 6 * dt);
      this.y = Math.min(this.maxY, Math.max(0, this.y));
    } else {
      this.y = 0;
    }

    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * Math.min(1, this.shakeT * 4);
      this.ox = Math.round((Math.random() * 2 - 1) * m);
      this.oy = Math.round((Math.random() * 2 - 1) * m);
    } else {
      this.ox = this.oy = 0;
    }
  }

  shake(mag = 3, time = 0.25) {
    if (this.world && this.world.shakeEnabled === false) return;
    if (this.world && this.world.flashesReduced) mag *= 0.5;
    this.shakeMag = Math.max(this.shakeMag * (this.shakeT > 0 ? 1 : 0), mag);
    this.shakeT = Math.max(this.shakeT, time);
  }

  /** Integer render origin. */
  get rx() {
    return Math.round(this.x) + this.ox;
  }
  get ry() {
    return Math.round(this.y) + this.oy;
  }
}
