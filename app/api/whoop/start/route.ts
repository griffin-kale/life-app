import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { challengeCookie, cookieOptions, signChallenge } from '@/lib/session';
import { mitNutzer } from '@/lib/sitzung';
import { authUrl, whoopBereit } from '@/lib/whoop';

/** Leitet zu WHOOP weiter. Der state-Wert liegt signiert im Cookie und schützt vor untergeschobenen Antworten. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  if (!whoopBereit()) return NextResponse.json({ error: 'WHOOP-Zugang fehlt auf dem Server (WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET).' }, { status: 503 });
  const state = randomBytes(18).toString('base64url');
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set(challengeCookie(), await signChallenge(state, 'whoop'), cookieOptions(600));
  return res;
}
