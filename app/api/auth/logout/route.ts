import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookie } from '@/lib/session';
import { aktuelleSitzung, alleWiderrufen, widerrufen } from '@/lib/sitzung';

/** Abmelden widerruft diese Sitzung. Mit { alle: true } alle Sitzungen auf allen Geräten. */
export async function POST(req: NextRequest) {
  const { alle } = await req.json().catch(() => ({}));
  const s = await aktuelleSitzung();
  let n = 0;
  if (s && alle === true) n = await alleWiderrufen(s.userId);
  else if (s) { await widerrufen(s.sid); n = 1; }
  const res = NextResponse.json({ ok: true, abgemeldet: n });
  res.cookies.delete(sessionCookie());
  return res;
}
