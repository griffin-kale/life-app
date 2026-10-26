// Einheitstests für die Schutzfunktionen. Laufen ohne Abhängigkeiten: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, safeFetch } from '../../lib/safefetch.ts';

test('interne IPv4-Adressen werden erkannt', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '198.18.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
});

test('öffentliche IPv4-Adressen gehen durch', () => {
  for (const ip of ['1.1.1.1', '8.8.8.8', '172.32.0.1', '93.184.216.34']) assert.equal(isPrivateIp(ip), false, ip);
});

test('interne IPv6-Adressen werden erkannt', () => {
  for (const ip of ['::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '[::1]']) assert.equal(isPrivateIp(ip), true, ip);
  assert.equal(isPrivateIp('2a01:4f8::1'), false);
});

test('unbekanntes Format gilt als intern', () => {
  assert.equal(isPrivateIp('kein-ip'), true);
});

test('safeFetch lehnt interne Ziele, fremde Ports und andere Protokolle ab', async () => {
  assert.equal(await safeFetch('file:///etc/passwd'), null);
  assert.equal(await safeFetch('http://example.com:8080/'), null);
  assert.equal(await safeFetch('http://nutzer:pw@example.com/'), null);
  await assert.rejects(safeFetch('http://127.0.0.1/'));
  await assert.rejects(safeFetch('http://169.254.169.254/latest/meta-data'));
  await assert.rejects(safeFetch('http://[::1]/'));
  await assert.rejects(safeFetch('http://localhost/'));
});

test('Sitzung: ein Challenge-Cookie gilt nie als Sitzung, alte Sitzungen ohne Typ auch nicht', async () => {
  process.env.SESSION_SECRET = 'test-session-secret-nur-fuer-tests-0123456789abcdef';
  const { createSession, validSession, signChallenge, readChallenge } = await import('../../lib/session.ts');
  const { SignJWT } = await import('jose');
  const challenge = await signChallenge('abc', 'login');
  assert.equal(await validSession(challenge), false);
  assert.equal(await readChallenge(challenge, 'login'), 'abc');
  assert.equal(await readChallenge(challenge, 'register'), null);
  const s = await createSession();
  assert.equal(await validSession(s.value), true);
  assert.equal(await readChallenge(s.value, 'login'), null);
  const alt = await new SignJWT({ sub: 'peter' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  assert.equal(await validSession(alt), false);
  assert.equal(await validSession('kaputt'), false);
});
