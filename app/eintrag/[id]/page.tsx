'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ART, Icon, KAT, TYP, TabBar, TopBar, api, bodyText, fWhen, isParked, isPending, sourceLabel, useToast, type Item } from '../../ui';

const BACK: Record<string, { label: string; href: string }> = { archiv: { label: 'Archiv', href: '/archiv' } };

export default function Eintrag({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ von?: string }> }) {
  const { id } = use(params);
  const { von } = use(searchParams);
  const back = BACK[von ?? ''] ?? { label: 'Logbuch', href: '/' };
  const router = useRouter();
  const [it, setIt] = useState<Item | null>(null);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [toast, setToast] = useToast();

  const load = useCallback(() => api<Item>(`/api/items/${id}`).then(setIt), [id]);
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [load]);
  // Während Claude neu einordnet: alle 2 Sekunden nachsehen.
  useEffect(() => {
    if (!it || !isPending(it)) return;
    const t = setTimeout(() => load().catch(() => {}), 2000);
    return () => clearTimeout(t);
  }, [it, load]);

  async function patch(body: Record<string, unknown>, msg: string) {
    try {
      const r = await api<Item | { ok: true }>(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      if ('id' in r) setIt(r); else await load();
      setToast(msg);
    } catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function remove() {
    try { await api(`/api/items/${id}`, { method: 'DELETE' }); router.replace(back.href); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }

  const shell = (content: React.ReactNode) => (
    <main className="wrap"><TopBar title="" back={back} />{content}<TabBar /></main>
  );
  if (err) return shell(<p className="err" role="alert">Eintrag nicht gefunden. {err}</p>);
  if (!it) return shell(<div className="loading">Lädt …</div>);

  const pending = isPending(it);
  const text = bodyText(it);
  const src = sourceLabel(it);
  const heading = it.titel || (it.typ === 'zitat' ? 'Zitat' : text.slice(0, 90) || 'Eintrag');
  const showText = text && !(it.typ === 'gedanke' && !it.titel && text.length <= 90);

  return (
    <main className="wrap">
      <TopBar title={heading} back={back} />
      <header className="head">
        <span className="eyebrow">{TYP[it.typ] ?? it.typ} · {fWhen(it.created_at)}</span>
        <h1 className="big">{heading}</h1>
      </header>

      {pending ? <p className="note working" role="status">Claude ordnet ein …</p> : null}
      {it.fehler ? <p className="err" role="alert">Claude konnte das nicht einordnen ({it.fehler}). Tipp unten auf „Neu einordnen“.</p> : null}

      {it.kern ? (
        <section className="gsec">
          <h2 className="glabel">Kernidee</h2>
          <div className="group pad"><p className="kern">{it.kern}</p>{it.frage ? <p className="frage">{it.frage}</p> : null}</div>
        </section>
      ) : null}

      {it.schritt ? (
        <section className="gsec">
          <h2 className="glabel">Nächster Schritt</h2>
          <div className="group pad"><p className="step">{Icon.arrow}<span>{it.schritt}</span></p></div>
          {it.begruendung ? <p className="gnote">{it.begruendung}</p> : null}
        </section>
      ) : null}

      {showText || (it.roh && it.roh !== it.text) ? (
        <section className="gsec">
          <h2 className="glabel">{it.typ === 'zitat' ? 'Zitat' : 'Eintrag'}</h2>
          <div className="group pad">
            {showText ? <p className={'prose' + (it.typ === 'zitat' ? ' quote' : '')}>{it.typ === 'zitat' ? `„${text.replace(/^[„"“]+|[“"”]+$/g, '')}“` : text}</p> : null}
            {it.roh && it.roh !== it.text ? (
              <details className="disclose"><summary>{Icon.chevronRight}Ursprünglich diktiert</summary><p className="prose muted small">{it.roh}</p></details>
            ) : null}
          </div>
        </section>
      ) : null}

      {it.url ? (
        <section className="gsec">
          <h2 className="glabel">Quelle</h2>
          <div className="group">
            <a className="cell tint" href={it.url} target="_blank" rel="noopener noreferrer"><span className="lbl">{src}</span>{Icon.external}</a>
          </div>
        </section>
      ) : null}

      <section className="gsec">
        <h2 className="glabel">Einordnung</h2>
        <div className="group">
          <label className="cell"><span>Kategorie</span><span className="val"><span>{it.kategorie ? KAT[it.kategorie] : 'offen'}</span>{Icon.updown}</span>
            <select aria-label="Kategorie" value={it.kategorie ?? ''} onChange={(e) => patch({ kategorie: e.target.value }, 'Umsortiert')}>
              <option value="" disabled>offen</option>{Object.entries(KAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          <label className="cell"><span>Art von Wohlstand</span><span className="val"><span>{it.art ? ART[it.art] : 'offen'}</span>{Icon.updown}</span>
            <select aria-label="Art von Wohlstand" value={it.art ?? ''} onChange={(e) => patch({ art: e.target.value }, 'Gespeichert')}>
              <option value="" disabled>offen</option>{Object.entries(ART).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          <label className="cell"><span>Typ</span><span className="val"><span>{TYP[it.typ] ?? it.typ}</span>{Icon.updown}</span>
            <select aria-label="Typ" value={it.typ} onChange={(e) => patch({ typ: e.target.value }, 'Gespeichert')}>
              {Object.entries(TYP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
        </div>
        {isParked(it) ? <p className="gnote">Ideen bleiben 72 Stunden geparkt, bis {fWhen(it.parken_bis!)}. Danach entscheidest du, ob sie wichtig bleiben.</p> : null}
      </section>

      <section className="gsec">
        <div className="group">
          <button type="button" className="cell tint" disabled={pending} onClick={() => patch({ neuSortieren: true }, 'Wird neu eingeordnet')}>Neu einordnen</button>
          {it.status === 'archiv'
            ? <button type="button" className="cell tint" onClick={() => patch({ status: 'sortiert' }, 'Zurückgeholt')}>Zurückholen</button>
            : <button type="button" className="cell tint" onClick={() => patch({ status: 'archiv' }, 'Archiviert')}>Archivieren</button>}
        </div>
      </section>

      <section className="gsec">
        <div className="group">
          {confirmDel ? <>
            <button type="button" className="cell danger strong" onClick={remove}>Endgültig löschen</button>
            <button type="button" className="cell tint" onClick={() => setConfirmDel(false)}>Abbrechen</button>
          </> : <button type="button" className="cell danger" onClick={() => setConfirmDel(true)}>Löschen</button>}
        </div>
        {confirmDel ? <p className="gnote">Lässt sich nicht rückgängig machen. Archivieren hebt den Eintrag auf, ohne dass er stört.</p> : null}
      </section>
      {toast}
      <TabBar />
    </main>
  );
}
