import type { TransactionSql } from 'postgres';

/**
 * Nummerierte Schritte für die Datenbank, ab 0.24.
 * Das Grundschema in `lib/db.ts` bleibt wie es ist (idempotent, `if not exists`).
 * Alles Neue kommt als Schritt hierher: nur anhängen, nie ändern oder umnummerieren.
 * Jeder Schritt läuft in einer eigenen Transaktion, `schema_version` merkt sich, was durch ist.
 */
export type Migration = { nr: number; name: string; run: (tx: TransactionSql) => Promise<unknown> };

/** Einstellungen, die ab 0.24 pro Mensch gelten. Der alte Schlüssel ohne Suffix bleibt eine Version stehen. */
export const PRO_NUTZER = ['kontext', 'ziele', 'team', 'push', 'kompass_stunde', 'sort_am', 'sort_tag'] as const;

export const MIGRATIONEN: Migration[] = [
  {
    nr: 1, name: 'Fehlende Indizes für Korrekturen und Ruhe',
    run: async (tx) => {
      await tx`create index if not exists korrekturen_item on korrekturen (item_id)`;
      await tx`create index if not exists ruhe_tag on ruhe (user_id, tag)`;
    },
  },
  {
    nr: 2, name: 'Einstellungen pro Mensch',
    run: (tx) => tx`
      insert into settings (key, value)
      select key || ':peter', value from settings where key in ${tx(PRO_NUTZER as unknown as string[])}
      on conflict (key) do nothing`,
  },
  {
    nr: 3, name: 'Gesendete Mitteilungen pro Mensch',
    run: (tx) => tx`
      insert into settings (key, value)
      select 'gesendet:peter:' || substr(key, length('gesendet:') + 1), value from settings
      where key like 'gesendet:%' and key not like 'gesendet:peter:%'
      on conflict (key) do nothing`,
  },
];

/** Welche Schritte noch fehlen, in aufsteigender Reihenfolge. Prüft, dass jede Nummer nur einmal vorkommt. */
export function offeneSchritte(fertig: number[], liste: Migration[] = MIGRATIONEN): Migration[] {
  const nrs = liste.map((m) => m.nr);
  if (new Set(nrs).size !== nrs.length) throw new Error('Migration: doppelte Nummer');
  if (nrs.some((n) => !Number.isInteger(n) || n < 1)) throw new Error('Migration: Nummern sind ganze Zahlen ab 1');
  const da = new Set(fertig);
  return liste.filter((m) => !da.has(m.nr)).sort((a, b) => a.nr - b.nr);
}
