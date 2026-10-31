import { NextResponse, type NextRequest } from 'next/server';
import { oeffentlich } from '@/lib/fehler';
import { hebelBewerten, hebelWeg } from '@/lib/saison';
import { BEWERTUNGEN, type Bewertung } from '@/lib/saison-regeln';
import { mitNutzer } from '@/lib/sitzung';
import { montagVon } from '@/lib/tagesregeln';
import { heuteBerlin } from '@/lib/zeit';

type Ctx = { params: Promise<{ id: string }> };
const nummer = async (params: Ctx['params']) => { const id = Number((await params).id); return Number.isSafeInteger(id) && id > 0 ? id : null; };

/** Wochenrunde: Hebel für diese Woche bewerten (auf Kurs, anpassen, daneben). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const id = await nummer(params);
  const b = await req.json().catch(() => ({}));
  if (!id || !BEWERTUNGEN.includes(b.bewertung)) return NextResponse.json({ error: 'Ungültige Angaben.' }, { status: 400 });
  try {
    if (!(await hebelBewerten(id, montagVon(heuteBerlin()), b.bewertung as Bewertung, uid))) return NextResponse.json({ error: 'Hebel nicht gefunden.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: oeffentlich(e, 'Die Bewertung ließ sich nicht speichern.', 'saison') }, { status: 500 }); }
}

/** Einen Hebel aus der Saison nehmen. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const id = await nummer(params);
  if (!id) return NextResponse.json({ error: 'Hebel nicht gefunden.' }, { status: 404 });
  try {
    if (!(await hebelWeg(id, uid))) return NextResponse.json({ error: 'Hebel nicht gefunden.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: oeffentlich(e, 'Der Hebel ließ sich nicht entfernen.', 'saison') }, { status: 500 }); }
}
