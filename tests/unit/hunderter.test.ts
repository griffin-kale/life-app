// Die Hunderter: Wertung, Saisontage mit Jokern, Joker-Regeln, Verordnung von Claude. Alle Daten erfunden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMAT_START, JOKER, STANDARDS_START, bewerten as bewertenNeu, ersatzVerordnung, formatAus, jokerErlaubt, jokerFuer, pruefeFormat, pruefeStandards,
  pruefeVerordnung, raster, saisonEnde, saisonKalender, saisonTag, wert,
} from '../../lib/hunderter-regeln.ts';

const voll = { shop: 2, mail: 2, foerderung: 2, plattform: 2, admin: 2 };
const halb = { shop: 1, mail: 1, foerderung: 1, plattform: 1, admin: 1 };
const alle = [true, true, true, true, true];
// Alte Form der Eingabe (Content plus fünf Phasen) auf die neue Form mit Werten pro Standard
const bewerten = (t: { content: number; phasen: Record<string, number>; leben: boolean[]; verordnet: boolean }) =>
  bewertenNeu({ werte: { content: t.content, ...t.phasen }, leben: t.leben, verordnet: t.verordnet });

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
  assert.match(jokerErlaubt('2026-12-01', '2026-11-20', 8 * 60, s, ['2026-11-25', '2026-11-26', '2026-11-27'], true, 3, 30)!, /Alle 3 Joker/);
  assert.match(jokerErlaubt('2026-12-20', '2026-11-20', 8 * 60, s, [], true, 3, 30)!, /nach dem Ende/);
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

test('Challenge: ohne gespeichertes Format gelten die Hunderter, Länge und Joker kommen aus der Zeile', () => {
  assert.deepEqual(formatAus({}), FORMAT_START);
  assert.deepEqual(formatAus({ name: 'Die Hunderter', tage: 100, joker: 10, standards: null }).standards, STANDARDS_START);
  const f = formatAus({ name: 'Sprint', tage: 30, joker: 3, standards: [{ key: 's1', name: 'Schreiben', art: 'haken' }] });
  assert.deepEqual([f.name, f.tage, f.joker, f.standards.length, f.standards[0].art], ['Sprint', 30, 3, 1, 'haken']);
  // Unbekannte Länge oder kaputte Standards fallen auf die Hunderter zurück, null Joker bleiben null nur, wenn gespeichert
  assert.equal(formatAus({ tage: 77 }).tage, 100);
  assert.equal(formatAus({ joker: null }).joker, JOKER);
  assert.deepEqual(formatAus({ standards: [{ name: '<b>' }] }).standards, STANDARDS_START);
});

test('Challenge: neue Challenge wird gegen feste Listen geprüft', () => {
  assert.equal(jokerFuer(30), 3); assert.equal(jokerFuer(66), 7); assert.equal(jokerFuer(100), 10);
  const ok = pruefeFormat({ name: ' Winter ', tage: 66, standards: [{ name: 'Fokus Arbeit', art: 'fokus' }, { name: 'Lesen', art: 'haken' }, { key: 'content', name: 'Content', art: 'haken' }] });
  assert.ok(typeof ok !== 'string');
  if (typeof ok !== 'string') {
    assert.deepEqual([ok.name, ok.tage, ok.joker], ['Winter', 66, 7]);
    assert.deepEqual(ok.standards.map((s) => s.key), ['s1', 's2', 'content']);
    assert.equal(ok.standards[0].kurz, 'Fokus');
  }
  assert.match(pruefeFormat({ name: 'X', tage: 66, standards: [{ name: 'Lesen' }] }) as string, /Namen/);
  assert.match(pruefeFormat({ name: 'Winter', tage: 50, standards: [{ name: 'Lesen' }] }) as string, /Länge/);
  assert.match(pruefeFormat({ name: 'Winter', tage: 30, standards: [] }) as string, /1 bis 6/);
  assert.match(pruefeStandards([{ name: 'Lesen' }, { name: 'lesen' }]) as string, /gleich/);
  assert.match(pruefeStandards(Array.from({ length: 7 }, (_, i) => ({ name: `Std ${i}` }))) as string, /1 bis 6/);
  // Unbekannte Art wird Fokus, fremde Schlüssel werden ersetzt
  const p = pruefeStandards([{ key: 'DROP TABLE', name: 'Training', art: 'sql' }]);
  assert.ok(typeof p !== 'string' && p[0].key === 's1' && p[0].art === 'fokus');
});

test('Challenge: eigene Standards zählen nach ihrer Art', () => {
  const st = [{ key: 's1', name: 'Schreiben', kurz: 'Schreiben', art: 'fokus' as const }, { key: 's2', name: 'Lesen', kurz: 'Lesen', art: 'haken' as const }];
  const halbTag = bewertenNeu({ werte: { s1: 1, s2: 1 }, leben: alle, verordnet: true }, st);
  assert.deepEqual([halbTag.prozent, halbTag.zaehlt], [80, true]);
  const leer = bewertenNeu({ werte: {}, leben: alle, verordnet: true }, st);
  assert.deepEqual(leer.fehlt, ['1 Phase Schreiben', 'Hälfte Lesen']);
  assert.equal(saisonEnde('2026-11-01', [], 30), '2026-11-30');
  assert.equal(saisonKalender('2026-11-01', ['2026-11-02'], 30).length, 30);
});
