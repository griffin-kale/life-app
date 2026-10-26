import { NextResponse, type NextRequest } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { eanOk, MAHLZEITEN, produkt, schaetzenFoto, schaetzenText, type Mahlzeit } from '@/lib/essen';
import { proteinZiel } from '@/lib/koerper';
import { heuteBerlin } from '@/lib/priorisieren';
import { begrenzt } from '@/lib/ratelimit';
import { ohneSitzung } from '@/lib/sitzung';
import { oeffentlich } from '@/lib/fehler';
import { jpegSaeubern } from '@/lib/jpeg';

export async function GET() {
  const aus = await ohneSitzung(); if (aus) return aus;
  await ensureSchema();
  const tag = heuteBerlin();
  const [liste, pz] = await Promise.all([
    sql`select id::text, mahlzeit, quelle, name, gramm::float, kcal::float, kcal_bis::float, protein::float, protein_bis::float, gemuese
      from mahlzeiten where user_id = 'peter' and tag = ${tag} order by created_at`,
    proteinZiel(),
  ]);
  return NextResponse.json({ tag, liste, proteinZiel: pz.ziel, gewicht: pz.gewicht });
}

export async function POST(req: NextRequest) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  const mahlzeit: Mahlzeit = (MAHLZEITEN as readonly string[]).includes(b.mahlzeit) ? b.mahlzeit : 'snack';
  const tag = heuteBerlin();
  try {
    if (b.quelle === 'barcode') {
      const ean = String(b.ean || ''); const gramm = Math.max(1, Math.min(3000, Number(b.gramm) || 100));
      if (!eanOk(ean)) return NextResponse.json({ error: 'Ungültige Barcode-Nummer' }, { status: 400 });
      const p = await produkt(ean); if (!p) return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
      const f = gramm / 100; const r = (x: number | null) => (x === null ? null : Math.round(x * f * 10) / 10);
      await sql`insert into mahlzeiten (user_id, tag, mahlzeit, quelle, name, gramm, kcal, protein, kh, fett)
        values ('peter', ${tag}, ${mahlzeit}, 'barcode', ${p.name}, ${gramm}, ${r(p.kcal)}, ${r(p.protein)}, ${r(p.kh)}, ${r(p.fett)})`;
      return NextResponse.json({ ok: true });
    }
    if (b.quelle === 'text' && typeof b.text === 'string' && b.text.trim()) {
      const s = await schaetzenText(b.text.trim());
      await sql`insert into mahlzeiten (user_id, tag, mahlzeit, quelle, name, kcal, kcal_bis, protein, protein_bis, gemuese)
        values ('peter', ${tag}, ${mahlzeit}, 'text', ${s.name}, ${s.kcal}, ${s.kcal_bis}, ${s.protein}, ${s.protein_bis}, ${s.gemuese})`;
      return NextResponse.json({ ok: true, schaetzung: s });
    }
    if (b.quelle === 'foto' && typeof b.bild === 'string') {
      const roh = b.bild.replace(/^data:image\/jpeg;base64,/, '');
      const bild = roh.length <= 2_000_000 ? jpegSaeubern(roh) : null;
      if (!bild) return NextResponse.json({ error: 'Foto zu groß oder ungültig' }, { status: 400 });
      const s = await schaetzenFoto(bild, typeof b.notiz === 'string' ? b.notiz : '');
      await sql`insert into mahlzeiten (user_id, tag, mahlzeit, quelle, name, kcal, kcal_bis, protein, protein_bis, gemuese)
        values ('peter', ${tag}, ${mahlzeit}, 'foto', ${s.name}, ${s.kcal}, ${s.kcal_bis}, ${s.protein}, ${s.protein_bis}, ${s.gemuese})`;
      return NextResponse.json({ ok: true, schaetzung: s });
    }
  } catch (e) { return NextResponse.json({ error: oeffentlich(e, 'Schätzen hat nicht geklappt. Bitte nochmal.') }, { status: 502 }); }
  return NextResponse.json({ error: 'Nichts zum Festhalten' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'ungültig' }, { status: 400 });
  await sql`delete from mahlzeiten where id = ${id} and user_id = 'peter'`;
  return NextResponse.json({ ok: true });
}
