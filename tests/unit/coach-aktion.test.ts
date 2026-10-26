import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Coach-Aktion: nur bekannte Sparziele, Beträge geprüft, Bestätigung von Life', async () => {
  const { aktionPruefen, bestaetigung } = await import('../../lib/coach-aktion.ts');
  const ziele = ['Urlaub', 'Fahrrad'];
  assert.equal(aktionPruefen(null, ziele), null);
  assert.equal(aktionPruefen({ art: 'loeschen' }, ziele), null);
  const a = aktionPruefen({ art: 'sparziel_ziel', ziel: 'urlaub', euro: 3000 }, ziele);
  assert.deepEqual(a, { art: 'sparziel_ziel', ziel: 'Urlaub', cent: 300000 });
  assert.match(bestaetigung(a as never), /Urlaub.*3\.000 €/);
  assert.ok('fehler' in (aktionPruefen({ art: 'sparziel_ziel', ziel: 'Auto', euro: 5000 }, ziele) as object));
  assert.ok('fehler' in (aktionPruefen({ art: 'sparziel_ziel', ziel: 'Urlaub', euro: 0 }, ziele) as object));
  assert.ok('fehler' in (aktionPruefen({ art: 'ruecklage', euro: -5 }, ziele) as object));
  assert.ok('fehler' in (aktionPruefen({ art: 'sparrate', euro: 'viel' }, ziele) as object));
  assert.deepEqual(aktionPruefen({ art: 'ruecklage', euro: '8.000,50' }, ziele), { art: 'ruecklage', cent: 800050 });
  assert.deepEqual(aktionPruefen({ art: 'sparrate', euro: 450 }, []), { art: 'sparrate', cent: 45000 });
});

test('Coach: starkes Modell bei Entscheidungen und Überlastung, sonst Standard', async () => {
  const { entscheidend } = await import('../../lib/coach-aktion.ts');
  assert.equal(entscheidend('Was jetzt?'), false);
  assert.equal(entscheidend('Ich bin müde'), false);
  assert.equal(entscheidend('Soll ich das Angebot annehmen?'), true);
  assert.equal(entscheidend('ich bin total überfordert heute'), true);
  assert.equal(entscheidend('Hilf mir die Woche planen'), true);
  assert.equal(entscheidend('x'.repeat(300)), true);
  assert.equal(entscheidend('Ich habe Sorgen wegen Geld'), true);
  assert.equal(entscheidend('Schorgen'), false);
});
