import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { abschliessen } from '@/lib/zweifaktor';
import { darfEinrichten, einrichtenVerboten, sitzungSetzen } from '@/lib/sitzung';

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'einrichten'); if (zuViel) return zuViel;
  const { token, code } = await req.json().catch(() => ({}));
  const darf = await darfEinrichten(token); if (darf !== 'ok') return einrichtenVerboten(darf);
  const r = await abschliessen(String(code ?? ''));
  if (r === 'abgelaufen') return NextResponse.json({ error: 'Zeit abgelaufen. Bitte nochmal von vorn.' }, { status: 400 });
  if (r === 'falsch') return NextResponse.json({ error: 'Der Code stimmt nicht. Nimm den aktuellen aus 1Password.' }, { status: 400 });
  return sitzungSetzen(NextResponse.json({ ok: true }));
}
