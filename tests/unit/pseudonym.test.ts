import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskieren, namenAus, zurueck } from '../../lib/pseudonym.ts';
import { pruefeAntworten, who5, wochenTag } from '../../lib/fragen.ts';
import { warnsignale } from '../../lib/coach-regeln.ts';

const NAMEN = namenAus('Carlotta: Fachbereiche\nFirma: Musterwerk GmbH\nOrt: Beispielstadt\nJonas Weber\nJonas');

test('Namenliste liest Teamzeilen und Präfixe', () => {
  assert.deepEqual(NAMEN.map((n) => `${n.art}:${n.name}`), ['Person:Carlotta', 'Firma:Musterwerk GmbH', 'Ort:Beispielstadt', 'Person:Jonas Weber', 'Person:Jonas']);
});

test('Namen werden zu Platzhaltern und kommen zurück', () => {
  const { text, zuordnung } = maskieren('Carlotta trifft Jonas Weber in Beispielstadt. Später ruft carlotta Jonas an.', NAMEN);
  // Nummern nach Länge der Namen, damit „Jonas Weber“ vor „Jonas“ greift
  assert.equal(text, '[Person 2] trifft [Person 1] in [Ort 1]. Später ruft [Person 2] [Person 3] an.');
  assert.equal(zurueck({ a: ['[Person 1] und [Ort 1]'], b: 3 }, zuordnung).a[0], 'Jonas Weber und Beispielstadt');
});

test('Wortgrenzen, Genitiv und Bindestrich', () => {
  const { text } = maskieren('Carlottas Plan, das Musterwerk GmbH-Angebot und Carlottaweg bleiben', NAMEN);
  assert.equal(text, '[Person 1]s Plan, das [Firma 1]-Angebot und Carlottaweg bleiben');
});

test('E-Mail, Telefon und IBAN werden ersetzt, Daten und Uhrzeiten nicht', () => {
  const { text, zuordnung } = maskieren('Mail an test.person@example.org, Tel. 0170 1234567 oder +49 30 1234567, IBAN DE89 3704 0044 0532 0130 00, Frist 2026-10-30 um 09:00, 15 Minuten', []);
  assert.equal(text, 'Mail an [E-Mail 1], Tel. [Telefon 1] oder [Telefon 2], IBAN [IBAN 1], Frist 2026-10-30 um 09:00, 15 Minuten');
  assert.equal(zurueck('[Telefon 2]', zuordnung), '+49 30 1234567');
});

test('Unbekannte Platzhalter bleiben stehen', () => {
  const { zuordnung } = maskieren('Carlotta', NAMEN);
  assert.equal(zurueck('[Person 9] und [Person 1]', zuordnung), '[Person 9] und Carlotta');
});

test('Fragebogen: Pflichtfragen, fremde Werte fliegen raus', () => {
  assert.equal(pruefeAntworten('morgen', {}), null);
  assert.deepEqual(pruefeAntworten('morgen', { erholung: { wert: 3, notiz: ' gut ' }, x: { wert: 1 } }), { erholung: { wert: 3, notiz: 'gut' } });
  assert.equal(pruefeAntworten('morgen', { erholung: { wert: 9 } }), null);
  const abend = pruefeAntworten('abend', { tag: { wert: 4 }, kraft: { auswahl: ['Termine', 'Hack'] }, plan: { aufgabe: 'Newsletter', zeit: 'mitternachts' } });
  assert.deepEqual(abend, { tag: { wert: 4 }, kraft: { auswahl: ['Termine'] }, plan: { aufgabe: 'Newsletter' } });
});

test('WHO-5 in Prozent und Wochentag', () => {
  const a = Object.fromEntries(['who1', 'who2', 'who3', 'who4', 'who5'].map((k) => [k, { wert: 3 }]));
  assert.equal(who5(a), 60);
  assert.equal(who5({}), null);
  assert.equal(wochenTag('2026-10-25'), '2026-10-19'); // Sonntag gehört zur Woche ab Montag
  assert.equal(wochenTag('2026-10-26'), '2026-10-26');
});

test('Warnsignal: Engpass-Aufgabe liegt seit drei Tagen', () => {
  const jetzt = Date.parse('2026-10-25T10:00:00Z');
  const it = (o: object) => ({ kategorie: 'aufgabe', hebel: 1, status: 'sortiert', stapel: 'jetzt', created_at: '2026-10-24T10:00:00Z', schritt: 'x', titel: null, text: 'x', ...o });
  const w = warnsignale([it({ hebel: 3, created_at: '2026-10-20T10:00:00Z', schritt: 'Newsletter schreiben' }), it({ hebel: 3 }), it({ created_at: '2026-10-01T10:00:00Z' })] as Parameters<typeof warnsignale>[0], jetzt);
  assert.deepEqual(w, ['„Newsletter schreiben“ wirkt auf den Engpass und liegt seit 5 Tagen.']);
});
