import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jpegSaeubern } from '../../lib/jpeg.ts';

const seg = (marker: number, inhalt: Buffer) => { const b = Buffer.alloc(4); b[0] = 0xff; b[1] = marker; b.writeUInt16BE(inhalt.length + 2, 2); return Buffer.concat([b, inhalt]); };
const SOI = Buffer.from([0xff, 0xd8]);
const DQT = seg(0xdb, Buffer.alloc(65, 1));
const SOS = Buffer.concat([seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), Buffer.from([0x12, 0x34, 0x56]), Buffer.from([0xff, 0xd9])]);

test('EXIF, IPTC und Kommentare fallen raus, Bilddaten bleiben', () => {
  const exif = seg(0xe1, Buffer.from('Exif\0\0GPS-Ort-Muenchen'));
  const iptc = seg(0xed, Buffer.from('Photoshop 3.0 Name'));
  const com = seg(0xfe, Buffer.from('Kommentar'));
  const app0 = seg(0xe0, Buffer.from('JFIF\0'));
  const roh = Buffer.concat([SOI, app0, exif, DQT, iptc, com, SOS]).toString('base64');
  const sauber = Buffer.from(jpegSaeubern(roh)!, 'base64');
  assert.equal(sauber.includes(Buffer.from('GPS')), false);
  assert.equal(sauber.includes(Buffer.from('Photoshop')), false);
  assert.equal(sauber.includes(Buffer.from('Kommentar')), false);
  assert.deepEqual(sauber, Buffer.concat([SOI, app0, DQT, SOS]));
});

test('kein JPEG oder kaputt: abgelehnt', () => {
  assert.equal(jpegSaeubern(Buffer.from('iVBORw0KGgo=', 'base64').toString('base64')), null); // PNG
  assert.equal(jpegSaeubern('kein base64!'), null);
  assert.equal(jpegSaeubern(Buffer.concat([SOI, Buffer.from([0xff, 0xe1, 0xff, 0xff, 1, 2])]).toString('base64')), null); // Länge zu groß
  assert.equal(jpegSaeubern(Buffer.from([0xff, 0xd8]).toString('base64')), null);
});
