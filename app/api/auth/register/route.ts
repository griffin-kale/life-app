import { NextResponse, type NextRequest } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { ensureSchema, sql } from '@/lib/db';
import { challengeCookie, readChallenge } from '@/lib/session';
import { darfEinrichten, einrichtenVerboten, sitzungSetzen } from '@/lib/sitzung';
import { rp } from '@/lib/webauthn';
import { begrenzt } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'einrichten'); if (zuViel) return zuViel;
  const { token, response } = await req.json().catch(() => ({}));
  const darf = await darfEinrichten(token); if (darf !== 'ok') return einrichtenVerboten(darf);
  const challenge = await readChallenge(req.cookies.get(challengeCookie())?.value, 'register');
  if (!challenge) return NextResponse.json({ error: 'Zeit abgelaufen. Bitte nochmal.' }, { status: 400 });
  const { rpID, origin } = rp(req);
  try {
    const v = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
    if (!v.verified || !v.registrationInfo) throw new Error('nicht bestätigt');
    const c = v.registrationInfo.credential;
    await ensureSchema();
    await sql`insert into credentials (id, public_key, counter, transports) values (${c.id}, ${Buffer.from(c.publicKey)}, ${c.counter}, ${(c.transports ?? []).join(',')})`;
  } catch (e) {
    console.warn('[auth] Passkey nicht gespeichert', (e as Error).name);
    return NextResponse.json({ error: 'Passkey konnte nicht gespeichert werden. Bitte nochmal.' }, { status: 400 });
  }
  const res = await sitzungSetzen(NextResponse.json({ ok: true }));
  res.cookies.delete(challengeCookie());
  return res;
}
