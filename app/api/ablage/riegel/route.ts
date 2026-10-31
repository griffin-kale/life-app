import { NextResponse, type NextRequest } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { ensureSchema, sql } from '@/lib/db';
import { begrenzt } from '@/lib/ratelimit';
import { ABLAGE_MIN, challengeCookie, cookieOptions, readChallenge, signAblage, ablageCookie } from '@/lib/session';
import { aktuelleSitzung, mitNutzer } from '@/lib/sitzung';
import { rp } from '@/lib/webauthn';

/** Prüft Face ID. Der Passkey muss diesem Menschen gehören, dann ist der Riegel zehn Minuten offen. */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'anmelden'); if (zuViel) return zuViel;
  const { response } = await req.json().catch(() => ({}));
  const challenge = await readChallenge(req.cookies.get(challengeCookie())?.value, 'ablage');
  if (!challenge || typeof response?.id !== 'string') return NextResponse.json({ error: 'Zeit abgelaufen. Bitte nochmal.' }, { status: 400 });
  await ensureSchema();
  const [cred] = await sql`select id, public_key, counter, transports, user_id from credentials where id = ${response.id} and user_id = ${uid}`;
  if (!cred) return NextResponse.json({ error: 'Dieser Passkey gehört nicht zu dir.' }, { status: 403 });
  const { rpID, origin } = rp(req);
  try {
    const v = await verifyAuthenticationResponse({
      response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      credential: { id: cred.id, publicKey: new Uint8Array(cred.public_key), counter: Number(cred.counter), transports: (cred.transports || '').split(',').filter(Boolean) as AuthenticatorTransportFuture[] },
    });
    if (!v.verified) throw new Error('nicht bestätigt');
    await sql`update credentials set counter = ${v.authenticationInfo.newCounter} where id = ${cred.id}`;
  } catch (e) {
    console.warn('[ablage] Face ID abgelehnt', (e as Error).name);
    return NextResponse.json({ error: 'Face ID hat nicht geklappt. Bitte nochmal.' }, { status: 403 });
  }
  const s = await aktuelleSitzung();
  const res = NextResponse.json({ ok: true, minuten: ABLAGE_MIN });
  res.cookies.set(ablageCookie(), await signAblage(uid, s!.sid), { ...cookieOptions(ABLAGE_MIN * 60), sameSite: 'strict' });
  res.cookies.delete(challengeCookie());
  return res;
}

/** Schließen: Riegel sofort zu. */
export async function DELETE() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const res = NextResponse.json({ ok: true, zu: uid !== null });
  res.cookies.delete(ablageCookie());
  return res;
}
