import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupStatus, betriebGesund, restoreStatus } from '../../lib/betrieb.ts';

const jetzt = Date.parse('2026-10-26T12:00:00+01:00');

test('Sicherung: von heute Nacht ok, älter als 26 Stunden alt, kaputt alt', () => {
  assert.equal(backupStatus('2026-10-26T03:15:04+01:00\n', jetzt), 'ok');
  assert.equal(backupStatus('2026-10-25T03:15:04+01:00', jetzt), 'alt');
  assert.equal(backupStatus('Quatsch', jetzt), 'alt');
  assert.equal(backupStatus(null, jetzt), 'fehlt');
  assert.equal(backupStatus(undefined, jetzt), 'aus');
});

test('Wiederherstellung: fehler meldet sofort, alt nach 40 Tagen', () => {
  assert.equal(restoreStatus('ok 2026-10-01T04:30:12+02:00', jetzt), 'ok');
  assert.equal(restoreStatus('fehler 2026-10-01T04:30:12+02:00', jetzt), 'fehler');
  assert.equal(restoreStatus('ok 2026-09-01T04:30:12+02:00', jetzt), 'alt');
  assert.equal(restoreStatus(null, jetzt), 'fehlt');
});

test('Gesund: fehlender Status ist kein Ausfall, alter oder gescheiterter schon', () => {
  assert.equal(betriebGesund('ok', 'ok'), true);
  assert.equal(betriebGesund('fehlt', 'fehlt'), true);
  assert.equal(betriebGesund('aus', 'aus'), true);
  assert.equal(betriebGesund('alt', 'ok'), false);
  assert.equal(betriebGesund('ok', 'fehler'), false);
  assert.equal(betriebGesund('ok', 'alt'), false);
});
