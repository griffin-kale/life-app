/**
 * Ruhe: Stille, gefuehrte Atem-Meditation, NSDR (Yoga Nidra), Wim-Hof-Atmung, Runterfahren am Abend.
 * Alle Texte gehören Life. Gesprochen wird mit der Sprachausgabe des iPhones, Gongs entstehen im Browser.
 */

export type Art = 'stille' | 'atem' | 'nsdr' | 'wimhof' | 'runter';
export type Hinweis = { t: number; text: string }; // Sekunden ab Start
export type Vorlage = { id: Art; name: string; beschreibung: string; minuten: number[]; gefuehrt: boolean; atemtakt?: { ein: number; ein2?: number; aus: number } };

export const VORLAGEN: Vorlage[] = [
  { id: 'stille', name: 'Stille', beschreibung: 'Gong am Anfang und am Ende, dazwischen nur du.', minuten: [5, 10, 20], gefuehrt: false },
  { id: 'atem', name: 'Atem-Meditation', beschreibung: 'Wenige Hinweise, die dich zum Atem zurückholen.', minuten: [5, 10, 20], gefuehrt: true },
  { id: 'nsdr', name: 'NSDR', beschreibung: 'Tiefe Entspannung im Liegen: Atmung, dann durch den Körper wandern.', minuten: [10, 20], gefuehrt: true },
  { id: 'wimhof', name: 'Wim-Hof-Atmung', beschreibung: 'Drei Runden: 30 tiefe Atemzüge, ausatmen und halten, 15 Sekunden einatmen und halten.', minuten: [12], gefuehrt: true },
  { id: 'runter', name: 'Runterfahren', beschreibung: 'Fünf Minuten zyklisches Seufzen, drei Minuten Stille, dann die Abendfragen.', minuten: [8], gefuehrt: true, atemtakt: { ein: 2, ein2: 1, aus: 6 } },
];
export const vorlage = (id: string) => VORLAGEN.find((v) => v.id === id);

const KOERPER = ['den linken Fuß', 'die linke Wade und das Knie', 'den linken Oberschenkel', 'den rechten Fuß', 'die rechte Wade und das Knie', 'den rechten Oberschenkel', 'das Becken und den Po',
  'den Bauch, der sich mit dem Atem hebt und senkt', 'die Brust', 'die linke Hand und den Arm', 'die rechte Hand und den Arm', 'die Schultern, lass sie sinken', 'den Nacken', 'den Kiefer, lass ihn locker', 'die Augen und die Stirn', 'den ganzen Körper auf einmal'];

/** Hinweise für eine gefuehrte Sitzung. Wim Hof läuft interaktiv und braucht keine Zeitliste. */
export function skript(art: Art, minuten: number): Hinweis[] {
  const ende = minuten * 60;
  if (art === 'stille' || art === 'wimhof') return [];
  if (art === 'atem') {
    const h: Hinweis[] = [
      { t: 1, text: 'Setz dich bequem hin. Die Augen dürfen zu. Atme ein paar Mal tief durch die Nase ein und lang aus.' },
      { t: 25, text: 'Jetzt lass den Atem von allein kommen. Spür, wo du ihn am deutlichsten merkst.' },
    ];
    const satz = ['Wenn die Gedanken wandern, ist das normal. Bring die Aufmerksamkeit freundlich zurück zum Atem.', 'Spür das Ausatmen bis zum Ende.', 'Du musst nichts erreichen. Nur atmen und merken.'];
    for (let t = 150, i = 0; t < ende - 60; t += 150, i++) h.push({ t, text: satz[i % satz.length] });
    h.push({ t: ende - 30, text: 'Gleich ist es vorbei. Bewege langsam Finger und Füße.' });
    return h;
  }
  if (art === 'nsdr') {
    const h: Hinweis[] = [
      { t: 1, text: 'Leg dich auf den Rücken, die Arme neben den Körper. Schließ die Augen.' },
      { t: 20, text: 'Atme tief durch die Nase ein und lang durch den Mund aus. Noch zweimal.' },
      { t: 50, text: 'Atme ein und zähl bis vier. Atme aus und zähl bis acht. Das lange Ausatmen beruhigt.' },
      { t: 110, text: 'Lass den Atem jetzt von allein laufen. Der Körper wird schwer und sinkt in die Unterlage.' },
    ];
    const start = 150; const platz = ende - 120 - start; const schritt = platz / KOERPER.length;
    KOERPER.forEach((k, i) => h.push({ t: Math.round(start + i * schritt), text: `Wandere mit der Aufmerksamkeit zu ${k}. Spür, was da ist, ohne etwas zu ändern.` }));
    h.push({ t: ende - 100, text: 'Spür den ganzen Körper, schwer und ruhig. Bleib einfach hier.' });
    h.push({ t: ende - 30, text: 'Atme etwas tiefer. Bewege Finger und Zehen. Dreh dich zur Seite, bevor du aufstehst.' });
    return h;
  }
  // Runterfahren: 5 Minuten zyklisches Seufzen, dann Stille
  return [
    { t: 1, text: 'Zyklisches Seufzen. Atme durch die Nase ein, dann noch einmal kurz nachatmen. Dann lang durch den Mund aus.' },
    { t: 60, text: 'Das Ausatmen ist länger als das Einatmen. Lass es ganz auslaufen.' },
    { t: 300, text: 'Jetzt lass den Atem frei. Drei Minuten Stille.' },
    { t: ende - 15, text: 'Gleich kommen die Abendfragen.' },
  ];
}

/** Phase der Atemführung zum Zeitpunkt t, für den Kreis auf dem Bildschirm. */
export function atemPhase(takt: NonNullable<Vorlage['atemtakt']>, t: number): { phase: 'ein' | 'nach' | 'aus'; anteil: number } {
  const zyklus = takt.ein + (takt.ein2 ?? 0) + takt.aus; const x = t % zyklus;
  if (x < takt.ein) return { phase: 'ein', anteil: x / takt.ein };
  if (takt.ein2 && x < takt.ein + takt.ein2) return { phase: 'nach', anteil: (x - takt.ein) / takt.ein2 };
  return { phase: 'aus', anteil: (x - takt.ein - (takt.ein2 ?? 0)) / takt.aus };
}

export const WIMHOF = { runden: 3, atemzuege: 30, einSek: 1.6, ausSek: 1.4, haltenNachEinatmen: 15 };
export const WIMHOF_REGELN = ['Ich sitze oder liege an einem sicheren Ort.', 'Ich bin nicht im Wasser und nicht in der Nähe von Wasser.', 'Ich fahre nicht und bediene keine Maschine.'];
