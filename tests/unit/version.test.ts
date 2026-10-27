// Version, CHANGELOG und Übergabe laufen nie auseinander.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('package.json, CHANGELOG und UEBERGABE nennen dieselbe Version', () => {
  const v = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
  const changelog = readFileSync('CHANGELOG.md', 'utf8').match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
  const uebergabe = readFileSync('docs/UEBERGABE.md', 'utf8').match(/^Stand: .*Version (\d+\.\d+\.\d+)\./m)?.[1];
  assert.equal(changelog, v, 'oberster Eintrag im CHANGELOG');
  assert.equal(uebergabe, v, 'Stand in docs/UEBERGABE.md');
});
