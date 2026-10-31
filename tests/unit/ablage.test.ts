import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Ablage: Blöcke, Salz, Wiederholungen, Passphrase, Wiederherstellungsschlüssel', async () => {
  const { blockOk, salzOk, iterationenOk, passphraseOk, wiederText, wiederAusText, ITERATIONEN, BLOCK_MAX } = await import('../../lib/ablage-regeln.ts');
  assert.equal(blockOk('A'.repeat(40)), true);
  assert.equal(blockOk('A'.repeat(38) + '=='), true);
  assert.equal(blockOk('A'.repeat(39)), false);
  assert.equal(blockOk('<script>'.repeat(8)), false);
  assert.equal(blockOk('A'.repeat(BLOCK_MAX + 4)), false);
  assert.equal(blockOk({ block: 'x' }), false);
  assert.equal(salzOk('AAAAAAAAAAAAAAAAAAAAAA=='), true);
  assert.equal(salzOk('AAAA'), false);
  assert.equal(iterationenOk(ITERATIONEN), true);
  assert.equal(iterationenOk(1000), false);
  assert.equal(iterationenOk('600000'), false);
  assert.equal(passphraseOk('kurz'), false);
  assert.equal(passphraseOk('aaaaaaaaaaaaaaaa'), false);
  assert.equal(passphraseOk('Mein Plan bleibt bei mir'), true);
  // Wiederherstellungsschlüssel: 52 Zeichen in Vierergruppen, verwechselbare Zeichen werden verziehen
  const roh = Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) & 255);
  const t = wiederText(roh);
  assert.match(t, /^([0-9A-HJKMNP-TV-Z]{4}-){12}[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.deepEqual(wiederAusText(t), roh);
  assert.deepEqual(wiederAusText(t.toLowerCase().replace(/-/g, ' ')), roh);
  assert.equal(wiederAusText(t.slice(0, -1)), null);
  assert.equal(wiederAusText('U'.repeat(52)), null);
  const null32 = new Uint8Array(32); const ff32 = new Uint8Array(32).fill(255);
  assert.deepEqual(wiederAusText(wiederText(null32)), null32);
  assert.deepEqual(wiederAusText(wiederText(ff32)), ff32);
});

test('Ablage: Inhaltsschlüssel zweimal eingepackt, falsche Passphrase und fremder Block scheitern', async () => {
  const { zufall, neuesSalz, ausPassphrase, ausWiederherstellung, einpacken, auspacken, inhaltsSchluessel, zu, auf } = await import('../../app/ablage-krypto.ts');
  const inhalt = zufall(32); const wieder = zufall(32); const salz = neuesSalz();
  const passBlock = await einpacken(await ausPassphrase('Erfundene lange Passphrase', salz, 1000), inhalt);
  const wiederBlock = await einpacken(await ausWiederherstellung(wieder), inhalt);
  const k = await inhaltsSchluessel(inhalt);
  const block = await zu(k, { art: 'notiz', titel: 'Erfunden', text: 'Geheimer Testtext' });
  assert.ok(!block.includes('Geheim'));
  // Mit Passphrase oder Wiederherstellungsschlüssel geht derselbe Block auf
  const k1 = await auspacken(await ausPassphrase('Erfundene lange Passphrase', salz, 1000), passBlock);
  const k2 = await auspacken(await ausWiederherstellung(wieder), wiederBlock);
  assert.deepEqual(await auf(k1, block), { art: 'notiz', titel: 'Erfunden', text: 'Geheimer Testtext' });
  assert.deepEqual(await auf(k2, block), { art: 'notiz', titel: 'Erfunden', text: 'Geheimer Testtext' });
  await assert.rejects(auspacken(await ausPassphrase('Eine ganz andere Passphrase', salz, 1000), passBlock));
  await assert.rejects(auspacken(await ausWiederherstellung(zufall(32)), wiederBlock));
  // Der Inhaltsschlüssel lässt sich nicht exportieren
  await assert.rejects(crypto.subtle.exportKey('raw', k1));
  assert.notEqual(await zu(k, 'x'), await zu(k, 'x'));
});
