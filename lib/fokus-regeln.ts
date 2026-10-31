/**
 * Fokus (0.27, Peter 31.10.2026): Block mit fester Pause, Musik oder Stille, danach ein Tipp, wie es lief.
 * Reine Regeln ohne Datenbank für die Einheitstests. Zeiten in Millisekunden seit 1970.
 */

/** Fokus und Pause in Minuten. Feste Pausen gingen in einer Studie (Biwer u. a. 2023) mit weniger Erschöpfung einher. */
export const LAENGEN: readonly [number, number][] = [[25, 5], [50, 10], [90, 20]];
export const MUSIK = ['klassik', 'welle', 'rauschen', 'stille'] as const;
export type Musik = (typeof MUSIK)[number];
export const MUSIK_NAME: Record<Musik, string> = { klassik: 'Klassik', welle: 'Fokus-Welle', rauschen: 'Rauschen', stille: 'Stille' };
export const BEWERTUNG = ['zaeh', 'okay', 'fluss'] as const;
export type Bewertung = (typeof BEWERTUNG)[number];
export const BEWERTUNG_NAME: Record<Bewertung, string> = { zaeh: 'zäh', okay: 'okay', fluss: 'im Fluss' };

/** Im Musiktest wechseln diese drei ab. Rauschen bleibt draußen, damit der Vergleich nach zwei Wochen genug Blöcke pro Art hat. */
export const TEST_ARTEN: readonly Musik[] = ['klassik', 'welle', 'stille'];
export const TEST_TAGE = 14;
/** Ab so vielen bewerteten Blöcken pro Art sagt Life etwas über diese Art. */
export const TEST_MIN = 3;

export const laengeOk = (m: number, p: number) => LAENGEN.some(([a, b]) => a === m && b === p);

export type Phase = { phase: 'fokus' | 'pause' | 'fertig'; restSek: number; anteil: number };
/** Wo steht ein Block? Rechnet nur aus Startzeit und Längen, deshalb läuft der Timer weiter, auch wenn die App zu ist. */
export function phase(start: number, minuten: number, pause: number, jetzt: number): Phase {
  const vergangen = Math.max(0, (jetzt - start) / 1000);
  const f = minuten * 60; const p = pause * 60;
  if (vergangen < f) return { phase: 'fokus', restSek: Math.ceil(f - vergangen), anteil: vergangen / f };
  if (vergangen < f + p) return { phase: 'pause', restSek: Math.ceil(f + p - vergangen), anteil: (vergangen - f) / p };
  return { phase: 'fertig', restSek: 0, anteil: 1 };
}
export const uhr = (sek: number) => `${Math.floor(sek / 60)}:${String(Math.max(0, sek) % 60).padStart(2, '0')}`;

/** Nächste Musik im Test: die Art mit den wenigsten Blöcken bisher, bei Gleichstand in fester Reihenfolge. */
export function naechsteTestMusik(bisher: Musik[]): Musik {
  const zahl = (m: Musik) => bisher.filter((x) => x === m).length;
  return [...TEST_ARTEN].sort((a, b) => zahl(a) - zahl(b) || TEST_ARTEN.indexOf(a) - TEST_ARTEN.indexOf(b))[0];
}

export type TestZeile = { musik: Musik; bloecke: number; fluss: number; anteil: number | null };
export type TestStand = { tag: number; fertig: boolean; zeilen: TestZeile[]; beste: Musik | null; satz: string };
/**
 * Auswertung des Musiktests: Anteil der Blöcke „im Fluss“ je Art. Eine Art gewinnt erst mit genug Blöcken
 * und mindestens zehn Prozentpunkten Abstand, sonst sagt Life ehrlich, dass es keinen klaren Unterschied gibt.
 */
export function testAuswerten(bloecke: { musik: Musik; bewertung: Bewertung | null }[], startTag: string, heute: string): TestStand {
  const tag = Math.min(TEST_TAGE, Math.max(1, Math.round((Date.parse(heute + 'T00:00:00Z') - Date.parse(startTag + 'T00:00:00Z')) / 86_400_000) + 1));
  const zeilen: TestZeile[] = TEST_ARTEN.map((m) => {
    const b = bloecke.filter((x) => x.musik === m && x.bewertung);
    const fluss = b.filter((x) => x.bewertung === 'fluss').length;
    return { musik: m, bloecke: b.length, fluss, anteil: b.length >= TEST_MIN ? fluss / b.length : null };
  });
  const fertig = tag >= TEST_TAGE;
  const gewertet = zeilen.filter((z) => z.anteil !== null).sort((a, b) => b.anteil! - a.anteil!);
  let beste: Musik | null = null;
  let satz: string;
  if (gewertet.length < 2) satz = `Noch zu wenige bewertete Blöcke. Ab ${TEST_MIN} pro Art zeigt Life einen Vergleich.`;
  else if (gewertet[0].anteil! - gewertet[1].anteil! >= 0.1) {
    beste = gewertet[0].musik;
    satz = `${fertig ? 'Ergebnis' : 'Bisher'}: Mit ${MUSIK_NAME[beste]} warst du am häufigsten im Fluss (${Math.round(gewertet[0].anteil! * 100)} %).`;
  } else satz = `${fertig ? 'Ergebnis' : 'Bisher'}: kein klarer Unterschied. Nimm, was dir gefällt.`;
  return { tag, fertig, zeilen, beste, satz };
}
