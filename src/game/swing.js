// Rope swings (level 12): a plank hung on ropes from a high anchor swings like a pendulum between two ledges. It is a
// moving one-way platform (physics.js lands bodies on world.platforms); the world carries whoever stands on it.
//
//   { ax, ay, len, theta, period, phase, w }   anchor point, rope length (px), peak angle (rad), seconds per swing, plank width (px)

const PLANK_H = 5;

export function makeSwing(s, index = 0) {
  const pl = {
    kind: 'swing',
    i: index,
    ax: s.ax,
    ay: s.ay,
    len: s.len,
    theta: s.theta,
    omega: (Math.PI * 2) / s.period,
    phase: s.phase || 0,
    w: s.w,
    h: PLANK_H,
    t: 0,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
  };
  place(pl);
  pl.prevX = pl.x;
  pl.prevY = pl.y;
  return pl;
}

/** Plank position at the swing's own clock. */
function place(pl) {
  const th = pl.theta * Math.sin(pl.omega * pl.t + pl.phase);
  pl.x = pl.ax + pl.len * Math.sin(th) - pl.w / 2;
  pl.y = pl.ay + pl.len * Math.cos(th);
}

/** Advance a swing by dt. Returns the plank's movement { dx, dy } so riders can be carried. */
export function stepSwing(pl, dt) {
  const ox = pl.x;
  const oy = pl.y;
  pl.t += dt;
  place(pl);
  const dx = pl.x - ox;
  const dy = pl.y - oy;
  pl.vx = dx / dt;
  pl.vy = dy / dt;
  return { dx, dy };
}
