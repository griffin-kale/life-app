import postgres from 'postgres';

const g = globalThis as unknown as { __sql?: postgres.Sql; __schema?: Promise<void> };

export const sql: postgres.Sql = g.__sql ?? (g.__sql = postgres(process.env.DATABASE_URL ?? '', { max: 5, idle_timeout: 30 }));

export type Item = {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'neu' | 'sortiert' | 'archiv';
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
