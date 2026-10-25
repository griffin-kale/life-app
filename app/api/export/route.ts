import { NextResponse } from 'next/server';
import { ensureSchema, sql, type Item } from '@/lib/db';

// Alle Einträge als eine Markdown-Datei. Deine Daten gehören dir, auch ohne diese App.
export async function GET() {
  await ensureSchema();
  const items = await sql<Item[]>`select * from items order by created_at asc`;
  const fmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' });
  const out: string[] = ['# Life – Export', '', `Stand: ${fmt.format(new Date())} · ${items.length} Einträge`, ''];
  let month = '';
  for (const i of items) {
    const m = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', month: 'long', year: 'numeric' }).format(new Date(i.created_at));
    if (m !== month) { out.push(`## ${m}`, ''); month = m; }
    out.push(`### ${i.titel || i.text.slice(0, 60)}`, `- ${fmt.format(new Date(i.created_at))} · ${i.typ}${i.kategorie ? ' · ' + i.kategorie : ''}${i.art ? ' · ' + i.art : ''}${i.status === 'archiv' ? ' · archiviert' : ''}${i.status === 'erledigt' ? ' · erledigt' : ''}${i.ziel ? ' · Ziel: ' + i.ziel : ''}`);
    if (i.url) out.push(`- ${i.url}`);
    out.push('', i.text, '');
    if (i.kern) out.push(`**Kernidee:** ${i.kern}`, '');
    if (i.frage) out.push(`**Frage an mich:** ${i.frage}`, '');
    if (i.schritt) out.push(`**Nächster Schritt:** ${i.schritt}`, '');
  }
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(out.join('\n'), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': `attachment; filename="life-export-${day}.md"` } });
}
