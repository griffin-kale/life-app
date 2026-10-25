'use client';
import { useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api, useToast } from '../ui';

type S = { kontext: string; ziele: string; team: string };
const LEER: S = { kontext: '', ziele: '', team: '' };

export default function Einstellungen() {
  const [v, setV] = useState<S>(LEER);
  const [saved, setSaved] = useState<S>(LEER);
  const [origin, setOrigin] = useState('');
  const [toast, setToast] = useToast();
  useEffect(() => {
    setOrigin(window.location.origin);
    // Hat Peter schon getippt, bevor die Werte da sind, bleibt sein Text stehen.
    api<S>('/api/settings').then((s) => { setV((cur) => (cur === LEER ? s : cur)); setSaved(s); }).catch(() => {});
  }, []);
  const dirty = v.kontext !== saved.kontext || v.ziele !== saved.ziele || v.team !== saved.team;
  const set = (k: keyof S) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  async function save() {
    try { await api('/api/settings', { method: 'PUT', body: JSON.stringify(v) }); setSaved(v); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  return (
    <main className="wrap">
      <TopBar title="Einstellungen" />
      <header className="head"><span className="eyebrow">Wie Life für dich arbeitet</span><h1 className="title">Einstellungen</h1></header>

      <section className="gsec">
        <h2 className="glabel">Was Claude beim Sortieren weiß</h2>
        <div className="group pad">
          <div className="field"><label htmlFor="ktx">Engpass, Prioritäten, Leitsatz</label>
            <textarea id="ktx" rows={5} value={v.kontext} onChange={set('kontext')} placeholder={'Engpass: …\nPrioritäten diese Woche: …\nLeitsatz: …'} /></div>
          <div className="field"><label htmlFor="ziele">Ziele, eins pro Zeile</label>
            <textarea id="ziele" rows={4} value={v.ziele} onChange={set('ziele')} placeholder={'Projekte\nPlattform\nBoutique\nPrivat'} /></div>
          <div className="field"><label htmlFor="team">Wem du etwas geben kannst, eine Person pro Zeile</label>
            <textarea id="team" rows={3} value={v.team} onChange={set('team')} placeholder={'Name: wofür sie oder er gut ist'} /></div>
          <button type="button" className="btn primary" onClick={save} disabled={!dirty}>{dirty ? 'Speichern' : <>{Icon.check}Gespeichert</>}</button>
        </div>
        <p className="gnote">Die Zeile mit „Engpass:“ steht oben auf Heute. Claude ordnet jeden Eintrag einem Ziel zu und sortiert jeden Morgen danach.</p>
      </section>

      <section className="gsec">
        <h2 className="glabel">Aktionstaste und Teilen-Menü</h2>
        <div className="group pad">
          <ol className="steps">
            <li>Kurzbefehle-App öffnen, neuer Kurzbefehl „Life“.</li>
            <li>Aktion <b>Text diktieren</b> hinzufügen, Sprache Deutsch.</li>
            <li>Aktion <b>Inhalte von URL abrufen</b>: Adresse <code>{origin}/api/capture</code>, Methode POST, Header <code>Authorization</code> mit <code>Bearer</code> plus Erfassungsschlüssel, Text als Anfragetext.</li>
            <li>Einstellungen → Aktionstaste → Kurzbefehl → „Life“.</li>
            <li>Im Kurzbefehl „Im Teilen-Menü anzeigen“ einschalten. Dann landen YouTube- und Safari-Links mit einem Tipp hier.</li>
          </ol>
        </div>
        <p className="gnote">Den Erfassungsschlüssel legt Claude beim Einrichten des Servers an. Er gehört nur in den Kurzbefehl.</p>
      </section>

      <section className="gsec">
        <h2 className="glabel">Deine Daten</h2>
        <div className="group">
          <a className="cell tint" href="/api/export" download><span>Export herunterladen</span>{Icon.chevronRight}</a>
          <button type="button" className="cell danger" onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login'; })}>Abmelden</button>
        </div>
        <p className="gnote">Der Export ist eine Textdatei mit allen Einträgen, lesbar in jedem Programm, auch ohne diese App.</p>
      </section>

      <p className="foot">Life 0.4 · Server in Deutschland</p>
      {toast}
      <TabBar />
    </main>
  );
}
