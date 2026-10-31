/**
 * Was der Coach in Life ändern darf (Peter, 26.10.2026). Claude schlägt eine Aktion vor, Life prüft sie gegen feste Listen
 * und führt sie selbst aus. Die Bestätigung schreibt Life, nicht Claude: So sagt der Coach nie „erledigt“, wenn nichts passiert ist.
 * Rein, ohne Datenbank, damit testbar.
 */
// Wie euro() in geld-regeln, hier eigen, damit die Datei ohne Importe testbar bleibt
const euro = (cent: number) => (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: cent % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';

/** Bereiche einer Saison, gleich wie BEREICHE_S in saison-regeln (der Test prüft das). Hier eigen, damit die Datei ohne Importe testbar bleibt. */
export const SAISON_BEREICHE = ['geschaeft', 'zeit', 'koerper', 'mental', 'sozial', 'geld'] as const;
type SaisonBereich = (typeof SAISON_BEREICHE)[number];

export type CoachAktion =
  | { art: 'sparziel_ziel'; ziel: string; cent: number }
  | { art: 'ruecklage'; cent: number }
  | { art: 'sparrate'; cent: number }
  | { art: 'merken'; text: string }
  | { art: 'vergessen'; nr: number }
  | { art: 'festhalten'; text: string }
  | { art: 'wochenziel'; text: string }
  | { art: 'saison_vorschlag'; ziele: { bereich: SaisonBereich; text: string }[] };

/** Was der Coach zum Prüfen wissen muss: wie viel auf dem Merkzettel steht und ob eine Saison läuft. */
export type AktionKontext = { merkzettel: number; saisonLaeuft: boolean };
export const MERK_MAX = 60;
const AKTIONEN_MAX = 3;

export const AKTIONEN_TEXT = [
  'Du kannst in Life diese Dinge ändern, und nur über das Feld "aktionen" (Liste, höchstens drei, sonst leer):',
  '- {"art": "merken", "text": ein Satz} – dir etwas Festes über Peter merken, das über heute hinaus gilt: Zahlen, Vorlieben, Entscheidungen, Rahmen (etwa „Wohlfühlsumme auf dem Konto: 20.000 €“). Merk dir es, sobald er so etwas sagt, auch ohne „merk dir“. Keine Stimmungen von heute, keine Passwörter, keine Kontonummern.',
  '- {"art": "vergessen", "nr": Nummer aus deinem Merkzettel} – einen Punkt streichen, wenn Peter es sagt oder der Punkt nicht mehr stimmt (dann neu merken)',
  '- {"art": "festhalten", "text": Text} – einen Gedanken oder eine Aufgabe in Peters Logbuch schreiben, wenn er dich darum bittet („schreib auf …“, „erinner mich …“). Life ordnet ihn ein wie jeden Eintrag.',
  '- {"art": "wochenziel", "text": ein Satz} – das Wochenziel setzen, wenn Peter es dir nennt oder einem Vorschlag von dir zustimmt',
  '- {"art": "saison_vorschlag", "ziele": [{"bereich": "geschaeft"|"zeit"|"koerper"|"mental"|"sozial"|"geld", "text": Ziel in höchstens 8 Wörtern}]} – Ziele für die nächste Saison vorschlagen, höchstens eins pro Bereich, nur wenn keine Saison läuft und Peter darüber spricht. Life legt sie ins Blatt „Neue Saison“, Peter wählt dort selbst.',
  '- {"art": "sparziel_ziel", "ziel": Name genau aus der Liste der Sparziele, "euro": Zielsumme} – die Zielsumme eines Sparziels setzen',
  '- {"art": "ruecklage", "euro": Betrag} – den Stand der Rücklage auf dem Tagesgeld setzen',
  '- {"art": "sparrate", "euro": Betrag} – die Sparrate pro Monat setzen',
  'Geldbeträge, Wochenziel und Festhalten nur, wenn Peter in seiner letzten Nachricht ausdrücklich darum bittet oder zustimmt.',
  'Behaupte nie, du hättest etwas gespeichert, gemerkt, geändert oder eingetragen. Life bestätigt selbst, was geklappt hat. Alles andere ändert Peter in der App; sag ihm, wo.',
].join('\n');

/** Text aus einer Claude-Antwort: ohne Steuerzeichen, Leerraum zusammengezogen, gekürzt. */
function klartext(roh: unknown, max: number): string {
  if (typeof roh !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return roh.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

const MAX_CENT = 1_000_000_000; // 10 Mio. €

/** Prüft den Vorschlag von Claude. null: keine Aktion. fehler: Claude wollte etwas, das nicht geht. */
export function aktionPruefen(roh: unknown, sparziele: string[], k: AktionKontext = { merkzettel: 0, saisonLaeuft: false }): CoachAktion | { fehler: string } | null {
  if (!roh || typeof roh !== 'object') return null;
  const a = roh as { art?: unknown; ziel?: unknown; euro?: unknown; text?: unknown; nr?: unknown; ziele?: unknown };
  const art = typeof a.art === 'string' ? a.art : '';
  if (art === 'merken') {
    const text = klartext(a.text, 200);
    if (text.length < 3) return null;
    if (k.merkzettel >= MERK_MAX) return { fehler: `Der Merkzettel ist voll (${MERK_MAX} Punkte). Streich unter Einstellungen etwas.` };
    return { art: 'merken', text };
  }
  if (art === 'vergessen') {
    const nr = Number(a.nr);
    if (!Number.isInteger(nr) || nr < 1 || nr > k.merkzettel) return { fehler: 'Diesen Punkt gibt es auf dem Merkzettel nicht.' };
    return { art: 'vergessen', nr };
  }
  if (art === 'festhalten') {
    const text = klartext(a.text, 1000);
    return text.length >= 3 ? { art: 'festhalten', text } : null;
  }
  if (art === 'wochenziel') {
    const text = klartext(a.text, 200);
    return text.length >= 3 ? { art: 'wochenziel', text } : null;
  }
  if (art === 'saison_vorschlag') {
    if (k.saisonLaeuft) return { fehler: 'Die Saison läuft schon. Ziele änderst du unter Plan → Saison.' };
    const liste = Array.isArray(a.ziele) ? a.ziele : [];
    const ziele: { bereich: SaisonBereich; text: string }[] = [];
    for (const z of liste.slice(0, 12)) {
      const b = (z as { bereich?: unknown })?.bereich; const text = klartext((z as { text?: unknown })?.text, 80);
      if (typeof b !== 'string' || !(SAISON_BEREICHE as readonly string[]).includes(b) || text.length < 3 || ziele.some((x) => x.bereich === b)) continue;
      ziele.push({ bereich: b as SaisonBereich, text });
    }
    return ziele.length ? { art: 'saison_vorschlag', ziele } : null;
  }
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

/** Bis zu drei Aktionen aus "aktionen" (Liste) oder dem alten Feld "aktion". */
export function aktionenPruefen(roh: { aktionen?: unknown; aktion?: unknown }, sparziele: string[], k?: AktionKontext): (CoachAktion | { fehler: string })[] {
  const liste = Array.isArray(roh.aktionen) ? roh.aktionen : roh.aktion ? [roh.aktion] : [];
  const aus: (CoachAktion | { fehler: string })[] = [];
  let merk = k?.merkzettel ?? 0;
  for (const x of liste.slice(0, AKTIONEN_MAX)) {
    const a = aktionPruefen(x, sparziele, { merkzettel: merk, saisonLaeuft: k?.saisonLaeuft ?? false });
    if (!a) continue;
    if ('art' in a && a.art === 'merken') merk++;
    aus.push(a);
  }
  return aus;
}

/** Die Bestätigung, die Life unter die Antwort des Coachs setzt. */
export function bestaetigung(a: CoachAktion): string {
  if (a.art === 'merken') return `✓ Gemerkt: ${a.text}`;
  if (a.art === 'vergessen') return `✓ Vom Merkzettel gestrichen: Punkt ${a.nr}.`;
  if (a.art === 'festhalten') return `✓ Im Logbuch festgehalten: ${a.text.length > 80 ? a.text.slice(0, 79) + '…' : a.text}`;
  if (a.art === 'wochenziel') return `✓ Wochenziel gesetzt: ${a.text}`;
  if (a.art === 'saison_vorschlag') return `✓ ${a.ziele.length} ${a.ziele.length === 1 ? 'Ziel liegt' : 'Ziele liegen'} im Blatt „Neue Saison“ bereit: Plan → Saison → Neue Saison anlegen.`;
  if (a.art === 'sparziel_ziel') return `✓ Gespeichert: Ziel für „${a.ziel}“ ist jetzt ${euro(a.cent)}.`;
  if (a.art === 'ruecklage') return `✓ Gespeichert: Rücklage steht jetzt bei ${euro(a.cent)}.`;
  return `✓ Gespeichert: Sparrate ist jetzt ${euro(a.cent)} pro Monat.`;
}

/** Wann der Coach im Gespräch das stärkste Modell bekommt: bei Entscheidungen, Planung, Überlastung und langen Nachrichten. */
export function entscheidend(nachricht: string): boolean {
  if (nachricht.length >= 280) return true;
  return /(?<!\p{L})(soll ich|sollte ich|entscheid|abwäg|ob ich|was meinst du|was würdest du|prior|wichtigst|woche planen|plan für|strategie|überfordert|überlastet|zu viel|stress|angst|sorge|kündig|investier|kaufen oder|zusagen|absagen)/iu.test(nachricht);
}
