import { NextResponse, type NextRequest } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { challengeCookie, cookieOptions, signChallenge } from '@/lib/session';
import { rp } from '@/lib/webauthn';
import { begrenzt } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'anmelden'); if (zuViel) return zuViel;
  const { rpID } = rp(req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
  const res = NextResponse.json(options);
  res.cookies.set(challengeCookie(), await signChallenge(options.challenge, 'login'), cookieOptions(300));
  return res;
}
