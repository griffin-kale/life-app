'use client';
import { useEffect, useState } from 'react';
import { Entry, TabBar, api, type Item } from '../ui';

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
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [f, q]);
  return (
    <main className="wrap">
      <header className="head"><span className="eyebrow">Alles, was du festgehalten hast</span><h1 className="title">Archiv</h1></header>
      <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen …" aria-label="Suchen" />
      <div className="filters" role="group" aria-label="Filter">
        {FILTER.map(([k, l]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
      </div>
      <section className="section">
        {items === null ? <div className="empty">Lädt …</div> : items.length === 0 ? <div className="empty">Hier ist noch nichts.</div> : <ul className="log">{items.map((it) => <Entry key={it.id} it={it} />)}</ul>}
      </section>
      <TabBar />
    </main>
  );
}
