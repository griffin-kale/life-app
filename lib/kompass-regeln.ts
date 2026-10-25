/**
 * Kompass: fünf Ringe, einer pro Konto. Jeder Ring ist der Schnitt seiner Teilziele, jedes Teilziel höchstens 100 %.
 * Teilziele ohne Daten fallen weg. Punkte gibt es pro Woche, nie pro Tag: Eine verpasste Einheit kostet nichts.
 */

export const KONTEN = ['zeit', 'sozial', 'mental', 'koerper', 'geld'] as const;
export type Konto = (typeof KONTEN)[number];
export const KONTO_NAME: Record<Konto, string> = { zeit: 'Zeit', sozial: 'Sozial', mental: 'Mental', koerper: 'Körper', geld: 'Geld' };

export type Teil = { name: string; ist: number; ziel: number; einheit?: string };

export function ring(teile: Teil[]): number | null {
  const w = teile.filter((t) => t.ziel > 0 && Number.isFinite(t.ist)).map((t) => Math.min(1, Math.max(0, t.ist / t.ziel)));
  return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
}

/** Level n ab 100 × (n − 1)² Punkten. Ein voller Ring bringt 100 Punkte pro Woche. */
export function level(punkte: number): { level: number; punkte: number; naechstes: number; anteil: number } {
  const n = Math.floor(Math.sqrt(Math.max(0, punkte) / 100)) + 1;
  const von = 100 * (n - 1) ** 2; const bis = 100 * n ** 2;
  return { level: n, punkte: Math.round(punkte), naechstes: Math.round(bis - punkte), anteil: (punkte - von) / (bis - von) };
}

export type Summen = {
  kraft: number; ruheMin: number; abende: number; wochenboegen: number; who5Max: number | null; engpassErledigt: number;
  wochenAlleRinge: number; wochenToepfeImRahmen: number; geldStufe: number; protein: number;
};

export const MEILENSTEINE: { id: string; name: string; wie: string; erreicht: (s: Summen) => boolean; konto: Konto | 'alle' }[] = [
  { id: 'kraft1', name: 'Erste Krafteinheit', wie: 'Eine Ganzkörper-Einheit abschließen', konto: 'koerper', erreicht: (s) => s.kraft >= 1 },
  { id: 'kraft10', name: 'Zehn Krafteinheiten', wie: 'Zehn Einheiten insgesamt', konto: 'koerper', erreicht: (s) => s.kraft >= 10 },
  { id: 'kraft50', name: 'Fünfzig Krafteinheiten', wie: 'Fünfzig Einheiten insgesamt', konto: 'koerper', erreicht: (s) => s.kraft >= 50 },
  { id: 'protein', name: 'Protein-Woche', wie: 'An fünf Tagen das Protein-Ziel erreichen', konto: 'koerper', erreicht: (s) => s.protein >= 5 },
  { id: 'ruhe100', name: '100 Minuten Ruhe', wie: 'Zusammen 100 Minuten Stille, Atem, NSDR oder Wim Hof', konto: 'mental', erreicht: (s) => s.ruheMin >= 100 },
  { id: 'ruhe1000', name: '1.000 Minuten Ruhe', wie: 'Zusammen 1.000 Minuten', konto: 'mental', erreicht: (s) => s.ruheMin >= 1000 },
  { id: 'abend30', name: '30 Abende', wie: '30 Mal die Abendfragen beantworten', konto: 'mental', erreicht: (s) => s.abende >= 30 },
  { id: 'who60', name: 'Gut im Wind', wie: 'WHO-5 über 60', konto: 'mental', erreicht: (s) => (s.who5Max ?? 0) > 60 },
  { id: 'engpass25', name: 'Engpass-Brecher', wie: '25 Aufgaben mit hohem Hebel erledigen', konto: 'zeit', erreicht: (s) => s.engpassErledigt >= 25 },
  { id: 'bogen4', name: 'Vier Wochenrunden', wie: 'Vier Wochenbögen ausfüllen', konto: 'zeit', erreicht: (s) => s.wochenboegen >= 4 },
  { id: 'toepfe', name: 'Woche im Rahmen', wie: 'Eine Woche, in der alle Töpfe im Rahmen bleiben', konto: 'geld', erreicht: (s) => s.wochenToepfeImRahmen >= 1 },
  { id: 'notgroschen', name: 'Erster Notgroschen', wie: 'Stufe 3 im Geld-Plan schaffen', konto: 'geld', erreicht: (s) => s.geldStufe > 3 },
  { id: 'perfekt', name: 'Perfekte Woche', wie: 'Alle fünf Ringe in einer Woche schließen', konto: 'alle', erreicht: (s) => s.wochenAlleRinge >= 1 },
];

/** Neue Meilensteine bekommen das heutige Datum, schon erreichte behalten ihres. Verloren geht keiner. */
export function meilensteineAktualisieren(alt: Record<string, string>, s: Summen, heute: string): { alle: Record<string, string>; neu: string[] } {
  const alle = { ...alt }; const neu: string[] = [];
  for (const m of MEILENSTEINE) if (!alle[m.id] && m.erreicht(s)) { alle[m.id] = heute; neu.push(m.id); }
  return { alle, neu };
}
