import { NextResponse, type NextRequest } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

const KEYS = ['kontext', 'ziele', 'team'] as const;

export async function GET() {
  const [kontext, ziele, team] = await Promise.all(KEYS.map((k) => getSetting(k)));
  return NextResponse.json({ kontext, ziele, team });
}

export async function PUT(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (!KEYS.some((k) => typeof b[k] === 'string')) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  for (const k of KEYS) if (typeof b[k] === 'string') await setSetting(k, b[k].slice(0, 4000));
  return NextResponse.json({ ok: true });
}
