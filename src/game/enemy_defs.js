// Data for every enemy "skin". Era-specific enemies are added as their levels arrive:
// each is an archetype (runner / shooter / turret / flyer / heavy / spawner) plus numbers and a palette.
//
// Common fields: arch, tpl (which painter), hp, speed, w/h (hitbox), score, pal (palette),
// shooters: range, tele (telegraph seconds), fireEvery, burst, spread, bullet {speed, kind, r}

const KHAKI = { skin: '#e0a070', body: '#6b7a3a', pants: '#4a5530', boots: '#1b1b1b', hat: '#4f5a2a' };

export const ENEMY_DEFS = {
  grunt: {
    id: 'grunt', arch: 'runner', tpl: 'humanoid', hp: 1, speed: 72, w: 12, h: 26, score: 100, aggro: 260,
    pal: KHAKI, hatStyle: 'helmet', gun: false,
  },
  rifleman: {
    id: 'rifleman', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 100,
    range: 300, tele: 0.55, fireEvery: 1.9, burst: 1, bullet: { speed: 95, kind: 'orb', r: 2 },
    pal: { skin: '#e0a070', body: '#8a3a2a', pants: '#4a3a30', boots: '#1b1b1b', hat: '#6a2a20' }, hatStyle: 'cap', gun: true,
  },
  // The flying weapon capsule. It never hurts the player; whatever `item` the spawn names drops when shot.
  capsule: {
    id: 'capsule', arch: 'capsule', tpl: 'capsule', hp: 1, speed: 52, w: 18, h: 12, score: 0,
    contact: false, noBurn: true, noCap: true, flyer: true,
  },
  // ---- Prehistoric (levels 1-4) ----
  raptor: {
    id: 'raptor', arch: 'runner', tpl: 'raptor', hp: 2, speed: 96, w: 22, h: 18, score: 150, aggro: 230,
    jump: true, jumpV: 260, leapRange: 70,
    pal: { body: '#6a9a3a', belly: '#d8d0a0', stripe: '#3a6a22', crest: '#c0392b', eye: '#ffd23a' },
  },
  spitter: {
    id: 'spitter', arch: 'turret', tpl: 'plant', hp: 3, w: 16, h: 20, score: 150, range: 190, tele: 0.6,
    fireEvery: 2.4, burst: 1, turn: 3.5, arc: [-Math.PI, 0], muzzleY: 14, barrel: 9, firstDelay: 1.0,
    bullet: { speed: 200, g: 230, kind: 'spit', r: 2, col: '#b8ff3a', sfx: 'enemyShoot' },
  },
  // ---- Rift invaders: alien tech that turns up in every era ----
  drone: {
    id: 'drone', arch: 'flyer', tpl: 'drone', hp: 1, speed: 58, w: 18, h: 10, score: 100, flyer: true,
    pattern: 'sine', amp: 16, freq: 2.2, flap: 14, fireEvery: 2.8, tele: 0.5,
    bullet: { speed: 85, kind: 'plasma', r: 2, col: '#ff4adc' },
    pal: { body: '#7a4ad8', eye: '#ff3a6a' },
  },
  striker: {
    id: 'striker', arch: 'flyer', tpl: 'drone', hp: 2, speed: 70, w: 18, h: 10, score: 200, flyer: true,
    pattern: 'dive', amp: 10, freq: 1.8, flap: 16, diveSpeed: 190, diveRange: 130, tele: 0.7,
    pal: { body: '#d84a4a', eye: '#ffe27a' },
  },
  trooper: {
    id: 'trooper', arch: 'shooter', tpl: 'humanoid', hp: 3, speed: 30, keep: 140, w: 12, h: 26, score: 200,
    range: 300, tele: 0.55, fireEvery: 2.0, burst: 2, gun: true, hatStyle: 'helmet',
    bullet: { speed: 100, kind: 'plasma', r: 2, col: '#ff4adc' },
    pal: { skin: '#8ad8b0', body: '#4a3a8a', pants: '#2a2a50', boots: '#111111', hat: '#6a4ad0' },
  },
  pod: {
    id: 'pod', arch: 'turret', tpl: 'pod', hp: 8, w: 26, h: 14, score: 300, range: 260, tele: 0.5, fireEvery: 0.9,
    burst: 2, gap: 0.18, turn: 2.2, arc: [-2.9, -0.24], muzzleY: 9, barrel: 9, firstDelay: 0.8,
    cycle: { open: 2.4, closed: 1.5 }, bullet: { speed: 105, kind: 'plasma', r: 2, col: '#ff4adc' },
  },
  brute: {
    id: 'brute', arch: 'heavy', tpl: 'brute', hp: 16, speed: 26, w: 26, h: 40, score: 600, keep: 60, range: 240,
    tele: 0.6, fireEvery: 2.8, burst: 2, gap: 0.3, muzzleX: 12, muzzleY: 26,
    weak: { x0: 0, y0: -30, x1: 14, y1: -12 }, armor: 0.25,
    bullet: { speed: 90, kind: 'plasma', r: 3, col: '#ff6ad8' },
    pal: { skin: '#5a3a7a', armor: '#7a7e96' },
  },
  nest: {
    id: 'nest', arch: 'spawner', tpl: 'nest', hp: 10, w: 26, h: 24, score: 400, spawns: 'drone', interval: 3.6, max: 2,
    spawnDy: 14, pal: { body: '#8a3a6a', glow: '#ff4adc' },
  },
  // ---- Volcano and Ice Age (levels 2-3) ----
  firelizard: {
    id: 'firelizard', arch: 'shooter', tpl: 'raptor', hp: 3, speed: 34, keep: 120, w: 22, h: 18, score: 200,
    range: 210, tele: 0.6, fireEvery: 2.3, burst: 1,
    bullet: { speed: 185, g: 160, kind: 'fire', r: 3, col: '#ff8a1e' },
    pal: { body: '#c0502a', belly: '#f0c070', stripe: '#7a2a14', crest: '#ffd23a', eye: '#ffee66' },
  },
  ptero: {
    id: 'ptero', arch: 'flyer', tpl: 'ptero', hp: 2, speed: 80, w: 28, h: 12, score: 200, flyer: true,
    pattern: 'dive', amp: 10, freq: 1.6, flap: 8, diveSpeed: 205, diveRange: 150, tele: 0.7,
    pal: { body: '#b8683a', wing: '#e0a060' },
  },
  sabre: {
    id: 'sabre', arch: 'runner', tpl: 'sabre', hp: 3, speed: 118, w: 28, h: 16, score: 200, aggro: 260,
    jump: true, jumpV: 300, leapRange: 90,
    pal: { body: '#d8b070', stripe: '#8a5a2a', belly: '#f4e8c8' },
  },
  icecannon: {
    id: 'icecannon', arch: 'turret', tpl: 'cannon', hp: 4, w: 24, h: 14, score: 250, range: 250, tele: 0.6,
    fireEvery: 2.0, burst: 2, gap: 0.22, turn: 2.5, arc: [-3.1, -0.05], muzzleY: 12, barrel: 13, firstDelay: 1.2,
    bullet: { speed: 150, kind: 'ice', r: 3, col: '#bfeaff' },
    pal: { body: '#6a8aa8', metal: '#c8d8e8', glow: '#9ae0ff' },
  },
  icicle: {
    id: 'icicle', arch: 'faller', tpl: 'icicle', hp: 1, w: 8, h: 22, score: 50, trigger: 34, tele: 0.75,
    noBurn: true, noCap: true,
  },
  // ---- Stone Age caves (level 4): the Rift has possessed the tribes. Their eyes glow in the dark. ----
  caveman: {
    id: 'caveman', arch: 'runner', tpl: 'humanoid', hp: 2, speed: 84, w: 12, h: 26, score: 150, aggro: 230,
    jump: true, jumpV: 250, leapRange: 60, glow: 22, hatStyle: 'fur', club: true, fur: '#8a6a4a',
    pal: { skin: '#c88a5a', body: '#7a5a3a', pants: '#5a4028', boots: '#3a2a1a', hat: '#8a6a4a', eye: '#ff4adc', belt: '#2a1a10' },
  },
  spearman: {
    id: 'spearman', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 200, glow: 22,
    range: 260, tele: 0.65, fireEvery: 2.3, burst: 1, hatStyle: 'fur', thrower: true, fur: '#8a6a4a',
    bullet: { speed: 175, g: 240, kind: 'bolt', r: 2, sfx: 'swing' },
    pal: { skin: '#b87a50', body: '#6a4a30', pants: '#4a3420', boots: '#2a1c10', hat: '#7a5a3a', eye: '#ff4adc', belt: '#2a1a10' },
  },
  bat: {
    id: 'bat', arch: 'flyer', tpl: 'bat', hp: 1, speed: 96, w: 18, h: 10, score: 100, flyer: true, glow: 18,
    pattern: 'dive', amp: 14, freq: 3.4, flap: 17, diveSpeed: 175, diveRange: 120, tele: 0.65,
    pal: { body: '#4a3a5a', wing: '#6a5a82', eye: '#ff4adc' },
  },
  // ---- Egypt (level 5) ----
  crusher: {
    id: 'crusher', arch: 'crusher', tpl: 'crusher', hp: 1, w: 28, h: 26, score: 0, indestructible: true, contact: false,
    noBurn: true, noCap: true, up: 1.3, tele: 0.8, rest: 0.55,
  },
  mummy: {
    id: 'mummy', arch: 'runner', tpl: 'humanoid', hp: 3, speed: 42, w: 12, h: 26, score: 150, aggro: 230,
    wraps: true, hatStyle: 'wrap', glow: 14,
    pal: { skin: '#cfc49a', body: '#d8cfa8', pants: '#c9bf94', boots: '#b0a47a', hat: '#d8cfa8', eye: '#7aff9a', belt: '#a89c70' },
  },
  scarab: {
    id: 'scarab', arch: 'runner', tpl: 'scarab', hp: 1, speed: 108, w: 12, h: 10, score: 75, aggro: 210,
    jump: true, jumpV: 215, leapRange: 48,
    pal: { body: '#2a6aa8', shell: '#3ad8c8' },
  },
  // ---- Troy (level 6) ----
  hoplite: {
    id: 'hoplite', arch: 'runner', tpl: 'humanoid', hp: 3, speed: 46, w: 12, h: 26, score: 200, aggro: 250,
    armorFront: true, shield: '#b8742c', armor: '#c8923a', hatStyle: 'crest',
    pal: { skin: '#d89a68', body: '#a83a2a', pants: '#7a5a3a', boots: '#4a3020', hat: '#c8923a', belt: '#4a3020' },
  },
  archer: {
    id: 'archer', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 200,
    range: 300, tele: 0.7, fireEvery: 2.2, burst: 1, bow: true, hatStyle: 'band',
    bullet: { speed: 215, g: 170, kind: 'arrow', r: 2, sfx: 'shootBolt' },
    pal: { skin: '#d89a68', body: '#3a5a8a', pants: '#6a5a3a', boots: '#3a2a1a', hat: '#d8d0b8', belt: '#2a2a2a' },
  },
  // ---- Rome (level 7) ----
  gladiator: {
    id: 'gladiator', arch: 'runner', tpl: 'humanoid', hp: 3, speed: 80, w: 12, h: 26, score: 200, aggro: 330,
    sword: true, armor: '#9a9aa4', hatStyle: 'crest', jump: true, jumpV: 280, leapRange: 54,
    pal: { skin: '#d89a68', body: '#a8742a', pants: '#7a4a2a', boots: '#4a3020', hat: '#9a9aa4', belt: '#3a2418' },
  },
  elephant: {
    id: 'elephant', arch: 'charger', tpl: 'elephant', hp: 26, speed: 34, charge: 215, chargeT: 1.35, tele: 0.9, rest: 1.3,
    walkT: 1.9, minCharge: 90, w: 52, h: 40, score: 800,
    pal: { body: '#8a8a94', cloth: '#a8282e', trim: '#ffd23a' },
  },
  rivalchariot: {
    id: 'rivalchariot', arch: 'charger', tpl: 'chariot', hp: 6, speed: 0, charge: 225, chargeT: 3.2, tele: 0.85, rest: 0,
    passThrough: true, w: 44, h: 24, score: 400,
    pal: { horse: '#c8a06a', mane: '#3a2418', body: '#8a2a2a', trim: '#ffd23a', cloth: '#3a5aa8', crest: '#c0262e' },
  },
  // ---- China (level 8) ----
  terracotta: {
    id: 'terracotta', arch: 'runner', tpl: 'humanoid', hp: 4, speed: 52, w: 12, h: 26, score: 250, aggro: 96, still: true,
    armorFront: true, shield: '#8a5a3a', armor: '#a86f48', hatStyle: 'topknot', sword: true,
    pal: { skin: '#b57a52', body: '#9a6240', pants: '#855232', boots: '#5a3820', hat: '#6a3e26', belt: '#4a2e1c', eye: '#ffd23a' },
  },
  kitesoldier: {
    id: 'kitesoldier', arch: 'flyer', tpl: 'kite', hp: 2, speed: 50, w: 24, h: 26, score: 200, flyer: true,
    pattern: 'swoop', amp: 12, freq: 1.6, flap: 3, dropEvery: 1.6, dropKind: 'cracker',
    pal: { paper: '#d8342a', trim: '#ffd23a', rib: '#6a3a1a', cloth: '#2a4a8a', skin: '#d89a68' },
  },
  firecrate: {
    id: 'firecrate', arch: 'launcher', tpl: 'firecrate', hp: 3, w: 18, h: 18, score: 150, period: 3.4, tele: 0.9, range: 300,
    rise: 104, burst: 6, firstDelay: 0.8,
    pal: { body: '#b8302a', trim: '#ffd23a', tube: '#7a5a2a' },
  },
  // ---- Vikings (level 9) ----
  berserker: {
    id: 'berserker', arch: 'runner', tpl: 'humanoid', hp: 4, speed: 66, w: 12, h: 26, score: 250, aggro: 330, enrage: true,
    jump: true, jumpV: 270, leapRange: 56, axe: true, hatStyle: 'horns', fur: '#8a6a4a',
    pal: { skin: '#e0a878', body: '#7a4a2a', pants: '#4a3a30', boots: '#2a1a10', hat: '#9a9aa4', belt: '#2a1a10' },
  },
  axethrower: {
    id: 'axethrower', arch: 'shooter', tpl: 'humanoid', hp: 3, speed: 0, w: 12, h: 26, score: 250,
    range: 280, tele: 0.7, fireEvery: 2.3, burst: 1, hatStyle: 'horns', thrower: 'axe', fur: '#8a6a4a',
    bullet: { speed: 190, g: 260, kind: 'axe', r: 3, sfx: 'swing' },
    pal: { skin: '#e0a878', body: '#3a5a7a', pants: '#4a3a30', boots: '#2a1a10', hat: '#9a9aa4', belt: '#2a1a10' },
  },
  serpent: {
    id: 'serpent', arch: 'breacher', tpl: 'serpent', hp: 3, w: 16, h: 18, score: 250, noCap: true, noBurn: true,
    range: 170, tele: 0.8, rest: 1.9, leapV: 330, leapVx: 36, g: 560, depth: 16,
    pal: { body: '#2a8a7a', belly: '#c8e8a0', fin: '#e0b83a', eye: '#ff4a4a' },
  },
  // ---- Medieval castle siege (level 10) ----
  knight: {
    id: 'knight', arch: 'runner', tpl: 'humanoid', hp: 6, speed: 40, w: 12, h: 27, score: 300, aggro: 280,
    armorFront: true, shield: '#2f4f9a', armor: '#aab2c0', hatStyle: 'greathelm', sword: true, cape: '#a8282e',
    pal: { skin: '#d8a070', body: '#7e8696', pants: '#555c6c', boots: '#2c2c34', hat: '#aab2c0', belt: '#3a2418' },
  },
  crossbowman: {
    id: 'crossbowman', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 250,
    range: 300, tele: 0.8, fireEvery: 2.5, burst: 1, crossbow: true, hatStyle: 'coif',
    bullet: { speed: 250, kind: 'quarrel', r: 2, sfx: 'shootBolt' },
    pal: { skin: '#d8a070', body: '#3a6a3a', pants: '#5a4a30', boots: '#2a1a10', hat: '#8a92a0', belt: '#3a2418' },
  },
  catapult: {
    id: 'catapult', arch: 'turret', tpl: 'catapult', hp: 9, w: 30, h: 22, score: 350, range: 270, tele: 1.0,
    fireEvery: 3.6, burst: 1, turn: 6, arc: [-2.9, -0.25], muzzleY: 16, barrel: 0, firstDelay: 1.4,
    bullet: { speed: 240, g: 200, high: true, kind: 'boulder', r: 4, col: '#ff8a1e', sfx: 'shootBolt' },
    pal: { body: '#7a5230', metal: '#4a4a56', glow: '#ff8a1e', stone: '#8a8a94' },
  },
  // ---- Feudal Japan, the Shadow Castle (level 11) ----
  ninja: {
    id: 'ninja', arch: 'runner', tpl: 'humanoid', hp: 2, speed: 125, w: 12, h: 26, score: 250, aggro: 330, ambush: 110,
    stall: 0.45, jump: true, jumpV: 300, leapRange: 74, sword: true, hatStyle: 'ninja',
    pal: { skin: '#d8a070', body: '#262636', pants: '#1c1c2a', boots: '#14141c', hat: '#262636', belt: '#a8282e', eye: '#ffffff' },
  },
  shinobi: {
    id: 'shinobi', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 250,
    range: 300, tele: 0.7, fireEvery: 2.7, burst: 1, fan: 3, spread: 0.22, hatStyle: 'ninja', thrower: 'star',
    bullet: { speed: 175, kind: 'shuriken', r: 2, sfx: 'swing' },
    pal: { skin: '#d8a070', body: '#3a2a5a', pants: '#241a3a', boots: '#14141c', hat: '#3a2a5a', belt: '#e0b83a', eye: '#ffffff' },
  },
  samurai: {
    id: 'samurai', arch: 'duelist', tpl: 'humanoid', hp: 5, speed: 46, w: 12, h: 27, score: 350, aggro: 300, range: 150,
    tele: 0.75, dash: 250, dashT: 0.42, rest: 1.2, armorFront: true, sword: true, armor: '#c8a040', hatStyle: 'kabuto',
    pal: { skin: '#d8a070', body: '#a8282e', pants: '#3a2a2a', boots: '#241a14', hat: '#2a2a3a', belt: '#e0b83a' },
  },
  // ---- Age of Sail, the pirate armada (level 12) ----
  pirate: {
    id: 'pirate', arch: 'runner', tpl: 'humanoid', hp: 2, speed: 82, w: 12, h: 26, score: 200, aggro: 300,
    jump: true, jumpV: 270, leapRange: 58, sword: true, hatStyle: 'tricorn',
    pal: { skin: '#d8a070', body: '#b8302a', pants: '#3a3a4a', boots: '#241a14', hat: '#1c1c26', belt: '#e0b83a' },
  },
  buccaneer: {
    id: 'buccaneer', arch: 'shooter', tpl: 'humanoid', hp: 3, speed: 0, w: 12, h: 26, score: 250,
    range: 290, tele: 0.65, fireEvery: 2.2, burst: 1, gun: true, hatStyle: 'tricorn',
    bullet: { speed: 150, kind: 'bullet', r: 2 },
    pal: { skin: '#c89060', body: '#2a5a8a', pants: '#e8e0c8', boots: '#241a14', hat: '#2a2a36', belt: '#8a5a2a' },
  },
  deckcannon: {
    id: 'deckcannon', arch: 'turret', tpl: 'cannon', hp: 6, w: 26, h: 16, score: 300, range: 290, tele: 0.8,
    fireEvery: 2.6, burst: 1, turn: 2.6, arc: [-3.1, -0.05], muzzleY: 12, barrel: 13, firstDelay: 1.2,
    bullet: { speed: 140, kind: 'cannon', r: 3 },
    pal: { body: '#5a3a22', metal: '#4a4a56', glow: '#ffb02e' },
  },
  gull: {
    id: 'gull', arch: 'flyer', tpl: 'bat', hp: 1, speed: 92, w: 18, h: 10, score: 100, flyer: true,
    pattern: 'dive', amp: 14, freq: 3, flap: 12, diveSpeed: 180, diveRange: 120, tele: 0.65,
    pal: { body: '#e8ecf4', wing: '#b8c4d4', eye: '#ff4a4a' },
  },
  // the Ghost Galleon's crew: pale, quick, and gone with one hit
  spectre: {
    id: 'spectre', arch: 'runner', tpl: 'humanoid', hp: 1, speed: 96, w: 12, h: 26, score: 150, aggro: 400,
    jump: true, jumpV: 280, leapRange: 60, sword: true, hatStyle: 'tricorn', glow: 16,
    pal: { skin: '#a8f0d8', body: '#4ab8a0', pants: '#2a7a6a', boots: '#1a5a4a', hat: '#2a8a78', belt: '#b8fff0', eye: '#ffffff' },
  },
  // ---- Wild West, the desert train (level 13) ----
  gunslinger: {
    id: 'gunslinger', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 250,
    range: 290, tele: 0.6, fireEvery: 2.1, burst: 2, gap: 0.2, gun: true, hatStyle: 'stetson',
    bullet: { speed: 175, kind: 'bullet', r: 2 },
    pal: { skin: '#d8a070', body: '#8a5a32', pants: '#3a4a6a', boots: '#2a1a10', hat: '#6a4a28', belt: '#e0b83a' },
  },
  bandit: {
    id: 'bandit', arch: 'runner', tpl: 'humanoid', hp: 2, speed: 112, w: 12, h: 26, score: 250, aggro: 320, ambush: 100,
    stall: 0.5, jump: true, jumpV: 290, leapRange: 66, sword: true, hatStyle: 'bandana',
    pal: { skin: '#d8a070', body: '#6a6a7a', pants: '#4a3a2a', boots: '#2a1a10', hat: '#b8302a', belt: '#2a2a32' },
  },
  dynamiter: {
    id: 'dynamiter', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 300,
    range: 270, tele: 0.85, fireEvery: 2.7, burst: 1, thrower: 'dynamite', hatStyle: 'bowler',
    bullet: { speed: 175, g: 260, kind: 'dynamite', r: 3, sfx: 'swing' },
    pal: { skin: '#d8a070', body: '#7a3a3a', pants: '#3a3a44', boots: '#2a1a10', hat: '#2a2a32', belt: '#e0b83a' },
  },
  sharpshooter: {
    id: 'sharpshooter', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 300,
    range: 400, tele: 1.1, fireEvery: 3.2, burst: 1, gun: true, hatStyle: 'stetson',
    bullet: { speed: 285, kind: 'bullet', r: 2 },
    pal: { skin: '#c89060', body: '#4a6a4a', pants: '#5a4a30', boots: '#2a1a10', hat: '#3a3a30', belt: '#8a5a2a' },
  },
  gatling: {
    id: 'gatling', arch: 'turret', tpl: 'cannon', hp: 8, w: 26, h: 16, score: 350, range: 300, tele: 0.8,
    fireEvery: 2.4, burst: 4, gap: 0.12, turn: 3, arc: [-3.0, -0.1], muzzleY: 12, barrel: 12, firstDelay: 1.2,
    bullet: { speed: 190, kind: 'bullet', r: 2 },
    pal: { body: '#5a5a66', metal: '#2a2a32', glow: '#ffb02e' },
  },
  vulture: {
    id: 'vulture', arch: 'flyer', tpl: 'bat', hp: 1, speed: 88, w: 20, h: 10, score: 120, flyer: true,
    pattern: 'dive', amp: 12, freq: 2.4, flap: 9, diveSpeed: 185, diveRange: 130, tele: 0.65,
    pal: { body: '#4a3a30', wing: '#2a2018', eye: '#ffcc3a' },
  },
  // ---- The Industrial Age, the steam factory (level 14) ----
  worker: {
    id: 'worker', arch: 'runner', tpl: 'humanoid', hp: 2, speed: 98, w: 12, h: 26, score: 200, aggro: 300,
    jump: true, jumpV: 280, leapRange: 62, sword: true, hatStyle: 'hardhat',
    pal: { skin: '#d8a070', body: '#3a5a9a', pants: '#2a3a6a', boots: '#241a14', hat: '#ffd23a', belt: '#8a5a2a' },
  },
  riveter: {
    id: 'riveter', arch: 'shooter', tpl: 'humanoid', hp: 3, speed: 0, w: 12, h: 26, score: 250,
    range: 270, tele: 0.7, fireEvery: 2.5, burst: 1, fan: 3, spread: 0.2, gun: true, hatStyle: 'hardhat',
    bullet: { speed: 185, kind: 'bullet', r: 2 },
    pal: { skin: '#c89060', body: '#8a8a96', pants: '#3a3a46', boots: '#241a14', hat: '#e8e8ee', belt: '#e0b83a' },
  },
  foreman: {
    id: 'foreman', arch: 'runner', tpl: 'humanoid', hp: 6, speed: 46, w: 12, h: 27, score: 350, aggro: 280,
    armorFront: true, shield: '#6a6e7e', armor: '#8a8e9e', hatStyle: 'hardhat', sword: true,
    pal: { skin: '#d8a070', body: '#5a4a3a', pants: '#3a3a46', boots: '#241a14', hat: '#e8761a', belt: '#e0b83a' },
  },
  press: {
    id: 'press', arch: 'crusher', tpl: 'crusher', hp: 1, w: 28, h: 26, score: 0, indestructible: true, contact: false,
    noBurn: true, noCap: true, up: 1.3, tele: 0.8, rest: 0.55,
    pal: { main: '#6a6e7e', dark: '#2a2a34', light: '#9aa0b0' },
  },
  slagcannon: {
    id: 'slagcannon', arch: 'turret', tpl: 'cannon', hp: 7, w: 26, h: 16, score: 300, range: 280, tele: 0.9,
    fireEvery: 3.0, burst: 1, turn: 2.6, arc: [-2.9, -0.3], muzzleY: 12, barrel: 13, firstDelay: 1.3,
    bullet: { speed: 215, g: 230, high: true, kind: 'slag', r: 3 },
    pal: { body: '#4a3a34', metal: '#2a2a32', glow: '#ff7a1e' },
  },
  // ---- The First World War, the trench line (level 15) ----
  infantry: {
    id: 'infantry', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 200,
    range: 300, tele: 0.65, fireEvery: 2.2, burst: 1, gun: true, hatStyle: 'brodie',
    bullet: { speed: 180, kind: 'bullet', r: 2 },
    pal: { skin: '#d8a070', body: '#7a7a4a', pants: '#6a6a40', boots: '#3a2a1a', hat: '#8a8a6a', belt: '#4a3a24' },
  },
  bayonet: {
    id: 'bayonet', arch: 'runner', tpl: 'humanoid', hp: 2, speed: 108, w: 12, h: 26, score: 200, aggro: 300,
    jump: true, jumpV: 290, leapRange: 66, sword: true, hatStyle: 'pickel',
    pal: { skin: '#d8a070', body: '#6a7078', pants: '#5a6068', boots: '#2a1a10', hat: '#8a8e96', belt: '#3a3a40' },
  },
  flamer: {
    id: 'flamer', arch: 'shooter', tpl: 'humanoid', hp: 3, speed: 0, w: 12, h: 26, score: 300,
    range: 150, tele: 0.7, fireEvery: 2.3, burst: 1, fan: 3, spread: 0.16, gun: true, hatStyle: 'brodie',
    bullet: { speed: 125, kind: 'fire', r: 3, life: 0.85 },
    pal: { skin: '#c89060', body: '#5a5a3a', pants: '#4a4a30', boots: '#2a1a10', hat: '#6a6a50', belt: '#c8a040' },
  },
  mortar: {
    id: 'mortar', arch: 'turret', tpl: 'cannon', hp: 6, w: 26, h: 16, score: 300, range: 290, tele: 0.9,
    fireEvery: 3.0, burst: 1, turn: 2.6, arc: [-2.9, -0.3], muzzleY: 12, barrel: 13, firstDelay: 1.3,
    bullet: { speed: 215, g: 240, high: true, kind: 'shell', r: 3 },
    pal: { body: '#5a5a3a', metal: '#3a3a32', glow: '#ffb02e' },
  },
  biplane: {
    id: 'biplane', arch: 'flyer', tpl: 'biplane', hp: 3, speed: 105, w: 34, h: 16, score: 400, flyer: true,
    pattern: 'swoop', dropEvery: 0.85, dropKind: 'bomb', flap: 12,
    pal: { body: '#7a7a4a', wing: '#c8b888', accent: '#c0262e' },
  },
  // ---- The Second World War, the coastal assault (level 16) ----
  garrison: {
    id: 'garrison', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 200, crush: true,
    range: 320, tele: 0.6, fireEvery: 2.1, burst: 3, gap: 0.11, gun: true, hatStyle: 'stahl',
    bullet: { speed: 190, kind: 'bullet', r: 2 },
    pal: { skin: '#d8a070', body: '#6a6e62', pants: '#5a5e52', boots: '#241a14', hat: '#5a6050', belt: '#3a3a30' },
  },
  grenadier: {
    id: 'grenadier', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 250, crush: true,
    range: 270, tele: 0.8, fireEvery: 2.6, burst: 1, thrower: 'grenade', hatStyle: 'stahl',
    bullet: { speed: 170, g: 260, kind: 'grenade', r: 3, sfx: 'swing' },
    pal: { skin: '#d8a070', body: '#767a68', pants: '#5a5e52', boots: '#241a14', hat: '#686e5c', belt: '#4a3a24' },
  },
  bazooka: {
    id: 'bazooka', arch: 'shooter', tpl: 'humanoid', hp: 3, speed: 0, w: 12, h: 26, score: 300, crush: true,
    range: 340, tele: 0.95, fireEvery: 3.4, burst: 1, gun: true, bazooka: true, hatStyle: 'stahl',
    bullet: { speed: 150, kind: 'rocket', r: 3, col: '#ff9a3a' },
    pal: { skin: '#c89060', body: '#5a6a4a', pants: '#4a5640', boots: '#241a14', hat: '#4a5240', belt: '#3a3a30' },
  },
  stormtrooper: {
    id: 'stormtrooper', arch: 'runner', tpl: 'humanoid', hp: 2, speed: 118, w: 12, h: 26, score: 220, aggro: 300, crush: true,
    jump: true, jumpV: 290, leapRange: 68, sword: true, hatStyle: 'stahl',
    pal: { skin: '#d8a070', body: '#7a7e6e', pants: '#5a5e52', boots: '#241a14', hat: '#5a6050', belt: '#3a3a30' },
  },
  bunker: {
    id: 'bunker', arch: 'turret', tpl: 'bunker', hp: 10, w: 34, h: 18, score: 400, range: 320, tele: 0.7, fireEvery: 1.1,
    burst: 4, gap: 0.12, turn: 3.2, arc: [-3.0, -0.12], muzzleY: 11, barrel: 15, firstDelay: 1.0,
    cycle: { open: 2.3, closed: 1.7 }, bullet: { speed: 190, kind: 'bullet', r: 2 },
    pal: { body: '#9a9a8c', dark: '#5a5a50', slit: '#14141a', glow: '#ffb02e' },
  },
  atgun: {
    id: 'atgun', arch: 'turret', tpl: 'atgun', hp: 6, w: 28, h: 18, score: 350, range: 360, tele: 1.0, fireEvery: 3.3,
    burst: 1, turn: 2.4, arc: [-3.1, -0.06], muzzleY: 12, barrel: 22, firstDelay: 1.4,
    bullet: { speed: 245, kind: 'shell', r: 3 },
    pal: { body: '#6a6e5a', metal: '#3a3e34', glow: '#ffb02e' },
  },
  mine: {
    id: 'mine', arch: 'mine', tpl: 'mine', hp: 1, w: 14, h: 6, score: 50, contact: false, noBurn: true, noCap: true,
    trig: 26, tele: 0.5, blast: 30,
  },
  fighter: {
    id: 'fighter', arch: 'flyer', tpl: 'fighter', hp: 3, speed: 125, w: 36, h: 14, score: 450, flyer: true,
    pattern: 'swoop', dropEvery: 0.7, dropKind: 'bomb', flap: 12,
    pal: { body: '#7a8268', wing: '#5a6250', accent: '#e8e8d8' },
  },
  // ---- The Cold War, the Arctic missile base (level 17) ----
  // Guards marked `sleeper` in the level stand silently until the alarm rings, they are hurt, or the soldier walks up to them.
  snowtrooper: {
    id: 'snowtrooper', arch: 'runner', tpl: 'humanoid', hp: 2, speed: 112, w: 12, h: 26, score: 200, aggro: 300,
    jump: true, jumpV: 290, leapRange: 66, sword: true, hatStyle: 'ushanka',
    pal: { skin: '#d8a070', body: '#d4dae6', pants: '#8a96a8', boots: '#2a2a32', hat: '#e6ecf4', belt: '#4a5668' },
  },
  guard: {
    id: 'guard', arch: 'shooter', tpl: 'humanoid', hp: 2, speed: 0, w: 12, h: 26, score: 250,
    range: 330, tele: 0.6, fireEvery: 2.1, burst: 2, gap: 0.14, gun: true, hatStyle: 'ushanka',
    bullet: { speed: 190, kind: 'bullet', r: 2 },
    pal: { skin: '#d8a070', body: '#5a6a82', pants: '#3a4658', boots: '#1e1e26', hat: '#7a8aa2', belt: '#c8d4e0' },
  },
  sentrygun: {
    id: 'sentrygun', arch: 'turret', tpl: 'cannon', hp: 5, w: 24, h: 14, score: 300, range: 310, tele: 0.7, fireEvery: 1.9,
    burst: 3, gap: 0.12, turn: 2.8, arc: [-3.0, -0.1], muzzleY: 12, barrel: 13, firstDelay: 1.0,
    bullet: { speed: 200, kind: 'bullet', r: 2 },
    pal: { body: '#7a8aa0', metal: '#c8d4e0', glow: '#4af0ff' },
  },
  snowmobile: {
    id: 'snowmobile', arch: 'charger', tpl: 'snowmobile', hp: 5, speed: 0, charge: 250, chargeT: 3.0, tele: 0.85, rest: 0,
    passThrough: true, w: 40, h: 18, score: 400,
    pal: { body: '#c0392b', trim: '#f4f4f8', dark: '#2a2a34', glow: '#ffe27a' },
  },
  recon: {
    id: 'recon', arch: 'flyer', tpl: 'drone', hp: 2, speed: 54, w: 18, h: 10, score: 200, flyer: true,
    pattern: 'sine', amp: 14, freq: 2.0, flap: 14, fireEvery: 2.6, tele: 0.55,
    bullet: { speed: 120, kind: 'plasma', r: 2, col: '#6af0ff' },
    pal: { body: '#8ab0c8', eye: '#ff4a4a' },
  },
  samsite: {
    id: 'samsite', arch: 'turret', tpl: 'rack', hp: 6, w: 28, h: 16, score: 350, range: 360, tele: 0.9, fireEvery: 3.2,
    burst: 2, gap: 0.45, turn: 2.2, arc: [-2.6, -0.55], muzzleY: 12, barrel: 14, firstDelay: 1.4,
    bullet: { speed: 140, kind: 'rocket', r: 3, col: '#ff9a3a' },
    pal: { body: '#6a7a62', metal: '#3a4a3a', glow: '#ffb02e' },
  },
  // ---- Neon City (level 18) ----
  cyborg: {
    id: 'cyborg', arch: 'shooter', tpl: 'humanoid', hp: 3, speed: 0, w: 12, h: 26, score: 300,
    range: 330, tele: 0.55, fireEvery: 1.9, burst: 3, gap: 0.1, gun: true, hatStyle: 'visor',
    bullet: { speed: 210, kind: 'plasma', r: 2, col: '#4af0ff' },
    pal: { skin: '#9ab0c8', body: '#2a2a4a', pants: '#1a1a30', boots: '#0e0e18', hat: '#4a4a7a', eye: '#4af0ff', belt: '#ff4ad8' },
  },
  hunter: {
    id: 'hunter', arch: 'flyer', tpl: 'drone', hp: 2, speed: 76, w: 18, h: 10, score: 250, flyer: true,
    pattern: 'dive', amp: 10, freq: 1.8, flap: 16, diveSpeed: 215, diveRange: 140, tele: 0.6,
    pal: { body: '#ff4a6a', eye: '#ffe27a' },
  },
  gunchopper: {
    id: 'gunchopper', arch: 'flyer', tpl: 'copter', hp: 6, speed: 0, w: 34, h: 16, score: 450, flyer: true,
    pattern: 'hover', follow: 1.1, offsetX: 100, amp: 10, freq: 1.5, flap: 22, range: 340, tele: 0.65, fireEvery: 1.8,
    burst: 3, gap: 0.14, bullet: { speed: 175, kind: 'plasma', r: 2, col: '#ff4ad8' },
    pal: { body: '#3a3a5a', accent: '#ff4ad8', glass: '#4af0ff' },
  },
  sniperbot: {
    id: 'sniperbot', arch: 'shooter', tpl: 'humanoid', hp: 3, speed: 0, w: 12, h: 26, score: 350,
    range: 440, tele: 1.15, fireEvery: 3.4, burst: 1, gun: true, hatStyle: 'visor',
    bullet: { speed: 300, kind: 'laser', r: 2, col: '#ff3a5a' },
    pal: { skin: '#a0a0b8', body: '#4a2a3a', pants: '#2a1a24', boots: '#0e0e18', hat: '#6a3a4a', eye: '#ff3a5a', belt: '#ff3a5a' },
  },
  laserturret: {
    id: 'laserturret', arch: 'turret', tpl: 'cannon', hp: 5, w: 24, h: 14, score: 300, range: 320, tele: 0.75, fireEvery: 2.2,
    burst: 2, gap: 0.16, turn: 2.6, arc: [-3.05, -0.08], muzzleY: 12, barrel: 13, firstDelay: 1.2,
    bullet: { speed: 230, kind: 'laser', r: 2, col: '#4af0ff' },
    pal: { body: '#3a3a5a', metal: '#9aa0c8', glow: '#4af0ff' },
  },
  // ---- Cyber Megacity (level 19) ----
  ceilgun: {
    id: 'ceilgun', arch: 'turret', tpl: 'ceilgun', hp: 5, w: 24, h: 14, score: 300, range: 320, tele: 0.75, fireEvery: 2.1,
    burst: 2, gap: 0.16, turn: 2.8, arc: [0.1, 3.04], muzzleY: -5, barrel: 13, firstDelay: 1.2, // hung from a slab: the pivot sits 5 px above the body's lower edge
    bullet: { speed: 200, kind: 'laser', r: 2, col: '#ff4ad8' },
    pal: { body: '#3a3a5a', metal: '#9aa0c8', glow: '#ff4ad8' },
  },
  cyberhound: {
    id: 'cyberhound', arch: 'runner', tpl: 'hound', hp: 2, speed: 128, w: 24, h: 14, score: 250, aggro: 320,
    jump: true, jumpV: 290, leapRange: 70,
    pal: { body: '#3a3a5a', trim: '#4af0ff', dark: '#14141f', eye: '#ff3a5a' },
  },
  sentinel: {
    id: 'sentinel', arch: 'heavy', tpl: 'sentinel', hp: 18, speed: 24, w: 26, h: 42, score: 650, keep: 70, range: 300,
    tele: 0.7, fireEvery: 2.9, burst: 2, gap: 0.3, muzzleX: 12, muzzleY: 28,
    weak: { x0: -6, y0: -34, x1: 10, y1: -20 }, armor: 0.25,
    bullet: { speed: 150, kind: 'plasma', r: 3, col: '#ff4ad8' },
    pal: { body: '#4a4a6a', trim: '#9aa0c8', core: '#ff4ad8', dark: '#14141f' },
  },
  orbmine: {
    id: 'orbmine', arch: 'flyer', tpl: 'orb', hp: 2, speed: 22, w: 14, h: 14, score: 150, flyer: true,
    pattern: 'sine', amp: 8, freq: 2.2, flap: 10,
    pal: { body: '#2a2a44', light: '#ff3a5a' },
  },
  hoverbiker: {
    id: 'hoverbiker', arch: 'flyer', tpl: 'biker', hp: 3, speed: 92, w: 30, h: 16, score: 400, flyer: true,
    pattern: 'swoop', amp: 20, freq: 1.7, flap: 12, fireEvery: 1.6, tele: 0.6,
    bullet: { speed: 160, kind: 'plasma', r: 2, col: '#ff4ad8' },
    pal: { body: '#4a2a6a', glow: '#ff4ad8', suit: '#2a2a3a' },
  },
  // <<ENEMY_DEFS>> (registry: new enemy skins are added above this line)
};

export function enemyDef(id) {
  const d = ENEMY_DEFS[id];
  if (!d) throw new Error(`Unknown enemy type: ${id}`);
  return d;
}
