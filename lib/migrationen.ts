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
/** Ab Schritt 4 pro Mensch: von Claude gelernte Namen. */
export const PRO_NUTZER_2 = ['namen_auto'] as const;

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
  {
    nr: 4, name: 'Gelernte Namen pro Mensch',
    run: (tx) => tx`
      insert into settings (key, value)
      select key || ':peter', value from settings where key in ${tx(PRO_NUTZER_2 as unknown as string[])}
      on conflict (key) do nothing`,
  },
  {
    nr: 5, name: 'Saison mit Zielen, Hebeln und Wochenbewertung (Life 2.0, Phase 2)',
    run: async (tx) => {
      await tx`create table if not exists saisons (
        id bigserial primary key, user_id text not null, start date not null, ende date not null,
        leitsatz text not null default '', erstellt timestamptz not null default now())`;
      await tx`create index if not exists saisons_user on saisons (user_id, ende desc)`;
      await tx`create table if not exists saison_ziele (
        id bigserial primary key, saison_id bigint not null references saisons(id) on delete cascade, user_id text not null,
        bereich text not null, titel text not null, zielwert int, stand int not null default 0,
        wenn text not null default '', dann text not null default '', unique (saison_id, bereich))`;
      await tx`create index if not exists saison_ziele_user on saison_ziele (user_id)`;
      await tx`create table if not exists hebel (
        id bigserial primary key, ziel_id bigint not null references saison_ziele(id) on delete cascade, user_id text not null,
        titel text not null, art text not null default 'kalender', pos int not null default 0)`;
      await tx`create index if not exists hebel_ziel on hebel (ziel_id)`;
      await tx`create table if not exists hebel_wochen (
        hebel_id bigint not null references hebel(id) on delete cascade, user_id text not null,
        montag date not null, bewertung text not null, primary key (hebel_id, montag))`;
    },
  },
  {
    nr: 6, name: 'Fokusblöcke mit Musik und Bewertung (0.27)',
    run: async (tx) => {
      await tx`create table if not exists fokus_bloecke (
        id bigserial primary key, user_id text not null, item_id uuid references items(id) on delete set null,
        titel text not null default '', start timestamptz not null default now(), minuten int not null, pause int not null,
        musik text not null, test boolean not null default false, ende timestamptz, bewertung text)`;
      await tx`create index if not exists fokus_user on fokus_bloecke (user_id, start desc)`;
    },
  },
  {
    nr: 7, name: 'Merkzettel des Coachs und Expertenmeinung (0.29)',
    run: async (tx) => {
      await tx`create table if not exists coach_merken (
        id bigserial primary key, user_id text not null, text text not null, erstellt timestamptz not null default now())`;
      await tx`create index if not exists coach_merken_user on coach_merken (user_id, id)`;
      await tx`alter table coach_chat add column if not exists experte boolean not null default false`;
    },
  },
  {
    nr: 8, name: 'Ablage mit Ende-zu-Ende-Verschlüsselung (0.30)',
    run: async (tx) => {
      // Der Server kennt nur Salz, Wiederholungen und verschlüsselte Blöcke. Art, Titel und Text liegen im Block.
      await tx`create table if not exists ablage (
        user_id text primary key, salz text not null, iterationen int not null,
        pass_block text not null, wieder_block text not null, erstellt timestamptz not null default now())`;
      await tx`create table if not exists ablage_bloecke (
        id uuid primary key default gen_random_uuid(), user_id text not null, block text not null,
        erstellt timestamptz not null default now(), geaendert timestamptz not null default now())`;
      await tx`create index if not exists ablage_bloecke_user on ablage_bloecke (user_id, geaendert desc)`;
    },
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
