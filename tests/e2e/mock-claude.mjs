// Attrappe für die Anthropic-API in Tests: ordnet Einträge fest ein, sortiert nach Hebel, spielt den Coach.
// Merkt sich jede Anfrage, damit Tests prüfen können, dass Namen nur als Platzhalter ankommen (GET /prompts).
// Start: node tests/e2e/mock-claude.mjs (Port 4010). Wird von playwright.config.ts automatisch gestartet.
import http from 'node:http';
const E = (o) => ({ typ: 'gedanke', kategorie: 'aufgabe', art: 'geld', titel: '', bereinigt: '', schritt: '', begruendung: '', kern: '', frage: '', ziel: '', hebel: 0, aufwand_min: 60, frist: '', wer: 'ich', delegieren_an: '', ...o });
function einordnen(entry) {
  const t = entry.trim().split('\n\n')[0].trim();
  if (/youtu/.test(t)) return E({ typ: 'video', kategorie: 'wissen', art: 'mental', titel: 'Fokus und Engpass', bereinigt: t.split('\n')[1] || 'Video', kern: 'Wer den Engpass kennt, spart Kraft.', frage: 'Wo verzettelst du dich diese Woche?', aufwand_min: 0 });
  if (/Seneca/.test(t)) return E({ typ: 'zitat', kategorie: 'wissen', art: 'zeit', titel: 'Seneca über Zeit', bereinigt: 'Nicht wenig Zeit haben wir, sondern viel verschwenden wir.', kern: 'Zeit fehlt selten, Fokus schon.', frage: 'Welche Stunde verschwendest du täglich?', aufwand_min: 0 });
  if (/Podcast mit/.test(t)) return E({ kategorie: 'idee', titel: 'Podcast mit der Feuerwehr', bereinigt: t, aufwand_min: 0 });
  if (/KGSt Angebot bis Freitag/.test(t)) return E({ titel: 'KGSt-Angebot', bereinigt: 'KGSt-Angebot bis Freitag schicken.', schritt: 'Angebotsentwurf an die KGSt schreiben', begruendung: 'bringt Umsatz', ziel: 'Projekte', hebel: 1, aufwand_min: 60, frist: '2026-10-30' });
  if (/KGSt-Angebot rausschicken/.test(t)) return E({ titel: 'KGSt-Angebot', bereinigt: t, schritt: 'KGSt-Angebot rausschicken', ziel: 'Projekte', hebel: 1, aufwand_min: 15 });
  if (/Geschichten/.test(t)) return E({ kategorie: 'engpass', titel: 'Drei Behörden-Geschichten', bereinigt: t, schritt: 'Drei Behörden-Geschichten für die Plattform drehen', ziel: 'Plattform', hebel: 3, aufwand_min: 240 });
  if (/Newsletter/.test(t)) return E({ titel: 'Newsletter Plattform', bereinigt: t, schritt: 'Newsletter zum Plattform-Start an die Fachbereiche', ziel: 'Plattform', hebel: 3, aufwand_min: 60 });
  if (/Rechnungen der Boutique/.test(t)) { const p = t.match(/\[Person \d+\]/)?.[0] || 'Carlotta'; return E({ titel: 'Boutique-Rechnungen', bereinigt: t, schritt: 'Boutique-Rechnungen prüfen lassen', ziel: 'Boutique', hebel: 0, aufwand_min: 15, wer: 'delegieren', delegieren_an: p }); }
  if (/Jonas/.test(t)) return E({ titel: 'Content-Plan mit Jonas', bereinigt: t, schritt: 'Mit Jonas den Content-Plan abstimmen', ziel: 'Plattform', hebel: 2, aufwand_min: 15, namen: [{ name: 'Jonas', art: 'person' }] });
  if (/Content-Plan/.test(t)) return E({ titel: 'Content-Plan', bereinigt: t, schritt: t.slice(0, 60), ziel: 'Plattform', hebel: 2, aufwand_min: 15 });
  if (/Messe-Notizen/.test(t)) return E({ kategorie: 'aufgabe', titel: 'Messe-Notizen', bereinigt: t, schritt: 'Messe-Notizen aus Leipzig sortieren', hebel: 0, aufwand_min: 60 });
  if (/Laternen/.test(t)) return E({ kategorie: 'privat', art: 'sozial', titel: 'Laternen basteln', bereinigt: t, schritt: 'Mit den Kindern Laternen basteln', ziel: 'Privat', hebel: 0, aufwand_min: 60 });
  return E({ bereinigt: t, schritt: t.slice(0, 60), hebel: 1 });
}
function sortieren(p) {
  const kor = (p.split('So hat Peter zuletzt korrigiert')[1] || '').split('\n\nOffene')[0];
  if (kor) console.log('KORREKTUREN:' + kor.replace(/\n/g, ' | ').slice(0, 400));
  console.log('MODUS:', /Nachtrag:/.test(p) ? 'nachtrag' : 'tag');
  const block = p.split('Offene Einträge:\n')[1].split('\n\nAntworte')[0].split('\n');
  const rows = block.map((l) => {
    const n = Number(l.split('.')[0]);
    const g = (k) => (l.match(new RegExp(k + ': ([^|]+)')) || [])[1]?.trim();
    return { n, titel: l.split('|')[0], hebel: Number(g('Hebel')) || 0, wer: g('Wer') || '', manuell: g('HEUTE VON PETER GESETZT')?.split(' ')[0], bisher: g('Bisher') };
  });
  const liste = []; const doppelt = [];
  const kgst = rows.filter((r) => /KGSt/.test(r.titel));
  if (kgst.length > 1) doppelt.push({ behalten: kgst[0].n, weg: kgst.slice(1).map((r) => r.n) });
  const rest = rows.filter((r) => !doppelt.some((d) => d.weg.includes(r.n)));
  let j = 0;
  for (const r of [...rest].sort((a, b) => b.hebel - a.hebel)) {
    let stapel = 'woche';
    if (r.manuell) stapel = r.manuell;
    else if (/Messe-Notizen/.test(r.titel)) stapel = 'streichen';
    else if (/delegieren/.test(r.wer)) stapel = 'delegieren';
    else if (/Podcast/.test(r.titel)) stapel = 'geparkt';
    else if (j < 3) { stapel = 'jetzt'; j++; }
    liste.push({ n: r.n, stapel, rang: liste.length + 1, grund: r.hebel === 3 ? 'Hebel 3 auf den Engpass' : r.hebel === 2 ? 'Hebel 2, nur 15 Minuten' : 'Frist Freitag, bringt Umsatz' });
  }
  return { liste, doppelt };
}
function coach(p) {
  const person = p.match(/Menschen in .*?: (\[Person \d+\])/)?.[1] || '';
  return /COACH MORGEN/.test(p)
    ? { text: 'Heute zählt der Newsletter. Du hast gut geschlafen, nimm dir den Vormittag dafür.', geste: person ? `Schick ${person} ein kurzes Danke für diese Woche.` : '' }
    : { text: 'Der Tag war zäh, der Plan für morgen steht. Leg das Handy um 22 Uhr weg.' };
}
const prompts = [];
const issues = [];
const json = (res, o, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
// WHOOP-Attrappe: drei kurze Nächte, eine lockere Laufeinheit, 82 kg
function whoop(pfad) {
  const tag = (i) => { const d = new Date(Date.now() - i * 864e5); d.setUTCHours(5, 30, 0, 0); return d; };
  if (pfad === '/developer/v2/activity/sleep') return { records: [0, 1, 2].map((i) => ({ id: 's' + i, end: tag(i).toISOString(), nap: false, score_state: 'SCORED', score: { sleep_performance_percentage: 70, stage_summary: { total_in_bed_time_milli: 380 * 60000, total_awake_time_milli: 20 * 60000 } } })), next_token: null };
  if (pfad === '/developer/v2/recovery') return { records: [0, 1, 2].map((i) => ({ sleep_id: 's' + i, created_at: tag(i).toISOString(), score_state: 'SCORED', score: { recovery_score: 40 + i * 10, hrv_rmssd_milli: 48.5, resting_heart_rate: 55 + i } })) };
  if (pfad === '/developer/v2/activity/workout') return { records: [{ id: 'w1', start: new Date(Date.now() - 3600_000).toISOString(), end: new Date(Date.now() - 900_000).toISOString(), sport_name: 'running', score_state: 'SCORED', score: { strain: 9.1, zone_durations: { zone_two_milli: 40 * 60000, zone_three_milli: 5 * 60000 } } }] };
  if (pfad === '/developer/v2/cycle') return { records: [{ start: tag(0).toISOString(), score: { strain: 11.2 } }] };
  if (pfad === '/developer/v2/user/measurement/body') return { weight_kilogram: 82 };
  return null;
}
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && u.pathname === '/prompts') return json(res, prompts);
  if (req.method === 'GET' && u.pathname === '/oauth/oauth2/auth') {
    res.writeHead(302, { location: `${u.searchParams.get('redirect_uri')}?code=testcode&state=${encodeURIComponent(u.searchParams.get('state'))}` }); return res.end();
  }
  if (req.method === 'POST' && u.pathname === '/oauth/oauth2/token') { req.resume(); return json(res, { access_token: 'acc', refresh_token: 'ref', expires_in: 3600 }); }
  if (req.method === 'GET' && u.pathname.startsWith('/developer/')) {
    if (req.headers.authorization !== 'Bearer acc') return json(res, { error: 'unauthorized' }, 401);
    const w = whoop(u.pathname); return w ? json(res, w) : json(res, {}, 404);
  }
  if (req.method === 'POST' && u.pathname === '/repos/griffin-kale/life-app/issues') {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { issues.push({ auth: req.headers.authorization, ...JSON.parse(b) }); json(res, { number: 41 + issues.length }, 201); }); return;
  }
  if (req.method === 'GET' && u.pathname === '/issues') return json(res, issues);
  if (req.method === 'GET' && u.pathname.startsWith('/api/v2/product/')) {
    if (u.pathname.includes('4000000000001')) return json(res, { status: 1, product: { product_name_de: 'Skyr natur', brands: 'Testmolkerei', serving_quantity: 150, nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 } } });
    return json(res, { status: 0 });
  }
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    const body = JSON.parse(b || '{}');
    const p = body.messages?.[0]?.content || '';
    prompts.push(Array.isArray(p) ? p.map((x) => x.type === 'text' ? x.text : '[Bild]').join('\n') : p);
    const text = (Array.isArray(p) ? p.map((x) => x.text || '').join('\n') : p).trim();
    const bon = text.startsWith('BON'); const geld = text.startsWith('GELD');
    const essen = !bon && (text.startsWith('ESSEN') || Array.isArray(p));
    const a = bon ? { laden: 'Testmarkt', summe: 23.45, topf: 'Alltag' }
      : geld ? { topf: /Tanken/.test(text) ? 'Familie' : 'Alltag' }
      : essen ? { name: Array.isArray(p) ? 'Nudeln mit Gemüse' : 'Bowl mit Hähnchen', protein_von: 40, protein_bis: 55, kcal_von: 650, kcal_bis: 850, gemuese: true }
      : p.startsWith('SORTIERLAUF') ? sortieren(p) : p.startsWith('COACH') ? coach(p) : einordnen(p.split('Eintrag (oft diktiert, kann Füllwörter und Fehler enthalten):\n')[1] || '');
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      // Langer Eintrag mit „ABSCHNEIDEN“: beim ersten Versuch abgeschnitten wie bei einem zu knappen Limit
      if (text.includes('Eintrag (oft diktiert') && !text.startsWith('COACH') && !text.startsWith('SORTIERLAUF') && text.includes('ABSCHNEIDEN') && (body.max_tokens ?? 0) <= 1500) return res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: body.model || 'x', content: [{ type: 'tool_use', id: 'tu_1', name: 'ergebnis', input: {} }], stop_reason: 'max_tokens', usage: { input_tokens: 1, output_tokens: 1 } }));
      const block = body.tool_choice?.name ? { type: 'tool_use', id: 'tu_1', name: body.tool_choice.name, input: a } : { type: 'text', text: JSON.stringify(a) };
      res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: body.model || 'x', content: [block], stop_reason: body.tool_choice ? 'tool_use' : 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }));
    }, !essen && !bon && !geld && p.startsWith('SORTIERLAUF') ? 400 : 150);
    console.log('mock', bon ? 'bon' : geld ? 'geld' : essen ? 'essen' : p.startsWith('SORTIERLAUF') ? 'sort' : p.startsWith('COACH') ? 'coach' : 'enrich', body.model);
  });
}).listen(4010);
