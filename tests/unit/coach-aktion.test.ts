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

test('Coach-Aktionen 0.29: Merkzettel, Festhalten, Wochenziel, Saisonvorschlag, höchstens drei', async () => {
  const { aktionPruefen, aktionenPruefen, bestaetigung, SAISON_BEREICHE, MERK_MAX } = await import('../../lib/coach-aktion.ts');
  const { BEREICHE_S } = await import('../../lib/saison-regeln.ts');
  assert.deepEqual([...SAISON_BEREICHE], [...BEREICHE_S]);
  // Merken: Klartext ohne Steuerzeichen, gekürzt, voller Zettel wird abgelehnt
  assert.deepEqual(aktionPruefen({ art: 'merken', text: '  Wohlfühlsumme\n 20.000 €\u0007 ' }, []), { art: 'merken', text: 'Wohlfühlsumme 20.000 €' });
  assert.equal(aktionPruefen({ art: 'merken', text: 'x' }, []), null);
  assert.equal((aktionPruefen({ art: 'merken', text: 'y'.repeat(500) }, []) as { text: string }).text.length, 200);
  assert.ok('fehler' in (aktionPruefen({ art: 'merken', text: 'noch was' }, [], { merkzettel: MERK_MAX, saisonLaeuft: false }) as object));
  // Vergessen nur mit einer Nummer, die es gibt
  assert.deepEqual(aktionPruefen({ art: 'vergessen', nr: 2 }, [], { merkzettel: 3, saisonLaeuft: false }), { art: 'vergessen', nr: 2 });
  assert.ok('fehler' in (aktionPruefen({ art: 'vergessen', nr: 4 }, [], { merkzettel: 3, saisonLaeuft: false }) as object));
  assert.ok('fehler' in (aktionPruefen({ art: 'vergessen', nr: '1; drop' }, [], { merkzettel: 3, saisonLaeuft: false }) as object));
  // Festhalten und Wochenziel
  assert.deepEqual(aktionPruefen({ art: 'festhalten', text: 'Idee für den Winter' }, []), { art: 'festhalten', text: 'Idee für den Winter' });
  assert.equal(aktionPruefen({ art: 'wochenziel', text: 12 }, []), null);
  // Saison: nur bekannte Bereiche, einer pro Bereich, nicht bei laufender Saison
  assert.deepEqual(aktionPruefen({ art: 'saison_vorschlag', ziele: [{ bereich: 'geld', text: 'Puffer füllen' }, { bereich: 'geld', text: 'doppelt' }, { bereich: 'drop table', text: 'x y z' }] }, []),
    { art: 'saison_vorschlag', ziele: [{ bereich: 'geld', text: 'Puffer füllen' }] });
  assert.ok('fehler' in (aktionPruefen({ art: 'saison_vorschlag', ziele: [{ bereich: 'geld', text: 'Puffer füllen' }] }, [], { merkzettel: 0, saisonLaeuft: true }) as object));
  // Liste: höchstens drei, unbekannte fallen weg, altes Feld "aktion" geht weiter
  const vier = aktionenPruefen({ aktionen: [{ art: 'merken', text: 'eins' }, { art: 'sql', text: 'x' }, { art: 'merken', text: 'zwei' }, { art: 'merken', text: 'drei' }] }, []);
  assert.equal(vier.length, 2);
  assert.ok('fehler' in aktionenPruefen({ aktionen: [{ art: 'merken', text: 'eins' }, { art: 'merken', text: 'zwei' }] }, [], { merkzettel: MERK_MAX - 1, saisonLaeuft: false })[1]);
  assert.deepEqual(aktionenPruefen({ aktion: { art: 'sparrate', euro: 100 } }, []), [{ art: 'sparrate', cent: 10000 }]);
  assert.equal(bestaetigung({ art: 'merken', text: 'Wohlfühlsumme 20.000 €' }), '✓ Gemerkt: Wohlfühlsumme 20.000 €');
});
