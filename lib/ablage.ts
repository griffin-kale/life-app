import { NextResponse } from 'next/server';
import { ensureSchema, sql } from './db';
import { hashPasswort, pruefePasswort } from './passwort-core';
import { PIN_MAX_FEHL, PIN_TEXT, pinVersuch, riegelBis, type PinErgebnis } from './ablage-pin';
import { aktuelleSitzung } from './sitzung';
import { heuteBerlin, jetztBerlin } from './zeit';
import { EINTRAEGE_MAX } from './ablage-regeln';

/** Antworten aus der Ablage landen in keinem Zwischenspeicher. */
export const OHNE_CACHE = { 'cache-control': 'no-store, max-age=0', pragma: 'no-cache' };

/**
 * Dritter Riegel (seit 0.31.2 auf dem Server): offen liegt an genau dieser Sitzung in `sitzungen.ecke_bis`.
 * Jede Anfrage prüft und verlängert ihn um 5 Minuten. Ohne Nutzung, beim Verlassen und beim Abmelden ist er zu.
 */
export async function ablageRiegel(uid: string): Promise<NextResponse | null> {
  const s = await aktuelleSitzung();
  if (s && s.userId === uid) {
    const r = await sql`update sitzungen set ecke_bis = ${riegelBis()} where id = ${s.sid} and user_id = ${uid} and widerrufen is null and ecke_bis > now() returning id`;
    if (r.length) return null;
  }
  return NextResponse.json({ error: 'Zu. Bitte neu öffnen.' }, { status: 403, headers: OHNE_CACHE });
}
/** Riegel öffnen. bestaetigt: nach Passkey oder Passwort plus Code, nicht nach PIN. */
export async function riegelAuf(sid: string, uid: string, bestaetigt: boolean): Promise<void> {
  await sql`update sitzungen set ecke_bis = ${riegelBis()}, bestaetigt = ${bestaetigt ? sql`now()` : sql`bestaetigt`} where id = ${sid} and user_id = ${uid}`;
}
export async function riegelZu(sid: string): Promise<void> {
  await sql`update sitzungen set ecke_bis = null where id = ${sid}`;
}
export async function bestaetigtUm(sid: string): Promise<Date | null> {
  const [r] = await sql<{ bestaetigt: Date | null }[]>`select bestaetigt from sitzungen where id = ${sid}`;
  return r?.bestaetigt ?? null;
}

/** PIN-Stand ohne die PIN selbst. */
export async function pinStand(uid: string): Promise<{ gesetzt: boolean; gesperrt: boolean }> {
  await ensureSchema();
  const [r] = await sql<{ fehl: number }[]>`select fehl from ablage_pin where user_id = ${uid}`;
  return { gesetzt: !!r, gesperrt: !!r && r.fehl >= PIN_MAX_FEHL };
}
/** PIN speichern, nur als scrypt-Hash. Der Zähler steht danach auf null. */
export async function pinSetzen(pin: string, uid: string): Promise<void> {
  await sql`insert into ablage_pin (user_id, hash, fehl) values (${uid}, ${hashPasswort(pin)}, 0)
    on conflict (user_id) do update set hash = excluded.hash, fehl = 0, geaendert = now()`;
}
export async function pinZaehlerNull(uid: string): Promise<void> {
  await sql`update ablage_pin set fehl = 0 where user_id = ${uid}`;
}
/** Prüft eine PIN in konstanter Zeit (scrypt und timingSafeEqual) und zählt Fehlversuche, gesperrt unter Sperre der Zeile. */
export async function pinPruefen(pin: string, uid: string): Promise<PinErgebnis | null> {
  return sql.begin(async (tx) => {
    const [r] = await tx<{ hash: string; fehl: number }[]>`select hash, fehl from ablage_pin where user_id = ${uid} for update`;
    if (!r) return null;
    const e = pinVersuch(r.fehl, pruefePasswort(pin, r.hash));
    if (e.fehl !== r.fehl) await tx`update ablage_pin set fehl = ${e.fehl} where user_id = ${uid}`;
    return e;
  }) as Promise<PinErgebnis | null>;
}
export { PIN_TEXT };

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

/** Neutraler Hinweis auf Heute (Peter, 31.10.2026): ab 18 Uhr, wenn heute noch keine Abendfrage beantwortet ist. Kein Inhalt, nur ein Datum. */
export async function frageOffen(userId: string): Promise<boolean> {
  await ensureSchema();
  const [t] = await sql<{ zuletzt: string | null }[]>`select zuletzt::text as zuletzt from ablage where user_id = ${userId}`;
  return !!t && t.zuletzt !== heuteBerlin() && jetztBerlin().stunde >= 18;
}
export async function frageBeantwortet(userId: string): Promise<void> {
  await sql`update ablage set zuletzt = ${heuteBerlin()} where user_id = ${userId}`;
}
