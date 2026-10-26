import { NextResponse, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { etappeAuswerten, letzteAuswertung, neuAuswerten, vorschlagUebernehmen } from '@/lib/stand';
import { pruefeStandAntworten } from '@/lib/standort';
import { ohneSitzung } from '@/lib/sitzung';

type Ctx = { params: Promise<{ etappe: string }> };
const nummer = async (ctx: Ctx) => { const n = Number((await ctx.params).etappe); return n === 1 || n === 2 || n === 3 ? n : null; };

/** Letzte Antworten und Auswertung einer Etappe. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const nr = await nummer(ctx); if (!nr) return NextResponse.json({ error: 'Etappe unbekannt' }, { status: 404 });
  return NextResponse.json({ letzte: await letzteAuswertung(nr) });
}

/** Antworten speichern und auswerten, nochmal auswerten oder einen Vorschlag übernehmen. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const nr = await nummer(ctx); if (!nr) return NextResponse.json({ error: 'Etappe unbekannt' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (b.aktion === 'uebernehmen') {
    try { return NextResponse.json({ stand: await vorschlagUebernehmen(nr, b.vorschlag) }); }
    catch { return NextResponse.json({ error: 'Vorschlag ungültig' }, { status: 400 }); }
  }
  if (b.aktion === 'neu') {
    const r = await neuAuswerten(nr);
    return r ? NextResponse.json(r) : NextResponse.json({ error: 'Noch keine Antworten' }, { status: 404 });
  }
  const antworten = pruefeStandAntworten(nr, b.antworten);
  if (!antworten) return NextResponse.json({ error: 'Zu jeder Zahl fehlt noch eine Antwort' }, { status: 400 });
  return NextResponse.json(await etappeAuswerten(nr, antworten));
}
