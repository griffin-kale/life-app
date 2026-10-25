import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { CHALLENGE_COOKIE, cookieOptions, signChallenge } from '@/lib/session';
import { authUrl, whoopBereit } from '@/lib/whoop';

/** Leitet zu WHOOP weiter. Der state-Wert liegt signiert im Cookie und schützt vor untergeschobenen Antworten. */
export async function GET() {
  if (!whoopBereit()) return NextResponse.json({ error: 'WHOOP-Zugang fehlt auf dem Server (WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET).' }, { status: 503 });
  const state = randomBytes(18).toString('base64url');
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set(CHALLENGE_COOKIE, await signChallenge(state, 'whoop'), cookieOptions(600));
  return res;
}
