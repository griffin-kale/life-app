import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hinweis, oeffentlich } from '../../lib/fehler.ts';

test('fremde Fehlertexte bleiben auf dem Server, eigene Hinweise gehen durch', () => {
  const warn = console.warn; const log: unknown[][] = []; console.warn = (...a: unknown[]) => { log.push(a); };
  try {
    assert.equal(oeffentlich(new Error('400 {"error":"…Carlotta…"}'), 'Ging nicht.'), 'Ging nicht.');
    assert.equal(oeffentlich(new Hinweis('Claude ist noch nicht verbunden'), 'x'), 'Claude ist noch nicht verbunden');
    assert.equal(oeffentlich('roh', 'x'), 'x');
    assert.equal(JSON.stringify(log).includes('Carlotta'), false);
  } finally { console.warn = warn; }
});
