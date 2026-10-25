import { NextResponse, type NextRequest } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { begrenzt } from '@/lib/ratelimit';

/** Liste „Zeit kaufen“: Was du abgeben könntest, wie viele Stunden im Monat es frei macht, was es kostet. */
export async function GET() {
  await ensureSchema();
  return NextResponse.json(await sql`select id::text, was, stunden_monat::float, kosten_cent, status from zeit_kaufen where user_id = 'peter' order by status, created_at`);
}

export async function POST(req: NextRequest) {
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  const was = typeof b.was === 'string' ? b.was.trim().slice(0, 120) : ''; const h = Number(b.stunden_monat);
  const k = b.kosten_cent == null ? null : Math.max(0, Math.min(10_000_000, Math.round(Number(b.kosten_cent) || 0)));
  if (!was || !(h > 0 && h <= 200)) return NextResponse.json({ error: 'Was und Stunden fehlen' }, { status: 400 });
  await sql`insert into zeit_kaufen (user_id, was, stunden_monat, kosten_cent) values ('peter', ${was}, ${h}, ${k})`;
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (!['idee', 'gemacht'].includes(b.status)) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  await sql`update zeit_kaufen set status = ${b.status} where id = ${Number(b.id)} and user_id = 'peter'`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await sql`delete from zeit_kaufen where id = ${Number(req.nextUrl.searchParams.get('id'))} and user_id = 'peter'`;
  return NextResponse.json({ ok: true });
}
