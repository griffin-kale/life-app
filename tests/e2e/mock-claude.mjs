// Attrappe für die Anthropic-API in Tests: ordnet Einträge fest ein, sortiert nach Hebel, spielt den Coach.
// Merkt sich jede Anfrage, damit Tests prüfen können, dass Namen nur als Platzhalter ankommen (GET /prompts).
// Start: node tests/e2e/mock-claude.mjs (Port 4010). Wird von playwright.config.ts automatisch gestartet.
import http from 'node:http';
const E = (o) => ({ typ: 'gedanke', kategorie: 'aufgabe', art: 'geld', titel: '', bereinigt: '', schritt: '', begruendung: '', kern: '', frage: '', ziel: '', hebel: 0, aufwand_min: 60, frist: '', wer: 'ich', delegieren_an: '', ...o });
function einordnen(entry) {
  const t = entry.trim().split('\n\n')[0].trim();
  if (/was jetzt\?$/i.test(t)) return E({ kategorie: 'notiz', titel: 'Frage an den Coach', bereinigt: t, aufwand_min: 0, anCoach: true });
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
function standort(p) {
  const n = Number(p.match(/STANDORT ETAPPE (\d)/)?.[1]);
  if (n === 1) return { zusammenfassung: 'Zeit ist gerade dein engster Bereich, Sozial dein stärkster.', vorschlaege: [{ art: 'fokus', bereich: 'zeit', text: 'Zwei Stunden am Morgen ohne Mails' }] };
  if (n === 2) return { zusammenfassung: 'Du willst mehr Wirkung bei weniger Hektik.', vorschlaege: [
    { art: 'werte', text: 'Familie, Mut, Wirkung' }, { art: 'jahr', text: 'Die Plattform trägt sich, du arbeitest vier Tage.' },
    { art: 'quartal', bereich: 'geschaeft', text: 'Acht Erstgespräche im Monat' }, { art: 'weglassen', text: 'Neue Shop-Produkte' }] };
  return { zusammenfassung: 'Der Stau liegt vor dem Erstgespräch.', vorschlaege: [
    { art: 'engpass', text: 'Zu wenige Erstgespräche', herleitung: 'Ideen und Angebote gibt es genug, es fehlen Gespräche.' },
    { art: 'wochenziel', text: 'Drei Erstgespräche vereinbart' }, { art: 'hack', text: 'darf nicht durch' }] };
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
      : p.startsWith('STANDORT') ? standort(p) : p.startsWith('SORTIERLAUF') ? sortieren(p) : p.startsWith('COACH CHAT') ? { text: /müde/.test(p) ? 'Dann zuerst zwanzig Minuten NSDR, danach das Angebot.' : 'Fang mit dem Angebot an, dreißig Minuten, Handy weg.' } : p.startsWith('COACH') ? coach(p) : einordnen(p.split('Eintrag (oft diktiert, kann Füllwörter und Fehler enthalten):\n')[1] || '');
    setTimeout(() => {
      // Modelle mit „ohne-zwang“ im Namen lehnen ein erzwungenes Werkzeug ab wie die neueren Claude-Modelle
      if (/ohne-zwang/.test(body.model || '') && (body.tool_choice?.type === 'tool' || body.tool_choice?.type === 'any')) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'tool_choice: type "tool" and "any" are not supported for this model.' } }));
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      // Langer Eintrag mit „ABSCHNEIDEN“: beim ersten Versuch abgeschnitten wie bei einem zu knappen Limit
      if (text.includes('Eintrag (oft diktiert') && !text.startsWith('COACH') && !text.startsWith('SORTIERLAUF') && text.includes('ABSCHNEIDEN') && (body.max_tokens ?? 0) <= 1500) return res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: body.model || 'x', content: [{ type: 'tool_use', id: 'tu_1', name: 'ergebnis', input: {} }], stop_reason: 'max_tokens', usage: { input_tokens: 1, output_tokens: 1 } }));
      const block = body.tool_choice?.name || body.tool_choice?.type === 'auto' ? { type: 'tool_use', id: 'tu_1', name: body.tool_choice.name || 'ergebnis', input: a } : { type: 'text', text: JSON.stringify(a) };
      res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: body.model || 'x', content: [block], stop_reason: body.tool_choice?.name || body.tool_choice?.type === 'auto' ? 'tool_use' : 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }));
    }, !essen && !bon && !geld && p.startsWith('SORTIERLAUF') ? 400 : 150);
    if (text.startsWith('STANDORT')) console.log('mock standort');
    console.log('mock', bon ? 'bon' : geld ? 'geld' : essen ? 'essen' : p.startsWith('SORTIERLAUF') ? 'sort' : p.startsWith('COACH') ? 'coach' : 'enrich', body.model);
  });
}).listen(4010);


// Attrappe für iCloud CalDAV (Port 4011): Privat, Familie und eine Erinnerungsliste ohne Termine.
// Wie iCloud: Attribute in einfachen Anführungszeichen (<comp name='VEVENT'/>).
const BERLIN = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date()).replace(/-/g, '');
const TZ = 'BEGIN:VTIMEZONE\r\nTZID:Europe/Berlin\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nDTSTART:19700329T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nDTSTART:19701025T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n';
const ev = (uid, von, bis, titel, extra = '') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${TZ}BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART;TZID=Europe/Berlin:${von}\r\nDTEND;TZID=Europe/Berlin:${bis}\r\n${extra}SUMMARY:${titel}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ms = (antworten) => `<?xml version="1.0" encoding="UTF-8"?><multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">${antworten}</multistatus>`;
const kal = (pfad, name, farbe, comp) => `<response><href>${pfad}</href><propstat><prop><displayname>${xml(name)}</displayname><resourcetype><collection/><C:calendar/></resourcetype><A:calendar-color>${farbe}</A:calendar-color><C:supported-calendar-component-set><comp name='${comp}' xmlns='urn:ietf:params:xml:ns:caldav'/></C:supported-calendar-component-set></prop><status>HTTP/1.1 200 OK</status></propstat></response>`;
http.createServer((req, res) => {
  const ok = req.headers.authorization === 'Basic ' + Buffer.from('test@example.com:abcd-efgh-ijkl-mnop').toString('base64');
  if (!ok) { res.writeHead(401); return res.end(); }
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    const u = req.url; const h = BERLIN();
    let body = '';
    if (req.method === 'PROPFIND' && u === '/') body = ms('<response><href>/</href><propstat><prop><current-user-principal><href>/123/principal/</href></current-user-principal></prop></propstat></response>');
    else if (req.method === 'PROPFIND' && u === '/123/principal/') body = ms('<response><href>/123/principal/</href><propstat><prop><C:calendar-home-set><href>http://127.0.0.1:4011/123/calendars/</href></C:calendar-home-set></prop></propstat></response>');
    else if (req.method === 'PROPFIND' && u === '/123/calendars/') body = ms('<response><href>/123/calendars/</href><propstat><prop><resourcetype><collection/></resourcetype></prop></propstat></response>'
      + kal('/123/calendars/privat/', 'Privat', '#1BADF8FF', 'VEVENT') + kal('/123/calendars/familie/', 'Familie Gneuß', '#FF9500FF', 'VEVENT') + kal('/123/calendars/erinnerungen/', 'Erinnerungen', '#CC73E1FF', 'VTODO'));
    else if (req.method === 'REPORT' && u === '/123/calendars/privat/') body = ms(
      [ev('p1', `${h}T100000`, `${h}T110000`, 'Abstimmung mit Carlotta'), ev('p2', '20250106T080000', '20250106T083000', 'Morgenrunde', 'RRULE:FREQ=DAILY\r\n')]
        .map((d, i) => `<response><href>/123/calendars/privat/${i}.ics</href><propstat><prop><C:calendar-data>${xml(d)}</C:calendar-data></prop></propstat></response>`).join(''));
    else if (req.method === 'REPORT' && u === '/123/calendars/familie/') body = ms(`<response><href>/123/calendars/familie/1.ics</href><propstat><prop><C:calendar-data>${xml(ev('f1', `${h}T163000`, `${h}T180000`, 'Laternenumzug'))}</C:calendar-data></prop></propstat></response>`);
    else { res.writeHead(404); return res.end(); }
    console.log('caldav', req.method, u);
    res.writeHead(207, { 'content-type': 'application/xml; charset=utf-8' }); res.end(body);
  });
}).listen(4011);
