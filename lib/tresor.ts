import { ensureSchema, sql } from './db';
import { aufschliessen, neuerSchluessel, veraltet, zuschliessen } from './passwort-core';

/** Welcher gespeicherte Schlüssel zu welchem Zweck gehört. */
function zweck(key: string): string | null {
  if (key === 'totp_enc') return 'totp';
  if (key === 'vapid_private') return 'vapid';
  if (key.startsWith('whoop_tokens:')) return 'whoop';
  return null;
}

/**
 * Hebt beim Start alle Geheimnisse von SESSION_SECRET (v1) auf ENCRYPTION_KEY (v2), in einer Transaktion.
 * Ohne ENCRYPTION_KEY passiert nichts. Ins Log kommt nur die Anzahl. Eine laufende Einrichtung (pw_pending,
 * 10 Minuten gültig) wird verworfen statt umgeschlüsselt.
 */
export async function umschluesseln(): Promise<number> {
  if (!neuerSchluessel()) return 0;
  await ensureSchema();
  let n = 0;
  await sql.begin(async (tx) => {
    const rows = await tx<{ key: string; value: string }[]>`
      select key, value from settings where (key in ('totp_enc', 'vapid_private') or key like 'whoop_tokens:%') and value like 'v1.%' for update`;
    for (const r of rows) {
      const z = zweck(r.key);
      if (!z || !veraltet(r.value)) continue;
      await tx`update settings set value = ${zuschliessen(aufschliessen(r.value, z), z)} where key = ${r.key}`;
      n++;
    }
    await tx`update settings set value = '' where key = 'pw_pending' and value like '%"enc":"v1.%'`;
  });
  if (n) console.log('[tresor] umgeschlüsselt', n);
  return n;
}
