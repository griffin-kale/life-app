import { expect, test, type Page } from '@playwright/test';
import { TEST_ENV } from '../../playwright.config';

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
    await expect(page.getByRole('button', { name: /Gespeichert/ })).toBeVisible();
    await page.fill('#ktx', 'Engpass: Zu wenige Leute auf der Plattform, Content hochfahren\nPrioritäten: Projekte, Plattform, Boutique');
    await page.fill('#ziele', 'Projekte\nPlattform\nBoutique\nPrivat');
    await page.fill('#team', 'Carlotta: Fachbereiche, Vertrieb');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('button', { name: /Gespeichert/ })).toBeVisible();
  });

  await test.step('Festhalten und von Claude sortieren lassen', async () => {
    await page.goto('/');
    await expect(page.locator('.engpass')).toContainText('Content hochfahren');
    for (const t of EINTRAEGE) {
      await page.fill('textarea', t);
      await page.locator('button.btn.primary').click();
      await expect(page.locator('button.btn.primary')).toContainText('Festgehalten');
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
    await expect(page.locator('main')).toContainText('Plattform');
    await expect(page.locator('main')).toContainText('Delegieren');
    await expect(page.locator('main')).toContainText('an Carlotta');
    await expect(page.locator('main')).toContainText('Streichen vorgeschlagen');
    await expect(page.locator('.ttitle', { hasText: 'KGSt' })).toHaveCount(1);
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
    for (const p of ['/', '/woche', '/archiv', '/einstellungen']) {
      await page.goto(p);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), p).toBeLessThanOrEqual(390);
    }
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
