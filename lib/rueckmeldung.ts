import { geschuetzteNamen } from './claude';
import { ensureSchema, sql } from './db';
import { maskieren } from './pseudonym';

/**
 * Rückmeldungen: Jede Meldung landet in der Datenbank. Steht ein GitHub-Schlüssel auf dem Server,
 * wird daraus zusätzlich eine Aufgabe (Issue) im Repo – mit Platzhaltern statt Namen.
 */

export const ARTEN = { fehler: 'Fehler', verbesserung: 'Verbesserung', idee: 'Idee' } as const;
export const BEREICHE = ['Heute', 'Woche', 'Körper', 'Training', 'Essen', 'Ruhe', 'Geld', 'Coach', 'Mitteilungen', 'Anmeldung', 'Sonstiges'] as const;
export const GEWICHT = { kaum: 'stört kaum', nervt: 'nervt', blockiert: 'blockiert mich' } as const;

export type Meldung = { art: keyof typeof ARTEN; bereich: (typeof BEREICHE)[number]; gewicht: keyof typeof GEWICHT; text: string; seite: string; version: string; geraet: string };

const githubBereit = () => !!process.env.GITHUB_ISSUES_TOKEN;

async function issue(m: Meldung, id: number): Promise<number | null> {
  if (!githubBereit()) return null;
  const { text } = maskieren(m.text, await geschuetzteNamen());
  const repo = process.env.GITHUB_REPO || 'griffin-kale/life-app';
  const basis = (process.env.GITHUB_API || 'https://api.github.com').replace(/\/$/, '');
  const body = [
    `**${ARTEN[m.art]}** · ${m.bereich} · ${GEWICHT[m.gewicht]}`, '',
    text || '_Ohne Beschreibung._', '',
    `Seite: \`${m.seite}\` · Version ${m.version} · ${m.geraet}`,
    `Rückmeldung Nr. ${id} aus der App. Namen sind durch Platzhalter ersetzt.`,
  ].join('\n');
  const titel = `${ARTEN[m.art]} (${m.bereich}): ${(text || GEWICHT[m.gewicht]).split('\n')[0].slice(0, 70)}`;
  const r = await fetch(`${basis}/repos/${repo}/issues`, {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${process.env.GITHUB_ISSUES_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json', 'user-agent': 'Life' },
    body: JSON.stringify({ title: titel, body, labels: ['rückmeldung', m.art === 'fehler' ? 'bug' : 'enhancement'] }),
  }).catch(() => null);
  if (!r || !r.ok) return null;
  return Number((await r.json() as { number?: number }).number) || null;
}

export async function melden(m: Meldung, userId: string): Promise<{ id: number; github: number | null }> {
  await ensureSchema();
  const [row] = await sql<{ id: number }[]>`insert into rueckmeldungen (user_id, art, bereich, gewicht, text, seite, version, geraet)
    values (${userId}, ${m.art}, ${m.bereich}, ${m.gewicht}, ${m.text || null}, ${m.seite}, ${m.version}, ${m.geraet}) returning id`;
  const nr = await issue(m, row.id).catch(() => null);
  if (nr) await sql`update rueckmeldungen set github_nr = ${nr} where id = ${row.id}`;
  return { id: row.id, github: nr };
}

export async function liste(userId: string) {
  await ensureSchema();
  return sql<{ id: number; art: string; bereich: string; gewicht: string; text: string | null; status: string; github_nr: number | null; created_at: string }[]>`
    select id, art, bereich, gewicht, text, status, github_nr, created_at from rueckmeldungen where user_id = ${userId} order by created_at desc limit 30`;
}
export { githubBereit };
