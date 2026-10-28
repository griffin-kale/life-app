import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIGRATIONEN, offeneSchritte, type Migration } from '../../lib/migrationen.ts';

const m = (nr: number): Migration => ({ nr, name: `m${nr}`, run: async () => {} });

test('offene Schritte kommen aufsteigend, erledigte fallen weg', () => {
  assert.deepEqual(offeneSchritte([2], [m(3), m(1), m(2)]).map((x) => x.nr), [1, 3]);
  assert.deepEqual(offeneSchritte([1, 2, 3], [m(1), m(2), m(3)]), []);
});

test('doppelte oder ungültige Nummern brechen ab', () => {
  assert.throws(() => offeneSchritte([], [m(1), m(1)]), /doppelte/);
  assert.throws(() => offeneSchritte([], [m(0)]), /ab 1/);
});

test('die echte Liste ist gültig und lückenlos ab 1', () => {
  const nrs = offeneSchritte([]).map((x) => x.nr);
  assert.deepEqual(nrs, MIGRATIONEN.map((_, i) => i + 1));
});
