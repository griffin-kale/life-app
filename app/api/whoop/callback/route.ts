import { NextResponse, after, type NextRequest } from 'next/server';
import { challengeCookie, readChallenge } from '@/lib/session';
import { aktuelleSitzung } from '@/lib/sitzung';
import { abgleichen, codeTauschen } from '@/lib/whoop';

const ziel = (req: NextRequest, q: string) => new URL(`/koerper?whoop=${q}`, process.env.PUBLIC_ORIGIN || req.nextUrl.origin);

export async function GET(req: NextRequest) {
  const sitzung = await aktuelleSitzung();
  if (!sitzung) return NextResponse.redirect(new URL('/login', process.env.PUBLIC_ORIGIN || req.nextUrl.origin));
  const uid = sitzung.userId;
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const erwartet = await readChallenge(req.cookies.get(challengeCookie())?.value, 'whoop');
  if (!code || !state || !erwartet || state !== erwartet) return NextResponse.redirect(ziel(req, 'fehler'));
  try { await codeTauschen(code, uid); } catch { return NextResponse.redirect(ziel(req, 'fehler')); }
  after(() => abgleichen(uid, 30).catch(() => {}));
  const res = NextResponse.redirect(ziel(req, 'ok'));
  res.cookies.delete(challengeCookie());
  return res;
}
