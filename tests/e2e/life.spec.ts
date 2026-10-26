import { expect, test, type Page } from '@playwright/test';
import { TEST_ENV } from '../../playwright.config';
import { schritt, totp } from '../../lib/totp-core';

// Ein Durchlauf wie im echten Leben: einrichten, festhalten, sortieren lassen, abhaken, korrigieren,
// abmelden, wieder anmelden. Dazu die Schutzmechanismen, die nicht kaputtgehen dürfen.

test.describe.configure({ mode: 'serial' });

const EINTRAEGE = [
  'KGSt Angebot bis Freitag schicken',
  'Drei Geschichten von Behördenmenschen für die Plattform drehen',
  'Newsletter zum Plattform-Start an alle Fachbereiche',
  'Carlotta soll die Rechnungen der Boutique prüfen',
  'Mit Jonas über Content-Plan sprechen',
  'KGSt-Angebot rausschicken',
  'Alte Messe-Notizen Leipzig sortieren',
  'Mit den Kindern Laternen basteln',
  'Seneca: „Nicht wenig Zeit haben wir, sondern viel verschwenden wir.“',
  'Podcast mit Feuerwehr machen',
];

async function warteBisRuhig(page: Page, sekunden = 40) {
  await expect(page.locator('.working')).toHaveCount(0, { timeout: sekunden * 1000 });
}

test('Schutz: ohne Anmeldung keine Daten, falscher Schlüssel kein Erfassen, Sicherheits-Header', async ({ request }) => {
  expect((await request.get('/api/items')).status()).toBe(401);
  expect((await request.get('/api/checkin')).status()).toBe(401);
  expect((await request.get('/api/coach')).status()).toBe(401);
  expect((await request.post('/api/capture', { headers: { authorization: 'Bearer falsch' }, data: { text: 'x' } })).status()).toBe(401);
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true, db: 'ok' });
  const login = await request.get('/login');
  const h = login.headers();
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('no-referrer');
});

test('Ganzer Ablauf auf dem iPhone', async ({ page, context }) => {
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push('PAGEERR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('403')) fehler.push('CONSOLE ' + m.text()); });

  // Passkey wie Face ID: virtueller Authenticator im Browser
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });

  await test.step('Einrichten: falscher Code abgelehnt, richtiger Code legt Passkey an', async () => {
    await page.goto('/setup');
    await page.fill('#tok', 'falsch-falsch-falsch-falsch-x');
    await page.click('text=Passkey anlegen');
    await expect(page.locator('.err')).toContainText('Einrichtungscode stimmt nicht');
    await page.fill('#tok', TEST_ENV.SETUP_TOKEN);
    await page.click('text=Passkey anlegen');
    await page.waitForURL('/');
    await expect(page.locator('h1')).toContainText('Heute');
  });

  await test.step('Einstellungen: Engpass, Ziele, Team', async () => {
    await page.goto('/einstellungen');
    await expect(page.getByRole('button', { name: /Gespeichert/ }).first()).toBeVisible();
    await page.fill('#ktx', 'Engpass: Zu wenige Leute auf der Plattform, Content hochfahren\nPrioritäten: Projekte, Plattform, Boutique');
    await page.fill('#ziele', 'Projekte\nPlattform\nBoutique\nPrivat');
    await page.fill('#team', 'Carlotta: Fachbereiche, Vertrieb');
    await page.getByRole('button', { name: 'Speichern' }).first().click();
    await expect(page.getByRole('button', { name: /Gespeichert/ }).first()).toBeVisible();
  });

  await test.step('Festhalten und von Claude sortieren lassen', async () => {
    await page.goto('/');
    await expect(page.locator('.engpass')).toContainText('Content hochfahren');
    for (const t of EINTRAEGE) {
      await page.fill('.capture textarea', t);
      await page.locator('.capture button.btn.primary').click();
      await expect(page.locator('.capture button.btn.primary')).toContainText('Festgehalten');
    }
    await warteBisRuhig(page);
    await page.reload();
    await warteBisRuhig(page);
    const jetzt = page.locator('section[aria-label="Jetzt dran"] .ttitle');
    await expect(jetzt).toHaveCount(3);
    await expect(jetzt.first()).toContainText(/Newsletter|Behörden-Geschichten/);
  });

  await test.step('Nicht heute und Rückgängig', async () => {
    const erste = (await page.locator('section[aria-label="Jetzt dran"] .ttitle').first().innerText()).trim();
    await page.locator('section[aria-label="Jetzt dran"] .task').first().getByText('Nicht heute').click();
    await expect(page.locator('.toast')).toContainText('In die Woche geschoben');
    await page.locator('.toast button').click();
    await expect(page.locator('section[aria-label="Jetzt dran"]')).toContainText(erste);
  });

  await test.step('Abhaken', async () => {
    await page.locator('section[aria-label="Jetzt dran"] .tick').first().click();
    await expect(page.locator('.toast')).toContainText('Erledigt');
    await expect(page.locator('section[aria-label="Heute erledigt"]')).toBeVisible();
  });

  await test.step('Woche: Ziele, Stapel, Doppelte zusammengeführt', async () => {
    await page.goto('/woche');
    await warteBisRuhig(page);
    await expect(page.locator('section[aria-label="Bereiche"]')).toContainText('offen');
    await expect(page.locator('main')).toContainText('Delegieren');
    await expect(page.locator('main')).toContainText('an Carlotta');
    await expect(page.locator('main')).toContainText('Streichen vorgeschlagen');
    await expect(page.locator('.ttitle', { hasText: 'KGSt' })).toHaveCount(1);
    await page.locator('section[aria-label="Bereiche"]').getByRole('link', { name: /Ziele/ }).click();
    await page.waitForURL('/woche/ziele');
    await expect(page.locator('main')).toContainText('Plattform');
    expect((await page.request.get('/woche/gibtsnicht')).status()).toBe(404);
  });

  await test.step('Claude: abgeschnittene Antwort wird mit mehr Platz wiederholt', async () => {
    const r = await (await page.request.post('/api/items', { data: { text: 'Langer diktierter Gedanke zum ABSCHNEIDEN, Umfrage seitenweise statt scrollen' } })).json();
    await expect.poll(async () => { const it = await (await page.request.get(`/api/items/${r.id}`)).json(); return it.status === 'neu' && !it.fehler ? 'wartet' : (it.fehler ?? 'ok'); }, { timeout: 15000 }).toBe('ok');
  });

  await test.step('Eintrag öffnen und zurück', async () => {
    await page.goto('/');
    await page.locator('section[aria-label="Jetzt dran"] .ttitle').first().click();
    await expect(page.locator('main')).toContainText('Priorität');
    await expect(page.locator('.back')).toContainText('Heute');
    await page.locator('.back').click();
    await page.waitForURL('/');
  });

  await test.step('Logbuch mit Filter Erledigt', async () => {
    await page.goto('/archiv');
    await page.locator('.filters').getByText('Erledigt').click();
    await expect(page.locator('.log li')).toHaveCount(1);
  });

  await test.step('Keine Seite scrollt seitlich auf 390 px', async () => {
    for (const p of ['/', '/woche', '/koerper', '/koerper/training', '/koerper/ruhe', '/koerper/nacht', '/koerper/bewegung', '/koerper/essen', '/einstellungen/heute', '/geld', '/geld/monatlich', '/geld/sparen', '/kompass', '/menschen', '/mehr', '/archiv', '/einstellungen', '/wochenstart']) {
      await page.goto(p);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), p).toBeLessThanOrEqual(390);
    }
  });

  await test.step('Wochenbogen auf „Woche“: nur klickbar, Pflichtfragen zuerst', async () => {
    await page.goto('/woche');
    const bogen = page.locator('section[aria-label="Wochenbogen"]');
    await expect(bogen).toContainText('WHO-5');
    await expect(bogen.getByRole('button', { name: 'Fertig' })).toBeDisabled();
    for (const g of await bogen.getByRole('radiogroup').all()) await g.getByRole('radio').nth(3).click();
    await bogen.getByRole('button', { name: 'kleiner geworden' }).click();
    await bogen.getByRole('button', { name: 'Etwas dazu sagen' }).first().click();
    await bogen.locator('textarea').first().fill('Erfundene Testnotiz');
    await bogen.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('main')).toContainText('WHO-5) diese Woche: 60 von 100');
  });

  await test.step('Morgen und Abend per Schnittstelle, Coach antwortet mit echten Namen', async () => {
    expect((await page.request.post('/api/checkin', { data: { art: 'morgen', antworten: {} } })).status()).toBe(400);
    expect((await page.request.post('/api/checkin', { data: { art: 'morgen', antworten: { erholung: { wert: 4 } } } })).status()).toBe(200);
    expect((await page.request.post('/api/checkin', { data: { art: 'abend', antworten: { tag: { wert: 2 }, kraft: { auswahl: ['Termine', 'erfunden'] }, plan: { aufgabe: 'Newsletter schreiben', zeit: 'am Vormittag' } } } })).status()).toBe(200);
    await expect.poll(async () => (await (await page.request.get('/api/coach')).json()).morgen?.text ?? '', { timeout: 20_000 }).toContain('Newsletter');
    const c = await (await page.request.get('/api/coach')).json();
    expect(c.morgen.geste).toContain('Carlotta');
    expect(JSON.stringify(c)).not.toContain('[Person');
    expect(c.abend.text).toContain('Plan für morgen');
  });
  await test.step('Heute: Empfehlung mit einem Tipp, Coach zum Ansprechen', async () => {
    await page.goto('/');
    const em = page.locator('section[aria-label="Empfohlen für dich"] a.empfohlen');
    await expect(em).toBeVisible();
    expect(await em.getAttribute('href')).toMatch(/^\//);
    const coach = page.locator('section[aria-label="Coach"]');
    await coach.getByRole('button', { name: 'Ich bin müde' }).click();
    await expect(coach.locator('.chat-zeile.coach').last()).toContainText('NSDR');
    await coach.getByLabel('Nachricht an den Coach').fill('Soll Carlotta das Angebot übernehmen?');
    await coach.getByRole('button', { name: 'Senden' }).click();
    await expect(coach.locator('.chat-zeile.coach:not(.working)')).toHaveCount(2);
    await expect(coach.locator('.chat-zeile.ich').last()).toContainText('Carlotta');
    const v = await (await page.request.get('/api/coach/chat')).json();
    expect(v.verlauf.length).toBe(4);
    const prompts: string[] = await (await page.request.get('http://127.0.0.1:4010/prompts')).json();
    const chat = prompts.filter((x) => x.startsWith('COACH CHAT'));
    expect(chat.length).toBe(2);
    expect(chat.join(' ')).not.toContain('Carlotta');
    expect((await page.request.post('/api/coach/chat', { data: { text: '' } })).status()).toBe(400);
  });

  await test.step('Körper: WHOOP verbinden und abgleichen, Warnsignal bei kurzen Nächten', async () => {
    await page.goto('/koerper');
    await page.getByRole('link', { name: 'WHOOP verbinden' }).click();
    await page.waitForURL('/koerper');
    await expect(page.locator('.toast')).toContainText('WHOOP ist verbunden');
    await page.getByRole('button', { name: 'Jetzt abgleichen' }).click();
    await expect(page.locator('.nacht-karte')).toContainText('6:00');
    await expect(page.locator('.nacht-karte')).toContainText(/40\s?%/);
    await expect(page.locator('main')).toContainText('Drei Nächte unter 6,5 Stunden');
    await expect(page.locator('section[aria-label="Bereiche"]')).toContainText('40 Min.');
    await page.locator('.nacht-karte').click();
    await page.waitForURL('/koerper/nacht');
    await expect(page.locator('.werte')).toContainText('6:00');
    await page.goto('/koerper/bewegung');
    await expect(page.locator('main')).toContainText('40 / 180 Min.');
    await page.goto('/koerper/essen');
    await expect(page.locator('.gnote', { hasText: 'Ziel: 1,6 g' })).toContainText('82 kg');
    await page.goto('/koerper');
  });

  await test.step('Training: Satz abhaken, Pause, Feedback, Satzzahl steigt', async () => {
    await page.getByRole('link', { name: 'Krafteinheit starten' }).click();
    await page.waitForURL('/koerper/training');
    const beine = page.locator('section[aria-label="Goblet-Kniebeuge"]');
    await beine.getByRole('button', { name: 'Satz 1' }).click();
    await expect(page.locator('.pausebar')).toContainText('1:30');
    await page.locator('.pausebar').getByRole('button', { name: 'Weiter' }).click();
    await beine.getByRole('button', { name: 'Satz 2' }).click();
    await page.getByRole('button', { name: 'Einheit beenden' }).click();
    await page.getByRole('radiogroup', { name: 'Pump Beine' }).getByRole('radio', { name: 'wenig' }).click();
    await page.getByRole('radiogroup', { name: 'Muskelkater Beine' }).getByRole('radio', { name: 'kein Muskelkater' }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.locator('main')).toContainText('2 Sätze sind festgehalten');
    const plan = await (await page.request.get('/api/training')).json();
    expect(plan.stand.volumen.beine).toBe(3);
    await page.getByRole('link', { name: 'Zurück zu Körper' }).click();
    await expect(page.locator('main')).toContainText('1 / 3');
  });

  await test.step('Essen: Barcode per Nummer und Mahlzeit per Satz', async () => {
    await page.locator('section[aria-label="Bereiche"]').getByRole('link', { name: '+ Mahlzeit' }).click();
    await page.waitForURL('/koerper/essen');
    await page.getByRole('button', { name: 'Barcode scannen' }).click();
    await page.getByLabel('Barcode-Nummer').fill('4000000000001');
    await page.getByRole('button', { name: 'Suchen' }).click();
    await expect(page.locator('.produkt')).toContainText('Skyr natur');
    await expect(page.getByRole('radio', { name: '1 Portion (150 g)' })).toHaveAttribute('aria-checked', 'true');
    await page.locator('.produkt').getByRole('button', { name: 'Festhalten' }).click();
    await expect(page.locator('.essen-liste')).toContainText('Skyr natur');
    await expect(page.locator('.essen-liste')).toContainText('150 g');
    await page.fill('#essen-text', 'Bowl mit Hähnchen, Reis und Gemüse, große Portion');
    await page.getByRole('button', { name: 'Schätzen und festhalten' }).click();
    await expect(page.locator('.essen-liste')).toContainText('Bowl mit Hähnchen');
    await expect(page.locator('.essen-liste')).toContainText('40–55 g Protein');
    expect((await page.request.get('/api/essen/barcode?ean=12ab')).status()).toBe(400);
  });

  await test.step('Ruhe: Wim Hof erst nach Sicherheitsfragen, Stille läuft durch und zählt', async () => {
    await page.goto('/koerper/ruhe');
    const wh = page.locator('section[aria-label="Wim-Hof-Atmung"]');
    await expect(wh.getByRole('button', { name: 'Verstanden' })).toBeDisabled();
    for (const b of await wh.getByRole('group', { name: 'Sicherheit' }).getByRole('button').all()) await b.click();
    await wh.getByRole('button', { name: 'Verstanden' }).click();
    await expect(wh.getByRole('button', { name: 'Starten' })).toBeVisible();
    await page.clock.install();
    await page.reload();
    await page.locator('section[aria-label="Stille"]').getByRole('button', { name: 'Starten' }).click();
    await expect(page.locator('.ruhe-lauf')).toContainText('Stille');
    await page.clock.fastForward('05:02');
    await expect(page.locator('main')).toContainText('Die Minuten sind festgehalten');
    await expect(page.locator('header')).toContainText('5 Min. an 1 Tag');
  });

  await test.step('Geld: Töpfe anlegen, Ausgaben per Satz und Bon, Stufenplan, Taschengeld', async () => {
    await page.goto('/geld');
    await page.getByRole('button', { name: 'Töpfe anlegen' }).click();
    await expect(page.getByLabel('Ausgabe, zum Beispiel 12,50 Bäcker')).toBeVisible();
    await page.getByLabel('Ausgabe, zum Beispiel 12,50 Bäcker').fill('12,50 Bäcker');
    await page.getByRole('radiogroup', { name: 'Topf' }).getByRole('radio', { name: 'Alltag' }).click();
    await page.getByRole('button', { name: 'Festhalten' }).click();
    await expect(page.locator('section[aria-label="Zuletzt"] .buchung').first()).toContainText(/Bäcker.*12,50 €/);
    await page.getByRole('radiogroup', { name: 'Topf' }).getByRole('radio', { name: 'Claude ordnet zu' }).click();
    await page.getByLabel('Ausgabe, zum Beispiel 12,50 Bäcker').fill('Tanken 80');
    await page.getByRole('button', { name: 'Festhalten' }).click();
    await expect(page.locator('section[aria-label="Zuletzt"] .buchung').first()).toContainText(/Tanken.*80 €/);
    await expect(page.locator('main')).toContainText('Topf „Familie“ ist diese Woche 30 € über dem Rahmen');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await expect(page.locator('section[aria-label="Zuletzt"] .buchung').first()).toContainText(/Testmarkt.*23,45 €/);
    await expect(page.locator('section[aria-label="Diese Woche"] .kachel.topf')).toHaveCount(3);
    await expect(page.locator('section[aria-label="Bereiche"]')).toContainText('Stufenplan');
    await page.locator('section[aria-label="Bereiche"]').getByRole('link', { name: /Monatlich/ }).click();
    await page.waitForURL('/geld/monatlich');
    await page.getByLabel('Einnahmen: Name').fill('Gehalt');
    await page.getByLabel('Einnahmen: Betrag').fill('5000');
    await page.locator('section[aria-label="Monatlich"]').getByRole('button', { name: 'Hinzufügen' }).first().click();
    await page.goto('/geld/plan');
    await expect(page.locator('section[aria-label="Stufenplan"]')).toContainText('Stufe 3 von 7');
    await page.goto('/geld/taschengeld');
    await page.getByLabel('Kind: Name').fill('Testkind');
    await page.getByLabel('Kind: Betrag').fill('3');
    await page.locator('section[aria-label="Taschengeld"]').getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(page.locator('section[aria-label="Taschengeld"]')).toContainText('Testkind · 3 € pro Woche');
    await page.goto('/geld');
    await expect(page.locator('section[aria-label="Bereiche"]')).toContainText('Stufe 3');
    expect((await page.request.get('/geld/gibtsnicht')).status()).toBe(404);
    const c = await (await page.request.get('/api/coach')).json();
    expect(c.warnungen.join(' ')).toContain('Familie');
    const prompts: string[] = await (await page.request.get('http://127.0.0.1:4010/prompts')).json();
    expect(prompts.join(' ')).not.toContain('Testkind');
  });

  await test.step('Rückmeldung: klickbar, wird GitHub-Aufgabe mit Platzhaltern', async () => {
    await page.goto('/einstellungen');
    const r = page.locator('section[aria-label="Rückmeldung"]');
    await expect(r.getByRole('button', { name: 'Melden' })).toBeDisabled();
    await r.getByRole('radiogroup', { name: 'Art' }).getByRole('radio', { name: 'Fehler' }).click();
    await r.getByRole('radiogroup', { name: 'Bereich' }).getByRole('radio', { name: 'Geld' }).click();
    await r.getByRole('radiogroup', { name: 'Gewicht' }).getByRole('radio', { name: 'nervt' }).click();
    await r.getByLabel('Beschreibung').fill('Carlotta sieht den Topf doppelt');
    await r.getByRole('button', { name: 'Melden' }).click();
    await expect(page.locator('.toast')).toContainText('Aufgabe Nr. 42');
    await expect(r).toContainText('eingegangen · Nr. 42');
    const issues = await (await page.request.get('http://127.0.0.1:4010/issues')).json();
    expect(issues[0].auth).toBe('Bearer github-test-token');
    expect(issues[0].title).toContain('Fehler (Geld)');
    expect(JSON.stringify(issues[0])).not.toContain('Carlotta');
    expect(issues[0].labels).toContain('bug');
  });

  await test.step('Kompass: fünf Ringe, Level, Meilensteine aus echten Daten', async () => {
    await page.goto('/kompass');
    await expect(page.locator('.ringreihe .ringzelle')).toHaveCount(5);
    await expect(page.locator('section[aria-label="Körper"]')).toContainText('Kraft');
    await expect(page.locator('section[aria-label="Körper"]')).toContainText('1 / 3');
    await expect(page.locator('section[aria-label="Meilensteine"] .meilenstein.an')).toContainText(['Erste Krafteinheit']);
    await expect(page.locator('main')).toContainText('Punkte bis Level');
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Kompass/ })).toBeVisible();
  });

  await test.step('Darstellung: Hell wählen, bleibt nach dem Neuladen, Dunkel zurück', async () => {
    await page.goto('/einstellungen');
    const wahl = page.getByRole('radiogroup', { name: 'Darstellung' });
    await expect(wahl.getByRole('radio', { name: 'Dunkel' })).toHaveAttribute('aria-checked', 'true');
    await wahl.getByRole('radio', { name: 'Hell' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F2F1EC');
    await expect(page.locator('.tagespunkte li')).toHaveCount(7);
    if (process.env.SCREENSHOTS) for (const t of ['light', 'dark']) {
      await page.evaluate((x) => { document.documentElement.dataset.theme = x; }, t);
      for (const [p, n] of [['/', 'heute'], ['/koerper', 'koerper'], ['/koerper/ruhe', 'ruhe'], ['/kompass', 'kompass'], ['/einstellungen', 'einstellungen'], ['/geld', 'geld'], ['/mehr', 'mehr'], ['/menschen', 'menschen'], ['/woche', 'woche'], ['/einstellungen/heute', 'anpassen'], ['/geld/monatlich', 'geld-monatlich'], ['/wochenstart', 'wochenstart']]) {
        await page.context().addCookies([{ name: 'life-thema', value: t, url: new URL('/', page.url()).toString() }]);
        await page.goto(p); await page.waitForTimeout(500);
        await page.screenshot({ path: `test-results/design/${n}-${t}.png`, fullPage: true });
      }
    }
    await page.goto('/einstellungen');
    await page.getByRole('radiogroup', { name: 'Darstellung' }).getByRole('radio', { name: 'Dunkel' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  await test.step('Heute anpassen: Festhalten-Feld aus, Plus öffnet es, Körper kurz an, Standard zurück', async () => {
    await page.goto('/einstellungen/heute');
    await expect(page.getByRole('switch', { name: 'Jetzt dran anzeigen' })).toBeDisabled();
    await page.getByRole('switch', { name: 'Festhalten-Feld anzeigen' }).click();
    await page.getByRole('switch', { name: 'Körper kurz anzeigen' }).click();
    await expect(page.locator('section[aria-label="Angezeigt"]')).toContainText('Körper kurz');
    await page.getByRole('button', { name: 'Körper kurz nach oben' }).click();
    await page.goto('/');
    await expect(page.locator('section[aria-label="Festhalten"]')).toHaveCount(0);
    await expect(page.locator('section[aria-label="Körper kurz"]')).toContainText('Erholung');
    await page.getByRole('button', { name: 'Festhalten' }).first().click();
    await expect(page.locator('section[aria-label="Festhalten"] textarea')).toBeFocused();
    const r = await page.request.put('/api/heute/bausteine', { data: { bausteine: ['coach', '<script>', 'coach'] } });
    expect((await r.json()).bausteine).toEqual(['fragebogen', 'coach', 'jetzt']);
    await page.goto('/einstellungen/heute');
    await page.getByRole('button', { name: 'Zurück zum Standard' }).click();
    await expect(page.locator('section[aria-label="Angezeigt"]')).toContainText('Festhalten-Feld');
  });

  await test.step('Schnellzugriffe: Plus öffnet alle Wege, Essen führt zur Essen-Seite', async () => {
    await page.goto('/');
    const reihe = page.locator('section[aria-label="Schnellzugriffe"]');
    await reihe.getByRole('button', { name: 'Alle Wege zum Festhalten' }).click();
    const blatt = page.getByRole('dialog', { name: 'Festhalten' });
    await expect(blatt.getByRole('button')).toHaveCount(6);
    await page.keyboard.press('Escape');
    await expect(blatt).toHaveCount(0);
    await reihe.getByRole('link', { name: 'Ausgabe' }).click();
    await page.waitForURL('/geld');
    await expect(page.getByLabel('Ausgabe, zum Beispiel 12,50 Bäcker')).toBeFocused();
  });

  await test.step('iPad und Mac: Seitenleiste, Leiste oben, Inspektor, Tastatur', async () => {
    const alt = page.viewportSize()!;
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('.seitenleiste')).toBeVisible();
    await expect(page.locator('.tabbar')).toBeHidden();
    await expect(page.locator('.heute-spalten')).toBeVisible();
    await page.locator('.seitenleiste').getByRole('link', { name: 'Körper' }).click();
    await page.waitForURL('/koerper');
    await expect(page.locator('.seitenleiste a[aria-current="page"]')).toHaveText('Körper');
    await page.keyboard.press('Meta+k');
    await page.waitForURL('/archiv');
    await expect(page.getByLabel('Suchen')).toBeFocused();
    await page.locator('.mi-liste a[href^="/eintrag/"]').first().click();
    await expect(page).toHaveURL('/archiv');
    await expect(page.locator('.mi-rechts')).toContainText('Einordnung');
    if (process.env.SCREENSHOTS) for (const [g, w, h] of [['mac', 1280, 800], ['ipad', 834, 1112]] as const) {
      await page.setViewportSize({ width: w, height: h });
      for (const [p2, n] of [['/', 'heute'], ['/koerper', 'koerper'], ['/geld', 'geld'], ['/woche', 'woche'], ['/archiv', 'logbuch']]) {
        await page.goto(p2); await page.waitForTimeout(500);
        await page.screenshot({ path: `test-results/design/${g}-${n}.png` });
      }
    }
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.goto('/');
    await expect(page.locator('.tabpille')).toBeVisible();
    await page.getByRole('button', { name: 'Seitenleiste' }).click();
    await expect(page.locator('.seitenleiste')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.setViewportSize(alt);
  });

  await test.step('Menschen: anlegen, Kontakt mit Stunden, Vorschlag aus Einträgen', async () => {
    await page.goto('/menschen');
    await page.getByLabel('Name').fill('Testfreundin');
    await page.getByRole('radiogroup', { name: 'Kreis' }).getByRole('radio', { name: 'Freunde' }).click();
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    const freunde = page.locator('section[aria-label="Freunde"]');
    await expect(freunde).toContainText('Testfreundin');
    await freunde.getByRole('button', { name: 'Abend 3 Std.' }).click();
    await expect(freunde).toContainText('noch 47 Stunden bis zur nächsten Stufe');
    const vorschlag = page.locator('section[aria-label="Vorschläge"]');
    await expect(vorschlag).toContainText('Jonas');
    await vorschlag.getByRole('button', { name: 'Team' }).first().click();
    await expect(page.locator('section[aria-label="Team"]')).toContainText('Jonas');
  });

  await test.step('Zeit: Wenn-dann-Plan, Energie nach dem Abhaken, Zeit kaufen', async () => {
    await page.goto('/');
    const jetzt = page.locator('section[aria-label="Jetzt dran"] .task').first();
    await jetzt.getByRole('button', { name: 'Wenn …' }).click();
    await jetzt.getByRole('radiogroup', { name: 'Wann' }).getByRole('radio', { name: 'am Vormittag' }).click();
    await jetzt.getByRole('radiogroup', { name: 'Wo' }).getByRole('radio', { name: 'am Schreibtisch' }).click();
    await jetzt.getByRole('button', { name: 'Plan setzen' }).click();
    await expect(page.locator('.wenn-satz').first()).toContainText('Wenn es am Vormittag ist und ich am Schreibtisch bin, dann:');
    const erledigt = page.locator('section[aria-label="Heute erledigt"]');
    await erledigt.getByRole('radio', { name: 'gab Kraft' }).first().click();
    await expect(erledigt.getByRole('radio', { name: 'gab Kraft' }).first()).toHaveAttribute('aria-checked', 'true');
    await page.goto('/woche');
    await expect(page.locator('section[aria-label="Bereiche"]')).toContainText('1 : 0');
    await page.goto('/woche/energie');
    await expect(page.locator('section[aria-label="Energie-Bilanz"]')).toContainText('Gab dir Kraft');
    await page.goto('/woche/zeit-kaufen');
    await page.getByLabel('Was du abgeben könntest').fill('Fenster putzen');
    await page.getByRole('radio', { name: '2 Std. im Monat' }).click();
    await page.getByLabel('Kosten im Monat').fill('60');
    await page.getByRole('button', { name: 'Auf die Liste' }).click();
    await expect(page.locator('section[aria-label="Zeit kaufen"]')).toContainText('30 € pro gewonnene Stunde');
    const prompts: string[] = await (await page.request.get('http://127.0.0.1:4010/prompts')).json();
    expect(prompts.join(' ')).not.toContain('Testfreundin');
  });

  await test.step('Coach kennt das Warnsignal, Push nimmt nur echte Dienste', async () => {
    const c = await (await page.request.get('/api/coach')).json();
    expect(c.warnungen.join(' ')).toContain('Drei Nächte');
    const p = await (await page.request.get('/api/push')).json();
    expect(p.publicKey.length).toBeGreaterThan(60);
    expect((await page.request.post('/api/push', { data: { abo: { endpoint: 'https://evil.example/x', keys: { p256dh: 'a', auth: 'b' } } } })).status()).toBe(400);
    expect((await page.request.put('/api/push', { data: { verpasst: false, nachmittag: true, wochenstart: true } })).status()).toBe(200);
    const e = (await (await page.request.get('/api/push')).json()).einstellungen;
    expect([e.verpasst, e.nachmittag, e.wochenstart]).toEqual([false, true, true]);
    await page.goto('/einstellungen');
    await expect(page.locator('main')).toContainText('Mitteilungen');
  });

  await test.step('Wochenstart: Rückblick, Engpass, drei Dinge, Parkplatz, seitenweise', async () => {
    expect((await (await page.request.get('/api/coach')).json()).wochenstartOffen).toBe(true);
    await page.goto('/woche');
    await page.locator('.ws-banner').click();
    await page.waitForURL('/wochenstart');
    await expect(page.locator('main')).toContainText('Rückblick');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('radio', { name: 'Neu setzen' }).click();
    await page.getByLabel('Neuer Engpass').fill('Erfundener Engpass der Testwoche');
    await page.getByRole('button', { name: 'Weiter' }).click();
    const drei = page.getByRole('group', { name: 'Drei Dinge' }).getByRole('button');
    await drei.nth(0).click();
    await drei.nth(1).click();
    await expect(page.locator('main')).toContainText('2 von 3 gewählt');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.locator('main')).toContainText('Erfundener Engpass der Testwoche');
    await page.getByRole('button', { name: 'Wochenstart abschließen' }).click();
    await page.waitForURL(/\/woche/);
    await expect(page.locator('.toast')).toContainText('Wochenstart abgeschlossen');
    await expect(page.locator('section[aria-label="Drei Dinge der Woche"] .cell')).toHaveCount(2);
    await expect(page.locator('.engpass')).toContainText('Erfundener Engpass');
    await expect(page.locator('.ws-banner')).toHaveCount(0);
    expect((await (await page.request.get('/api/coach')).json()).wochenstartOffen).toBe(false);
    expect(await (await page.request.post('/api/wochenstart', { data: { aktion: 'fokus', ids: ['x; drop table'] } })).json()).toMatchObject({ ids: [] });
  });

  await test.step('Abmelden sperrt die Daten, Face ID öffnet sie wieder', async () => {
    await page.goto('/einstellungen');
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await page.waitForURL('/login');
    expect((await page.request.get('/api/items')).status()).toBe(401);
    await page.click('text=Mit Face ID anmelden');
    await page.waitForURL('/');
  });

  expect(fehler, fehler.join('\n')).toEqual([]);
});

test('Namen erreichen Claude nur als Platzhalter', async ({ request }) => {
  const prompts: string[] = await (await request.get('http://127.0.0.1:4010/prompts')).json();
  expect(prompts.length).toBeGreaterThan(5);
  for (const p of prompts) {
    expect(p).not.toContain('Carlotta');
    expect(p).not.toMatch(/\bPeter\b/);
  }
  // Jonas stand nicht im Team: Claude sieht ihn beim ersten Eintrag, danach nur noch als Platzhalter
  const ersterJonas = prompts.findIndex((p) => p.includes('Jonas'));
  expect(ersterJonas).toBeGreaterThanOrEqual(0);
  const spaeter = prompts.slice(ersterJonas + 1).filter((p) => p.startsWith('SORTIERLAUF'));
  expect(spaeter.length).toBeGreaterThan(0);
  for (const p of spaeter.slice(-1)) expect(p).not.toContain('Jonas');
});

test('Passwort und Code: einrichten ohne QR, anmelden, Code gilt nur einmal', async ({ page, request }) => {
  const PW = 'erfundenes-test-passwort-1234';
  let secret = ''; let setupSchritt = 0;

  await test.step('Einrichten mit kopierbarem Schlüssel', async () => {
    await page.goto('/setup');
    await page.getByRole('button', { name: 'Passwort und Code statt Passkey' }).click();
    await page.fill('#tok', TEST_ENV.SETUP_TOKEN);
    await page.fill('#pw', 'zu-kurz');
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    await page.fill('#pw', PW);
    await page.getByRole('button', { name: 'Weiter' }).click();
    secret = (await page.locator('.secret').innerText()).replace(/\s/g, '');
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    await page.fill('#code', '000000');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('.err')).toContainText('Code stimmt nicht');
    setupSchritt = schritt(Date.now());
    await page.fill('#code', totp(secret, setupSchritt * 30_000));
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForURL('/');
  });

  await test.step('Einstellungen zeigen den Status', async () => {
    await page.goto('/einstellungen');
    await expect(page.locator('.cell', { hasText: 'Passwort und Code' }).first()).toContainText('an');
  });

  await test.step('Abmelden, falscher Code abgelehnt, richtiger Code meldet an', async () => {
    await page.request.post('/api/auth/logout');
    await page.goto('/login');
    await page.getByRole('button', { name: 'Mit Passwort und Code anmelden' }).click();
    await page.fill('#pw', PW);
    await page.fill('#code', '123456');
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.locator('.err')).toContainText('Anmeldung fehlgeschlagen');
    // Der Code der Einrichtung ist verbraucht. Der nächste Zeitschritt liegt im erlaubten Fenster.
    const code = totp(secret, (setupSchritt + 1) * 30_000);
    await page.fill('#pw', PW);
    await page.fill('#code', code);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.waitForURL('/');
    const nochmal = await page.request.post('/api/auth/code/login', { data: { password: PW, code } });
    expect(nochmal.status()).toBe(401);
    const falschesPw = await page.request.post('/api/auth/code/login', { data: { password: 'falsch-falsch-falsch-1', code: totp(secret) } });
    expect(falschesPw.status()).toBe(401);
  });

  await test.step('Ohne Sitzung kein Status und kein Ausschalten', async () => {
    expect((await request.get('/api/auth/code')).status()).toBe(401);
    expect((await request.delete('/api/auth/code')).status()).toBe(401);
    expect((await request.post('/api/auth/code/start', { data: { token: 'falsch', password: 'x'.repeat(20) } })).status()).toBe(403);
  });
});

test('Kurzbefehl erfasst mit richtigem Schlüssel', async ({ request }) => {
  const r = await request.post('/api/capture', { headers: { authorization: `Bearer ${TEST_ENV.CAPTURE_TOKEN}`, 'content-type': 'text/plain' }, data: 'Vom Kurzbefehl diktiert' });
  expect(r.status()).toBe(200);
  expect(await r.text()).toBe('Festgehalten');
});

test('Begrenzung: nach 10 Einrichtungsversuchen ist Schluss', async ({ request }) => {
  const codes: number[] = [];
  for (let i = 0; i < 12; i++) codes.push((await request.post('/api/auth/register-options', { data: { token: 'falsch' } })).status());
  expect(codes).toContain(429);
});
