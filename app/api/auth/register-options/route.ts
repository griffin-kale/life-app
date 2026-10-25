import { NextResponse, type NextRequest } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { ensureSchema, sql } from '@/lib/db';
import { CHALLENGE_COOKIE, cookieOptions, sameSecret, signChallenge } from '@/lib/session';
import { rp } from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));
  if (!sameSecret(token, process.env.SETUP_TOKEN)) return NextResponse.json({ error: 'Einrichtungscode stimmt nicht.' }, { status: 403 });
  await ensureSchema();
  const existing = await sql`select id from credentials`;
  const { rpID } = rp(req);
  const options = await generateRegistrationOptions({
    rpName: 'Life', rpID, userName: 'peter', userDisplayName: 'Peter',
    userID: new TextEncoder().encode('peter'),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: existing.map((c) => ({ id: c.id as string })),
  });
  const res = NextResponse.json(options);
  res.cookies.set(CHALLENGE_COOKIE, await signChallenge(options.challenge, 'register'), cookieOptions(300));
  return res;
}
