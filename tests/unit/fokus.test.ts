// Fokus: Phasen des Timers, Wechsel im Musiktest, Auswertung. Alle Daten erfunden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laengeOk, naechsteTestMusik, phase, testAuswerten, uhr, type Bewertung, type Musik } from '../../lib/fokus-regeln.ts';

test('Fokus: Phase aus Startzeit, auch nach dem Schließen der App', () => {
  const s = Date.parse('2026-11-02T09:00:00Z');
  assert.deepEqual(phase(s, 25, 5, s), { phase: 'fokus', restSek: 1500, anteil: 0 });
  assert.equal(phase(s, 25, 5, s + 10 * 60_000).restSek, 900);
  assert.equal(phase(s, 25, 5, s + 26 * 60_000).phase, 'pause');
  assert.equal(phase(s, 25, 5, s + 26 * 60_000).restSek, 240);
  assert.equal(phase(s, 25, 5, s + 31 * 60_000).phase, 'fertig');
  assert.equal(phase(s, 25, 5, s - 5000).restSek, 1500); // Uhr leicht vor: kein Sprung über die Länge
  assert.equal(uhr(905), '15:05');
  assert.equal(laengeOk(50, 10), true);
  assert.equal(laengeOk(50, 5), false);
});

test('Musiktest: wechselt fair ab, die seltenste Art kommt zuerst', () => {
  assert.equal(naechsteTestMusik([]), 'klassik');
  assert.equal(naechsteTestMusik(['klassik']), 'welle');
  assert.equal(naechsteTestMusik(['klassik', 'welle']), 'stille');
  assert.equal(naechsteTestMusik(['klassik', 'welle', 'stille', 'welle', 'rauschen']), 'klassik');
});

test('Musiktest: Auswertung mit Mindestzahl und klarem Abstand', () => {
  const b = (musik: Musik, bewertung: Bewertung | null) => ({ musik, bewertung });
  const wenig = testAuswerten([b('klassik', 'fluss'), b('welle', 'okay')], '2026-11-02', '2026-11-04');
  assert.equal(wenig.tag, 3);
  assert.equal(wenig.beste, null);
  assert.match(wenig.satz, /zu wenige/);
  const klar = testAuswerten([
    b('klassik', 'fluss'), b('klassik', 'fluss'), b('klassik', 'okay'),
    b('stille', 'zaeh'), b('stille', 'okay'), b('stille', 'fluss'),
    b('welle', null), b('welle', 'okay'),
  ], '2026-11-02', '2026-11-20');
  assert.equal(klar.tag, 14);
  assert.equal(klar.fertig, true);
  assert.equal(klar.beste, 'klassik');
  assert.match(klar.satz, /^Ergebnis: Mit Klassik .*67 %/);
  assert.equal(klar.zeilen.find((z) => z.musik === 'welle')!.anteil, null);
  const gleich = testAuswerten([
    b('klassik', 'fluss'), b('klassik', 'okay'), b('klassik', 'okay'),
    b('stille', 'fluss'), b('stille', 'okay'), b('stille', 'okay'),
  ], '2026-11-02', '2026-11-08');
  assert.equal(gleich.beste, null);
  assert.match(gleich.satz, /kein klarer Unterschied/);
});
