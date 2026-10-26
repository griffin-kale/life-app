import { NextResponse, after, type NextRequest } from 'next/server';
import { ensureSchema, sql, type Item } from '@/lib/db';
import { createItem, enrich, TYPEN } from '@/lib/enrich';
import { begrenzt } from '@/lib/ratelimit';
import { ohneSitzung } from '@/lib/sitzung';

export async function GET(req: NextRequest) {
  const aus = await ohneSitzung(); if (aus) return aus;
  await ensureSchema();
  const p = req.nextUrl.searchParams;
  const typ = p.get('typ'); const q = (p.get('q') || '').trim(); const archiv = p.get('archiv') === '1'; const erledigt = p.get('erledigt') === '1';
  const limit = Math.min(Number(p.get('limit')) || 50, 200);
  const items = await sql<Item[]>`
    select * from items
    where ${archiv ? sql`status = 'archiv'` : erledigt ? sql`status = 'erledigt'` : sql`status <> 'archiv'`}
      ${typ && (TYPEN as readonly string[]).includes(typ) ? sql`and typ = ${typ}` : sql``}
      ${q ? sql`and (text ilike ${'%' + q + '%'} or titel ilike ${'%' + q + '%'} or kern ilike ${'%' + q + '%'})` : sql``}
    order by created_at desc limit ${limit}`;
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const { text } = await req.json().catch(() => ({}));
  if (typeof text !== 'string' || !text.trim()) return NextResponse.json({ error: 'Leer' }, { status: 400 });
  const id = await createItem(text);
  after(() => enrich(id));
  return NextResponse.json({ id });
}
