import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { mitNutzer } from '@/lib/sitzung';
import { OHNE_CACHE, blockNeu, bloecke, ablageKopf, ablageRiegel } from '@/lib/ablage';
import { blockOk } from '@/lib/ablage-regeln';

/** Verschlüsselte Blöcke der Ablage. Der Server sieht nie, was darin steht. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zu = await ablageRiegel(uid); if (zu) return zu;
  return NextResponse.json({ bloecke: await bloecke(uid) }, { headers: OHNE_CACHE });
}

export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const zu = await ablageRiegel(uid); if (zu) return zu;
  if (!(await ablageKopf(uid))) return NextResponse.json({ error: 'Zuerst einrichten.' }, { status: 409, headers: OHNE_CACHE });
  const b = await req.json().catch(() => ({}));
  if (!blockOk(b.block)) return NextResponse.json({ error: 'Ungültiger Block' }, { status: 400, headers: OHNE_CACHE });
  const id = await blockNeu(b.block, uid);
  if (!id) return NextResponse.json({ error: 'Kein Platz mehr.' }, { status: 409, headers: OHNE_CACHE });
  return NextResponse.json({ id }, { headers: OHNE_CACHE });
}
