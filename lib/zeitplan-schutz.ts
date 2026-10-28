/**
 * Schutz für den Zeitplan, ohne Datenbank, damit die Einheitstests ihn direkt prüfen können.
 * Die Datenbank-Seite steht in `lib/zeitplan.ts`.
 */

/** Schlüssel in `settings`, unter dem der letzte erfolgreiche Lauf steht. `/api/health` liest ihn. */
export const LETZTER_LAUF = 'zeitplan_lauf';

/** Ab so viel Verzug meldet `/api/health` einen Fehler. */
export const VERZUG_MS = 5 * 60_000;

export type ZeitplanStatus = 'ok' | 'startet' | 'verzug' | 'aus';

/**
 * Wie steht der Zeitplan? `letzter` ist der letzte erfolgreiche Lauf (ms), `laeuftSeitMs` die Laufzeit des Prozesses.
 * Direkt nach dem Start gilt „startet“, damit ein Update nicht als Ausfall zählt.
 */
export function zeitplanStatus(o: { letzter: number | null; jetzt: number; laeuftSeitMs: number; aus: boolean }): ZeitplanStatus {
  if (o.aus) return 'aus';
  if (o.letzter !== null && o.jetzt - o.letzter <= VERZUG_MS) return 'ok';
  if (o.laeuftSeitMs <= VERZUG_MS) return 'startet';
  return 'verzug';
}

/** Speicher für „schon gesendet“. `beanspruchen` muss atomar sein: nur ein Aufruf pro Schlüssel und Tag bekommt `true`. */
export type EinmalSpeicher = {
  beanspruchen(schluessel: string, tag: string): Promise<{ ok: boolean; vorher: string | null }>;
  zuruecksetzen(schluessel: string, tag: string, vorher: string | null): Promise<void>;
};

/**
 * Führt `f` höchstens einmal pro Schlüssel und Tag aus. Der Schlüssel wird vor dem Senden gesetzt,
 * damit zwei gleichzeitige Läufe nicht doppelt senden. Klappt `f` nicht (false oder Fehler), wird er zurückgesetzt
 * und der nächste Lauf versucht es wieder.
 */
export async function einmalMit(speicher: EinmalSpeicher, schluessel: string, tag: string, f: () => Promise<boolean>): Promise<boolean> {
  const { ok, vorher } = await speicher.beanspruchen(schluessel, tag);
  if (!ok) return false;
  let geklappt = false;
  try {
    geklappt = await f();
  } finally {
    if (!geklappt) await speicher.zuruecksetzen(schluessel, tag, vorher);
  }
  return geklappt;
}

/**
 * Lässt `f` nie überlappen: erst ein Merker im Prozess, dann die Sperre über alle Prozesse (`sperre`).
 * Gibt false zurück, wenn schon ein Lauf unterwegs ist.
 */
/** Nach so langer Laufzeit gilt ein Lauf als hängend und blockiert die folgenden nicht mehr. */
export const HAENGT_MS = 10 * 60_000;

/**
 * Lässt nie zwei Läufe in diesem Prozess gleichzeitig zu. Hängt ein Lauf länger als `maxMs`
 * (ein `await`, das nie zurückkommt), gibt der nächste Lauf ihn frei und meldet das über `haengt`.
 * Gegen doppelte Arbeit schützt dann weiter die Sperre in der Datenbank (`sperre`).
 */
export function ohneUeberlappung(
  sperre: (f: () => Promise<void>) => Promise<boolean>,
  o: { maxMs?: number; jetzt?: () => number; haengt?: (ms: number) => void } = {},
) {
  const maxMs = o.maxMs ?? HAENGT_MS;
  const jetzt = o.jetzt ?? Date.now;
  let seit: number | null = null;
  let nr = 0;
  return async (f: () => Promise<void>): Promise<boolean> => {
    const t = jetzt();
    if (seit !== null) {
      if (t - seit < maxMs) return false;
      o.haengt?.(t - seit);
    }
    const meins = ++nr;
    seit = t;
    try { return await sperre(f); } finally { if (nr === meins) seit = null; }
  };
}
