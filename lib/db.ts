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
  wenn?: string | null;
  energie?: number | null;
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
      // Version 0.6: mehrere Menschen pro Haushalt vorbereiten. Sichtbar ist vorerst nur Peter.
      await sql`create table if not exists haushalte (id text primary key, name text not null, created_at timestamptz not null default now())`;
      await sql`create table if not exists nutzer (id text primary key, haushalt_id text not null references haushalte(id), name text not null, rolle text not null default 'erwachsen', created_at timestamptz not null default now())`;
      await sql`insert into haushalte (id, name) values ('gneuss', 'Familie') on conflict do nothing`;
      await sql`insert into nutzer (id, haushalt_id, name) values ('peter', 'gneuss', 'Peter') on conflict do nothing`;
      for (const t of ['items', 'korrekturen', 'credentials']) {
        await sql.unsafe(`alter table ${t} add column if not exists user_id text not null default 'peter' references nutzer(id)`);
      }
      await sql`create index if not exists items_user on items (user_id, created_at desc)`;
      await sql`
        create table if not exists checkins (
          id bigserial primary key,
          user_id text not null default 'peter' references nutzer(id),
          art text not null check (art in ('morgen', 'abend', 'woche')),
          tag date not null,
          antworten jsonb not null,
          created_at timestamptz not null default now(),
          unique (user_id, art, tag)
        )`;
      await sql`
        create table if not exists coach (
          user_id text not null default 'peter' references nutzer(id),
          tag date not null,
          art text not null check (art in ('morgen', 'abend')),
          antwort jsonb not null,
          created_at timestamptz not null default now(),
          primary key (user_id, tag, art)
        )`;
      // Version 0.7: Körper (WHOOP, Training, Essen) und Mitteilungen
      await sql`alter table nutzer add column if not exists gewicht_kg numeric`;
      await sql`
        create table if not exists koerper_tage (
          user_id text not null references nutzer(id),
          tag date not null,
          schlaf_min integer, schlaf_leistung integer, erholung integer, hrv numeric, ruhepuls integer, belastung numeric,
          updated_at timestamptz not null default now(),
          primary key (user_id, tag)
        )`;
      await sql`
        create table if not exists trainings (
          id bigserial primary key,
          user_id text not null references nutzer(id),
          quelle text not null check (quelle in ('life', 'whoop')),
          extern_id text not null,
          tag date not null,
          start timestamptz,
          dauer_min integer,
          art text not null check (art in ('kraft', 'zone2', 'intervall', 'mobil', 'sonstiges')),
          sport text,
          belastung numeric, zone2_min integer, zone45_min integer,
          saetze jsonb, feedback jsonb,
          created_at timestamptz not null default now(),
          unique (user_id, quelle, extern_id)
        )`;
      await sql`create index if not exists trainings_tag on trainings (user_id, tag desc)`;
      await sql`create table if not exists training_stand (user_id text primary key references nutzer(id), stand jsonb not null, updated_at timestamptz not null default now())`;
      await sql`
        create table if not exists lebensmittel (
          ean text primary key, name text not null, marke text,
          kcal numeric, protein numeric, kh numeric, fett numeric, portion_g numeric,
          updated_at timestamptz not null default now()
        )`;
      await sql`
        create table if not exists mahlzeiten (
          id bigserial primary key,
          user_id text not null references nutzer(id),
          tag date not null,
          created_at timestamptz not null default now(),
          mahlzeit text not null check (mahlzeit in ('fruehstueck', 'mittag', 'abend', 'snack')),
          quelle text not null check (quelle in ('barcode', 'text', 'foto')),
          name text not null, gramm numeric,
          kcal numeric, kcal_bis numeric, protein numeric, protein_bis numeric, kh numeric, fett numeric,
          gemuese boolean
        )`;
      await sql`create index if not exists mahlzeiten_tag on mahlzeiten (user_id, tag)`;
      await sql`
        create table if not exists ruhe (
          id bigserial primary key,
          user_id text not null references nutzer(id),
          tag date not null,
          art text not null check (art in ('stille', 'atem', 'nsdr', 'wimhof', 'runter')),
          dauer_sek integer not null,
          created_at timestamptz not null default now()
        )`;
      // Version 0.9: Geld für den Haushalt
      await sql`
        create table if not exists geld_toepfe (
          id bigserial primary key,
          haushalt_id text not null references haushalte(id),
          name text not null,
          art text not null check (art in ('woche', 'spar', 'kind')),
          betrag_cent integer not null default 0,
          stand_cent integer not null default 0,
          start date not null default current_date,
          sortierung integer not null default 0,
          aktiv boolean not null default true,
          created_at timestamptz not null default now()
        )`;
      await sql`
        create table if not exists geld_buchungen (
          id bigserial primary key,
          haushalt_id text not null references haushalte(id),
          user_id text not null references nutzer(id),
          tag date not null,
          cent integer not null,
          topf_id bigint references geld_toepfe(id) on delete set null,
          was text not null,
          quelle text not null check (quelle in ('sprache', 'bon', 'hand')),
          created_at timestamptz not null default now()
        )`;
      await sql`create index if not exists geld_buchungen_tag on geld_buchungen (haushalt_id, tag desc)`;
      await sql`
        create table if not exists geld_posten (
          id bigserial primary key,
          haushalt_id text not null references haushalte(id),
          art text not null check (art in ('einnahme', 'fest', 'schuld')),
          name text not null,
          cent integer not null,
          created_at timestamptz not null default now()
        )`;
      await sql`
        create table if not exists geld_profil (
          haushalt_id text primary key references haushalte(id),
          ruecklage_cent integer not null default 0,
          sparrate_cent integer not null default 0,
          puffer_monate integer not null default 12,
          updated_at timestamptz not null default now()
        )`;
      // Version 0.11: Menschen und Zeit
      await sql`
        create table if not exists personen (
          id bigserial primary key,
          user_id text not null references nutzer(id),
          name text not null,
          kreis text not null check (kreis in ('familie', 'freunde', 'team', 'netzwerk')),
          geburtstag date,
          takt_tage integer not null default 21,
          notiz text,
          created_at timestamptz not null default now(),
          unique (user_id, name)
        )`;
      await sql`
        create table if not exists kontakte (
          id bigserial primary key,
          user_id text not null references nutzer(id),
          person_id bigint not null references personen(id) on delete cascade,
          tag date not null,
          art text not null check (art in ('treffen', 'telefon', 'nachricht', 'eintrag')),
          minuten integer,
          item_id uuid references items(id) on delete set null,
          created_at timestamptz not null default now()
        )`;
      await sql`create index if not exists kontakte_person on kontakte (person_id, tag desc)`;
      await sql`create unique index if not exists kontakte_item on kontakte (person_id, item_id) where item_id is not null`;
      await sql`
        create table if not exists zeit_kaufen (
          id bigserial primary key,
          user_id text not null references nutzer(id),
          was text not null,
          stunden_monat numeric not null,
          kosten_cent integer,
          status text not null default 'idee' check (status in ('idee', 'gemacht')),
          created_at timestamptz not null default now()
        )`;
      await sql`alter table items add column if not exists wenn text, add column if not exists energie smallint`;
      // Version 0.14: Gespräch mit dem Coach, gilt pro Tag
      await sql`
        create table if not exists coach_chat (
          id bigserial primary key,
          user_id text not null references nutzer(id),
          tag date not null,
          rolle text not null check (rolle in ('ich', 'coach')),
          text text not null,
          created_at timestamptz not null default now()
        )`;
      await sql`create index if not exists coach_chat_tag on coach_chat (user_id, tag, id)`;
      // Version 0.15: Standortbestimmung in drei Etappen, Antworten und Auswertung
      await sql`
        create table if not exists standort (
          id bigserial primary key,
          user_id text not null references nutzer(id),
          etappe smallint not null check (etappe between 1 and 3),
          antworten jsonb not null,
          auswertung jsonb,
          created_at timestamptz not null default now()
        )`;
      await sql`create index if not exists standort_user on standort (user_id, etappe, id)`;
      // Kalender aus iCloud, nur gelesen: Liste der Kalender und die Termine der nächsten Tage
      await sql`
        create table if not exists kalender (
          user_id text not null references nutzer(id),
          href text not null,
          name text not null,
          farbe text not null default '',
          an boolean not null default true,
          art text not null default 'privat' check (art in ('privat', 'familie', 'arbeit')),
          primary key (user_id, href)
        )`;
      await sql`
        create table if not exists termine (
          user_id text not null references nutzer(id),
          kalender text not null,
          uid text not null,
          beginn timestamptz not null,
          ende timestamptz not null,
          ganztag boolean not null default false,
          titel text not null default '',
          primary key (user_id, kalender, uid, beginn)
        )`;
      await sql`create index if not exists termine_zeit on termine (user_id, beginn)`;
      // Rückmeldungen aller Nutzenden: Fehler, Verbesserungen, Ideen
      await sql`
        create table if not exists rueckmeldungen (
          id bigserial primary key,
          user_id text not null references nutzer(id),
          art text not null check (art in ('fehler', 'verbesserung', 'idee')),
          bereich text not null,
          gewicht text not null check (gewicht in ('kaum', 'nervt', 'blockiert')),
          text text,
          seite text, version text, geraet text,
          status text not null default 'neu' check (status in ('neu', 'geplant', 'erledigt', 'abgelehnt')),
          github_nr integer,
          created_at timestamptz not null default now()
        )`;
      await sql`
        create table if not exists push_abos (
          id bigserial primary key,
          user_id text not null references nutzer(id),
          endpoint text not null unique, p256dh text not null, auth text not null,
          created_at timestamptz not null default now()
        )`;
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
