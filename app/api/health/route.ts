import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Lebenszeichen für Überwachung und nach jedem Update. Verrät nichts außer „läuft“. */
export async function GET() {
  let db = 'ok';
  try { await sql`select 1`; } catch { db = 'fehler'; }
  return NextResponse.json({ ok: db === 'ok', db }, { status: db === 'ok' ? 200 : 503, headers: { 'cache-control': 'no-store' } });
}
