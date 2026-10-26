/**
 * Was der Coach in Life ändern darf (Peter, 26.10.2026). Claude schlägt eine Aktion vor, Life prüft sie gegen feste Listen
 * und führt sie selbst aus. Die Bestätigung schreibt Life, nicht Claude: So sagt der Coach nie „erledigt“, wenn nichts passiert ist.
 * Rein, ohne Datenbank, damit testbar.
 */
// Wie euro() in geld-regeln, hier eigen, damit die Datei ohne Importe testbar bleibt
const euro = (cent: number) => (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: cent % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';

export type CoachAktion =
  | { art: 'sparziel_ziel'; ziel: string; cent: number }
  | { art: 'ruecklage'; cent: number }
  | { art: 'sparrate'; cent: number };

export const AKTIONEN_TEXT = [
  'Du kannst in Life genau drei Dinge ändern, und nur über das Feld "aktion":',
  '- {"art": "sparziel_ziel", "ziel": Name genau aus der Liste der Sparziele, "euro": Zielsumme} – die Zielsumme eines Sparziels setzen',
  '- {"art": "ruecklage", "euro": Betrag} – den Stand der Rücklage auf dem Tagesgeld setzen',
  '- {"art": "sparrate", "euro": Betrag} – die Sparrate pro Monat setzen',
  'Setz eine Aktion nur, wenn Peter in seiner letzten Nachricht ausdrücklich darum bittet und den Betrag nennt. Sonst "aktion": null.',
  'Behaupte nie, du hättest etwas gespeichert, geändert oder eingetragen. Life bestätigt selbst, was geklappt hat. Alles andere ändert Peter in der App; sag ihm, wo.',
].join('\n');

const MAX_CENT = 1_000_000_000; // 10 Mio. €

/** Prüft den Vorschlag von Claude. null: keine Aktion. fehler: Claude wollte etwas, das nicht geht. */
export function aktionPruefen(roh: unknown, sparziele: string[]): CoachAktion | { fehler: string } | null {
  if (!roh || typeof roh !== 'object') return null;
  const a = roh as { art?: unknown; ziel?: unknown; euro?: unknown };
  const art = typeof a.art === 'string' ? a.art : '';
  if (!['sparziel_ziel', 'ruecklage', 'sparrate'].includes(art)) return null;
  const zahl = typeof a.euro === 'number' ? a.euro : Number(String(a.euro ?? '').replace(/\./g, '').replace(',', '.'));
  const cent = Math.round(zahl * 100);
  if (!Number.isFinite(cent) || cent < 0 || cent > MAX_CENT) return { fehler: 'Den Betrag konnte ich nicht lesen.' };
  if (art === 'sparziel_ziel') {
    const wunsch = typeof a.ziel === 'string' ? a.ziel.trim().toLowerCase() : '';
    const ziel = sparziele.find((s) => s.toLowerCase() === wunsch);
    if (!ziel) return { fehler: sparziele.length ? `Ein Sparziel mit diesem Namen gibt es nicht. Vorhanden: ${sparziele.join(', ')}.` : 'Es gibt noch kein Sparziel. Leg es unter Geld → Sparziele an.' };
    if (cent === 0) return { fehler: 'Eine Zielsumme von 0 € geht nicht.' };
    return { art: 'sparziel_ziel', ziel, cent };
  }
  return { art: art as 'ruecklage' | 'sparrate', cent };
}

/** Die Bestätigung, die Life unter die Antwort des Coachs setzt. */
export function bestaetigung(a: CoachAktion): string {
  if (a.art === 'sparziel_ziel') return `✓ Gespeichert: Ziel für „${a.ziel}“ ist jetzt ${euro(a.cent)}.`;
  if (a.art === 'ruecklage') return `✓ Gespeichert: Rücklage steht jetzt bei ${euro(a.cent)}.`;
  return `✓ Gespeichert: Sparrate ist jetzt ${euro(a.cent)} pro Monat.`;
}

/** Wann der Coach im Gespräch das stärkste Modell bekommt: bei Entscheidungen, Planung, Überlastung und langen Nachrichten. */
export function entscheidend(nachricht: string): boolean {
  if (nachricht.length >= 280) return true;
  return /(?<!\p{L})(soll ich|sollte ich|entscheid|abwäg|ob ich|was meinst du|was würdest du|prior|wichtigst|woche planen|plan für|strategie|überfordert|überlastet|zu viel|stress|angst|sorge|kündig|investier|kaufen oder|zusagen|absagen)/iu.test(nachricht);
}
