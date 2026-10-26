'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, TabBar, TopBar, api, useToast } from '../ui';
import { Mitteilungen } from '../mitteilungen';
import { KalenderEinstellungen } from '../kalender';
import { Rueckmeldung } from '../rueckmeldung';
import { Darstellung } from '../darstellung';

type S = { kontext: string; ziele: string; team: string; namen: string; namen_auto: string };
const LEER: S = { kontext: '', ziele: '', team: '', namen: '', namen_auto: '' };

export default function Einstellungen() {
  const [v, setV] = useState<S>(LEER);
  const [saved, setSaved] = useState<S>(LEER);
  const [origin, setOrigin] = useState('');
  const [claude, setClaude] = useState<boolean | null>(null);
  const [toast, setToast] = useToast();
  const [code, setCode] = useState<boolean | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
    api<{ aktiv: boolean }>('/api/auth/code').then((r) => setCode(r.aktiv)).catch(() => {});
    // Hat Peter schon getippt, bevor die Werte da sind, bleibt sein Text stehen.
    api<S & { claude: boolean }>('/api/settings').then(({ claude: c, ...s }) => { setV((cur) => (cur === LEER ? s : cur)); setSaved(s); setClaude(c); }).catch(() => {});
  }, []);
  const dirty = (Object.keys(LEER) as (keyof S)[]).some((k) => v[k] !== saved[k]);
  const set = (k: keyof S) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  async function save() {
    try { await api('/api/settings', { method: 'PUT', body: JSON.stringify(v) }); setSaved(v); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  async function codeAus() {
    if (!window.confirm('Anmeldung mit Passwort und Code ausschalten? Danach geht es nur noch mit Face ID.')) return;
    try { await api('/api/auth/code', { method: 'DELETE' }); setCode(false); setToast('Ausgeschaltet'); }
    catch (e) { setToast((e as Error).message, 'err'); }
  }
  return (
    <main className="wrap">
      <TopBar title="Einstellungen" />
      <header className="head"><span className="eyebrow">Wie Life für dich arbeitet</span><h1 className="title">Einstellungen</h1></header>

      <Darstellung />
      <section className="gsec" aria-label="Heute">
        <Link className="group cell" href="/einstellungen/heute"><span>Heute anpassen</span><span className="val">Bausteine und Reihenfolge{Icon.chevronRight}</span></Link>
      </section>

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

      <Mitteilungen onToast={(t, k) => setToast(t, k)} />
      <KalenderEinstellungen onToast={(t, k) => setToast(t, k)} />

      <section className="gsec">
        <h2 className="glabel">Was Claude nie sieht</h2>
        <div className="group pad">
          <p className="muted small">{claude === null ? '…' : claude ? 'Claude ist verbunden.' : 'Claude ist noch nicht verbunden. Der Schlüssel fehlt auf dem Server.'}</p>
          <div className="field"><label htmlFor="namen">Namen, die Life vor dem Senden ersetzt, einer pro Zeile</label>
            <textarea id="namen" rows={5} value={v.namen} onChange={set('namen')} placeholder={'Name einer Person\nFirma: Name einer Firma\nOrt: Name eines Orts'} /></div>
          <div className="field"><label htmlFor="namen_auto">Von Claude erkannt und ab jetzt ersetzt</label>
            <textarea id="namen_auto" rows={4} value={v.namen_auto} onChange={set('namen_auto')} placeholder="Noch keine" /></div>
          <button type="button" className="btn primary" onClick={save} disabled={!dirty}>{dirty ? 'Speichern' : <>{Icon.check}Gespeichert</>}</button>
        </div>
        <p className="gnote">Claude bekommt [Person 1] statt des Namens, ebenso bei E-Mail-Adressen, Telefonnummern und IBANs. Dein Name und dein Team sind immer dabei. Taucht ein neuer Name zum ersten Mal auf, sieht Claude ihn einmal und meldet ihn zurück. Danach steht er hier.</p>
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
        <h2 className="glabel">Anmeldung</h2>
        <div className="group">
          <div className="cell static"><span>Face ID (Passkey)</span><span className="val">bevorzugt</span></div>
          <div className="cell static"><span>Passwort und Code</span><span className="val">{code === null ? '…' : code ? 'an' : 'aus'}</span></div>
          {code ? <button type="button" className="cell danger" onClick={codeAus}>Passwort und Code ausschalten</button> : null}
        </div>
        <p className="gnote">Passwort und Code sind der Weg für Geräte ohne Passkey. Sobald Face ID überall geht, schalte ihn hier aus.</p>
      </section>

      <section className="gsec">
        <h2 className="glabel">Deine Daten</h2>
        <div className="group">
          <a className="cell tint" href="/api/export" download><span>Export herunterladen</span>{Icon.chevronRight}</a>
          <button type="button" className="cell danger" onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login'; })}>Abmelden</button>
        </div>
        <p className="gnote">Der Export ist eine Textdatei mit allen Einträgen, lesbar in jedem Programm, auch ohne diese App.</p>
      </section>

      <Rueckmeldung onToast={(t, k) => setToast(t, k)} />

      <p className="foot">Life 0.15.1 · Server in Deutschland</p>
      {toast}
      <TabBar />
    </main>
  );
}
