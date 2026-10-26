import { standAus, standZeilen } from './standort';
import { montagVon } from './tagesregeln';
import { askJson, MODEL } from './claude';
import { ensureSchema, getSetting, setSetting, sql, type Item } from './db';
import { oeffentlich } from './fehler';

export const STAPEL = ['jetzt', 'woche', 'delegieren', 'geparkt', 'streichen'] as const;
export type Stapel = (typeof STAPEL)[number];
/** Kategorien, aus denen etwas zu tun entsteht. Notizen und Wissen bleiben im Logbuch. */
export const AKTIV = ['engpass', 'entscheidung', 'aufgabe', 'projekt', 'privat'] as const;
export const JETZT_MAX = 3;

import { TZ, fristRelativ, heuteBerlin } from './zeit';
export { heuteBerlin };
// Phase 3: Claude bekommt nur den Wochentag, Fristen relativ zu heute, kein Datum
const wochentag = () => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'long' }).format(new Date());

export const liste = (s: string) => s.split('\n').map((z) => z.replace(/^[-•*\s]+/, '').trim()).filter(Boolean);
export const engpassAus = (kontext: string) => kontext.match(/engpass\s*:\s*(.+)/i)?.[1]?.trim() ?? '';

/** Alles, was gerade offen ist und eine Priorität braucht. Ideen erst nach ihren 72 Stunden. */
export async function offene(): Promise<Item[]> {
  await ensureSchema();
  return sql<Item[]>`
    select * from items
    where status = 'sortiert' and merged_into is null
      and (kategorie in ${sql([...AKTIV])} or (kategorie = 'idee' and parken_bis < now()))
    order by created_at desc limit 80`;
}

type Plan = { liste?: { n: number; stapel: string; rang: number; grund: string }[]; doppelt?: { behalten: number; weg: number[] }[] };

const AUFWAND = (m: number | null) => (m ? (m <= 20 ? '15 Min' : m <= 90 ? '1 Std' : 'halber Tag') : '-');
const VERB: Record<string, string> = { jetzt: 'nach Jetzt geholt', woche: 'in die Woche geschoben', delegieren: 'zum Delegieren gelegt', geparkt: 'geparkt', streichen: 'zum Streichen gelegt', archiv: 'gestrichen', 'eine-sache': 'zur einen Sache des Tages gemacht' };

/** Ein Sortierlauf. "tag" denkt den Tag neu, "nachtrag" ordnet Neues ein und hält die Jetzt-Liste stabil. */
async function lauf(modus: 'tag' | 'nachtrag'): Promise<void> {
  const items = await offene();
  const tag = heuteBerlin();
  if (!items.length) return;
  const [kontext, ziele, team, fokusRoh, standRoh, wzRoh] = await Promise.all([getSetting('kontext'), getSetting('ziele'), getSetting('team'), getSetting('fokus:peter'), getSetting('stand:peter'), getSetting('wochenziel:peter')]);
  let wz = ''; try { const w = JSON.parse(wzRoh || '{}'); if (w.montag === montagVon(tag) && typeof w.text === 'string') wz = w.text; } catch { wz = ''; }
  const stand = standZeilen(standAus(standRoh), tag, wz).filter((z) => !z.startsWith('Selbsteinschätzung'));
  // Drei Dinge der Woche aus dem Wochenstart: nur für die laufende Woche
  let fokus: string[] = [];
  try { const f = JSON.parse(fokusRoh || '{}'); if (f.montag === montagVon(tag) && Array.isArray(f.ids)) fokus = f.ids; } catch { fokus = []; }
  const korr = await sql<{ von: string | null; zu: string; text: string; titel: string | null; schritt: string | null }[]>`
    select k.von, k.zu, i.text, i.titel, i.schritt from korrekturen k join items i on i.id = k.item_id
    order by k.created_at desc limit 20`;
  const [abend] = modus === 'tag' ? await sql<{ p: { aufgabe?: string; zeit?: string; notiz?: string } | null }[]>`
    select antworten->'plan' as p from checkins where art = 'abend' and tag = (${tag}::date - 1)` : [];
  const gestern = abend?.p ? [abend.p.aufgabe, abend.p.notiz].filter(Boolean).join(' / ') : '';
  const alter = (d: string) => Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 864e5));
  const zeilen = items.map((it, n) => {
    const manuell = it.manuell_tag === tag ? ` | HEUTE VON PETER GESETZT: ${it.manuell_stapel} (nicht ändern)` : '';
    return `${n}. ${it.schritt || it.titel || it.text.slice(0, 120)}${fokus.includes(it.id) ? ' | DREI DINGE DER WOCHE (Peter)' : ''} | Eintrag: ${it.text.slice(0, 220).replace(/\n/g, ' ')} | Kategorie: ${it.kategorie} | Ziel: ${it.ziel || '-'} | Hebel: ${it.hebel ?? '-'} | Aufwand: ${AUFWAND(it.aufwand_min)} | Frist: ${fristRelativ(it.frist, tag)} | Wer: ${it.wer === 'delegieren' ? `delegieren${it.delegieren_an ? ' an ' + it.delegieren_an : ''}` : 'Peter'} | Bisher: ${it.stapel || 'neu'} | Alter: ${alter(it.created_at)} Tage${manuell}`;
  });
  const prompt = [
    'SORTIERLAUF',
    'Du bist Peters Stabschef. Du sortierst seine offenen Einträge so, dass er heute an den richtigen drei Dingen arbeitet. Deutsch, knapp, keine Floskeln.',
    `Heute ist ${wochentag()}.`,
    'Was gerade zählt (von Peter, mit Engpass, Prioritäten, Leitsatz):\n' + (kontext || 'nicht angegeben'),
    'Peters Ziele:\n' + (ziele || 'nicht angegeben'),
    stand.length ? 'Aus Peters Standortbestimmung (Quartalsziele, Wochenziel, was liegen bleibt):\n' + stand.join('\n') : '',
    team ? 'Wem Peter etwas geben kann:\n' + team : 'Team: nicht angegeben. Schlage "delegieren" nur vor, wenn der Eintrag selbst eine Person nennt.',
    [
      'Regeln:',
      '1. Engpass zuerst. Was den Engpass verkleinert, kommt vor allem anderen. Hebel 3 heißt: wirkt direkt auf den Engpass. Was Peter als „Drei Dinge der Woche“ gewählt hat, kommt in dieser Woche bevorzugt nach „jetzt“, nie nach „geparkt“ oder „streichen“. Was aufs Wochenziel einzahlt, kommt ebenfalls nach vorn. Was Peter in diesem Quartal bewusst liegen lässt, kommt nach „geparkt“.',
      `2. "jetzt": höchstens ${JETZT_MAX} Einträge für heute. Bevorzuge Frist heute oder morgen, hohen Hebel und Schritte, die andere freischalten. Höchstens ein halber Tag unter den dreien. Am Wochenende nur, was wirklich heute sein muss, gern Privates.`,
      '3. "woche": sinnvoll in dieser Woche. "delegieren": jemand anderes kann es gut. "geparkt": nicht diese Woche, aber behalten. "streichen": zahlt auf kein Ziel ein, ist veraltet oder doppelt erledigt. Streichen sparsam vorschlagen.',
      '4. Was Peter heute selbst gesetzt hat, bleibt genau dort.',
      modus === 'nachtrag'
        ? '5. Nachtrag: Peter arbeitet gerade. Lass die bisherige Jetzt-Liste stehen. Tausche nur, wenn ein neuer Eintrag klar dringender ist (Frist heute oder Hebel 3 und klein).'
        : '5. Neuer Tag: Denk die Jetzt-Liste neu. Was gestern liegen blieb, prüfst du ehrlich: noch wichtig oder in die Woche.',
      '6. Gleiche Sache doppelt festgehalten: in "doppelt" zusammenführen, den klareren Eintrag behalten.',
      '7. "grund": höchstens 10 Wörter, konkret mit Hebel, Frist oder Aufwand. Kein Lob, keine Floskel.',
      '8. Rang 1 in "jetzt" ist die eine Sache des Tages nach Gary Keller (The ONE Thing). Wähle sie mit der Leitfrage: Was ist die eine Sache, durch die alles andere leichter oder unnötig wird? Die anderen in "jetzt" sind die Dominosteine danach. Hat Peter heute selbst eine Sache nach vorn geholt, bleibt sie Rang 1.',
    ].join('\n'),
    gestern ? `Gestern Abend hat Peter als Wichtigstes für heute festgelegt: „${gestern}“${abend?.p?.zeit ? `, ${abend.p.zeit}` : ''}. Setz den passenden offenen Eintrag auf "jetzt", Rang 1.` : '',
    korr.length ? 'So hat Peter zuletzt korrigiert. Lerne daraus, was ihm wichtiger ist als dir:\n' + korr.map((k) => `- „${(k.schritt || k.titel || k.text).slice(0, 90)}“ ${VERB[k.zu] ?? k.zu}${k.von ? ` (war: ${k.von})` : ''}`).join('\n') : '',
    'Offene Einträge:\n' + zeilen.join('\n'),
    'Antworte nur mit JSON: {"liste": [{"n": Nummer, "stapel": "jetzt"|"woche"|"delegieren"|"geparkt"|"streichen", "rang": 1 bis N innerhalb des Stapels, "grund": string}], "doppelt": [{"behalten": Nummer, "weg": [Nummern]}]}. Jeder Eintrag kommt genau einmal in "liste" vor.',
  ].filter(Boolean).join('\n\n');

  const plan = await askJson<Plan>(prompt, MODEL(), 4000);
  const zuordnung = new Map<number, { stapel: Stapel; rang: number; grund: string }>();
  for (const z of plan.liste ?? []) {
    if (!Number.isInteger(z.n) || !items[z.n] || !(STAPEL as readonly string[]).includes(z.stapel)) continue;
    zuordnung.set(z.n, { stapel: z.stapel as Stapel, rang: Number(z.rang) || 99, grund: String(z.grund || '').slice(0, 160) });
  }
  // Peters Entscheidungen von heute gelten, egal was Claude meint.
  items.forEach((it, n) => {
    if (it.manuell_tag === tag && it.manuell_stapel) {
      const z = zuordnung.get(n);
      zuordnung.set(n, { stapel: it.manuell_stapel as Stapel, rang: z?.rang ?? 99, grund: z?.grund ?? it.grund ?? '' });
    }
  });
  // Höchstens drei für jetzt: Peters eigene zuerst, dann nach Rang.
  const jetzt = [...zuordnung.entries()].filter(([, z]) => z.stapel === 'jetzt')
    .sort(([a, x], [b, y]) => Number(items[b].manuell_tag === tag) - Number(items[a].manuell_tag === tag) || x.rang - y.rang);
  jetzt.slice(JETZT_MAX).forEach(([n, z]) => zuordnung.set(n, { ...z, stapel: 'woche', rang: 0 }));

  const weg = new Map<number, number>();
  for (const d of plan.doppelt ?? []) {
    if (!items[d.behalten]) continue;
    for (const w of d.weg ?? []) if (items[w] && w !== d.behalten && items[w].manuell_tag !== tag) weg.set(w, d.behalten);
  }

  await sql.begin(async (tx) => {
    for (const [n, z] of zuordnung) {
      if (weg.has(n)) continue;
      await tx`update items set stapel = ${z.stapel}, rang = ${z.rang}, grund = ${z.grund || null}, sortiert_am = now() where id = ${items[n].id}`;
    }
    for (const [w, b] of weg) {
      await tx`update items set merged_into = ${items[b].id}, status = 'archiv', stapel = null, updated_at = now() where id = ${items[w].id}`;
    }
  });
}

/**
 * Sortiert, ohne dass zwei Läufe gleichzeitig arbeiten. Kommt währenddessen etwas Neues,
 * läuft direkt danach ein Nachtrag.
 */
export async function sortiere(modus: 'tag' | 'nachtrag'): Promise<void> {
  await ensureSchema();
  const conn = await sql.reserve();
  try {
    const [{ ok }] = await conn`select pg_try_advisory_lock(4711) as ok`;
    if (!ok) { await setSetting('sort_nochmal', '1'); return; }
    try {
      await setSetting('sort_laeuft', new Date().toISOString());
      let m = modus;
      for (let i = 0; i < 3; i++) {
        await setSetting('sort_nochmal', '');
        try { await lauf(m); await setSetting('sort_fehler', ''); }
        catch (e) { await setSetting('sort_fehler', oeffentlich(e, 'Claude hat einen Fehler gemeldet. Versuch es später noch einmal.', 'sortieren')); }
        if ((await getSetting('sort_nochmal')) !== '1') break;
        m = 'nachtrag';
      }
      await setSetting('sort_am', new Date().toISOString());
    } finally {
      await setSetting('sort_laeuft', '');
      await conn`select pg_advisory_unlock(4711)`;
    }
  } finally { conn.release(); }
}

/** Beim ersten Öffnen des Tages einmal neu denken. Gibt true zurück, wenn ein Lauf ansteht. */
export async function tagesStartNoetig(): Promise<boolean> {
  const tag = heuteBerlin();
  if ((await getSetting('sort_tag')) === tag) return false;
  await setSetting('sort_tag', tag);
  return true;
}

/** Ein Lauf gilt nach 3 Minuten als hängengeblieben. */
export async function laeuftGerade(): Promise<boolean> {
  const t = await getSetting('sort_laeuft');
  return !!t && Date.now() - new Date(t).getTime() < 180_000;
}
