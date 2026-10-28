# Epoch Strike: architecture

Plain HTML5 canvas and ES modules. No dependencies, no build step. `npm start` serves the folder, `npm test` runs
the suite with Node's built-in runner.

## Layers

```
src/engine/   gfx (canvas + Painter), font, rng, input, audio      no game knowledge
src/game/     the simulation (World) and everything it owns         no DOM access
src/game/art/ procedural sprites, tiles, themes, HUD                draws a World, never changes it
src/scenes/   title, menu, play, results ...                        glue between Game, World and the screen
tools/        serve, software canvas, PNG encoder, bot, screenshots dev only
tests/        node:test: unit / integration / e2e                   runs headless through the software canvas
```

The simulation is a fixed 60 Hz step (`DT = 1/60`) at 480x270 logical pixels, 16 px tiles. `World.update(input, dt)`
is a pure function of the previous state plus input, with a seeded RNG, so a scripted input replays identically.
The world never talks to scenes directly: it appends to `world.events` (`kill`, `levelClear`, `playerDied`, ...) and
the scene drains them each frame.

## Registries (where to add things)

Every extensible list ends in a sentinel comment so new entries slot in without touching other code:

| Add a...               | Edit                                  | Sentinel          |
| ---------------------- | ------------------------------------- | ----------------- |
| level                  | `src/game/levels/lNN_*.js`, `levels.js` | `<<LEVEL_DEFS>>`  |
| enemy skin             | `enemy_defs.js` (data only)           | `<<ENEMY_DEFS>>`  |
| enemy behaviour        | `ai.js`                               | `<<ARCH>>`        |
| enemy sprite           | `art/creatures.js` or `art/enemies.js` | `<<PAINTERS>>`    |
| enemy bullet look      | `art/ebullets.js`                     | `<<EBULLET_ART>>` |
| boss                   | `bosses/<name>.js`, `bosses.js`, `art/bosses.js` | `<<BOSSES>>`, `<<BOSS_PAINTERS>>` |
| player weapon          | `weapons.js`                          | `<<WEAPONS>>`     |
| music track            | `src/game/tracks.js`                  | `<<TRACKS>>`      |
| player bullet look     | `art/bullets.js`                      | `<<BULLET_ART>>`  |
| player gun sprite      | `art/guns.js`                         | `<<GUN_ART>>`     |
| theme                  | `art/themes.js`                       | (object key)      |

## Enemies

A def in `enemy_defs.js` is an archetype name plus numbers:

* `runner` charges and leaps, `shooter` stops and fires bursts, `turret` is fixed and rotates inside an arc
  (optional open/closed `cycle`), `flyer` has `sine`, `dive`, `hover` and `swoop` paths, `heavy` is slow and armoured
  with a glowing `weak` rect, `spawner` emits other enemies up to `max`.
* `crusher` is a stone block that slams down on a rhythm (floor marker first; it cannot be shot or burned) and `charger`
  walks, rears up for `tele` seconds and charges in a line: war elephants stop at the arena wall and are winded,
  rival chariots (`passThrough`) thunder across the whole screen and leave. `armorFront` makes a shield: flat shots
  from the front are blocked, diagonal ones (and shots from above) land.
* `launcher` (a crate of fireworks) hisses for `tele` seconds, then fires a rocket (`rocket.js`: `launchRocket` flies a
  ballistic arc to a chosen burst point, `burst` throws a ring of falling sparks). The rocket's whole flight is on screen
  for about a second, and the Dragon Kite Fortress uses the same rockets with floor marks showing where they burst.
  `breacher` (sea serpents) lurks under the water (`hidden`, `noContact`, `noCap`: it cannot be shot, touched or counted),
  ripples where it will surface for `tele` seconds, then leaps in an arc and dives again. Spawn it with `y` = the water
  surface (`b.addEnemy('serpent', col, { row: b.gy + 1 })` in a ford).
* `runner` options: `still` (stands like a statue until the soldier is within `aggro`: terracotta guards) and `enrage`
  (1.5x speed at half health: berserkers).
* `duelist` (samurai) stalks with its blade up, raises it for `tele` seconds, dashes in a flat slash for `dashT`, then rests:
  jump the slash and shoot it in the back. `runner` gained `ambush` (px) and `stall`: an ambusher hides (`waiting`,
  `hidden`, `noContact`: it is unseen, unhittable and harmless) until the soldier comes within `ambush` px on screen, then
  steps out in a puff of smoke, stands still for `stall` seconds (never under 0.4 s) and rushes in (ninjas).
* Week 10 enemies: knights (`armorFront` plate and shield), crossbowmen (flat quarrels), catapults (`turret` with a
  lobbed `boulder`, `bullet.high`), pirates (cutlass runners), buccaneers (musket `shooter`), deck cannons and gulls.
  The Ghost Galleon's `spectre` crew has one hit point.
* Week 11 enemies: gunslingers (a pair of shots), bandits (`runner` with `ambush`/`stall`, hiding in roof hatches),
  dynamiters (lobbed sticks, `bullet.kind: 'dynamite'`), sharpshooters (a full second of aim), a gatling (`turret` burst),
  vultures; factory workers, riveters, foremen (`armorFront` apron), iron presses (`crusher` with its own `pal`) and slag
  cannons; infantry, bayonets, flamers (short-lived `fire`), mortars (lobbed `shell`) and biplanes (`flyer` that
  `swoop`s and drops a `bomb` every `dropEvery` seconds while it passes the soldier).
* Week 12 enemies (the coastal assault): garrison troops, grenadiers (lobbed `grenade`), bazooka troops (a slow `rocket`)
  and storm troopers (`runner`, all four `crush`able by the tank); bunkers (`turret` with a `cycle`: the slit only opens for
  2.3 s at a time, and a burst that has not finished when it shuts is called off), anti-tank guns (a one-second `tele`, then a
  flat fast `shell`), fighters (`flyer` that bombs) and landmines. The `mine` archetype (`ai.js`) lies still until the soldier
  is within `trig` px, pops up and beeps for `tele` seconds (never under 0.45 s) and then `killEnemy`s itself; `enemies.js`
  calls `mineBlast` for every mine that dies, so a mine shot from a distance bursts harmlessly, a burst hurts the soldier (or
  one hit of a tank) within `blast` px and sets off neighbouring mines a beat later. (The hook lives in `enemies.js` because
  `enemy_defs.js` must not import `ai.js`.)
* Week 13 enemies (the last era group): snow troopers and guards (`shooter`, the alarm's reinforcements are snow troopers),
  sentry guns, snowmobiles (a `charger` with `passThrough`: jump it), recon drones, SAM sites (a `turret` with an upward `arc`
  that fires slow `rocket`s), cyborgs (burst `plasma`), hunter drones (`dive`), gunchoppers (`flyer` that `hover`s and fires
  bursts), sniper bots (a 1.15 s `tele`, then a fast `laser`), laser turrets, ceiling guns (a `turret` with `gdir: -1`, its
  `arc` pointing down and `muzzleY` measured from the roof it hangs from), cyberhounds, sentinels (a `heavy` with
  `armor: .25` and a core `weak` box that the Plasma Cannon's `armorPierce` ignores the armour of), orb mines and hover bikers.
  A spawn marked `sleeper: true` is a **sleeping guard**: `stealth.js snooze` keeps it still and silent until the alarm rings,
  it takes damage, or the soldier is within `STEALTH.WAKE_R` (56 px across, 44 px up) of it. (`enemies.js` calls the hook.)
* Humanoid defs take cosmetic options (`wraps`, `sword`, `bow`, `shield`, `armor`, `hatStyle`); non-humanoids get
  their own painters (`art/creatures.js`, `art/ancient.js`).
* Every attack is telegraphed (`tele` seconds, at least 0.5 s for shots, 0.6 s for dives) and the sprite flickers to
  its `hot` frame while it winds up.
* Bullets are plain data (`speed`, `kind`, optional gravity `g` for lobs). `ballisticAngle` aims lobbed shots.
* The screen holds at most `enemyCapFor(levelIndex)` enemies (6, 8, 10, 12, 14 by era group); the rest of a crowd
  waits in the spawn list until there is room. Capsules do not count.

## Bosses

A boss is an enemy whose def has `boss: true` and `arch: 'boss'`; `boss.js` runs its life as a state machine:
`enter` (walks in under a WARNING banner, invulnerable) -> `idle` -> `tele` -> `attack` -> `idle` ..., a `phase`
roar when health crosses the next threshold, and `dying` explosions before the level clears.

```js
export default {
  name: 'REX-7', hp: 80, armor: 0.2,
  phases: [{ hp: 1, attacks: ['stomp', 'spit'], cd: [1.2, 2] }, { hp: 0.5, attacks: ['stomp', 'charge', 'roar'], cd: [0.8, 1.4] }],
  attacks: { stomp: { tele: 0.9, dur: 1, start(e, w) {...}, tick(e, w, t, dt) {...} } },
  weakBox(e) { return { x0, y0, x1, y1 }; }, // absolute px rect that takes full damage right now, else armour chips 20%
};
```

* Every attack telegraphs for at least `MIN_BOSS_TELE` (0.6 s); the tests read every def and fail otherwise.
* A boss may fly: give it a `move(e, w, dt)` of its own (no gravity) and set `e.tgt`/`e.fs` to ease toward a point (the
  Dragon Kite Fortress hovers 56 px above the deck and is shot from below). Bosses with a tall weak point are fought
  with the `'ledge'` or `'under'` bot style (`tools/bossbot.js`) and the tests pick the style per boss (`STYLE`).
* Helpers for attack scripts: `bossShoot`, `shockwave` (jump it), `geyser` and `dropRock` (a floor marker warns first),
  `warnMark`, and `world.after(sec, fn)` timers.
* The level calls `b.bossArena('trex')`: reaching the trigger locks the camera, sweeps the other enemies and spawns the
  boss at the arena's right edge. A clean kill (no deaths in the fight) pays an extra life.
* A boss whose weak point is a rider above the body (the Chariot Champion) sets `h` tall enough for shots to reach it
  and `contactH` short, so only the body hurts on touch (`Enemy.contactBox`).
* Week 10 bosses: the Siege Tower Titan (a low ram port that is open only while it rests: `'ground'` style), the Oni
  Warlord (its gem is out of reach of a standing shot: fight from a ledge, `'ledge'`) and the Ghost Galleon (a figurehead
  lantern at the bow, hooded during ghostfire and the maelstrom; broadsides fire a low ball to jump and a high ball to go
  prone under). Their art lives in `art/bosses_w10.js`.
* Week 11 bosses: the Armored Locomotive (smokebox door open for gatling, coal and outlaws, shut behind steam and the
  derail surge: `'ground'`), the Iron Furnace Engine (mouth open for the belch and the workers, shut for pistons, slag and
  overload: `'ground'`) and the War Zeppelin (a flyer: the gondola is a low target for a soldier on the floor, covered during
  bomb runs, gas and the barrage: `'under'`). Their art lives in `art/bosses_w11.js`.
* Week 12 boss: the Super-Heavy Tank. Its driver port is a low target for a standing soldier, open while it idles, hoses
  from the roof gun or unloads troops, and shut behind the twin cannons (a LOW shell at floor-9 to jump, a HIGH shell at
  floor-22 to go prone under: the low one hits a prone soldier too), the mortar barrage, the crush shockwave and the phase-3
  flame columns (a gap is always left in the soldier's own column). `'ground'` style; art in `art/bosses_w12.js`.
* Week 13 bosses (`art/bosses_w13.js`): the Missile Silo Mech (a tall walker: the reactor core in its chest is above a
  standing soldier's shot, so fight from a catwalk, `'ledge'`; the shutters close for the missile salvo and the silo launch),
  the Gunship Helicopter (a flyer, `'under'`: the chin turret is the weak point from below and is closed while the rocket
  pods are out and during the carpet bombing) and the AI Core Hydra (three heads on necks, `'ground'`: the eye in its chest
  is open between attacks and shut for the sweep and the laser storm; a head that lunges at a marked spot and sticks in the
  street is itself a target while it is stuck). The Hydra's `restPos` and `NECK_BASE` are exported so the painter and the
  attack code agree where a head rests.
* Week 14 boss: the **Rift Warlord** (`bosses/warlord.js`, art in `art/bosses_w14.js`), the last boss. Its Rift Heart sits at a
  standing soldier's gun height (`'ground'` style) but is covered by shutters except in the moments after it has spent an
  attack: open while it idles, while the blade is wedged in the floor after a `cleave` (a low shockwave each way to jump, then a
  `crescent` at chest height to go prone under), after a `blink` (it marks a spot behind the soldier, vanishes, reappears there
  and fires a fan after a beat) and while it roars for `summon` (two soldiers from forgotten ages, one at each screen edge);
  closed for `beams` (phase 2+: columns of rift light stab through marked spots one after another) and `nova` (phase 3: three
  expanding rings of bolts, each with a gap aimed at the soldier that moves from ring to ring). The weak box has to reach the
  body's front edge, or fast bullets are spent on the armour before they reach it. Its music is the `finale` track
  (`level.bossMusic`).
* A **boss rush** is a level with more than one boss arena (Level 20). `LevelBuilder.echoArena(type, {hp})` adds an arena to
  `level.rush` (the level's own `bossArena` stays last, so the solver still ends at the final trigger). `World.arenas` lists them
  in order and `World.bossArena` is the one being fought or next: every boss script reads its arena bounds from `w.bossArena`,
  never from `level.boss`, and a world that starts inside an arena (a Continue from a checkpoint) begins at that arena. An
  **echo** is a weaker copy of an old boss (`bosses/echoes.js`: the same def with its own id and an `ECHO:` name, in a separate
  registry so the 40 hit point rule for real bosses does not apply; the arena sets its health). When one falls, `boss.js`
  `finish` emits `bossDefeated` with `echo: true`, calls `World.nextArena()` (frees the camera lock, re-arms `checkBoss`)
  and does not clear the level; only the last boss does. The stage ahead of an echo arena keeps its soldiers
  (`checkBoss` only sweeps spawns behind the arena). The play scene plays the ordinary boss theme for an echo and brings the
  level's music back afterwards, and pays 2,000 points (5,000 for a clean fight) instead of a FLAWLESS life.
  `tools/bossbot.js fightBoss(level, {arena, rush})` fights any arena or the whole rush.
* Bosses are drawn per frame by `art/bosses.js` in boss-local coordinates (feet-centre origin, +x forward, mirrored
  automatically), so a pose is a few `brush` calls driven by the attack state.
* `tools/bossbot.js` fights a boss with an ideal player; the tests require a kill time of 40-120 s and the phases
  to arrive in order.

## Era weapons

One era weapon per group of four levels (Fire Spear, Ballista Bolt, Crossbow Volley, Tesla Coil, Plasma Cannon; all five
exist, and the Plasma Cannon is in from Level 17). The Crossbow Volley is a fan of three quarrels (3.6 damage
per volley). The **Plasma Cannon** (`plasma.js`, era 4: levels 17-20) fires a fast `armorPierce` bolt that passes through one
enemy (`pierce: 1`) and bursts in a `PLASMA_R` splash (`plasmaBurst`) that hurts the other ordinary enemies around the one hit
(never the one that was hit, hidden ambushers, or a boss). A level
places an `'E'` capsule or pickup and `spawnPickup` turns it into the weapon of the level it is in (`eraWeaponFor`), so
the same level code works in every era. An era weapon has `letter: 'E'`, an `era` group number and an `item` id used for
its badge. Boss fights are calibrated with the rifle (40-120 s ideal kill time) and the tests require the era weapon to
shorten them.

## Ending and credits

The last level's results screen goes to the `ending` route (`scenes/ending.js`): four story pages that type themselves out
(fire completes a page, then turns it), then the final tally. Opening the tally pays the game-clear bonuses once
(`endingBonus`: 50,000 for finishing, 25,000 for using no continue, 100,000 for no deaths at all) and shows deaths, continues,
total time, difficulty and a rank (`endingRank`: S no deaths, A no continue and at most 15 deaths, B at most one continue, C).
`save.markCleared()` counts the clear (shown on the main menu). The tally leads to `credits` (`scenes/credits.js`), a scrolling
list built from the level and boss registries (`creditsScript`; a test keeps `BOSS_ORDER` in step with the level scripts) that
ends in `runEnd` (the high-score entry when the final score qualifies, otherwise the menu). The main menu's CREDITS entry plays
the same scene and returns to the menu.

## Music

`engine/music.js` is pure: a track (see `game/tracks.js`) is tempo, key, scale and a few bars of text patterns per voice
(lead, harmony, arpeggio, bass style, drums). `trackBar(track, bar)` returns that bar's note events; the Web Audio
scheduler in `engine/audio.js` plays them 0.3 s ahead of the audio clock with oscillators (pulse waves use a
`PeriodicWave` with the right duty cycle) and noise-buffer drums, and `renderTrack` renders the same events to PCM for
tests and `npm run musicwav`. A scene picks its track with a `music` property (`null` = silence, missing = keep what is
playing); `PlayScene` switches to the boss track on `bossStart`, stops it on `bossDying`, and ducks it while paused.

**Song form (Week 15).** The data of a track is one loop, but the song plays `passes` of them (default 4) and each pass is
arranged by pure rules in `arrange()`: **A** the loop as written, **B** the lead doubled an octave up in the second half,
**C** a breakdown (no kick, snare or lead in the first half, arps and harmony pushed forward, then a rising snare roll
back in) and **D** the finale (lead doubled throughout, harmony and open hats pushed). Every pass ends with a drum fill.
`trackBars` is still the length of the data, `songBars` / `songSeconds` the length of the whole song, and `trackBar(track,
bar)` takes a bar number of the song (it wraps). A 14-second loop becomes a ~55 second song, a 32-second one ~2 minutes,
with no extra pattern data. Notes that would be shrill (above MIDI 96) are not doubled.

## Dark levels

A theme with `dark: true` (the caves) draws a veil over the finished frame (`art/darkness.js`). It is a grid of 4 px cells
whose strength falls off around light sources: the player's lantern (it flares for a moment with every shot), bullets
(the Fire Spear lights its flight), explosions, burning enemies, enemy glow (`def.glow`), pickups, checkpoints, lava and
spikes, and torches from `level.lights` (`s.torch(dx, row, radius)` in the builder). The veil stops at 82% so shapes stay
readable.

## Zones and hazards

`LevelBuilder` zones change the rules of a stretch of level: `autoscroll(x0, x1, speed)` (the camera has a minimum speed
and drags a stalled player; a fast player can pull ahead) and `lavaRise(x0, x1, {endRow, interval})` (lava floods one
row per interval from the bottom once the player enters, with a rumble one second ahead). The solver judges a lava
zone by its final terrain, so a level only passes if a route exists once the lava has finished rising. Ice
(`T.ICE`) is solid and slippery; `faller` enemies (icicles) shake for 0.7 s before dropping and can be shot down.

Week 8 added more zones. `quicksand(n)` slows the soldier to 45% and drowns them after 2.6 s standing in it
(`MAX_QUICKSAND_TILES` keeps every crossing inside that). `chariot(x0, x1, speed)` is an autoscroll with a cosmetic
car under the soldier. `arenaWaves(waves)` makes a one-screen flat arena: the camera slides onto it and locks, the
waves run in from the left/right edges (or appear in place with `dx`/`y`, for archers on ledges) one wave at a time,
and the lock lifts when the last wave is dead (`World.updateArena`: idle -> locking -> fighting -> done; a player who
starts past it skips it). Waves must stay at or below the level's enemy cap; the test bot fights them with
`Bot.hunt`.

Set dressing (`b.prop('mast' | 'prow' | 'banner', col, opts)`, drawn by `art/props.js`) changes nothing in play.

Week 9 added `swells(x0, x1, {period, speed})` (longship decks): while the soldier is inside, a surf wave rolls in from
the right edge at deck height every `period` seconds and has to be jumped like a shockwave. Solid blocks stop it, so a
bulwark is cover. Keep the zone's decks at one height (the swell travels at the height the zone was built at).

Week 10 added three more mechanics. `barrage(x0, x1, {period, volley, spread, fuse, first})` (catapult fire): off-screen
catapults lob flaming boulders (`launchRocket` with `kind: 'boulder'`) onto spots the soldier cannot avoid by standing
still; a floor mark shows each landing `fuse` seconds ahead, the first boulder is aimed at the soldier's x and the others
fan out by `spread`, so a soldier who keeps moving is safe. `shaft({w, h, through})` (levels with `wallJump: true`, which
`finish()` also sets whenever a level contains a shaft) builds a stone tower with a hollow at most three tiles wide
(`MAX_SHAFT_TILES`): pressing jump while touching a wall in mid-air kicks the soldier up (`WALL_JUMP_V`) and away
(`WALL_KICK`) with a short steering lock (`WALL_LOCK`), and a wall slide caps the fall speed. The shaft registers a
`'wall'` solver link, which the bot follows with `climb()`. `swing(gap, {len, period, plank})` (rope swings, for gaps of
6 to 14 tiles, wider than a jump): a plank on ropes swings like a pendulum (`swing.js`; `World.platforms`), landing and
carrying works like any moving platform, and the solver link is `'swing'` (the bot waits at the edge and `ride()`s).

Week 11 added the Tesla Coil and two more hazards. The **Tesla Coil** (`tesla.js`, weapon `tesla`, era 3: levels 13-16) fires a
short fast bolt whose `onHit` is `chainZap`: the bolt arcs on to up to `CHAIN_HOPS` (2) of the nearest visible,
non-boss enemies within `CHAIN_RANGE` (78 px) for `CHAIN_DMG` each, drawing a jagged `zap` effect (hidden ambushers and bosses are
never chained). `vent(col, {period, tele, hold, height, phase})` places a steam vent: it sleeps off screen, then every
`period` seconds a floor mark flashes for `tele` seconds (never under 0.6) and a column of scalding `steam` bursts for `hold` seconds
(art in `art/props.js drawVents`). `barrage(..., {gas: true, linger})` turns the catapults into artillery: the shell
(`launchRocket` with an `onBurst` callback) leaves a `gasCloud` of lingering `gas` puffs instead of sparks. A shell that
lands on the soldier is a direct hit. `autoscroll` is used for the Desert Train, where the camera rolls on across the car roofs.

Week 12 added the **rideable tank** (`tank.js`, `TANK` in `constants.js`). `LevelBuilder.tankRoad(x0, x1, {supply, dismount})`
checks that the stretch is level, solid and free of pits, spikes and blocks, then registers a `tank` zone and a tank pickup. A
soldier on foot who walks into the first three columns climbs in (`Player.mountTank(road)`), and a soldier who respawns inside the
zone is handed a fresh tank (`World.supplyTank`); at the far end of the road `leaveTank()` puts them back on foot. A tank is
remembered with its road (`player.tankRoad`), so a spare tank picked up elsewhere (`pickups.js`, `'tank'`) is never taken away. In a
tank the soldier is 28x20, drives at 92 px/s, hops instead of jumping and cannot go prone, drop through platforms or wall jump, and
fires `TANK_GUN`: a slow shell (`kind: 'tankshell'`) whose `shellBlast` splashes other ordinary enemies (never a boss). Armour
works in `World.hurtPlayer`: `hitTank(world, cause)` absorbs a bullet, blast or touch (four per tank, a one-second grace after each),
the fourth wrecks the tank and throws the soldier clear with `EJECT_INVULN`; `fell` and `quicksand` still kill. `crushable(world, e)`
flattens any enemy def marked `crush` that the tank touches, without a scratch. `barrage(..., {shell: true})` makes the catapults
naval guns (`launchRocket` with a sparks burst). The HUD shows `TANK` with four pips and `art/tank.js` draws it and the parked one.

Week 13 added three mechanics and one weapon (above). **Searchlights and the alarm** (`stealth.js`): `searchlight(xa, xb,
{tower, height, period, phase, reach, troop})` needs one flat stretch (the builder checks every column) and registers a
`'searchlight'` zone. A pool of light (`STEALTH.RADIUS`) sweeps along the ground between the two columns (`beamX`, a sine of
the world clock); it only lights the strip `STEALTH.BAND` above the ground (a soldier on a high ledge is in the dark) and
`clearLine` raycasts from the lamp, so a solid block throws a shadow. `STEALTH.SPOT_TIME` (0.45 s) standing in the light fills
a meter (it drains twice as fast out of it) and `raiseAlarm` rings: `world.alarmT` runs for `ALARM_TIME` seconds, every
shooter's timer counts down `FIRE_BOOST` faster, sleepers wake, and two snow troopers run in from the screen edges if there is
room under the enemy cap; the alarm cannot ring again for `COOLDOWN` seconds. A quick dash through the light does not fill the
meter. **Gravity halls** (`flipHall(n)`, at least 14 columns on flat ground): a ceiling slab over a floor of spikes, two bare
columns at each end; while the soldier is inside, `World.updateGravity` flips `player.gdir` to -1 so they fall up, walk the
ceiling's underside and fall back down when they step out (aim stays screen-relative; a tank or hoverbike is never flipped).
The hall registers a `'flip'` solver link, which the bot crosses with a run-up. The **hoverbike** (`bike.js`, `BIKE`):
`hoverRun(n, {speed})` registers a `'hover'` zone, which is an autoscroll (the camera may be dragged on faster by a bike that
pushes right) plus a boarding pad in its first three columns: a soldier on foot climbs on (`Player.mountBike`), flies anywhere
inside the screen (`updateFly`; scrolling it into a wall is a `crush` hit), and sets down on foot at the far end. It has two
hits of armour (`hitBike`, like the tank's), a wreck throws the soldier clear unhurt, and a soldier who respawns inside the zone
is handed a fresh bike (`supplyBike`). `beam(col, {from, length, period, tele, hold, phase})` is a laser emitter: a floor mark
flashes for `tele` seconds (never under 0.6), then a column of ghost `beam` bullets stabs for `hold` seconds.

**Tower levels** climb instead of run: the stage is one screen wide and `rows` tall, the camera follows y
(`Camera.tall`) and the level ends at `exitTop(row)` or in a `bossArenaAt(type, row)` whose floor has a one-way entry
strip. The solver and the bot use `goalY` for them, and stragglers left far below the climb are despawned so they
cannot crowd the screen.

## Slopes

Ten tile ids (`T.RAMP45_*`, `T.RAMP22_*_LO/HI`, `T.STEEP_*_LO/HI`) are walkable ground whose surface is a line across the
cell. The suffix names the side that rises. The angles are nominal: the geometry is 1:2, 1:1 and 2:1, because that is what a
16 px grid can express. A 22-degree ramp climbs one tile over two cells (LO, HI); a steep slope climbs two tiles over one
column (the LO cell sits under the HI cell).

- `tiles.js`: `SLOPE` and `STEEP` tables (slopes are deliberately **not** in `SOLID`, so the X sweep never treats them as walls),
  `floorHeight(id, localX)` (surface height above the cell bottom, 0..16, `-1` for a non-slope) and `uphillDir(id)`.
- `physics.js`: `surfaceAt(world, px, py)` returns the surface under a pixel column; `solidPoint` and `rectSolid` test a slope
  against its line (bullets pass through the empty triangle above a ramp); `floorNear` is the slope-aware "is there footing
  ahead" probe the walkers use. `moveBody` does four extra things, **all gated on `world.hasSlopes`** so a level without ramps
  simulates exactly as before: it walks up the lip where a slope meets level ground (a wall that is no taller than
  `SLOPE_STEP`, or half the body's width plus 2 for a wide tank), lifts the feet onto the surface after the X move, follows the
  ground down so a walker stays grounded on a descent, and slides a grounded body down a steep slope at `STEEP_SLIDE`.
  Walking into a steep slope uphill is a wall (the soldier has to jump it). The hoverbike ignores slopes.
- `levelgen.js`: `b.slope(dh, { angle })` (`dh` > 0 climbs, < 0 falls; angle 22, 45 or 67) lays the cells and the solid fill under
  them, keeps `surfacePx[x]` (the line's height at the middle of each column) so `groundY`, enemies, props and vents sit on the
  slope, and exports `level.ground` (px per column, -1 over a pit). It refuses a steep climb taller than a jump (a steep slope
  up is a ledge: the soldier slides back down it), and `requireLevel` makes checkpoints, spikes, blocks, tank roads, searchlight
  sweeps, gravity halls, swells and barrages refuse a slope. Boss and wave arenas are laid with `flat()`, so they stay level.
- `solver.js`: a slope cell is a spot with its own surface line (`lx,ly`-`rx,ry`, centre `cx,fy`). `joinKind` joins spots whose
  surfaces meet end to end: a `walk` between ordinary ones, a one-way `slide` into, down and out of a steep slope (never
  up). On a level with slopes the search runs in layers where walking and sliding are free, so the route walks a ramp rather
  than leaping over it. `simulate` mirrors `moveBody` (lift onto a ramp, a steep face is a wall, a jump lands on the line).
- `tools/bot.js` matches the soldier to a route node with `standingOn` (a slope node is a whole cell, so the feet only have to be
  inside its rows) and jumps when pressed against a steep face.
- `ascii.js` draws them in tests: `/` and `\` are 45 degrees, `1 2` / `4 3` the 22-degree pairs, `5 6` / `7 8` the steep ones.

## Levels

Levels are short scripts for `LevelBuilder` (`levelgen.js`), not hand-drawn grids:

```js
const b = new LevelBuilder(def);
let s = b.flat(30);             // ground
s.enemy('raptor', 20);          // 20 tiles in
b.pit(3, { fill: 'spikes' });   // refuses anything wider than the player can jump
b.up(2);                        // refuses steps taller than the player can climb
b.exit();
return b.finish();
```

`solver.js` uses the player's real movement numbers (with a 7% safety margin) to find every standable tile and every
walk / jump / fall / drop between them, then searches from the spawn to the exit. The tests require every level to be
solvable, every checkpoint and pickup to be reachable, and `tools/bot.js` to cross the level in god mode with zero
falls and zero hazard touches.

## Nature art

The terrain and backdrop try to look like land, not a tile map. Phase by phase:

**Terrain** (`art/tilepaint.js`, `art/tilelayer.js`, `art/relief.js`)
- Every slope id has a sprite in every theme: the ground's own texture cut along the slope's line one pixel column at a time, a cap
  (grass, snow, a lit edge) following the diagonal, and growth on top. The steep slope's low cell caps only the half where the
  surface is (the other half is buried by the cell above it). Slope ids count as filled for the neighbour masks, so there are no
  edges or caps between a ramp and the ground beside and under it.
- `theme.tiles.solid` may carry `fringe` and `under` (`{ shape, c }`; shapes in `relief.js`: `FRINGES` grass, snow, sand, moss,
  rubble, weed and `UNDERSIDES` roots, icicle, stalactite, drip, vine), and `sub` / `deep` strata colours. A fringe is a 16x8 strip
  drawn into the cell above an exposed top; an underside is a 16x8 strip hung below an open bottom. Only open air (or a liquid,
  which is drawn over live) takes growth, so spikes and platforms are never painted over.
- Strata: a ground tile's sprite depends on how many ground tiles lie above it (`strataBand`: topsoil 0-1, subsoil 2-5, bedrock 6+),
  with stones, roots and the odd fossil embedded. Earth, rock and sand also lose their exposed top corners (a 2 px chamfer).
- The sprite cache key is `theme|id|mask|variant&3|band`, and painters receive the masked variant, so the picture never depends
  on which cell happened to ask first.
- `patchTileLayer` wipes and repaints the 3x3 block around a changed cell plus the column of ground under it (its band changes),
  then repaints the cells just above and below (their strips reach into the wiped cells). Sprites have transparent corners now,
  so a repainted cell must be wiped. A test compares every patch with a full rebuild byte for byte.
- `art/warm.js` warms the fringe and underside strips and decor sprites of every theme (`relief <theme>` tasks); the tile
  sprites themselves are painted when the level's terrain is baked, as before.

**Backdrop** (`art/noise.js`, `art/scenery.js`, `art/scenery_nature.js`)
- `noise.js` holds the one-dimensional noise every landform is cut from, all of it wrapping over the 480 px width: `wrapNoise`,
  `ridged` (folded octaves: sharp crests, round valleys), `warped` (domain warp), `smooth`, `gullies` (rain channels) and `terraced`.
- The natural painters in `scenery_nature.js` join the older ones in `PAINTERS`: landforms `ridges` (lit and shadowed faces, snowline,
  forest teeth at the foot), `mesa`, `spires` (hoodoos and sea stacks), `arches` (a window cut with `clearRect`), `canyon`; plants
  `forest` (a weighted mix of species: oak, conifer, birch, palm, cycad, baobab, bush, willow, cypress, dead) and `reeds`; water
  `waterfall` and `lake`; and sky furniture `cumulus`, `stratus`, `cirrus`, `celestial` (sun or moon with dithered halo rings),
  `rays`, `fogbank` and `aurora`. A theme's `layers` list is 4-6 of these, far to near, each with its own scroll speed `s`.
- Rules: the sun, the moon and the aurora are layers, never part of `skyCanvas` (a test requires the sky canvas to hold only the band
  colours). Soft edges are an ordered dither (`dithered`), not `globalAlpha`: a test requires every painted pixel to be opaque, because
  Chromium and the software canvas blend alpha slightly differently and the parity check allows only 0.1 % of pixels to differ.
- Anything the random stream places is drawn through `placeWrapped`, which paints it again one screen over when it is near an edge,
  so no tree or tower is cut off where the layer tiles (the older painters were changed to use it too).
- `hazed` (the far-layer fade into the sky colour) now tints every colour a layer carries (snow, roof, windows, rock bands) and skips
  the sky's lights and weather (`NO_HAZE`).
- `fallRect(layer)` gives the rectangle of a waterfall's falling water, so the animated shimmer can be drawn over exactly that.

## Art

All art is drawn with rectangles by `Painter`, so it renders identically in a browser and in the software canvas used
by tests and `npm run shots`. Terrain is pre-rendered once into a tile layer. When tiles change (rising lava over ground)
`World.setTile` records the cell and `getTileLayer` repaints just that cell and its neighbours in place; swaps among air,
water and lava never touch the baked art, and a flood of changes falls back to one rebuild. The tests check the patched
layer is byte-identical to a full rebuild. A theme bundles sky bands, parallax layers, tile palettes, decor, liquids and an
ambient particle effect.

## Polish: input, effects and performance (Week 15)

**Input.** `padActions(pad)` is a pure function from a gamepad to logical actions: a radial dead zone (0.3), eight
direction sectors for the stick (so a diagonal gives two directions and a thumb that drifts off-axis gives none), the
d-pad, and analogue triggers counted past half way. `Input` also owns the focus rules: losing the window, hiding the tab
or unplugging the pad releases every held key and calls `requestAutoPause()`; `Game.step` hands that to the scene's
`onAutoPause()` (the play scene opens its pause menu; menus ignore it, and a request never leaks into the next level).
`F` / `F11` (fullscreen) and `M` (mute, which silences without touching the saved volumes) are hotkeys handled in
`main.js` through `input.onHotkey`. The on-screen touch controls follow `touchMode` (`auto` = after the first touch or on
a coarse pointer, `on`, `off`) which the options screen sets.

**Effects.** Particles draw their randomness from `world.fxRand`, a stream of their own, so cosmetics can never change what
the simulation does: a test plays 15 seconds at high and low quality and requires identical positions and an identical
gameplay random stream. `pushPx` enforces the particle budget of the quality option (`high`: 700 live particles; `low`: 160
and every burst halved, no dust or brass). New juice at high quality: dust when the soldier lands from a fall, brass
spat out by the rifle, machine gun and spread gun.

**Performance.** The simulation takes about 0.02 ms a step, so the budgets guard drawing. `art/warm.js` lists every lazy
cache fill (enemy and boss frame sets, parallax layers, player, effects, HUD, pickups) as a small task and `main.js` runs
a few milliseconds of them per frame while the title screen is up; nothing depends on it, an unwarmed sprite is painted
when first drawn. `tools/perfprobe.js` counts canvas calls and canvas creations per frame, `npm run perf` prints them per
level and boss, and `tests/integration/perf.test.js` pins the budgets (at most 2600 canvas calls in the busiest frame, and after the
warm-up no canvases created while playing apart from a handful of 16 px tile variants when lava changes a tile's
neighbours).

## Balance and release (Week 16)

**Lives economy.** The plan fixes the rules (3 lives, cap 6, 10 medals = a life, 20,000 then every 50,000 points, one hidden
1UP per era group, a life for a flawless boss kill) and one outcome: the average player has about 4 lives entering Level 13.
`tools/economy.mjs` reads the real level data (medals, 1UPs, placed enemies, boss points) and models the run for three
player types; `npm run economy` prints it. The useful number is the *break-even death rate*: the supply of lives pays for
about **2.0 deaths a level** (1.9-2.3 depending on how often a boss is beaten flawlessly), so an average player who dies
twice a level has ~4 lives at Level 13, a skilled one (about one death a level) sits at the cap, and a casual one (3-4
deaths) lives on Continues. The death rates are assumptions, not measurements: no human playtest has been done, so
`tests/unit/economy.test.js` pins the structure (five hidden 1UPs, one per era group; 6-25 medals a level; the break-even band)
rather than a guess about players, and a change to a level's medals shows up as a failing test with the new number.

**The shipped site** is `index.html`, `style.css` and `src/` (plain ES modules with relative imports, no packages).
`tests/e2e/release.test.js` follows every import from `src/main.js`, checks nothing leaves `src/` and nothing is bare, boots
`main.js` against a fake DOM (title -> menu -> play, auto-pause on blur, the F and M hotkeys, the warm-up) and checks the
README's level table against the game. `.github/workflows/ci.yml` runs `npm run coverage` (the same suite, failing under 98 % lines, 93 % branches or 97 % functions
of `src/`) on every push and pull request;
`pages.yml` runs the tests, copies the three paths into `_site` and deploys with the official Pages actions.

## Visual polish

Everything here is art or scene glue: the simulation only ever sets `e.flash` and pushes events, and cosmetic randomness
still comes from `world.fxRand`.

**Combat feel.**
* **Hit flash** (`art/hit.js`). `drawEnemy` and every custom painter start with `ctx = flashCtx(ctx, e)`. While `e.flash` is
  above 0.06 s (a boss: 0.04 s) the painter gets a view of the canvas that mixes every colour toward white (`SPRITE_MIX` 0.8,
  `BOSS_MIX` 0.5: a boss only brightens, because its weak points are read by colour) and swaps every image for `hitImage(img)`,
  a cached white copy made by `lightenedCopy` (`engine/gfx.js`, which reads pixels from the software canvas in Node and from
  `getImageData` in a browser). `warm.js` builds the copies for every enemy frame set. A new custom painter needs the one line.
* **Muzzle flash** (`fx.muzzle`): a core and a spike along the aim in the weapon's own `color`.
* **Kills** add a white pop ring and pieces in the enemy's own `pal` colours; bullets that hit a wall flash.
* **Respawn** draws a column of light (`fx.beamIn`).
* **Hit-stop and slow motion** live in `PlayScene`, never in the world: `HIT_STOP` frames of nothing moving on a player death
  (3), a boss phase change (4, from the `bossPhase` event) and a boss going down (5), then `BOSS_SLOWMO` seconds of the world
  stepping every other frame. Tests that wait out a death have to allow `HIT_STOP.death` frames of slack.

**World rendering.**
* **Sky** (`art/sky.js`): a theme's `sky` bands are blended into each other with a 4x4 Bayer dither (a quarter of a band either
  side of each edge) and built once into a 480x270 canvas, so `drawSky` is one `drawImage`. Only the theme's own colours appear.
* **Haze** (`scenery.js hazed`): `sceneryLayer(key, layer, theme)` mixes a layer's colour `c` toward the sky colour at its
  horizon, by `theme.haze` (default 0.35, `0` = off) times how far the layer is (scroll speed `s`; `s >= 0.5` is untouched). Clouds
  and stars are skipped. It happens when the layer is baked, so it costs nothing per frame.
* **Shadows** (`art/shadow.js`): two translucent rows under the soldier and every grounded, non-flying enemy, drawn before the
  sprites. Not in dark (cave) themes, where the veil does the shading. `def.noShadow` opts an enemy out.
* **Glow** (`art/glow.js`): a theme with `glow: true` (neon, megacity, citadel, cave, volcano, factory) gets a soft halo behind
  bullets, enemy shots and pickups at high effects quality. A halo is a cached disc, one `drawImage`. A new bullet kind should get
  an entry in `BULLET_GLOW` (the weapon's colour); without one it glows like the rifle.
* **Vignette** (`art/vignette.js`): 24 faint rings darken the screen edges (high quality only), and the same shape in red is the
  hurt flash for the first 0.45 s after a death (`world.deathT`). Both are cached overlays with their own warm-up task.

**HUD and onboarding.** `art/hud.js drawHud(ctx, world, run, extra)` draws; `extra` carries what only the scene knows
(`prompt`, `card`, `weaponLabel`, `intro`, `trail`), so the art still never changes anything.
* **Plates**: translucent dark plates (cached in `build()`) behind the lives, score and weapon-slot clusters.
* **Progress bar** (`game/progress.js levelProgress`, pure): the same goal the solver aims for (`exitX` or the boss trigger; for
  a tower `exitY` or `boss.triggerY`). Ticks for checkpoints (lit once reached), a skull per boss arena (a boss rush has several)
  and one at the end. Hidden during a boss fight and under any prompt, hint or title card.
* **Title card**: a band that wipes in from the left, holds and wipes out over `CARD_TIME`, with `LEVEL nn`, the name and the era.
* **Boss entrance**: while a boss is in its `enter` state `PlayScene.introK` eases to 1: letterbox bars and a name plate. The boss
  bar's **damage trail** is scene state too (`PlayScene.trail`: it holds `TRAIL_HOLD` after a hit, then drains).
* **Weapon label**: the name of the active weapon shows under the slots for 1.3 s whenever it changes (pickup, swap, the rifle
  coming back after a death). The last life's head bobs.
* **Toasts** (`scenes/toasts.js`): one banner at a time under the score, fed by `PlayScene.onEvent`: CHECKPOINT (this replaces the
  old floating popup), the era weapon, the ninth medal, LAST LIFE. Ordinary weapons already name themselves in a popup.
* **First-time hints** (`scenes/hints.js`): `HINTS` is a list of `{id, text, check(world, event)}`; `Hints.observe` queues one when
  its check passes (events, and `null` for a plain frame so a hint can watch state, as the tank and bike ones do). A hint shows
  once per save (`save.data.hints`, `markHint`/`hintSeen`), waits while a tutorial prompt or the level card is up, and uses the
  prompt banner. `{switch}`-style tokens are filled in with the current device's button names. Add new ones at `<<HINTS>>`.

**Accessibility and display options** (Options screen, saved in `save.data.options`; a save without them gets the defaults).
* **FLASHES: FULL / REDUCED** (`flashes`). `World.flashesReduced` is read only by the art and the camera: the smart bomb is a soft
  wash (at most 25% white) instead of a white-out, a hit flash is the sprite with its white copy faded over it (half as white),
  the red hurt flash after a death is off, the camera shakes half as hard, and every large-area blink goes through
  `flick(t, rate)` (`art/flash.js`), which caps it at 6 steps a second (three flashes a second, the usual photosensitivity limit).
  `renderWorld` sets the mode at the start of each frame. A new painter that blinks faster than that should call `flick`. Small
  sprite flicker (muzzle flashes, bullet shimmer) is not covered, and neither is hit-stop. SCREEN SHAKE stays an ON/OFF switch.
* **HUD SIZE: NORMAL / LARGE** (`hud`). `drawCorners` lays the lives/bombs/medals, score and weapon clusters out in
  `VIEW_W / k` and draws them under `ctx.scale(k, k)`, so large is a plain 2x of the same code. Large drops the HI line and shows
  the combo multiplier beside the score, and the boss bar is 150 px wide instead of 220 so it fits between the bigger corners.
  Toasts rest at y 64 (they would sit on the clusters at 36).
* **CRT FILTER: OFF / SCANLINES** (`crt`). A CSS overlay (`body.crt #stage::after` in `style.css`), never drawn on the canvas, so
  screenshots and tests are unchanged. `Game.applyDisplay()` calls `game.onDisplay(options)`, which `main.js` uses to toggle the
  class; `fit()` sets `--crt-px` and `--crt-top` so a dark line sits at the bottom of every game pixel row.

## Sprites

The second art pass: the actors (player, pickups, enemies, bosses) got outlines, shading and animation at the same sprite
sizes and hitboxes. Art only: nothing here reads or writes the simulation, and everything is still `fillRect` and `drawImage`.

**Baking** (`art/bake.js`). Painters draw flat rectangles; `bake(img)` is a pixel pass run once per cached frame (never during
play) that adds an outline (every transparent pixel touching the sprite becomes the neighbour's colour darkened toward ink) and
top-left light (an edge facing up lightens, an edge facing down or right darkens). The result is `PAD` (1 px) bigger on the left,
top and right, but **not** at the bottom, so feet stay on the floor row. `bakeFrames(f)` bakes every image in an enemy frame set
(`idle`, `run[]`, `hot` and extras such as the elephant's `rear`), keeps shared frames shared and moves the anchors: `ox + PAD`,
`h + PAD`, `w + 2 * PAD`. Blits go through `x - f.ox, y - f.h`, so nothing moves. `enemyFrames(def)` bakes whatever `build(def)`
returns, so **a new painter's cached frames are baked automatically**; do not bake them yourself. `turned(img)` (also in
`bake.js`) is the quarter-turn used by the death animation.

**Player** (`art/player.js`). Same 24x32 box. Two idle frames (breathing, picked from `world.time`), six run frames
(indexed by `pl.anim`), eight somersault frames, prone, and four tumble frames for the `corpse` fx. The arm and the gun are
drawn live along `pl.aimVec()` from `pl.shoulder()`. **Guns** (`art/guns.js`) are one sprite per weapon at five angles (-90, -45, 0,
45, 90 degrees), mirrored by `blit` for the other three of the 8-way aim; `GUN_ART` lists a gun as segments along the barrel and
ends in `<<GUN_ART>>`. An id without art draws the rifle. Recoil is derived from `pl.fireT` against the weapon's cooldown: for
the first 50 ms after a shot the gun is drawn 1 px back.

**Pickups** (`art/pickups.js`). Badges stay 15x15 because the HUD slots draw them. Each has a bevelled face and, for the era (E)
weapons, a small icon of its own along the bottom (`ERA_ICONS`). `drawPickup` plays a 6-frame glint sweep every 1.6 s (staggered
by x) with a twinkle, a 4-frame turning medal and a 2-frame beating heart. `warmPickups` builds every frame.

**Enemies** (`art/enemies.js`). The humanoid template has a back arm, shading, eye whites and a `hot` frame (bright, used for the
telegraph flicker like the other enemies' hot frames). Armed humanoids (`gun`, `sword`, `axe`, `bow`, `crossbow`, `thrower`) get a
live front arm (`holdArm`) and every thick weapon line goes through `olLine`, a line with a dark under-stroke. A gunner's gun
kicks back 1 px for a few frames after its telegraph ends (art-side memory in a `WeakMap`; the AI state goes straight back to idle).
**Death animation:** `killEnemy` pushes one `fall` fx (`fx.fall`: only for bodies, skipped for silent kills, turrets, mines,
bosses, hidden and ceiling enemies). It goes straight into `world.fx` like `corpse`, so effects quality cannot change the
simulation. `art/fx.js` draws the enemy's own idle frame white for 0.1 s, then tipped onto its back (`turned`, cropped to the
visible pixels, built by `warmFall` at warm-up), and blinks it out. Painters with a custom `draw` have no sprite to tip and show nothing.

**Bosses** (`art/bosses*.js`, `art/bossfx.js`). Bosses are still drawn live in boss-local coordinates, so they cannot be baked.
The brush has three more helpers: `B.part(x, y, w, h, col)` (outline, fill, lit top, shaded bottom: 4 calls) for masses,
`B.slab` (no outline) for inner panels and `B.stroke` for lines with an under-stroke. `bossfx.js` has the rest, all pure functions
of the pose and `e.bs.age`: `weakPoint` (bevelled housing; when open it pulses through `flick` in the boss's own colour and shows a
ring while the boss is hit, when closed it shows shutter slats; it is drawn at the rect `weakBox` uses, so the hitbox is unchanged),
`damageMarks` (cracks, missing plates, scorches, smoke and sparks that appear from phase 1 or 2), `breathe` and `blink` (idle life)
and `collapse` (the dying pose: sinks, chars toward black, and named parts fly off). While a boss is `dying`, `boss.js` also throws
scrap and smoke from `world.fxRand`. It must never call `world.rand` there: Level 20's echo rush continues after an echo dies.
Every boss's busiest frame must stay at or below 2300 canvas calls (`npm run perf`).

## Dev tools

* `npm run shots` - menu, play, pause, results... into `docs/screenshots`.
* `npm run themeshots [dir] [theme...]` - one frame per era theme.
* `npm run levelshots <index> [dir] [x...]` - the bot plays a level and photographs it at the given tile columns.
* `npm run bossshots <index> [dir] [scale] [style]` - a bot fights the boss and photographs each attack and phase.
  `style` is `ground` (stand and shoot), `jump` or `ledge` (climb an arena ledge: the Cave Bear Hive needs it).
* `npm run musicwav [track|all] [dir] [loops]` - render the soundtrack (the whole song form) to WAV files you can listen to.
* `npm run perf [level]` - simulation time and canvas-call counts per level, then per boss fight.
