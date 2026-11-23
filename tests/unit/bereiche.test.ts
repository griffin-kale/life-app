// Eine Bereichsliste für ganz Life (0.33, MAYA): überall dieselben Wörter für dieselben Schlüssel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEREICHE, BEREICH_NAME, LEBENSBEREICHE, bereichName } from '../../lib/bereiche.ts';
import { KONTEN_L } from '../../lib/hunderter-regeln.ts';
import { BEREICH_TITEL } from '../../lib/saison-regeln.ts';
import { KONTO_NAME as KOMPASS_NAME } from '../../lib/kompass-regeln.ts';
import { KONTO_NAME as CHALLENGE_NAME } from '../../lib/hunderter-regeln.ts';
import { BEREICH_NAME as STANDORT_NAME } from '../../lib/standort.ts';

test('Bereiche: Arbeit, Körper, Ruhe, Menschen, Geld, Zeit', () => {
  assert.deepEqual(BEREICHE.map((b) => BEREICH_NAME[b]), ['Arbeit', 'Körper', 'Ruhe', 'Menschen', 'Geld', 'Zeit']);
  assert.deepEqual(LEBENSBEREICHE.map((b) => BEREICH_NAME[b]), ['Körper', 'Ruhe', 'Menschen', 'Geld', 'Zeit']);
  assert.equal(bereichName('geschaeft'), 'Arbeit');
  assert.deepEqual([...KONTEN_L], [...LEBENSBEREICHE]);
  assert.equal(bereichName('unbekannt'), 'unbekannt');
});

test('Bereiche: Saison, Kompass, Challenge und Standort nennen sie gleich', () => {
  for (const [k, v] of Object.entries(BEREICH_TITEL)) assert.equal(v, BEREICH_NAME[k as keyof typeof BEREICH_NAME], `Saison ${k}`);
  for (const [k, v] of Object.entries(KOMPASS_NAME)) assert.equal(v, BEREICH_NAME[k as keyof typeof BEREICH_NAME], `Kompass ${k}`);
  for (const [k, v] of Object.entries(CHALLENGE_NAME)) assert.equal(v, BEREICH_NAME[k as keyof typeof BEREICH_NAME], `Challenge ${k}`);
  for (const [k, v] of Object.entries(STANDORT_NAME)) assert.equal(v, BEREICH_NAME[k as keyof typeof BEREICH_NAME], `Standort ${k}`);
});
