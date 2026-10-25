import { NextResponse, type NextRequest } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

export async function GET() { return NextResponse.json({ kontext: await getSetting('kontext') }); }

export async function PUT(req: NextRequest) {
  const { kontext } = await req.json().catch(() => ({}));
  if (typeof kontext !== 'string') return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  await setSetting('kontext', kontext.slice(0, 4000));
  return NextResponse.json({ ok: true });
}
