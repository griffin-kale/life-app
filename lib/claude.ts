import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, getSetting, setSetting, sql } from './db';
import { maskieren, namenAus, zurueck, type Name } from './pseudonym';
import { Hinweis, zwangAbgelehnt } from './fehler';

/**
 * Claude über die Anthropic-API (Entscheidung Peter, 25.10.2026).
 * Jeder Aufruf läuft durch die Pseudonymisierung: bekannte Namen, E-Mails, Telefonnummern und IBANs
 * verlassen den Server nur als Platzhalter. Anthropic löscht API-Daten nach 30 Tagen und trainiert nicht damit.
 */
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 90_000 }));

// Alte Bedrock-Namen aus der .env (eu.anthropic.…) funktionieren weiter: das Präfix fällt weg.
const ohnePraefix = (m: string | undefined) => m?.replace(/^(?:eu\.|us\.|apac\.)?anthropic\./, '') || '';
export const MODEL_FAST = () => ohnePraefix(process.env.CLAUDE_MODEL_FAST) || 'claude-haiku-5-5';
export const MODEL = () => ohnePraefix(process.env.CLAUDE_MODEL) || 'claude-sonnet-5-5';
/** Für Momente, in denen es zählt: Morgen-Coach, Wochenrunde, Entscheidungen im Gespräch (Peter, 26.10.2026). */
export const MODEL_DEEP = () => ohnePraefix(process.env.CLAUDE_MODEL_DEEP) || 'claude-opus-5-5';
export const claudeBereit = () => !!process.env.ANTHROPIC_API_KEY;

/** Alle Namen, die Claude nie sieht: Peters Liste, das Team und was Claude früher selbst als Namen erkannt hat. */
export async function geschuetzteNamen(): Promise<Name[]> {
  // Fällt die Datenbank aus, bricht der Claude-Aufruf ab. Ohne Namensliste gingen Namen im Klartext raus.
  await ensureSchema();
  // Teamlisten gelten pro Mensch, geschützt werden die Namen aus allen Listen im Haushalt
  const [namen, teams, auto, leute, haushalt] = await Promise.all([getSetting('namen'),
    sql<{ value: string }[]>`select value from settings where key = 'team' or key like 'team:%'`, getSetting('namen_auto'),
    sql<{ name: string }[]>`select name from personen`, sql<{ name: string }[]>`select name from nutzer`]);
  const team = teams.map((t) => t.value).join('\n');
  // Peter selbst gehört dazu: Claude soll nie erfahren, um wen es geht.
  const besitzer: Name[] = [{ name: 'Peter Gneuß', art: 'Person' }, { name: 'Gneuß', art: 'Person' }, { name: 'Peter', art: 'Person' }];
  return [...besitzer, ...haushalt.map((n) => ({ name: n.name, art: 'Person' as const })), ...namenAus(namen), ...namenAus(team), ...namenAus(auto), ...leute.map((l) => ({ name: l.name, art: 'Person' as const }))];
}

/** Merkt sich Namen, die Claude in einem Eintrag gefunden hat. Ab dem nächsten Aufruf sind sie Platzhalter. */
export async function namenLernen(neu: unknown): Promise<void> {
  if (!Array.isArray(neu)) return;
  const bekannt = new Set((await geschuetzteNamen()).map((n) => n.name.toLowerCase()));
  const zeilen: string[] = [];
  for (const x of neu.slice(0, 10)) {
    const name = String((x as { name?: unknown })?.name ?? '').trim().slice(0, 60);
    const art = String((x as { art?: unknown })?.art ?? '').toLowerCase();
    // Platzhalter, Ein-Buchstaben-Wörter und Bekanntes überspringen
    if (name.length < 2 || /^\[/.test(name) || bekannt.has(name.toLowerCase())) continue;
    bekannt.add(name.toLowerCase());
    zeilen.push(`${art === 'firma' ? 'Firma' : art === 'ort' ? 'Ort' : 'Person'}: ${name}`);
  }
  if (!zeilen.length) return;
  const alt = await getSetting('namen_auto');
  await setSetting('namen_auto', [alt, ...zeilen].filter(Boolean).join('\n').slice(-8000));
}

type Inhalt = string | Anthropic.Messages.ContentBlockParam[];

// Modelle, die tool_choice „tool“ abgelehnt haben. Gilt bis zum Neustart, danach fragt Life einmal neu.
const ohneZwang = new Set<string>();

/** Schickt die Anfrage. Lehnt das Modell das erzwungene Werkzeug ab, merkt Life sich das und fragt sofort mit „auto“ nach. */
async function senden(content: Inhalt, model: string, tokens: number): Promise<Anthropic.Messages.Message> {
  const zwang = !ohneZwang.has(model);
  try {
    return await getClient().messages.create({
      model, max_tokens: tokens,
      system: 'Antworte ausschließlich, indem du das Werkzeug „ergebnis“ genau einmal aufrufst. Schreib keinen Text davor oder danach.',
      tools: [{ name: 'ergebnis', description: 'Gib das Ergebnis genau im verlangten JSON-Format zurück.', input_schema: { type: 'object', additionalProperties: true } }],
      tool_choice: zwang ? { type: 'tool', name: 'ergebnis' } : { type: 'auto', disable_parallel_tool_use: true },
      messages: [{ role: 'user', content }],
    });
  } catch (e) {
    if (!zwang || !zwangAbgelehnt(e)) throw e;
    ohneZwang.add(model);
    console.warn('[claude] Werkzeug nicht erzwingbar, weiter mit auto', { model });
    return senden(content, model, tokens);
  }
}

/**
 * Claude antwortet über das Werkzeug „ergebnis“. So kommt ein JSON-Objekt zurück und kein Fließtext drumherum.
 * Wo das Modell es erlaubt, erzwingt Life das Werkzeug. Sonst bittet die Systemanweisung darum, und notfalls holt Life das JSON aus dem Text.
 * Wird die Antwort abgeschnitten, fragt Life einmal mit doppeltem Platz nach. Ins Log kommen nur Kennzahlen, nie Inhalte.
 */
async function anfragen(content: Inhalt, model: string, maxTokens: number): Promise<unknown> {
  for (let versuch = 0, tokens = maxTokens; versuch < 2; versuch++, tokens = Math.min(tokens * 2, 8000)) {
    const msg = await senden(content, model, tokens);
    const werkzeug = msg.content.find((b) => b.type === 'tool_use');
    if (msg.stop_reason === 'max_tokens' && versuch === 0) { console.warn('[claude] abgeschnitten, neuer Versuch', { model, tokens }); continue; }
    if (werkzeug && werkzeug.type === 'tool_use' && werkzeug.input && typeof werkzeug.input === 'object') return werkzeug.input;
    // Antwort ohne Werkzeug (bei „auto“ möglich): JSON aus dem Text holen
    const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch { /* unten melden */ } }
    console.warn('[claude] Antwort ohne JSON', { model, tokens, stop: msg.stop_reason, bloecke: msg.content.map((b) => b.type).join(',') });
    throw new Hinweis(msg.stop_reason === 'max_tokens' ? 'Antwort zu lang, abgeschnitten' : msg.stop_reason === 'refusal' ? 'Claude hat abgelehnt' : 'Antwort ohne JSON');
  }
  throw new Hinweis('Antwort zu lang, abgeschnitten');
}

export async function askJson<T>(prompt: string, model = MODEL_FAST(), maxTokens = 900): Promise<T> {
  if (!claudeBereit()) throw new Hinweis('Claude ist noch nicht verbunden (ANTHROPIC_API_KEY fehlt)');
  const { text: maskiert, zuordnung } = maskieren(prompt, await geschuetzteNamen());
  return zurueck((await anfragen(maskiert, model, maxTokens)) as T, zuordnung);
}

/** Wie askJson, aber mit dem stärksten Modell. Klappt das nicht (Modell nicht freigeschaltet, überlastet), antwortet das Standardmodell. */
export async function askJsonTief<T>(prompt: string, maxTokens = 900): Promise<T> {
  try { return await askJson<T>(prompt, MODEL_DEEP(), maxTokens); }
  catch (e) {
    if (e instanceof Hinweis) throw e;
    console.warn('[claude] starkes Modell nicht erreichbar, weiter mit Standard');
    return askJson<T>(prompt, MODEL(), maxTokens);
  }
}

/** Wie askJson, dazu ein Foto (JPEG, im Browser verkleinert und ohne Ortsdaten). Der Text wird genauso pseudonymisiert. */
export async function askJsonBild<T>(prompt: string, jpegBase64: string, model = MODEL(), maxTokens = 600): Promise<T> {
  if (!claudeBereit()) throw new Hinweis('Claude ist noch nicht verbunden (ANTHROPIC_API_KEY fehlt)');
  const { text: maskiert, zuordnung } = maskieren(prompt, await geschuetzteNamen());
  return zurueck((await anfragen([
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 } },
    { type: 'text', text: maskiert },
  ], model, maxTokens)) as T, zuordnung);
}
