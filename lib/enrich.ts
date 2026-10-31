import { askJson, namenLernen } from './claude';
import { ensureSchema, getSetting, proNutzer, sql, type Item } from './db';
import { AKTIV, heuteBerlin, liste, sortiere } from './priorisieren';
import { zieleText as saisonZieleText } from './saison';
import { safeFetch } from './safefetch';
import { kontakteAusEintrag } from './menschen';
import { oeffentlich } from './fehler';
import { videoId } from './youtube';
import { coachChat } from './coach';

export const TYPEN = ['gedanke', 'zitat', 'video', 'buch', 'link'] as const;
export const KATEGORIEN = ['engpass', 'entscheidung', 'aufgabe', 'projekt', 'privat', 'notiz', 'idee', 'wissen'] as const;
export const ARTEN = ['zeit', 'sozial', 'mental', 'koerper', 'geld'] as const;

const URL_RE = /https?:\/\/[^\s<>"]+/i;

/** Holt Titel und Text einer Seite über safeFetch: nur öffentliche Adressen, höchstens 1,5 MB, 8 Sekunden. */
async function fetchPage(raw: string): Promise<{ title: string; text: string; site: string } | null> {
  const res = await safeFetch(raw, { headers: { 'user-agent': 'Mozilla/5.0 (Life)', 'accept-language': 'de,en' } });
  if (!res || res.status < 200 || res.status >= 300 || !res.contentType.includes('html')) return null;
  const html = res.body.toString('utf8');
  const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)`, 'i'))?.[1] ?? '';
  const title = meta('og:title') || html.match(/<title[^>]*>([^<]*)/i)?.[1] || '';
  const body = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  return { title: decode(title).trim(), text: (meta('og:description') + ' ' + body).slice(0, 6000), site: new URL(res.url).hostname.replace(/^www\./, '') };
}

async function youtube(raw: string): Promise<{ title: string; author: string } | null> {
  const id = videoId(raw); if (!id) return null;
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: AbortSignal.timeout(6000), redirect: 'error' });
  if (!res.ok) return null;
  const j = await res.json() as { title?: string; author_name?: string };
  return { title: j.title ?? '', author: j.author_name ?? '' };
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

type Antwort = {
  typ: string; kategorie: string; art: string; titel: string; bereinigt: string; schritt: string; begruendung: string; kern: string; frage: string;
  ziel?: string; hebel?: number; aufwand_min?: number; frist?: string; wer?: string; delegieren_an?: string;
  namen?: { name: string; art: string }[];
  anCoach?: boolean;
};

/** Ordnet einen Eintrag ein. Fehler landen im Feld "fehler", der Eintrag bleibt erhalten. */
export async function enrich(id: string): Promise<void> {
  await ensureSchema();
  const [item] = await sql<Item[]>`select * from items where id = ${id}`;
  if (!item) return;
  const userId = item.user_id;
  try {
    const url = item.url ?? item.text.match(URL_RE)?.[0] ?? null;
    let quelle = '';
    let titel = '';
    let typHint = '';
    if (url && /(?:youtube\.com|youtu\.be)\//i.test(url)) {
      const y = await youtube(url).catch(() => null);
      if (y) { titel = y.title; quelle = y.author ? `YouTube · ${y.author}` : 'YouTube'; }
      typHint = 'video';
    } else if (url) {
      const p = await fetchPage(url).catch(() => null);
      if (p) { titel = p.title; quelle = `${p.site}\nSeitentext (Auszug): ${p.text}`; }
    }
    const [kontext, zieleText, team] = await Promise.all([getSetting(proNutzer('kontext', userId)), saisonZieleText(userId), getSetting(proNutzer('team', userId))]);
    const ziele = liste(zieleText);
    const heute = heuteBerlin();
    const wtag = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long' }).format(new Date());
    const prompt = [
      'Du hilfst Peter, Gedanken und Fundstücke festzuhalten und daraus zu lernen. Ordne den Eintrag ein. Deutsch, knapp, keine Floskeln.',
      'Typen: "gedanke" (eigener Gedanke), "zitat" (Satz von jemand anderem), "video", "buch", "link" (Artikel, Seite).',
      'Kategorien: "engpass" (verkleinert direkt den aktuellen Engpass), "entscheidung" (größere Frage zum Abwägen), "aufgabe" (konkret, in einer Sitzung erledigt), "projekt" (mehrere Schritte), "privat" (Familie, Gesundheit, Freizeit), "notiz" (nur festhalten), "idee" (spannend, aber nicht jetzt), "wissen" (Zitat, Video, Buch oder Artikel zum Lernen). Sei streng mit "engpass".',
      'Art von Wohlstand nach Sahil Bloom: "zeit", "sozial", "mental", "koerper" oder "geld".',
      'Was gerade zählt (von Peter):\n' + (kontext || 'nicht angegeben'),
      'Peters Ziele: ' + (ziele.length ? ziele.join(', ') : 'nicht angegeben'),
      team ? 'Wem Peter etwas geben kann:\n' + team : '',
      `Heute ist ${wtag}, ${heute}.`,
      'Eintrag (oft diktiert, kann Füllwörter und Fehler enthalten):\n' + item.text,
      url ? `Link: ${url}${titel ? `\nTitel: ${titel}` : ''}${quelle ? `\nQuelle: ${quelle}` : ''}${typHint ? `\nHinweis: ${typHint}` : ''}` : '',
      'Antworte nur mit JSON: {"typ": string, "kategorie": string, "art": string, "titel": string (höchstens 8 Wörter), "bereinigt": string (der Eintrag in sauberem Deutsch: Füllwörter und Versprecher raus, Sinn und Peters Ton bleiben, Links unverändert), "schritt": string (konkreter nächster Schritt mit Verb am Anfang, höchstens 12 Wörter; leer bei notiz, idee und wissen), "begruendung": string (höchstens 10 Wörter), "kern": string (bei wissen: die Kernidee in 1 bis 2 Sätzen, sonst leer), "frage": string (bei wissen: eine Frage an Peter, wie er das anwendet, sonst leer), "ziel": string (genau eines von Peters Zielen, auf das der Eintrag einzahlt, sonst leer), "hebel": Zahl 0 bis 3 (Wirkung auf den Engpass, 3 = direkt; streng), "aufwand_min": 15, 60 oder 240 (bei notiz, idee und wissen 0), "frist": "JJJJ-MM-TT" (nur wenn der Eintrag eine Frist nennt oder klar macht, sonst leer), "wer": "ich" oder "delegieren", "delegieren_an": string (Name aus dem Team, sonst leer), "namen": [{"name": string, "art": "person"|"firma"|"ort"}] (Eigennamen von Menschen, Firmen und Orten, die im Eintrag im Klartext stehen; Platzhalter in eckigen Klammern nicht aufnehmen; sonst leer), "anCoach": true oder false (true nur, wenn Peter den Coach direkt anspricht oder um Rat bittet, etwa „Ich habe nur 30 Minuten, was jetzt?“ oder „Ich bin müde, was soll ich tun?“, oder wenn er eine Zahl in Life ändern will, etwa „Mein Sparziel Urlaub ist 3000 Euro“ oder „Rücklage steht jetzt bei 8000“, oder wenn er dem Coach etwas Festes über sich sagt, das der sich merken soll, etwa „Meine Wohlfühlsumme auf dem Konto sind 20.000 Euro“ oder „Merk dir, dass ich montags kein Training mache“, oder wenn er ihn bittet, etwas aufzuschreiben oder das Wochenziel zu setzen; Aufgaben, Ideen, Notizen und Wissen sind sonst false)}',
    ].filter(Boolean).join('\n\n');
    const a = await askJson<Antwort>(prompt, undefined, 1500);
    await namenLernen(a.namen, userId).catch(() => {});
    await kontakteAusEintrag(id, item.text, userId).catch(() => {});
    const typ = (TYPEN as readonly string[]).includes(a.typ) ? a.typ : (typHint || 'gedanke');
    const kategorie = (KATEGORIEN as readonly string[]).includes(a.kategorie) ? a.kategorie : 'notiz';
    const art = (ARTEN as readonly string[]).includes(a.art) ? a.art : null;
    const parken = kategorie === 'idee' ? new Date(Date.now() + 72 * 3600_000) : null;
    const ziel = ziele.find((z) => z.toLowerCase() === String(a.ziel || '').toLowerCase()) ?? (ziele.length ? null : (String(a.ziel || '').slice(0, 60) || null));
    const hebel = Number.isFinite(Number(a.hebel)) ? Math.max(0, Math.min(3, Math.round(Number(a.hebel)))) : null;
    const aufwand = [15, 60, 240].includes(Number(a.aufwand_min)) ? Number(a.aufwand_min) : null;
    const frist = /^\d{4}-\d{2}-\d{2}$/.test(String(a.frist || '')) ? String(a.frist) : null;
    const wer = a.wer === 'delegieren' ? 'delegieren' : 'ich';
    const an = wer === 'delegieren' ? (String(a.delegieren_an || '').slice(0, 60) || null) : null;
    // Fragen an den Coach: Der Coach antwortet im Gespräch, der Eintrag bleibt im Logbuch unter Archiviert und kommt nicht in die Stapel
    const anCoach = a.anCoach === true && !url;
    await sql`update items set status = 'sortiert', typ = ${typ}, kategorie = ${kategorie}, art = ${art},
      titel = ${(a.titel || titel || '').slice(0, 200) || null}, quelle = ${quelle ? quelle.split('\n')[0] : null},
      roh = coalesce(roh, text), text = ${(a.bereinigt || item.text).slice(0, 8000)}, url = ${url},
      schritt = ${(a.schritt || '').slice(0, 300) || null}, begruendung = ${(a.begruendung || '').slice(0, 200) || null},
      kern = ${(a.kern || '').slice(0, 1200) || null}, frage = ${(a.frage || '').slice(0, 400) || null},
      parken_bis = ${parken}, ziel = ${ziel}, hebel = ${hebel}, aufwand_min = ${aufwand}, frist = ${frist},
      wer = ${wer}, delegieren_an = ${an}, an_coach = ${anCoach}, fehler = null, updated_at = now() where id = ${id}`;
    if (anCoach) {
      await sql`update items set status = 'archiv', stapel = null where id = ${id}`;
      await coachChat(item.text, userId).catch(() => {});
      return;
    }
    // Etwas zu tun? Dann gleich in die Stapel einsortieren.
    if ((AKTIV as readonly string[]).includes(kategorie)) await sortiere('nachtrag', userId).catch(() => {});
  } catch (e) {
    await sql`update items set fehler = ${oeffentlich(e, 'Einordnen hat nicht geklappt.', 'einordnen')}, updated_at = now() where id = ${id}`;
  }
}

export async function createItem(text: string, userId: string): Promise<string> {
  await ensureSchema();
  const clean = text.trim().slice(0, 8000);
  const url = clean.match(URL_RE)?.[0] ?? null;
  const [row] = await sql`insert into items (user_id, text, url, typ) values (${userId}, ${clean}, ${url}, ${url && /(?:youtube\.com|youtu\.be)\//i.test(url) ? 'video' : url ? 'link' : 'gedanke'}) returning id`;
  return row.id as string;
}
