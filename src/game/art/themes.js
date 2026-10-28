// One theme per era: sky bands, parallax layers, tile palettes, liquids and ambient effects.
// Levels pick a theme by id (level.theme). Palettes stay dark-to-light inside each style so tiles read at a glance.

const earth = (base, dark, top, extra = {}) => ({ kind: 'earth', base, dark, top, ...extra });
const stone = (base, dark, extra = {}) => ({ kind: 'stone', base, dark, ...extra });
const rock = (base, dark, extra = {}) => ({ kind: 'rock', base, dark, ...extra });
const sand = (base, dark, extra = {}) => ({ kind: 'sand', base, dark, ...extra });
const metal = (base, dark, extra = {}) => ({ kind: 'metal', base, dark, ...extra });
const wood = (base, dark, extra = {}) => ({ kind: 'wood', base, dark, ...extra });
const neon = (base, dark, glow, extra = {}) => ({ kind: 'neon', base, dark, glow, ...extra });

/** Ground cover and hanging growth: `fringe` rises from the top of the ground, `under` hangs from an overhang (see relief.js). */
const grass = (c) => ({ shape: 'grass', c });
const snowcap = (c = '#ffffff') => ({ shape: 'snow', c });
const dunes = (c) => ({ shape: 'sand', c });
const moss = (c) => ({ shape: 'moss', c });
const rubble = (c) => ({ shape: 'rubble', c });
const weeds = (c) => ({ shape: 'weed', c });
const roots = (c) => ({ shape: 'roots', c });
const icicles = (c = '#d8f4ff') => ({ shape: 'icicle', c });
const stalactites = (c) => ({ shape: 'stalactite', c });
const drips = (c) => ({ shape: 'drip', c });
const vines = (c) => ({ shape: 'vine', c });

const WATER = { base: '#2f78b8', top: '#6ab4e8', deep: '#1f5088' };
const LAVA = { base: '#e0501a', top: '#ffd23a', deep: '#a02a10' };

export const THEMES = {
  // ---- Prehistoric ----
  jungle: {
    sky: ['#5fb8e8', '#86ccee', '#b4e0ee', '#d4efd8'],
    layers: [
      { k: 'celestial', c: '#fff4c0', core: '#ffffff', halo: '#fff0b0', y: 50, r: 11, at: 0.74, s: 0.01 },
      { k: 'cumulus', c: '#ffffff', y: 22, a: 50, s: 0.03, n: 4, seed: 3, w: 60 },
      { k: 'ridges', c: '#7aa8b4', y: 180, a: 100, s: 0.07, seed: 4, cells: 3, trees: '#5a8a78', treeline: 0.2 },
      { k: 'waterfall', c: '#e0f4fa', rock: '#5a7a68', moss: '#3a6a48', y: 206, a: 78, s: 0.14, seed: 9, at: 0.32, fw: 10, cliff: 64 },
      { k: 'forest', c: '#4a9a5a', y: 210, a: 58, s: 0.25, seed: 5, n: 16, species: [['palm', 1], ['cycad', 2], ['oak', 2], ['bush', 1]], trunk: '#2c5a38' },
      { k: 'forest', c: '#2f7a3c', y: 224, a: 72, s: 0.5, seed: 6, n: 9, species: [['cycad', 3], ['palm', 2], ['bush', 2]], trunk: '#1f4a2a', under: 1 },
    ],
    tiles: { solid: earth('#6b4a2b', '#4a3220', '#4fae3a', { sub: '#5a3c22', deep: '#3e2a1a', fringe: grass('#4fae3a'), under: roots('#3a2412') }), wall: stone('#7a7a6a', '#4a4a3e'), platform: { kind: 'wood', base: '#8a6a3a', dark: '#4a3220' }, spike: '#d8d0b0' },
    decor: [{ k: 'tuft', c: '#3a9a3a', p: 0.22 }, { k: 'fern', c: '#2f8a3a', p: 0.14 }, { k: 'flower', c: '#ffd23a', p: 0.05 }, { k: 'mushroom', c: '#d84a3a', p: 0.04 }, { k: 'reeds', c: '#5a9a3a', p: 0.04 }, { k: 'pebbles', c: '#8a7a6a', p: 0.07 }],
    life: ['birds', 'pterosaurs'], front: { kind: 'ferns', c: '#14401e' },
    water: WATER, lava: LAVA, fx: 'leaves',
  },
  volcano: {
    glow: true,
    sky: ['#2a0e18', '#5a1a20', '#a03a1a', '#e0781e'],
    layers: [
      { k: 'stars', c: '#ffb070', y: 0, a: 80, s: 0.02, n: 40, seed: 8 },
      { k: 'ridges', c: '#3a1a20', y: 205, a: 95, s: 0.05, seed: 10, cells: 3, shadow: 0.3 },
      { k: 'volcano', c: '#2a1218', y: 205, a: 125, s: 0.06, glow: '#ff6a1a', smoke: '#3a2a30', at: 0.6, seed: 9 },
      { k: 'fogbank', c: '#6a2a1a', y: 168, a: 44, s: 0.1, seed: 12, bands: 2 },
      { k: 'ridges', c: '#2a1218', y: 226, a: 56, s: 0.18, seed: 11, cells: 5, shadow: 0.25 },
      { k: 'spires', c: '#1c0e12', y: 242, a: 52, s: 0.42, seed: 13, n: 7 },
    ],
    tiles: { solid: rock('#4a2a2a', '#2a1418', { top: '#7a4034', vein: '#ff6a1a', sub: '#3a2022', deep: '#2a1418', fringe: rubble('#6a3a30') }), wall: rock('#3a2222', '#22100e'), platform: { kind: 'stone', base: '#6a4034', dark: '#2a1418' }, spike: '#d8a070' },
    decor: [{ k: 'pebbles', c: '#6a3a30', p: 0.12 }, { k: 'drygrass', c: '#8a5a30', p: 0.08 }, { k: 'crystal', c: '#ff7a2a', p: 0.05 }],
    life: ['pterosaurs'], front: { kind: 'rocks', c: '#160a0e' },
    water: WATER, lava: LAVA, fx: 'embers',
  },
  glacier: {
    sky: ['#9acfee', '#bfe0f4', '#dff0fa', '#f0f8fc'],
    layers: [
      { k: 'celestial', c: '#ffffff', halo: '#e8f6ff', y: 48, r: 9, at: 0.7, s: 0.01 },
      { k: 'cirrus', c: '#ffffff', y: 18, a: 50, s: 0.03, n: 6, seed: 12 },
      { k: 'ridges', c: '#9cc4de', y: 182, a: 122, s: 0.07, seed: 13, cells: 3, snow: '#ffffff', snowAt: 0.34 },
      { k: 'ridges', c: '#7aa8c8', y: 208, a: 74, s: 0.14, seed: 14, cells: 4, snow: '#f0faff', snowAt: 0.46, trees: '#4a7a98' },
      { k: 'fogbank', c: '#e8f6ff', y: 196, a: 34, s: 0.2, seed: 15, bands: 2 },
      { k: 'forest', c: '#3a6a88', y: 224, a: 56, s: 0.45, seed: 16, n: 12, species: [['conifer', 1]], trunk: '#244a64' },
    ],
    tiles: { solid: earth('#6a9cbc', '#44708c', '#f4fbff', { topDark: '#b4dcf0', sub: '#5a88a8', deep: '#3e6482', fringe: snowcap(), under: icicles() }), wall: stone('#8ab4cc', '#4a7c98'), platform: { kind: 'ice', base: '#a8dcf2', dark: '#6aa8c8' }, spike: '#d8f4ff' },
    decor: [{ k: 'snowpile', c: '#ffffff', p: 0.16 }, { k: 'shard', c: '#9ae0ff', p: 0.06 }, { k: 'crystal', c: '#9ae0ff', p: 0.03 }],
    weather: { fog: '#e8f6ff', fogY: 180 }, front: { kind: 'drifts', c: '#e8f6ff' },
    water: { base: '#3a7aa8', top: '#a8e0f8', deep: '#2a5a88' }, lava: LAVA, fx: 'snow',
  },
  cave: {
    glow: true, haze: 0,
    sky: ['#06060e', '#0a0a18', '#12101e'],
    layers: [
      { k: 'cave', c: '#14122a', y: 0, a: 80, s: 0.1, seed: 16, cells: 6 },
      { k: 'rays', c: '#6a8ab0', y: 10, a: 170, s: 0.08, seed: 20, n: 3, lean: 0.3 },
      { k: 'cave', c: '#1c1834', y: 0, a: 56, s: 0.3, seed: 17, cells: 9 },
      { k: 'fogbank', c: '#2a2a50', y: 196, a: 40, s: 0.2, seed: 21, bands: 2 },
    ],
    tiles: { solid: rock('#4a4658', '#2a2634', { top: '#625c74', sub: '#3c384a', deep: '#2c283a', fringe: moss('#3a5a4a'), under: stalactites('#625c74') }), wall: rock('#3a3648', '#1e1a28'), platform: { kind: 'stone', base: '#5a566a', dark: '#2a2634' }, spike: '#b8b0c8' },
    decor: [{ k: 'crystal', c: '#6ac8ff', p: 0.06 }, { k: 'bones', c: '#d8d0b8', p: 0.05 }, { k: 'mushroom', c: '#7ab8c8', p: 0.06 }, { k: 'pebbles', c: '#5a566a', p: 0.12 }],
    life: ['bats'], front: { kind: 'rocks', c: '#08080f' },
    water: { base: '#1f4a78', top: '#4a8ac8', deep: '#10284a' }, lava: LAVA, dark: true, fx: 'dust',
  },

  // ---- Ancient ----
  pyramid: {
    sky: ['#f2a85a', '#f6c47c', '#fad89a', '#fce8be'],
    layers: [
      { k: 'celestial', c: '#fff0c0', core: '#ffffff', halo: '#ffe0a0', y: 72, r: 14, at: 0.3, s: 0.01 },
      { k: 'cirrus', c: '#fff0d0', y: 20, a: 60, s: 0.02, n: 5, seed: 18 },
      { k: 'ridges', c: '#d8a860', y: 208, a: 64, s: 0.05, seed: 19, cells: 3, octaves: 2, shadow: 0.14 },
      { k: 'pyramids', c: '#d09a52', y: 216, a: 82, s: 0.1, seed: 22, n: 3 },
      { k: 'dunes', c: '#e0b468', y: 228, a: 30, s: 0.3, seed: 20, cells: 3 },
      { k: 'spires', c: '#b98a50', y: 240, a: 44, s: 0.42, seed: 23, n: 4, ground: '#c89448', hoodoo: true },
    ],
    tiles: { solid: sand('#d8b668', '#a8844a', { fringe: dunes('#e8cc88'), sub: '#c8a258', deep: '#a8844a' }), wall: stone('#c8a468', '#7a5a30', { top: '#e0c080' }), platform: { kind: 'stone', base: '#c8a468', dark: '#7a5a30' }, spike: '#e8e0c0', quick: '#c8a050' },
    decor: [{ k: 'pebbles', c: '#a8844a', p: 0.1 }, { k: 'cactus', c: '#5a8a4a', p: 0.05 }, { k: 'drygrass', c: '#b89a58', p: 0.1 }, { k: 'bones', c: '#f0e8c8', p: 0.04 }],
    life: ['birds'], front: { kind: 'grass', c: '#8a6a3a' },
    water: WATER, lava: LAVA, fx: 'dust',
  },
  troy: {
    sky: ['#6aa8e4', '#96c4ee', '#c0dcf4', '#e8f0f4'],
    layers: [
      { k: 'cumulus', c: '#ffffff', y: 22, a: 50, s: 0.03, n: 4, seed: 22, w: 60 },
      { k: 'ridges', c: '#8aa88a', y: 182, a: 64, s: 0.06, seed: 23, cells: 3, octaves: 2, trees: '#6a8a6a', treeline: 0.25 },
      { k: 'lake', c: '#3a78b8', y: 192, s: 0.1, seed: 24, glitter: '#e8f4ff', sunAt: 0.6 },
      { k: 'castle', c: '#c8c0b0', y: 216, a: 62, s: 0.2, seed: 24, n: 4 },
      { k: 'forest', c: '#5a7a4a', y: 226, a: 50, s: 0.38, seed: 26, n: 12, species: [['cypress', 3], ['bush', 2], ['oak', 1]], trunk: '#3a4a30' },
      { k: 'pillars', c: '#e8e0d0', y: 190, a: 30, s: 0.5, n: 6, w: 10, seed: 25 },
    ],
    tiles: { solid: earth('#a8885a', '#6e5232', '#7aa058', { sub: '#94764a', deep: '#6e5232', fringe: grass('#6a9a5a'), under: roots('#4a3420') }), wall: stone('#bdb4a2', '#7a7060'), platform: { kind: 'stone', base: '#e0d8c8', dark: '#8a8070' }, spike: '#c0c0c8' },
    decor: [{ k: 'tuft', c: '#6a9a5a', p: 0.12 }, { k: 'drygrass', c: '#a8a068', p: 0.1 }, { k: 'pebbles', c: '#a89c88', p: 0.1 }],
    life: ['birds', 'gulls'], front: { kind: 'grass', c: '#3a5a2a' },
    water: WATER, lava: LAVA,
  },
  colosseum: {
    sky: ['#5a9ee0', '#8cc0ec', '#d8dcc8', '#f0d8a8'],
    layers: [
      { k: 'cumulus', c: '#ffffff', y: 20, a: 40, s: 0.03, n: 3, seed: 26, w: 50 },
      { k: 'ridges', c: '#9aa87a', y: 178, a: 56, s: 0.06, seed: 29, cells: 3, octaves: 2, trees: '#7a8a5a' },
      { k: 'arena', c: '#9a7448', y: 150, a: 40, s: 0.12, seed: 27, c2: '#d8b078' },
      { k: 'forest', c: '#6a7a4a', y: 208, a: 54, s: 0.28, seed: 30, n: 11, species: [['cypress', 4], ['bush', 1]], trunk: '#3a4228' },
      { k: 'pillars', c: '#cfbf9c', y: 175, a: 40, s: 0.35, n: 8, w: 12, seed: 28, lintel: true },
    ],
    tiles: { solid: sand('#dcc488', '#a08850', { fringe: dunes('#ecd49c'), sub: '#ccb078', deep: '#a08850' }), wall: stone('#c0a878', '#7a6038'), platform: { kind: 'stone', base: '#d0b888', dark: '#7a6038' }, spike: '#d8d8e0' },
    decor: [{ k: 'pebbles', c: '#a08850', p: 0.1 }, { k: 'drygrass', c: '#b8a060', p: 0.1 }],
    life: ['birds'], front: { kind: 'grass', c: '#6a5a30' },
    water: WATER, lava: LAVA, fx: 'dust',
  },
  greatwall: {
    sky: ['#c4d4e4', '#d8e4ee', '#ecf0f4'],
    layers: [
      { k: 'cirrus', c: '#ffffff', y: 22, a: 50, s: 0.03, n: 5, seed: 28 },
      { k: 'ridges', c: '#a8b8c8', y: 168, a: 110, s: 0.04, seed: 29, cells: 5, octaves: 2, sharp: 1.8 },
      { k: 'fogbank', c: '#ffffff', y: 150, a: 44, s: 0.08, seed: 27, bands: 2 },
      { k: 'ridges', c: '#7a8a9a', y: 206, a: 130, s: 0.1, seed: 30, cells: 7, octaves: 2, sharp: 2.2, trees: '#4a5a54', treeline: 0.1 },
      { k: 'pagodas', c: '#5a5a6a', y: 218, a: 70, s: 0.22, seed: 31, n: 3 },
      { k: 'forest', c: '#4a5a4e', y: 238, a: 52, s: 0.46, seed: 33, n: 9, species: [['conifer', 2], ['bush', 2], ['birch', 1]], trunk: '#2a3a30' },
    ],
    tiles: { solid: stone('#8e8678', '#5a5448', { top: '#aaa294', fringe: moss('#6a8a5a') }), wall: stone('#756e62', '#4a443a'), platform: { kind: 'wood', base: '#8a5a38', dark: '#4a2e1a' }, spike: '#b0b0b8' },
    decor: [{ k: 'tuft', c: '#6a8a5a', p: 0.1 }, { k: 'weed', c: '#5a7a4a', p: 0.08 }, { k: 'pebbles', c: '#6a6458', p: 0.1 }],
    life: ['birds'], weather: { fog: '#ffffff', fogY: 172 }, front: { kind: 'grass', c: '#2a3a2e' },
    water: WATER, lava: LAVA, fx: 'leaves',
  },

  // ---- Medieval ----
  fjord: {
    sky: ['#7a98b8', '#a0b8cc', '#c4d4e0', '#dce6ec'],
    layers: [
      { k: 'stratus', c: '#e8eef4', y: 20, a: 50, s: 0.03, n: 3, seed: 32 },
      { k: 'ridges', c: '#4a6a88', y: 170, a: 125, s: 0.06, seed: 33, cells: 3, snow: '#e8f0f8', snowAt: 0.5, trees: '#2a4a5a', treeline: 0.2 },
      { k: 'waterfall', c: '#e0f0f8', rock: '#34506a', moss: '#2a4a5a', y: 204, a: 96, s: 0.12, seed: 34, at: 0.68, fw: 12, cliff: 80 },
      { k: 'lake', c: '#3a6a90', y: 196, s: 0.2, seed: 37, glitter: '#cfe4f4', sunAt: 0.3 },
      { k: 'forest', c: '#2a4a5a', y: 218, a: 44, s: 0.3, seed: 36, n: 13, species: [['conifer', 1]], trunk: '#1a2e3a' },
      { k: 'fogbank', c: '#ffffff', y: 190, a: 24, s: 0.16, seed: 35, bands: 1, density: 0.6 },
    ],
    tiles: { solid: wood('#8a5a30', '#4a2e18', { fringe: moss('#5a7a4a') }), wall: wood('#6a4424', '#3a2210'), platform: { kind: 'wood', base: '#9a6a38', dark: '#4a2e18' }, spike: '#c8c8d0' },
    decor: [{ k: 'pebbles', c: '#6a4424', p: 0.05 }],
    life: ['gulls', 'fish'], weather: { fog: '#dfe9f0', lightning: true, fogY: 176 }, front: { kind: 'rocks', c: '#14222e' },
    water: { base: '#2a5a88', top: '#6a9cc8', deep: '#1a3a5a' }, lava: LAVA, fx: 'rain',
  },
  castle: {
    sky: ['#7a86a6', '#a0a8bc', '#c4c4d0'],
    layers: [
      { k: 'stratus', c: '#d0d4e0', y: 18, a: 60, s: 0.04, n: 4, seed: 35 },
      { k: 'ridges', c: '#6a7a78', y: 186, a: 72, s: 0.07, seed: 36, cells: 3, octaves: 2, trees: '#4a5a52' },
      { k: 'castle', c: '#585a70', y: 226, a: 82, s: 0.2, seed: 37, n: 5, roof: '#3a3a56' },
      { k: 'fogbank', c: '#b8bcc8', y: 198, a: 30, s: 0.25, seed: 38, bands: 1 },
      { k: 'forest', c: '#4a5e46', y: 236, a: 60, s: 0.4, seed: 39, n: 12, species: [['oak', 2], ['conifer', 2], ['birch', 1]], trunk: '#2e3a2a' },
    ],
    tiles: { solid: stone('#7c7c8a', '#4a4a58', { top: '#9a9aa8', fringe: grass('#5a7a4a') }), wall: stone('#666674', '#3e3e4c'), platform: { kind: 'wood', base: '#7a5230', dark: '#3a2412' }, spike: '#c8c8d4' },
    decor: [{ k: 'tuft', c: '#5a7a4a', p: 0.1 }, { k: 'weed', c: '#4a6a3a', p: 0.08 }, { k: 'pebbles', c: '#6a6a78', p: 0.1 }],
    life: ['crows'], weather: { lightning: true }, front: { kind: 'grass', c: '#26361f' },
    water: WATER, lava: LAVA, fx: 'rain',
  },
  shadowcastle: {
    sky: ['#0a0a1e', '#181030', '#2c1a44', '#46224e'],
    layers: [
      { k: 'stars', c: '#a8a0d0', y: 0, a: 120, s: 0.02, n: 70, seed: 38 },
      { k: 'celestial', c: '#e8e4f4', halo: '#8a80b8', craters: true, y: 56, r: 13, at: 0.26, s: 0.01 },
      { k: 'ridges', c: '#1a1428', y: 196, a: 84, s: 0.07, seed: 39, cells: 3, shadow: 0.3 },
      { k: 'castle', c: '#140e20', y: 220, a: 90, s: 0.14, seed: 40, n: 3, roof: '#1e1430', window: '#ffb060' },
      { k: 'fogbank', c: '#3a3058', y: 204, a: 34, s: 0.18, seed: 41, bands: 2 },
      { k: 'forest', c: '#120e20', y: 232, a: 64, s: 0.34, seed: 42, n: 14, species: [['dead', 4], ['conifer', 1]], trunk: '#0e0a18' },
    ],
    tiles: { solid: stone('#3c3650', '#1e1a2c', { top: '#5a5274', fringe: moss('#3a4a4a'), under: drips('#5a5274') }), wall: stone('#2e2a40', '#16121e'), platform: { kind: 'wood', base: '#4a3228', dark: '#22160e' }, spike: '#a8a8c8' },
    decor: [{ k: 'crystal', c: '#c8a0ff', p: 0.04 }, { k: 'pebbles', c: '#4a4460', p: 0.1 }],
    life: ['bats', 'fireflies'], weather: { fog: '#3a3058', fogY: 180 }, front: { kind: 'grass', c: '#08060f' },
    water: { base: '#1a2a58', top: '#3a5aa0', deep: '#0e1838' }, lava: LAVA, dark: false, fx: 'petals',
  },
  pirate: {
    sky: ['#f07a4a', '#f4a060', '#f8c680', '#fce4b0'],
    layers: [
      { k: 'celestial', c: '#fff0c8', core: '#ffffff', halo: '#ffd890', y: 160, r: 18, at: 0.5, s: 0.01 },
      { k: 'cumulus', c: '#ffd0a0', shadow: '#d88a78', light: '#fff0d8', y: 28, a: 60, s: 0.03, n: 4, seed: 41, w: 58 },
      { k: 'ships', c: '#8a5050', y: 202, a: 66, s: 0.1, seed: 42, n: 4 },
      { k: 'lake', c: '#b25a52', y: 202, s: 0.2, seed: 43, glitter: '#ffe0a8', sunAt: 0.5 },
      { k: 'spires', c: '#6a4a50', y: 224, a: 74, s: 0.32, seed: 44, n: 4, sea: '#9a4a48', foam: '#ffe8d0' },
    ],
    tiles: { solid: wood('#7a4a28', '#3a2010'), wall: wood('#5a3418', '#2a1608'), platform: { kind: 'wood', base: '#8a5a30', dark: '#3a2010' }, spike: '#c8c0b0' },
    decor: [{ k: 'pebbles', c: '#5a3418', p: 0.05 }],
    life: ['gulls'], front: { kind: 'rocks', c: '#34160f' },
    water: { base: '#2a5a88', top: '#6a9cc8', deep: '#1a3a5a' }, lava: LAVA,
  },

  // ---- Industrial and War ----
  train: {
    sky: ['#e8a45e', '#f0c080', '#f6d8a4', '#fae8c4'],
    layers: [
      { k: 'celestial', c: '#fff0c0', core: '#ffffff', halo: '#ffe0a0', y: 62, r: 12, at: 0.2, s: 0.01 },
      { k: 'cirrus', c: '#fff0d8', y: 22, a: 60, s: 0.02, n: 5, seed: 44 },
      { k: 'mesa', c: '#c8884a', y: 198, a: 92, s: 0.06, seed: 45, n: 3, w: 78, cap: '#d8a060', bands: ['#c8884a', '#b87840', '#d89858', '#a86a38'] },
      { k: 'canyon', c: '#b8703a', y: 222, a: 56, s: 0.18, seed: 46, steps: 5 },
      { k: 'dunes', c: '#d09a58', y: 234, a: 24, s: 0.3, seed: 47, cells: 3 },
      { k: 'spires', c: '#9a5a30', y: 246, a: 40, s: 0.46, seed: 48, n: 4, ground: '#b07840', hoodoo: true },
    ],
    tiles: { solid: metal('#6a4a3a', '#3a2418', { stripe: '#a8602a' }), wall: metal('#58402e', '#2e1c10'), platform: { kind: 'metal', base: '#7a5a42', dark: '#3a2418' }, spike: '#c8c0b0' },
    decor: [{ k: 'pebbles', c: '#8a6a50', p: 0.05 }],
    life: ['birds'], front: { kind: 'grass', c: '#6a4020' },
    water: WATER, lava: LAVA, fx: 'dust',
  },
  factory: {
    glow: true,
    sky: ['#3a2e28', '#54443a', '#745c4a', '#8a6e56'],
    layers: [
      { k: 'stratus', c: '#5a4a40', shadow: '#3a2e28', y: 14, a: 60, s: 0.03, n: 5, seed: 47 },
      { k: 'chimneys', c: '#2a2420', y: 192, a: 90, s: 0.08, seed: 48, smoke: '#5a4a40', n: 6 },
      { k: 'fogbank', c: '#6a5848', y: 176, a: 40, s: 0.12, seed: 49, bands: 2 },
      { k: 'lake', c: '#2e3a34', y: 214, s: 0.2, seed: 50 },
      { k: 'forest', c: '#2a2e20', y: 228, a: 58, s: 0.3, seed: 51, n: 12, species: [['dead', 4], ['bush', 1]], trunk: '#1c1a14' },
      { k: 'chimneys', c: '#1e1a18', y: 240, a: 60, s: 0.46, seed: 52, n: 5 },
    ],
    tiles: { solid: metal('#6a5a4a', '#352c22', { stripe: '#b8862a', fringe: weeds('#4a5a2a') }), wall: metal('#554638', '#2a2018'), platform: { kind: 'metal', base: '#7a6a58', dark: '#352c22' }, spike: '#c8b8a0' },
    decor: [{ k: 'pebbles', c: '#4a4038', p: 0.08 }, { k: 'weed', c: '#4a5a2a', p: 0.1 }],
    life: ['crows'], weather: { fog: '#5a4a3c', fogY: 186 }, front: { kind: 'rubble', c: '#120e0a' },
    water: { base: '#3a6a58', top: '#7ab4a0', deep: '#1f3a30' }, lava: LAVA, fx: 'embers',
  },
  trench: {
    sky: ['#6a6a5e', '#86867a', '#a0a090', '#b8b8a8'],
    layers: [
      { k: 'stratus', c: '#8a8a7c', shadow: '#6a6a5e', y: 16, a: 70, s: 0.03, n: 5, seed: 49 },
      { k: 'ridges', c: '#6a6a58', y: 188, a: 54, s: 0.07, seed: 50, cells: 3, octaves: 2 },
      { k: 'forest', c: '#4a4a3a', y: 214, a: 62, s: 0.16, seed: 51, n: 14, species: [['dead', 4], ['birch', 1]], trunk: '#2a2a20' },
      { k: 'fogbank', c: '#d8d8c8', y: 200, a: 40, s: 0.22, seed: 52, bands: 2 },
      { k: 'forest', c: '#363a2c', y: 234, a: 66, s: 0.38, seed: 53, n: 10, species: [['dead', 5], ['bush', 1]], trunk: '#22241a' },
    ],
    tiles: { solid: earth('#5a4a32', '#352a1c', '#6a5a38', { sub: '#4a3c28', deep: '#30261a', fringe: grass('#6a7a3a'), under: roots('#2e2214') }), wall: wood('#5a4630', '#2e2214'), platform: { kind: 'wood', base: '#6a5232', dark: '#2e2214' }, spike: '#a8a898' },
    decor: [{ k: 'pebbles', c: '#4a3e2a', p: 0.15 }, { k: 'drygrass', c: '#7a7040', p: 0.1 }, { k: 'tuft', c: '#6a7a3a', p: 0.06 }],
    life: ['crows'], weather: { fog: '#c8c8b8', fogY: 184 }, front: { kind: 'rubble', c: '#181810' },
    water: { base: '#4a5a3a', top: '#7a8a5a', deep: '#2a3420' }, lava: LAVA, fx: 'dust',
  },
  beach: {
    sky: ['#6eb4e0', '#98cce8', '#c4e0ee', '#e8f0ec'],
    layers: [
      { k: 'celestial', c: '#fff8d8', core: '#ffffff', halo: '#fff0b0', y: 54, r: 11, at: 0.76, s: 0.01 },
      { k: 'cumulus', c: '#ffffff', y: 22, a: 50, s: 0.03, n: 4, seed: 51, w: 60 },
      { k: 'lake', c: '#3a78a8', y: 176, s: 0.08, seed: 53, glitter: '#e8f8ff', sunAt: 0.76 },
      { k: 'spires', c: '#7a7468', y: 204, a: 62, s: 0.12, seed: 52, n: 4, ground: false },
      { k: 'dunes', c: '#e0c88e', y: 232, a: 18, s: 0.35, seed: 54, cells: 3 },
      { k: 'forest', c: '#5a8a4a', y: 240, a: 62, s: 0.5, seed: 55, n: 5, species: [['palm', 1]], trunk: '#6a4a2a' },
    ],
    tiles: { solid: sand('#dcc690', '#a88c58', { fringe: dunes('#ecd8a8'), sub: '#ccb078', deep: '#a88c58' }), wall: metal('#8a8a7e', '#4a4a42'), platform: { kind: 'wood', base: '#8a6a40', dark: '#3a2a14' }, spike: '#9a9aa4' },
    decor: [{ k: 'shell', c: '#f0d8d0', p: 0.07 }, { k: 'pebbles', c: '#a88c58', p: 0.08 }, { k: 'drygrass', c: '#8aa05a', p: 0.08 }, { k: 'tuft', c: '#8aa05a', p: 0.05 }],
    life: ['gulls', 'fish'], front: { kind: 'grass', c: '#566e32' },
    water: { base: '#2f78b8', top: '#8ac8f0', deep: '#1f5088' }, lava: LAVA,
  },

  // ---- Modern and Future ----
  arctic: {
    sky: ['#0a1a34', '#16304e', '#2e5274', '#5a86a4'],
    layers: [
      { k: 'stars', c: '#d8f0ff', y: 0, a: 140, s: 0.02, n: 70, seed: 55 },
      { k: 'aurora', c: '#2ee8a0', c2: '#9a5af0', y: 74, a: 70, s: 0.02, seed: 56 },
      { k: 'ridges', c: '#244a6a', y: 192, a: 112, s: 0.07, seed: 57, cells: 3, snow: '#d8eefc', snowAt: 0.4 },
      { k: 'fogbank', c: '#a8c8e0', y: 190, a: 34, s: 0.16, seed: 58, bands: 1 },
      { k: 'forest', c: '#10283e', y: 226, a: 58, s: 0.4, seed: 59, n: 12, species: [['conifer', 1]], trunk: '#0a1a2a' },
    ],
    tiles: { solid: metal('#3a4a5e', '#1c2636', { top: '#e8f4ff', stripe: '#5aa8d8', fringe: snowcap(), under: icicles() }), wall: metal('#2a3646', '#141c28'), platform: { kind: 'metal', base: '#4a5a70', dark: '#1c2636' }, spike: '#d0e8f8' },
    decor: [{ k: 'snowpile', c: '#ffffff', p: 0.15 }, { k: 'shard', c: '#bfe4f8', p: 0.04 }],
    weather: { fog: '#a8c8e0', fogY: 184 }, front: { kind: 'drifts', c: '#cfe4f4' },
    water: { base: '#1f4a78', top: '#5a9ad0', deep: '#102a48' }, lava: LAVA, fx: 'snow',
  },
  neon: {
    glow: true, haze: 0.2,
    sky: ['#10082a', '#2a0a4a', '#5a1a6a', '#b0307a'],
    layers: [
      { k: 'stars', c: '#ff9ad8', y: 0, a: 100, s: 0.01, n: 40, seed: 58 },
      { k: 'celestial', c: '#ffc8ec', halo: '#ff4aa8', craters: true, y: 54, r: 12, at: 0.78, s: 0.01 },
      { k: 'ridges', c: '#2a0a48', y: 190, a: 70, s: 0.04, seed: 59, cells: 3, octaves: 2 },
      { k: 'lake', c: '#3a1060', y: 198, s: 0.08, seed: 60, glitter: '#ff9ad8', sunAt: 0.78 },
      { k: 'city', c: '#1a0a30', y: 196, a: 112, s: 0.1, seed: 61, win: '#ff4aa8', win2: '#4af0ff', lit: 0.3 },
      { k: 'city', c: '#120822', y: 228, a: 90, s: 0.3, seed: 62, win: '#4af0ff', win2: '#ff4aa8', lit: 0.4 },
    ],
    tiles: { solid: neon('#241438', '#0e0818', '#ff4aa8'), wall: neon('#1a0e2c', '#0a0612', '#4af0ff'), platform: { kind: 'neon', base: '#34204a', glow: '#4af0ff' }, spike: '#ff7ad0' },
    decor: [{ k: 'crystal', c: '#ff4aa8', p: 0.03 }],
    front: { kind: 'cables', c: '#0c041a' },
    water: { base: '#2a1a5a', top: '#ff4aa8', deep: '#120a30' }, lava: LAVA, fx: 'rain',
  },
  megacity: {
    glow: true, haze: 0.2,
    sky: ['#04081a', '#081a38', '#0a3458', '#1a6a8a'],
    layers: [
      { k: 'stars', c: '#9ae0ff', y: 0, a: 120, s: 0.01, n: 60, seed: 61 },
      { k: 'celestial', c: '#d8f8ff', halo: '#4af0ff', craters: true, y: 48, r: 11, at: 0.2, s: 0.01 },
      { k: 'fogbank', c: '#2a6a9a', y: 176, a: 44, s: 0.06, seed: 62, bands: 2 },
      { k: 'city', c: '#06142a', y: 190, a: 126, s: 0.1, seed: 63, win: '#4af0ff', win2: '#a8ffea', lit: 0.35 },
      { k: 'fogbank', c: '#1a5a8a', y: 214, a: 30, s: 0.2, seed: 64, bands: 1 },
      { k: 'city', c: '#040d1e', y: 232, a: 90, s: 0.32, seed: 65, win: '#2ad8ff', win2: '#ffffff', lit: 0.45 },
    ],
    tiles: { solid: neon('#0e2038', '#050c18', '#4af0ff'), wall: neon('#0a1828', '#040810', '#2a8aff'), platform: { kind: 'neon', base: '#16304c', glow: '#a8ffea' }, spike: '#ff5a7a' },
    decor: [{ k: 'crystal', c: '#4af0ff', p: 0.03 }],
    front: { kind: 'cables', c: '#030c1a' },
    water: { base: '#0a3a6a', top: '#4af0ff', deep: '#04182e' }, lava: LAVA, fx: 'dust',
  },
  citadel: {
    glow: true, haze: 0.2,
    sky: ['#08001a', '#240a3a', '#4a0a56', '#7a1a6a'],
    layers: [
      { k: 'stars', c: '#e0a0ff', y: 0, a: 160, s: 0.01, n: 90, seed: 64 },
      { k: 'celestial', c: '#e8b0ff', halo: '#9a1a7a', craters: true, y: 62, r: 14, at: 0.7, s: 0.01 },
      { k: 'ridges', c: '#14061f', y: 220, a: 96, s: 0.06, seed: 65, cells: 6, octaves: 3, shadow: 0.15, sharp: 1.6 },
      { k: 'castle', c: '#1e0a30', y: 222, a: 120, s: 0.12, seed: 66, n: 5, roof: '#2e0e48', window: '#ff4aa8' },
      { k: 'fogbank', c: '#4a1a68', y: 206, a: 34, s: 0.2, seed: 67, bands: 2 },
      { k: 'forest', c: '#14081e', y: 240, a: 62, s: 0.38, seed: 68, n: 10, species: [['dead', 2], ['willow', 1], ['bush', 2]], trunk: '#0e0616' },
    ],
    tiles: { solid: stone('#4a2a68', '#1e0e30', { top: '#a060e0', fringe: moss('#6a3a9a'), under: vines('#6a3a9a') }), wall: stone('#341a4c', '#160a22'), platform: { kind: 'stone', base: '#5a3a7a', dark: '#1e0e30' }, spike: '#ff4aa8' },
    decor: [{ k: 'crystal', c: '#ff4aa8', p: 0.06 }, { k: 'pebbles', c: '#3a2250', p: 0.1 }],
    life: ['bats'], weather: { fog: '#4a1a68', fogY: 186 }, front: { kind: 'rubble', c: '#0c0516' },
    water: { base: '#3a1a6a', top: '#ff4aa8', deep: '#1a0a38' }, lava: LAVA, fx: 'embers',
  },
};

export function getTheme(id) {
  const t = THEMES[id] || THEMES.jungle;
  if (!t.id) t.id = THEMES[id] ? id : 'jungle';
  return t;
}
