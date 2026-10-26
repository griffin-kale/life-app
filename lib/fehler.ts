/**
 * Fehlermeldungen für Peter. Nur eigene, feste Texte gehen an die Oberfläche oder in die Datenbank.
 * Texte aus Bibliotheken und fremden Diensten (Anthropic, WHOOP, iCloud, simplewebauthn) bleiben auf dem Server:
 * Sie können interne Details oder Teile der Anfrage enthalten. Ins Log kommt nur die Art des Fehlers.
 */
export class Hinweis extends Error { override name = 'Hinweis'; }

export function oeffentlich(e: unknown, ersatz: string, bereich = 'api'): string {
  if (e instanceof Error && (e.name === 'Hinweis' || e.name === 'KalenderFehler')) return e.message;
  console.warn(`[${bereich}] Fehler`, e instanceof Error ? e.name : typeof e);
  return ersatz;
}

/** Lehnt das Modell ein erzwungenes Werkzeug ab? Manche Modelle lassen nur tool_choice „auto“ und „none“ zu und antworten sonst mit 400. */
export function zwangAbgelehnt(e: unknown): boolean {
  const status = (e as { status?: unknown })?.status;
  const text = e instanceof Error ? e.message : '';
  return status === 400 && /tool_choice/.test(text) && /not supported/i.test(text);
}
