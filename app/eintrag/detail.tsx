'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ART, Icon, KAT, STAPEL, TYP, TabBar, TopBar, api, aufwandLabel, bodyText, fWhen, fristLabel, isParked, isPending, sourceLabel, useToast, type Item } from '../ui';

const AKTIV = ['engpass', 'entscheidung', 'aufgabe', 'projekt', 'privat'];

/** Alles zu einem Eintrag. Als eigene Seite auf dem iPhone, eingebettet als Inspektor auf iPad und Mac. */
export function EintragDetail({ id, back, eingebettet, onGeaendert }: { id: string; back: { label: string; href: string }; eingebettet?: boolean; onGeaendert?: () => void }) {
  const router = useRouter();
  const [it, setIt] = useState<Item | null>(null);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [toast, setToast] = useToast();
  const [ziele, setZiele] = useState<string[]>([]);
  useEffect(() => { api<{ ziele: string }>('/api/settings').then((s) => setZiele(s.ziele.split('\n').map((z) => z.replace(/^[-•*\s]+/, '').trim()).filter(Boolean))).catch(() => {}); }, []);

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
      onGeaendert?.();
      const v = (r as { verdraengt?: string | null }).verdraengt;
      setToast(v ? `„${v.slice(0, 40)}“ rückt in die Woche` : msg);
    } catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function remove() {
    try { await api(`/api/items/${id}`, { method: 'DELETE' }); onGeaendert?.(); if (!eingebettet) router.replace(back.href); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }

  const shell = (content: React.ReactNode) => (eingebettet
    ? <div className="inspektor-inhalt">{content}</div>
    : <main className="wrap"><TopBar title="" back={back} />{content}<TabBar /></main>);
  if (err) return shell(<p className="err" role="alert">Eintrag nicht gefunden. {err}</p>);
  if (!it) return shell(<div className="loading">Lädt …</div>);

  const pending = isPending(it);
  const text = bodyText(it);
  const src = sourceLabel(it);
  const heading = it.titel || (it.typ === 'zitat' ? 'Zitat' : text.slice(0, 90) || 'Eintrag');
  const showText = text && !(it.typ === 'gedanke' && !it.titel && text.length <= 90);

  return shell(<>
      <header className="head">
        <span className="eyebrow">{AKTIV.includes(it.kategorie ?? '') ? KAT[it.kategorie!] : TYP[it.typ] ?? it.typ} · {fWhen(it.created_at)}</span>
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

      {AKTIV.includes(it.kategorie ?? '') && it.status !== 'archiv' ? (
        <section className="gsec">
          <h2 className="glabel">Priorität</h2>
          <div className="group">
            {it.status === 'erledigt'
              ? <button type="button" className="cell tint" onClick={() => patch({ erledigt: false }, 'Wieder offen')}><span>Erledigt {it.erledigt_at ? fWhen(it.erledigt_at) : ''}</span><span className="val"><span>Wieder öffnen</span></span></button>
              : <>
                <label className="cell"><span>Stapel</span><span className="val"><span>{it.stapel ? STAPEL[it.stapel] : 'wird einsortiert'}</span>{Icon.updown}</span>
                  <select aria-label="Stapel" value={it.stapel ?? ''} onChange={(e) => patch({ stapel: e.target.value }, STAPEL[e.target.value])}>
                    <option value="" disabled>wird einsortiert</option>{Object.entries(STAPEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select></label>
                {ziele.length ? (
                  <label className="cell"><span>Ziel</span><span className="val"><span>{it.ziel ?? 'keins'}</span>{Icon.updown}</span>
                    <select aria-label="Ziel" value={it.ziel ?? ''} onChange={(e) => patch({ ziel: e.target.value }, 'Gespeichert')}>
                      <option value="">keins</option>{ziele.map((z) => <option key={z} value={z}>{z}</option>)}
                    </select></label>
                ) : null}
                <div className="cell static"><span>Hebel auf den Engpass</span><span className="val"><span>{it.hebel == null ? 'offen' : ['keiner', 'gering', 'mittel', 'direkt'][it.hebel]}</span></span></div>
                {aufwandLabel(it.aufwand_min) ? <div className="cell static"><span>Aufwand</span><span className="val"><span>{aufwandLabel(it.aufwand_min)}</span></span></div> : null}
                {it.frist ? <div className="cell static"><span>Frist</span><span className={'val' + (fristLabel(it.frist)?.spaet ? ' spaet' : '')}><span>{fristLabel(it.frist)?.text}</span></span></div> : null}
                {it.wer === 'delegieren' ? <div className="cell static"><span>Delegieren</span><span className="val"><span>{it.delegieren_an ?? 'jemand im Team'}</span></span></div> : null}
                <button type="button" className="cell tint strong" onClick={() => patch({ erledigt: true }, 'Erledigt')}>Erledigt</button>
              </>}
          </div>
          {it.grund && it.status !== 'erledigt' ? <p className="gnote">{it.grund}</p> : null}
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
    </>);
}
