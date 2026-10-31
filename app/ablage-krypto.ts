/**
 * Verschlüsselung der Ablage, nur im Browser (WebCrypto). Passphrase, Wiederherstellungsschlüssel und Inhaltsschlüssel
 * verlassen das Gerät nie. Ein zufälliger Inhaltsschlüssel (256 Bit) verschlüsselt alle Blöcke mit AES-GCM.
 * Er liegt zweimal eingepackt auf dem Server: mit einem Schlüssel aus der Passphrase (PBKDF2-SHA-256)
 * und mit dem Wiederherstellungsschlüssel (32 Zufallsbytes, zum Ausdrucken).
 * Ein Block ist Base64 aus 12 Byte IV und Geheimtext mit Prüfsumme. Ein falscher Schlüssel scheitert an der Prüfsumme.
 */
const b64 = (b: Uint8Array) => { let s = ''; b.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
/** WebCrypto will einen eigenen ArrayBuffer sehen. */
const buf = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>;

export const zufall = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export const neuesSalz = () => b64(zufall(16));

async function rohZu(k: CryptoKey, klar: Uint8Array): Promise<string> {
  const iv = zufall(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, k, buf(klar)));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length);
  return b64(out);
}
async function rohAuf(k: CryptoKey, block: string): Promise<Uint8Array> {
  const roh = unb64(block);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(roh.slice(0, 12)) }, k, buf(roh.slice(12))));
}
const aesKey = (roh: Uint8Array) => crypto.subtle.importKey('raw', buf(roh), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

/** Schlüssel aus der Passphrase: PBKDF2-SHA-256, nicht exportierbar. */
export async function ausPassphrase(passphrase: string, salz: string, iterationen: number): Promise<CryptoKey> {
  const basis = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: buf(unb64(salz)), iterations: iterationen }, basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
/** Schlüssel aus dem Wiederherstellungsschlüssel: 32 Zufallsbytes, direkt nutzbar. */
export const ausWiederherstellung = (roh: Uint8Array) => aesKey(roh);

/** Packt den Inhaltsschlüssel mit einem Schlüssel ein. */
export const einpacken = (huelle: CryptoKey, inhalt: Uint8Array) => rohZu(huelle, inhalt);
/** Packt den Inhaltsschlüssel aus und macht ihn nutzbar (nicht exportierbar). Wirft bei falschem Schlüssel. */
export async function auspacken(huelle: CryptoKey, block: string): Promise<CryptoKey> {
  const roh = await rohAuf(huelle, block);
  try { return await aesKey(roh); } finally { roh.fill(0); }
}

export const zu = (k: CryptoKey, wert: unknown) => rohZu(k, new TextEncoder().encode(JSON.stringify(wert)));
export async function auf<T>(k: CryptoKey, block: string): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await rohAuf(k, block))) as T;
}
export const inhaltsSchluessel = aesKey;
