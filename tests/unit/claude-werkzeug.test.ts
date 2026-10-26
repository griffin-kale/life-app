import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zwangAbgelehnt } from '../../lib/fehler.ts';

const fehler = (status: number, message: string) => Object.assign(new Error(message), { status });

test('erkennt, wenn ein Modell das erzwungene Werkzeug ablehnt', () => {
  assert.equal(zwangAbgelehnt(fehler(400, '400 {"type":"error","error":{"type":"invalid_request_error","message":"tool_choice: type \\"tool\\" and \\"any\\" are not supported for this model."}}')), true);
});

test('andere Fehler lösen keinen zweiten Versuch aus', () => {
  assert.equal(zwangAbgelehnt(fehler(400, 'messages: text content blocks must be non-empty')), false);
  assert.equal(zwangAbgelehnt(fehler(429, 'tool_choice not supported')), false);
  assert.equal(zwangAbgelehnt(fehler(500, 'tool_choice: not supported')), false);
  assert.equal(zwangAbgelehnt('tool_choice not supported'), false);
  assert.equal(zwangAbgelehnt(undefined), false);
});
