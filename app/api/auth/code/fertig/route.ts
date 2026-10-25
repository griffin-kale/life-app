import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { SESSION_COOKIE, cookieOptions, createSession } from '@/lib/session';
import { abschliessen } from '@/lib/zweifaktor';
import { darfEinrichten } from '../berechtigt';

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'einrichten'); if (zuViel) return zuViel;
  const { token, code } = await req.json().catch(() => ({}));
  if (!(await darfEinrichten(req, token))) return NextResponse.json({ error: 'Einrichtungscode stimmt nicht.' }, { status: 403 });
  const r = await abschliessen(String(code ?? ''));
  if (r === 'abgelaufen') return NextResponse.json({ error: 'Zeit abgelaufen. Bitte nochmal von vorn.' }, { status: 400 });
  if (r === 'falsch') return NextResponse.json({ error: 'Der Code stimmt nicht. Nimm den aktuellen aus 1Password.' }, { status: 400 });
  const s = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.value, cookieOptions(s.maxAge));
  return res;
}
