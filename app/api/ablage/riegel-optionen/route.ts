import { NextResponse, type NextRequest } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { ensureSchema, sql } from '@/lib/db';
import { begrenzt } from '@/lib/ratelimit';
import { challengeCookie, cookieOptions, signChallenge } from '@/lib/session';
import { mitNutzer } from '@/lib/sitzung';
import { rp } from '@/lib/webauthn';

/** Face ID für die Ablage: nur mit einem Passkey dieses Menschen. */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'anmelden'); if (zuViel) return zuViel;
  await ensureSchema();
  const creds = await sql<{ id: string; transports: string | null }[]>`select id, transports from credentials where user_id = ${uid}`;
  if (!creds.length) return NextResponse.json({ error: 'Dafür brauchst du einen Passkey.' }, { status: 409 });
  const { rpID } = rp(req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required',
    allowCredentials: creds.map((c) => ({ id: c.id, transports: (c.transports || '').split(',').filter(Boolean) as AuthenticatorTransportFuture[] })) });
  const res = NextResponse.json(options);
  res.cookies.set(challengeCookie(), await signChallenge(options.challenge, 'ablage'), cookieOptions(300));
  return res;
}
