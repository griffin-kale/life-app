/**
 * Zähler für die Begrenzung der Anfragen, ohne Abhängigkeiten (testbar).
 * Zähler liegen im Arbeitsspeicher. Das reicht, solange genau ein App-Prozess läuft
 * (so ist es auf dem Hetzner-Server). Bei mehreren Instanzen gehört das in einen gemeinsamen Speicher.
 */
type Bucket = { n: number; reset: number };
const g = globalThis as unknown as { __rl?: Map<string, Bucket> };
const buckets = (g.__rl ??= new Map<string, Bucket>());

export function hit(key: string, max: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset <= now) { buckets.set(key, { n: 1, reset: now + windowMs }); return { ok: true, retryAfter: 0 }; }
  b.n += 1;
  return b.n <= max ? { ok: true, retryAfter: 0 } : { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
}

/** Nur für Tests. */
export function _reset() { buckets.clear(); }
