import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Begrenzung greift nach max Versuchen und gibt das Fenster wieder frei', async () => {
  const { hit, _reset } = await import('../../lib/ratelimit-core.ts');
  _reset();
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(hit('x', 3, 60_000, t0).ok, true);
  const vierter = hit('x', 3, 60_000, t0);
  assert.equal(vierter.ok, false);
  assert.equal(vierter.retryAfter, 60);
  assert.equal(hit('anderer', 3, 60_000, t0).ok, true);
  assert.equal(hit('x', 3, 60_000, t0 + 60_001).ok, true);
});

test('voll() zählt nicht mit: nur Fehlversuche sperren', async () => {
  const { hit, voll, _reset } = await import('../../lib/ratelimit-core.ts');
  _reset();
  const t0 = 2_000_000;
  for (let i = 0; i < 100; i++) assert.equal(voll('g', 3, t0).ok, true); // viele erfolgreiche Anfragen sperren nichts
  for (let i = 0; i < 3; i++) hit('g', 3, 60_000, t0);
  assert.equal(voll('g', 3, t0).ok, false);
  assert.equal(voll('g', 3, t0 + 60_001).ok, true);
});
