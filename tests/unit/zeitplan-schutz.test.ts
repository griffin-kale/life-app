import { test } from 'node:test';
import assert from 'node:assert/strict';
import { einmalMit, ohneUeberlappung, zeitplanStatus, VERZUG_MS, type EinmalSpeicher } from '../../lib/zeitplan-schutz.ts';

/** Speicher wie die Datenbank: beanspruchen ist atomar, weil JavaScript zwischen den Zeilen nicht wechselt. */
function speicher(): EinmalSpeicher & { werte: Map<string, string> } {
  const werte = new Map<string, string>();
  return {
    werte,
    async beanspruchen(k, tag) {
      const vorher = werte.get(k) ?? null;
      if (vorher === tag) return { ok: false, vorher };
      werte.set(k, tag);
      await new Promise((r) => setTimeout(r, 5)); // anderer Lauf kommt dazwischen
      return { ok: true, vorher };
    },
    async zuruecksetzen(k, tag, vorher) {
      if (werte.get(k) !== tag) return;
      if (vorher === null) werte.delete(k); else werte.set(k, vorher);
    },
  };
}

test('einmal: zwei gleichzeitige Läufe senden nur einmal', async () => {
  const s = speicher();
  let gesendet = 0;
  const senden = async () => { gesendet++; await new Promise((r) => setTimeout(r, 10)); return true; };
  await Promise.all([einmalMit(s, 'morgen', '2026-10-26', senden), einmalMit(s, 'morgen', '2026-10-26', senden)]);
  assert.equal(gesendet, 1);
  // Am nächsten Tag wieder
  await einmalMit(s, 'morgen', '2026-10-27', senden);
  assert.equal(gesendet, 2);
});

test('einmal: klappt das Senden nicht, versucht es der nächste Lauf wieder', async () => {
  const s = speicher();
  s.werte.set('abend', '2026-10-25');
  assert.equal(await einmalMit(s, 'abend', '2026-10-26', async () => false), false);
  assert.equal(s.werte.get('abend'), '2026-10-25');
  await assert.rejects(einmalMit(s, 'abend', '2026-10-26', async () => { throw new Error('Push weg'); }));
  assert.equal(s.werte.get('abend'), '2026-10-25');
  assert.equal(await einmalMit(s, 'abend', '2026-10-26', async () => true), true);
  assert.equal(s.werte.get('abend'), '2026-10-26');
});

test('Zeitplan überlappt nicht, auch wenn ein Lauf länger als eine Minute braucht', async () => {
  let gleichzeitig = 0; let hoechstens = 0; let laeufe = 0;
  const lauf = ohneUeberlappung(async (f) => { await f(); return true; });
  const arbeit = async () => { gleichzeitig++; laeufe++; hoechstens = Math.max(hoechstens, gleichzeitig); await new Promise((r) => setTimeout(r, 20)); gleichzeitig--; };
  const ergebnisse = await Promise.all([lauf(arbeit), lauf(arbeit), lauf(arbeit)]);
  assert.deepEqual(ergebnisse, [true, false, false]);
  assert.equal(hoechstens, 1);
  assert.equal(laeufe, 1);
  // Danach geht der nächste Lauf wieder
  assert.equal(await lauf(arbeit), true);
});

test('Zeitplan überlappt nicht über Prozesse: hält ein anderer die Sperre, läuft nichts', async () => {
  let laeufe = 0;
  const lauf = ohneUeberlappung(async () => false); // pg_try_advisory_lock liefert false
  assert.equal(await lauf(async () => { laeufe++; }), false);
  assert.equal(laeufe, 0);
});

test('Gesundheit: 503 erst ab fünf Minuten Verzug, nicht direkt nach dem Start', () => {
  const jetzt = Date.parse('2026-10-26T12:00:00Z');
  assert.equal(zeitplanStatus({ letzter: jetzt - 60_000, jetzt, laeuftSeitMs: 3_600_000, aus: false }), 'ok');
  assert.equal(zeitplanStatus({ letzter: jetzt - VERZUG_MS - 1, jetzt, laeuftSeitMs: 3_600_000, aus: false }), 'verzug');
  assert.equal(zeitplanStatus({ letzter: null, jetzt, laeuftSeitMs: 30_000, aus: false }), 'startet');
  assert.equal(zeitplanStatus({ letzter: null, jetzt, laeuftSeitMs: VERZUG_MS + 1, aus: false }), 'verzug');
  assert.equal(zeitplanStatus({ letzter: null, jetzt, laeuftSeitMs: 3_600_000, aus: true }), 'aus');
});
