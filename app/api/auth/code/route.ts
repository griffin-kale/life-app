import { NextResponse } from 'next/server';
import { ohneSitzung } from '@/lib/sitzung';
import { aktiv, ausschalten } from '@/lib/zweifaktor';

/** Status und Ausschalten nur mit gültiger Sitzung. */
export async function GET() {
  const aus = await ohneSitzung(); if (aus) return aus;
  return NextResponse.json({ aktiv: await aktiv() });
}

export async function DELETE() {
  const aus = await ohneSitzung(); if (aus) return aus;
  await ausschalten();
  return NextResponse.json({ ok: true });
}
