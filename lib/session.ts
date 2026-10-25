import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'lage_session';
export const CHALLENGE_COOKIE = 'lage_challenge';
const SESSION_DAYS = 30;

function key(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen');
  return new TextEncoder().encode(s);
}

export async function createSession(): Promise<{ value: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 24 * 3600;
  const value = await new SignJWT({ sub: 'peter' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${SESSION_DAYS}d`).sign(key());
  return { value, maxAge };
}

export async function validSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try { await jwtVerify(token, key(), { algorithms: ['HS256'] }); return true; } catch { return false; }
}

/** Challenge für Passkey-Anmeldung, 5 Minuten gültig, signiert im Cookie. */
export async function signChallenge(challenge: string, purpose: 'register' | 'login'): Promise<string> {
  return new SignJWT({ c: challenge, p: purpose }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('5m').sign(key());
}

export async function readChallenge(token: string | undefined, purpose: 'register' | 'login'): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    return payload.p === purpose && typeof payload.c === 'string' ? payload.c : null;
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
