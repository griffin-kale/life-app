import { coachErstellen } from './coach';
import { ensureSchema, getSetting, setSetting, sql } from './db';
import { koerperStand } from './koerper';
import { heuteBerlin, offene } from './priorisieren';
import { senden } from './push';
import { warnsignale } from './coach-regeln';
import { abgleichen, verbunden, whoopBereit } from './whoop';
import { geldStand } from './geld';
import { kompassStand } from './kompass';
import { tageslage } from './tag';
import { vielleichtAbgleichen } from './kalender';

/**
 * Läuft jede Minute im Server: WHOOP abgleichen und Mitteilungen zur richtigen Zeit schicken.
 * Jede Mitteilung höchstens einmal am Tag. Verpasste Zeitpunkte holt Life bis zu zwei Stunden später nach.
 */

export type PushEinstellungen = { morgen: boolean; abend: boolean; warnung: boolean; training: boolean; verpasst: boolean; nachmittag: boolean; wochenstart: boolean; morgenZeit: string; abendZeit: string };
export const PUSH_STANDARD: PushEinstellungen = { morgen: true, abend: true, warnung: true, training: true, verpasst: true, nachmittag: true, wochenstart: true, morgenZeit: '07:00', abendZeit: '20:30' };

export async function pushEinstellungen(): Promise<PushEinstellungen> {
  try { return { ...PUSH_STANDARD, ...JSON.parse((await getSetting('push')) || '{}') }; } catch { return PUSH_STANDARD; }
}

const jetztBerlin = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
import { faellig, minuten } from './zeitplan-regeln';
import { einmalMit, LETZTER_LAUF, ohneUeberlappung, type EinmalSpeicher } from './zeitplan-schutz';

/** Nummer der Postgres-Sperre, damit auch zwei Container nie gleichzeitig senden. */
const SCHLOSS = 7_291_001;

/** „Schon gesendet“ in `settings`. Der Schlüssel wird in einer Anweisung gesetzt, bevor gesendet wird. */
const gesendet: EinmalSpeicher = {
  async beanspruchen(schluessel, tag) {
    const k = `gesendet:${schluessel}`;
    const rows = await sql<{ vorher: string | null }[]>`
      with alt as (select value from settings where key = ${k})
      insert into settings (key, value) values (${k}, ${tag})
      on conflict (key) do update set value = excluded.value where settings.value is distinct from excluded.value
      returning (select value from alt) as vorher`;
    return rows.length ? { ok: true, vorher: rows[0].vorher } : { ok: false, vorher: tag };
  },
  async zuruecksetzen(schluessel, tag, vorher) {
    const k = `gesendet:${schluessel}`;
    if (vorher === null) await sql`delete from settings where key = ${k} and value = ${tag}`;
    else await sql`update settings set value = ${vorher} where key = ${k} and value = ${tag}`;
  },
};

const einmal = (schluessel: string, tag: string, f: () => Promise<boolean>) => einmalMit(gesendet, schluessel, tag, f);

/** Hält die Sitzungs-Sperre auf einer eigenen Verbindung, solange `f` läuft. */
async function mitSperre(f: () => Promise<void>): Promise<boolean> {
  await ensureSchema();
  const v = await sql.reserve();
  try {
    const [r] = await v<{ ok: boolean }[]>`select pg_try_advisory_lock(${SCHLOSS}) as ok`;
    if (!r?.ok) return false;
    try { await f(); } finally { await v`select pg_advisory_unlock(${SCHLOSS})`; }
    return true;
  } finally {
    v.release();
  }
}
const exklusiv = ohneUeberlappung(mitSperre);

export async function tick(userId = 'peter') {
  await ensureSchema();
  const tag = heuteBerlin(); const uhr = jetztBerlin();
  // WHOOP alle zwei Stunden, morgens ab 6 Uhr stündlich
  if (whoopBereit() && await verbunden(userId)) {
    const zuletzt = Date.parse((await getSetting(`whoop_abgleich:${userId}`)) || '0');
    const abstand = minuten(uhr) >= 360 && minuten(uhr) <= 600 ? 3600_000 : 7200_000;
    if (Date.now() - zuletzt > abstand) await abgleichen(userId, 3).catch(() => {});
  }
  await vielleichtAbgleichen(userId);
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
  // Coach von selbst: verpasste Uhrzeit, Nachmittags-Check, Wochenstart am Montag
  if ((p.verpasst || p.nachmittag || p.wochenstart) && minuten(uhr) >= 7 * 60 && minuten(uhr) <= 21 * 60) {
    const lage = await tageslage(userId).catch(() => null);
    if (lage) {
      if (p.verpasst) for (const a of lage.jetzt) {
        if (a.erledigt || !a.zeit) continue;
        const d = minuten(uhr) - minuten(a.zeit);
        if (d >= 30 && d <= 120) await einmal(`verpasst:${a.id}`, tag, async () =>
          (await senden({ title: 'Noch offen', body: `„${a.titel}“ stand für ${a.zeit} an. Jetzt machen oder verschieben?`, url: '/', tag: `verpasst-${a.id}` }, userId)) > 0);
      }
      const offen = lage.jetzt.filter((a) => !a.erledigt);
      if (p.nachmittag && faellig(uhr, '15:00') && offen.length && offen.length === lage.jetzt.length) await einmal('nachmittag', tag, async () =>
        (await senden({ title: 'Nachmittag', body: `Von „Jetzt dran“ ist noch nichts erledigt. Fang mit „${offen[0].titel}“ an, dreißig Minuten reichen.`, url: '/', tag: 'nachmittag' }, userId)) > 0);
      if (p.wochenstart && lage.wochenstartOffen && new Date().getDay() === 1 && faellig(uhr, '08:30')) await einmal('wochenstart', tag, async () =>
        (await senden({ title: 'Wochenstart', body: 'Zehn Minuten für die Woche: Rückblick, Engpass, drei Dinge.', url: '/wochenstart', tag: 'wochenstart' }, userId)) > 0);
    }
  }
  if (p.training) {
    const k = await koerperStand(userId);
    if (k.trainingstagHeute && faellig(uhr, k.stand.uhrzeit)) await einmal('training', tag, async () =>
      (await senden({ title: 'Training', body: `Ganzkörper, Woche ${k.blockWoche} von 5. Rund 40 Minuten.`, url: '/koerper/training', tag: 'training' }, userId)) > 0);
  }
}

/** Ein Lauf des Zeitplans: nie überlappend, danach steht der Zeitpunkt für `/api/health` fest. */
export async function lauf(): Promise<void> {
  const fertig = await exklusiv(async () => {
    await tick();
    await setSetting(LETZTER_LAUF, new Date().toISOString());
  });
  if (!fertig) console.warn('zeitplan: voriger Lauf noch nicht fertig, dieser fällt aus');
}

let gestartet = false;
export function starten() {
  if (gestartet || process.env.LIFE_ZEITPLAN === 'aus') return;
  gestartet = true;
  // Nur der Name des Fehlers ins Log, Texte können Inhalte tragen
  const lauf_ = () => lauf().catch((e) => console.error('zeitplan', (e as Error).name));
  setTimeout(lauf_, 20_000);
  setInterval(lauf_, 60_000).unref();
}
