import { SignJWT, jwtVerify } from 'jose';

/**
 * Signierte Cookies für Sitzung und Challenge. Läuft auch in der Middleware (Edge), deshalb ohne Datenbank.
 * Ob eine Sitzung widerrufen ist, prüft `lib/sitzung.ts` in jeder API-Route gegen die Tabelle `sitzungen`.
 */

/** Über HTTPS tragen die Cookies den Präfix __Host-: nur diese Domain, nur HTTPS, Pfad /. Lokal und in Tests ohne. */
export const sicher = () => (process.env.PUBLIC_ORIGIN ?? '').startsWith('https://');
const name = (n: string) => (sicher() ? `__Host-${n}` : n);
export const sessionCookie = () => name('life_session');
export const challengeCookie = () => name('life_challenge');

const SESSION_DAYS = 30; // gleich SITZUNG_TAGE in lib/ablage-pin.ts

function geheimnis(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen');
  return s;
}

/**
 * Eigener Schlüssel pro Zweck, abgeleitet aus SESSION_SECRET (HMAC-SHA-256 mit Zweck als Nachricht).
 * Ein Challenge-Cookie kann so nie als Sitzung gelten, auch wenn jemand die Prüfung der Claims vergisst.
 * v2 seit 0.16: Sitzungen tragen eine Kennung (sid), ältere Sitzungen gelten nicht mehr.
 */
const schluessel = new Map<string, Promise<Uint8Array>>();
function key(zweck: 'sitzung' | 'challenge'): Promise<Uint8Array> {
  const roh = geheimnis();
  const k = `${zweck}|${roh}`;
  if (!schluessel.has(k)) schluessel.set(k, (async () => {
    const basis = await crypto.subtle.importKey('raw', new TextEncoder().encode(roh), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', basis, new TextEncoder().encode(`life:${zweck}:v2`)));
  })());
  return schluessel.get(k)!;
}

/** iat: wann das Cookie ausgestellt wurde (Sekunden), damit es sich bei Nutzung verlängern kann. */
export type Sitzung = { sid: string; userId: string; iat?: number };

/** Signiert eine Sitzung. Anlegen in der Datenbank übernimmt `neueSitzung` in lib/sitzung.ts. */
export async function signSession(s: Sitzung): Promise<{ value: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 24 * 3600;
  const value = await new SignJWT({ sub: s.userId, sid: s.sid, typ: 'sitzung' }).setProtectedHeader({ alg: 'HS256' }).setAudience('life:sitzung').setIssuedAt().setExpirationTime(`${SESSION_DAYS}d`).sign(await key('sitzung'));
  return { value, maxAge };
}

/** Prüft nur die Signatur. Ob die Sitzung widerrufen wurde, weiß erst die Datenbank. */
export async function readSession(token: string | undefined): Promise<Sitzung | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await key('sitzung'), { algorithms: ['HS256'], audience: 'life:sitzung' });
    if (payload.typ !== 'sitzung' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(payload.sid)) return null;
    return { sid: payload.sid, userId: payload.sub, iat: typeof payload.iat === 'number' ? payload.iat : undefined };
  } catch { return null; }
}

export async function validSession(token: string | undefined): Promise<boolean> {
  return (await readSession(token)) !== null;
}

/** Challenge für Passkey-Anmeldung, 5 Minuten gültig, signiert im Cookie. */
export async function signChallenge(challenge: string, purpose: 'register' | 'login' | 'whoop' | 'ablage'): Promise<string> {
  return new SignJWT({ c: challenge, p: purpose, typ: 'challenge' }).setProtectedHeader({ alg: 'HS256' }).setAudience('life:challenge').setExpirationTime('5m').sign(await key('challenge'));
}

export async function readChallenge(token: string | undefined, purpose: 'register' | 'login' | 'whoop' | 'ablage'): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await key('challenge'), { algorithms: ['HS256'], audience: 'life:challenge' });
    return payload.typ === 'challenge' && payload.p === purpose && typeof payload.c === 'string' ? payload.c : null;
  } catch { return null; }
}

export const cookieOptions = (maxAge: number) => ({ httpOnly: true, secure: sicher() || process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge });

/** Vergleicht zwei Geheimnisse in konstanter Zeit. */
export function sameSecret(a: string | null | undefined, b: string | undefined): boolean {
  if (!a || !b || b.length < 24) return false;
  const x = new TextEncoder().encode(a); const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Erlaubte Herkunft für schreibende Anfragen. Ohne PUBLIC_ORIGIN (lokal) zählt der Host der Anfrage. */
export function erlaubteHerkunft(host: string | null, proto: string | null): string | null {
  if (process.env.PUBLIC_ORIGIN) return new URL(process.env.PUBLIC_ORIGIN).origin;
  if (!host) return null;
  return `${proto ?? 'http'}://${host}`;
}
