import { NextResponse, type NextRequest } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { ensureSchema, sql } from '@/lib/db';
import { CHALLENGE_COOKIE, SESSION_COOKIE, cookieOptions, createSession, readChallenge, sameSecret } from '@/lib/session';
import { rp } from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  const { token, response } = await req.json().catch(() => ({}));
  if (!sameSecret(token, process.env.SETUP_TOKEN)) return NextResponse.json({ error: 'Einrichtungscode stimmt nicht.' }, { status: 403 });
  const challenge = await readChallenge(req.cookies.get(CHALLENGE_COOKIE)?.value, 'register');
  if (!challenge) return NextResponse.json({ error: 'Zeit abgelaufen. Bitte nochmal.' }, { status: 400 });
  const { rpID, origin } = rp(req);
  try {
    const v = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
    if (!v.verified || !v.registrationInfo) throw new Error('nicht bestätigt');
    const c = v.registrationInfo.credential;
    await ensureSchema();
    await sql`insert into credentials (id, public_key, counter, transports) values (${c.id}, ${Buffer.from(c.publicKey)}, ${c.counter}, ${(c.transports ?? []).join(',')})`;
  } catch (e) {
    return NextResponse.json({ error: 'Passkey konnte nicht gespeichert werden: ' + (e as Error).message }, { status: 400 });
  }
  const s = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.value, cookieOptions(s.maxAge));
  res.cookies.delete(CHALLENGE_COOKIE);
  return res;
}
