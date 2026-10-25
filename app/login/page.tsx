'use client';
import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

export default function Login() {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr('');
    try {
      const opts = await (await fetch('/api/auth/login-options', { method: 'POST' })).json();
      const response = await startAuthentication({ optionsJSON: opts });
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response }) });
      if (!r.ok) throw new Error((await r.json()).error || 'Anmeldung fehlgeschlagen');
      window.location.href = '/';
    } catch (e) { setErr((e as Error).name === 'NotAllowedError' ? 'Abgebrochen. Nochmal versuchen.' : (e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <main className="center"><div className="login">
      <h1 className="title">Lage<i style={{ color: 'var(--sand)' }}>.</i></h1>
      <p className="muted">Nur für Peter.</p>
      <button type="button" className="btn primary" style={{ justifyContent: 'center' }} onClick={go} disabled={busy}>{busy ? 'Prüft …' : 'Mit Face ID anmelden'}</button>
      {err ? <p className="err" role="alert">{err}</p> : null}
    </div></main>
  );
}
