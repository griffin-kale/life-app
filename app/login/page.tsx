'use client';
import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { Mark } from '../mark';
import { usePressFeedback } from '../ui';

export default function Login() {
  usePressFeedback();
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [mitCode, setMitCode] = useState(false);
  const [pw, setPw] = useState(''); const [code, setCode] = useState('');

  async function passkey() {
    setBusy(true); setErr('');
    try {
      const opts = await (await fetch('/api/auth/login-options', { method: 'POST' })).json();
      const response = await startAuthentication({ optionsJSON: opts });
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response }) });
      if (!r.ok) throw new Error((await r.json()).error || 'Anmeldung fehlgeschlagen');
      window.location.href = '/';
    } catch (e) { setErr((e as Error).name === 'NotAllowedError' ? 'Abgebrochen. Tipp nochmal, wenn du so weit bist.' : (e as Error).message); }
    finally { setBusy(false); }
  }

  async function mitPasswort() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/auth/code/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw, code }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Anmeldung fehlgeschlagen.');
      window.location.href = '/';
    } catch (e) { setErr((e as Error).message); setCode(''); }
    finally { setBusy(false); }
  }

  return (
    <main className="center"><div className="login">
      <Mark />
      <h1 className="title">Life<i>.</i></h1>
      <p className="muted">Dein Logbuch. Nur für dich.</p>
      {!mitCode ? <>
        <button type="button" className="btn primary wide" onClick={passkey} disabled={busy}>{busy ? 'Prüft …' : 'Mit Face ID anmelden'}</button>
        <button type="button" className="linkbtn" onClick={() => { setErr(''); setMitCode(true); }}>Mit Passwort und Code anmelden</button>
      </> : <form className="login" onSubmit={(e) => { e.preventDefault(); if (pw && code.length === 6) mitPasswort(); }}>
        <input type="text" name="username" autoComplete="username" value="Peter" readOnly hidden />
        <div className="field"><label htmlFor="pw">Passwort</label>
          <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div className="field"><label htmlFor="code">Code aus 1Password</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ''))} /></div>
        <button type="submit" className="btn primary wide" disabled={busy || !pw || code.length !== 6}>{busy ? 'Prüft …' : 'Anmelden'}</button>
        <button type="button" className="linkbtn" onClick={() => { setErr(''); setMitCode(false); }}>Mit Face ID anmelden</button>
      </form>}
      {err ? <p className="err" role="alert">{err}</p> : null}
    </div></main>
  );
}
