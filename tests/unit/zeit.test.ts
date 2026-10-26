import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Zeit: Tagesbeginn in Berlin im Winter und Sommer, auch am Tag der Umstellung', async () => {
  const { tagesbeginn, heuteBerlin, versatzMin, minutenBerlin, fristRelativ, plusTage } = await import('../../lib/zeit.ts');
  assert.equal(tagesbeginn('2026-01-15').toISOString(), '2026-01-14T23:00:00.000Z');
  assert.equal(tagesbeginn('2026-07-15').toISOString(), '2026-07-14T22:00:00.000Z');
  // Umstellung auf Sommerzeit am 29.03.2026, auf Winterzeit am 25.10.2026
  assert.equal(tagesbeginn('2026-03-29').toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(tagesbeginn('2026-10-25').toISOString(), '2026-10-24T22:00:00.000Z');
  assert.equal(tagesbeginn('2026-10-26').toISOString(), '2026-10-25T23:00:00.000Z');
  assert.equal(versatzMin(new Date('2026-07-01T12:00:00Z')), 120);
  assert.equal(versatzMin(new Date('2026-12-01T12:00:00Z')), 60);
  // 23:30 UTC am 31.12. ist in Berlin schon der 1.1.
  assert.equal(heuteBerlin(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
  assert.equal(minutenBerlin(new Date('2026-07-01T06:15:00Z')), 8 * 60 + 15);
  assert.equal(plusTage('2026-10-24', 2), '2026-10-26');
  assert.equal(fristRelativ('2026-10-26', '2026-10-26'), 'heute');
  assert.equal(fristRelativ('2026-10-27', '2026-10-26'), 'morgen');
  assert.equal(fristRelativ('2026-10-30', '2026-10-26'), 'in 4 Tagen');
  assert.equal(fristRelativ('2026-10-23', '2026-10-26'), '3 Tage überfällig');
  assert.equal(fristRelativ(null, '2026-10-26'), '-');
});

test('Kalender: Schutzliste für Titel an Claude', async () => {
  const { schutzTitel } = await import('../../lib/kalender-regeln.ts');
  assert.equal(schutzTitel('Zahnarzt Dr. Müller'), 'Termin privat');
  assert.equal(schutzTitel('Physiotherapie'), 'Termin privat');
  assert.equal(schutzTitel('Termin Standesamt'), 'Termin privat');
  assert.equal(schutzTitel('Büro aufräumen'), 'Büro aufräumen');
  assert.equal(schutzTitel('Workshop Kollaboration'), 'Workshop Kollaboration');
  assert.equal(schutzTitel('Kaffee mit Jonas Beispiel'), 'Kaffee mit jemandem');
  assert.equal(schutzTitel('Essen bei Frau Erfunden'), 'Essen bei jemandem');
  // Bekannte Namen bleiben stehen, die Pseudonymisierung ersetzt sie danach durch Platzhalter
  assert.equal(schutzTitel('Abstimmung mit Carlotta', ['Carlotta']), 'Abstimmung mit Carlotta');
  assert.equal(schutzTitel('Laufen mit dem Hund'), 'Laufen mit dem Hund');
});

test('YouTube: nur die Video-ID geht raus', async () => {
  const { videoId } = await import('../../lib/youtube.ts');
  assert.equal(videoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&list=PLx&si=abc'), 'dQw4w9WgXcQ');
  assert.equal(videoId('https://youtu.be/dQw4w9WgXcQ?si=tracking'), 'dQw4w9WgXcQ');
  assert.equal(videoId('https://m.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(videoId('https://evil.example/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(videoId('https://www.youtube.com/watch?v=<script>'), null);
});
