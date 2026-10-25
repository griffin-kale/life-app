import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Decode, base32Encode, hotp, pruefeCode, totp } from '../../lib/totp-core.ts';
import { entschluesseln, hashPasswort, pruefePasswort, verschluesseln } from '../../lib/passwort-core.ts';

// Testwerte aus RFC 6238, Anhang B (SHA-1, Schlüssel "12345678901234567890")
const RFC = base32Encode(Buffer.from('12345678901234567890'));

test('TOTP liefert die Werte aus RFC 6238', () => {
  assert.equal(totp(RFC, 59_000, 8), '94287082');
  assert.equal(totp(RFC, 1111111109_000, 8), '07081804');
  assert.equal(totp(RFC, 1234567890_000, 8), '89005924');
  assert.equal(totp(RFC, 20000000000_000, 8), '65353130');
});

test('HOTP liefert die Werte aus RFC 4226', () => {
  const key = Buffer.from('12345678901234567890');
  assert.deepEqual([0, 1, 2, 9].map((c) => hotp(key, c)), ['755224', '287082', '359152', '520489']);
});

test('Base32 hin und zurück', () => {
  const b = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  assert.deepEqual(base32Decode(base32Encode(b)), b);
  assert.deepEqual(base32Decode('mfrg gzdf'), base32Decode('MFRGGZDF'));
});

test('Code gilt ±30 Sekunden und nur einmal', () => {
  const t = 1_800_000_000_000;
  const code = totp(RFC, t);
  const erster = pruefeCode(RFC, code, 0, t);
  assert.equal(erster.ok, true);
  assert.equal(pruefeCode(RFC, code, erster.step, t).ok, false, 'Wiederverwendung abgelehnt');
  assert.equal(pruefeCode(RFC, totp(RFC, t - 30_000), 0, t).ok, true, '30 s alt geht');
  assert.equal(pruefeCode(RFC, totp(RFC, t - 90_000), 0, t).ok, false, '90 s alt geht nicht');
  assert.equal(pruefeCode(RFC, '12345', 0, t).ok, false);
  assert.equal(pruefeCode(RFC, 'abcdef', 0, t).ok, false);
});

test('Passwort-Hash prüft richtig und falsch', () => {
  const h = hashPasswort('korrekt-pferd-batterie-heftklammer');
  assert.match(h, /^scrypt\$32768\$8\$1\$/);
  assert.equal(pruefePasswort('korrekt-pferd-batterie-heftklammer', h), true);
  assert.equal(pruefePasswort('falsch', h), false);
  assert.equal(pruefePasswort('egal', null), false);
});

test('Verschlüsselung des Code-Schlüssels', () => {
  const box = verschluesseln('GEHEIM', 'x'.repeat(40));
  assert.equal(entschluesseln(box, 'x'.repeat(40)), 'GEHEIM');
  assert.throws(() => entschluesseln(box, 'y'.repeat(40)));
});
