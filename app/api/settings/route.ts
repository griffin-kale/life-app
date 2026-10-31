import { NextResponse, type NextRequest } from 'next/server';
import { getSetting, proNutzer, setSetting } from '@/lib/db';
import { claudeBereit } from '@/lib/claude';
import { mitNutzer } from '@/lib/sitzung';
import { aktuelleSaison } from '@/lib/saison';

const KEYS = ['kontext', 'ziele', 'team', 'namen', 'namen_auto'] as const;
/** Die Namensliste von Hand gilt für den ganzen Haushalt. Gelernte Namen und der Rest gelten pro Mensch, geschützt wird bei allen. */
const HAUSHALT = new Set<string>(['namen']);
const schluessel = (k: string, uid: string) => (HAUSHALT.has(k) ? k : proNutzer(k, uid));

export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const [werte, saison] = await Promise.all([Promise.all(KEYS.map((k) => getSetting(schluessel(k, uid)))), aktuelleSaison(uid).catch(() => null)]);
  // Mit laufender Saison gelten deren Ziele, die alte Liste bleibt gespeichert, wird aber nicht mehr gepflegt
  const saisonZiele = saison?.ziele.length ? saison.ziele.map((z) => z.titel) : null;
  return NextResponse.json({ ...Object.fromEntries(KEYS.map((k, i) => [k, werte[i]])), saisonZiele, claude: claudeBereit() });
}

export async function PUT(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const b = await req.json().catch(() => ({}));
  if (!KEYS.some((k) => typeof b[k] === 'string')) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  for (const k of KEYS) if (typeof b[k] === 'string') await setSetting(schluessel(k, uid), b[k].slice(0, 8000));
  return NextResponse.json({ ok: true });
}
