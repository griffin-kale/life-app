// Die Hunderter: Wertung, Saisontage mit Jokern, Joker-Regeln, Verordnung von Claude. Alle Daten erfunden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOKER, bewerten, ersatzVerordnung, jokerErlaubt, pruefeVerordnung, raster, saisonEnde, saisonKalender, saisonTag, wert,
} from '../../lib/hunderter-regeln.ts';

const voll = { shop: 2, mail: 2, foerderung: 2, plattform: 2, admin: 2 };
const halb = { shop: 1, mail: 1, foerderung: 1, plattform: 1, admin: 1 };
const alle = [true, true, true, true, true];

test('Hunderter: Hälfte zählt 80 %, voll 100 %', () => {
  assert.equal(wert(0), 0); assert.equal(wert(1), 0.8); assert.equal(wert(2), 1); assert.equal(wert(3), 1);
  const h = bewerten({ content: 1, phasen: halb, leben: alle, verordnet: true });
  assert.deepEqual([h.prozent, h.zaehlt, h.voll], [80, true, false]);
  const v = bewerten({ content: 2, phasen: voll, leben: alle, verordnet: true });
  assert.deepEqual([v.prozent, v.zaehlt, v.voll], [100, true, true]);
});

test('Hunderter: ein leerer Bereich oder eine offene Leben-Aufgabe kippt den Tag', () => {
  const ohne = bewerten({ content: 2, phasen: { ...voll, plattform: 0 }, leben: alle, verordnet: true });
  assert.equal(ohne.zaehlt, false);
  assert.deepEqual(ohne.fehlt, ['1 Phase Plattform']);
  const leben = bewerten({ content: 2, phasen: voll, leben: [true, true, true, false, false], verordnet: true });
  assert.equal(leben.zaehlt, false);
  assert.deepEqual(leben.fehlt, ['2 Leben-Aufgaben']);
  const nichtVerordnet = bewerten({ content: 2, phasen: voll, leben: [], verordnet: false });
  assert.equal(nichtVerordnet.zaehlt, false);
});

test('Hunderter: Saisontag und Ende verschieben sich mit Jokern', () => {
  assert.equal(saisonEnde('2026-11-13', []), '2027-02-20');
  assert.equal(saisonEnde('2026-11-13', ['2026-12-24', '2026-12-25']), '2027-02-22');
  const zehn = Array.from({ length: 10 }, (_, i) => `2026-12-${String(20 + i).padStart(2, '0')}`);
  assert.equal(saisonEnde('2026-11-13', zehn), '2027-03-02');
  assert.equal(saisonTag('2026-11-13', '2026-11-12', []), 0);
  assert.equal(saisonTag('2026-11-13', '2026-11-13', []), 1);
  assert.equal(saisonTag('2026-11-13', '2026-11-29', ['2026-11-20']), 16);
  assert.equal(saisonTag('2026-11-13', '2026-11-20', ['2026-11-20']), 0);
  const k = saisonKalender('2026-11-13', ['2026-11-14']);
  assert.equal(k.length, 100);
  assert.equal(k[1], '2026-11-15');
});

test('Hunderter: Joker nur heute bis 10 Uhr, nie rückwirkend, höchstens zehn', () => {
  const s = '2026-11-13';
  assert.equal(jokerErlaubt('2026-12-24', '2026-11-20', 15 * 60, s, [], true), null);
  assert.equal(jokerErlaubt('2026-11-20', '2026-11-20', 9 * 60 + 59, s, [], true), null);
  assert.match(jokerErlaubt('2026-11-20', '2026-11-20', 10 * 60, s, [], true)!, /10 Uhr/);
  assert.match(jokerErlaubt('2026-11-19', '2026-11-20', 8 * 60, s, [], true)!, /vergangene/);
  const voll = Array.from({ length: JOKER }, (_, i) => `2026-12-${String(10 + i)}`);
  assert.match(jokerErlaubt('2026-12-24', '2026-11-20', 8 * 60, s, voll, true)!, /zehn/);
  assert.match(jokerErlaubt('2026-12-24', '2026-11-20', 8 * 60, s, [], false)!, /kein Joker/);
  assert.equal(jokerErlaubt('2026-12-24', '2026-11-20', 8 * 60, s, ['2026-12-24'], false), null);
  assert.match(jokerErlaubt('2027-03-01', '2026-11-20', 8 * 60, s, [], true)!, /nach dem Ende/);
});

test('Hunderter: Verordnung von Claude wird geprüft, Lücken füllt der Ersatz', () => {
  const v = pruefeVerordnung({ koerper: '20 Kniebeugen vor dem Frühstück', sozial: '<b>x</b>', mental: 'ok', geld: 42 }, 3);
  const e = ersatzVerordnung(3);
  assert.equal(v.koerper, '20 Kniebeugen vor dem Frühstück');
  assert.equal(v.sozial, e.sozial);
  assert.equal(v.mental, e.mental);
  assert.equal(v.geld, e.geld);
  assert.equal(v.zeit, e.zeit);
  assert.notEqual(ersatzVerordnung(1).koerper, ersatzVerordnung(2).koerper);
  assert.equal(pruefeVerordnung(null, 1).koerper, ersatzVerordnung(1).koerper);
});

test('Hunderter: Raster zeigt vergangene, heutige und kommende Tage', () => {
  const kal = ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'];
  const b = new Map([
    ['2026-11-13', bewerten({ content: 2, phasen: voll, leben: alle, verordnet: true })],
    ['2026-11-14', bewerten({ content: 1, phasen: { ...halb, admin: 0 }, leben: alle, verordnet: true })],
  ]);
  assert.deepEqual(raster(kal, '2026-11-15', b).map((z) => z.zustand), ['voll', 'nicht', 'heute', 'offen']);
});
