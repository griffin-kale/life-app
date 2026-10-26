import { NextResponse, after, type NextRequest } from 'next/server';
import { begrenzt } from '@/lib/ratelimit';
import { ensureSchema, getSetting, sql, type Item } from '@/lib/db';
import { AKTIV, engpassAus, heuteBerlin, laeuftGerade, liste, offene, sortiere, tagesStartNoetig } from '@/lib/priorisieren';
import { ohneSitzung } from '@/lib/sitzung';

/** Alles für Heute und Woche: offene Stapel, heute Erledigtes, Ziele mit Fortschritt dieser Woche. */
export async function GET() {
  const aus = await ohneSitzung(); if (aus) return aus;
  await ensureSchema();
  const neuerTag = await tagesStartNoetig();
  if (neuerTag) after(() => sortiere('tag'));
  const tag = heuteBerlin();
  const [items, erledigt, zuletzt, kontext, zieleText, sortAm, fehler, laeuft, wartet] = await Promise.all([
    offene(),
    sql<Item[]>`select * from items where status = 'erledigt' and erledigt_at >= date_trunc('week', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' order by erledigt_at desc`,
    // Was heute festgehalten wurde, für die Spur im Coach-Gespräch
    sql<Item[]>`select * from items where status <> 'archiv' and created_at >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' order by created_at desc limit 50`,
    getSetting('kontext'), getSetting('ziele'), getSetting('sort_am'), getSetting('sort_fehler'), laeuftGerade(),
    sql<{ n: number }[]>`select count(*)::int as n from items where status = 'neu' and fehler is null and created_at > now() - interval '5 minutes'`,
  ]);
  const ziele = liste(zieleText);
  const zielStand = ziele.map((z) => ({
    ziel: z,
    offen: items.filter((i) => i.ziel === z && i.stapel !== 'streichen').length,
    erledigt: erledigt.filter((i) => i.ziel === z).length,
  }));
  return NextResponse.json({
    tag,
    items: items.map((i) => (i.zeit_tag === tag ? i : { ...i, zeit: null })),
    erledigtHeute: erledigt.filter((i) => heuteBerlin(new Date(i.erledigt_at!)) === tag),
    erledigtWoche: erledigt.length,
    zuletzt,
    engpass: engpassAus(kontext),
    ziele: zielStand,
    sortiertAm: sortAm || null,
    fehler: fehler || null,
    laeuft: neuerTag || laeuft || wartet[0].n > 0,
    aktiv: AKTIV,
    // Energie-Bilanz der Woche: was Kraft gab und was sie kostete
    kraft: {
      gab: erledigt.filter((i) => i.energie === 1).map((i) => i.schritt || i.titel || i.text.slice(0, 60)).slice(0, 8),
      kostete: erledigt.filter((i) => i.energie === -1).map((i) => i.schritt || i.titel || i.text.slice(0, 60)).slice(0, 8),
    },
  });
}

/** Neu sortieren auf Knopfdruck. */
export async function POST(req: NextRequest) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const zuViel = begrenzt(req, 'sortieren'); if (zuViel) return zuViel;
  await ensureSchema();
  after(() => sortiere('tag'));
  return NextResponse.json({ ok: true });
}
