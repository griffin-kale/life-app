import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { hit, voll } from '@/lib/ratelimit-core';
import { ERSTER_NUTZER, sitzungSetzen } from '@/lib/sitzung';
import { anmelden } from '@/lib/zweifaktor';

const FEHLER = 'Anmeldung fehlgeschlagen.';
// Über alle Adressen hinweg zählen nur Fehlversuche. So kann niemand Peter mit vielen Anfragen aussperren,
// der richtige Code kommt immer durch, solange nicht 30 falsche Versuche in der Stunde kamen.
const GLOBAL = { key: 'code-global-fehler', max: 30, windowMs: 60 * 60_000 };

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'code'); if (zuViel) return zuViel;
  const g = voll(GLOBAL.key, GLOBAL.max);
  if (!g.ok) return NextResponse.json({ error: 'Zu viele Versuche. Bitte später nochmal.' }, { status: 429, headers: { 'retry-after': String(g.retryAfter) } });
  const { password, code } = await req.json().catch(() => ({}));
  if (typeof password !== 'string' || password.length > 200 || typeof code !== 'string' || !(await anmelden(password, code))) {
    hit(GLOBAL.key, GLOBAL.max, GLOBAL.windowMs);
    return NextResponse.json({ error: FEHLER }, { status: 401 });
  }
  return sitzungSetzen(NextResponse.json({ ok: true }), ERSTER_NUTZER);
}
