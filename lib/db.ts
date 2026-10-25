import postgres from 'postgres';

const g = globalThis as unknown as { __sql?: postgres.Sql; __schema?: Promise<void> };

export const sql: postgres.Sql = g.__sql ?? (g.__sql = postgres(process.env.DATABASE_URL ?? '', {
  max: 5, idle_timeout: 30,
  // Kalendertage (Frist, Uhrzeit-Tag) als 'JJJJ-MM-TT' statt Datum mit Zeitzone
  types: { day: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
}));

export type Item = {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'neu' | 'sortiert' | 'archiv' | 'erledigt';
  typ: 'gedanke' | 'zitat' | 'video' | 'buch' | 'link';
  text: string;
  roh: string | null;
  url: string | null;
  titel: string | null;
  quelle: string | null;
  kategorie: string | null;
  art: string | null;
  schritt: string | null;
  begruendung: string | null;
  kern: string | null;
  frage: string | null;
  parken_bis: string | null;
  fehler: string | null;
  // Priorisierung
  ziel: string | null;
  hebel: number | null;
  aufwand_min: number | null;
  frist: string | null;
  wer: string | null;
  delegieren_an: string | null;
  stapel: string | null;
  rang: number | null;
  grund: string | null;
  sortiert_am: string | null;
  zeit: string | null;
  zeit_tag: string | null;
  erledigt_at: string | null;
  merged_into: string | null;
  manuell_tag: string | null;
  manuell_stapel: string | null;
};

export function ensureSchema(): Promise<void> {
  if (!g.__schema) {
    g.__schema = (async () => {
      await sql`create extension if not exists pgcrypto`;
      await sql`
        create table if not exists items (
          id uuid primary key default gen_random_uuid(),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          status text not null default 'neu',
          typ text not null default 'gedanke',
          text text not null,
          roh text,
          url text,
          titel text,
          quelle text,
          kategorie text,
          art text,
          schritt text,
          begruendung text,
          kern text,
          frage text,
          parken_bis timestamptz,
          fehler text
        )`;
      await sql`create index if not exists items_created on items (created_at desc)`;
      // Version 0.3: Priorisierung. Spalten werden nachgerüstet, bestehende Einträge bleiben.
      await sql`alter table items
        add column if not exists ziel text,
        add column if not exists hebel smallint,
        add column if not exists aufwand_min integer,
        add column if not exists frist date,
        add column if not exists wer text,
        add column if not exists delegieren_an text,
        add column if not exists stapel text,
        add column if not exists rang integer,
        add column if not exists grund text,
        add column if not exists sortiert_am timestamptz,
        add column if not exists zeit text,
        add column if not exists zeit_tag date,
        add column if not exists erledigt_at timestamptz,
        add column if not exists merged_into uuid,
        add column if not exists manuell_tag date,
        add column if not exists manuell_stapel text`;
      await sql`create index if not exists items_stapel on items (stapel) where status = 'sortiert'`;
      await sql`
        create table if not exists korrekturen (
          id bigserial primary key,
          created_at timestamptz not null default now(),
          item_id uuid not null references items(id) on delete cascade,
          von text,
          zu text not null
        )`;
      await sql`
        create table if not exists credentials (
          id text primary key,
          public_key bytea not null,
          counter bigint not null default 0,
          transports text,
          created_at timestamptz not null default now()
        )`;
      await sql`create table if not exists settings (key text primary key, value text not null)`;
    })().catch((e) => { g.__schema = undefined; throw e; });
  }
  return g.__schema;
}

export async function getSetting(key: string): Promise<string> {
  await ensureSchema();
  const rows = await sql`select value from settings where key = ${key}`;
  return rows[0]?.value ?? '';
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSchema();
  await sql`insert into settings (key, value) values (${key}, ${value}) on conflict (key) do update set value = excluded.value`;
}
