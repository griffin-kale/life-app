/** Nur Push-Dienste der großen Anbieter. Schützt davor, dass jemand Life als Sprungbrett zu beliebigen Adressen nutzt. */
export function endpointOk(e: string): boolean {
  try { const u = new URL(e); return u.protocol === 'https:' && /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/.test(u.hostname); } catch { return false; }
}
