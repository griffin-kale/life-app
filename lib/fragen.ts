/**
 * Die Fragebögen von Life. Alles klickbar, zu jeder Frage geht zusätzlich ein eigener Satz.
 * Gemeinsam genutzt von Oberfläche und Server: der Server nimmt nur Antworten an, die hier stehen.
 */

export type Frage =
  | { id: string; frage: string; typ: 'skala'; werte: { wert: number; label: string }[]; pflicht?: boolean }
  | { id: string; frage: string; typ: 'mehrfach'; optionen: string[] }
  | { id: string; frage: string; typ: 'plan' } // Wenn-dann-Plan: Aufgabe plus Tageszeit
  | { id: string; frage: string; typ: 'text'; platzhalter: string };

export type Bogen = { art: 'morgen' | 'abend' | 'woche'; titel: string; hinweis: string; fragen: Frage[] };

const skala = (labels: string[], start = 1) => labels.map((label, i) => ({ wert: start + i, label }));

export const TAGESZEITEN = ['gleich morgens', 'am Vormittag', 'nach dem Mittag', 'am Nachmittag', 'am Abend'];

export const BOEGEN: Record<Bogen['art'], Bogen> = {
  morgen: {
    art: 'morgen', titel: 'Guten Morgen', hinweis: 'Eine Frage, zehn Sekunden.',
    fragen: [{ id: 'erholung', frage: 'Wie erholt fühlst du dich?', typ: 'skala', pflicht: true, werte: skala(['leer', 'müde', 'okay', 'gut', 'voller Kraft']) }],
  },
  abend: {
    art: 'abend', titel: 'Der Tag', hinweis: 'Drei Fragen, eine Minute. Die guten Dinge sind freiwillig.',
    fragen: [
      { id: 'tag', frage: 'Wie war der Tag?', typ: 'skala', pflicht: true, werte: skala(['mies', 'zäh', 'okay', 'gut', 'stark']) },
      { id: 'kraft', frage: 'Was hat Kraft gekostet?', typ: 'mehrfach', optionen: ['Termine', 'Kunden', 'Team', 'Familie', 'zu wenig Schlaf', 'Körper', 'Grübeln', 'Bildschirm', 'Nichts'] },
      { id: 'plan', frage: 'Das Wichtigste für morgen', typ: 'plan' },
      { id: 'gut', frage: 'Drei gute Dinge von heute', typ: 'text', platzhalter: 'Gern diktiert, eins pro Zeile' },
    ],
  },
  woche: {
    art: 'woche', titel: 'Deine Woche', hinweis: 'Zwei Minuten vor der Wochenrunde. Die ersten fünf Fragen sind der WHO-5 und beziehen sich auf die letzten zwei Wochen.',
    fragen: [
      ...[
        ['who1', 'war ich froh und guter Laune'],
        ['who2', 'habe ich mich ruhig und entspannt gefühlt'],
        ['who3', 'habe ich mich energisch und aktiv gefühlt'],
        ['who4', 'habe ich mich beim Aufwachen frisch und ausgeruht gefühlt'],
        ['who5', 'war mein Alltag voller Dinge, die mich interessieren'],
      ].map(([id, t]) => ({ id, frage: `In den letzten zwei Wochen ${t}`, typ: 'skala' as const, pflicht: true,
        werte: skala(['zu keinem Zeitpunkt', 'ab und zu', 'etwas weniger als die Hälfte der Zeit', 'etwas mehr als die Hälfte der Zeit', 'meistens', 'die ganze Zeit'], 0) })),
      ...[
        ['zeit', 'Zeit: Ich habe über meine Stunden selbst bestimmt.'],
        ['sozial', 'Sozial: Ich hatte echte Zeit mit Menschen, die mir wichtig sind.'],
        ['mental', 'Mental: Ich hatte Raum zum Denken und habe etwas gelernt.'],
        ['koerper', 'Körper: Ich habe mich bewegt, gut gegessen und genug geschlafen.'],
        ['geld', 'Geld: Geld hat mir diese Woche keine Sorgen gemacht.'],
      ].map(([id, t]) => ({ id, frage: t, typ: 'skala' as const, pflicht: true, werte: skala(['stimmt nicht', 'eher nicht', 'teils', 'eher', 'stimmt'], 0) })),
      { id: 'engpass', frage: 'Der Engpass ist …', typ: 'mehrfach', optionen: ['gelöst', 'kleiner geworden', 'gleich geblieben', 'größer geworden'] },
    ],
  },
};

/** WHO-5 in Prozent: Summe mal 4, 0 bis 100. Unter 51 lohnt ein genauerer Blick. */
export function who5(antworten: Record<string, unknown>): number | null {
  const w = ['who1', 'who2', 'who3', 'who4', 'who5'].map((k) => Number((antworten[k] as { wert?: unknown })?.wert));
  return w.every((x) => Number.isInteger(x) && x >= 0 && x <= 5) ? w.reduce((a, b) => a + b, 0) * 4 : null;
}

export type Antwort = { wert?: number; auswahl?: string[]; aufgabe?: string; zeit?: string; text?: string; notiz?: string };

/** Prüft Antworten gegen den Bogen. Unbekanntes fliegt raus, Texte werden gekürzt. Gibt null zurück, wenn Pflichtfragen fehlen. */
export function pruefeAntworten(art: Bogen['art'], roh: unknown): Record<string, Antwort> | null {
  const bogen = BOEGEN[art]; if (!bogen || !roh || typeof roh !== 'object') return null;
  const ein = roh as Record<string, Antwort>;
  const out: Record<string, Antwort> = {};
  const kurz = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
  for (const f of bogen.fragen) {
    const a = ein[f.id] ?? {};
    const o: Antwort = {};
    if (f.typ === 'skala' && f.werte.some((w) => w.wert === a.wert)) o.wert = a.wert;
    if (f.typ === 'mehrfach' && Array.isArray(a.auswahl)) o.auswahl = a.auswahl.filter((x) => f.optionen.includes(x)).slice(0, f.optionen.length);
    if (f.typ === 'plan') { const t = kurz(a.aufgabe, 300); const z = TAGESZEITEN.includes(String(a.zeit)) ? String(a.zeit) : ''; if (t) o.aufgabe = t; if (z) o.zeit = z; }
    if (f.typ === 'text') { const t = kurz(a.text, 1500); if (t) o.text = t; }
    const notiz = kurz(a.notiz, 1500); if (notiz) o.notiz = notiz;
    if (f.typ === 'skala' && f.pflicht && o.wert === undefined) return null;
    if (Object.keys(o).length) out[f.id] = o;
  }
  return out;
}

/** Montag der Woche als Tag des Wochenbogens. */
export function wochenTag(tag: string): string {
  const d = new Date(tag + 'T12:00:00Z');
  const wd = (d.getUTCDay() + 6) % 7; // Montag = 0
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}
