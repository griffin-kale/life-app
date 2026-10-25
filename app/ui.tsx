'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export type Item = {
  id: string; created_at: string; status: string; typ: string; text: string; roh: string | null; url: string | null;
  titel: string | null; quelle: string | null; kategorie: string | null; art: string | null; schritt: string | null;
  begruendung: string | null; kern: string | null; frage: string | null; parken_bis: string | null; fehler: string | null;
};

export const TYP: Record<string, string> = { gedanke: 'Gedanke', zitat: 'Zitat', video: 'Video', buch: 'Buch', link: 'Artikel' };
export const KAT: Record<string, string> = { engpass: 'Engpass', entscheidung: 'Entscheidung', aufgabe: 'Aufgabe', projekt: 'Projekt', privat: 'Privat', notiz: 'Notiz', idee: 'Idee', wissen: 'Wissen' };
export const ART: Record<string, string> = { zeit: 'Zeit', sozial: 'Sozial', mental: 'Mental', koerper: 'Körper', geld: 'Geld' };

const TZ = 'Europe/Berlin';
export const fTime = (d: string) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d));
export const fDay = (d: string) => {
  const k = (x: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(x);
  const now = new Date(); const v = new Date(d);
  if (k(v) === k(now)) return 'heute';
  if (k(v) === k(new Date(now.getTime() - 864e5))) return 'gestern';
  return new Intl.DateTimeFormat('de-DE', { timeZone: TZ, day: 'numeric', month: 'short' }).format(v);
};
export const fWhen = (d: string) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

export function Entry({ it }: { it: Item }) {
  const pending = it.status === 'neu' && !it.fehler;
  const parked = it.kategorie === 'idee' && it.parken_bis && new Date(it.parken_bis) > new Date();
  return (
    <li>
      <Link href={`/eintrag/${it.id}`} className={'entry' + (pending ? ' pending' : '')}>
        <div className="etime">{fTime(it.created_at)}<span>{fDay(it.created_at)}</span></div>
        <div className="ebody">
          {it.titel && it.typ !== 'gedanke' ? <div className="etitle">{it.titel}</div> : null}
          <div className="etext">{it.typ === 'zitat' ? `„${it.text}“` : it.text}</div>
          {it.schritt ? <div className="estep">→ {it.schritt}</div> : null}
          <div className="chips">
            <span className="chip">{TYP[it.typ] ?? it.typ}</span>
            {pending ? <span className="chip">wird eingeordnet …</span> : null}
            {it.fehler ? <span className="chip err">nicht eingeordnet</span> : null}
            {it.kategorie ? <span className={`chip k-${it.kategorie}`}>{KAT[it.kategorie] ?? it.kategorie}</span> : null}
            {it.art ? <span className="chip">{ART[it.art]}</span> : null}
            {parked ? <span className="chip">geparkt bis {fWhen(it.parken_bis!)}</span> : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

const ICON: Record<string, React.ReactNode> = {
  '/': <path d="M12 4v16M4 12h16" />,
  '/archiv': <><rect x="4" y="4" width="16" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" /></>,
  '/einstellungen': <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>,
};

export function TabBar() {
  const path = usePathname();
  const tabs: [string, string][] = [['/', 'Erfassen'], ['/archiv', 'Archiv'], ['/einstellungen', 'Einstellungen']];
  return (
    <nav className="tabbar" aria-label="Bereiche">
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} aria-current={(href === '/' ? path === '/' : path.startsWith(href)) ? 'page' : undefined}>
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[href]}</svg>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function useToast(): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(t); }, [msg]);
  return [msg, setMsg];
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('nicht angemeldet'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Fehler');
  return data as T;
}
