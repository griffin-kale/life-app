import type { Item } from './db';

/** Feste Regeln des Coachs. Was hier steht, kommt in jedem Fall auf den Bildschirm, auch wenn Claude ausfällt. */
const TAGE_ENGPASS = 3;

export function warnsignale(items: Pick<Item, 'kategorie' | 'hebel' | 'status' | 'stapel' | 'created_at' | 'schritt' | 'titel' | 'text'>[], jetzt = Date.now()): string[] {
  const w: string[] = [];
  const alt = items.filter((i) => (i.kategorie === 'engpass' || i.hebel === 3) && i.status === 'sortiert'
    && (i.stapel === 'jetzt' || i.stapel === 'woche') && jetzt - new Date(i.created_at).getTime() > TAGE_ENGPASS * 864e5);
  for (const i of alt.slice(0, 2)) {
    const tage = Math.floor((jetzt - new Date(i.created_at).getTime()) / 864e5);
    w.push(`„${(i.schritt || i.titel || i.text).slice(0, 70)}“ wirkt auf den Engpass und liegt seit ${tage} Tagen.`);
  }
  return w;
}

export type Nacht = { tag: string; schlaf_min: number | null };

/** Drei Nächte in Folge unter 6,5 Stunden. Erwartet die Nächte neueste zuerst. */
export function schlafWarnung(naechte: Nacht[]): string | null {
  const letzte = naechte.slice(0, 3);
  if (letzte.length < 3 || letzte.some((n) => n.schlaf_min === null || n.schlaf_min >= 390)) return null;
  return 'Drei Nächte unter 6,5 Stunden. Heute kein hartes Training, früh ins Bett.';
}

/** Geplante Krafttage (0 = Montag), die vorbei sind und ohne Einheit blieben. Zwei in Folge sind ein Warnsignal. */
export function ausgefalleneTrainings(planTage: number[], erledigteTage: string[], heute: string, seit: string | null, tageZurueck = 14): number {
  if (!seit) return 0; // Vor der ersten Einheit fällt nichts aus
  const fertig = new Set(erledigteTage);
  let inFolge = 0;
  for (let i = 1; i <= tageZurueck; i++) {
    const d = new Date(Date.parse(heute + 'T12:00:00Z') - i * 864e5);
    const wd = (d.getUTCDay() + 6) % 7;
    const tag = d.toISOString().slice(0, 10);
    if (tag <= seit) break;
    if (!planTage.includes(wd)) continue;
    if (fertig.has(tag)) break;
    inFolge++;
  }
  return inFolge;
}

const stunden = (m: number) => (m / 60).toFixed(1).replace('.', ',');

/** Zusammenfassung der Körperwerte für Claude: nur Durchschnitte und Zählungen, kein Datum, keine Uhrzeit. */
export function koerperZusammenfassung(k: { naechte: Nacht[]; erholung: (number | null)[]; ruhepuls: (number | null)[]; kraft: number; kraftSoll: number; zone2: number; intervall: number; proteinGestern?: number | null; proteinZiel?: number | null }): string {
  const zeilen: string[] = [];
  const s = k.naechte.map((n) => n.schlaf_min).filter((x): x is number => x !== null);
  if (s.length) zeilen.push(`Schlaf letzte Nacht ${stunden(s[0])} h, Schnitt der letzten ${s.length} Nächte ${stunden(s.reduce((a, b) => a + b, 0) / s.length)} h`);
  const e = k.erholung.filter((x): x is number => x !== null);
  if (e.length) zeilen.push(`Erholung heute ${e[0]} %, Schnitt ${Math.round(e.reduce((a, b) => a + b, 0) / e.length)} %`);
  const r = k.ruhepuls.filter((x): x is number => x !== null);
  if (r.length > 3) { const schnitt = r.slice(1).reduce((a, b) => a + b, 0) / (r.length - 1); zeilen.push(`Ruhepuls heute ${r[0]}, ${r[0] - schnitt >= 0 ? '+' : ''}${Math.round(r[0] - schnitt)} gegenüber dem Schnitt`); }
  zeilen.push(`Training diese Woche: Kraft ${k.kraft} von ${k.kraftSoll}, Zone 2 ${k.zone2} von 180 Minuten, Intervalle ${k.intervall} von 1`);
  if (k.proteinGestern != null && k.proteinZiel) zeilen.push(`Protein gestern etwa ${Math.round(k.proteinGestern)} von ${Math.round(k.proteinZiel)} g`);
  return zeilen.join('\n');
}
