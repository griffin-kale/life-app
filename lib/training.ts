/**
 * Training nach dem Vorbild von RP Hypertrophy, gebaut für zu Hause: Kettlebell, TRX, Bänder, Körpergewicht.
 * Blöcke von 5 Wochen: 4 Wochen Aufbau mit sinkendem Abstand zum Muskelversagen, 1 Woche Entlastung.
 * Nach jeder Einheit passen Pump, Muskelkater und Gelenke die Satzzahl pro Muskelgruppe an.
 * Rein, ohne Datenbank, damit testbar.
 */

export const MUSKELN = ['beine', 'huefte', 'druecken', 'ziehen', 'schulter', 'arme', 'rumpf'] as const;
export type Muskel = (typeof MUSKELN)[number];
export const MUSKEL_NAME: Record<Muskel, string> = { beine: 'Beine', huefte: 'Hüfte und Beinrückseite', druecken: 'Brust und Drücken', ziehen: 'Rücken', schulter: 'Schultern', arme: 'Arme', rumpf: 'Rumpf' };

export type Uebung = { id: string; name: string; muskel: Muskel; wdh: [number, number]; hinweis: string; schwerer?: string; sekunden?: boolean };

export const UEBUNGEN: Uebung[] = [
  { id: 'goblet', name: 'Goblet-Kniebeuge', muskel: 'beine', wdh: [8, 20], hinweis: 'Kettlebell vor der Brust, Knie zeigen über die Zehen, tief und kontrolliert, Fersen bleiben am Boden.', schwerer: 'goblet-pause' },
  { id: 'goblet-pause', name: 'Goblet-Kniebeuge mit 3 Sekunden Pause unten', muskel: 'beine', wdh: [6, 15], hinweis: 'Unten drei Sekunden halten, dann kräftig hoch.' },
  { id: 'split', name: 'Bulgarische Kniebeuge', muskel: 'beine', wdh: [8, 15], hinweis: 'Hinterer Fuß auf Sofa oder Stuhl, vorderes Knie stabil, Oberkörper leicht nach vorn. Pro Seite zählen.', schwerer: 'split-kb' },
  { id: 'split-kb', name: 'Bulgarische Kniebeuge mit Kettlebell', muskel: 'beine', wdh: [6, 12], hinweis: 'Kettlebell in der Hand auf der Seite des hinteren Beins. Pro Seite zählen.' },
  { id: 'ausfall', name: 'Ausfallschritt rückwärts', muskel: 'beine', wdh: [8, 16], hinweis: 'Großer Schritt nach hinten, hinteres Knie fast zum Boden, vorne über die Ferse hochdrücken. Pro Seite zählen.' },
  { id: 'swing', name: 'Kettlebell-Swing', muskel: 'huefte', wdh: [12, 25], hinweis: 'Bewegung kommt aus der Hüfte, Rücken gerade, Arme sind nur Seile. Oben Po und Bauch fest.' },
  { id: 'rdl', name: 'Einbeiniges Kreuzheben mit Kettlebell', muskel: 'huefte', wdh: [8, 15], hinweis: 'Hüfte nach hinten schieben, Rücken lang, Standknie leicht gebeugt. Pro Seite zählen.', schwerer: 'rdl-pause' },
  { id: 'rdl-pause', name: 'Einbeiniges Kreuzheben, 3 Sekunden ablassen', muskel: 'huefte', wdh: [6, 12], hinweis: 'Langsam ablassen, unten kurz halten. Pro Seite zählen.' },
  { id: 'trx-curl', name: 'TRX-Beinbeuger', muskel: 'huefte', wdh: [8, 15], hinweis: 'Fersen in den Schlaufen, Hüfte oben halten, Fersen zum Po ziehen.' },
  { id: 'liegestuetz', name: 'Liegestütz', muskel: 'druecken', wdh: [6, 20], hinweis: 'Körper wie ein Brett, Ellbogen etwa 45 Grad vom Körper, Brust fast zum Boden. Zu schwer: Hände erhöht.', schwerer: 'liegestuetz-fuesse' },
  { id: 'liegestuetz-fuesse', name: 'Liegestütz, Füße erhöht', muskel: 'druecken', wdh: [6, 15], hinweis: 'Füße auf Stuhl oder Sofa, sonst wie normale Liegestütze.' },
  { id: 'trx-druecken', name: 'TRX-Brustdrücken', muskel: 'druecken', wdh: [8, 15], hinweis: 'Je steiler du stehst, desto leichter. Zum Steigern Füße weiter nach hinten.' },
  { id: 'kb-boden', name: 'Kettlebell-Bodendrücken', muskel: 'druecken', wdh: [8, 15], hinweis: 'Auf dem Rücken liegen, Oberarm landet sanft am Boden, dann gerade hoch drücken. Pro Seite zählen.' },
  { id: 'trx-rudern', name: 'TRX-Rudern', muskel: 'ziehen', wdh: [8, 20], hinweis: 'Körper gerade, Schulterblätter zusammen, Ellbogen nah am Körper. Flacher heißt schwerer.', schwerer: 'trx-rudern-pause' },
  { id: 'trx-rudern-pause', name: 'TRX-Rudern mit 2 Sekunden oben', muskel: 'ziehen', wdh: [6, 15], hinweis: 'Oben zwei Sekunden halten, langsam zurück.' },
  { id: 'kb-rudern', name: 'Einarmiges Kettlebell-Rudern', muskel: 'ziehen', wdh: [8, 15], hinweis: 'Eine Hand auf Stuhl oder Knie, Rücken flach, Ellbogen zur Hüfte ziehen. Pro Seite zählen.' },
  { id: 'band-lat', name: 'Latzug mit Band', muskel: 'ziehen', wdh: [10, 20], hinweis: 'Band oben an Tür oder Haken, kniend die Ellbogen nach unten zu den Rippen ziehen.' },
  { id: 'kb-press', name: 'Kettlebell-Schulterdrücken, halbkniend', muskel: 'schulter', wdh: [6, 15], hinweis: 'Ein Knie am Boden, Bauch fest, Kettlebell gerade nach oben. Pro Seite zählen.' },
  { id: 'band-seit', name: 'Seitheben mit Band', muskel: 'schulter', wdh: [12, 25], hinweis: 'Auf dem Band stehen, Arme leicht gebeugt bis Schulterhöhe heben.' },
  { id: 'face-pull', name: 'Face Pull mit Band oder TRX', muskel: 'schulter', wdh: [12, 25], hinweis: 'Zur Stirn ziehen, Ellbogen hoch und weit, gut für die Haltung.' },
  { id: 'band-curl', name: 'Bizeps-Curl mit Band', muskel: 'arme', wdh: [10, 25], hinweis: 'Ellbogen bleiben am Körper, langsam ablassen.' },
  { id: 'trx-trizeps', name: 'TRX-Trizepsdrücken', muskel: 'arme', wdh: [8, 20], hinweis: 'Nur die Ellbogen beugen, Hände Richtung Stirn, dann strecken.' },
  { id: 'band-trizeps', name: 'Trizepsdrücken mit Band', muskel: 'arme', wdh: [12, 25], hinweis: 'Band oben befestigt, Ellbogen am Körper, nur die Unterarme nach unten strecken.' },
  { id: 'plank', name: 'Unterarmstütz', muskel: 'rumpf', wdh: [20, 60], hinweis: 'Po fest, Rippen runter, Körper gerade. Zählt in Sekunden.', sekunden: true, schwerer: 'body-saw' },
  { id: 'body-saw', name: 'TRX Body Saw', muskel: 'rumpf', wdh: [6, 15], hinweis: 'Füße in den Schlaufen, im Unterarmstütz vor und zurück schieben.' },
  { id: 'dead-bug', name: 'Dead Bug', muskel: 'rumpf', wdh: [8, 16], hinweis: 'Rücken bleibt am Boden, Arm und Gegenbein langsam strecken. Pro Seite zählen.' },
  { id: 'suitcase', name: 'Kettlebell-Koffertragen', muskel: 'rumpf', wdh: [20, 60], hinweis: 'Kettlebell in einer Hand, aufrecht gehen ohne zu kippen. Sekunden pro Seite.', sekunden: true },
];
export const uebung = (id: string) => UEBUNGEN.find((u) => u.id === id);

export type Stand = {
  blockStart: string;                 // Montag der ersten Blockwoche
  einheitenSoll: number;              // Krafteinheiten pro Woche, 2 bis 4
  uhrzeit: string;                    // für die Erinnerung
  volumen: Record<Muskel, number>;    // Sätze pro Muskelgruppe und Einheit
  wahl: Record<Muskel, [string, string]>; // zwei Übungen pro Muskelgruppe, Einheiten wechseln A und B
  wdh: Record<string, number>;        // zuletzt geschaffte Wiederholungen (Schnitt) je Übung
  einheitNr: number;                  // laufende Nummer für den A/B-Wechsel
};

export const START_VOLUMEN: Record<Muskel, number> = { beine: 2, huefte: 2, druecken: 2, ziehen: 2, schulter: 1, arme: 1, rumpf: 2 };
const MAX_VOLUMEN = 5;

export function standStart(montag: string): Stand {
  return {
    blockStart: montag, einheitenSoll: 3, uhrzeit: '18:00', volumen: { ...START_VOLUMEN }, einheitNr: 0, wdh: {},
    wahl: { beine: ['goblet', 'split'], huefte: ['swing', 'rdl'], druecken: ['liegestuetz', 'trx-druecken'], ziehen: ['trx-rudern', 'kb-rudern'], schulter: ['kb-press', 'face-pull'], arme: ['band-curl', 'trx-trizeps'], rumpf: ['plank', 'dead-bug'] },
  };
}

const tageZwischen = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

/** Woche im Block, 1 bis 5. Woche 5 ist Entlastung. */
export function blockWoche(blockStart: string, tag: string): number {
  return (((Math.floor(tageZwischen(blockStart, tag) / 7) % 5) + 5) % 5) + 1;
}

/** Abstand zum Muskelversagen (Wiederholungen in Reserve) je Blockwoche. */
export const RIR = [3, 2, 1, 1, 4];
export const rirText = (w: number) => (w === 5 ? 'Entlastung, locker bleiben' : w === 4 ? '0 bis 1 Wiederholung vor Schluss' : `${RIR[w - 1]} Wiederholungen vor Schluss`);

/** Trainingstage für die Erinnerung: 0 = Montag. */
export const TRAININGSTAGE: Record<number, number[]> = { 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4] };

export type Geplant = { uebung: string; name: string; muskel: Muskel; saetze: number; zielWdh: number; sekunden: boolean; hinweis: string; pause: number };

export function einheitPlanen(s: Stand, tag: string): { woche: number; rir: string; uebungen: Geplant[] } {
  const woche = blockWoche(s.blockStart, tag);
  const uebungen = MUSKELN.map((m) => {
    const id = s.wahl[m][s.einheitNr % 2];
    const u = uebung(id) ?? UEBUNGEN.find((x) => x.muskel === m)!;
    const saetze = woche === 5 ? Math.max(1, Math.round(s.volumen[m] / 2)) : s.volumen[m];
    const letzte = s.wdh[u.id];
    const schritt = u.sekunden ? 5 : 1;
    const ziel = letzte === undefined ? u.wdh[0] + Math.round((u.wdh[1] - u.wdh[0]) / 3) : woche === 5 ? letzte : Math.min(u.wdh[1], letzte + schritt);
    return { uebung: u.id, name: u.name, muskel: m, saetze, zielWdh: ziel, sekunden: !!u.sekunden, hinweis: u.hinweis, pause: ['arme', 'rumpf', 'schulter'].includes(m) ? 60 : 90 };
  });
  return { woche, rir: rirText(woche), uebungen };
}

export type Feedback = Partial<Record<Muskel, { pump?: 'wenig' | 'mittel' | 'stark'; kater?: 'keiner' | 'weg' | 'noch da'; gelenke?: 'gut' | 'zieht' | 'schmerzt' }>>;
export type Ergebnis = { uebung: string; wdh: number[] };

/** Nach einer Einheit: Wiederholungen merken, Satzzahl je Muskelgruppe anpassen, bei Schmerz Übung tauschen. */
export function nachEinheit(s: Stand, tag: string, ergebnisse: Ergebnis[], fb: Feedback): { stand: Stand; hinweise: string[] } {
  const n: Stand = structuredClone(s);
  const hinweise: string[] = [];
  const woche = blockWoche(s.blockStart, tag);
  for (const e of ergebnisse) {
    const u = uebung(e.uebung); const gut = e.wdh.filter((x) => Number.isFinite(x) && x > 0);
    if (!u || !gut.length) continue;
    const schnitt = Math.round(gut.reduce((a, b) => a + b, 0) / gut.length);
    n.wdh[u.id] = schnitt;
    // Obere Grenze erreicht: nächste Stufe der Übung
    if (schnitt >= u.wdh[1] && u.schwerer) {
      const slot = n.wahl[u.muskel].indexOf(u.id);
      if (slot >= 0) { n.wahl[u.muskel][slot] = u.schwerer; hinweise.push(`${u.name}: obere Grenze erreicht. Nächstes Mal ${uebung(u.schwerer)!.name}.`); }
    }
  }
  for (const m of MUSKELN) {
    const f = fb[m]; if (!f) continue;
    if (f.gelenke === 'schmerzt') {
      n.volumen[m] = Math.max(1, n.volumen[m] - 1);
      const jetzt = n.wahl[m][n.einheitNr % 2];
      const alt = UEBUNGEN.find((u) => u.muskel === m && !n.wahl[m].includes(u.id) && !UEBUNGEN.some((v) => v.schwerer === u.id));
      if (alt) { n.wahl[m][n.wahl[m].indexOf(jetzt)] = alt.id; hinweise.push(`${MUSKEL_NAME[m]}: Gelenke schmerzen. Ein Satz weniger, ab jetzt ${alt.name}. Hält der Schmerz an, lass es ärztlich abklären.`); }
      continue;
    }
    if (woche >= 4) continue; // In Woche 4 und 5 bleibt die Satzzahl
    const erholt = f.kater === 'keiner' || f.kater === 'weg';
    if (f.kater === 'noch da' && f.pump === 'stark') n.volumen[m] = Math.max(1, n.volumen[m] - 1);
    else if (erholt && (f.pump === 'wenig' || f.pump === 'mittel') && n.volumen[m] < MAX_VOLUMEN) n.volumen[m] += 1;
  }
  n.einheitNr += 1;
  return { stand: n, hinweise };
}

/** Neuer Block nach Woche 5: etwas weniger Sätze als am Ende, nie unter den Start. */
export function neuerBlock(s: Stand, montag: string): Stand {
  const volumen = Object.fromEntries(MUSKELN.map((m) => [m, Math.max(START_VOLUMEN[m], s.volumen[m] - 1)])) as Record<Muskel, number>;
  return { ...s, blockStart: montag, volumen };
}
