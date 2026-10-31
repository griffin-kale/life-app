import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ensureSchema, ERSTER_NUTZER, getSetting, sql } from './db';
import { cookieOptions, readSession, sameSecret, sessionCookie, signSession, type Sitzung } from './session';
import { OBERGRENZE_TAGE, SITZUNG_TAGE, cookieErneuern } from './ablage-pin';

/**
 * Sitzungen mit Gegenstück in der Datenbank (Tabelle `sitzungen`).
 * Die Middleware prüft nur die Signatur. Jede API-Route prüft zusätzlich hier, ob die Sitzung noch gilt:
 * Abmelden widerruft genau diese Sitzung, „Auf allen Geräten abmelden“ alle.
 */

export { ERSTER_NUTZER };

/**
 * Passwort und Code gehören nur dem ersten Menschen. Andere Menschen dürfen sie weder einrichten noch abschalten,
 * sonst könnten sie sich als der erste Mensch anmelden.
 */
export async function nichtErsterNutzer(): Promise<NextResponse | null> {
  const s = await aktuelleSitzung();
  return s && s.userId !== ERSTER_NUTZER ? NextResponse.json({ error: 'Passwort und Code richtet nur der erste Mensch im Haushalt ein.' }, { status: 403 }) : null;
}

/** Für wen ein neuer Passkey gilt: angemeldet für den Menschen der Sitzung, beim Einrichten für den ersten. */
export async function einrichtenFuer(): Promise<string> {
  return (await aktuelleSitzung())?.userId ?? ERSTER_NUTZER;
}

/** Legt eine Sitzung an und setzt das Cookie auf der Antwort. */
export async function sitzungSetzen(res: NextResponse, userId: string): Promise<NextResponse> {
  await ensureSchema();
  const sid = randomBytes(24).toString('base64url');
  await sql`insert into sitzungen (id, user_id) values (${sid}, ${userId})`;
  const s = await signSession({ sid, userId });
  res.cookies.set(sessionCookie(), s.value, cookieOptions(s.maxAge));
  return res;
}

/** Signatur und Datenbank: gibt die Sitzung zurück, wenn sie gilt. */
export async function pruefeSitzung(token: string | undefined): Promise<Sitzung | null> {
  const s = await readSession(token);
  if (!s) return null;
  await ensureSchema();
  const rows = await sql<{ zuletzt: Date }[]>`
    select zuletzt from sitzungen where id = ${s.sid} and user_id = ${s.userId} and widerrufen is null
      and zuletzt > now() - make_interval(days => ${SITZUNG_TAGE}) and erstellt > now() - make_interval(days => ${OBERGRENZE_TAGE})`;
  if (!rows.length) return null;
  // Höchstens einmal pro Stunde schreiben
  if (Date.now() - new Date(rows[0].zuletzt).getTime() > 3600_000) await sql`update sitzungen set zuletzt = now() where id = ${s.sid}`;
  return s;
}

/**
 * Aktuelle Sitzung aus dem Cookie der Anfrage. Die Sitzung gilt 30 Tage ab der letzten Nutzung, höchstens 90 Tage
 * (Peter, 31.10.2026). Ist das Cookie älter als einen Tag, stellt Life es neu aus, damit es sich mitverlängert.
 */
export async function aktuelleSitzung(): Promise<Sitzung | null> {
  const jar = await cookies();
  const s = await pruefeSitzung(jar.get(sessionCookie())?.value);
  if (s && cookieErneuern(s.iat)) {
    try { const neu = await signSession({ sid: s.sid, userId: s.userId }); jar.set(sessionCookie(), neu.value, cookieOptions(neu.maxAge)); }
    catch { /* außerhalb von Routen lässt Next keine Cookies setzen, dann beim nächsten Mal */ }
  }
  return s;
}

/**
 * Zweiter Riegel mit dem Menschen aus der Sitzung:
 * `const { aus, uid } = await mitNutzer(); if (aus) return aus;`
 * Danach ist `uid` sicher gesetzt. Jede Abfrage filtert nach diesem `uid`, nie nach einem festen Namen.
 */
export async function mitNutzer(): Promise<{ aus: NextResponse; uid: null } | { aus: null; uid: string }> {
  const s = await aktuelleSitzung();
  return s ? { aus: null, uid: s.userId } : { aus: NextResponse.json({ error: 'nicht angemeldet' }, { status: 401 }), uid: null };
}

/** Zweiter Riegel in API-Routen, die keinen Menschen brauchen: `const aus = await ohneSitzung(); if (aus) return aus;` */
export async function ohneSitzung(): Promise<NextResponse | null> {
  return (await aktuelleSitzung()) ? null : NextResponse.json({ error: 'nicht angemeldet' }, { status: 401 });
}

export async function widerrufen(sid: string): Promise<void> {
  await ensureSchema();
  await sql`update sitzungen set widerrufen = now() where id = ${sid} and widerrufen is null`;
}

export async function alleWiderrufen(userId: string): Promise<number> {
  await ensureSchema();
  const r = await sql`update sitzungen set widerrufen = now(), ecke_bis = null where user_id = ${userId} and widerrufen is null returning id`;
  return r.length;
}

/** Noch nichts eingerichtet: kein Passkey und kein Passwort. Nur dann gilt der Einrichtungscode. */
export async function einrichtungOffen(): Promise<boolean> {
  await ensureSchema();
  const [c] = await sql<{ n: number }[]>`select count(*)::int as n from credentials`;
  return c.n === 0 && !(await getSetting('pw_hash'));
}

export type Erlaubnis = 'ok' | 'code-falsch' | 'eingerichtet';

/**
 * Einen Passkey oder Passwort und Code anlegen darf:
 * wer angemeldet ist, oder wer den Einrichtungscode kennt, solange noch nichts eingerichtet ist.
 */
export async function darfEinrichten(token: unknown): Promise<Erlaubnis> {
  if (await aktuelleSitzung()) return 'ok';
  if (!(await einrichtungOffen())) return 'eingerichtet';
  return sameSecret(typeof token === 'string' ? token : '', process.env.SETUP_TOKEN) ? 'ok' : 'code-falsch';
}

export function einrichtenVerboten(e: Exclude<Erlaubnis, 'ok'>): NextResponse {
  return NextResponse.json({ error: e === 'eingerichtet'
    ? 'Life ist schon eingerichtet. Melde dich an und füge das Gerät in den Einstellungen hinzu.'
    : 'Einrichtungscode stimmt nicht.' }, { status: 403 });
}
