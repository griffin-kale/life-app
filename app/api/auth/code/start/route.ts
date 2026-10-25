import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { passwortOk, starten } from '@/lib/zweifaktor';
import { darfEinrichten } from '../berechtigt';

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'einrichten'); if (zuViel) return zuViel;
  const { token, password } = await req.json().catch(() => ({}));
  if (!(await darfEinrichten(req, token))) return NextResponse.json({ error: 'Einrichtungscode stimmt nicht.' }, { status: 403 });
  if (!passwortOk(password)) return NextResponse.json({ error: 'Das Passwort braucht mindestens 16 Zeichen. Lass 1Password eins erzeugen.' }, { status: 400 });
  const r = await starten(password);
  return NextResponse.json(r, { headers: { 'cache-control': 'no-store' } });
}
