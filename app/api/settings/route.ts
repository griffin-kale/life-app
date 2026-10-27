import { NextResponse, type NextRequest } from 'next/server';
import { getSetting, proNutzer, setSetting } from '@/lib/db';
import { claudeBereit } from '@/lib/claude';
import { mitNutzer } from '@/lib/sitzung';

const KEYS = ['kontext', 'ziele', 'team', 'namen', 'namen_auto'] as const;
/** Namen zum Schützen gelten für den ganzen Haushalt, damit sie bei allen pseudonymisiert werden. Der Rest gilt pro Mensch. */
const HAUSHALT = new Set<string>(['namen', 'namen_auto']);
const schluessel = (k: string, uid: string) => (HAUSHALT.has(k) ? k : proNutzer(k, uid));

export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const werte = await Promise.all(KEYS.map((k) => getSetting(schluessel(k, uid))));
  return NextResponse.json({ ...Object.fromEntries(KEYS.map((k, i) => [k, werte[i]])), claude: claudeBereit() });
}

export async function PUT(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const b = await req.json().catch(() => ({}));
  if (!KEYS.some((k) => typeof b[k] === 'string')) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  for (const k of KEYS) if (typeof b[k] === 'string') await setSetting(schluessel(k, uid), b[k].slice(0, 8000));
  return NextResponse.json({ ok: true });
}
