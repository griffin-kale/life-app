import { NextResponse, type NextRequest } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { claudeBereit } from '@/lib/claude';
import { ohneSitzung } from '@/lib/sitzung';

const KEYS = ['kontext', 'ziele', 'team', 'namen', 'namen_auto'] as const;

export async function GET() {
  const aus = await ohneSitzung(); if (aus) return aus;
  const werte = await Promise.all(KEYS.map((k) => getSetting(k)));
  return NextResponse.json({ ...Object.fromEntries(KEYS.map((k, i) => [k, werte[i]])), claude: claudeBereit() });
}

export async function PUT(req: NextRequest) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const b = await req.json().catch(() => ({}));
  if (!KEYS.some((k) => typeof b[k] === 'string')) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  for (const k of KEYS) if (typeof b[k] === 'string') await setSetting(k, b[k].slice(0, 8000));
  return NextResponse.json({ ok: true });
}
