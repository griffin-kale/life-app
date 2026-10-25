import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

/**
 * Abruf fremder Seiten ohne Zugriff auf interne Adressen (Schutz gegen SSRF).
 *
 * - Die Prüfung der IP passiert beim Verbindungsaufbau selbst (eigene DNS-Auflösung),
 *   damit ein Wechsel der DNS-Antwort zwischen Prüfung und Abruf nichts bringt.
 * - Weiterleitungen werden einzeln verfolgt und jedes Ziel neu geprüft, höchstens 3.
 * - Nur http und https auf Standard-Ports, höchstens maxBytes, Zeitlimit insgesamt.
 */

export function isPrivateIp(raw: string): boolean {
  const ip = raw.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)   // Carrier-NAT
      || (a === 169 && b === 254)             // Link-local, Cloud-Metadaten
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (isIP(ip) === 6) {
    if (ip === '::' || ip === '::1') return true;
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || /^ff/.test(ip) || ip.startsWith('64:ff9b:') || ip.startsWith('2001:db8:');
  }
  return true; // Unbekanntes Format gilt als nicht erlaubt.
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** DNS-Auflösung für den Socket: schlägt fehl, sobald eine der Adressen intern ist. */
function guardedLookup(hostname: string, options: { all?: boolean }, cb: LookupCb) {
  dnsLookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err, '');
    const list = addrs as LookupAddress[];
    if (!list.length || list.some((a) => isPrivateIp(a.address))) {
      const e = new Error('Interne Adresse nicht erlaubt') as NodeJS.ErrnoException;
      e.code = 'EPRIVATE';
      return cb(e, '');
    }
    if (options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}

export type SafeResponse = { status: number; url: string; contentType: string; body: Buffer };

function once(url: URL, deadline: number, maxBytes: number, headers: Record<string, string>): Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && isPrivateIp(host)) return reject(new Error('Interne Adresse nicht erlaubt'));
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: 'GET',
      headers: { ...headers, 'accept-encoding': 'identity' },
      lookup: guardedLookup as unknown as typeof dnsLookup,
      timeout: Math.max(1000, deadline - Date.now()),
    }, (res) => {
      const status = res.statusCode ?? 0;
      const contentType = String(res.headers['content-type'] ?? '');
      if (status >= 300 && status < 400) { res.resume(); return resolve({ status, location: res.headers.location, contentType, body: Buffer.alloc(0) }); }
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > maxBytes) { chunks.push(c.subarray(0, Math.max(0, maxBytes - (size - c.length)))); res.destroy(); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve({ status, contentType, body: Buffer.concat(chunks) }));
      res.on('close', () => resolve({ status, contentType, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Zeitlimit')));
    req.on('error', reject);
    req.end();
  });
}

export async function safeFetch(raw: string, opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; headers?: Record<string, string> } = {}): Promise<SafeResponse | null> {
  const deadline = Date.now() + (opts.timeoutMs ?? 8000);
  const maxBytes = opts.maxBytes ?? 1_500_000;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.port && url.port !== '80' && url.port !== '443') return null;
    if (url.username || url.password) return null;
    if (Date.now() > deadline) return null;
    const r = await once(url, deadline, maxBytes, opts.headers ?? {});
    if (r.status >= 300 && r.status < 400) {
      if (!r.location) return null;
      try { url = new URL(r.location, url); } catch { return null; }
      continue;
    }
    return { status: r.status, url: url.toString(), contentType: r.contentType, body: r.body };
  }
  return null;
}
