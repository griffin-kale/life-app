import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dauerText, kontenZeilen, minutenAus, streifen, topfSpanne, type KontenEingang } from '../../lib/cockpit-regeln.ts';

test('Dauer und Uhrzeit', () => {
  assert.equal(dauerText(150), '2 Std. 30');
  assert.equal(dauerText(60), '1 Std.');
  assert.equal(dauerText(45), '45 Min.');
  assert.equal(minutenAus('09:30'), 570);
  assert.equal(minutenAus('9:30'), null);
});

test('Tagesstreifen: nur was noch kommt oder läuft, ohne Lücken, nach Zeit, höchstens drei', () => {
  const b = [
    { von: 480, bis: 540, titel: 'Vorbei', art: 'arbeit' as const },
    { von: 600, bis: 660, titel: 'Läuft', art: 'arbeit' as const },
    { von: 660, bis: 720, titel: '', art: 'frei' as const },
    { von: 840, bis: 900, titel: 'Workshop', art: 'arbeit' as const },
    { von: 1110, bis: 1200, titel: 'Familie', art: 'familie' as const },
  ];
  const s = streifen(b, [{ titel: 'Angebot', zeit: '13:00', dauer: 60 }, { titel: 'ohne Zeit', zeit: null, dauer: null }], 620);
  assert.deepEqual(s.map((x) => x.titel), ['Läuft', 'Angebot', 'Workshop']);
  assert.equal(s[1].quelle, 'aufgabe');
});

test('Wochentopf als Spanne, nie als Cent-Betrag', () => {
  assert.equal(topfSpanne(0, 10000), 'fast alles übrig');
  assert.equal(topfSpanne(4500, 10000), 'rund die Hälfte übrig');
  assert.equal(topfSpanne(9500, 10000), 'fast aufgebraucht');
  assert.equal(topfSpanne(12000, 10000), 'über dem Rahmen');
  assert.doesNotMatch(topfSpanne(3333, 10000), /\d/);
});

const leer: KontenEingang = { frei: null, naechsterTermin: null, trainingstag: false, kraftHeute: false, trainingUhrzeit: null, protein: null, proteinZiel: null, ruheMinHeute: 0, ruheTageWoche: 0, geburtstag: null, faellig: null, geld: null };

test('Konten: fünf Zeilen, ohne Daten jeweils ein nächster Schritt statt einer Null', () => {
  const z = kontenZeilen(leer);
  assert.deepEqual(z.map((x) => x.konto), ['zeit', 'koerper', 'mental', 'sozial', 'geld']);
  for (const x of z) assert.doesNotMatch(x.text, /(^|\s)0(\s|$)/, x.konto);
  assert.match(z[0].text, /Kalender verbinden/);
});

test('Konten: Protein ohne Mahlzeit zeigt das Ziel statt einer Null', () => {
  assert.equal(kontenZeilen({ ...leer, protein: 0, proteinZiel: 128 })[1].text, 'Protein-Ziel heute 128 g');
});

test('Konten mit Daten', () => {
  const z = kontenZeilen({ ...leer, frei: 150, naechsterTermin: { von: 840, bis: 930, titel: 'Workshop', art: 'arbeit', quelle: 'kalender' }, trainingstag: true, trainingUhrzeit: '17:30', protein: 38.4, proteinZiel: 130, ruheMinHeute: 5, ruheTageWoche: 1, geburtstag: { name: '[Person 1]', inTagen: 2 }, geld: { ausgaben: 4000, rahmen: 10000 } });
  assert.equal(z[0].text, '14:00 Workshop, heute 2 Std. 30 frei');
  assert.equal(z[1].text, 'Krafteinheit um 17:30 · Protein 38 von 130 g');
  assert.equal(z[2].text, '5 Min. Ruhe heute, 1 Tag diese Woche');
  assert.match(z[3].text, /in 2 Tagen Geburtstag/);
  assert.equal(z[4].text, 'Wochentöpfe: gut die Hälfte übrig');
});
