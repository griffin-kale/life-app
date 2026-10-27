import { NextResponse, type NextRequest } from 'next/server';
import { getSetting } from '@/lib/db';
import { koerperStand } from '@/lib/koerper';
import { begrenzt } from '@/lib/ratelimit';
import { abgleichen, trennen, verbunden, whoopBereit } from '@/lib/whoop';
import { mitNutzer } from '@/lib/sitzung';
import { oeffentlich } from '@/lib/fehler';

export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const [k, v, zuletzt] = await Promise.all([koerperStand(uid), verbunden(uid), getSetting(`whoop_abgleich:${uid}`)]);
  return NextResponse.json({ ...k, whoop: { bereit: whoopBereit(), verbunden: v, zuletzt: zuletzt || null } });
}

/** WHOOP jetzt abgleichen oder trennen. */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  if (b.aktion === 'trennen') { await trennen(uid); return NextResponse.json({ ok: true }); }
  if (b.aktion === 'abgleichen') {
    try { return NextResponse.json(await abgleichen(uid, 14)); }
    catch (e) { return NextResponse.json({ error: oeffentlich(e, 'WHOOP-Abgleich hat nicht geklappt. Bitte später nochmal.', 'whoop') }, { status: 502 }); }
  }
  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
