import type { Block } from './kalender-regeln';

/**
 * Regeln für das Cockpit auf Heute (Life 2.0, Richtung B mit Tagesstreifen). Ohne Datenbank, damit sie testbar bleiben.
 * Das Cockpit beantwortet eine Frage: Wie steht mein Tag? Drei Werte, die nächsten Blöcke, je Konto eine Zeile.
 */

export type StreifenBlock = { von: number; bis: number | null; titel: string; art: string; quelle: 'kalender' | 'aufgabe' };
export type KontoZeile = { konto: 'zeit' | 'koerper' | 'mental' | 'sozial' | 'geld'; titel: string; text: string; href: string };

/** Minuten als „2 Std. 30“ oder „45 Min.“. */
export function dauerText(min: number): string {
  if (min <= 0) return '0 Min.';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} Std.${m ? ` ${m}` : ''}` : `${m} Min.`;
}

/** „HH:MM“ aus Minuten seit Mitternacht. */
export const uhr = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Aus „HH:MM“ Minuten seit Mitternacht, sonst null. */
export function minutenAus(hhmm: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Die nächsten Blöcke des Tages: Termine aus dem Kalender und Aufgaben mit Uhrzeit, ab jetzt.
 * Was gerade läuft, steht vorne. Freie Lücken zählen nicht, die stehen als Zahl in der Kachel.
 */
export function streifen(bloecke: Block[], aufgaben: { titel: string; zeit: string | null; dauer: number | null }[], ab: number, anzahl = 3): StreifenBlock[] {
  const kal: StreifenBlock[] = bloecke.filter((b) => b.art !== 'frei' && b.bis > ab)
    .map((b) => ({ von: b.von, bis: b.bis, titel: b.titel, art: b.art, quelle: 'kalender' }));
  const auf: StreifenBlock[] = aufgaben.flatMap((a) => {
    const von = minutenAus(a.zeit); if (von === null) return [];
    const bis = a.dauer ? von + a.dauer : null;
    return (bis ?? von + 30) > ab ? [{ von, bis, titel: a.titel, art: 'aufgabe', quelle: 'aufgabe' as const }] : [];
  });
  return [...kal, ...auf].sort((x, y) => x.von - y.von).slice(0, anzahl);
}

/** Wochentopf als Spanne statt Cent-Betrag. Genaue Restbeträge erhöhen laut Studie die Ausgaben. */
export function topfSpanne(ausgaben: number, rahmen: number): string {
  if (rahmen <= 0) return 'kein Rahmen gesetzt';
  const rest = 1 - ausgaben / rahmen;
  if (rest < 0) return 'über dem Rahmen';
  if (rest < 0.1) return 'fast aufgebraucht';
  if (rest < 0.3) return 'knapp ein Drittel übrig';
  if (rest < 0.45) return 'gut ein Drittel übrig';
  if (rest < 0.6) return 'rund die Hälfte übrig';
  if (rest < 0.85) return 'gut die Hälfte übrig';
  return 'fast alles übrig';
}

export type KontenEingang = {
  frei: number | null; naechsterTermin: StreifenBlock | null;
  trainingstag: boolean; kraftHeute: boolean; trainingUhrzeit: string | null; protein: number | null; proteinZiel: number | null;
  ruheMinHeute: number; ruheTageWoche: number;
  geburtstag: { name: string; inTagen: number } | null; faellig: { name: string; seit: number } | null;
  geld: { ausgaben: number; rahmen: number } | null;
};

/** Je Konto eine Zeile: was heute zählt, in einem Satz. Keine Nullen ohne nächsten Schritt. */
export function kontenZeilen(e: KontenEingang): KontoZeile[] {
  const zeit = e.naechsterTermin
    ? `${uhr(e.naechsterTermin.von)} ${e.naechsterTermin.titel || 'Termin'}${e.frei ? `, heute ${dauerText(e.frei)} frei` : ''}`
    : e.frei !== null ? `Heute ${dauerText(e.frei)} frei` : 'Kalender verbinden, dann siehst du deine freie Zeit';
  const koerperTeile: string[] = [];
  if (e.kraftHeute) koerperTeile.push('Krafteinheit erledigt');
  else if (e.trainingstag) koerperTeile.push(`Krafteinheit${e.trainingUhrzeit ? ` um ${e.trainingUhrzeit}` : ' heute'}`);
  if (e.proteinZiel) koerperTeile.push(e.protein && e.protein >= 1 ? `Protein ${Math.round(e.protein)} von ${e.proteinZiel} g` : `Protein-Ziel heute ${e.proteinZiel} g`);
  const ruhe = e.ruheMinHeute > 0
    ? `${e.ruheMinHeute} Min. Ruhe heute, ${e.ruheTageWoche} ${e.ruheTageWoche === 1 ? 'Tag' : 'Tage'} diese Woche`
    : `Fünf Minuten Atem reichen${e.ruheTageWoche ? `, ${e.ruheTageWoche} ${e.ruheTageWoche === 1 ? 'Tag' : 'Tage'} diese Woche` : ''}`;
  const sozial = e.geburtstag
    ? `${e.geburtstag.name} hat ${e.geburtstag.inTagen === 0 ? 'heute' : e.geburtstag.inTagen === 1 ? 'morgen' : `in ${e.geburtstag.inTagen} Tagen`} Geburtstag`
    : e.faellig ? `${e.faellig.name}: seit ${e.faellig.seit} Tagen nichts gehört` : 'Niemand wartet gerade auf dich';
  const geld = e.geld ? `Wochentöpfe: ${topfSpanne(e.geld.ausgaben, e.geld.rahmen)}` : 'Wochentöpfe anlegen, dann siehst du hier den Stand';
  return [
    { konto: 'zeit', titel: 'Zeit', text: zeit, href: '/woche' },
    { konto: 'koerper', titel: 'Körper', text: koerperTeile.length ? koerperTeile.join(' · ') : 'Heute kein Training geplant', href: '/koerper' },
    { konto: 'mental', titel: 'Ruhe', text: ruhe, href: '/koerper/ruhe' },
    { konto: 'sozial', titel: 'Menschen', text: sozial, href: '/menschen' },
    { konto: 'geld', titel: 'Geld', text: geld, href: '/geld' },
  ];
}
