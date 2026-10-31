import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Lebender Plan: Rhythmen, Gewohnheiten, Abendfrage, Quote, Wochen, Abgleich', async () => {
  const p = await import('../../lib/ablage-plan.ts');
  assert.equal(p.rhythmusAus('täglich'), 'taeglich');
  assert.equal(p.rhythmusAus('Tag'), 'taeglich');
  assert.equal(p.rhythmusAus('jeden Sonntag'), 'woechentlich');
  assert.equal(p.rhythmusAus('Woche'), 'woechentlich');
  assert.equal(p.rhythmusAus('monatlich'), 'seltener');
  const plan = {
    titel: 'Erfunden',
    dividenden_gewohnheiten: [{ ebene: 'Tag', text: 'Lesen', rhythmus: 'täglich' }, { ebene: 'Woche', text: 'Planen', rhythmus: 'sonntags' }, { text: 'Lesen', rhythmus: 'täglich' }, { text: '' }],
    betriebssystem: { rhythmen: [{ ebene: 'Tag', name: 'Abendblick', dauer_min: 5, abendfrage: { frage: 'Etwas getan?', optionen: ['Ja', 'Nein'] }, zielquote: '4/5' }, { ebene: 'Jahr', name: 'Jahresblick' }] },
  };
  const g = p.gewohnheiten(plan);
  assert.deepEqual(g.map((x) => [x.id, x.rhythmus]), [['g:Lesen', 'taeglich'], ['g:Planen', 'woechentlich'], ['r:Abendblick', 'taeglich'], ['r:Jahresblick', 'seltener']]);
  assert.deepEqual(p.abendfrage(plan), { frage: 'Etwas getan?', optionen: ['Ja', 'Nein'] });
  assert.equal(p.abendfrage({}).optionen[0], 'Ja');
  assert.equal(p.erfuellt('Ja', p.abendfrage(plan)), true);
  assert.equal(p.erfuellt('Nein', p.abendfrage(plan)), false);
  assert.deepEqual(p.zielquote(plan), [4, 5]);
  assert.equal(p.zielquote({}), null);
  assert.equal(p.montagVon('2026-11-01'), '2026-10-26'); // Sonntag gehört zur Woche davor
  assert.equal(p.montagVon('2026-10-26'), '2026-10-26');
  assert.deepEqual(p.wochenTage('2026-10-26').slice(-1), ['2026-11-01']);
  assert.equal(p.quartal('2026-10-31'), '2026-Q4');
  assert.equal(p.quartal('2027-01-01'), '2027-Q1');
  assert.equal(p.tageBis('2026-10-31', '2026-11-03'), 3);
  // Abgleich: neu, entfernt, geändert, Gleiches fehlt
  const neu = { ...plan, titel: 'Erfunden 2', dividenden_gewohnheiten: [{ text: 'Lesen' }, { text: 'Laufen' }] };
  const a = p.abgleich(plan, neu);
  assert.deepEqual(a.map((x) => x.abschnitt).sort(), ['dividenden_gewohnheiten', 'titel']);
  const gw = a.find((x) => x.abschnitt === 'dividenden_gewohnheiten')!;
  assert.deepEqual(gw.neu, ['Laufen']);
  assert.deepEqual(gw.entfernt, ['Planen']);
  assert.deepEqual(p.abgleich(plan, structuredClone(plan)), []);
  assert.equal(p.txt({ name: 'X' }), 'X');
  assert.equal(p.txt(['a']), '');
});
