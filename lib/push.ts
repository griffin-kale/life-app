import webpush from 'web-push';
import { ensureSchema, getSetting, setSetting, sql } from './db';
import { aufschliessen, zuschliessen } from './passwort-core';

/**
 * Mitteilungen auf das iPhone über Web Push. Der Inhalt ist Ende-zu-Ende verschlüsselt (RFC 8291),
 * Apples Push-Dienst sieht nur Kauderwelsch. Der private Schlüssel liegt verschlüsselt in der Datenbank.
 */

export async function vapid(): Promise<{ publicKey: string; privateKey: string }> {
  await ensureSchema();
  const pub = await getSetting('vapid_public'); const box = await getSetting('vapid_private');
  if (pub && box) return { publicKey: pub, privateKey: aufschliessen(box, 'vapid') };
  const k = webpush.generateVAPIDKeys();
  await setSetting('vapid_private', zuschliessen(k.privateKey, 'vapid'));
  await setSetting('vapid_public', k.publicKey);
  return k;
}

export type Abo = { endpoint: string; keys: { p256dh: string; auth: string } };

export { endpointOk } from './push-regeln';

export async function abonnieren(a: Abo, userId = 'peter') {
  await ensureSchema();
  await sql`insert into push_abos (user_id, endpoint, p256dh, auth) values (${userId}, ${a.endpoint}, ${a.keys.p256dh}, ${a.keys.auth})
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id`;
}
export async function abbestellen(endpoint: string) { await sql`delete from push_abos where endpoint = ${endpoint}`; }
export async function aboAnzahl(userId = 'peter') { const [r] = await sql<{ n: number }[]>`select count(*)::int as n from push_abos where user_id = ${userId}`; return r.n; }

export type Mitteilung = { title: string; body: string; url?: string; tag?: string };

export async function senden(m: Mitteilung, userId = 'peter'): Promise<number> {
  const abos = await sql<{ endpoint: string; p256dh: string; auth: string }[]>`select endpoint, p256dh, auth from push_abos where user_id = ${userId}`;
  if (!abos.length) return 0;
  const k = await vapid();
  const subject = process.env.PUBLIC_ORIGIN || 'https://life.gneuss.xyz';
  let ok = 0;
  for (const a of abos) {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify({ ...m, body: m.body.slice(0, 240) }),
        { vapidDetails: { subject, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 6 * 3600, urgency: 'normal', timeout: 10_000 });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await abbestellen(a.endpoint);
    }
  }
  return ok;
}
