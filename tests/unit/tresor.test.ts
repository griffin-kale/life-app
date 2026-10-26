import { test } from 'node:test';
import assert from 'node:assert/strict';

const ALT = 'test-session-secret-nur-fuer-tests-0123456789abcdef';
const NEU = 'test-encryption-key-nur-fuer-tests-fedcba9876543210';

test('ohne ENCRYPTION_KEY bleibt alles wie bisher (v1 aus SESSION_SECRET)', async () => {
  process.env.SESSION_SECRET = ALT; delete process.env.ENCRYPTION_KEY;
  const { zuschliessen, aufschliessen, veraltet, verschluesseln } = await import('../../lib/passwort-core.ts');
  const box = zuschliessen('GEHEIM', 'totp');
  assert.match(box, /^v1\./);
  assert.equal(aufschliessen(box, 'totp'), 'GEHEIM');
  assert.equal(veraltet(box), false);
  // Bestehende Daten aus 0.15 bleiben lesbar
  assert.equal(aufschliessen(verschluesseln('ALT', ALT, 'whoop'), 'whoop'), 'ALT');
});

test('mit ENCRYPTION_KEY: neu als v2, Altes lesbar, SESSION_SECRET-Wechsel macht v2 nicht unlesbar', async () => {
  const { zuschliessen, aufschliessen, veraltet, verschluesseln } = await import('../../lib/passwort-core.ts');
  process.env.SESSION_SECRET = ALT;
  const alt = verschluesseln('ALT', ALT, 'vapid');
  process.env.ENCRYPTION_KEY = NEU;
  assert.equal(veraltet(alt), true);
  assert.equal(aufschliessen(alt, 'vapid'), 'ALT');
  const box = zuschliessen('NEU', 'vapid');
  assert.match(box, /^v2\./);
  process.env.SESSION_SECRET = 'ein-ganz-anderes-session-secret-0123456789abcdef';
  assert.equal(aufschliessen(box, 'vapid'), 'NEU');
  assert.throws(() => aufschliessen(box, 'totp')); // anderer Zweck, anderer Schlüssel
  delete process.env.ENCRYPTION_KEY;
  assert.throws(() => aufschliessen(box, 'vapid'), /ENCRYPTION_KEY fehlt/);
});

test('ENCRYPTION_KEY muss lang genug und eigenständig sein', async () => {
  const { zuschliessen } = await import('../../lib/passwort-core.ts');
  process.env.SESSION_SECRET = ALT;
  process.env.ENCRYPTION_KEY = 'zu-kurz';
  assert.throws(() => zuschliessen('x', 'totp'), /kürzer/);
  process.env.ENCRYPTION_KEY = ALT;
  assert.throws(() => zuschliessen('x', 'totp'), /unterscheiden/);
  delete process.env.ENCRYPTION_KEY;
});
