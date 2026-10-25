import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockWoche, einheitPlanen, nachEinheit, neuerBlock, standStart, START_VOLUMEN } from '../../lib/training.ts';
import { ausgefalleneTrainings, koerperZusammenfassung, schlafWarnung } from '../../lib/coach-regeln.ts';
import { endpointOk } from '../../lib/push-regeln.ts';
import { faellig } from '../../lib/zeitplan-regeln.ts';

const MO = '2026-10-26';

test('Blockwochen laufen 1 bis 5 und dann von vorn', () => {
  assert.equal(blockWoche(MO, MO), 1);
  assert.equal(blockWoche(MO, '2026-11-01'), 1);
  assert.equal(blockWoche(MO, '2026-11-02'), 2);
  assert.equal(blockWoche(MO, '2026-11-23'), 5);
  assert.equal(blockWoche(MO, '2026-11-30'), 1);
});

test('Planung: alle Muskelgruppen, Entlastung halbiert die Sätze', () => {
  const s = standStart(MO);
  const e = einheitPlanen(s, MO);
  assert.equal(e.uebungen.length, 7);
  assert.equal(e.uebungen.find((u) => u.muskel === 'beine')!.saetze, 2);
  const d = einheitPlanen({ ...s, volumen: { ...s.volumen, beine: 4 } }, '2026-11-23');
  assert.equal(d.woche, 5);
  assert.equal(d.uebungen.find((u) => u.muskel === 'beine')!.saetze, 2);
});

test('Feedback: erholt und wenig Pump gibt einen Satz mehr, Schmerz einen weniger und eine andere Übung', () => {
  const s = standStart(MO);
  const { stand } = nachEinheit(s, MO, [{ uebung: 'goblet', wdh: [12, 11] }], { beine: { pump: 'wenig', kater: 'keiner' }, ziehen: { gelenke: 'schmerzt' } });
  assert.equal(stand.volumen.beine, START_VOLUMEN.beine + 1);
  assert.equal(stand.volumen.ziehen, START_VOLUMEN.ziehen - 1);
  assert.notDeepEqual(stand.wahl.ziehen, s.wahl.ziehen);
  assert.equal(stand.wdh.goblet, 12);
  assert.equal(stand.einheitNr, 1);
  // Nächste Einheit nimmt Übung B und steigert A beim übernächsten Mal
  assert.equal(einheitPlanen(stand, MO).uebungen.find((u) => u.muskel === 'beine')!.uebung, 'split');
});

test('Obere Grenze erreicht: nächste Stufe der Übung', () => {
  const { stand, hinweise } = nachEinheit(standStart(MO), MO, [{ uebung: 'goblet', wdh: [20, 20] }], {});
  assert.equal(stand.wahl.beine[0], 'goblet-pause');
  assert.match(hinweise[0], /obere Grenze/);
});

test('In Woche 4 bleibt die Satzzahl, neuer Block senkt sie wieder', () => {
  const s = standStart(MO);
  const w4 = nachEinheit(s, '2026-11-16', [], { beine: { pump: 'wenig', kater: 'keiner' } }).stand;
  assert.equal(w4.volumen.beine, s.volumen.beine);
  const neu = neuerBlock({ ...s, volumen: { ...s.volumen, beine: 4 } }, '2026-11-30');
  assert.equal(neu.volumen.beine, 3);
  assert.equal(neu.blockStart, '2026-11-30');
});

test('Warnsignale: drei kurze Nächte, zwei ausgefallene Einheiten', () => {
  assert.ok(schlafWarnung([{ tag: 'a', schlaf_min: 380 }, { tag: 'b', schlaf_min: 300 }, { tag: 'c', schlaf_min: 389 }]));
  assert.equal(schlafWarnung([{ tag: 'a', schlaf_min: 380 }, { tag: 'b', schlaf_min: 420 }, { tag: 'c', schlaf_min: 300 }]), null);
  // Plan Mo, Mi, Fr. Heute Samstag 31.10. Freitag und Mittwoch ohne Einheit, Montag mit.
  assert.equal(ausgefalleneTrainings([0, 2, 4], ['2026-10-26'], '2026-10-31', '2026-10-01'), 2);
  assert.equal(ausgefalleneTrainings([0, 2, 4], ['2026-10-30'], '2026-10-31', '2026-10-01'), 0);
  assert.equal(ausgefalleneTrainings([0, 2, 4], [], '2026-10-31', null), 0);
});

test('Körper für Claude: ohne Datum', () => {
  const t = koerperZusammenfassung({ naechte: [{ tag: '2026-10-25', schlaf_min: 400 }, { tag: '2026-10-24', schlaf_min: 440 }], erholung: [55, 60], ruhepuls: [58, 52, 53, 54, 52], kraft: 1, kraftSoll: 3, zone2: 95, intervall: 0, proteinGestern: 110, proteinZiel: 130 });
  assert.doesNotMatch(t, /2026|\d{1,2}:\d{2}/);
  assert.match(t, /Schlaf letzte Nacht 6,7 h/);
  assert.match(t, /Ruhepuls heute 58, \+5/);
});

test('Push nur an bekannte Dienste, Zeitfenster zwei Stunden', () => {
  assert.ok(endpointOk('https://web.push.apple.com/QWERTY'));
  assert.equal(endpointOk('https://evil.example/push'), false);
  assert.equal(endpointOk('http://web.push.apple.com/x'), false);
  assert.ok(faellig('07:00', '07:00'));
  assert.ok(faellig('08:59', '07:00'));
  assert.equal(faellig('09:01', '07:00'), false);
  assert.equal(faellig('06:59', '07:00'), false);
});
