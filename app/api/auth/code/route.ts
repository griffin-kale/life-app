import { NextResponse } from 'next/server';
import { mitNutzer } from '@/lib/sitzung';
import { aktiv, ausschalten } from '@/lib/zweifaktor';

/** Status und Ausschalten nur mit gültiger Sitzung. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  return NextResponse.json({ aktiv: await aktiv() });
}

export async function DELETE() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  await ausschalten();
  return NextResponse.json({ ok: true });
}
