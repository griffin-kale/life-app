import Anthropic from '@anthropic-ai/sdk';
import { getSetting, setSetting } from './db';
import { maskieren, namenAus, zurueck, type Name } from './pseudonym';

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
export const claudeBereit = () => !!process.env.ANTHROPIC_API_KEY;

/** Alle Namen, die Claude nie sieht: Peters Liste, das Team und was Claude früher selbst als Namen erkannt hat. */
export async function geschuetzteNamen(): Promise<Name[]> {
  const [namen, team, auto] = await Promise.all([getSetting('namen'), getSetting('team'), getSetting('namen_auto')]);
  // Peter selbst gehört dazu: Claude soll nie erfahren, um wen es geht.
  const besitzer: Name[] = [{ name: 'Peter Gneuß', art: 'Person' }, { name: 'Gneuß', art: 'Person' }, { name: 'Peter', art: 'Person' }];
  return [...besitzer, ...namenAus(namen), ...namenAus(team), ...namenAus(auto)];
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

export async function askJson<T>(prompt: string, model = MODEL_FAST(), maxTokens = 900): Promise<T> {
  if (!claudeBereit()) throw new Error('Claude ist noch nicht verbunden (ANTHROPIC_API_KEY fehlt)');
  const { text: maskiert, zuordnung } = maskieren(prompt, await geschuetzteNamen());
  const msg = await getClient().messages.create({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: maskiert }] });
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Antwort ohne JSON');
  return zurueck(JSON.parse(text.slice(start, end + 1)) as T, zuordnung);
}

/** Wie askJson, dazu ein Foto (JPEG, im Browser verkleinert und ohne Ortsdaten). Der Text wird genauso pseudonymisiert. */
export async function askJsonBild<T>(prompt: string, jpegBase64: string, model = MODEL(), maxTokens = 600): Promise<T> {
  if (!claudeBereit()) throw new Error('Claude ist noch nicht verbunden (ANTHROPIC_API_KEY fehlt)');
  const { text: maskiert, zuordnung } = maskieren(prompt, await geschuetzteNamen());
  const msg = await getClient().messages.create({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 } },
    { type: 'text', text: maskiert },
  ] }] });
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Antwort ohne JSON');
  return zurueck(JSON.parse(text.slice(start, end + 1)) as T, zuordnung);
}
