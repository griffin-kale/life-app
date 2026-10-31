import { ensureSchema, getSetting, setSetting, sql } from './db';
import { Hinweis } from './fehler';
import { heuteBerlin } from './zeit';
import {
  BEWERTUNG, MUSIK, TEST_TAGE, laengeOk, naechsteTestMusik, testAuswerten, type Bewertung, type Musik, type TestStand,
} from './fokus-regeln';

/** Fokusblöcke pro Mensch. Die Bewertung bleibt in Life und geht nie an Claude. */

export type Block = { id: number; itemId: string | null; titel: string; start: string; minuten: number; pause: number; musik: Musik; test: boolean; ende: string | null; bewertung: Bewertung | null };
type Zeile = { id: number; item_id: string | null; titel: string; start: Date; minuten: number; pause: number; musik: Musik; test: boolean; ende: Date | null; bewertung: Bewertung | null };
const block = (z: Zeile): Block => ({ id: z.id, itemId: z.item_id, titel: z.titel, start: z.start.toISOString(), minuten: z.minuten, pause: z.pause, musik: z.musik, test: z.test, ende: z.ende?.toISOString() ?? null, bewertung: z.bewertung });
const TEST = (u: string) => `musiktest:${u}`;

/** Der laufende Block: noch nicht beendet und jünger als Fokus plus Pause plus eine Stunde Kulanz. */
export async function laufend(userId: string): Promise<Block | null> {
  await ensureSchema();
  const [z] = await sql<Zeile[]>`
    select * from fokus_bloecke where user_id = ${userId} and ende is null
      and start > now() - make_interval(mins => minuten + pause + 60) order by start desc limit 1`;
  return z ? block(z) : null;
}

export async function testStart(userId: string): Promise<string | null> {
  const t = await getSetting(TEST(userId));
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

export async function testStand(userId: string): Promise<TestStand | null> {
  const start = await testStart(userId);
  if (!start) return null;
  const b = await sql<{ musik: Musik; bewertung: Bewertung | null }[]>`
    select musik, bewertung from fokus_bloecke where user_id = ${userId} and test and start >= ${start}::date`;
  return testAuswerten(b, start, heuteBerlin());
}

/** Welche Musik der Test als Nächstes nimmt. Der Browser startet sie schon beim Tippen, sonst blockt das iPhone den Ton. */
export async function testNaechste(userId: string): Promise<Musik | null> {
  const start = await testStart(userId);
  if (!start || (Date.parse(heuteBerlin() + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86_400_000 >= TEST_TAGE) return null;
  const bisher = await sql<{ musik: Musik }[]>`select musik from fokus_bloecke where user_id = ${userId} and test and start >= ${start}::date`;
  return naechsteTestMusik(bisher.map((b) => b.musik));
}

export async function testStarten(userId: string): Promise<void> { await setSetting(TEST(userId), heuteBerlin()); }
export async function testBeenden(userId: string): Promise<void> { await setSetting(TEST(userId), ''); }

/** Startet einen Block. Im laufenden Test wählt Life die Musik, damit der Vergleich fair bleibt. */
export async function starten(userId: string, e: { itemId: string | null; minuten: number; pause: number; musik: Musik | 'test' }): Promise<Block> {
  await ensureSchema();
  if (!laengeOk(e.minuten, e.pause)) throw new Hinweis('Diese Länge gibt es nicht.');
  if (await laufend(userId)) throw new Hinweis('Es läuft schon ein Fokusblock.');
  let titel = '';
  if (e.itemId) {
    const [it] = await sql<{ titel: string | null; schritt: string | null; text: string }[]>`select titel, schritt, text from items where id = ${e.itemId} and user_id = ${userId}`;
    if (!it) throw new Hinweis('Diese Aufgabe gibt es nicht.');
    titel = (it.schritt || it.titel || it.text).slice(0, 120);
  }
  const start = await testStart(userId);
  // Der Test läuft vom Starttag an genau 14 Kalendertage, danach wählt wieder Peter
  const imTest = !!start && e.musik === 'test' && (Date.parse(heuteBerlin() + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86_400_000 < TEST_TAGE;
  let musik: Musik = e.musik === 'test' ? 'klassik' : e.musik;
  if (imTest) {
    const bisher = await sql<{ musik: Musik }[]>`select musik from fokus_bloecke where user_id = ${userId} and test and start >= ${start}::date`;
    musik = naechsteTestMusik(bisher.map((b) => b.musik));
  }
  if (!MUSIK.includes(musik)) throw new Hinweis('Diese Musik gibt es nicht.');
  const [z] = await sql<Zeile[]>`
    insert into fokus_bloecke (user_id, item_id, titel, minuten, pause, musik, test)
    values (${userId}, ${e.itemId}, ${titel}, ${e.minuten}, ${e.pause}, ${musik}, ${imTest}) returning *`;
  return block(z);
}

/** Beendet einen Block, auf Wunsch mit Bewertung. Nur eigene Blöcke. */
export async function beenden(userId: string, id: number, bewertung: Bewertung | null): Promise<boolean> {
  if (bewertung !== null && !BEWERTUNG.includes(bewertung)) return false;
  const r = await sql`update fokus_bloecke set ende = coalesce(ende, now()), bewertung = coalesce(${bewertung}, bewertung) where id = ${id} and user_id = ${userId}`;
  return r.count > 0;
}

/** Heute gemachte Fokusminuten, für Liste und Wochenrunde. */
export async function fokusHeute(userId: string): Promise<{ bloecke: number; minuten: number }> {
  const [r] = await sql<{ bloecke: number; minuten: number }[]>`
    select count(*)::int as bloecke, coalesce(sum(least(minuten, extract(epoch from (coalesce(ende, now()) - start)) / 60)), 0)::int as minuten
    from fokus_bloecke where user_id = ${userId} and start >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'`;
  return r;
}
