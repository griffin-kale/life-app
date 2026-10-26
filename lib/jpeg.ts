/**
 * Prüft, ob ein Foto ein JPEG ist, und entfernt Metadaten, bevor es an Claude geht:
 * APP1 (EXIF mit Ort, Gerät, Zeit; XMP), APP13 (IPTC) und Kommentare. Der Browser verkleinert schon
 * und lässt Ortsdaten weg, der Server prüft es trotzdem noch einmal selbst. Ohne Abhängigkeiten.
 */
const WEG = new Set([0xe1, 0xed, 0xfe]);

export function jpegSaeubern(b64: string): string | null {
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return null;
  const d = Buffer.from(b64, 'base64');
  if (d.length < 4 || d[0] !== 0xff || d[1] !== 0xd8 || d[2] !== 0xff) return null;
  const teile: Buffer[] = [d.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= d.length) {
    if (d[i] !== 0xff) return null;
    const m = d[i + 1];
    if (m === 0xff) { i++; continue; } // Füllbytes
    if (m === 0xd9) { teile.push(d.subarray(i, i + 2)); return Buffer.concat(teile).toString('base64'); }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { teile.push(d.subarray(i, i + 2)); i += 2; continue; }
    const len = d.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > d.length) return null;
    if (m === 0xda) { teile.push(d.subarray(i)); return Buffer.concat(teile).toString('base64'); } // Bilddaten bis zum Ende
    if (!WEG.has(m)) teile.push(d.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}
