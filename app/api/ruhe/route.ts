import { NextResponse, type NextRequest } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { wochenTag } from '@/lib/fragen';
import { heuteBerlin } from '@/lib/priorisieren';
import { begrenzt } from '@/lib/ratelimit';
import { vorlage } from '@/lib/ruhe';
import { mitNutzer } from '@/lib/sitzung';

export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  await ensureSchema();
  const [w] = await sql<{ minuten: number; tage: number }[]>`
    select coalesce(round(sum(dauer_sek) / 60.0), 0)::int as minuten, count(distinct tag)::int as tage
    from ruhe where user_id = ${uid} and tag >= ${wochenTag(heuteBerlin())}`;
  return NextResponse.json(w);
}

/** Eine Sitzung festhalten. Unter einer Minute zählt nicht. */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  const v = vorlage(String(b.art)); const sek = Math.round(Number(b.dauer_sek) || 0);
  if (!v || sek < 60 || sek > 3 * 3600) return NextResponse.json({ error: 'Zu kurz zum Festhalten' }, { status: 400 });
  await sql`insert into ruhe (user_id, tag, art, dauer_sek) values (${uid}, ${heuteBerlin()}, ${v.id}, ${sek})`;
  return NextResponse.json({ ok: true });
}
