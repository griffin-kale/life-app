import { NextResponse, after, type NextRequest } from 'next/server';
import { ensureSchema, sql, type Item } from '@/lib/db';
import { ARTEN, KATEGORIEN, TYPEN, enrich } from '@/lib/enrich';

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params; if (!UUID.test(id)) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
  await ensureSchema();
  const [item] = await sql<Item[]>`select * from items where id = ${id}`;
  return item ? NextResponse.json(item) : NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params; if (!UUID.test(id)) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  await ensureSchema();
  if (b.neuSortieren) { await sql`update items set status = 'neu', fehler = null where id = ${id}`; after(() => enrich(id)); return NextResponse.json({ ok: true }); }
  const set: Record<string, unknown> = {};
  if (typeof b.text === 'string' && b.text.trim()) set.text = b.text.trim().slice(0, 8000);
  if ((KATEGORIEN as readonly string[]).includes(b.kategorie)) { set.kategorie = b.kategorie; set.status = 'sortiert'; set.parken_bis = b.kategorie === 'idee' ? new Date(Date.now() + 72 * 3600_000) : null; }
  if ((ARTEN as readonly string[]).includes(b.art)) set.art = b.art;
  if ((TYPEN as readonly string[]).includes(b.typ)) set.typ = b.typ;
  if (b.status === 'archiv' || b.status === 'sortiert') set.status = b.status;
  if (!Object.keys(set).length) return NextResponse.json({ error: 'nichts zu ändern' }, { status: 400 });
  set.updated_at = new Date();
  const [item] = await sql<Item[]>`update items set ${sql(set)} where id = ${id} returning *`;
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params; if (!UUID.test(id)) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
  await ensureSchema();
  await sql`delete from items where id = ${id}`;
  return NextResponse.json({ ok: true });
}
