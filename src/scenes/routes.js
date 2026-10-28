// Scene routes: name -> factory. Registered once so scenes can switch with game.go('name', params)
// and tests can drive the same flow as the browser build.

import { TitleScene } from './title.js';
import { MenuScene } from './menu.js';
import { PlayScene } from './play.js';
import { GameOverScene } from './gameover.js';
import { ResultsScene } from './results.js';
import { OptionsScene } from './options.js';
import { ControlsScene } from './controls.js';
import { HighScoresScene } from './scores.js';
import { LevelSelectScene } from './levelselect.js';
import { NameEntryScene } from './nameentry.js';
import { EndingScene } from './ending.js';
import { CreditsScene } from './credits.js';

export function registerRoutes(game) {
  const r = game.routes;
  r.title = () => new TitleScene(game);
  r.menu = () => new MenuScene(game);
  r.play = (p) => new PlayScene(game, p);
  r.gameover = (p) => new GameOverScene(game, p);
  r.results = (p) => new ResultsScene(game, p);
  r.options = (p) => new OptionsScene(game, p);
  r.controls = () => new ControlsScene(game);
  r.scores = (p) => new HighScoresScene(game, p);
  r.levelselect = (p) => new LevelSelectScene(game, p);

  // A finished run (game over with no continues, or the credits after the ending): clear the mid-run save, then take the
  // initials if the score made the top 10, else go back to the menu. Practice runs never score.
  const runEnd = ({ run }) => {
    game.save.clearResume();
    if (!run.practice && game.save.qualifies(run.score.points)) return new NameEntryScene(game, { run });
    return new MenuScene(game);
  };
  r.runEnd = runEnd;
  r.nameentry = (p) => new NameEntryScene(game, p);
  r.ending = (p) => new EndingScene(game, p); // story, final tally -> credits -> runEnd
  r.credits = (p) => new CreditsScene(game, p);
  return game;
}
