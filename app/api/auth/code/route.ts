import { NextResponse } from 'next/server';
import { ERSTER_NUTZER, mitNutzer } from '@/lib/sitzung';
import { aktiv, ausschalten } from '@/lib/zweifaktor';

/** Status und Ausschalten nur mit gültiger Sitzung. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  if (uid !== ERSTER_NUTZER) return NextResponse.json({ aktiv: false });
  return NextResponse.json({ aktiv: await aktiv() });
}

export async function DELETE() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  if (uid !== ERSTER_NUTZER) return NextResponse.json({ error: 'Passwort und Code schaltet nur der erste Mensch im Haushalt ab.' }, { status: 403 });
  await ausschalten();
  return NextResponse.json({ ok: true });
}
