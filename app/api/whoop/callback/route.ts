import { NextResponse, after, type NextRequest } from 'next/server';
import { challengeCookie, readChallenge } from '@/lib/session';
import { aktuelleSitzung } from '@/lib/sitzung';
import { abgleichen, codeTauschen } from '@/lib/whoop';

const ziel = (req: NextRequest, q: string) => new URL(`/koerper?whoop=${q}`, process.env.PUBLIC_ORIGIN || req.nextUrl.origin);

export async function GET(req: NextRequest) {
  if (!(await aktuelleSitzung())) return NextResponse.redirect(new URL('/login', process.env.PUBLIC_ORIGIN || req.nextUrl.origin));
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const erwartet = await readChallenge(req.cookies.get(challengeCookie())?.value, 'whoop');
  if (!code || !state || !erwartet || state !== erwartet) return NextResponse.redirect(ziel(req, 'fehler'));
  try { await codeTauschen(code); } catch { return NextResponse.redirect(ziel(req, 'fehler')); }
  after(() => abgleichen('peter', 30).catch(() => {}));
  const res = NextResponse.redirect(ziel(req, 'ok'));
  res.cookies.delete(challengeCookie());
  return res;
}
