// Saison: Zeitraum, Prüfung des Blatts, Vorschläge, Claudes Hebel. Alle Daten erfunden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  imPlan, naechsterMontag, pruefeHebelVorschlaege, pruefeSaison, saisonEnde, saisonName, saisonWoche, vorschlaegeAus, wennDannSatz,
} from '../../lib/saison-regeln.ts';

test('Saison: nächster Montag, Ende nach zwölf Wochen, Woche und Name', () => {
  assert.equal(naechsterMontag('2026-10-29'), '2026-11-02'); // Donnerstag
  assert.equal(naechsterMontag('2026-11-02'), '2026-11-02'); // Montag bleibt
  assert.equal(naechsterMontag('2026-11-01'), '2026-11-02'); // Sonntag
  assert.equal(saisonEnde('2026-11-02'), '2027-01-24');
  assert.equal(saisonWoche('2026-11-02', '2026-10-30'), 0);
  assert.equal(saisonWoche('2026-11-02', '2026-11-02'), 1);
  assert.equal(saisonWoche('2026-11-02', '2026-11-16'), 3);
  assert.equal(saisonWoche('2026-11-02', '2027-01-24'), 12);
  assert.equal(saisonWoche('2026-11-02', '2027-01-25'), 13);
  assert.equal(saisonName('2026-11-02'), 'Winter');
  assert.equal(saisonName('2027-01-25'), 'Frühling');
  assert.equal(saisonName('2027-07-05'), 'Sommer');
});

test('Saison: Blatt prüfen – Montag, ein Ziel pro Bereich, höchstens drei Hebel, Texte gekürzt', () => {
  const heute = '2026-10-29';
  assert.equal(pruefeSaison({ start: '2026-11-03', ziele: [{ bereich: 'zeit', titel: 'Zwei Fokusblöcke' }] }, heute).ok, false);
  assert.equal(pruefeSaison({ start: '2027-03-01', ziele: [{ bereich: 'zeit', titel: 'Zwei Fokusblöcke' }] }, heute).ok, false);
  assert.equal(pruefeSaison({ start: '2026-11-02', ziele: [] }, heute).ok, false);
  const r = pruefeSaison({
    start: '2026-11-02', leitsatz: '  Erst das Wichtige,   dann das Laute. ',
    ziele: [
      { bereich: 'koerper', titel: 'Dreimal pro Woche Kraft', hebel: [{ titel: 'Mo Kraft' }, { titel: 'Mi Kraft', art: 'ritual' }, { titel: 'mo kraft' }, { titel: 'Fr Kraft' }, { titel: 'Sa Kraft' }], wenn: 'Der Tag wird zu voll', dann: 'Dann zwanzig Minuten zu Hause' },
      { bereich: 'koerper', titel: 'Zweites Körperziel' },
      { bereich: 'geschaeft', titel: 'Zehn neue Kunden', zielwert: 10, hebel: [{ titel: 'Jeden Tag fünf Anrufe', art: 'quatsch' }] },
      { bereich: 'erfunden', titel: 'Gibt es nicht' },
      { bereich: 'geld', titel: 'x' },
      { bereich: 'zeit', titel: 'Fokus', zielwert: -3 },
    ],
  }, heute);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.wert.leitsatz, 'Erst das Wichtige, dann das Laute.');
  assert.deepEqual(r.wert.ziele.map((z) => z.bereich), ['geschaeft', 'zeit', 'koerper']);
  const k = r.wert.ziele.find((z) => z.bereich === 'koerper')!;
  assert.deepEqual(k.hebel.map((h) => h.titel), ['Mo Kraft', 'Mi Kraft', 'Fr Kraft']);
  assert.equal(k.hebel[1].art, 'ritual');
  const g = r.wert.ziele.find((z) => z.bereich === 'geschaeft')!;
  assert.equal(g.zielwert, 10);
  assert.equal(g.hebel[0].art, 'kalender');
  assert.equal(r.wert.ziele.find((z) => z.bereich === 'zeit')!.zielwert, null);
});

test('Saison: Wenn-dann-Satz, Vorschläge ohne Doppelte, Claudes Hebel nur für angefragte Bereiche', () => {
  assert.equal(wennDannSatz('Der Tag wird zu voll', 'Mache ich die Anrufe nach dem Mittag.'), 'Wenn der Tag zu voll wird, dann mache ich die Anrufe nach dem Mittag.');
  assert.equal(wennDannSatz('Wenn es regnet', 'Dann laufe ich auf dem Band'), 'Wenn es regnet, dann laufe ich auf dem Band.');
  assert.equal(wennDannSatz('Keine Lust', ''), '');
  const v = vorschlaegeAus([{ bereich: 'geschaeft', text: 'Acht Erstgespräche im Monat' }, { bereich: 'quatsch', text: 'Ohne Bereich' }], ['acht erstgespräche im monat', 'Plattform', 'ab']);
  assert.deepEqual(v, [{ bereich: 'geschaeft', text: 'Acht Erstgespräche im Monat' }, { bereich: null, text: 'Ohne Bereich' }, { bereich: null, text: 'Plattform' }]);
  const h = pruefeHebelVorschlaege({ ziele: [
    { bereich: 'koerper', hebel: ['Mo Kraft', 'Mi Kraft', 'Fr Kraft', 'So Kraft'], dann: 'Zwanzig Minuten zu Hause' },
    { bereich: 'geld', hebel: ['Töpfe prüfen'] },
    { bereich: 'koerper', hebel: ['doppelt'] },
  ] }, ['koerper']);
  assert.deepEqual(Object.keys(h), ['koerper']);
  assert.equal(h.koerper.hebel.length, 3);
  assert.deepEqual(pruefeHebelVorschlaege('<b>kaputt</b>', ['koerper']), {});
});

test('Saison: im Plan nach verstrichener Zeit', () => {
  assert.equal(imPlan(3, 10, 3), 'im Plan');
  assert.equal(imPlan(0, 10, 6), 'dahinter');
  assert.equal(imPlan(8, 10, 3), 'voraus');
  assert.equal(imPlan(3, null, 3), null);
  assert.equal(imPlan(3, 10, 0), null);
});
