import { NextResponse, type NextRequest } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { abgleichen, kalenderStand } from '@/lib/kalender';
import { KALENDER_ARTEN } from '@/lib/kalender-regeln';
import { offene } from '@/lib/priorisieren';
import { begrenzt } from '@/lib/ratelimit';
import { aufgabe } from '@/lib/tag';
import { ohneSitzung } from '@/lib/sitzung';
import { oeffentlich } from '@/lib/fehler';

/** Kalender: Stand und Tagesplan, Abgleich anstoßen, Kalender ein- und ausschalten. */
export async function GET() {
  const aus = await ohneSitzung(); if (aus) return aus;
  const jetzt = (await offene().catch(() => [])).find((i) => i.stapel === 'jetzt');
  return NextResponse.json(await kalenderStand('peter', jetzt ? { titel: aufgabe(jetzt), dauer: jetzt.aufwand_min ?? 60 } : undefined));
}

export async function POST(req: NextRequest) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  try { return NextResponse.json(await abgleichen()); }
  catch (e) { return NextResponse.json({ error: oeffentlich(e, 'Kalender: Abgleich fehlgeschlagen', 'kalender') }, { status: 502 }); }
}

export async function PATCH(req: NextRequest) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  if (typeof b.href !== 'string') return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  await ensureSchema();
  if (typeof b.an === 'boolean') await sql`update kalender set an = ${b.an} where user_id = 'peter' and href = ${b.href}`;
  if (KALENDER_ARTEN.some(([a]) => a === b.art)) await sql`update kalender set art = ${b.art} where user_id = 'peter' and href = ${b.href}`;
  return NextResponse.json({ ok: true });
}
