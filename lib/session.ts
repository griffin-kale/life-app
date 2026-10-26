import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'life_session';
export const CHALLENGE_COOKIE = 'life_challenge';
const SESSION_DAYS = 30;

function geheimnis(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen');
  return s;
}

/**
 * Eigener Schlüssel pro Zweck, abgeleitet aus SESSION_SECRET (HMAC-SHA-256 mit Zweck als Nachricht).
 * Ein Challenge-Cookie kann so nie als Sitzung gelten, auch wenn jemand die Prüfung der Claims vergisst.
 */
const schluessel = new Map<string, Promise<Uint8Array>>();
function key(zweck: 'sitzung' | 'challenge'): Promise<Uint8Array> {
  const roh = geheimnis();
  const k = `${zweck}|${roh}`;
  if (!schluessel.has(k)) schluessel.set(k, (async () => {
    const basis = await crypto.subtle.importKey('raw', new TextEncoder().encode(roh), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', basis, new TextEncoder().encode(`life:${zweck}:v1`)));
  })());
  return schluessel.get(k)!;
}

export async function createSession(): Promise<{ value: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 24 * 3600;
  const value = await new SignJWT({ sub: 'peter', typ: 'sitzung' }).setProtectedHeader({ alg: 'HS256' }).setAudience('life:sitzung').setIssuedAt().setExpirationTime(`${SESSION_DAYS}d`).sign(await key('sitzung'));
  return { value, maxAge };
}

export async function validSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, await key('sitzung'), { algorithms: ['HS256'], audience: 'life:sitzung' });
    return payload.typ === 'sitzung' && payload.sub === 'peter';
  } catch { return false; }
}

/** Challenge für Passkey-Anmeldung, 5 Minuten gültig, signiert im Cookie. */
export async function signChallenge(challenge: string, purpose: 'register' | 'login' | 'whoop'): Promise<string> {
  return new SignJWT({ c: challenge, p: purpose, typ: 'challenge' }).setProtectedHeader({ alg: 'HS256' }).setAudience('life:challenge').setExpirationTime('5m').sign(await key('challenge'));
}

export async function readChallenge(token: string | undefined, purpose: 'register' | 'login' | 'whoop'): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await key('challenge'), { algorithms: ['HS256'], audience: 'life:challenge' });
    return payload.typ === 'challenge' && payload.p === purpose && typeof payload.c === 'string' ? payload.c : null;
  } catch { return null; }
}

export const cookieOptions = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge });

/** Vergleicht zwei Geheimnisse in konstanter Zeit. */
export function sameSecret(a: string | null | undefined, b: string | undefined): boolean {
  if (!a || !b || b.length < 24) return false;
  const x = new TextEncoder().encode(a); const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
