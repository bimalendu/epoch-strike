# Credits

Epoch Strike uses **no third-party assets and no libraries**. Everything you see and hear is made by the code in this
repository, which keeps the project free to copy, host and change.

| Part | How it is made |
| --- | --- |
| Graphics: soldier, enemies, bosses, tiles, backdrops, effects, HUD | Drawn with rectangles and ellipses by `Painter` (`src/engine/gfx.js`, `src/game/art/`) at start-up |
| Lettering | A 5x7 bitmap font drawn by the game (`src/engine/font.js`) |
| Sound effects | Synthesised on the fly with Web Audio oscillators and noise (`src/engine/audio.js`) |
| Music | 23 tracks written as short text patterns (`src/game/tracks.js`) and played by a tiny tracker-style synthesiser (`src/engine/music.js`) |
| Level layouts | Written as short scripts for `LevelBuilder` and proved beatable by a solver (`src/game/levelgen.js`, `src/game/solver.js`) |
| Game engine | None: plain HTML5 canvas and ES modules, a fixed 60 Hz step, no build step |
| Tests and tools | Node's built-in test runner and a small software canvas (`tools/`), no packages |

## Hosting and tooling

* Source and hosting: GitHub (repository, Actions, Pages) - all free tiers.
* Built with Claude (Anthropic) working from the design plan and the 16-week sprint plan in `docs/`.

## Inspiration

The game is a love letter to the run-and-gun classics, above all Konami's *Contra*. No code, art, sound or level from
any of them is used here; the characters, enemies, bosses, music and levels are all original.

## Licence

MIT, see [LICENSE](LICENSE).
