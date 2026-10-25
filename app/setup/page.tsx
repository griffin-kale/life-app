'use client';
import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Mark } from '../mark';
import { usePressFeedback } from '../ui';

export default function Setup() {
  usePressFeedback();
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
    } catch (e) { setErr((e as Error).name === 'NotAllowedError' ? 'Abgebrochen. Tipp nochmal, wenn du so weit bist.' : (e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <main className="center"><div className="login">
      <Mark />
      <h1 className="title">Einrichten</h1>
      <p className="muted">Einmal pro Gerät: Einrichtungscode eingeben, dann Face ID. Danach reicht Face ID.</p>
      <div className="field"><label htmlFor="tok">Einrichtungscode</label><input id="tok" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && token) go(); }} /></div>
      <button type="button" className="btn primary wide" onClick={go} disabled={busy || !token}>{busy ? 'Richtet ein …' : 'Passkey anlegen'}</button>
      {err ? <p className="err" role="alert">{err}</p> : null}
    </div></main>
  );
}
