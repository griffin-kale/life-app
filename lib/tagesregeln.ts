/**
 * Feste, nachvollziehbare Regeln für den Tag: was Life empfiehlt, was noch offen ist, wann der Wochenstart fällig ist.
 * Ohne Datenbank und ohne Claude, damit sie sich testen lassen. Der Coach formuliert sie nur.
 */

export type Lage = {
  stunde: number;              // 0 bis 23, Berlin
  wochentag: number;           // 1 = Montag … 7 = Sonntag
  erholung: number | null;     // WHOOP, 0 bis 100
  schlafMin: number | null;
  morgenErholung: number | null; // Antwort „Wie erholt fühlst du dich?“, 0 = leer … 4 = voller Kraft
  trainingstag: boolean;
  kraftHeute: boolean;
  ruheHeuteMin: number;
  kontakt: string | null;      // Name eines Menschen, bei dem es länger her ist
  wochenstartOffen: boolean;
  standortEtappe?: number | null; // nächste offene Etappe der Standortbestimmung
};

export type Empfehlung = { id: string; titel: string; grund: string; href: string; farbe: string };

/** Genau eine Empfehlung für jetzt. Reihenfolge = Wichtigkeit. */
export function empfehlung(l: Lage): Empfehlung {
  const abends = l.stunde >= 20;
  const muede = (l.erholung !== null && l.erholung < 34) || (l.schlafMin !== null && l.schlafMin < 360) || (l.morgenErholung !== null && l.morgenErholung <= 1);
  if (l.standortEtappe && !abends) return { id: 'standort', titel: `Standortbestimmung, Etappe ${l.standortEtappe}`, grund: 'Zwölf Minuten erzählen. Danach kennt der Coach deine Richtung und kann wirklich priorisieren.', href: `/stand/${l.standortEtappe}`, farbe: 'var(--k-mental)' };
  if (l.wochenstartOffen && l.wochentag <= 2 && !abends) return { id: 'wochenstart', titel: 'Wochenrunde', grund: 'Zehn Minuten für die Woche: Rückblick, Hebel, Engpass, drei Dinge.', href: '/wochenstart', farbe: 'var(--k-zeit)' };
  if (abends) return { id: 'runter', titel: 'Runterfahren, 8 Min.', grund: 'Langes Ausatmen beruhigt, danach kommen die Abendfragen.', href: '/koerper/ruhe?vorlage=runter', farbe: 'var(--k-mental)' };
  if (muede && l.stunde < 18 && l.ruheHeuteMin < 10) return { id: 'nsdr', titel: 'NSDR, 20 Min.', grund: l.erholung !== null && l.erholung < 34 ? `Erholung ${l.erholung} %. Tiefe Entspannung im Liegen holt dir einen Teil zurück.` : 'Kurze Nacht. Tiefe Entspannung im Liegen holt dir einen Teil zurück.', href: '/koerper/ruhe?vorlage=nsdr', farbe: 'var(--k-mental)' };
  if (l.trainingstag && !l.kraftHeute && !muede && (l.erholung === null || l.erholung >= 67)) return { id: 'kraft', titel: 'Krafteinheit', grund: l.erholung !== null ? `Erholung ${l.erholung} %, heute ist Trainingstag.` : 'Heute ist Trainingstag.', href: '/koerper/training', farbe: 'var(--k-koerper)' };
  if (l.trainingstag && !l.kraftHeute) return { id: 'zone2', titel: 'Zone 2 locker, 30 Min.', grund: 'Trainingstag, aber nicht ganz erholt. Locker bewegen statt hart trainieren.', href: '/koerper/bewegung#ohne-whoop', farbe: 'var(--k-koerper)' };
  if (l.morgenErholung !== null && l.morgenErholung <= 2 && l.ruheHeuteMin === 0) return { id: 'atem', titel: 'Atem-Meditation, 10 Min.', grund: 'Du fühlst dich heute nur okay. Zehn Minuten Atem sammeln dich.', href: '/koerper/ruhe?vorlage=atem', farbe: 'var(--k-mental)' };
  if (l.kontakt) return { id: 'kontakt', titel: `${l.kontakt} melden`, grund: 'Ihr habt länger nichts voneinander gehört. Eine Nachricht reicht.', href: '/menschen', farbe: 'var(--k-sozial)' };
  if (l.ruheHeuteMin === 0) return { id: 'stille', titel: 'Stille, 5 Min.', grund: 'Fünf Minuten ohne Eingabe. Gong am Anfang und am Ende.', href: '/koerper/ruhe?vorlage=stille', farbe: 'var(--k-mental)' };
  return { id: 'zone2-frei', titel: 'Spaziergang, 30 Min.', grund: 'Alles erledigt, was heute ansteht. Bewegung draußen zählt als Zone 2.', href: '/koerper/bewegung#ohne-whoop', farbe: 'var(--k-koerper)' };
}

export type OffenLage = {
  stunde: number; minute: number; wochentag: number;
  jetzt: { titel: string; zeit: string | null; erledigt: boolean }[];
  morgen: boolean; abend: boolean;
  trainingstag: boolean; kraftHeute: boolean; trainingUhrzeit: string;
  wochenstartOffen: boolean;
  standortEtappe?: number | null;
};

const min = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

/** Was heute noch ansteht und schon fällig ist. Höchstens vier Punkte, das Dringendste zuerst. */
export function offenePunkte(o: OffenLage): string[] {
  const jetzt = o.stunde * 60 + o.minute;
  const p: string[] = [];
  for (const a of o.jetzt) if (!a.erledigt && a.zeit && jetzt - min(a.zeit) >= 30) p.push(`„${a.titel}“ stand für ${a.zeit} an.`);
  if (o.standortEtappe) p.push(`Die Standortbestimmung fehlt noch (Etappe ${o.standortEtappe} von 3).`);
  if (o.wochenstartOffen && o.wochentag <= 3) p.push('Die Wochenrunde fehlt noch.');
  if (!o.morgen && o.stunde >= 9 && o.stunde < 14) p.push('Die Morgenfrage ist noch offen.');
  if (o.trainingstag && !o.kraftHeute && jetzt - min(o.trainingUhrzeit) >= 60) p.push('Heute ist Trainingstag, die Einheit fehlt noch.');
  if (!o.abend && o.stunde >= 21) p.push('Die Abendfragen sind noch offen.');
  const offen = o.jetzt.filter((a) => !a.erledigt).length;
  if (o.stunde >= 15 && offen && offen === o.jetzt.length) p.push(`Von „Jetzt dran“ ist noch nichts erledigt (${offen} offen).`);
  return p.slice(0, 4);
}

/** Setzt die Zeile „Engpass: …“ im Kontext neu oder stellt sie an den Anfang. */
export function engpassSetzen(kontext: string, neu: string): string {
  const zeile = `Engpass: ${neu.replace(/\s+/g, ' ').trim()}`;
  return /^\s*engpass\s*:.*$/im.test(kontext) ? kontext.replace(/^\s*engpass\s*:.*$/im, zeile) : [zeile, kontext].filter(Boolean).join('\n');
}

/** Montag der Woche zu einem Tag (JJJJ-MM-TT). */
export function montagVon(tag: string): string {
  const d = new Date(tag + 'T12:00:00Z'); const wt = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - wt * 864e5).toISOString().slice(0, 10);
}
