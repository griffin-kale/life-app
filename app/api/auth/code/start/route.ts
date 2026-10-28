import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { passwortOk, starten } from '@/lib/zweifaktor';
import { darfEinrichten, einrichtenVerboten, nichtErsterNutzer } from '@/lib/sitzung';

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'einrichten'); if (zuViel) return zuViel;
  const { token, password } = await req.json().catch(() => ({}));
  const fremd = await nichtErsterNutzer(); if (fremd) return fremd;
  const darf = await darfEinrichten(token); if (darf !== 'ok') return einrichtenVerboten(darf);
  if (!passwortOk(password)) return NextResponse.json({ error: 'Das Passwort braucht mindestens 16 Zeichen. Lass 1Password eins erzeugen.' }, { status: 400 });
  const r = await starten(password);
  return NextResponse.json(r, { headers: { 'cache-control': 'no-store' } });
}
