'use client';
import { useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api, useToast } from '../ui';

export default function Einstellungen() {
  const [kontext, setKontext] = useState('');
  const [saved, setSaved] = useState('');
  const [origin, setOrigin] = useState('');
  const [toast, setToast] = useToast();
  useEffect(() => {
    setOrigin(window.location.origin);
    api<{ kontext: string }>('/api/settings').then((s) => { setKontext(s.kontext); setSaved(s.kontext); }).catch(() => {});
  }, []);
  const dirty = kontext !== saved;
  async function save() {
    try { await api('/api/settings', { method: 'PUT', body: JSON.stringify({ kontext }) }); setSaved(kontext); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  return (
    <main className="wrap">
      <TopBar title="Einstellungen" />
      <header className="head"><span className="eyebrow">Wie Lage für dich arbeitet</span><h1 className="title">Einstellungen</h1></header>

      <section className="gsec">
        <h2 className="glabel">Was gerade zählt</h2>
        <div className="group pad">
          <div className="field"><label htmlFor="ktx">Engpass, Prioritäten, Leitsatz</label>
            <textarea id="ktx" rows={6} value={kontext} onChange={(e) => setKontext(e.target.value)} placeholder={'Engpass: …\nPrioritäten diese Woche: …\nLeitsatz: …'} /></div>
          <button type="button" className="btn primary" onClick={save} disabled={!dirty}>{dirty ? 'Speichern' : <>{Icon.check}Gespeichert</>}</button>
        </div>
        <p className="gnote">Claude liest das bei jedem Eintrag mit und ordnet danach ein.</p>
      </section>

      <section className="gsec">
        <h2 className="glabel">Aktionstaste und Teilen-Menü</h2>
        <div className="group pad">
          <ol className="steps">
            <li>Kurzbefehle-App öffnen, neuer Kurzbefehl „Lage“.</li>
            <li>Aktion <b>Text diktieren</b> hinzufügen, Sprache Deutsch.</li>
            <li>Aktion <b>Inhalte von URL abrufen</b>: Adresse <code>{origin}/api/capture</code>, Methode POST, Header <code>Authorization</code> mit <code>Bearer</code> plus Erfassungsschlüssel, Text als Anfragetext.</li>
            <li>Einstellungen → Aktionstaste → Kurzbefehl → „Lage“.</li>
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

      <p className="foot">Lage 0.2 · Server in Deutschland</p>
      {toast}
      <TabBar />
    </main>
  );
}
