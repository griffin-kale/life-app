
/** Regeln für die Woche (Life 2.0): sieben Tage mit Terminen, freie Zeit pro Tag, Rhythmen statt Serien. Ohne Datenbank. */

export const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/** Die sieben Tage ab Montag als JJJJ-MM-TT. Rechnet mittags in UTC, damit Zeitumstellungen nichts verschieben. */
export const wochenTage = (montag: string) => WT.map((_, i) => new Date(Date.parse(`${montag}T12:00:00Z`) + i * 864e5).toISOString().slice(0, 10));

export type Rhythmus = { konto: 'zeit' | 'koerper' | 'mental' | 'sozial' | 'geld'; name: string; text: string; an: boolean[] };
export type RhythmusEingang = {
  tage: string[]; heute: string;
  erledigt: Record<string, number>; training: string[]; kraft: number; kraftSoll: number; ausdauerMin: number;
  ruhe: string[]; kontakte: string[]; buchungen: string[];
};

const anTagen = (n: number) => `${n} ${n === 1 ? 'Tag' : 'Tagen'}`;

/** Rhythmen der Woche: ein Punkt pro Tag, gezählt wird die Woche. Ein leerer Tag fällt nicht als Lücke auf. */
export function rhythmen(e: RhythmusEingang): Rhythmus[] {
  const an = (liste: Iterable<string>) => { const s = new Set(liste); return e.tage.map((t) => s.has(t)); };
  const erledigtTage = Object.keys(e.erledigt).filter((t) => e.erledigt[t] > 0);
  const summe = Object.values(e.erledigt).reduce((a, b) => a + b, 0);
  const ruheN = new Set(e.ruhe).size, kontaktN = new Set(e.kontakte).size, buchN = new Set(e.buchungen).size;
  return [
    { konto: 'zeit', name: 'Erledigt', text: summe ? `${summe} ${summe === 1 ? 'Aufgabe' : 'Aufgaben'} an ${anTagen(erledigtTage.length)}` : 'Die erste Aufgabe der Woche wartet', an: an(erledigtTage) },
    { konto: 'koerper', name: 'Bewegung', text: `Kraft ${e.kraft} von ${e.kraftSoll}${e.ausdauerMin ? ` · ${e.ausdauerMin} Min. Ausdauer` : ''}`, an: an(e.training) },
    { konto: 'mental', name: 'Ruhe', text: ruheN ? `an ${anTagen(ruheN)}, Ziel jeden Tag fünf Minuten` : 'Fünf Minuten Atem zählen schon', an: an(e.ruhe) },
    { konto: 'sozial', name: 'Menschen', text: kontaktN ? `Kontakt an ${anTagen(kontaktN)}` : 'Eine kurze Nachricht zählt schon', an: an(e.kontakte) },
    { konto: 'geld', name: 'Geld', text: buchN ? `Ausgaben an ${anTagen(buchN)} festgehalten` : 'Ausgaben festhalten, dann stimmen die Töpfe', an: an(e.buchungen) },
  ];
}
