'use client';
import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

export default function Setup() {
  const [token, setToken] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr('');
    try {
      const o = await fetch('/api/auth/register-options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
      const opts = await o.json(); if (!o.ok) throw new Error(opts.error);
      const response = await startRegistration({ optionsJSON: opts });
      const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, response }) });
      if (!r.ok) throw new Error((await r.json()).error || 'Fehlgeschlagen');
      window.location.href = '/';
    } catch (e) { setErr((e as Error).name === 'NotAllowedError' ? 'Abgebrochen. Nochmal versuchen.' : (e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <main className="center"><div className="login">
      <h1 className="title" style={{ fontSize: 48 }}>Einrichten</h1>
      <p className="muted">Einmal pro Gerät: Einrichtungscode eingeben, dann Face ID. Danach meldest du dich nur noch mit Face ID an.</p>
      <div className="field" style={{ textAlign: 'left' }}><label htmlFor="tok">Einrichtungscode</label><input id="tok" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} /></div>
      <button type="button" className="btn primary" style={{ justifyContent: 'center' }} onClick={go} disabled={busy || !token}>{busy ? 'Richtet ein …' : 'Passkey anlegen'}</button>
      {err ? <p className="err" role="alert">{err}</p> : null}
    </div></main>
  );
}
