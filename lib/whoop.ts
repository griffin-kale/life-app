import { ensureSchema, getSetting, setSetting, sql } from './db';
import { aufschliessen, zuschliessen } from './passwort-core';
import { heuteBerlin } from './priorisieren';

/**
 * WHOOP über die offizielle Schnittstelle (OAuth 2, v2). Tokens liegen verschlüsselt in der Datenbank.
 * Life holt Schlaf, Erholung, HRV, Ruhepuls, Belastung, Trainings und Gewicht. Nichts davon geht ungefiltert an Claude.
 */

const BASIS = () => (process.env.WHOOP_BASE || 'https://api.prod.whoop.com').replace(/\/$/, '');
const AUTH = () => `${BASIS()}/oauth/oauth2/auth`;
const TOKEN = () => `${BASIS()}/oauth/oauth2/token`;
const API = () => `${BASIS()}/developer`;
export const SCOPES = 'offline read:recovery read:cycles read:sleep read:workout read:body_measurement';

export const whoopBereit = () => !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
export const redirectUri = () => `${(process.env.PUBLIC_ORIGIN || 'http://localhost:3000').replace(/\/$/, '')}/api/whoop/callback`;

type Tokens = { access: string; refresh: string; ablauf: number };

export function authUrl(state: string): string {
  const u = new URL(AUTH());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', process.env.WHOOP_CLIENT_ID ?? '');
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('state', state);
  return u.toString();
}

async function tokenAnfrage(params: Record<string, string>): Promise<Tokens> {
  const body = new URLSearchParams({ ...params, client_id: process.env.WHOOP_CLIENT_ID ?? '', client_secret: process.env.WHOOP_CLIENT_SECRET ?? '' });
  const r = await fetch(TOKEN(), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`WHOOP lehnt ab (${r.status})`);
  const j = await r.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!j.access_token || !j.refresh_token) throw new Error('WHOOP hat keinen Schlüssel geschickt');
  return { access: j.access_token, refresh: j.refresh_token, ablauf: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
}

async function speichern(t: Tokens, userId: string) {
  await setSetting(`whoop_tokens:${userId}`, zuschliessen(JSON.stringify(t), 'whoop'));
}

export async function verbunden(userId = 'peter'): Promise<boolean> { return !!(await getSetting(`whoop_tokens:${userId}`)); }

export async function codeTauschen(code: string, userId = 'peter'): Promise<void> {
  await speichern(await tokenAnfrage({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() }), userId);
}

export async function trennen(userId = 'peter'): Promise<void> { await setSetting(`whoop_tokens:${userId}`, ''); }

/** Gültiger Zugangsschlüssel. Erneuert ihn unter Sperre, weil WHOOP beim Erneuern beide Schlüssel tauscht. */
async function zugang(userId: string): Promise<string> {
  const box = await getSetting(`whoop_tokens:${userId}`);
  if (!box) throw new Error('WHOOP ist nicht verbunden');
  let t = JSON.parse(aufschliessen(box, 'whoop')) as Tokens;
  if (t.ablauf > Date.now() + 60_000) return t.access;
  const conn = await sql.reserve();
  try {
    await conn`select pg_advisory_lock(4712)`;
    const frisch = await getSetting(`whoop_tokens:${userId}`);
    t = JSON.parse(aufschliessen(frisch, 'whoop')) as Tokens;
    if (t.ablauf <= Date.now() + 60_000) { t = await tokenAnfrage({ grant_type: 'refresh_token', refresh_token: t.refresh, scope: 'offline' }); await speichern(t, userId); }
    return t.access;
  } finally { await conn`select pg_advisory_unlock(4712)`; conn.release(); }
}

async function liste<T>(userId: string, pfad: string, ab: Date): Promise<T[]> {
  const token = await zugang(userId);
  const out: T[] = []; let next = '';
  for (let seite = 0; seite < 6; seite++) {
    const u = new URL(API() + pfad); u.searchParams.set('limit', '25'); u.searchParams.set('start', ab.toISOString()); if (next) u.searchParams.set('nextToken', next);
    const r = await fetch(u, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`WHOOP ${pfad}: ${r.status}`);
    const j = await r.json() as { records?: T[]; next_token?: string | null };
    out.push(...(j.records ?? []));
    if (!j.next_token) break; next = j.next_token;
  }
  return out;
}

type Schlaf = { id: string; end: string; nap?: boolean; score_state?: string; score?: { sleep_performance_percentage?: number; stage_summary?: { total_in_bed_time_milli?: number; total_awake_time_milli?: number } } };
type Erholung = { sleep_id?: string; created_at: string; score_state?: string; score?: { recovery_score?: number; hrv_rmssd_milli?: number; resting_heart_rate?: number } };
type Workout = { id: string; start: string; end: string; sport_name?: string; score_state?: string; score?: { strain?: number; zone_durations?: Record<string, number> } };
type Zyklus = { start: string; score?: { strain?: number } };

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const KRAFT = /weight|strength|functional|powerlifting|crossfit|calisthenics/i;

/** Zieht die letzten Tage von WHOOP in die Datenbank. Mehrfaches Abgleichen überschreibt nur. */
export async function abgleichen(userId = 'peter', tage = 14): Promise<{ naechte: number; trainings: number }> {
  await ensureSchema();
  const ab = new Date(Date.now() - tage * 864e5);
  const [schlaf, erholung, workouts, zyklen] = await Promise.all([
    liste<Schlaf>(userId, '/v2/activity/sleep', ab), liste<Erholung>(userId, '/v2/recovery', ab),
    liste<Workout>(userId, '/v2/activity/workout', ab), liste<Zyklus>(userId, '/v2/cycle', ab),
  ]);
  const tage_ = new Map<string, { schlaf_min?: number | null; schlaf_leistung?: number | null; erholung?: number | null; hrv?: number | null; ruhepuls?: number | null; belastung?: number | null }>();
  const zu = (tag: string) => { if (!tage_.has(tag)) tage_.set(tag, {}); return tage_.get(tag)!; };
  const schlafTag = new Map<string, string>();
  for (const s of schlaf) {
    if (s.nap || s.score_state !== 'SCORED') continue;
    const tag = heuteBerlin(new Date(s.end)); schlafTag.set(s.id, tag);
    const st = s.score?.stage_summary;
    const min = st?.total_in_bed_time_milli != null ? Math.round((st.total_in_bed_time_milli - (st.total_awake_time_milli ?? 0)) / 60000) : null;
    const t = zu(tag); if ((t.schlaf_min ?? 0) < (min ?? 0)) { t.schlaf_min = min; t.schlaf_leistung = num(s.score?.sleep_performance_percentage); }
  }
  for (const e of erholung) {
    if (e.score_state !== 'SCORED') continue;
    const t = zu((e.sleep_id && schlafTag.get(e.sleep_id)) || heuteBerlin(new Date(e.created_at)));
    t.erholung = num(e.score?.recovery_score); t.hrv = num(e.score?.hrv_rmssd_milli); t.ruhepuls = num(e.score?.resting_heart_rate);
  }
  for (const z of zyklen) { const b = num(z.score?.strain); if (b !== null) zu(heuteBerlin(new Date(z.start))).belastung = b; }
  for (const [tag, t] of tage_) {
    await sql`insert into koerper_tage (user_id, tag, schlaf_min, schlaf_leistung, erholung, hrv, ruhepuls, belastung)
      values (${userId}, ${tag}, ${t.schlaf_min ?? null}, ${t.schlaf_leistung ?? null}, ${t.erholung ?? null}, ${t.hrv ?? null}, ${t.ruhepuls ?? null}, ${t.belastung ?? null})
      on conflict (user_id, tag) do update set
        schlaf_min = coalesce(excluded.schlaf_min, koerper_tage.schlaf_min), schlaf_leistung = coalesce(excluded.schlaf_leistung, koerper_tage.schlaf_leistung),
        erholung = coalesce(excluded.erholung, koerper_tage.erholung), hrv = coalesce(excluded.hrv, koerper_tage.hrv),
        ruhepuls = coalesce(excluded.ruhepuls, koerper_tage.ruhepuls), belastung = coalesce(excluded.belastung, koerper_tage.belastung), updated_at = now()`;
  }
  let n = 0;
  for (const w of workouts) {
    if (w.score_state && w.score_state !== 'SCORED') continue;
    const z = w.score?.zone_durations ?? {};
    const min = (k: string) => Math.round((num(z[k]) ?? 0) / 60000);
    const zone2 = min('zone_two_milli'); const zone45 = min('zone_four_milli') + min('zone_five_milli');
    const dauer = Math.round((Date.parse(w.end) - Date.parse(w.start)) / 60000);
    const art = zone45 >= 12 ? 'intervall' : KRAFT.test(w.sport_name ?? '') ? 'kraft' : zone2 + min('zone_three_milli') >= 20 ? 'zone2' : 'sonstiges';
    await sql`insert into trainings (user_id, quelle, extern_id, tag, start, dauer_min, art, sport, belastung, zone2_min, zone45_min)
      values (${userId}, 'whoop', ${String(w.id)}, ${heuteBerlin(new Date(w.start))}, ${w.start}, ${dauer}, ${art}, ${(w.sport_name ?? '').slice(0, 60) || null}, ${num(w.score?.strain)}, ${zone2}, ${zone45})
      on conflict (user_id, quelle, extern_id) do update set art = excluded.art, belastung = excluded.belastung, zone2_min = excluded.zone2_min, zone45_min = excluded.zone45_min, dauer_min = excluded.dauer_min`;
    n++;
  }
  try {
    const token = await zugang(userId);
    const r = await fetch(API() + '/v2/user/measurement/body', { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    if (r.ok) { const kg = num((await r.json() as { weight_kilogram?: number }).weight_kilogram); if (kg && kg > 30 && kg < 250) await sql`update nutzer set gewicht_kg = ${kg} where id = ${userId}`; }
  } catch { /* Gewicht ist optional */ }
  await setSetting(`whoop_abgleich:${userId}`, new Date().toISOString());
  return { naechte: tage_.size, trainings: n };
}
