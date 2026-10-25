'use client';
import { useEffect, useState } from 'react';
import { Icon, Log, TabBar, TopBar, api, type Item } from '../ui';

const FILTER: [string, string][] = [['', 'Alle'], ['gedanke', 'Gedanken'], ['zitat', 'Zitate'], ['video', 'Videos'], ['buch', 'Bücher'], ['link', 'Artikel'], ['archiv', 'Archiviert']];

export default function Archiv() {
  const [f, setF] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams({ limit: '200' });
      if (f === 'archiv') p.set('archiv', '1'); else if (f) p.set('typ', f);
      if (q.trim()) p.set('q', q.trim());
      api<Item[]>('/api/items?' + p).then(setItems).catch(() => setItems([]));
    }, q ? 220 : 0);
    return () => clearTimeout(t);
  }, [f, q]);

  const label = FILTER.find(([k]) => k === f)?.[1] ?? 'Alle';
  const empty = q.trim()
    ? <div className="empty"><b>Nichts gefunden.</b>Kein Eintrag enthält „{q.trim()}“{f ? ` unter ${label}` : ''}.</div>
    : f === 'archiv'
      ? <div className="empty"><b>Nichts archiviert.</b>Was du im Eintrag archivierst, liegt hier und stört im Logbuch nicht mehr.</div>
      : <div className="empty"><b>Hier ist noch nichts.</b>{f ? `${label} landen hier, sobald du welche festhältst.` : 'Alles, was du festhältst, findest du hier wieder.'}</div>;

  return (
    <main className="wrap">
      <TopBar title="Archiv" />
      <header className="head"><span className="eyebrow">Alles, was du festgehalten hast</span><h1 className="title">Archiv</h1></header>
      <div className="tools-col">
        <div className="searchbox">{Icon.search}<input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen" aria-label="Suchen" enterKeyHint="search" /></div>
        <div className="filters" role="group" aria-label="Filter">
          {FILTER.map(([k, l]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
        </div>
      </div>
      <section className="section" aria-label="Einträge">
        {items === null ? <div className="loading">Lädt …</div> : items.length === 0 ? empty : <Log items={items} from="archiv" />}
      </section>
      <TabBar />
    </main>
  );
}
