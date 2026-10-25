import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { hit } from '@/lib/ratelimit-core';
import { SESSION_COOKIE, cookieOptions, createSession } from '@/lib/session';
import { anmelden } from '@/lib/zweifaktor';

const FEHLER = 'Anmeldung fehlgeschlagen.';

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'code'); if (zuViel) return zuViel;
  // Zusätzlich über alle Adressen hinweg, falls jemand von vielen IPs aus rät
  const global = hit('code-global', 30, 60 * 60_000);
  if (!global.ok) return NextResponse.json({ error: 'Zu viele Versuche. Bitte später nochmal.' }, { status: 429, headers: { 'retry-after': String(global.retryAfter) } });
  const { password, code } = await req.json().catch(() => ({}));
  if (typeof password !== 'string' || password.length > 200 || typeof code !== 'string') return NextResponse.json({ error: FEHLER }, { status: 401 });
  if (!(await anmelden(password, code))) return NextResponse.json({ error: FEHLER }, { status: 401 });
  const s = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.value, cookieOptions(s.maxAge));
  return res;
}
