import { NextResponse, type NextRequest } from 'next/server';
import { eanOk, produkt } from '@/lib/essen';
import { begrenzt } from '@/lib/ratelimit';
import { mitNutzer } from '@/lib/sitzung';

export async function GET(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const ean = req.nextUrl.searchParams.get('ean') ?? '';
  if (!eanOk(ean)) return NextResponse.json({ error: 'Ungültige Barcode-Nummer' }, { status: 400 });
  const p = await produkt(ean);
  return p ? NextResponse.json(p) : NextResponse.json({ error: 'Produkt nicht gefunden. Halte es per Satz fest.' }, { status: 404 });
}
