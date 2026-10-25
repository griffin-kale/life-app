import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

// Claude über Amazon Bedrock. Das EU-Profil hält die Verarbeitung in EU-Rechenzentren.
let client: AnthropicBedrock | null = null;
const getClient = () => (client ??= new AnthropicBedrock({ awsRegion: process.env.AWS_REGION || 'eu-central-1' }));

export const MODEL_FAST = () => process.env.CLAUDE_MODEL_FAST || 'eu.anthropic.claude-haiku-5-5';
export const MODEL = () => process.env.CLAUDE_MODEL || 'eu.anthropic.claude-sonnet-5-5';

export async function askJson<T>(prompt: string, model = MODEL_FAST(), maxTokens = 900): Promise<T> {
  const msg = await getClient().messages.create({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Antwort ohne JSON');
  return JSON.parse(text.slice(start, end + 1)) as T;
}
