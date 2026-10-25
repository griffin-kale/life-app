// Attrappe für Amazon Bedrock in Tests: ordnet Einträge fest ein und sortiert nach Hebel.
// Start: node tests/e2e/mock-bedrock.mjs (Port 4010). Wird von playwright.config.ts automatisch gestartet.
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
  if (/Carlotta/.test(t)) return E({ titel: 'Boutique-Rechnungen', bereinigt: t, schritt: 'Boutique-Rechnungen prüfen lassen', ziel: 'Boutique', hebel: 0, aufwand_min: 15, wer: 'delegieren', delegieren_an: 'Carlotta' });
  if (/Jonas/.test(t)) return E({ titel: 'Content-Plan mit Jonas', bereinigt: t, schritt: 'Mit Jonas den Content-Plan abstimmen', ziel: 'Plattform', hebel: 2, aufwand_min: 15 });
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
http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    const body = JSON.parse(b || '{}');
    const p = body.messages?.[0]?.content || '';
    const a = p.startsWith('SORTIERLAUF') ? sortieren(p) : einordnen(p.split('Eintrag (oft diktiert, kann Füllwörter und Fehler enthalten):\n')[1] || '');
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: body.model || 'x', content: [{ type: 'text', text: JSON.stringify(a) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }));
    }, p.startsWith('SORTIERLAUF') ? 400 : 150);
    console.log('mock', p.startsWith('SORTIERLAUF') ? 'sort' : 'enrich', body.model);
  });
}).listen(4010);
