import { NextResponse, type NextRequest } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { ensureSchema, sql } from '@/lib/db';
import { challengeCookie, cookieOptions, signChallenge } from '@/lib/session';
import { darfEinrichten, einrichtenFuer, einrichtenVerboten } from '@/lib/sitzung';
import { rp } from '@/lib/webauthn';
import { begrenzt } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'einrichten'); if (zuViel) return zuViel;
  const { token } = await req.json().catch(() => ({}));
  const darf = await darfEinrichten(token); if (darf !== 'ok') return einrichtenVerboten(darf);
  await ensureSchema();
  const uid = await einrichtenFuer();
  const existing = await sql`select id from credentials where user_id = ${uid}`;
  const [n] = await sql<{ name: string }[]>`select name from nutzer where id = ${uid}`;
  const { rpID } = rp(req);
  const options = await generateRegistrationOptions({
    rpName: 'Life', rpID, userName: uid, userDisplayName: n?.name ?? uid,
    userID: new TextEncoder().encode(uid),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: existing.map((c) => ({ id: c.id as string })),
  });
  const res = NextResponse.json(options);
  res.cookies.set(challengeCookie(), await signChallenge(options.challenge, 'register'), cookieOptions(300));
  return res;
}
