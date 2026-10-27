import { NextResponse, after, type NextRequest } from 'next/server';
import { sameSecret } from '@/lib/session';
import { createItem, enrich } from '@/lib/enrich';
import { begrenzt } from '@/lib/ratelimit';
import { ERSTER_NUTZER } from '@/lib/sitzung';

// Für den iPhone-Kurzbefehl (Aktionstaste, Teilen-Menü). Schutz über einen eigenen Schlüssel.
// Der Schlüssel gehört dem ersten Menschen. Weitere Menschen bekommen eigene Schlüssel, bevor sie den Kurzbefehl nutzen.
export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'erfassen'); if (zuViel) return zuViel;
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!sameSecret(auth, process.env.CAPTURE_TOKEN)) return NextResponse.json({ error: 'nicht erlaubt' }, { status: 401 });
  const type = req.headers.get('content-type') || '';
  let text = '';
  if (type.includes('json')) { const b = await req.json().catch(() => ({})); text = [b.text, b.url].filter((x) => typeof x === 'string' && x.trim()).join('\n'); }
  else text = await req.text();
  if (!text.trim()) return NextResponse.json({ error: 'Leer' }, { status: 400 });
  const id = await createItem(text, ERSTER_NUTZER);
  after(() => enrich(id));
  return new NextResponse('Festgehalten', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
