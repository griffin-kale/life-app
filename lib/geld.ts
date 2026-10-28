import { askJson, askJsonBild } from './claude';
import { ensureSchema, sql } from './db';
import { wochenTag } from './fragen';
import { heuteBerlin } from './priorisieren';
import { aktuelleStufe, euro, stufen, taschengeldGuthaben, topfStand, type Profil } from './geld-regeln';
import { Hinweis } from './fehler';

/** Geld des Haushalts. Beträge bleiben auf dem Server. Claude sieht nur Ladenname und Text einer Ausgabe oder ein Bon-Foto. */

export async function haushalt(userId: string): Promise<string> {
  await ensureSchema();
  const [n] = await sql<{ haushalt_id: string }[]>`select haushalt_id from nutzer where id = ${userId}`;
  if (!n) throw new Error('Kein Haushalt für diesen Menschen');
  return n.haushalt_id;
}

type Topf = { id: string; name: string; art: 'woche' | 'spar' | 'kind'; betrag_cent: number; stand_cent: number; start: string; sortierung: number };

export async function geldStand(userId: string) {
  const h = await haushalt(userId);
  const heute = heuteBerlin(); const montag = wochenTag(heute);
  const vorher = new Date(Date.parse(montag + 'T12:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
  const wt = (new Date(heute + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const [toepfe, summen, buchungen, posten, [profil]] = await Promise.all([
    sql<Topf[]>`select id::text, name, art, betrag_cent, stand_cent, start::text, sortierung from geld_toepfe where haushalt_id = ${h} and aktiv order by art, sortierung, id`,
    sql<{ topf_id: string; diese: number; letzte: number; alle: number }[]>`
      select topf_id::text, coalesce(sum(cent) filter (where tag >= ${montag}), 0)::int as diese,
        coalesce(sum(cent) filter (where tag >= ${vorher} and tag < ${montag}), 0)::int as letzte, coalesce(sum(cent), 0)::int as alle
      from geld_buchungen where haushalt_id = ${h} and topf_id is not null group by topf_id`,
    sql<{ id: string; tag: string; cent: number; was: string; quelle: string; topf_id: string | null; wer: string }[]>`
      select b.id::text, b.tag::text, b.cent, b.was, b.quelle, b.topf_id::text, n.name as wer from geld_buchungen b join nutzer n on n.id = b.user_id
      where b.haushalt_id = ${h} and b.tag >= ${vorher} order by b.created_at desc limit 40`,
    sql<{ id: string; art: 'einnahme' | 'fest' | 'schuld'; name: string; cent: number }[]>`select id::text, art, name, cent from geld_posten where haushalt_id = ${h} order by art, id`,
    sql<{ ruecklage_cent: number; sparrate_cent: number; puffer_monate: number }[]>`select ruecklage_cent, sparrate_cent, puffer_monate from geld_profil where haushalt_id = ${h}`,
  ]);
  const s = (id: string) => summen.find((x) => x.topf_id === id) ?? { diese: 0, letzte: 0, alle: 0 };
  const woche = toepfe.filter((t) => t.art === 'woche').map((t) => {
    const x = s(t.id);
    // Übertrag nur, wenn es den Topf letzte Woche schon gab
    const uebertrag = t.start < montag ? Math.max(0, t.betrag_cent - x.letzte) : 0;
    return { ...t, ausgaben: x.diese, uebertrag, ...topfStand(t.betrag_cent, x.diese, uebertrag, wt) };
  });
  const kinder = toepfe.filter((t) => t.art === 'kind').map((t) => ({ ...t, guthaben: taschengeldGuthaben(t.betrag_cent, t.start, heute, s(t.id).alle) }));
  const spar = toepfe.filter((t) => t.art === 'spar');
  const p: Profil = {
    einnahmen: posten.filter((x) => x.art === 'einnahme').reduce((a, x) => a + x.cent, 0),
    fest: posten.filter((x) => x.art === 'fest').reduce((a, x) => a + x.cent, 0),
    woche: woche.reduce((a, t) => a + t.betrag_cent, 0),
    schulden: posten.filter((x) => x.art === 'schuld').map((x) => ({ name: x.name, cent: x.cent })),
    ruecklage: profil?.ruecklage_cent ?? 0, sparrate: profil?.sparrate_cent ?? 0, pufferMonate: profil?.puffer_monate ?? 12,
  };
  const st = stufen(p);
  return { heute, montag, wochentag: wt, woche, kinder, spar, buchungen, posten, profil: p, stufen: st, aktuell: aktuelleStufe(st), haushalt: h,
    warnungen: woche.filter((t) => t.ueber).map((t) => `Topf „${t.name}“ ist diese Woche ${euro(-t.rest)} über dem Rahmen.`) };
}

/** Für den Coach: nur Zählungen, keine Beträge. */
export async function geldKurz(userId: string): Promise<string> {
  const g = await geldStand(userId);
  if (!g.woche.length) return '';
  const im = g.woche.filter((t) => !t.ueber).length;
  return `Geld diese Woche: ${im} von ${g.woche.length} Töpfen im Rahmen. Stufe im Plan: ${g.aktuell.nr} von 7 (${g.aktuell.titel}).`;
}

export async function topfVorschlag(was: string, toepfe: { id: string; name: string }[]): Promise<string | null> {
  if (!toepfe.length) return null;
  if (toepfe.length === 1) return toepfe[0].id;
  try {
    const a = await askJson<{ topf?: string }>(['GELD', 'Ordne eine Haushaltsausgabe einem Topf zu.', 'Töpfe: ' + toepfe.map((t) => t.name).join(', '), 'Ausgabe: ' + was.slice(0, 200), 'Antworte nur mit JSON: {"topf": string (genau einer der Töpfe)}'].join('\n\n'));
    return toepfe.find((t) => t.name.toLowerCase() === String(a.topf || '').toLowerCase())?.id ?? toepfe[0].id;
  } catch { return toepfe[0].id; }
}

export async function bonLesen(jpegBase64: string, toepfe: string[]): Promise<{ laden: string; cent: number; topf: string | null }> {
  const a = await askJsonBild<{ laden?: unknown; summe?: unknown; topf?: unknown }>(['BON', 'Lies diesen Kassenbon. Nur Ladenname und Gesamtsumme, keine einzelnen Posten.', toepfe.length ? 'Töpfe: ' + toepfe.join(', ') : '', 'Antworte nur mit JSON: {"laden": string (höchstens 4 Wörter), "summe": Zahl in Euro mit Punkt, "topf": string (genau einer der Töpfe oder leer)}'].filter(Boolean).join('\n\n'), jpegBase64, undefined, 300);
  const summe = Number(a.summe);
  if (!Number.isFinite(summe) || summe <= 0 || summe > 100000) throw new Hinweis('Auf dem Bon war keine Summe zu lesen. Tipp sie ein.');
  const topf = toepfe.find((t) => t.toLowerCase() === String(a.topf || '').toLowerCase()) ?? null;
  return { laden: String(a.laden || 'Einkauf').slice(0, 60), cent: Math.round(summe * 100), topf };
}
