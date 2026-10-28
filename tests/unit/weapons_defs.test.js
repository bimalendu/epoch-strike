// Unit tests for the data side of src/game/weapons.js: era grouping, era-weapon lookup, the rifle fallback and the
// pickup-letter lookup, plus a field check on every weapon definition in the registry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, eraGroupOf, eraWeaponFor, weaponDef, weaponByLetter } from '../../src/game/weapons.js';

const ids = Object.keys(WEAPONS);

test('eraGroupOf maps four levels to each era group', () => {
  const expect = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
  assert.deepEqual(expect.map((_, i) => eraGroupOf(i)), expect);
});

test('eraGroupOf clamps a negative index (the testbed) to group 0', () => {
  assert.equal(eraGroupOf(-1), 0);
  assert.equal(eraGroupOf(-100), 0);
});

test('eraGroupOf clamps indices past level 20 to the last group', () => {
  assert.equal(eraGroupOf(20), 4);
  assert.equal(eraGroupOf(21), 4);
  assert.equal(eraGroupOf(999), 4);
});

test('eraWeaponFor returns the weapon whose era matches each level group', () => {
  for (let level = 0; level < 20; level++) {
    const id = eraWeaponFor(level);
    assert.equal(WEAPONS[id].era, eraGroupOf(level), `level ${level}`);
  }
});

test('eraWeaponFor handles out-of-range levels like the first and last groups', () => {
  assert.equal(eraWeaponFor(-1), eraWeaponFor(0));
  assert.equal(eraWeaponFor(25), eraWeaponFor(19));
});

test('the five era weapons are one per group', () => {
  const eras = ids.filter((id) => WEAPONS[id].era !== undefined).map((id) => WEAPONS[id].era).sort();
  assert.deepEqual(eras, [0, 1, 2, 3, 4]);
});

test('weaponDef returns the registry entry for a known id', () => {
  for (const id of ids) assert.equal(weaponDef(id), WEAPONS[id]);
});

test('weaponDef falls back to the rifle for unknown, missing or null ids', () => {
  assert.equal(weaponDef('unknown'), WEAPONS.rifle);
  assert.equal(weaponDef(undefined), WEAPONS.rifle);
  assert.equal(weaponDef(null), WEAPONS.rifle);
  assert.equal(weaponDef(''), WEAPONS.rifle);
});

test('weaponByLetter returns a weapon that carries that letter, for every weapon', () => {
  for (const id of ids) {
    const letter = WEAPONS[id].letter;
    const found = weaponByLetter(letter);
    assert.equal(WEAPONS[found].letter, letter, `${id} -> ${found}`);
  }
});

test('every non-era pickup weapon round-trips through its own letter', () => {
  for (const id of ids) {
    const w = WEAPONS[id];
    if (w.letter !== undefined && w.era === undefined) assert.equal(weaponByLetter(w.letter), id, id);
  }
});

test('the E capsule letter is shared by the era weapons only', () => {
  for (const id of ids) {
    if (WEAPONS[id].letter === 'E') assert.notEqual(WEAPONS[id].era, undefined, id);
  }
});

test('weaponByLetter returns null for an unknown letter', () => {
  assert.equal(weaponByLetter('?'), null);
  assert.equal(weaponByLetter('Z'), null);
  assert.equal(weaponByLetter(undefined), null);
});

test('PINNED: the empty letter belongs to the rifle, so weaponByLetter("") finds it rather than null', () => {
  assert.equal(weaponByLetter(''), 'rifle');
});

test('every weapon def has a name, a positive cooldown, a fire function, a sfx and colours', () => {
  for (const id of ids) {
    const w = WEAPONS[id];
    assert.ok(typeof w.name === 'string' && w.name.length > 0, `${id} name`);
    assert.ok(Number.isFinite(w.cooldown) && w.cooldown > 0, `${id} cooldown`);
    assert.equal(typeof w.fire, 'function', `${id} fire`);
    assert.ok(typeof w.sfx === 'string' && w.sfx.length > 0, `${id} sfx`);
    assert.match(w.color, /^#[0-9a-f]{6}$/i, `${id} color`);
  }
});

test('every weapon with a pickup letter has a one-character letter and a badge colour', () => {
  for (const id of ids) {
    const w = WEAPONS[id];
    if (!w.letter) continue; // the rifle's letter is empty: it is never a pickup
    assert.equal(w.letter.length, 1, `${id} letter`);
    assert.match(w.badge, /^#[0-9a-f]{6}$/i, `${id} badge`);
  }
});

test('era values, where present, are integers from 0 to 4', () => {
  for (const id of ids) {
    const era = WEAPONS[id].era;
    if (era !== undefined) assert.ok(Number.isInteger(era) && era >= 0 && era <= 4, id);
  }
});

test('the rifle exists, is the default weapon, and needs no pickup letter', () => {
  assert.ok(WEAPONS.rifle);
  assert.equal(weaponDef('rifle'), WEAPONS.rifle);
});
