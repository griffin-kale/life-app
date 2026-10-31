import { NextResponse, type NextRequest } from 'next/server';
import { oeffentlich } from '@/lib/fehler';
import { hebelVorschlagen } from '@/lib/saison';
import { BEREICHE_S, type SBereich } from '@/lib/saison-regeln';
import { mitNutzer } from '@/lib/sitzung';

/** Claude schlägt pro Ziel drei Hebel und einen Dann-Satz vor. Peter wählt im Blatt aus, gespeichert wird erst beim Anlegen. */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const b = await req.json().catch(() => ({}));
  const ziele = (Array.isArray(b?.ziele) ? b.ziele : [])
    .filter((z: unknown): z is Record<string, unknown> => !!z && typeof z === 'object')
    .map((z: Record<string, unknown>) => ({ bereich: z.bereich as SBereich, titel: String(z.titel ?? '').slice(0, 80), wenn: String(z.wenn ?? '').slice(0, 120) }))
    .filter((z: { bereich: SBereich; titel: string }) => BEREICHE_S.includes(z.bereich) && z.titel.trim().length >= 3)
    .slice(0, 6);
  if (!ziele.length) return NextResponse.json({ error: 'Keine Ziele für Vorschläge.' }, { status: 400 });
  try {
    return NextResponse.json({ vorschlaege: await hebelVorschlagen(ziele, uid) });
  } catch (e) {
    return NextResponse.json({ error: oeffentlich(e, 'Claude hat gerade keine Vorschläge. Schreib die Hebel selbst dazu.', 'saison') }, { status: 502 });
  }
}
