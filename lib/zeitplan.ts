import { coachErstellen } from './coach';
import { ensureSchema, getSetting, setSetting, sql } from './db';
import { koerperStand } from './koerper';
import { heuteBerlin, offene } from './priorisieren';
import { senden } from './push';
import { warnsignale } from './coach-regeln';
import { abgleichen, verbunden, whoopBereit } from './whoop';
import { geldStand } from './geld';
import { kompassStand } from './kompass';

/**
 * Läuft jede Minute im Server: WHOOP abgleichen und Mitteilungen zur richtigen Zeit schicken.
 * Jede Mitteilung höchstens einmal am Tag. Verpasste Zeitpunkte holt Life bis zu zwei Stunden später nach.
 */

export type PushEinstellungen = { morgen: boolean; abend: boolean; warnung: boolean; training: boolean; morgenZeit: string; abendZeit: string };
export const PUSH_STANDARD: PushEinstellungen = { morgen: true, abend: true, warnung: true, training: true, morgenZeit: '07:00', abendZeit: '20:30' };

export async function pushEinstellungen(): Promise<PushEinstellungen> {
  try { return { ...PUSH_STANDARD, ...JSON.parse((await getSetting('push')) || '{}') }; } catch { return PUSH_STANDARD; }
}

const jetztBerlin = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
import { faellig, minuten } from './zeitplan-regeln';

async function einmal(schluessel: string, tag: string, f: () => Promise<boolean>) {
  if ((await getSetting(`gesendet:${schluessel}`)) === tag) return;
  if (await f()) await setSetting(`gesendet:${schluessel}`, tag);
}

export async function tick(userId = 'peter') {
  await ensureSchema();
  const tag = heuteBerlin(); const uhr = jetztBerlin();
  // WHOOP alle zwei Stunden, morgens ab 6 Uhr stündlich
  if (whoopBereit() && await verbunden(userId)) {
    const zuletzt = Date.parse((await getSetting(`whoop_abgleich:${userId}`)) || '0');
    const abstand = minuten(uhr) >= 360 && minuten(uhr) <= 600 ? 3600_000 : 7200_000;
    if (Date.now() - zuletzt > abstand) await abgleichen(userId, 3).catch(() => {});
  }
  const p = await pushEinstellungen();
  const [ci] = await sql<{ morgen: boolean; abend: boolean }[]>`
    select bool_or(art = 'morgen') as morgen, bool_or(art = 'abend') as abend from checkins where user_id = ${userId} and tag = ${tag}`;
  if (p.morgen && faellig(uhr, p.morgenZeit)) await einmal('morgen', tag, async () => {
    if (ci?.morgen) {
      const c = await coachErstellen('morgen', userId).catch(() => null);
      return (await senden({ title: 'Life', body: c?.text || 'Dein Tag steht.', url: '/', tag: 'morgen' }, userId)) > 0;
    }
    return (await senden({ title: 'Guten Morgen', body: 'Wie erholt fühlst du dich? Eine Frage, zehn Sekunden.', url: '/', tag: 'morgen' }, userId)) > 0;
  });
  if (p.abend && faellig(uhr, p.abendZeit) && !ci?.abend) await einmal('abend', tag, async () =>
    (await senden({ title: 'Der Tag', body: 'Drei Fragen, eine Minute. Dann ist der Plan für morgen fertig.', url: '/', tag: 'abend' }, userId)) > 0);
  if (p.warnung && minuten(uhr) >= minuten(p.morgenZeit) + 5 && minuten(uhr) <= 21 * 60) await einmal('warnung', tag, async () => {
    const k = await koerperStand(userId);
    const g = await geldStand(userId).catch(() => null);
    const w = [...k.warnungen, ...(g?.warnungen ?? []), ...warnsignale(await offene())];
    if (!w.length) return false;
    return (await senden({ title: 'Achtung', body: w[0], url: '/', tag: 'warnung' }, userId)) > 0;
  });
  // Meilensteine stündlich prüfen. Neu freigeschaltete kommen als Mitteilung.
  const stunde = uhr.slice(0, 2);
  if ((await getSetting('kompass_stunde')) !== `${tag} ${stunde}`) {
    await setSetting('kompass_stunde', `${tag} ${stunde}`);
    const k = await kompassStand(userId).catch(() => null);
    if (k?.neu.length && minuten(uhr) >= 7 * 60 && minuten(uhr) <= 21 * 60) await senden({ title: 'Meilenstein', body: `${k.neu.join(', ')}. Im Kompass steht, was als Nächstes kommt.`, url: '/kompass', tag: 'meilenstein' }, userId);
  }
  if (p.training) {
    const k = await koerperStand(userId);
    if (k.trainingstagHeute && faellig(uhr, k.stand.uhrzeit)) await einmal('training', tag, async () =>
      (await senden({ title: 'Training', body: `Ganzkörper, Woche ${k.blockWoche} von 5. Rund 40 Minuten.`, url: '/koerper/training', tag: 'training' }, userId)) > 0);
  }
}

let gestartet = false;
export function starten() {
  if (gestartet || process.env.LIFE_ZEITPLAN === 'aus') return;
  gestartet = true;
  const lauf = () => tick().catch((e) => console.error('zeitplan', (e as Error).message));
  setTimeout(lauf, 20_000);
  setInterval(lauf, 60_000).unref();
}
