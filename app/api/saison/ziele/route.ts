import { NextResponse, type NextRequest } from 'next/server';
import { oeffentlich } from '@/lib/fehler';
import { zielErgaenzen } from '@/lib/saison';
import { BEREICHE_S, type SBereich } from '@/lib/saison-regeln';
import { mitNutzer } from '@/lib/sitzung';

/** Ein Ziel in einem freien Bereich der laufenden Saison ergänzen (Wochenrunde). */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const b = await req.json().catch(() => ({}));
  const titel = typeof b.titel === 'string' ? b.titel.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  if (!BEREICHE_S.includes(b.bereich) || titel.length < 3) return NextResponse.json({ error: 'Ungültige Angaben.' }, { status: 400 });
  try { return NextResponse.json({ id: await zielErgaenzen(b.bereich as SBereich, titel, uid) }); }
  catch (e) { return NextResponse.json({ error: oeffentlich(e, 'Das Ziel ließ sich nicht ergänzen.', 'saison') }, { status: 409 }); }
}
