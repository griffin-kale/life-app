import { NextResponse, type NextRequest } from 'next/server';
import { oeffentlich } from '@/lib/fehler';
import { aktuelleSaison, saisonAnlegen, saisonGrundlage } from '@/lib/saison';
import { pruefeSaison } from '@/lib/saison-regeln';
import { mitNutzer } from '@/lib/sitzung';
import { heuteBerlin } from '@/lib/zeit';

/** Saison lesen und anlegen. GET liefert die laufende oder nächste Saison und alles fürs Blatt „Neue Saison“. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  try {
    const [saison, grundlage] = await Promise.all([aktuelleSaison(uid), saisonGrundlage(uid)]);
    return NextResponse.json({ saison, ...grundlage });
  } catch (e) {
    return NextResponse.json({ error: oeffentlich(e, 'Die Saison lässt sich gerade nicht laden.', 'saison') }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const r = pruefeSaison(await req.json().catch(() => null), heuteBerlin());
  if (!r.ok) return NextResponse.json({ error: r.fehler }, { status: 400 });
  try {
    const id = await saisonAnlegen(r.wert, uid);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: oeffentlich(e, 'Die Saison ließ sich nicht speichern.', 'saison') }, { status: 409 });
  }
}
