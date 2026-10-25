/** Menschen: reine Regeln ohne Datenbank. */

export const KREISE = { familie: 'Familie', freunde: 'Freunde', team: 'Team', netzwerk: 'Netzwerk und Kunden' } as const;
export type Kreis = keyof typeof KREISE;
/** Wie oft Kontakt gut wäre, in Tagen. Lässt sich pro Person ändern. */
export const TAKT: Record<Kreis, number> = { familie: 7, freunde: 21, team: 14, netzwerk: 60 };

const tage = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

/** Fällig, wenn der letzte Kontakt länger her ist als der Takt. Ohne Kontakt zählt das Anlegen als Start. */
export function faellig(letzter: string | null, angelegt: string, takt: number, heute: string): { seit: number; faellig: boolean } {
  const seit = tage(letzter ?? angelegt, heute);
  return { seit, faellig: seit >= takt };
}

/** Tage bis zum nächsten Geburtstag (0 = heute). Der 29. Februar fällt in Nicht-Schaltjahren auf den 28. */
export function bisGeburtstag(geburtstag: string, heute: string): number {
  const [, m, d] = geburtstag.split('-').map(Number);
  const j = Number(heute.slice(0, 4));
  const am = (jahr: number) => { const schalt = (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0; const dd = m === 2 && d === 29 && !schalt ? 28 : d; return `${jahr}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`; };
  const diesJahr = tage(heute, am(j));
  return diesJahr >= 0 ? diesJahr : tage(heute, am(j + 1));
}

/** Freundschaft braucht Zeit: rund 50 Stunden bis zum lockeren Freund, 90 bis zum Freund, über 200 bis zum engen Freund (Hall 2018). */
export function freundschaftsStufe(stunden: number): { stufe: string; naechste: number | null } {
  if (stunden >= 200) return { stufe: 'enger Freund', naechste: null };
  if (stunden >= 90) return { stufe: 'Freund', naechste: 200 };
  if (stunden >= 50) return { stufe: 'lockerer Freund', naechste: 90 };
  return { stufe: 'Bekannte', naechste: 50 };
}

/** Wenn-dann-Plan als Satz. */
export const wennDann = (zeit: string, ort: string, aufgabe: string) => `Wenn es ${zeit} ist${ort ? ` und ich ${ort} bin` : ''}, dann: ${aufgabe}.`;
