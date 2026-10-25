'use client';
import { useEffect, useState } from 'react';
import { TabBar, api, useToast } from '../ui';

export default function Einstellungen() {
  const [kontext, setKontext] = useState('');
  const [origin, setOrigin] = useState('');
  const [toast, setToast] = useToast();
  useEffect(() => { setOrigin(window.location.origin); api<{ kontext: string }>('/api/settings').then((s) => setKontext(s.kontext)).catch(() => {}); }, []);
  return (
    <main className="wrap">
      <header className="head"><span className="eyebrow">Wie Lage für dich arbeitet</span><h1 className="title">Einstellungen</h1></header>
      <section className="card">
        <h3>Was gerade zählt</h3>
        <p className="muted small">Claude liest das bei jedem Eintrag mit: dein Engpass, deine Wochenprioritäten, dein Leitsatz.</p>
        <div className="field"><label htmlFor="ktx">Engpass, Prioritäten, Leitsatz</label>
          <textarea id="ktx" rows={6} value={kontext} onChange={(e) => setKontext(e.target.value)} placeholder="Engpass: …&#10;Prioritäten diese Woche: …&#10;Leitsatz: …" /></div>
        <div className="actions"><button type="button" className="btn primary" onClick={() => api('/api/settings', { method: 'PUT', body: JSON.stringify({ kontext }) }).then(() => setToast('Gespeichert')).catch((e) => setToast(e.message))}>Speichern</button></div>
      </section>
      <section className="card">
        <h3>Aktionstaste und Teilen-Menü</h3>
        <ol className="steps small">
          <li>Kurzbefehle-App öffnen, neuer Kurzbefehl „Lage“.</li>
          <li>Aktion <b>Text diktieren</b> hinzufügen (Sprache: Deutsch).</li>
          <li>Aktion <b>Inhalte von URL abrufen</b>: Adresse <code>{origin}/api/capture</code>, Methode POST, Header <code>Authorization</code> = <code>Bearer</code> + dein Erfassungsschlüssel, Text als Anfragetext.</li>
          <li>Einstellungen → Aktionstaste → Kurzbefehl → „Lage“.</li>
          <li>Für YouTube und Safari: im Kurzbefehl „Im Teilen-Menü anzeigen“ einschalten, dann landen Links mit einem Tipp hier.</li>
        </ol>
        <p className="muted small">Den Erfassungsschlüssel richtet Claude beim Einrichten des Servers ein. Er gehört nur in den Kurzbefehl.</p>
      </section>
      <section className="card">
        <h3>Deine Daten</h3>
        <p className="muted small">Alles als eine Textdatei, lesbar in jedem Programm, auch ohne diese App.</p>
        <div className="actions"><a className="btn" href="/api/export">Export herunterladen</a>
          <button type="button" className="btn ghost" onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login'; })}>Abmelden</button></div>
      </section>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
      <TabBar />
    </main>
  );
}
