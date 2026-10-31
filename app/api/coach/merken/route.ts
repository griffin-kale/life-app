import { NextResponse, type NextRequest } from 'next/server';
import { merkpunktWeg, merkzettel } from '@/lib/coach';
import { mitNutzer } from '@/lib/sitzung';

/** Der Merkzettel des Coachs: ansehen und Punkte streichen (Einstellungen). */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  return NextResponse.json({ punkte: await merkzettel(uid) });
}

export async function DELETE(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Punkt fehlt' }, { status: 400 });
  if (!(await merkpunktWeg(id, uid))) return NextResponse.json({ error: 'Diesen Punkt gibt es nicht' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
