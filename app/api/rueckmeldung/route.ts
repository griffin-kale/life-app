import { NextResponse, type NextRequest } from 'next/server';
import pkg from '@/package.json';
import { begrenzt } from '@/lib/ratelimit';
import { ARTEN, BEREICHE, GEWICHT, githubBereit, liste, melden } from '@/lib/rueckmeldung';

export async function GET() { return NextResponse.json({ liste: await liste(), github: githubBereit() }); }

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  if (!(b.art in ARTEN) || !(BEREICHE as readonly string[]).includes(b.bereich) || !(b.gewicht in GEWICHT))
    return NextResponse.json({ error: 'Bitte Art, Bereich und Gewicht antippen.' }, { status: 400 });
  const ua = req.headers.get('user-agent') ?? '';
  const geraet = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Mac/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : 'anderes Gerät';
  const r = await melden({
    art: b.art, bereich: b.bereich, gewicht: b.gewicht,
    text: typeof b.text === 'string' ? b.text.trim().slice(0, 3000) : '',
    seite: typeof b.seite === 'string' && /^\/[\w/-]{0,60}$/.test(b.seite) ? b.seite : '/',
    version: pkg.version, geraet,
  });
  return NextResponse.json(r);
}
