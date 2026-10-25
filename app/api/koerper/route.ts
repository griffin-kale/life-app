import { NextResponse, type NextRequest } from 'next/server';
import { getSetting } from '@/lib/db';
import { koerperStand } from '@/lib/koerper';
import { begrenzt } from '@/lib/ratelimit';
import { abgleichen, trennen, verbunden, whoopBereit } from '@/lib/whoop';

export async function GET() {
  const [k, v, zuletzt] = await Promise.all([koerperStand(), verbunden(), getSetting('whoop_abgleich:peter')]);
  return NextResponse.json({ ...k, whoop: { bereit: whoopBereit(), verbunden: v, zuletzt: zuletzt || null } });
}

/** WHOOP jetzt abgleichen oder trennen. */
export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  if (b.aktion === 'trennen') { await trennen(); return NextResponse.json({ ok: true }); }
  if (b.aktion === 'abgleichen') {
    try { return NextResponse.json(await abgleichen('peter', 14)); }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
  }
  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
