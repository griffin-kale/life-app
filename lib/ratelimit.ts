import { NextResponse, type NextRequest } from 'next/server';
import { hit } from './ratelimit-core';

/** Begrenzung der Anfragen pro IP und Zweck. Die Zähler stecken in ratelimit-core. */

/** Caddy setzt X-Forwarded-For selbst und ignoriert Werte von außen. Der letzte Eintrag ist die echte Adresse. */
export function clientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) { const parts = xf.split(',').map((s) => s.trim()).filter(Boolean); if (parts.length) return parts[parts.length - 1]; }
  return req.headers.get('x-real-ip') ?? 'unbekannt';
}

export const LIMITS = {
  einrichten: { max: 10, windowMs: 15 * 60_000 },  // Einrichtungscode raten unmöglich machen
  anmelden: { max: 30, windowMs: 15 * 60_000 },
  code: { max: 10, windowMs: 15 * 60_000 },        // Passwort und Einmal-Code
  pin: { max: 30, windowMs: 15 * 60_000 },         // PIN der Ablage; die eigentliche Sperre greift nach 5 Fehlversuchen pro Mensch
  erfassen: { max: 60, windowMs: 60_000 },         // Kurzbefehl
  schreiben: { max: 120, windowMs: 60_000 },       // Einträge und Änderungen aus der App
  sortieren: { max: 10, windowMs: 15 * 60_000 },   // Sortierlauf auf Knopfdruck, jeder Lauf kostet Claude-Aufrufe
} as const;

/** Gibt eine 429-Antwort zurück, wenn das Limit erreicht ist, sonst null. */
export function begrenzt(req: NextRequest, zweck: keyof typeof LIMITS): NextResponse | null {
  const { max, windowMs } = LIMITS[zweck];
  const r = hit(`${zweck}:${clientIp(req)}`, max, windowMs);
  if (r.ok) return null;
  return NextResponse.json({ error: 'Zu viele Versuche. Bitte kurz warten.' }, { status: 429, headers: { 'retry-after': String(r.retryAfter) } });
}
