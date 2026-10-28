// Small colour helpers and shared drawing pieces for procedural sprites.

export function shade(hex, amt) {
  // amt in [-1, 1]: negative darkens, positive lightens
  const n = parseInt(hex.slice(1, 7), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  r = f(r); g = f(g); b = f(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Mix two #rrggbb colours: t = 0 gives `a`, t = 1 gives `b`. */
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1, 7), 16);
  const pb = parseInt(b.slice(1, 7), 16);
  const ch = (shift) => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

/** Legs for a 4-frame run cycle on a 24x32 humanoid. frame: -1 idle, 0..3 run. */
export function drawLegs(p, frame, pants, boots) {
  const pd = shade(pants, -0.3);
  const leg = (x, y, w, h, boot) => {
    p.rect(x, y, w, h, pants);
    p.rect(x, y, 1, h, pd);
    if (boot) p.rect(boot.x, boot.y, boot.w, 3, boots);
  };
  switch (frame) {
    case 0:
      leg(13, 21, 3, 4); leg(15, 25, 3, 4, { x: 15, y: 29, w: 5 });
      leg(10, 21, 3, 4); leg(8, 25, 3, 4, { x: 6, y: 29, w: 5 });
      break;
    case 1:
      leg(10, 21, 3, 8, { x: 9, y: 29, w: 5 });
      leg(13, 21, 3, 4); leg(13, 25, 3, 3, { x: 12, y: 27, w: 5 });
      break;
    case 2:
      leg(10, 21, 3, 4); leg(12, 25, 3, 4, { x: 12, y: 29, w: 5 });
      leg(13, 21, 3, 4); leg(15, 25, 3, 4, { x: 14, y: 29, w: 5 });
      break;
    case 3:
      leg(14, 21, 3, 8, { x: 13, y: 29, w: 5 });
      leg(10, 21, 3, 4); leg(9, 25, 3, 3, { x: 8, y: 27, w: 5 });
      break;
    default:
      leg(10, 21, 3, 8, { x: 9, y: 29, w: 5 });
      leg(14, 21, 3, 8, { x: 13, y: 29, w: 5 });
  }
}
