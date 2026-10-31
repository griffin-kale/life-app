import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ensureSchema, sql } from './db';
import { readAblage, ablageCookie } from './session';
import { aktuelleSitzung } from './sitzung';
import { EINTRAEGE_MAX } from './ablage-regeln';

/** Antworten aus der Ablage landen in keinem Zwischenspeicher. */
export const OHNE_CACHE = { 'cache-control': 'no-store, max-age=0', pragma: 'no-cache' };

/** Dritter Riegel: Nach Face ID gilt er zehn Minuten, nur für diesen Menschen und diese Sitzung. */
export async function ablageRiegel(uid: string): Promise<NextResponse | null> {
  const s = await aktuelleSitzung();
  const ok = !!s && s.userId === uid && await readAblage((await cookies()).get(ablageCookie())?.value, uid, s.sid);
  return ok ? null : NextResponse.json({ error: 'Zu. Bitte mit Face ID öffnen.' }, { status: 403, headers: OHNE_CACHE });
}

export type AblageKopf = { salz: string; iterationen: number; pass_block: string; wieder_block: string };

export async function ablageKopf(userId: string): Promise<AblageKopf | null> {
  await ensureSchema();
  const [t] = await sql<AblageKopf[]>`select salz, iterationen, pass_block, wieder_block from ablage where user_id = ${userId}`;
  return t ?? null;
}
export async function ablageAnlegen(k: AblageKopf, userId: string): Promise<boolean> {
  await ensureSchema();
  const r = await sql`insert into ablage (user_id, salz, iterationen, pass_block, wieder_block) values (${userId}, ${k.salz}, ${k.iterationen}, ${k.pass_block}, ${k.wieder_block}) on conflict do nothing`;
  return r.count > 0;
}
/** Neue Passphrase, etwa nach dem Öffnen mit dem Wiederherstellungsschlüssel. Der Inhaltsschlüssel bleibt gleich. */
export async function passphraseNeu(k: Pick<AblageKopf, 'salz' | 'iterationen' | 'pass_block'>, userId: string): Promise<boolean> {
  const r = await sql`update ablage set salz = ${k.salz}, iterationen = ${k.iterationen}, pass_block = ${k.pass_block} where user_id = ${userId}`;
  return r.count > 0;
}
/** Passphrase und Wiederherstellungsschlüssel verloren: alles weg. Nur auf ausdrücklichen Wunsch. */
export async function ablageLeeren(userId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`delete from ablage_bloecke where user_id = ${userId}`;
    await tx`delete from ablage where user_id = ${userId}`;
  });
}

export type Block = { id: string; block: string; geaendert: string };
export async function bloecke(userId: string): Promise<Block[]> {
  await ensureSchema();
  return sql<Block[]>`select id, block, geaendert::text as geaendert from ablage_bloecke where user_id = ${userId} order by geaendert desc`;
}
export async function blockNeu(block: string, userId: string): Promise<string | null> {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from ablage_bloecke where user_id = ${userId}`;
  if (n >= EINTRAEGE_MAX) return null;
  const [r] = await sql<{ id: string }[]>`insert into ablage_bloecke (user_id, block) values (${userId}, ${block}) returning id`;
  return r.id;
}
export async function blockAendern(id: string, block: string, userId: string): Promise<boolean> {
  const r = await sql`update ablage_bloecke set block = ${block}, geaendert = now() where id = ${id} and user_id = ${userId}`;
  return r.count > 0;
}
export async function blockWeg(id: string, userId: string): Promise<boolean> {
  const r = await sql`delete from ablage_bloecke where id = ${id} and user_id = ${userId}`;
  return r.count > 0;
}
export const uuidOk = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
