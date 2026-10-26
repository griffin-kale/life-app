import { hostErlaubt } from './kalender-regeln';
import { auswerten, type Vorkommen } from './ical-termine';

export type { Vorkommen };

/**
 * Lesender CalDAV-Zugriff auf iCloud. Life fragt nur Kalender ab und schreibt nichts.
 * Zugang: Apple-ID und ein app-spezifisches Passwort aus der .env (ICLOUD_USER, ICLOUD_APP_PASSWORT).
 * Antworten von iCloud sind unsichere Eingaben: nur iCloud-Hosts, Größe begrenzt, Inhalte nie ins Log.
 */

export const kalenderBereit = () => !!(process.env.ICLOUD_USER && process.env.ICLOUD_APP_PASSWORT);
const BASIS = () => process.env.CALDAV_URL || 'https://caldav.icloud.com/';
const MAX = 5_000_000;

export class KalenderFehler extends Error { override name = 'KalenderFehler'; }

async function dav(method: 'PROPFIND' | 'REPORT', url: string, body: string, depth: '0' | '1'): Promise<{ text: string; url: string }> {
  const test = process.env.CALDAV_URL;
  let ziel = url;
  for (let i = 0; i < 4; i++) {
    if (!hostErlaubt(ziel, test)) throw new KalenderFehler('Kalender: unerwartete Adresse');
    const auth = Buffer.from(`${process.env.ICLOUD_USER}:${process.env.ICLOUD_APP_PASSWORT}`).toString('base64');
    let r: Response;
    try {
      r = await fetch(ziel, { method, body, redirect: 'manual', signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Basic ${auth}`, Depth: depth, 'Content-Type': 'application/xml; charset=utf-8', 'User-Agent': 'Life/1.0' } });
    } catch { throw new KalenderFehler('Kalender: iCloud antwortet nicht'); }
    if ([301, 302, 307, 308].includes(r.status)) { const loc = r.headers.get('location'); if (!loc) break; ziel = new URL(loc, ziel).toString(); continue; }
    if (r.status === 401 || r.status === 403) throw new KalenderFehler('Kalender: iCloud lehnt die Anmeldung ab. App-spezifisches Passwort prüfen.');
    if (r.status !== 207 && r.status !== 200) throw new KalenderFehler(`Kalender: iCloud meldet ${r.status}`);
    const text = await r.text();
    if (text.length > MAX) throw new KalenderFehler('Kalender: Antwort zu groß');
    return { text, url: ziel };
  }
  throw new KalenderFehler('Kalender: zu viele Weiterleitungen');
}

const entities = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#13;/g, '\r').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
const tag = (name: string) => new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${name}>`, 'i');
const erstes = (xml: string, name: string) => xml.match(tag(name))?.[1] ?? '';
const antworten = (xml: string) => [...xml.matchAll(/<(?:[\w-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?response>/gi)].map((m) => m[1]);
const href = (xml: string) => entities(erstes(xml, 'href').trim());

export type Kalender = { href: string; name: string; farbe: string };

/** Findet die Kalender des Kontos: Principal, Kalender-Heimat, dann die Liste mit Ereignissen. */
export async function kalenderFinden(): Promise<Kalender[]> {
  const p = await dav('PROPFIND', BASIS(), '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>', '0');
  const principal = href(erstes(p.text, 'current-user-principal'));
  if (!principal) throw new KalenderFehler('Kalender: kein Konto gefunden');
  const h = await dav('PROPFIND', new URL(principal, p.url).toString(), '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>', '0');
  const heim = href(erstes(h.text, 'calendar-home-set'));
  if (!heim) throw new KalenderFehler('Kalender: keine Kalender gefunden');
  const l = await dav('PROPFIND', new URL(heim, h.url).toString(), '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:ic="http://apple.com/ns/ical/"><d:prop><d:displayname/><d:resourcetype/><ic:calendar-color/><c:supported-calendar-component-set/></d:prop></d:propfind>', '1');
  return antworten(l.text)
    .filter((r) => /<(?:[\w-]+:)?calendar\b/i.test(erstes(r, 'resourcetype')) && (!/supported-calendar-component-set/i.test(r) || /name=["']VEVENT["']/i.test(r)))
    .map((r) => ({ href: new URL(href(r), l.url).toString(), name: entities(erstes(r, 'displayname').trim()).slice(0, 80) || 'Kalender', farbe: entities(erstes(r, 'calendar-color').trim()).slice(0, 9) }))
    .filter((k) => hostErlaubt(k.href, process.env.CALDAV_URL));
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Ereignisse eines Kalenders im Zeitraum. Wiederholungen und verschobene Einzeltermine rechnet ical.js aus. */
export async function ereignisse(kalender: string, von: Date, bis: Date): Promise<Vorkommen[]> {
  const body = `<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${utc(von)}" end="${utc(bis)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
  const r = await dav('REPORT', kalender, body, '1');
  const out: Vorkommen[] = [];
  for (const a of antworten(r.text)) {
    const ics = entities(erstes(a, 'calendar-data'));
    if (ics.includes('BEGIN:VCALENDAR')) out.push(...auswerten(ics, von, bis));
    if (out.length > 2000) break;
  }
  return out;
}
