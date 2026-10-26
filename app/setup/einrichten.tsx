'use client';
import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Mark } from '../mark';
import { usePressFeedback } from '../ui';

type Weg = 'passkey' | 'passwort' | 'schluessel';

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Fehlgeschlagen');
  return j as T;
}

export function Einrichten({ angemeldet }: { angemeldet: boolean }) {
  usePressFeedback();
  const [weg, setWeg] = useState<Weg>('passkey');
  const [token, setToken] = useState(''); const [pw, setPw] = useState(''); const [code, setCode] = useState('');
  const [secret, setSecret] = useState(''); const [otpauth, setOtpauth] = useState(''); const [kopiert, setKopiert] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  // Angemeldet richtet man ein weiteres Gerät ohne Einrichtungscode ein. Der Code gilt nur, solange noch nichts eingerichtet ist.
  const ohneCode = !token && !angemeldet;

  async function laufen(f: () => Promise<void>) {
    setBusy(true); setErr('');
    try { await f(); }
    catch (e) { setErr((e as Error).name === 'NotAllowedError' ? 'Abgebrochen. Tipp nochmal, wenn du so weit bist.' : (e as Error).message); }
    finally { setBusy(false); }
  }

  const passkey = () => laufen(async () => {
    const opts = await post<Parameters<typeof startRegistration>[0]['optionsJSON']>('/api/auth/register-options', { token });
    const response = await startRegistration({ optionsJSON: opts });
    await post('/api/auth/register', { token, response });
    window.location.href = '/';
  });

  const schluesselHolen = () => laufen(async () => {
    const r = await post<{ secret: string; otpauth: string }>('/api/auth/code/start', { token, password: pw });
    setSecret(r.secret); setOtpauth(r.otpauth); setPw(''); setWeg('schluessel');
  });

  const fertig = () => laufen(async () => {
    await post('/api/auth/code/fertig', { token, code });
    window.location.href = '/';
  });

  async function kopieren() {
    try { await navigator.clipboard.writeText(secret); setKopiert(true); setTimeout(() => setKopiert(false), 2500); }
    catch { setErr('Kopieren ging nicht. Halte den Schlüssel gedrückt und kopiere ihn von Hand.'); }
  }

  const tokenFeld = angemeldet ? null : (
    <div className="field"><label htmlFor="tok">Einrichtungscode</label>
      <input id="tok" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} /></div>
  );

  return (
    <main className="center"><div className="login">
      <Mark />
      <h1 className="title">Einrichten</h1>

      {weg === 'passkey' ? <>
        <p className="muted">{angemeldet ? 'Du bist angemeldet. Leg für dieses Gerät einen Passkey an, danach reicht Face ID.' : 'Beim ersten Mal: Einrichtungscode eingeben, dann Face ID. Weitere Geräte richtest du angemeldet in den Einstellungen ein.'}</p>
        {tokenFeld}
        <button type="button" className="btn primary wide" onClick={passkey} disabled={busy || ohneCode}>{busy ? 'Richtet ein …' : 'Passkey anlegen'}</button>
        <button type="button" className="linkbtn" onClick={() => { setErr(''); setWeg('passwort'); }}>Passwort und Code statt Passkey</button>
      </> : null}

      {weg === 'passwort' ? <>
        <p className="muted">Lege in 1Password ein neues Objekt „Life“ an und lass ein Passwort erzeugen, mindestens 20 Zeichen. Kopiere es hierher.</p>
        {tokenFeld}
        <div className="field"><label htmlFor="pw">Passwort</label>
          <input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <button type="button" className="btn primary wide" onClick={schluesselHolen} disabled={busy || ohneCode || pw.length < 16}>{busy ? 'Prüft …' : 'Weiter'}</button>
        <button type="button" className="linkbtn" onClick={() => { setErr(''); setWeg('passkey'); }}>Doch mit Passkey</button>
      </> : null}

      {weg === 'schluessel' ? <>
        <p className="muted">Jetzt bekommt 1Password den Schlüssel für die sechsstelligen Codes. Ein QR-Code ist dafür nicht nötig.</p>
        <div className="secret" aria-label="Schlüssel für die Codes">{secret.match(/.{1,4}/g)?.join(' ')}</div>
        <button type="button" className="btn wide" onClick={kopieren}>{kopiert ? 'Kopiert' : 'Schlüssel kopieren'}</button>
        <ol className="steps left">
          <li>1Password öffnen, Objekt „Life“ → Bearbeiten.</li>
          <li>Feld hinzufügen → <b>Einmalpasswort</b>, Schlüssel einfügen, sichern.</li>
          <li>Den sechsstelligen Code aus 1Password kopieren und hier einfügen.</li>
        </ol>
        <a className="linkbtn" href={otpauth}>Oder direkt in einer Code-App öffnen</a>
        <div className="field"><label htmlFor="code">Code aus 1Password</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) fertig(); }} /></div>
        <button type="button" className="btn primary wide" onClick={fertig} disabled={busy || code.length !== 6}>{busy ? 'Prüft …' : 'Fertig'}</button>
        <p className="gnote">Der Schlüssel gilt 10 Minuten. Danach einfach nochmal von vorn.</p>
      </> : null}

      {err ? <p className="err" role="alert">{err}</p> : null}
    </div></main>
  );
}
