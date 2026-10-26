// Statische Prüfungen: Jede API-Route hat den zweiten Riegel, offene Pfade sind genau und keine Präfixe,
// keine Route gibt Fehlertexte fremder Bibliotheken weiter, die Pseudonymisierung schluckt keine Fehler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function routen(dir = 'app/api'): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? routen(p) : n === 'route.ts' ? [p] : []; });
}

// Offen ohne Sitzung, jeweils mit eigener Prüfung: Anmeldung (Challenge, Code, Einrichtungscode), Kurzbefehl (Schlüssel), Lebenszeichen.
const OFFEN = new Set(['app/api/health/route.ts', 'app/api/capture/route.ts', 'app/api/auth/login-options/route.ts', 'app/api/auth/login/route.ts',
  'app/api/auth/register-options/route.ts', 'app/api/auth/register/route.ts', 'app/api/auth/code/start/route.ts', 'app/api/auth/code/fertig/route.ts',
  'app/api/auth/code/login/route.ts', 'app/api/auth/logout/route.ts', 'app/api/whoop/callback/route.ts']);

test('jede API-Route prüft die Sitzung selbst (zweiter Riegel)', () => {
  const alle = routen();
  assert.ok(alle.length > 30);
  for (const p of alle) {
    if (OFFEN.has(p)) continue;
    const s = readFileSync(p, 'utf8');
    const handler = [...s.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\([^)]*\)[^{]*\{\n(.*)\n/g)];
    assert.ok(handler.length > 0, p);
    for (const h of handler) assert.match(h[2], /await ohneSitzung\(\); if \(aus\) return aus;/, `${p} ${h[1]}`);
  }
});

test('Einrichten prüft die Sitzung oder den Code nur vor der Einrichtung', () => {
  for (const p of ['register-options', 'register', 'code/start', 'code/fertig']) {
    const s = readFileSync(`app/api/auth/${p}/route.ts`, 'utf8');
    assert.match(s, /darfEinrichten\(token\)/, p);
    assert.doesNotMatch(s, /SETUP_TOKEN/, p);
  }
});

test('offene Pfade in der Middleware sind genau, ohne Präfixe', () => {
  const s = readFileSync('middleware.ts', 'utf8');
  const block = s.slice(s.indexOf('new Set(['), s.indexOf(']);'));
  const pfade = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(pfade.includes('/api/capture'));
  for (const p of pfade) assert.ok(p.startsWith('/') && !p.endsWith('/') && p.length > 1, p);
  assert.doesNotMatch(s, /startsWith\(p\)/);
  assert.match(s, /OPEN\.has\(pathname\)/);
});

test('keine Route gibt Fehlertexte fremder Bibliotheken an die Oberfläche', () => {
  for (const p of routen()) assert.doesNotMatch(readFileSync(p, 'utf8'), /\(e as Error\)\.message|e\.message/, p);
});

test('Pseudonymisierung fällt geschlossen aus: kein geschluckter Datenbankfehler bei den Namen', () => {
  const s = readFileSync('lib/claude.ts', 'utf8');
  const f = s.slice(s.indexOf('export async function geschuetzteNamen'), s.indexOf('export async function namenLernen'));
  assert.ok(f.length > 50);
  assert.doesNotMatch(f, /\.catch\(/);
});

test('CSP kommt aus der Middleware mit Nonce, ohne unsafe-inline für Skripte', () => {
  const m = readFileSync('middleware.ts', 'utf8');
  const script = m.match(/`script-src ([^`]*)`/)?.[1] ?? '';
  assert.match(script, /'nonce-\$\{nonce\}'/);
  assert.match(script, /'strict-dynamic'/);
  assert.doesNotMatch(script, /unsafe-inline/);
  assert.doesNotMatch(readFileSync('next.config.mjs', 'utf8'), /key: 'Content-Security-Policy'/);
});
