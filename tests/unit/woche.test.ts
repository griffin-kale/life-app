import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rhythmen, wochenTage } from '../../lib/woche-regeln.ts';
import { freiAm, wochenTag } from '../../lib/kalender-regeln.ts';

test('sieben Tage ab Montag, auch über den Monatswechsel', () => {
  assert.deepEqual(wochenTage('2026-10-26'), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
});

test('freie Zeit: Überlappungen zählen einmal, Termine außerhalb nicht', () => {
  assert.equal(freiAm([]), 660);
  assert.equal(freiAm([{ von: 540, bis: 600 }, { von: 570, bis: 630 }]), 570);
  assert.equal(freiAm([{ von: 420, bis: 500 }, { von: 1100, bis: 1300 }]), 660 - 20 - 40);
});

test('ein Tag: Blöcke in Berliner Zeit, ganztägige als Titel', () => {
  const t = wochenTag([
    { beginn: '2026-10-27T08:00:00.000Z', ende: '2026-10-27T08:45:00.000Z', ganztag: false, titel: 'Call', art: 'arbeit' },
    { beginn: '2026-10-27', ende: '2026-10-28', ganztag: true, titel: 'Urlaub', art: 'privat' },
  ], '2026-10-27', 1);
  assert.equal(t.wt, 'Di'); assert.equal(t.nr, 27);
  assert.deepEqual(t.bloecke, [{ von: 540, bis: 585, titel: 'Call', art: 'arbeit' }]);
  assert.deepEqual(t.ganztag, ['Urlaub']);
  assert.equal(t.frei, 615);
});

test('Rhythmen: Punkte pro Tag, Texte ohne nackte Null', () => {
  const tage = wochenTage('2026-10-26');
  const leer = rhythmen({ tage, heute: tage[1], erledigt: {}, training: [], kraft: 0, kraftSoll: 3, ausdauerMin: 0, ruhe: [], kontakte: [], buchungen: [] });
  assert.equal(leer.length, 5);
  for (const r of leer) { assert.equal(r.an.length, 7); assert.ok(r.an.every((x) => !x)); }
  assert.equal(leer[1].text, 'Kraft 0 von 3');
  for (const r of leer.filter((x) => x.konto !== 'koerper')) assert.doesNotMatch(r.text, /\b0\b/);
  const voll = rhythmen({ tage, heute: tage[1], erledigt: { [tage[0]]: 2, [tage[1]]: 1 }, training: [tage[0]], kraft: 1, kraftSoll: 3, ausdauerMin: 40, ruhe: [tage[0], tage[0]], kontakte: [tage[1]], buchungen: [] });
  assert.equal(voll[0].text, '3 Aufgaben an 2 Tagen');
  assert.deepEqual(voll[0].an.slice(0, 3), [true, true, false]);
  assert.equal(voll[1].text, 'Kraft 1 von 3 · 40 Min. Ausdauer');
  assert.equal(voll[2].text, 'an 1 Tag, Ziel jeden Tag fünf Minuten');
});
