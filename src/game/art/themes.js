// One theme per era: sky bands, parallax layers, tile palettes, liquids and ambient effects.
// Levels pick a theme by id (level.theme). Palettes stay dark-to-light inside each style so tiles read at a glance.

const earth = (base, dark, top, extra = {}) => ({ kind: 'earth', base, dark, top, ...extra });
const stone = (base, dark, extra = {}) => ({ kind: 'stone', base, dark, ...extra });
const rock = (base, dark, extra = {}) => ({ kind: 'rock', base, dark, ...extra });
const sand = (base, dark, extra = {}) => ({ kind: 'sand', base, dark, ...extra });
const metal = (base, dark, extra = {}) => ({ kind: 'metal', base, dark, ...extra });
const wood = (base, dark, extra = {}) => ({ kind: 'wood', base, dark, ...extra });
const neon = (base, dark, glow, extra = {}) => ({ kind: 'neon', base, dark, glow, ...extra });

const WATER = { base: '#2f78b8', top: '#6ab4e8', deep: '#1f5088' };
const LAVA = { base: '#e0501a', top: '#ffd23a', deep: '#a02a10' };

export const THEMES = {
  // ---- Prehistoric ----
  jungle: {
    sky: ['#5fb8e8', '#86ccee', '#b4e0ee', '#d4efd8'],
    layers: [
      { k: 'clouds', c: '#ffffff', y: 20, a: 60, s: 0.03, n: 5, seed: 3, alpha: 0.8 },
      { k: 'mountains', c: '#7aa8b4', y: 190, a: 110, s: 0.08, seed: 4, shade: true },
      { k: 'trees', c: '#4a9a5a', y: 200, a: 46, s: 0.22, seed: 5, n: 16 },
      { k: 'trees', c: '#2f7a3c', y: 216, a: 58, s: 0.5, seed: 6, n: 11, palm: true },
    ],
    tiles: { solid: earth('#6b4a2b', '#4a3220', '#4fae3a'), wall: stone('#7a7a6a', '#4a4a3e'), platform: { kind: 'wood', base: '#8a6a3a', dark: '#4a3220' }, spike: '#d8d0b0' },
    decor: [{ k: 'tuft', c: '#3a9a3a', p: 0.35 }, { k: 'flower', c: '#ffd23a', p: 0.06 }, { k: 'pebbles', c: '#8a7a6a', p: 0.08 }],
    water: WATER, lava: LAVA, fx: 'leaves',
  },
  volcano: {
    sky: ['#2a0e18', '#5a1a20', '#a03a1a', '#e0781e'],
    layers: [
      { k: 'stars', c: '#ffb070', y: 0, a: 80, s: 0.02, n: 40, seed: 8 },
      { k: 'volcano', c: '#2a1218', y: 200, a: 120, s: 0.06, glow: '#ff6a1a', smoke: '#3a2a30', at: 0.6, seed: 9 },
      { k: 'mountains', c: '#3a1a20', y: 215, a: 70, s: 0.15, seed: 10 },
      { k: 'hills', c: '#2a1218', y: 235, a: 40, s: 0.4, seed: 11 },
    ],
    tiles: { solid: rock('#4a2a2a', '#2a1418', { top: '#7a4034', vein: '#ff6a1a' }), wall: rock('#3a2222', '#22100e'), platform: { kind: 'stone', base: '#6a4034', dark: '#2a1418' }, spike: '#d8a070' },
    decor: [{ k: 'pebbles', c: '#6a3a30', p: 0.12 }, { k: 'crystal', c: '#ff7a2a', p: 0.05 }],
    water: WATER, lava: LAVA, fx: 'embers',
  },
  glacier: {
    sky: ['#9acfee', '#bfe0f4', '#dff0fa', '#f0f8fc'],
    layers: [
      { k: 'clouds', c: '#ffffff', y: 18, a: 50, s: 0.03, n: 4, seed: 12, alpha: 0.7 },
      { k: 'mountains', c: '#9cc4de', y: 185, a: 120, s: 0.08, cap: '#ffffff', seed: 13, shade: true },
      { k: 'pines', c: '#5a8aa8', y: 205, a: 50, s: 0.25, seed: 14, snow: '#e8f6ff' },
      { k: 'pines', c: '#3a6a88', y: 222, a: 60, s: 0.5, seed: 15, snow: '#e8f6ff', n: 10 },
    ],
    tiles: { solid: earth('#6a9cbc', '#44708c', '#f4fbff', { topDark: '#b4dcf0' }), wall: stone('#8ab4cc', '#4a7c98'), platform: { kind: 'ice', base: '#a8dcf2', dark: '#6aa8c8' }, spike: '#d8f4ff' },
    decor: [{ k: 'snowpile', c: '#ffffff', p: 0.2 }, { k: 'crystal', c: '#9ae0ff', p: 0.05 }],
    water: { base: '#3a7aa8', top: '#a8e0f8', deep: '#2a5a88' }, lava: LAVA, fx: 'snow',
  },
  cave: {
    sky: ['#06060e', '#0a0a18', '#12101e'],
    layers: [
      { k: 'cave', c: '#14122a', y: 0, a: 80, s: 0.1, seed: 16, cells: 6 },
      { k: 'cave', c: '#1c1834', y: 0, a: 56, s: 0.3, seed: 17, cells: 9 },
    ],
    tiles: { solid: rock('#4a4658', '#2a2634', { top: '#625c74' }), wall: rock('#3a3648', '#1e1a28'), platform: { kind: 'stone', base: '#5a566a', dark: '#2a2634' }, spike: '#b8b0c8' },
    decor: [{ k: 'crystal', c: '#6ac8ff', p: 0.06 }, { k: 'bones', c: '#d8d0b8', p: 0.07 }, { k: 'pebbles', c: '#5a566a', p: 0.12 }],
    water: { base: '#1f4a78', top: '#4a8ac8', deep: '#10284a' }, lava: LAVA, dark: true, fx: 'dust',
  },

  // ---- Ancient ----
  pyramid: {
    sky: ['#f2a85a', '#f6c47c', '#fad89a', '#fce8be'],
    layers: [
      { k: 'stars', c: '#fff0c0', y: 0, a: 40, s: 0.01, n: 20, seed: 18 },
      { k: 'pyramids', c: '#d8a860', y: 205, a: 90, s: 0.08, seed: 19, n: 3 },
      { k: 'dunes', c: '#e0b468', y: 225, a: 30, s: 0.3, seed: 20, cells: 3 },
      { k: 'dunes', c: '#c89448', y: 240, a: 22, s: 0.55, seed: 21, cells: 4 },
    ],
    tiles: { solid: sand('#d8b668', '#a8844a'), wall: stone('#c8a468', '#7a5a30', { top: '#e0c080' }), platform: { kind: 'stone', base: '#c8a468', dark: '#7a5a30' }, spike: '#e8e0c0', quick: '#c8a050' },
    decor: [{ k: 'pebbles', c: '#a8844a', p: 0.1 }, { k: 'bones', c: '#f0e8c8', p: 0.05 }],
    water: WATER, lava: LAVA, fx: 'dust',
  },
  troy: {
    sky: ['#6aa8e4', '#96c4ee', '#c0dcf4', '#e8f0f4'],
    layers: [
      { k: 'clouds', c: '#ffffff', y: 22, a: 60, s: 0.03, n: 5, seed: 22 },
      { k: 'hills', c: '#8aa88a', y: 190, a: 70, s: 0.08, seed: 23 },
      { k: 'castle', c: '#c8c0b0', y: 215, a: 60, s: 0.2, seed: 24, n: 4 },
      { k: 'pillars', c: '#e8e0d0', y: 190, a: 30, s: 0.5, n: 6, w: 10, seed: 25 },
    ],
    tiles: { solid: stone('#d0c8b8', '#8a8070', { top: '#ece6d8' }), wall: stone('#bdb4a2', '#7a7060'), platform: { kind: 'stone', base: '#e0d8c8', dark: '#8a8070' }, spike: '#c0c0c8' },
    decor: [{ k: 'tuft', c: '#6a9a5a', p: 0.12 }, { k: 'pebbles', c: '#a89c88', p: 0.1 }],
    water: WATER, lava: LAVA,
  },
  colosseum: {
    sky: ['#5a9ee0', '#8cc0ec', '#d8dcc8', '#f0d8a8'],
    layers: [
      { k: 'clouds', c: '#ffffff', y: 20, a: 40, s: 0.03, n: 4, seed: 26, alpha: 0.7 },
      { k: 'arena', c: '#9a7448', y: 150, a: 40, s: 0.12, seed: 27, c2: '#d8b078' },
      { k: 'pillars', c: '#cfbf9c', y: 175, a: 40, s: 0.35, n: 8, w: 12, seed: 28, lintel: true },
    ],
    tiles: { solid: sand('#dcc488', '#a08850'), wall: stone('#c0a878', '#7a6038'), platform: { kind: 'stone', base: '#d0b888', dark: '#7a6038' }, spike: '#d8d8e0' },
    decor: [{ k: 'pebbles', c: '#a08850', p: 0.1 }],
    water: WATER, lava: LAVA, fx: 'dust',
  },
  greatwall: {
    sky: ['#c4d4e4', '#d8e4ee', '#ecf0f4'],
    layers: [
      { k: 'mountains', c: '#8ea0b4', y: 170, a: 130, s: 0.06, seed: 29, shade: true },
      { k: 'mist', c: '#ffffff', y: 140, a: 40, s: 0.1, alpha: 0.35 },
      { k: 'pagodas', c: '#6a6a7a', y: 215, a: 70, s: 0.22, seed: 30, n: 3 },
      { k: 'mountains', c: '#5a6a7e', y: 235, a: 60, s: 0.45, seed: 31 },
    ],
    tiles: { solid: stone('#8e8678', '#5a5448', { top: '#aaa294' }), wall: stone('#756e62', '#4a443a'), platform: { kind: 'wood', base: '#8a5a38', dark: '#4a2e1a' }, spike: '#b0b0b8' },
    decor: [{ k: 'tuft', c: '#6a8a5a', p: 0.1 }, { k: 'pebbles', c: '#6a6458', p: 0.1 }],
    water: WATER, lava: LAVA, fx: 'leaves',
  },

  // ---- Medieval ----
  fjord: {
    sky: ['#7a98b8', '#a0b8cc', '#c4d4e0', '#dce6ec'],
    layers: [
      { k: 'mountains', c: '#4a6a88', y: 160, a: 110, s: 0.06, cap: '#e8f0f8', seed: 32, shade: true },
      { k: 'mist', c: '#ffffff', y: 150, a: 30, s: 0.1, alpha: 0.3 },
      { k: 'pines', c: '#2a4a5a', y: 190, a: 40, s: 0.2, seed: 33 },
      { k: 'waves', c: '#3a6a90', y: 215, a: 40, s: 0.4, seed: 34 },
    ],
    tiles: { solid: wood('#8a5a30', '#4a2e18'), wall: wood('#6a4424', '#3a2210'), platform: { kind: 'wood', base: '#9a6a38', dark: '#4a2e18' }, spike: '#c8c8d0' },
    decor: [{ k: 'pebbles', c: '#6a4424', p: 0.05 }],
    water: { base: '#2a5a88', top: '#6a9cc8', deep: '#1a3a5a' }, lava: LAVA, fx: 'rain',
  },
  castle: {
    sky: ['#7a86a6', '#a0a8bc', '#c4c4d0'],
    layers: [
      { k: 'clouds', c: '#d0d4e0', y: 20, a: 60, s: 0.04, n: 6, seed: 35, alpha: 0.7 },
      { k: 'hills', c: '#5a6a58', y: 195, a: 60, s: 0.08, seed: 36 },
      { k: 'castle', c: '#585a70', y: 225, a: 80, s: 0.25, seed: 37, n: 5, roof: '#3a3a56' },
    ],
    tiles: { solid: stone('#7c7c8a', '#4a4a58', { top: '#9a9aa8' }), wall: stone('#666674', '#3e3e4c'), platform: { kind: 'wood', base: '#7a5230', dark: '#3a2412' }, spike: '#c8c8d4' },
    decor: [{ k: 'tuft', c: '#5a7a4a', p: 0.1 }, { k: 'pebbles', c: '#6a6a78', p: 0.1 }],
    water: WATER, lava: LAVA, fx: 'rain',
  },
  shadowcastle: {
    sky: ['#0a0a1e', '#181030', '#2c1a44', '#46224e'],
    layers: [
      { k: 'stars', c: '#a8a0d0', y: 0, a: 120, s: 0.02, n: 70, seed: 38 },
      { k: 'pagodas', c: '#1a1428', y: 215, a: 70, s: 0.12, seed: 39, n: 3 },
      { k: 'pines', c: '#120e20', y: 220, a: 60, s: 0.3, seed: 40, n: 12 },
    ],
    tiles: { solid: stone('#3c3650', '#1e1a2c', { top: '#5a5274' }), wall: stone('#2e2a40', '#16121e'), platform: { kind: 'wood', base: '#4a3228', dark: '#22160e' }, spike: '#a8a8c8' },
    decor: [{ k: 'crystal', c: '#c8a0ff', p: 0.04 }, { k: 'pebbles', c: '#4a4460', p: 0.1 }],
    water: { base: '#1a2a58', top: '#3a5aa0', deep: '#0e1838' }, lava: LAVA, dark: false, fx: 'petals',
  },
  pirate: {
    sky: ['#f07a4a', '#f4a060', '#f8c680', '#fce4b0'],
    layers: [
      { k: 'clouds', c: '#ffd0a0', y: 30, a: 60, s: 0.03, n: 5, seed: 41, alpha: 0.8 },
      { k: 'ships', c: '#7a4a4a', y: 200, a: 70, s: 0.12, seed: 42, n: 4 },
      { k: 'waves', c: '#b25a52', y: 212, a: 60, s: 0.3, seed: 43 },
    ],
    tiles: { solid: wood('#7a4a28', '#3a2010'), wall: wood('#5a3418', '#2a1608'), platform: { kind: 'wood', base: '#8a5a30', dark: '#3a2010' }, spike: '#c8c0b0' },
    decor: [{ k: 'pebbles', c: '#5a3418', p: 0.05 }],
    water: { base: '#2a5a88', top: '#6a9cc8', deep: '#1a3a5a' }, lava: LAVA,
  },

  // ---- Industrial and War ----
  train: {
    sky: ['#e8a45e', '#f0c080', '#f6d8a4', '#fae8c4'],
    layers: [
      { k: 'mountains', c: '#c8884a', y: 180, a: 70, s: 0.06, seed: 44 },
      { k: 'dunes', c: '#d09a58', y: 215, a: 28, s: 0.2, seed: 45, cells: 3 },
      { k: 'dunes', c: '#b07840', y: 235, a: 20, s: 0.45, seed: 46, cells: 4 },
    ],
    tiles: { solid: metal('#6a4a3a', '#3a2418', { stripe: '#a8602a' }), wall: metal('#58402e', '#2e1c10'), platform: { kind: 'metal', base: '#7a5a42', dark: '#3a2418' }, spike: '#c8c0b0' },
    decor: [{ k: 'pebbles', c: '#8a6a50', p: 0.05 }],
    water: WATER, lava: LAVA, fx: 'dust',
  },
  factory: {
    sky: ['#3a2e28', '#54443a', '#745c4a', '#8a6e56'],
    layers: [
      { k: 'chimneys', c: '#2a2420', y: 190, a: 90, s: 0.1, seed: 47, smoke: '#5a4a40', n: 6 },
      { k: 'chimneys', c: '#1e1a18', y: 225, a: 60, s: 0.3, seed: 48, n: 5 },
    ],
    tiles: { solid: metal('#6a5a4a', '#352c22', { stripe: '#b8862a' }), wall: metal('#554638', '#2a2018'), platform: { kind: 'metal', base: '#7a6a58', dark: '#352c22' }, spike: '#c8b8a0' },
    decor: [{ k: 'pebbles', c: '#4a4038', p: 0.08 }],
    water: { base: '#3a6a58', top: '#7ab4a0', deep: '#1f3a30' }, lava: LAVA, fx: 'embers',
  },
  trench: {
    sky: ['#6a6a5e', '#86867a', '#a0a090', '#b8b8a8'],
    layers: [
      { k: 'mist', c: '#d8d8c8', y: 120, a: 70, s: 0.05, alpha: 0.3 },
      { k: 'hills', c: '#5a5a4a', y: 195, a: 50, s: 0.1, seed: 49 },
      { k: 'hills', c: '#46463a', y: 225, a: 36, s: 0.3, seed: 50 },
    ],
    tiles: { solid: earth('#5a4a32', '#352a1c', '#6a5a38'), wall: wood('#5a4630', '#2e2214'), platform: { kind: 'wood', base: '#6a5232', dark: '#2e2214' }, spike: '#a8a898' },
    decor: [{ k: 'pebbles', c: '#4a3e2a', p: 0.15 }, { k: 'tuft', c: '#6a7a3a', p: 0.08 }],
    water: { base: '#4a5a3a', top: '#7a8a5a', deep: '#2a3420' }, lava: LAVA, fx: 'dust',
  },
  beach: {
    sky: ['#6eb4e0', '#98cce8', '#c4e0ee', '#e8f0ec'],
    layers: [
      { k: 'clouds', c: '#ffffff', y: 22, a: 50, s: 0.03, n: 5, seed: 51 },
      { k: 'ships', c: '#6a7a8a', y: 175, a: 40, s: 0.06, seed: 52, n: 3 },
      { k: 'waves', c: '#3a78a8', y: 180, a: 100, s: 0.15, seed: 53 },
      { k: 'dunes', c: '#e0c88e', y: 232, a: 18, s: 0.4, seed: 54, cells: 3 },
    ],
    tiles: { solid: sand('#dcc690', '#a88c58'), wall: metal('#8a8a7e', '#4a4a42'), platform: { kind: 'wood', base: '#8a6a40', dark: '#3a2a14' }, spike: '#9a9aa4' },
    decor: [{ k: 'pebbles', c: '#a88c58', p: 0.1 }, { k: 'tuft', c: '#8aa05a', p: 0.06 }],
    water: { base: '#2f78b8', top: '#8ac8f0', deep: '#1f5088' }, lava: LAVA,
  },

  // ---- Modern and Future ----
  arctic: {
    sky: ['#0a1a34', '#16304e', '#2e5274', '#5a86a4'],
    layers: [
      { k: 'stars', c: '#d8f0ff', y: 0, a: 140, s: 0.02, n: 70, seed: 55 },
      { k: 'mountains', c: '#244a6a', y: 190, a: 110, s: 0.07, cap: '#d8eefc', seed: 56, shade: true },
      { k: 'pines', c: '#10283e', y: 222, a: 56, s: 0.4, seed: 57, snow: '#a8c8e0' },
    ],
    tiles: { solid: metal('#3a4a5e', '#1c2636', { top: '#e8f4ff', stripe: '#5aa8d8' }), wall: metal('#2a3646', '#141c28'), platform: { kind: 'metal', base: '#4a5a70', dark: '#1c2636' }, spike: '#d0e8f8' },
    decor: [{ k: 'snowpile', c: '#ffffff', p: 0.15 }],
    water: { base: '#1f4a78', top: '#5a9ad0', deep: '#102a48' }, lava: LAVA, fx: 'snow',
  },
  neon: {
    sky: ['#10082a', '#2a0a4a', '#5a1a6a', '#b0307a'],
    layers: [
      { k: 'stars', c: '#ff9ad8', y: 0, a: 100, s: 0.01, n: 40, seed: 58 },
      { k: 'city', c: '#1a0a30', y: 190, a: 120, s: 0.1, seed: 59, win: '#ff4aa8', win2: '#4af0ff', lit: 0.3 },
      { k: 'city', c: '#120822', y: 225, a: 90, s: 0.3, seed: 60, win: '#4af0ff', win2: '#ff4aa8', lit: 0.4 },
    ],
    tiles: { solid: neon('#241438', '#0e0818', '#ff4aa8'), wall: neon('#1a0e2c', '#0a0612', '#4af0ff'), platform: { kind: 'neon', base: '#34204a', glow: '#4af0ff' }, spike: '#ff7ad0' },
    decor: [{ k: 'crystal', c: '#ff4aa8', p: 0.03 }],
    water: { base: '#2a1a5a', top: '#ff4aa8', deep: '#120a30' }, lava: LAVA, fx: 'rain',
  },
  megacity: {
    sky: ['#04081a', '#081a38', '#0a3458', '#1a6a8a'],
    layers: [
      { k: 'stars', c: '#9ae0ff', y: 0, a: 120, s: 0.01, n: 60, seed: 61 },
      { k: 'city', c: '#06142a', y: 185, a: 130, s: 0.1, seed: 62, win: '#4af0ff', win2: '#a8ffea', lit: 0.35 },
      { k: 'city', c: '#040d1e', y: 225, a: 90, s: 0.32, seed: 63, win: '#2ad8ff', win2: '#ffffff', lit: 0.45 },
    ],
    tiles: { solid: neon('#0e2038', '#050c18', '#4af0ff'), wall: neon('#0a1828', '#040810', '#2a8aff'), platform: { kind: 'neon', base: '#16304c', glow: '#a8ffea' }, spike: '#ff5a7a' },
    decor: [{ k: 'crystal', c: '#4af0ff', p: 0.03 }],
    water: { base: '#0a3a6a', top: '#4af0ff', deep: '#04182e' }, lava: LAVA, fx: 'dust',
  },
  citadel: {
    sky: ['#08001a', '#240a3a', '#4a0a56', '#7a1a6a'],
    layers: [
      { k: 'stars', c: '#e0a0ff', y: 0, a: 160, s: 0.01, n: 90, seed: 64 },
      { k: 'castle', c: '#1e0a30', y: 210, a: 120, s: 0.1, seed: 65, n: 5, roof: '#2e0e48', window: '#ff4aa8' },
      { k: 'mountains', c: '#14061f', y: 240, a: 70, s: 0.35, seed: 66 },
    ],
    tiles: { solid: stone('#4a2a68', '#1e0e30', { top: '#a060e0' }), wall: stone('#341a4c', '#160a22'), platform: { kind: 'stone', base: '#5a3a7a', dark: '#1e0e30' }, spike: '#ff4aa8' },
    decor: [{ k: 'crystal', c: '#ff4aa8', p: 0.06 }, { k: 'pebbles', c: '#3a2250', p: 0.1 }],
    water: { base: '#3a1a6a', top: '#ff4aa8', deep: '#1a0a38' }, lava: LAVA, fx: 'embers',
  },
};

export function getTheme(id) {
  const t = THEMES[id] || THEMES.jungle;
  if (!t.id) t.id = THEMES[id] ? id : 'jungle';
  return t;
}
