import { NextResponse, type NextRequest } from 'next/server';
import { oeffentlich } from '@/lib/fehler';
import { beenden, fokusHeute, laufend, starten, testBeenden, testNaechste, testStand, testStarten } from '@/lib/fokus';
import { BEWERTUNG, MUSIK, type Bewertung, type Musik } from '@/lib/fokus-regeln';
import { mitNutzer } from '@/lib/sitzung';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fokus: laufender Block, heutige Minuten, Stand des Musiktests. */
export async function GET() {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  try {
    const [block, heute, test, naechste] = await Promise.all([laufend(uid), fokusHeute(uid), testStand(uid), testNaechste(uid)]);
    return NextResponse.json({ block, heute, test, naechste });
  } catch (e) {
    return NextResponse.json({ error: oeffentlich(e, 'Der Fokus lässt sich gerade nicht laden.', 'fokus') }, { status: 500 });
  }
}

/** Aktionen: start, ende (mit Bewertung), test-start, test-ende. */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const b = await req.json().catch(() => ({}));
  try {
    if (b.aktion === 'start') {
      const itemId = typeof b.itemId === 'string' && UUID.test(b.itemId) ? b.itemId : null;
      const musik = b.musik === 'test' ? 'test' : MUSIK.includes(b.musik) ? (b.musik as Musik) : null;
      if (!musik || !Number.isInteger(b.minuten) || !Number.isInteger(b.pause)) return NextResponse.json({ error: 'Ungültige Angaben.' }, { status: 400 });
      return NextResponse.json({ block: await starten(uid, { itemId, minuten: b.minuten, pause: b.pause, musik }) });
    }
    if (b.aktion === 'ende') {
      const id = Number(b.id);
      const bewertung = b.bewertung === null || b.bewertung === undefined ? null : BEWERTUNG.includes(b.bewertung) ? (b.bewertung as Bewertung) : undefined;
      if (!Number.isSafeInteger(id) || bewertung === undefined) return NextResponse.json({ error: 'Ungültige Angaben.' }, { status: 400 });
      if (!(await beenden(uid, id, bewertung))) return NextResponse.json({ error: 'Block nicht gefunden.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    if (b.aktion === 'test-start') { await testStarten(uid); return NextResponse.json({ test: await testStand(uid) }); }
    if (b.aktion === 'test-ende') { await testBeenden(uid); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: oeffentlich(e, 'Das hat nicht geklappt.', 'fokus') }, { status: 409 });
  }
}
