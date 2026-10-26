import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baselineSetzen, naechsteEtappe, pruefeAuswertung, pruefeStandAntworten, standZeilen, uebernehmen } from '../../lib/standort.ts';
import { amTag, hostErlaubt, kalenderZeilen, tagesplan, type Termin } from '../../lib/kalender-regeln.ts';
import { auswerten } from '../../lib/ical-termine.ts';

test('Standort: Zahlen sind Pflicht, Unbekanntes fliegt raus, Werte höchstens drei', () => {
  const voll = { zeit: { wert: 4, text: ' Zu viele Termine ' }, sozial: { wert: 7 }, mental: { wert: 5 }, koerper: { wert: 6 }, geld: { wert: 5 }, hack: { wert: 9 } };
  const a = pruefeStandAntworten(1, voll)!;
  assert.equal(a.zeit.text, 'Zu viele Termine');
  assert.equal('hack' in a, false);
  assert.equal(pruefeStandAntworten(1, { ...voll, geld: { wert: 11 } }), null);
  assert.equal(pruefeStandAntworten(1, { zeit: { wert: 4 } }), null);
  const w = pruefeStandAntworten(2, { werte: { auswahl: ['Familie', 'Mut', 'Ruhe', 'Wirkung', '<script>'] } })!;
  assert.deepEqual(w.werte.auswahl, ['Familie', 'Mut', 'Ruhe']);
  assert.equal(pruefeStandAntworten(4, {}), null);
});

test('Standort: Claude-Vorschläge nur nach fester Liste', () => {
  const r = pruefeAuswertung(3, { zusammenfassung: 'x'.repeat(900), vorschlaege: [
    { art: 'engpass', text: 'Zu wenige Erstgespräche', herleitung: 'Der Stau liegt vor dem Angebot.' },
    { art: 'fokus', text: 'nicht in Etappe 3', bereich: 'zeit' },
    { art: 'quartal', text: 'ohne Bereich' },
    { art: 'quartal', text: '8 Erstgespräche im Monat', bereich: 'geschaeft' },
    { art: 'wochenziel', text: '' },
    'kaputt',
  ] });
  assert.equal(r.zusammenfassung.length, 600);
  assert.deepEqual(r.vorschlaege.map((v) => v.art), ['engpass', 'quartal']);
  assert.equal(r.vorschlaege[0].herleitung, 'Der Stau liegt vor dem Angebot.');
  assert.deepEqual(pruefeAuswertung(1, { vorschlaege: [{ art: 'fokus', bereich: 'geschaeft', text: 'x' }] }).vorschlaege, []);
  assert.deepEqual(pruefeAuswertung(2, null), { zusammenfassung: '', vorschlaege: [] });
});

test('Standort: Baseline mit Verlauf, Vorschläge übernehmen, Zeilen ohne Datum', () => {
  let s = baselineSetzen({}, { zeit: { wert: 4, text: 'Termine' }, geld: { wert: 6 } }, '2026-08-01');
  s = baselineSetzen(s, { zeit: { wert: 6 } }, '2026-10-26');
  assert.equal(s.baseline!.werte.zeit, 6);
  assert.deepEqual(s.verlauf, [{ tag: '2026-08-01', werte: { zeit: 4, geld: 6 } }]);
  s = uebernehmen(s, { art: 'quartal', bereich: 'geschaeft', text: 'A' }, '2026-10-26');
  s = uebernehmen(s, { art: 'quartal', bereich: 'geschaeft', text: 'B' }, '2026-10-26');
  s = uebernehmen(s, { art: 'fokus', bereich: 'zeit', text: 'Morgens zwei Stunden ohne Mails' }, '2026-10-26');
  assert.deepEqual(s.quartal?.map((q) => q.text), ['B']);
  s = { ...s, etappen: { 1: '2026-10-26' } };
  assert.equal(naechsteEtappe(s), 2);
  assert.equal(naechsteEtappe({ etappen: { 1: 'x', 2: 'x', 3: 'x' } }), null);
  const z = standZeilen(s, '2026-11-09', 'Drei Erstgespräche').join('\n');
  assert.match(z, /vor 2 Wochen/);
  assert.match(z, /Geschäft: B/);
  assert.match(z, /Wochenziel: Drei Erstgespräche/);
  assert.doesNotMatch(z, /2026/);
});

const T = (beginn: string, ende: string, titel: string, art: Termin['art'] = 'privat', ganztag = false): Termin => ({ beginn, ende, titel, art, ganztag });

test('Kalender: Lücken ab 30 Minuten, Vorschlag fürs Wichtigste, Familie geschützt', () => {
  const tag = '2026-10-27';
  const t = [
    T('2026-10-27T08:00:00Z', '2026-10-27T09:00:00Z', 'Arzttermin'),            // 9–10 Uhr Berlin
    T('2026-10-27T09:10:00Z', '2026-10-27T10:00:00Z', 'Call', 'arbeit'),       // 10:10–11
    T('2026-10-27T15:30:00Z', '2026-10-27T18:00:00Z', 'Laternen mit Kindern', 'familie'),
    T('2026-10-27T00:00:00Z', '2026-10-28T00:00:00Z', 'Geburtstag Oma', 'familie', true),
    T('2026-10-28T08:00:00Z', '2026-10-28T09:00:00Z', 'Morgen'),
  ];
  assert.equal(amTag(t, tag).length, 4);
  const p = tagesplan(t, tag, { ab: 9 * 60 + 30, ziel: 'Angebot schreiben', dauer: 60 });
  assert.equal(p.ganztag.length, 1);
  const art = p.bloecke.map((b) => b.art);
  assert.deepEqual(art, ['frei', 'privat', 'arbeit', 'vorschlag', 'frei', 'familie']);
  const v = p.bloecke.find((b) => b.art === 'vorschlag')!;
  assert.equal(v.von, 11 * 60); assert.equal(v.bis, 12 * 60);
  const z = kalenderZeilen(t, tag, 12 * 60).join('\n');
  assert.match(z, /10:10–11:00 Call \(Arbeit\)/);
  assert.match(z, /16:30–19:00 Familie \(geschützt/);
  assert.doesNotMatch(z, /Laternen|Oma/);
  assert.match(z, /Freie Zeit heute .*12:00–16:30/);
  assert.match(z, /Mittwoch 1 Std\./);
});

test('Kalender: nur iCloud-Hosts, im Test der eingestellte Server', () => {
  assert.equal(hostErlaubt('https://caldav.icloud.com/'), true);
  assert.equal(hostErlaubt('https://p67-caldav.icloud.com:443/123/calendars/'), true);
  assert.equal(hostErlaubt('https://caldav.icloud.com.evil.example/'), false);
  assert.equal(hostErlaubt('http://caldav.icloud.com/'), false);
  assert.equal(hostErlaubt('https://169.254.169.254/'), false);
  assert.equal(hostErlaubt('http://127.0.0.1:4011/x'), false);
  assert.equal(hostErlaubt('http://127.0.0.1:4011/x', 'http://127.0.0.1:4011/'), true);
});

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:jf
DTSTART;TZID=Europe/Berlin:20240101T090000
DTEND;TZID=Europe/Berlin:20240101T100000
RRULE:FREQ=WEEKLY;BYDAY=MO
SUMMARY:Jour fixe
END:VEVENT
BEGIN:VEVENT
UID:jf
RECURRENCE-ID;TZID=Europe/Berlin:20261026T090000
DTSTART;TZID=Europe/Berlin:20261026T110000
DTEND;TZID=Europe/Berlin:20261026T120000
SUMMARY:Jour fixe verschoben
END:VEVENT
END:VCALENDAR`;

test('iCal: Wiederholung seit Jahren, verschobener Einzeltermin, abgesagte fallen weg', () => {
  const v = auswerten(ICS, new Date('2026-10-25T00:00:00Z'), new Date('2026-11-04T00:00:00Z'));
  assert.deepEqual(v.map((x) => [x.beginn, x.titel]), [['2026-10-26T10:00:00.000Z', 'Jour fixe verschoben'], ['2026-11-02T08:00:00.000Z', 'Jour fixe']]);
  const abgesagt = ICS.replace('SUMMARY:Jour fixe verschoben', 'SUMMARY:x\nSTATUS:CANCELLED');
  assert.equal(auswerten(abgesagt, new Date('2026-10-25T00:00:00Z'), new Date('2026-10-30T00:00:00Z')).length, 0);
  const ganz = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:g\nDTSTART;VALUE=DATE:20261027\nDTEND;VALUE=DATE:20261028\nSUMMARY:Ferien\nEND:VEVENT\nEND:VCALENDAR';
  assert.deepEqual(auswerten(ganz, new Date('2026-10-25T00:00:00Z'), new Date('2026-10-30T00:00:00Z'))[0], { uid: 'g', beginn: '2026-10-27T00:00:00Z', ende: '2026-10-28T00:00:00Z', ganztag: true, titel: 'Ferien' });
  assert.deepEqual(auswerten('kaputt', new Date(), new Date()), []);
});
