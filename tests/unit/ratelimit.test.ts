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
