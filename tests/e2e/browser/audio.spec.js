// Web Audio under a strict autoplay policy (Chromium launched with --autoplay-policy=user-gesture-required, the
// default users see): the AudioContext must not exist, or at least not be running, before the first gesture; the first
// key or pointer press creates it and gets it `running`; M silences the mix (sfx and music buses to 0, saved volumes
// untouched) and pressing M again restores it. The context is read through `window.__game.audio.ctx`. Firefox and
// WebKit ignore the Chromium flag but block audio before a gesture by default, so the same checks run there.
import { test, expect } from './fixtures.js';

test.use({ launchOptions: { args: ['--autoplay-policy=user-gesture-required'] } });

const ctxState = (g) => g.page.evaluate(() => { const c = window.__game.audio.ctx; return c ? c.state : null; });
const buses = (g) =>
  g.page.evaluate(() => {
    const a = window.__game.audio;
    return { sfx: a.sfxGain.gain.value, music: a.musicGain.gain.value, muted: window.__game.muted };
  });

test('no AudioContext is running before the first gesture, and a key press starts it', async ({ gamePage: g }) => {
  await g.open();
  await g.waitForScene('TitleScene');
  await g.page.waitForTimeout(500);
  expect(await ctxState(g)).not.toBe('running');
  expect(await g.page.evaluate(() => window.__game.audio.ctx)).toBeNull();

  await g.page.keyboard.press('Enter');
  await g.page.waitForFunction(() => window.__game.audio.ctx && window.__game.audio.ctx.state === 'running');
  expect(await ctxState(g)).toBe('running');
});

test('a pointer press also unlocks the audio context', async ({ gamePage: g }) => {
  await g.open();
  expect(await ctxState(g)).not.toBe('running');
  await g.page.mouse.click(100, 100);
  await g.page.waitForFunction(() => window.__game.audio.ctx && window.__game.audio.ctx.state === 'running');
});

test('M mutes the sfx and music buses and a second M brings them back', async ({ gamePage: g }) => {
  await g.open();
  await g.page.keyboard.press('Enter'); // the gesture that creates the context
  await g.page.waitForFunction(() => window.__game.audio.ctx && window.__game.audio.ctx.state === 'running');
  const loud = await buses(g);
  expect(loud.muted).toBe(false);
  expect(loud.sfx).toBeGreaterThan(0);
  expect(loud.music).toBeGreaterThan(0);

  await g.press('KeyM');
  expect(await buses(g)).toEqual({ sfx: 0, music: 0, muted: true });

  await g.press('KeyM');
  const back = await buses(g);
  expect(back.muted).toBe(false);
  expect(back.sfx).toBeCloseTo(loud.sfx, 5);
  expect(back.music).toBeGreaterThan(0);
});
