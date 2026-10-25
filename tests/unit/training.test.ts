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

import { atemPhase, skript, VORLAGEN } from '../../lib/ruhe.ts';

test('Ruhe: Hinweise liegen innerhalb der Sitzung, NSDR wandert durch den ganzen Körper', () => {
  for (const v of VORLAGEN) for (const m of v.minuten) for (const h of skript(v.id, m)) assert.ok(h.t >= 0 && h.t < m * 60, `${v.id} ${m}: ${h.t}`);
  const n = skript('nsdr', 10);
  assert.ok(n.some((h) => h.text.includes('linken Fuß')) && n.some((h) => h.text.includes('ganzen Körper')));
  const t = n.map((h) => h.t); assert.deepEqual(t, [...t].sort((a, b) => a - b));
  assert.deepEqual(skript('stille', 10), []);
});

test('Atemtakt beim zyklischen Seufzen', () => {
  const takt = { ein: 2, ein2: 1, aus: 6 };
  assert.equal(atemPhase(takt, 0.5).phase, 'ein');
  assert.equal(atemPhase(takt, 2.5).phase, 'nach');
  assert.equal(atemPhase(takt, 5).phase, 'aus');
  assert.equal(atemPhase(takt, 9.5).phase, 'ein');
});

import { aktuelleStufe, betragAus, monatsAusgaben, stufen, taschengeldGuthaben, topfStand } from '../../lib/geld-regeln.ts';

test('Geld: Beträge aus gesprochenen Sätzen', () => {
  assert.deepEqual(betragAus('12,50 Bäcker'), { cent: 1250, was: 'Bäcker' });
  assert.deepEqual(betragAus('Tanken 60'), { cent: 6000, was: 'Tanken' });
  assert.deepEqual(betragAus('2 Brötchen für 1,80'), { cent: 180, was: '2 Brötchen' });
  assert.deepEqual(betragAus('Drogerie 23 Euro'), { cent: 2300, was: 'Drogerie' });
  assert.equal(betragAus('Bäcker'), null);
});

test('Geld: Spanne am Wochenende, Übertrag höchstens eine Woche', () => {
  assert.equal(topfStand(15000, 5000, 0, 1).anzeige, 'noch 100 €');
  assert.equal(topfStand(15000, 5000, 0, 5).anzeige, 'noch etwa 80–130 €');
  assert.equal(topfStand(15000, 20000, 0, 2).ueber, true);
  assert.equal(topfStand(15000, 0, 99999, 0).rahmen, 30000);
});

test('Geld: Stufenplan und Taschengeld', () => {
  const p = { einnahmen: 600000, fest: 250000, woche: 40000, schulden: [{ name: 'Dispo', cent: 80000 }, { name: 'Auto', cent: 500000 }], ruecklage: 450000, sparrate: 60000, pufferMonate: 12 };
  assert.equal(monatsAusgaben(p), 250000 + Math.round((40000 * 52) / 12));
  const s = stufen(p);
  assert.equal(aktuelleStufe(s).nr, 4);
  assert.match(s[3].erklaerung, /Dispo/);
  // Start Donnerstag 22.10., Montag 26.10. ist der erste Gutschrifttag
  assert.equal(taschengeldGuthaben(300, '2026-10-22', '2026-10-25', 0), 0);
  assert.equal(taschengeldGuthaben(300, '2026-10-22', '2026-10-26', 0), 300);
  assert.equal(taschengeldGuthaben(300, '2026-10-26', '2026-11-09', 100), 800);
});

import { level, meilensteineAktualisieren, ring } from '../../lib/kompass-regeln.ts';

test('Kompass: Ring, Level, Meilensteine gehen nicht verloren', () => {
  assert.equal(ring([{ name: 'a', ist: 3, ziel: 3 }, { name: 'b', ist: 90, ziel: 180 }]), 0.75);
  assert.equal(ring([{ name: 'a', ist: 9, ziel: 3 }]), 1);
  assert.equal(ring([{ name: 'a', ist: 1, ziel: 0 }]), null);
  assert.equal(level(0).level, 1); assert.equal(level(100).level, 2); assert.equal(level(399).level, 2); assert.equal(level(400).level, 3);
  assert.equal(level(150).naechstes, 250);
  const s = { kraft: 10, ruheMin: 50, abende: 0, wochenboegen: 0, who5Max: null, engpassErledigt: 0, wochenAlleRinge: 0, wochenToepfeImRahmen: 0, geldStufe: 1, protein: 0 };
  const a = meilensteineAktualisieren({}, s, '2026-10-25');
  assert.deepEqual(a.neu, ['kraft1', 'kraft10']);
  const b = meilensteineAktualisieren(a.alle, { ...s, kraft: 0 }, '2026-10-26');
  assert.deepEqual(b.neu, []); assert.equal(b.alle.kraft10, '2026-10-25');
});
