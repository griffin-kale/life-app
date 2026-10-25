/**
 * Geld für die Familie: reine Regeln ohne Datenbank, damit testbar.
 * Beträge immer in Cent. Life ist keine Finanzberatung und gibt keine Anlageempfehlungen.
 */

export const euro = (cent: number) => (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: cent % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';

/** Liest „12,50 Bäcker“, „Bäcker 12.50 €“, „Tanken 60“ oder „3,99€ Milch“. */
export function betragAus(text: string): { cent: number; was: string } | null {
  const treffer = [...text.matchAll(/(\d{1,5})(?:[.,](\d{1,2}))?\s*(€|eur(?:o)?\b)?/gi)];
  if (!treffer.length) return null;
  // Betrag mit Komma oder Euro-Zeichen schlägt bloße Mengen wie „2 Brötchen“
  const m = treffer.find((t) => t[2] || t[3]) ?? treffer[treffer.length - 1];
  const cent = Number(m[1]) * 100 + (m[2] ? Number(m[2].padEnd(2, '0')) : 0);
  if (!cent || cent > 10_000_000) return null;
  const was = (text.slice(0, m.index) + ' ' + text.slice((m.index ?? 0) + m[0].length)).replace(/\b(für|bei|im|beim|euro)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return { cent, was: was.slice(0, 120) || 'Ausgabe' };
}

/**
 * Wochenstand eines Topfs. Freitag bis Sonntag zeigt Life den Rest als Spanne:
 * Wer gegen Ende den genauen Restbetrag sieht, gibt laut Studie mehr aus. Übrig Gebliebenes wandert in die nächste Woche.
 */
export function topfStand(budget: number, ausgaben: number, uebertrag: number, wochentag: number): { rahmen: number; rest: number; anzeige: string; ueber: boolean } {
  const rahmen = budget + Math.max(0, Math.min(uebertrag, budget)); // Übertrag höchstens eine Woche
  const rest = rahmen - ausgaben;
  if (rest < 0) return { rahmen, rest, anzeige: `${euro(-rest)} drüber`, ueber: true };
  if (wochentag >= 4) {
    const zehn = (x: number) => Math.round(x / 1000) * 1000;
    const von = zehn(rest * 0.75); const bis = Math.max(von + 1000, zehn(rest * 1.25));
    return { rahmen, rest, anzeige: rest < 1500 ? 'fast leer' : `noch etwa ${euro(von).replace(' €', '')}–${euro(bis)}`, ueber: false };
  }
  return { rahmen, rest, anzeige: `noch ${euro(rest)}`, ueber: false };
}

export type Profil = { einnahmen: number; fest: number; woche: number; schulden: { name: string; cent: number }[]; ruecklage: number; sparrate: number; pufferMonate: number };

/** Monatliche Ausgaben: feste Kosten plus Wochentöpfe hochgerechnet (52 Wochen durch 12). */
export const monatsAusgaben = (p: Pick<Profil, 'fest' | 'woche'>) => p.fest + Math.round((p.woche * 52) / 12);

export type Stufe = { nr: number; titel: string; erklaerung: string; geschafft: boolean; fortschritt?: number };

/**
 * Stufenplan nach Dave Ramseys Baby Steps, angepasst an deutsche Empfehlungen (Verbraucherzentrale: Notgroschen
 * drei bis sechs Monatsausgaben, Selbstständige mehr) und Peters Ziel von einem Jahr Puffer.
 */
export function stufen(p: Profil): Stufe[] {
  const monat = monatsAusgaben(p);
  const schulden = p.schulden.reduce((a, s) => a + s.cent, 0);
  const kleinste = [...p.schulden].sort((a, b) => a.cent - b.cent)[0];
  const quote = p.einnahmen ? p.sparrate / p.einnahmen : 0;
  const s: Stufe[] = [
    { nr: 1, titel: 'Überblick', erklaerung: 'Einnahmen, feste Kosten und Wochentöpfe stehen in Life.', geschafft: p.einnahmen > 0 && (p.fest > 0 || p.woche > 0) },
    { nr: 2, titel: 'Mehr rein als raus', erklaerung: `Einnahmen über den Ausgaben. Gerade: ${euro(p.einnahmen)} rein, ${euro(monat)} raus im Monat.`, geschafft: p.einnahmen > 0 && p.einnahmen > monat, fortschritt: monat ? Math.min(1, p.einnahmen / monat) : 0 },
    { nr: 3, titel: 'Erster Notgroschen', erklaerung: `Eine Monatsausgabe auf dem Tagesgeld, also ${euro(monat)}.`, geschafft: monat > 0 && p.ruecklage >= monat, fortschritt: monat ? Math.min(1, p.ruecklage / monat) : 0 },
    { nr: 4, titel: 'Konsumschulden weg', erklaerung: schulden ? `Noch ${euro(schulden)}. Kleinste zuerst tilgen, dann die nächste: ${kleinste?.name}.` : 'Keine Konsumschulden eingetragen. Die Baufinanzierung zählt hier nicht.', geschafft: schulden === 0 },
    { nr: 5, titel: 'Puffer voll', erklaerung: `${p.pufferMonate} Monatsausgaben Rücklage, also ${euro(monat * p.pufferMonate)}. Die Verbraucherzentrale rät zu drei bis sechs, Selbstständigen zu mehr.`, geschafft: monat > 0 && p.ruecklage >= monat * p.pufferMonate, fortschritt: monat ? Math.min(1, p.ruecklage / (monat * p.pufferMonate)) : 0 },
    { nr: 6, titel: '15 Prozent sparen', erklaerung: `Jeden Monat automatisch mindestens 15 Prozent der Einnahmen zurücklegen oder anlegen. Gerade ${Math.round(quote * 100)} Prozent.`, geschafft: quote >= 0.15, fortschritt: Math.min(1, quote / 0.15) },
    { nr: 7, titel: 'Vermögen und passives Einkommen', erklaerung: 'Langfristig breit gestreut anlegen. Wie genau, klärst du mit einer unabhängigen Beratung.', geschafft: false },
  ];
  return s;
}

/** Die erste Stufe, die noch nicht geschafft ist. */
export const aktuelleStufe = (s: Stufe[]) => s.find((x) => !x.geschafft) ?? s[s.length - 1];

/** Taschengeld: Wochenbetrag ab Start, minus Ausgaben. Gutgeschrieben wird jeden Montag. */
export function taschengeldGuthaben(wochenbetrag: number, start: string, heute: string, ausgaben: number): number {
  const tage = Math.floor((Date.parse(heute + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 864e5);
  const startWt = (new Date(start + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const montage = tage < 0 ? 0 : Math.floor((tage + startWt) / 7) + (startWt === 0 ? 1 : 0);
  return montage * wochenbetrag - ausgaben;
}
