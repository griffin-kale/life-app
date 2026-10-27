import './test-env';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { signSession } from '../../lib/session';
import { sql as testSql } from '../../lib/db';
import { umschluesseln } from '../../lib/tresor';
import { aufschliessen } from '../../lib/passwort-core';
import { TEST_ENV } from '../../playwright.config';
import { schritt, totp } from '../../lib/totp-core';

// Schreibende Anfragen brauchen die Herkunft von Life (Schutz vor CSRF). Der Browser schickt sie selbst, die Test-Anfragen hier ausdrücklich.
const H = { origin: TEST_ENV.PUBLIC_ORIGIN };

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

/** Meldet einen Browser-Kontext an, wie es ein zweites Gerät nach Face ID wäre. Nur mit dem Testgeheimnis. */
async function anmelden(context: BrowserContext, userId = 'peter') {
  process.env.SESSION_SECRET = TEST_ENV.SESSION_SECRET;
  const sid = randomBytes(24).toString('base64url');
  const sql = postgres(TEST_ENV.DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql`insert into sitzungen (id, user_id) values (${sid}, ${userId})`;
  await sql.end();
  const { value } = await signSession({ sid, userId });
  await context.addCookies([{ name: 'life_session', value, url: TEST_ENV.PUBLIC_ORIGIN }]);
}

async function warteBisRuhig(page: Page, sekunden = 40) {
  await expect(page.locator('.working')).toHaveCount(0, { timeout: sekunden * 1000 });
}

test('Schutz: ohne Anmeldung keine Daten, falscher Schlüssel kein Erfassen, Sicherheits-Header', async ({ request, playwright }) => {
  expect((await request.get('/api/items')).status()).toBe(401);
  expect((await request.get('/api/checkin')).status()).toBe(401);
  expect((await request.get('/api/coach')).status()).toBe(401);
  for (const u of ['/api/stand', '/api/stand/1', '/api/kalender']) expect((await request.get(u)).status(), u).toBe(401);
  expect((await request.post('/api/kalender', { headers: H })).status()).toBe(401);
  // Ein Challenge-Cookie aus der offenen Anmeldung darf nie als Sitzung gelten
  const opt = await request.post('/api/auth/login-options', { headers: H });
  const ch = (opt.headers()['set-cookie'] || '').match(/life_challenge=([^;]+)/)?.[1];
  expect(ch).toBeTruthy();
  expect((await request.get('/api/export', { headers: { cookie: `life_session=${ch}` } })).status()).toBe(401);
  expect((await request.post('/api/capture', { headers: { authorization: 'Bearer falsch' }, data: { text: 'x' } })).status()).toBe(401);
  // CSRF: schreibende Anfragen nur mit der Herkunft von Life. Der Kurzbefehl mit Schlüssel braucht keine.
  expect((await request.post('/api/auth/login-options', { headers: { origin: 'https://boese.example' } })).status()).toBe(403);
  const ohne = await playwright.request.newContext({ baseURL: TEST_ENV.PUBLIC_ORIGIN });
  expect((await ohne.post('/api/auth/login-options')).status()).toBe(403);
  expect((await ohne.post('/api/items', { data: { text: 'x' } })).status()).toBe(403);
  expect((await ohne.post('/api/capture', { headers: { authorization: 'Bearer falsch' }, data: { text: 'x' } })).status()).toBe(401);
  await ohne.dispose();
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true, db: 'ok', zeitplan: 'aus', backup: 'aus', restore: 'aus' });
  const login = await request.get('/login');
  const h = login.headers();
  expect(h['content-security-policy']).toContain("default-src 'self'");
  const script = h['content-security-policy'].match(/script-src ([^;]*)/)?.[1] ?? '';
  expect(script).toMatch(/'nonce-[A-Za-z0-9+/=]{20,}'/);
  expect(script).toContain("'strict-dynamic'");
  expect(script).not.toContain('unsafe-inline');
  // Jede Antwort hat eine neue Nonce, und Nexts eigene Skripte tragen sie
  const nonce = script.match(/'nonce-([^']+)'/)![1];
  expect((await request.get('/login')).headers()['content-security-policy']).not.toContain(nonce);
  expect(await login.text()).toContain(`nonce="${nonce}"`);
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
    await expect(page.locator('.engpass-zeile')).toContainText('Content hochfahren');
    // Heute zeigt kein Feld mehr: die Leiste unten öffnet den Coach mit dem Feld
    await expect(page.locator('section[aria-label="Festhalten"]')).toHaveCount(0);
    await expect(page.locator('section[aria-label="Heute im Kalender"]')).toHaveCount(0);
    // Die Leiste wächst zum Feld (K1), „Gespräch öffnen“ zeigt das ganze Blatt
    await page.locator('.coach-leiste').click();
    const kurzFeld = page.getByRole('dialog', { name: 'Was geht dir durch den Kopf?' });
    await expect(kurzFeld.getByLabel('Was geht dir durch den Kopf?')).toBeFocused();
    await kurzFeld.getByRole('button', { name: 'Gespräch öffnen' }).click();
    const blatt = page.getByRole('dialog', { name: 'Coach' });
    const feld = blatt.getByLabel('Was geht dir durch den Kopf?');
    // Ein Feld, ein Knopf: Life hält fest, Claude erkennt Fragen an den Coach
    await expect(blatt.getByRole('button', { name: 'Coach fragen' })).toHaveCount(0);
    for (const t of EINTRAEGE) {
      await feld.fill(t);
      await blatt.getByRole('button', { name: 'Senden' }).click();
      await expect(feld).toHaveValue('');
    }
    // Spur im Gespräch: das Letzte steht unten, Ältere hinter „Ganzes Gespräch“
    await expect(blatt.locator('.chat-zeile.fest')).toHaveCount(4);
    await expect(blatt.locator('.chat-zeile.fest').last()).toContainText(EINTRAEGE.at(-1)!);
    await blatt.getByRole('button', { name: /Ganzes Gespräch/ }).click();
    // Die Sortierung im Hintergrund darf die beiden KGSt-Einträge schon zusammengeführt haben: dann einer weniger
    await expect(blatt.locator('.chat-zeile.fest').filter({ hasText: 'Podcast mit Feuerwehr' })).toHaveCount(1);
    expect([EINTRAEGE.length - 1, EINTRAEGE.length]).toContain(await blatt.locator('.chat-zeile.fest').count());
    for (const t of EINTRAEGE.filter((t) => !t.includes('KGSt'))) await expect(blatt.locator('.chat-zeile.fest').filter({ hasText: t })).toHaveCount(1);
    if (process.env.SCREENSHOTS) await page.screenshot({ path: 'test-results/design/coach-blatt.png' });
    await page.keyboard.press('Escape');
    await expect(blatt).toHaveCount(0);
    await warteBisRuhig(page);
    await page.reload();
    await warteBisRuhig(page);
    // The ONE Thing: eine Sache groß, die anderen zwei zugeklappt unter „Danach“
    await expect(page.locator('section[aria-label="Die eine Sache"] .es-titel')).toContainText(/Newsletter|Behörden-Geschichten/);
    await expect(page.locator('section[aria-label="Danach"] .ak-zeile')).toContainText('2');
    await expect(page.locator('section[aria-label="Danach"] .task')).toHaveCount(0);
    await expect(page.locator('.tgrund')).toHaveCount(0);
    // Der Engpass steht als eine Zeile über der einen Sache, ohne Erklärung
    await expect(page.locator('.engpass-zeile')).not.toContainText('Zahlt ein');
    if (process.env.SCREENSHOTS) await page.screenshot({ path: 'test-results/design/heute-iphone.png' });
  });

  await test.step('Nicht heute und Rückgängig', async () => {
    const sache = page.locator('section[aria-label="Die eine Sache"]');
    const erste = (await sache.locator('.es-titel').innerText()).trim();
    await sache.getByRole('button', { name: 'Mehr zu dieser Sache' }).click();
    await page.getByRole('dialog', { name: 'Mehr zu dieser Sache' }).getByRole('button', { name: 'Nicht heute' }).click();
    await expect(page.locator('.toast')).toContainText('In die Woche geschoben');
    await page.locator('.toast button').click();
    await expect(sache.locator('.es-titel')).toHaveText(erste);
    // Eine andere Sache nach vorn holen und wieder zurück
    await page.locator('section[aria-label="Danach"] .ak-zeile').click();
    const zweite = (await page.locator('section[aria-label="Danach"] .ttitle').first().innerText()).trim();
    await page.locator('section[aria-label="Danach"] .task').first().getByRole('button', { name: 'Zur einen Sache' }).click();
    await expect(sache.locator('.es-titel')).toHaveText(zweite);
    await page.locator('section[aria-label="Danach"] .task', { hasText: erste }).getByRole('button', { name: 'Zur einen Sache' }).click();
    await expect(sache.locator('.es-titel')).toHaveText(erste);
  });

  await test.step('Abhaken', async () => {
    await page.locator('section[aria-label="Die eine Sache"]').getByRole('button', { name: 'Erledigt' }).click();
    await expect(page.locator('.toast')).toContainText('Erledigt');
    await expect(page.locator('section[aria-label="Heute erledigt"] .ak-zeile')).toContainText('1');
  });

  await test.step('Woche: Kalender, Rhythmen, Stapel, Doppelte zusammengeführt', async () => {
    await page.goto('/woche');
    await warteBisRuhig(page);
    // Life 2.0: sieben Tage, Rhythmen mit fünf Konten, keine Kacheln mit Nullen mehr
    await expect(page.locator('section[aria-label="Kalender"]')).toBeVisible();
    await expect(page.locator('section[aria-label="Rhythmen"] .rh-zeile')).toHaveCount(5);
    await expect(page.locator('section[aria-label="Rhythmen"]')).toContainText('Aufgabe');
    await expect(page.locator('section[aria-label="Bereiche"]')).toHaveCount(0);
    await expect(page.locator('section[aria-label="Mehr zur Woche"]')).toContainText('Parkplatz');
    await expect(page.locator('main')).toContainText('Delegieren');
    await expect(page.locator('main')).toContainText('an Carlotta');
    await expect(page.locator('main')).toContainText('Streichen vorgeschlagen');
    await expect(page.locator('.ttitle', { hasText: 'KGSt' })).toHaveCount(1);
    await page.goto('/woche/ziele');
    await expect(page.locator('main')).toContainText('Plattform');
    // Ziele als eigener Tab: Ziele mit Fortschritt, Kompass und Dein Stand
    await page.locator('.tabbar').getByRole('link', { name: 'Ziele' }).click();
    await page.waitForURL('/ziele');
    await expect(page.locator('section[aria-label="Deine Ziele"]')).toContainText('Plattform');
    await expect(page.locator('main')).toContainText('Dein Stand');
    expect((await page.request.get('/woche/gibtsnicht')).status()).toBe(404);
  });

  await test.step('Claude: abgeschnittene Antwort wird mit mehr Platz wiederholt', async () => {
    const r = await (await page.request.post('/api/items', { headers: H, data: { text: 'Langer diktierter Gedanke zum ABSCHNEIDEN, Umfrage seitenweise statt scrollen' } })).json();
    await expect.poll(async () => { const it = await (await page.request.get(`/api/items/${r.id}`)).json(); return it.status === 'neu' && !it.fehler ? 'wartet' : (it.fehler ?? 'ok'); }, { timeout: 15000 }).toBe('ok');
  });

  await test.step('Eintrag öffnen und zurück', async () => {
    await page.goto('/');
    await page.locator('section[aria-label="Die eine Sache"] .es-titel').click();
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
    for (const p of ['/', '/woche', '/koerper', '/koerper/training', '/koerper/ruhe', '/koerper/nacht', '/koerper/bewegung', '/koerper/essen', '/einstellungen/heute', '/geld', '/geld/monatlich', '/geld/sparen', '/kompass', '/menschen', '/ich', '/ziele', '/archiv', '/einstellungen', '/wochenstart', '/stand', '/stand/1']) {
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
    // Wohlbefinden steht nur da, wenn es niedrig ist (60 ist es nicht)
    await expect(bogen).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('60 von 100');
  });

  await test.step('Morgen und Abend per Schnittstelle, Coach antwortet mit echten Namen', async () => {
    expect((await page.request.post('/api/checkin', { headers: H, data: { art: 'morgen', antworten: {} } })).status()).toBe(400);
    expect((await page.request.post('/api/checkin', { headers: H, data: { art: 'morgen', antworten: { erholung: { wert: 4 } } } })).status()).toBe(200);
    expect((await page.request.post('/api/checkin', { headers: H, data: { art: 'abend', antworten: { tag: { wert: 2 }, kraft: { auswahl: ['Termine', 'erfunden'] }, plan: { aufgabe: 'Newsletter schreiben', zeit: 'am Vormittag' } } } })).status()).toBe(200);
    await expect.poll(async () => (await (await page.request.get('/api/coach')).json()).morgen?.text ?? '', { timeout: 20_000 }).toContain('Newsletter');
    // Morgen und Abend entstehen nacheinander im Hintergrund
    await expect.poll(async () => (await (await page.request.get('/api/coach')).json()).abend?.text ?? '', { timeout: 20_000 }).toContain('Plan für morgen');
    const c = await (await page.request.get('/api/coach')).json();
    expect(c.morgen.geste).toContain('Carlotta');
    expect(JSON.stringify(c)).not.toContain('[Person');
    expect(c.abend.text).toContain('Plan für morgen');
  });
  await test.step('Heute: Cockpit, Tagesstreifen, Konten, Coach zum Ansprechen', async () => {
    await page.goto('/');
    // Life 2.0 (Richtung B mit Tagesstreifen): drei Kacheln, als Nächstes, je Konto eine Zeile
    await expect(page.locator('section[aria-label="Cockpit"] .ck-kachel')).toHaveCount(3);
    await expect(page.locator('section[aria-label="Als Nächstes"]')).toBeVisible();
    await expect(page.locator('section[aria-label="Konten heute"] .ck-konto')).toHaveCount(5);
    await expect(page.locator('section[aria-label="Empfohlen für dich"]')).toHaveCount(0);
    await expect(page.locator('section[aria-label="Schnellzugriffe"]')).toHaveCount(0);
    const ck = await (await page.request.get('/api/heute/cockpit')).json();
    expect(ck.konten.map((k: { konto: string }) => k.konto)).toEqual(['zeit', 'koerper', 'mental', 'sozial', 'geld']);
    // Ein normaler Gedanke im kurzen Feld: festgehalten, das Feld geht zu
    await page.locator('.coach-leiste').click();
    const kurz = page.getByRole('dialog', { name: 'Was geht dir durch den Kopf?' });
    await kurz.getByLabel('Was geht dir durch den Kopf?').fill('Erfundene Idee für den Herbst');
    await kurz.getByRole('button', { name: 'Senden' }).click();
    await expect(page.locator('.toast')).toContainText('Festgehalten');
    await expect(kurz).toHaveCount(0);
    // Eine Frage im kurzen Feld: Claude erkennt sie, der Coach antwortet im Gespräch
    await page.locator('.coach-leiste').click();
    await kurz.getByLabel('Was geht dir durch den Kopf?').fill('Ich bin müde, was jetzt?');
    if (process.env.SCREENSHOTS) await page.screenshot({ path: 'test-results/design/coach-feld.png' });
    await kurz.getByRole('button', { name: 'Senden' }).click();
    const coach = page.getByRole('dialog', { name: 'Coach' });
    await expect(coach.locator('.chat-zeile.coach').last()).toContainText('NSDR');
    if (process.env.SCREENSHOTS) await page.screenshot({ path: 'test-results/design/coach-antwort.png' });
    // Die Frage landet nicht in den Stapeln
    const offen: { text: string }[] = (await (await page.request.get('/api/heute')).json()).items;
    expect(offen.some((i) => i.text.includes('Ich bin müde'))).toBe(false);
    await coach.getByLabel('Was geht dir durch den Kopf?').fill('Soll Carlotta das Angebot übernehmen, was jetzt?');
    await coach.getByRole('button', { name: 'Senden' }).click();
    await expect(coach.locator('.chat-zeile.coach:not(.working)')).toHaveCount(2);
    await expect(coach.locator('.chat-zeile.ich').last()).toContainText('Carlotta');
    const v = await (await page.request.get('/api/coach/chat')).json();
    expect(v.verlauf.length).toBe(4);
    const prompts: string[] = await (await page.request.get('http://127.0.0.1:4010/prompts')).json();
    const chat = prompts.filter((x) => x.startsWith('COACH CHAT'));
    expect(chat.length).toBe(2);
    expect(chat.join(' ')).not.toContain('Carlotta');
    expect((await page.request.post('/api/coach/chat', { headers: H, data: { text: '' } })).status()).toBe(400);
  });

  await test.step('Körper: WHOOP verbinden und abgleichen, Warnsignal bei kurzen Nächten', async () => {
    await page.goto('/koerper');
    await page.getByRole('link', { name: 'WHOOP verbinden' }).click();
    await page.waitForURL('/koerper');
    await expect(page.locator('.toast')).toContainText('WHOOP ist verbunden');
    await expect(page.locator('main')).not.toContainText('Abgeglichen');
    await page.goto('/koerper/nacht');
    await page.getByRole('button', { name: 'Jetzt abgleichen' }).click();
    await expect(page.locator('main')).toContainText('6:00');
    await page.goto('/koerper');
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
    // Der Knopf auf Körper steht nur an Trainingstagen. Der Test läuft an jedem Wochentag, deshalb direkt zur Einheit.
    await page.goto('/koerper/training');
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
    await page.getByRole('button', { name: 'Festhalten', exact: true }).click();
    await expect(page.locator('section[aria-label="Zuletzt"] .buchung', { hasText: 'Bäcker' })).toContainText('12,50 €');
    await page.getByRole('radiogroup', { name: 'Topf' }).getByRole('radio', { name: 'Claude ordnet zu' }).click();
    await page.getByLabel('Ausgabe, zum Beispiel 12,50 Bäcker').fill('Tanken 80');
    await page.getByRole('button', { name: 'Festhalten', exact: true }).click();
    await expect(page.locator('section[aria-label="Zuletzt"] .buchung', { hasText: 'Tanken' })).toContainText('80 €');
    await expect(page.locator('main')).toContainText('Topf „Familie“ ist diese Woche 30 € über dem Rahmen');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    // Phase 3: Der Bon wird vor dem Senden zugeschnitten, nur der Streifen geht an Claude
    const zuschnitt = page.getByRole('dialog', { name: 'Bon zuschneiden' });
    await expect(zuschnitt).toBeVisible();
    await zuschnitt.getByRole('button', { name: 'Obere Kante, mit Pfeiltasten verschieben' }).press('ArrowDown');
    await zuschnitt.getByRole('button', { name: 'Ausschnitt senden' }).click();
    await expect(page.locator('section[aria-label="Zuletzt"] .buchung', { hasText: 'Testmarkt' })).toContainText('23,45 €');
    await expect(page.locator('section[aria-label="Diese Woche"] .kachel.topf')).toHaveCount(3);
    await expect(page.locator('section[aria-label="Bereiche"]')).toContainText('Stufenplan');
    await page.locator('section[aria-label="Bereiche"]').getByRole('link', { name: /Frei pro Monat/ }).click();
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
    // 0.23: Zielsumme eines Sparziels ändern, in der App und über den Coach
    await page.goto('/geld/sparen');
    const spar = page.locator('section[aria-label="Sparziele"]');
    await page.getByLabel('Sparziel: Name').fill('Testurlaub');
    await page.getByLabel('Sparziel: Betrag').fill('1000');
    await spar.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(spar).toContainText('von 1.000 €');
    await spar.getByRole('button', { name: 'Ziel ändern' }).click();
    await page.getByLabel('Ziel für Testurlaub: Betrag').fill('1500');
    await spar.getByRole('button', { name: 'Speichern' }).click();
    await expect(spar).toContainText('von 1.500 €');
    await page.request.post('/api/coach/chat', { headers: H, data: { text: 'Setz mein Sparziel Testurlaub auf 2000 Euro' } });
    let verlauf: { text: string }[] = (await (await page.request.get('/api/coach/chat')).json()).verlauf;
    expect(verlauf.at(-1)!.text).toBe('✓ Gespeichert: Ziel für „Testurlaub“ ist jetzt 2.000 €.');
    await page.reload();
    await expect(spar).toContainText('von 2.000 €');
    await page.request.post('/api/coach/chat', { headers: H, data: { text: 'Setz mein Sparziel Mondreise auf 5000 Euro' } });
    verlauf = (await (await page.request.get('/api/coach/chat')).json()).verlauf;
    expect(verlauf.at(-1)!.text).toMatch(/^Nicht geändert: Ein Sparziel mit diesem Namen gibt es nicht/);
    // Entscheidungen gehen an das stärkste Modell
    await page.request.post('/api/coach/chat', { headers: H, data: { text: 'Soll ich mehr sparen oder zuerst tilgen?' } });
    const modelle: string[] = await (await page.request.get('http://127.0.0.1:4010/modelle')).json();
    expect(modelle.at(-1)).toBe('claude-opus-5-5');
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
    // Konten zugeklappt: Ring, Prozent, Level. Details eine Ebene tiefer
    await expect(page.locator('details[aria-label="Körper"] .konto-mehr')).toBeHidden();
    await page.locator('details[aria-label="Körper"] summary').click();
    await expect(page.locator('details[aria-label="Körper"]')).toContainText('Kraft');
    await expect(page.locator('details[aria-label="Körper"]')).toContainText('1 / 3');
    await expect(page.locator('details[aria-label="Meilensteine"] .meilenstein.an')).toContainText(['Erste Krafteinheit']);
    await expect(page.locator('main')).toContainText('Punkte bis Level');
    await page.goto('/ziele');
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
    await expect(page.getByRole('region', { name: 'Cockpit' })).toBeVisible();
    if (process.env.SCREENSHOTS) for (const t of ['light', 'dark']) {
      await page.evaluate((x) => { document.documentElement.dataset.theme = x; }, t);
      for (const [p, n] of [['/', 'heute'], ['/koerper', 'koerper'], ['/koerper/ruhe', 'ruhe'], ['/kompass', 'kompass'], ['/einstellungen', 'einstellungen'], ['/geld', 'geld'], ['/ich', 'ich'], ['/ziele', 'ziele'], ['/menschen', 'menschen'], ['/woche', 'woche'], ['/einstellungen/heute', 'anpassen'], ['/geld/monatlich', 'geld-monatlich'], ['/wochenstart', 'wochenstart'], ['/stand', 'stand'], ['/stand/1', 'stand-etappe']]) {
        await page.context().addCookies([{ name: 'life-thema', value: t, url: new URL('/', page.url()).toString() }]);
        await page.goto(p); await page.waitForTimeout(500);
        await page.screenshot({ path: `test-results/design/${n}-${t}.png`, fullPage: true });
      }
    }
    await page.goto('/einstellungen');
    await page.getByRole('radiogroup', { name: 'Darstellung' }).getByRole('radio', { name: 'Dunkel' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  await test.step('Heute anpassen: Festhalten-Feld dazu, Körper kurz an, Standard zurück', async () => {
    await page.goto('/einstellungen/heute');
    await expect(page.getByRole('switch', { name: 'Die eine Sache anzeigen' })).toBeDisabled();
    await expect(page.locator('section[aria-label="Angezeigt"]')).not.toContainText('Coach');
    await page.getByRole('switch', { name: 'Festhalten-Feld anzeigen' }).click();
    await page.getByRole('switch', { name: 'Körper kurz anzeigen' }).click();
    await expect(page.locator('section[aria-label="Angezeigt"]')).toContainText('Körper kurz');
    await page.getByRole('button', { name: 'Körper kurz nach oben' }).click();
    await page.goto('/');
    await page.locator('section[aria-label="Festhalten"] textarea').fill('Erfundener Gedanke aus dem Feld');
    await page.locator('section[aria-label="Festhalten"]').getByRole('button', { name: 'Festhalten' }).click();
    await expect(page.locator('section[aria-label="Festhalten"] button.btn.primary')).toContainText('Festgehalten');
    await expect(page.locator('section[aria-label="Körper kurz"]')).toContainText('Erholung');
    // Der alte Baustein „coach“ ist kein Baustein mehr und fällt raus
    const r = await page.request.put('/api/heute/bausteine', { headers: H, data: { bausteine: ['coach', 'naechste', '<script>', 'naechste'] } });
    expect((await r.json()).bausteine).toEqual(['fragebogen', 'naechste', 'jetzt']);
    await page.goto('/einstellungen/heute');
    await page.getByRole('button', { name: 'Zurück zum Standard' }).click();
    await expect(page.locator('section[aria-label="Angezeigt"]')).toContainText('Cockpit');
    await expect(page.locator('section[aria-label="Angezeigt"]')).not.toContainText('Festhalten-Feld');
  });

  await test.step('Leiste: vier Tabs, Festhalten in der Mitte, Halten öffnet sechs Wege', async () => {
    await page.goto('/woche');
    const leiste = page.locator('.tabbar');
    for (const n of ['Heute', 'Woche', 'Ziele', 'Ich']) await expect(leiste.getByRole('link', { name: n })).toBeVisible();
    // Ich ersetzt Mehr, Körper und Geld liegen als Konten darunter
    await leiste.getByRole('link', { name: 'Ich' }).click();
    await page.waitForURL('/ich');
    await expect(page.locator('section[aria-label="Konten"] .ich-konto')).toHaveCount(5);
    expect(new URL((await page.goto('/mehr'))!.url()).pathname).toBe('/ich');
    // Ein Tipp auf die Mitte hält einen Gedanken fest, auch von einer anderen Seite aus
    const plus = leiste.getByRole('button', { name: 'Gedanke festhalten' });
    await plus.click();
    await page.waitForURL('/');
    await expect(page.getByRole('dialog', { name: 'Was geht dir durch den Kopf?' }).getByLabel('Was geht dir durch den Kopf?')).toBeFocused();
    await page.keyboard.press('Escape');
    // Halten öffnet die sechs schnellen Wege
    await plus.hover();
    await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
    const schnell = page.getByRole('dialog', { name: 'Schnell festhalten' });
    await expect(schnell.getByRole('button')).toHaveCount(6);
    if (process.env.SCREENSHOTS) await page.screenshot({ path: 'test-results/design/leiste-plus.png' });
    await page.keyboard.press('Escape');
    await expect(schnell).toHaveCount(0);
    await plus.hover();
    await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
    await schnell.getByRole('button', { name: 'Ausgabe' }).click();
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
    // Auf dem Mac steht der Coach fest rechts, N springt ins Feld
    const panel = page.locator('aside[aria-label="Coach"]');
    await expect(panel).toBeVisible();
    await expect(page.locator('.coach-leiste')).toHaveCount(0);
    await page.locator('h1').click();
    await page.keyboard.press('n');
    await expect(panel.getByLabel('Was geht dir durch den Kopf?')).toBeFocused();
    await page.locator('h1').click();
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
    await page.locator('section[aria-label="Die eine Sache"]').getByRole('button', { name: 'Mehr zu dieser Sache' }).click();
    const menue = page.getByRole('dialog', { name: 'Mehr zu dieser Sache' });
    await menue.getByRole('button', { name: 'Wenn …' }).click();
    await menue.getByRole('radiogroup', { name: 'Wann' }).getByRole('radio', { name: 'am Vormittag' }).click();
    await menue.getByRole('radiogroup', { name: 'Wo' }).getByRole('radio', { name: 'am Schreibtisch' }).click();
    await menue.getByRole('button', { name: 'Plan setzen' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.es-wenn')).toContainText('Wenn es am Vormittag ist und ich am Schreibtisch bin, dann:');
    const erledigt = page.locator('section[aria-label="Heute erledigt"]');
    await erledigt.locator('.ak-zeile').click();
    await erledigt.getByRole('radio', { name: 'gab Kraft' }).first().click();
    await expect(erledigt.getByRole('radio', { name: 'gab Kraft' }).first()).toHaveAttribute('aria-checked', 'true');
    await page.goto('/woche');
    await expect(page.locator('section[aria-label="Mehr zur Woche"]')).toContainText('1 gaben Kraft, 0 kosteten Kraft');
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
    expect((await page.request.post('/api/push', { headers: H, data: { abo: { endpoint: 'https://evil.example/x', keys: { p256dh: 'a', auth: 'b' } } } })).status()).toBe(400);
    expect((await page.request.put('/api/push', { headers: H, data: { verpasst: false, nachmittag: true, wochenstart: true } })).status()).toBe(200);
    const e = (await (await page.request.get('/api/push')).json()).einstellungen;
    expect([e.verpasst, e.nachmittag, e.wochenstart]).toEqual([false, true, true]);
    await page.goto('/einstellungen');
    await expect(page.locator('main')).toContainText('Mitteilungen');
  });

  await test.step('Kalender: iCloud lesen, Familie geschützt, Coach sieht nur Platzhalter', async () => {
    await page.goto('/einstellungen');
    const k = page.locator('section[aria-label="Kalender"]');
    await k.getByRole('button', { name: 'Kalender suchen' }).click();
    await expect(page.locator('.toast')).toContainText('2 Kalender');
    await expect(k).toContainText('Privat');
    await expect(k.getByLabel('Art von Familie Gneuß')).toHaveValue('familie');
    await expect(k).not.toContainText('Erinnerungen');
    // Der ganze Tag ist kein Standard mehr auf Heute, lässt sich aber dazuschalten
    const std = (await (await page.request.get('/api/heute/bausteine')).json()).bausteine;
    await page.request.put('/api/heute/bausteine', { headers: H, data: { bausteine: [...std, 'kalender'] } });
    await page.goto('/');
    const heute = page.locator('section[aria-label="Heute im Kalender"]');
    await expect(heute).toContainText('Abstimmung mit Carlotta');
    await expect(heute).toContainText('Laternenumzug');
    await expect(heute).toContainText('08:00');
    await page.locator('.coach-leiste').click();
    await page.getByRole('dialog', { name: 'Was geht dir durch den Kopf?' }).getByRole('button', { name: 'Gespräch öffnen' }).click();
    const coach = page.getByRole('dialog', { name: 'Coach' });
    const vorher = (await (await page.request.get('/api/coach/chat')).json()).verlauf.length;
    await coach.getByLabel('Was geht dir durch den Kopf?').fill('Wann passt das Angebot heute, was jetzt?');
    await coach.getByRole('button', { name: 'Senden' }).click();
    await expect(coach.locator('.chat-zeile.working')).toHaveCount(0);
    await expect.poll(async () => (await (await page.request.get('/api/coach/chat')).json()).verlauf.length).toBe(vorher + 2);
    const prompts: string[] = await (await page.request.get('http://127.0.0.1:4010/prompts')).json();
    const letzter = prompts.filter((x) => x.startsWith('COACH CHAT')).at(-1)!;
    expect(letzter).toContain('16:30–18:00 Familie (geschützt');
    expect(letzter).toMatch(/10:00–11:00 Abstimmung mit \[Person \d+\]/);
    expect(letzter).not.toContain('Laternenumzug');
    // Phase 3: Coach und Sortierlauf bekommen kein Datum, nur Wochentag und relative Fristen
    const mitDatum = prompts.filter((x) => /^(COACH|SORTIERLAUF)/.test(x) && /\d{4}-\d{2}-\d{2}|\d{1,2}\. (Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/.test(x));
    expect(mitDatum).toEqual([]);
    expect(letzter).not.toContain('Carlotta');
    // Ausgeschaltet zählt der Kalender nicht mehr
    await page.goto('/einstellungen');
    await page.getByRole('switch', { name: 'Familie Gneuß einbeziehen' }).click();
    await expect(page.getByRole('switch', { name: 'Familie Gneuß einbeziehen' })).toHaveAttribute('aria-checked', 'false');
    await page.goto('/');
    await expect(page.locator('section[aria-label="Heute im Kalender"]')).not.toContainText('Laternenumzug');
    await page.goto('/einstellungen');
    await page.getByRole('switch', { name: 'Familie Gneuß einbeziehen' }).click();
    await expect(page.locator('.toast')).toContainText('Termine abgeglichen');
  });

  await test.step('Standortbestimmung: drei Etappen, frei erzählt, Vorschläge übernehmen', async () => {
    expect((await (await page.request.get('/api/coach')).json()).standortEtappe).toBe(1);
    await page.goto('/');
    await page.locator('.coach-leiste').click();
    await page.getByRole('dialog', { name: 'Was geht dir durch den Kopf?' }).getByRole('button', { name: 'Gespräch öffnen' }).click();
    await page.getByRole('dialog', { name: 'Coach' }).getByRole('link', { name: 'Standortbestimmung' }).click();
    await page.waitForURL('/stand/1');
    const seiten = page.locator('.bl-seite');
    await expect(seiten).toHaveCount(6);
    for (let i = 0; i < 5; i++) {
      await seiten.nth(i).getByRole('radio', { name: String(i + 3) }).click();
      await seiten.nth(i).locator('textarea').fill(i === 1 ? 'Mehr Zeit mit Carlotta und dem Team, ohne Bildschirm' : 'Erfundene Testantwort zu diesem Bereich');
    }
    await page.getByRole('button', { name: 'Auswerten lassen' }).click();
    await expect(page.locator('main')).toContainText('Das habe ich gehört');
    await expect(page.locator('section[aria-label="Vorschlag Fokus"]')).toContainText('Zeit');
    await page.locator('section[aria-label="Vorschlag Fokus"]').getByRole('button', { name: 'Übernehmen' }).click();
    await expect(page.locator('section[aria-label="Vorschlag Fokus"]')).toContainText('Übernommen');
    await page.getByRole('link', { name: 'Weiter zu Etappe 2' }).click();
    await page.waitForURL('/stand/2');
    const werte = page.getByRole('group', { name: /Welche drei Werte/ });
    for (const w of ['Familie', 'Mut', 'Wirkung']) await werte.getByRole('button', { name: w }).click();
    await expect(werte.getByRole('button', { name: 'Ruhe' })).toBeDisabled();
    await page.getByLabel(/Es ist ein Jahr später/).fill('Erfundenes Jahresbild für den Test');
    await page.getByRole('button', { name: 'Auswerten lassen' }).click();
    await expect(page.locator('.st-vorschlag')).toHaveCount(4);
    for (let i = 0; i < 4; i++) await page.locator('.st-vorschlag').getByRole('button', { name: 'Übernehmen' }).first().click();
    await expect(page.locator('.st-vorschlag.ja')).toHaveCount(4);
    await page.getByRole('link', { name: 'Weiter zu Etappe 3' }).click();
    await page.waitForURL('/stand/3');
    await page.getByLabel(/Erzähl den Weg/).fill('Erfundener Weg: Kontakte kommen, Gespräche nicht.');
    await page.getByRole('button', { name: 'Auswerten lassen' }).click();
    await expect(page.locator('.st-vorschlag')).toHaveCount(2);
    const eng = page.locator('section[aria-label="Vorschlag Engpass"]');
    await expect(eng).toContainText('es fehlen Gespräche');
    await eng.getByRole('button', { name: 'Anders formulieren' }).click();
    await eng.getByLabel('Engpass in deinen Worten').fill('Zu wenige Erstgespräche mit Behörden, Ziel acht im Monat');
    await eng.getByRole('button', { name: 'So übernehmen' }).click();
    await page.locator('section[aria-label="Vorschlag Wochenziel"]').getByRole('button', { name: 'Übernehmen' }).click();
    await page.getByRole('link', { name: 'Zu deinem Stand' }).click();
    await page.waitForURL('/stand');
    const main = page.locator('main');
    for (const t of ['Fokus Zeit', 'Zu wenige Erstgespräche mit Behörden', 'Familie, Mut, Wirkung', 'Acht Erstgespräche im Monat', 'Neue Shop-Produkte', 'Drei Erstgespräche vereinbart', 'Wiederholen']) await expect(main).toContainText(t);
    await expect(page.locator('section[aria-label="Baseline"] .ringzelle')).toHaveCount(5);
    expect((await (await page.request.get('/api/coach')).json()).standortEtappe).toBeNull();
    const prompts: string[] = await (await page.request.get('http://127.0.0.1:4010/prompts')).json();
    const st = prompts.filter((x) => x.startsWith('STANDORT'));
    expect(st.length).toBe(3);
    expect(st.join(' ')).not.toContain('Carlotta');
    expect(st[2]).toContain('Fokus: Zeit');
    expect((await page.request.post('/api/stand/2', { headers: H, data: { aktion: 'uebernehmen', vorschlag: { art: 'engpass', text: 'gibt es in Etappe 2 nicht' } } })).status()).toBe(400);
    expect((await page.request.post('/api/stand/1', { headers: H, data: { antworten: { zeit: { wert: 99 } } } })).status()).toBe(400);
    expect((await page.request.get('/api/stand/7')).status()).toBe(404);
    await page.goto('/');
    await expect(page.locator('.engpass-zeile')).toContainText('Zu wenige Erstgespräche mit Behörden');    if (process.env.SCREENSHOTS) for (const [p2, n] of [['/stand', 'stand-voll'], ['/stand/3', 'stand-auswertung'], ['/', 'heute-kalender']] as const) {
      await page.goto(p2); await page.waitForTimeout(600);
      await page.screenshot({ path: `test-results/design/${n}-dark.png`, fullPage: true });
    }
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
    await expect(page.locator('.ws-banner')).toHaveCount(0);
    await page.goto('/');
    await expect(page.locator('.engpass-zeile')).toContainText('Erfundener Engpass');
    expect((await (await page.request.get('/api/coach')).json()).wochenstartOffen).toBe(false);
    expect(await (await page.request.post('/api/wochenstart', { headers: H, data: { aktion: 'fokus', ids: ['x; drop table'] } })).json()).toMatchObject({ ids: [] });
  });

  await test.step('Abmelden sperrt die Daten, auch für ein kopiertes Cookie, Face ID öffnet sie wieder', async () => {
    const alt = (await context.cookies()).find((c) => c.name === 'life_session')?.value;
    expect(alt).toBeTruthy();
    await page.goto('/einstellungen');
    await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
    await page.waitForURL('/login');
    expect((await page.request.get('/api/items')).status()).toBe(401);
    // Die Signatur stimmt noch, die Sitzung ist aber widerrufen
    expect((await page.request.get('/api/items', { headers: { cookie: `life_session=${alt}` } })).status()).toBe(401);
    expect((await page.request.get('/api/export', { headers: { cookie: `life_session=${alt}` } })).status()).toBe(401);
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

test('Einrichtungscode gilt nach der Einrichtung nicht mehr', async ({ request }) => {
  for (const [url, data] of [['/api/auth/register-options', { token: TEST_ENV.SETUP_TOKEN }], ['/api/auth/code/start', { token: TEST_ENV.SETUP_TOKEN, password: 'x'.repeat(20) }]] as const) {
    const r = await request.post(url, { headers: H, data });
    expect(r.status(), url).toBe(403);
    expect((await r.json()).error).toContain('schon eingerichtet');
  }
});

test('Passwort und Code: einrichten ohne QR, anmelden, Code gilt nur einmal', async ({ page, request, context, browser }) => {
  const PW = 'erfundenes-test-passwort-1234';
  let secret = ''; let setupSchritt = 0;

  await test.step('Einrichten mit kopierbarem Schlüssel, angemeldet und ohne Einrichtungscode', async () => {
    await anmelden(context);
    await page.goto('/setup');
    await expect(page.getByText('Du bist angemeldet')).toBeVisible();
    await expect(page.locator('#tok')).toHaveCount(0);
    await page.getByRole('button', { name: 'Passwort und Code statt Passkey' }).click();
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
    await page.request.post('/api/auth/logout', { headers: H });
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
    const nochmal = await page.request.post('/api/auth/code/login', { headers: H, data: { password: PW, code } });
    expect(nochmal.status()).toBe(401);
    const falschesPw = await page.request.post('/api/auth/code/login', { headers: H, data: { password: 'falsch-falsch-falsch-1', code: totp(secret) } });
    expect(falschesPw.status()).toBe(401);
  });

  await test.step('Ohne Sitzung kein Status und kein Ausschalten', async () => {
    expect((await request.get('/api/auth/code')).status()).toBe(401);
    expect((await request.delete('/api/auth/code', { headers: H })).status()).toBe(401);
    expect((await request.post('/api/auth/code/start', { headers: H, data: { token: 'falsch', password: 'x'.repeat(20) } })).status()).toBe(403);
  });

  await test.step('Auf allen Geräten abmelden beendet auch die Sitzung auf dem anderen Gerät', async () => {
    const anderes = await browser.newContext();
    await anmelden(anderes);
    expect((await anderes.request.get('/api/items')).status()).toBe(200);
    await page.goto('/einstellungen');
    await page.getByRole('button', { name: 'Auf allen Geräten abmelden' }).click();
    await page.waitForURL('/login');
    expect((await anderes.request.get('/api/items')).status()).toBe(401);
    await anderes.close();
  });
});

test('Kurzbefehl erfasst mit richtigem Schlüssel', async ({ request }) => {
  const r = await request.post('/api/capture', { headers: { authorization: `Bearer ${TEST_ENV.CAPTURE_TOKEN}`, 'content-type': 'text/plain' }, data: 'Vom Kurzbefehl diktiert' });
  expect(r.status()).toBe(200);
  expect(await r.text()).toBe('Festgehalten');
});

test('Begrenzung: nach 10 Einrichtungsversuchen ist Schluss', async ({ request }) => {
  const codes: number[] = [];
  for (let i = 0; i < 12; i++) codes.push((await request.post('/api/auth/register-options', { headers: H, data: { token: 'falsch' } })).status());
  expect(codes).toContain(429);
});

test('ENCRYPTION_KEY: Umschlüsseln hebt gespeicherte Geheimnisse einmal auf v2', async () => {
  // Läuft im Testprozess gegen die Testdatenbank. Der Einmal-Code aus dem Test oben liegt noch als v1 dort.
  const sql = testSql;
  const vorher = (await sql<{ value: string }[]>`select value from settings where key = 'totp_enc'`)[0]?.value ?? '';
  expect(vorher).toMatch(/^v1\./);
  const klar = aufschliessen(vorher, 'totp');
  delete process.env.ENCRYPTION_KEY;
  expect(await umschluesseln()).toBe(0); // ohne Schlüssel passiert nichts
  process.env.ENCRYPTION_KEY = 'test-encryption-key-nur-fuer-tests-fedcba9876543210';
  try {
    expect(await umschluesseln()).toBeGreaterThanOrEqual(1);
    const nachher = (await sql<{ value: string }[]>`select value from settings where key = 'totp_enc'`)[0].value;
    expect(nachher).toMatch(/^v2\./);
    expect(aufschliessen(nachher, 'totp')).toBe(klar);
    expect(await umschluesseln()).toBe(0); // zweiter Start: nichts mehr zu tun
  } finally { delete process.env.ENCRYPTION_KEY; await sql.end(); }
});

test('Zwei Menschen: jeder sieht nur seine eigenen Einträge, Einstellungen und sein Geld', async ({ browser }) => {
  const sql = postgres(TEST_ENV.DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql`insert into haushalte (id, name) values ('zweiter', 'Zweiter Haushalt') on conflict do nothing`;
  await sql`insert into nutzer (id, haushalt_id, name) values ('zweite', 'zweiter', 'Zweite') on conflict do nothing`;
  await sql.end();
  const peter = await browser.newContext(); await anmelden(peter);
  const zweite = await browser.newContext(); await anmelden(zweite, 'zweite');
  const P = peter.request, Z = zweite.request;

  // Die Zweite hält etwas fest
  const neu = await Z.post('/api/items', { headers: H, data: { text: 'Erfundener Eintrag nur für die Zweite' } });
  expect(neu.status()).toBe(200);
  const { id } = await neu.json();

  // Peter sieht ihn nicht, auch nicht per ID, und kann ihn weder ändern noch löschen
  const peterListe = await (await P.get('/api/items?limit=200')).json();
  expect(peterListe.some((i: { id: string }) => i.id === id)).toBe(false);
  expect((await P.get(`/api/items/${id}`)).status()).toBe(404);
  expect((await P.patch(`/api/items/${id}`, { headers: H, data: { text: 'übernommen' } })).status()).toBe(404);
  await P.delete(`/api/items/${id}`, { headers: H });
  expect((await Z.get(`/api/items/${id}`)).status()).toBe(200);

  // Die Zweite sieht nur ihren Eintrag, nichts von Peter
  const zListe = await (await Z.get('/api/items?limit=200')).json();
  expect(zListe.map((i: { id: string }) => i.id)).toEqual([id]);
  expect(await (await Z.get('/api/export')).text()).not.toContain(EINTRAEGE[0]);

  // Engpass gilt pro Mensch
  expect((await Z.put('/api/settings', { headers: H, data: { kontext: 'Engpass: Zweitengpass ohne Bezug' } })).status()).toBe(200);
  expect((await (await P.get('/api/settings')).json()).kontext).not.toContain('Zweitengpass');
  expect((await (await Z.get('/api/settings')).json()).kontext).toContain('Zweitengpass');

  // Geld hängt am eigenen Haushalt
  expect((await (await Z.get('/api/geld')).json()).haushalt).toBe('zweiter');
  expect((await (await P.get('/api/geld')).json()).haushalt).toBe('gneuss');

  // Passwort und Code gehören dem ersten Menschen: die Zweite kann sie weder einrichten noch abschalten
  // (Die Begrenzung fürs Einrichten ist nach dem Test oben schon ausgeschöpft, dann antwortet sie zuerst mit 429.)
  expect([403, 429]).toContain((await Z.post('/api/auth/code/start', { headers: H, data: { password: 'x'.repeat(24) } })).status());
  expect([403, 429]).toContain((await Z.post('/api/auth/code/fertig', { headers: H, data: { code: '000000' } })).status());
  expect((await Z.delete('/api/auth/code', { headers: H })).status()).toBe(403);

  // Der iCloud-Zugang aus der .env gilt nur für den ersten Menschen
  expect((await (await Z.get('/api/kalender')).json()).bereit).toBe(false);
  expect((await Z.post('/api/kalender', { headers: H })).status()).toBe(502);

  // Neu einordnen geht nur für eigene Einträge
  const peterEintrag = peterListe[0]?.id;
  if (peterEintrag) expect((await Z.patch(`/api/items/${peterEintrag}`, { headers: H, data: { neuSortieren: true } })).status()).toBe(404);

  await peter.close(); await zweite.close();
});
