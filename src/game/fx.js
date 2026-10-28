// Visual effects: particles, explosions, floating text, the dying player. Pure data; render.js draws them.
//
// Cosmetic randomness comes from `world.fxRand()`, a stream of its own, so particles can never change what the
// simulation does (and the effects-quality option cannot either). `pushPx` enforces the particle budget of the current
// quality: 'high' allows 700 live particles, 'low' halves every burst and allows 160.

export const FX_QUALITY = {
  high: { cap: 700, scale: 1, juice: true },
  low: { cap: 160, scale: 0.5, juice: false },
};

function quality(world) {
  return FX_QUALITY[world.fxQuality] || FX_QUALITY.high;
}

/** A particle, if the budget allows. */
export function pushPx(world, f) {
  if (world.fxCount >= quality(world).cap) return false;
  world.fx.push(f);
  world.fxCount++;
  return true;
}

/** How many particles a burst of `n` really makes at the current quality (at least one). */
export function burst(world, n) {
  return Math.max(1, Math.round(n * quality(world).scale));
}

export function spark(world, x, y, color = '#ffe27a', n = 4, speed = 70) {
  const r = world.fxRand;
  for (let i = 0, m = burst(world, n); i < m; i++) {
    const a = r() * Math.PI * 2;
    const s = speed * (0.4 + r() * 0.8);
    pushPx(world, { k: 'px', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, g: 200, life: 0.2 + r() * 0.2, max: 0.4, col: color, s: 1 });
  }
}

export function debris(world, x, y, colors, n = 8, speed = 120) {
  const r = world.fxRand;
  for (let i = 0, m = burst(world, n); i < m; i++) {
    const a = -Math.PI * r();
    const s = speed * (0.3 + r() * 0.8);
    pushPx(world, {
      k: 'px', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 420,
      life: 0.5 + r() * 0.4, max: 0.9, col: colors[Math.floor(r() * colors.length)], s: r() < 0.4 ? 2 : 1,
    });
  }
}

/** size: 0 small, 1 medium, 2 large */
export function explosion(world, x, y, size = 0) {
  world.fx.push({ k: 'boom', x, y, t: 0, dur: [0.32, 0.45, 0.7][size] || 0.4, size });
  debris(world, x, y, ['#ffd23a', '#ff8a1e', '#e0381a', '#ffffff'], 4 + size * 6, 90 + size * 50);
}

/** A puff of grey smoke (a ninja appearing or vanishing). */
export function smoke(world, x, y, n = 8) {
  const r = world.fxRand;
  for (let i = 0, m = burst(world, n); i < m; i++) {
    const a = r() * Math.PI * 2;
    const sp = 30 + r() * 40;
    pushPx(world, { k: 'px', x: x + (r() - 0.5) * 8, y: y + (r() - 0.5) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 15, g: -10, life: 0.35 + r() * 0.25, max: 0.6, col: r() < 0.5 ? '#9a9ab0' : '#cfcfe0', s: 2 });
  }
}

/** Dust kicked up by a landing or a skid: `power` 0..1 scales the puff. High quality only. */
export function dust(world, x, y, power = 1, color = '#b8a88a') {
  if (!quality(world).juice) return;
  const r = world.fxRand;
  const n = 2 + Math.round(power * 4);
  for (let i = 0; i < n; i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    pushPx(world, { k: 'px', x: x + dir * (1 + r() * 3), y: y - 1, vx: dir * (18 + r() * 40 * (0.4 + power)), vy: -4 - r() * 14, g: 14, life: 0.22 + r() * 0.18, max: 0.4, col: color, s: r() < 0.5 ? 2 : 1 });
  }
}

/** An empty brass case spat out of the rifle (it falls behind the soldier). High quality only. */
export function casing(world, x, y, face) {
  if (!quality(world).juice) return;
  const r = world.fxRand;
  pushPx(world, { k: 'px', x, y, vx: -face * (22 + r() * 30), vy: -(50 + r() * 55), g: 520, life: 0.45, max: 0.45, col: '#e8c050', s: 1 });
}

export function popup(world, x, y, text, color = '#ffffff') {
  world.fx.push({ k: 'text', x, y, vy: -22, life: 0.9, max: 0.9, text: String(text), col: color });
}

export function flash(world, x, y, color = '#ffffff') {
  world.fx.push({ k: 'flash', x, y, life: 0.05, max: 0.05, col: color });
}

/** The flash at the end of the barrel: `m` is the muzzle ({x, y, dx, dy}), `color` the weapon's colour. */
export function muzzle(world, m, color = '#fff7c2') {
  world.fx.push({ k: 'muzzle', x: m.x, y: m.y, dx: m.dx, dy: m.dy, life: 0.07, max: 0.07, col: color });
}

/** A column of light that narrows to nothing where the soldier is put back after a death. */
export function beamIn(world, x, y) {
  world.fx.push({ k: 'beam', x, y, t: 0, dur: 0.45, life: 1 });
  ring(world, x, y - 14, '#bfeaff', 30, 0.4);
}

export function ring(world, x, y, color = '#ffffff', r1 = 36, dur = 0.35) {
  world.fx.push({ k: 'ring', x, y, t: 0, dur, r1, col: color });
}

/** The soldier tumbling off-screen when hit. */
export function corpse(world, p) {
  world.fx.push({ k: 'corpse', x: p.x, y: p.y - 14, vx: -p.face * 60, vy: -240, g: 700, t: 0, life: 2.5, face: p.face });
}

export function updateFx(world, dt) {
  const list = world.fx;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    switch (f.k) {
      case 'px':
        f.vy += (f.g || 0) * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.life -= dt;
        break;
      case 'boom':
      case 'beam':
      case 'ring':
        f.t += dt;
        f.life = f.t < f.dur ? 1 : 0;
        break;
      case 'warn':
        f.t += dt;
        f.life -= dt;
        break;
      case 'text':
        f.y += f.vy * dt;
        f.life -= dt;
        break;
      case 'flash':
      case 'muzzle':
      case 'zap':
        f.life -= dt;
        break;
      case 'corpse':
        f.vy += f.g * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.t += dt;
        f.life -= dt;
        break;
      default:
        f.life = 0;
    }
  }
  let w = 0;
  let px = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].life > 0) {
      if (list[i].k === 'px') px++;
      list[w++] = list[i];
    }
  }
  list.length = w;
  world.fxCount = px;
}
