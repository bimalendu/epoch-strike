// `npm run economy` - the lives economy of the whole game, level by level, for three player models.
//
// Supply is read from the level data: medals (10 = a life), hidden 1UPs, and points (20,000 then every 50,000). Points
// are estimated from the enemies placed in the level and its boss, so the numbers are a model, not a measurement - but a
// model built from the real data, so a change to a level shows up here. The three models differ only in how many lives
// they lose per level (a skilled player, a competent one, a casual one) and ramp up with the levels.
import { installSoftCanvas } from './softcanvas.js';
installSoftCanvas();
const { LEVEL_DEFS, buildLevel } = await import('../src/game/levels.js');
const { ENEMY_DEFS } = await import('../src/game/enemy_defs.js');
await import('../src/game/bosses.js');
const { LIVES, SCORE } = await import('../src/game/constants.js');

/** Everything the level hands out, from its data. */
export function levelSupply(index) {
  const lvl = buildLevel(index);
  let medals = 0;
  let oneups = 0;
  let kills = 0;
  let enemies = 0;
  const count = (type, n = 1) => {
    const d = ENEMY_DEFS[type];
    if (d && !d.boss && d.arch !== 'capsule' && typeof d.score === 'number') {
      kills += d.score * n;
      enemies += n;
    }
  };
  for (const s of lvl.spawns) {
    if (s.type === 'pickup') {
      if (s.item === 'medal') medals++;
      else if (s.item === '1up') oneups++;
    } else count(s.type);
  }
  // enemies that waves and ambush zones send in
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o.type === 'string' && ENEMY_DEFS[o.type] && (o.n || o.count)) count(o.type, o.n || o.count);
    for (const v of Object.values(o)) walk(v);
  };
  walk(lvl.zones);
  const boss = lvl.boss ? ENEMY_DEFS[lvl.boss.type].score : 0;
  const echoes = (lvl.rush || []).reduce((a, r) => a + Math.round(ENEMY_DEFS[r.type].score * 0.5), 0);
  return { name: LEVEL_DEFS[index].name, medals, oneups, kills, enemies, boss: boss + echoes };
}

// Lives lost per level = base + ramp * levelIndex. In a one-hit-death shooter an average player loses about two lives a
// level (a boss alone is often two tries); a skilled one about one; a casual one three or more. The ramp is the late
// eras' fuller screens. `flawless` is the chance of beating a level's boss without dying in that level (the FLAWLESS life).
// These are assumptions, not measurements: nobody has playtested this yet, so the useful output is the *break-even* death
// rate below (how many deaths a level the supply pays for) and how it compares with what a player can be expected to lose.
export const MODELS = {
  skilled: { base: 1.0, ramp: 0.03, flawless: 0.5 },
  average: { base: 2.0, ramp: 0.04, flawless: 0.2 },
  casual: { base: 3.2, ramp: 0.05, flawless: 0.05 },
};
const KILL_RATE = 0.9; // share of the placed enemies the player actually kills
const COMBO = 1.15; // average combo multiplier
const MEDAL_RATE = 0.9;
const ONEUP_RATE = 0.6; // hidden: not everyone finds them

/** Expected lives entering each level (index 0..19) and after the last one. */
export function simulate(model, supply, { start = 3, medalsPerLife = LIVES.MEDALS_PER_LIFE } = {}) {
  // (the clamp to 1 life below stands in for Continue: a player who runs out is put back on a life)
  let lives = start;
  let points = 0;
  let milestones = 0;
  let medals = 0;
  const rows = [];
  const gain = (n) => {
    // a life is only worth something below the cap; at the cap it pays the cap bonus
    for (let i = 0; i < n; i++) {
      if (lives < LIVES.MAX) lives++;
      else points += LIVES.CAP_BONUS;
    }
  };
  supply.forEach((s, i) => {
    const entering = lives;
    const deaths = Math.max(0, model.base + model.ramp * i);
    // lives from medals (carried over between levels), hidden 1UPs, flawless boss kills and score milestones
    const m = s.medals * MEDAL_RATE;
    medals += m;
    const medalLives = Math.floor(medals / medalsPerLife);
    medals -= medalLives * medalsPerLife;
    const oneups = s.oneups * ONEUP_RATE;
    // points: kills, medals, boss, clear bonuses (2,000 per life left, 5,000 for a clean level)
    const lifeLeft = Math.max(0, lives - deaths);
    points += s.kills * KILL_RATE * COMBO + m * SCORE.MEDAL + s.boss + SCORE.LEVEL_CLEAR_PER_LIFE * lifeLeft + (deaths < 0.5 ? SCORE.NO_DEATH_CLEAR : 0);
    let ms = 0;
    while (points >= LIVES.FIRST_EXTRA + milestones * LIVES.EXTRA_EVERY) {
      milestones++;
      ms++;
    }
    const got = medalLives + oneups + model.flawless + ms;
    // net change, clamped: below 1 the player used a Continue, above the cap each life pays 5,000 instead
    const raw = lives - deaths + got;
    if (raw > LIVES.MAX) points += (raw - LIVES.MAX) * LIVES.CAP_BONUS;
    lives = Math.min(LIVES.MAX, Math.max(1, raw));
    rows.push({ level: i + 1, entering, deaths, medalLives, oneups, milestones: ms, points: Math.round(points), after: lives, net: lives - entering });
  });
  return { rows, final: lives };
}

/**
 * The constant number of deaths per level at which a player enters `level` (1-based) with exactly `target` lives: how many
 * deaths a level the supply of lives pays for. The plan's target is 4 lives entering Level 13 for the average player.
 */
export function breakEvenDeaths(supply, { flawless = 0.2, target = 4, level = 13 } = {}) {
  let lo = 0;
  let hi = 8;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    const r = simulate({ base: mid, ramp: 0, flawless }, supply);
    if (r.rows[level - 1].entering > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const supply = LEVEL_DEFS.map((_, i) => levelSupply(i));
  console.log('level                    medals 1ups enemies  kill pts  boss pts');
  supply.forEach((s, i) => console.log(String(i + 1).padStart(2), s.name.padEnd(22), String(s.medals).padStart(5), String(s.oneups).padStart(4), String(s.enemies).padStart(7), String(s.kills).padStart(9), String(s.boss).padStart(9)));
  const tot = supply.reduce((a, s) => ({ m: a.m + s.medals, u: a.u + s.oneups }), { m: 0, u: 0 });
  console.log('total medals', tot.m, '(= ' + Math.floor(tot.m / 10) + ' lives), hidden 1UPs', tot.u);
  const per = supply.map((s, i) => s.medals * MEDAL_RATE / LIVES.MEDALS_PER_LIFE + s.oneups * ONEUP_RATE);
  console.log('\nlives a level pays out before score and bosses (medals + 1UPs): ' + (per.reduce((a, b) => a + b, 0) / 20).toFixed(2));
  console.log('break-even: the supply pays for ' + breakEvenDeaths(supply).toFixed(2) + ' deaths a level (4 lives entering Level 13, flawless 20%)');
  for (const [name, model] of Object.entries(MODELS)) {
    const r = simulate(model, supply);
    console.log(`\n${name}: lives entering each level`);
    console.log(r.rows.map((x) => `L${x.level}:${x.entering.toFixed(1)}`).join('  '));
    console.log('entering level 13:', r.rows[12].entering.toFixed(2), '| entering level 20:', r.rows[19].entering.toFixed(2), '| points at the end:', r.rows[19].points);
  }
}
