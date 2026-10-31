import { NextResponse, type NextRequest } from 'next/server';
import { oeffentlich } from '@/lib/fehler';
import { hebelDazu, zielAendern } from '@/lib/saison';
import { mitNutzer } from '@/lib/sitzung';

const text = (x: unknown, max: number) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : undefined);

/** Ein Saisonziel ändern: Stand zählen, umbenennen, Zielwert, Wenn-dann. Nur eigene Ziele. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Ziel nicht gefunden.' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const a: Parameters<typeof zielAendern>[1] = {};
  if (b.delta === 1 || b.delta === -1) a.delta = b.delta;
  if (Number.isInteger(b.stand) && b.stand >= 0 && b.stand <= 100_000) a.stand = b.stand;
  if (b.zielwert === null || (Number.isInteger(b.zielwert) && b.zielwert > 0 && b.zielwert <= 100_000)) a.zielwert = b.zielwert;
  const titel = text(b.titel, 80); if (titel && titel.length >= 3) a.titel = titel;
  const wenn = text(b.wenn, 120); if (wenn !== undefined) a.wenn = wenn;
  const dann = text(b.dann, 160); if (dann !== undefined) a.dann = dann;
  if (!Object.keys(a).length) return NextResponse.json({ error: 'Nichts zu ändern.' }, { status: 400 });
  try {
    if (!(await zielAendern(id, a, uid))) return NextResponse.json({ error: 'Ziel nicht gefunden.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: oeffentlich(e, 'Das Ziel ließ sich nicht ändern.', 'saison') }, { status: 500 });
  }
}

/** Einen Hebel zu einem Saisonziel dazunehmen (höchstens drei). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const id = Number((await params).id);
  const b = await req.json().catch(() => ({}));
  const titel = text(b.titel, 80);
  if (!Number.isSafeInteger(id) || id < 1 || !titel || titel.length < 3) return NextResponse.json({ error: 'Ungültige Angaben.' }, { status: 400 });
  try {
    if (!(await hebelDazu(id, titel, uid))) return NextResponse.json({ error: 'Ziel nicht gefunden.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: oeffentlich(e, 'Der Hebel ließ sich nicht speichern.', 'saison') }, { status: 409 }); }
}
