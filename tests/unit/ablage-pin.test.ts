import { test } from 'node:test';
import assert from 'node:assert/strict';

test('PIN: Form, Zähler, Sperre nach 5, Reset', async () => {
  const p = await import('../../lib/ablage-pin.ts');
  assert.equal(p.pinOk('123456'), true);
  assert.equal(p.pinOk('12345'), false);
  assert.equal(p.pinOk('12345a'), false);
  assert.equal(p.pinOk(123456), false);
  let fehl = 0;
  for (let i = 1; i <= 4; i++) { const r = p.pinVersuch(fehl, false); assert.deepEqual(r, { ergebnis: 'falsch', fehl: i }); fehl = r.fehl; }
  assert.deepEqual(p.pinVersuch(fehl, true), { ergebnis: 'offen', fehl: 0 }); // richtige PIN vor der Sperre setzt zurück
  assert.deepEqual(p.pinVersuch(4, false), { ergebnis: 'gesperrt', fehl: 5 });
  assert.deepEqual(p.pinVersuch(5, true), { ergebnis: 'gesperrt', fehl: 5 }); // gesperrt zählt auch die richtige PIN nicht
  assert.deepEqual(p.pinVersuch(0, true), { ergebnis: 'offen', fehl: 0 }); // nach Passwort und Code steht der Zähler auf null
  assert.notEqual(p.PIN_TEXT.falsch, p.PIN_TEXT.gesperrt);
});

test('Riegel: zu nach 5 Minuten, Bestätigung höchstens 5 Minuten alt', async () => {
  const p = await import('../../lib/ablage-pin.ts');
  const t = Date.parse('2026-10-31T12:00:00Z');
  const bis = p.riegelBis(t);
  assert.equal(p.riegelOffen(bis, t + 4 * 60_000), true);
  assert.equal(p.riegelOffen(bis, t + 5 * 60_000 + 1), false);
  assert.equal(p.riegelOffen(null, t), false);
  assert.equal(p.frischBestaetigt(new Date(t), t + 5 * 60_000), true);
  assert.equal(p.frischBestaetigt(new Date(t), t + 5 * 60_000 + 1), false);
  assert.equal(p.frischBestaetigt(null, t), false);
});

test('Sitzung: verlängert sich bei Nutzung, Obergrenze 90 Tage', async () => {
  const p = await import('../../lib/ablage-pin.ts');
  const tag = 24 * 3600_000; const t = Date.parse('2026-10-31T12:00:00Z');
  assert.equal(p.sitzungGilt(new Date(t - 60 * tag), new Date(t - 2 * tag), t), true); // 60 Tage alt, vor 2 Tagen genutzt
  assert.equal(p.sitzungGilt(new Date(t - 31 * tag), new Date(t - 31 * tag), t), false); // 31 Tage nicht genutzt
  assert.equal(p.sitzungGilt(new Date(t - 91 * tag), new Date(t - 1 * tag), t), false); // über der Obergrenze
  assert.equal(p.sitzungGilt(new Date(t - 89 * tag), new Date(t), t), true);
  assert.equal(p.cookieErneuern(1000, 1000 + 24 * 3600 + 1), true);
  assert.equal(p.cookieErneuern(1000, 1000 + 3600), false);
  assert.equal(p.cookieErneuern(undefined, 5), false);
});
