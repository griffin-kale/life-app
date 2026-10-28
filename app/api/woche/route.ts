import { NextResponse } from 'next/server';
import { woche } from '@/lib/woche';
import { mitNutzer } from '@/lib/sitzung';

/** Die Woche: sieben Tage mit Terminen und freier Zeit, dazu die Rhythmen der fünf Konten. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  return NextResponse.json(await woche(uid));
}
