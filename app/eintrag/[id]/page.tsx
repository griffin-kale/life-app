'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ART, KAT, TabBar, TYP, api, fWhen, useToast, type Item } from '../../ui';

export default function Eintrag({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [it, setIt] = useState<Item | null>(null);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [toast, setToast] = useToast();
  useEffect(() => { api<Item>(`/api/items/${id}`).then(setIt).catch((e) => setErr(e.message)); }, [id]);
  async function patch(body: Record<string, unknown>, msg: string) {
    try { const r = await api<Item | { ok: true }>(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); if ('id' in r) setIt(r); setToast(msg); }
    catch (e) { setToast((e as Error).message); }
  }
  if (err) return <main className="wrap"><p className="err">{err}</p><TabBar /></main>;
  if (!it) return <main className="wrap"><p className="muted">Lädt …</p><TabBar /></main>;
  const parked = it.kategorie === 'idee' && it.parken_bis && new Date(it.parken_bis) > new Date();
  return (
    <main className="wrap">
      <header className="head">
        <span className="eyebrow">{TYP[it.typ] ?? it.typ} · {fWhen(it.created_at)}</span>
        <h1 className="big">{it.titel || (it.typ === 'zitat' ? `„${it.text}“` : it.text.slice(0, 90))}</h1>
      </header>
      {it.kern ? <section className="card"><h3>Kernidee</h3><p className="kern">{it.kern}</p>{it.frage ? <p className="muted">{it.frage}</p> : null}</section> : null}
      {it.schritt ? <section className="card"><h3>Nächster Schritt</h3><p className="prose">{it.schritt}</p>{it.begruendung ? <p className="muted small">{it.begruendung}</p> : null}</section> : null}
      <section className="card">
        <h3>Eintrag</h3>
        <p className="prose">{it.text}</p>
        {it.url ? <p className="small"><a href={it.url} target="_blank" rel="noopener noreferrer">{it.quelle || it.url}</a></p> : null}
        {it.roh && it.roh !== it.text ? <details><summary className="muted small">Ursprünglich diktiert</summary><p className="prose muted small">{it.roh}</p></details> : null}
        {parked ? <p className="muted small">Geparkt bis {fWhen(it.parken_bis!)}. Danach entscheidest du, ob es wichtig bleibt.</p> : null}
        {it.fehler ? <p className="err">Claude konnte das nicht einordnen ({it.fehler}).</p> : null}
      </section>
      <section className="card">
        <h3>Einordnung</h3>
        <div className="field"><label htmlFor="kat">Kategorie</label>
          <select id="kat" value={it.kategorie ?? ''} onChange={(e) => patch({ kategorie: e.target.value }, 'Umsortiert')}>
            <option value="" disabled>noch offen</option>{Object.entries(KAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <div className="field"><label htmlFor="art">Art von Wohlstand</label>
          <select id="art" value={it.art ?? ''} onChange={(e) => patch({ art: e.target.value }, 'Gespeichert')}>
            <option value="" disabled>noch offen</option>{Object.entries(ART).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => patch({ neuSortieren: true }, 'Wird neu eingeordnet').then(() => setTimeout(() => api<Item>(`/api/items/${id}`).then(setIt).catch(() => {}), 4000))}>Neu einordnen</button>
          {it.status === 'archiv'
            ? <button type="button" className="btn" onClick={() => patch({ status: 'sortiert' }, 'Zurückgeholt')}>Zurückholen</button>
            : <button type="button" className="btn" onClick={() => patch({ status: 'archiv' }, 'Archiviert')}>Archivieren</button>}
          {confirmDel
            ? <><button type="button" className="btn danger" onClick={async () => { await api(`/api/items/${id}`, { method: 'DELETE' }); router.push('/'); }}>Endgültig löschen</button><button type="button" className="btn ghost" onClick={() => setConfirmDel(false)}>Abbrechen</button></>
            : <button type="button" className="btn ghost danger" onClick={() => setConfirmDel(true)}>Löschen</button>}
        </div>
      </section>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
      <TabBar />
    </main>
  );
}
