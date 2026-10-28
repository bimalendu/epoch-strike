// Painters for the trench line (level 15): the biplane. Sprites face right; drawEnemy mirrors them when the flyer turns.

import { Painter } from '../../engine/gfx.js';
import { shade } from './common.js';

function biplaneFrame(def, frame, hot = false) {
  const pal = def.pal;
  const p = new Painter(46, 28);
  const B = hot ? '#ffffff' : pal.body;
  const W = hot ? '#fff0d8' : pal.wing;
  const R = pal.accent;
  // tail: fin and tailplane
  p.rect(4, 8, 3, 8, shade(B, -0.1));
  p.rect(2, 14, 10, 2, shade(W, -0.1));
  // wheels and struts
  p.ellipse(22, 24, 3, 3, '#1a1a1e');
  p.px(22, 24, '#8a8a96');
  p.rect(21, 17, 2, 7, '#3a3a40');
  // fuselage
  p.ellipse(23, 15, 14, 3, B);
  p.rect(10, 13, 26, 5, B);
  p.rect(10, 17, 26, 1, shade(B, -0.3));
  p.rect(12, 13, 22, 1, shade(B, 0.3));
  // engine cowling and propeller (a blur that alternates)
  p.rect(35, 12, 4, 7, shade(B, -0.25));
  p.rect(39, frame % 2 ? 7 : 10, 2, frame % 2 ? 17 : 11, hot ? '#ffffff' : '#d8d8e0');
  // lower wing, struts, upper wing
  p.rect(12, 20, 24, 2, W);
  p.rect(12, 21, 24, 1, shade(W, -0.25));
  p.rect(17, 8, 1, 12, '#3a3a40');
  p.rect(31, 8, 1, 12, '#3a3a40');
  p.rect(10, 6, 28, 3, W);
  p.rect(10, 8, 28, 1, shade(W, -0.25));
  // roundels on the wing, the pilot's head, goggles and a trailing scarf
  p.rect(14, 6, 3, 3, R);
  p.rect(15, 7, 1, 1, '#ffffff');
  p.ellipse(26, 11, 2, 2, '#d8a070');
  p.rect(25, 10, 3, 1, '#15151a');
  p.rect(22 - (frame % 2), 12, 3, 1, '#e8e8ee');
  // a machine gun on the upper wing
  p.rect(30, 4, 6, 1, '#2a2a32');
  return p.canvas;
}

function biplane(def) {
  const run = [0, 1, 2, 3].map((i) => biplaneFrame(def, i));
  return { idle: run[0], run, hot: biplaneFrame(def, 0, true), w: 46, h: 28, ox: 23 };
}

export function registerWar(painters) {
  painters.biplane = biplane;
}
