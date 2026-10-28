// Persistence in real browser storage (key `epoch-strike-save-v1`, src/game/save.js): options changed through the
// options screen and a high score survive a reload; a corrupt saved value boots the game with defaults; and when
// localStorage refuses writes (QuotaExceededError, private mode) the game still reaches a level and the player still
// moves.
import { test, expect } from './fixtures.js';

const SAVE_KEY = 'epoch-strike-save-v1';

async function toMenu(g) {
  await g.open();
  await g.waitForScene('TitleScene');
  await g.page.waitForTimeout(300);
  await g.press('Enter');
  await g.waitForScene('MenuScene');
}

async function startLevel(g) {
  await toMenu(g);
  await g.press('Enter'); // START
  await g.waitForScene('PlayScene');
}

const savedOptions = (g) => g.page.evaluate(() => ({ ...window.__game.save.options }));
const rawSave = (g, key = SAVE_KEY) => g.page.evaluate((k) => localStorage.getItem(k), key);

test('options changed on the options screen and a high score survive a reload', async ({ gamePage: g }) => {
  await toMenu(g);
  // menu: START, (CONTINUE is disabled and skipped), LEVEL SELECT, OPTIONS
  await g.press('ArrowDown');
  await g.press('ArrowDown');
  await g.press('Enter');
  await g.waitForScene('OptionsScene');
  await g.press('ArrowLeft'); // SFX 0.8 -> 0.7
  await g.press('ArrowDown');
  await g.press('ArrowDown');
  await g.press('ArrowRight'); // DIFFICULTY normal -> hard
  const changed = await savedOptions(g);
  expect(changed.difficulty).toBe('hard');
  expect(changed.sfx).toBeCloseTo(0.7, 5);

  await g.page.evaluate(() => window.__game.save.addScore('ABC', 12345, 3));
  expect(JSON.parse(await rawSave(g)).scores[0]).toMatchObject({ name: 'ABC', score: 12345, level: 3 });

  await g.page.reload();
  await g.page.waitForFunction(() => window.__game && window.__game.scene);
  expect(await savedOptions(g)).toEqual(changed);
  const scores = await g.page.evaluate(() => window.__game.save.scores.map((s) => [s.name, s.score]));
  expect(scores).toEqual([['ABC', 12345]]);

  // the best score the title screen shows comes from storage
  expect(await g.page.evaluate(() => window.__game.save.best)).toBe(12345);
});

test('a corrupt saved value boots the game with default options', async ({ gamePage: g }) => {
  await g.page.addInitScript((k) => localStorage.setItem(k, '{this is not json'), SAVE_KEY);
  await g.open();
  await g.waitForScene('TitleScene');
  expect(await savedOptions(g)).toMatchObject({ sfx: 0.8, music: 0.6, difficulty: 'normal', shake: true, fx: 'high' });
  expect(await g.page.evaluate(() => window.__game.save.scores)).toEqual([]);
});

test('well-formed JSON with nonsense values boots with defaults for those values', async ({ gamePage: g }) => {
  const junk = { version: 1, unlocked: 'many', options: { sfx: 'loud', difficulty: 'nightmare', fx: 7 }, scores: [{ score: 'x' }, null, 5] };
  await g.page.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(junk)]);
  await g.open();
  await g.waitForScene('TitleScene');
  expect(await savedOptions(g)).toMatchObject({ sfx: 0.8, difficulty: 'normal', fx: 'high' });
  expect(await g.page.evaluate(() => window.__game.save.unlocked)).toBe(0);
});

for (const [name, onlySaveKey] of [
  ['every localStorage write throws QuotaExceededError', false],
  ['only writes of the save throw QuotaExceededError', true],
]) {
  test(`the game stays playable when ${name}`, async ({ gamePage: g }) => {
    await g.page.addInitScript(
      ([k, only]) => {
        const real = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (only && key !== k) return real.call(this, key, value);
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        };
      },
      [SAVE_KEY, onlySaveKey],
    );
    await startLevel(g); // starting a level writes the mid-run save, which must fail quietly
    await g.page.waitForFunction(() => window.__game.scene.world);
    const before = await g.playerState();
    await g.hold('ArrowRight', 600);
    expect((await g.playerState()).x).toBeGreaterThan(before.x + 10);
    expect(await rawSave(g)).toBeNull();
  });
}
