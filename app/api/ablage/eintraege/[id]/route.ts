import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { mitNutzer } from '@/lib/sitzung';
import { OHNE_CACHE, blockAendern, blockWeg, ablageRiegel, uuidOk } from '@/lib/ablage';
import { blockOk } from '@/lib/ablage-regeln';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const zu = await ablageRiegel(uid); if (zu) return zu;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (!uuidOk(id) || !blockOk(b.block)) return NextResponse.json({ error: 'Ungültig' }, { status: 400, headers: OHNE_CACHE });
  if (!(await blockAendern(id, b.block, uid))) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404, headers: OHNE_CACHE });
  return NextResponse.json({ ok: true }, { headers: OHNE_CACHE });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zu = await ablageRiegel(uid); if (zu) return zu;
  const { id } = await params;
  if (!uuidOk(id)) return NextResponse.json({ error: 'Ungültig' }, { status: 400, headers: OHNE_CACHE });
  if (!(await blockWeg(id, uid))) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404, headers: OHNE_CACHE });
  return NextResponse.json({ ok: true }, { headers: OHNE_CACHE });
}
