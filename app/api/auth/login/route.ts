import { NextResponse, type NextRequest } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { ensureSchema, sql } from '@/lib/db';
import { CHALLENGE_COOKIE, SESSION_COOKIE, cookieOptions, createSession, readChallenge } from '@/lib/session';
import { rp } from '@/lib/webauthn';
import { begrenzt } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'anmelden'); if (zuViel) return zuViel;
  const { response } = await req.json().catch(() => ({}));
  const challenge = await readChallenge(req.cookies.get(CHALLENGE_COOKIE)?.value, 'login');
  if (!challenge || !response?.id) return NextResponse.json({ error: 'Zeit abgelaufen. Bitte nochmal.' }, { status: 400 });
  await ensureSchema();
  const rows = await sql`select id, public_key, counter, transports from credentials where id = ${response.id}`;
  const cred = rows[0];
  if (!cred) return NextResponse.json({ error: 'Dieser Passkey ist hier nicht bekannt.' }, { status: 403 });
  const { rpID, origin } = rp(req);
  try {
    const v = await verifyAuthenticationResponse({
      response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      credential: { id: cred.id, publicKey: new Uint8Array(cred.public_key), counter: Number(cred.counter), transports: (cred.transports || '').split(',').filter(Boolean) as AuthenticatorTransportFuture[] },
    });
    if (!v.verified) throw new Error('nicht bestätigt');
    await sql`update credentials set counter = ${v.authenticationInfo.newCounter} where id = ${cred.id}`;
  } catch (e) {
    return NextResponse.json({ error: 'Anmeldung fehlgeschlagen: ' + (e as Error).message }, { status: 403 });
  }
  const s = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.value, cookieOptions(s.maxAge));
  res.cookies.delete(CHALLENGE_COOKIE);
  return res;
}
