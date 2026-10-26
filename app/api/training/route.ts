import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { ensureSchema, sql } from '@/lib/db';
import { standSpeichern, trainingStand } from '@/lib/koerper';
import { heuteBerlin } from '@/lib/priorisieren';
import { begrenzt } from '@/lib/ratelimit';
import { einheitPlanen, MUSKELN, nachEinheit, UEBUNGEN, uebung, type Ergebnis, type Feedback, type Muskel } from '@/lib/training';
import { ohneSitzung } from '@/lib/sitzung';

const PUMP = ['wenig', 'mittel', 'stark']; const KATER = ['keiner', 'weg', 'noch da']; const GELENKE = ['gut', 'zieht', 'schmerzt'];

/** Die Einheit für heute, fertig geplant. */
export async function GET() {
  const aus = await ohneSitzung(); if (aus) return aus;
  const s = await trainingStand();
  const heute = heuteBerlin();
  return NextResponse.json({ stand: { einheitenSoll: s.einheitenSoll, uhrzeit: s.uhrzeit, volumen: s.volumen }, einheit: einheitPlanen(s, heute) });
}

export async function POST(req: NextRequest) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  const heute = heuteBerlin();
  if (['zone2', 'intervall', 'mobil'].includes(b.art)) {
    const dauer = Math.max(5, Math.min(240, Math.round(Number(b.dauer_min) || 0)));
    await sql`insert into trainings (user_id, quelle, extern_id, tag, start, dauer_min, art, zone2_min)
      values ('peter', 'life', ${randomUUID()}, ${heute}, now(), ${dauer}, ${b.art}, ${b.art === 'zone2' ? dauer : null})`;
    return NextResponse.json({ ok: true });
  }
  if (b.art !== 'kraft' || !Array.isArray(b.saetze)) return NextResponse.json({ error: 'Unbekannte Einheit' }, { status: 400 });
  const ergebnisse: Ergebnis[] = b.saetze.slice(0, 20).filter((e: Ergebnis) => uebung(String(e?.uebung)) && Array.isArray(e.wdh))
    .map((e: Ergebnis) => ({ uebung: String(e.uebung), wdh: e.wdh.slice(0, 8).map((x) => Math.max(0, Math.min(300, Math.round(Number(x) || 0)))) }));
  if (!ergebnisse.some((e) => e.wdh.some((x) => x > 0))) return NextResponse.json({ error: 'Kein Satz eingetragen' }, { status: 400 });
  const fb: Feedback = {};
  for (const m of MUSKELN) {
    const f = b.feedback?.[m]; if (!f) continue;
    fb[m] = { pump: PUMP.includes(f.pump) ? f.pump : undefined, kater: KATER.includes(f.kater) ? f.kater : undefined, gelenke: GELENKE.includes(f.gelenke) ? f.gelenke : undefined };
  }
  const notiz = typeof b.notiz === 'string' ? b.notiz.trim().slice(0, 1500) : '';
  const s = await trainingStand();
  const { stand, hinweise } = nachEinheit(s, heute, ergebnisse, fb);
  const dauer = Math.max(5, Math.min(240, Math.round(Number(b.dauer_min) || 40)));
  await sql`insert into trainings (user_id, quelle, extern_id, tag, start, dauer_min, art, saetze, feedback)
    values ('peter', 'life', ${randomUUID()}, ${heute}, now(), ${dauer}, 'kraft', ${sql.json(ergebnisse as never)}, ${sql.json({ ...fb, ...(notiz ? { notiz } : {}) } as never)})`;
  await standSpeichern(stand);
  return NextResponse.json({ ok: true, hinweise });
}

/** Einstellungen des Plans: Einheiten pro Woche, Uhrzeit, Übung tauschen. */
export async function PATCH(req: NextRequest) {
  const aus = await ohneSitzung(); if (aus) return aus;
  const zuViel = begrenzt(req, 'schreiben'); if (zuViel) return zuViel;
  const b = await req.json().catch(() => ({}));
  const s = await trainingStand();
  if ([2, 3, 4].includes(b.einheitenSoll)) s.einheitenSoll = b.einheitenSoll;
  if (typeof b.uhrzeit === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.uhrzeit)) s.uhrzeit = b.uhrzeit;
  if (b.tausch && (MUSKELN as readonly string[]).includes(b.tausch.muskel)) {
    const m = b.tausch.muskel as Muskel; const slot = s.einheitNr % 2;
    const alle = UEBUNGEN.filter((u) => u.muskel === m).map((u) => u.id);
    const jetzt = s.wahl[m][slot]; const rest = alle.filter((id) => !s.wahl[m].includes(id));
    if (rest.length) s.wahl[m][slot] = rest[(rest.indexOf(jetzt) + 1) % rest.length] ?? rest[0];
  }
  await standSpeichern(s);
  return NextResponse.json({ ok: true, einheit: einheitPlanen(s, heuteBerlin()), stand: { einheitenSoll: s.einheitenSoll, uhrzeit: s.uhrzeit } });
}
