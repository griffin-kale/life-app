/**
 * Regeln für den lebenden Plan in der Ablage (0.31, Peter 31.10.2026). Läuft nur im Browser auf entschlüsselten Daten.
 * Rein, ohne Datenbank und ohne Importe, damit testbar.
 */
export type Obj = Record<string, unknown>;
export type Rhythmus = 'taeglich' | 'woechentlich' | 'seltener';
export type Gewohnheit = { id: string; text: string; rhythmus: Rhythmus; quelle: 'gewohnheit' | 'rhythmus'; info: string };

export const istObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
export const liste = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

/** Ein Wert als lesbarer Text: Text bleibt Text, ein Objekt zeigt Text, Name, Titel oder Frage, sonst seine einfachen Werte. */
export function txt(x: unknown): string {
  if (typeof x === 'string') return x;
  if (typeof x === 'number' || typeof x === 'boolean') return String(x);
  if (istObj(x)) {
    for (const k of ['text', 'name', 'titel', 'frage']) if (typeof x[k] === 'string') return x[k] as string;
    return Object.values(x).filter((v) => typeof v === 'string' || typeof v === 'number').join(' · ');
  }
  return '';
}

/** Rhythmus aus freiem Text: „täglich“, „Tag“, „morgens“ ist täglich; „wöchentlich“, „Woche“, „sonntags“ ist wöchentlich. */
export function rhythmusAus(...felder: unknown[]): Rhythmus {
  const s = felder.map(txt).join(' ').toLowerCase();
  if (/(t[äa]glich|\btag\b|daily|morgens|abends|jeden tag)/.test(s)) return 'taeglich';
  if (/(w[öo]chentlich|\bwoche\b|weekly|sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|jede woche)/.test(s)) return 'woechentlich';
  return 'seltener';
}

/** Alles Wiederkehrende aus dem Plan: Gewohnheiten und Rhythmen. Die Kennung ist der Text, damit Haken neue Fassungen überstehen. */
export function gewohnheiten(plan: Obj): Gewohnheit[] {
  const aus: Gewohnheit[] = [];
  for (const g of liste(plan.dividenden_gewohnheiten).filter(istObj)) {
    const text = txt(g.text); if (!text) continue;
    aus.push({ id: 'g:' + text, text, rhythmus: rhythmusAus(g.rhythmus, g.ebene), quelle: 'gewohnheit', info: [txt(g.rhythmus), txt(g.ebene)].filter(Boolean).join(' · ') });
  }
  const bs = istObj(plan.betriebssystem) ? plan.betriebssystem : {};
  for (const r of liste(bs.rhythmen).filter(istObj)) {
    const text = txt(r.name); if (!text) continue;
    aus.push({ id: 'r:' + text, text, rhythmus: rhythmusAus(r.ebene, r.name), quelle: 'rhythmus', info: [r.dauer_min ? `${txt(r.dauer_min)} Min.` : '', txt(r.inhalt)].filter(Boolean).join(' · ') });
  }
  const gesehen = new Set<string>();
  return aus.filter((g) => (gesehen.has(g.id) ? false : (gesehen.add(g.id), true)));
}

export type Abendfrage = { frage: string; optionen: string[] };
/** Die Abendfrage aus dem ersten täglichen Rhythmus, sonst eine neutrale. */
export function abendfrage(plan: Obj): Abendfrage {
  const bs = istObj(plan.betriebssystem) ? plan.betriebssystem : {};
  const rh = liste(bs.rhythmen).filter(istObj);
  const r = rh.find((x) => istObj(x.abendfrage) && rhythmusAus(x.ebene, x.name) === 'taeglich') ?? rh.find((x) => istObj(x.abendfrage));
  const f = r && istObj(r.abendfrage) ? r.abendfrage : null;
  const optionen = f ? liste(f.optionen).map(txt).filter(Boolean).slice(0, 6) : [];
  return f && txt(f.frage) ? { frage: txt(f.frage), optionen: optionen.length ? optionen : ['Ja', 'Teilweise', 'Nein'] }
    : { frage: 'Hast du heute etwas für dein Ziel getan?', optionen: ['Ja', 'Teilweise', 'Nein'] };
}
/** Zählt eine Antwort als erfüllt? Die erste Option gilt als volles Ja. */
export const erfuellt = (antwort: string | undefined, a: Abendfrage) => !!antwort && antwort === a.optionen[0];

/** Zielquote wie „4/5“ aus dem Plan, sonst null. */
export function zielquote(plan: Obj): [number, number] | null {
  const bs = istObj(plan.betriebssystem) ? plan.betriebssystem : {};
  for (const r of liste(bs.rhythmen).filter(istObj)) {
    const m = /^(\d)\s*\/\s*(\d)$/.exec(txt(r.zielquote).trim());
    if (m && Number(m[1]) <= Number(m[2])) return [Number(m[1]), Number(m[2])];
  }
  return null;
}

/** Datum in Berlin als JJJJ-MM-TT, Montag der Woche, Quartal. Nur im Browser genutzt. */
export function tagBerlin(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function montagVon(tag: string): string {
  const d = new Date(tag + 'T12:00:00Z'); const wt = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wt); return d.toISOString().slice(0, 10);
}
export function wochenTage(montag: string): string[] {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(montag + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
}
export const quartal = (tag: string) => `${tag.slice(0, 4)}-Q${Math.floor((Number(tag.slice(5, 7)) - 1) / 3) + 1}`;
export const tageBis = (von: string, bis: string) => Math.round((Date.parse(bis + 'T12:00:00Z') - Date.parse(von + 'T12:00:00Z')) / 864e5);

/** Was sich zwischen zwei Fassungen des Plans geändert hat, je Abschnitt: neu, entfernt, geändert (nach Text verglichen). */
export type Abgleich = { abschnitt: string; neu: string[]; entfernt: string[]; geaendert: boolean }[];
export function abgleich(alt: Obj, neu: Obj): Abgleich {
  const schluessel = [...new Set([...Object.keys(alt), ...Object.keys(neu)])];
  const aus: Abgleich = [];
  for (const k of schluessel) {
    const a = alt[k], n = neu[k];
    if (JSON.stringify(a) === JSON.stringify(n)) continue;
    if (Array.isArray(a) || Array.isArray(n)) {
      const ta = liste(a).map(eintragText).filter(Boolean), tn = liste(n).map(eintragText).filter(Boolean);
      aus.push({ abschnitt: k, neu: tn.filter((t) => !ta.includes(t)), entfernt: ta.filter((t) => !tn.includes(t)), geaendert: true });
    } else aus.push({ abschnitt: k, neu: [], entfernt: [], geaendert: true });
  }
  return aus;
}
/** Text eines Listeneintrags für den Abgleich; Jahresziele zeigen das Jahr. */
function eintragText(x: unknown): string {
  if (istObj(x) && x.jahr !== undefined && Array.isArray(x.ziele)) return `${txt(x.jahr)}: ${x.ziele.length} Ziele`;
  return txt(x).slice(0, 120);
}

/** Lesbare Namen der Abschnitte. Unbekannte zeigen ihren Schlüssel. */
export const ABSCHNITT: Record<string, string> = {
  titel: 'Titel', ziel: 'Ziel', weg: 'Weg', stand: 'Stand', fokus_wahlen: 'Entscheidende Wahlen', annahmen: 'Annahmen', kategorien: 'Kategorien',
  phasen: 'Phasen', jahresziele: 'Jahresziele', dividenden_gewohnheiten: 'Gewohnheiten', rote_linien: 'Rote Linien', betriebssystem: 'Prinzipien und Rhythmen',
};
