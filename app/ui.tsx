'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

export type Item = {
  id: string; created_at: string; status: string; typ: string; text: string; roh: string | null; url: string | null;
  titel: string | null; quelle: string | null; kategorie: string | null; art: string | null; schritt: string | null;
  begruendung: string | null; kern: string | null; frage: string | null; parken_bis: string | null; fehler: string | null; wenn?: string | null; energie?: number | null; an_coach?: boolean;
  ziel: string | null; hebel: number | null; aufwand_min: number | null; frist: string | null; wer: string | null; delegieren_an: string | null;
  stapel: string | null; rang: number | null; grund: string | null; sortiert_am: string | null; zeit: string | null; zeit_tag: string | null;
  erledigt_at: string | null; merged_into: string | null; manuell_tag: string | null; manuell_stapel: string | null;
};

/** Antwort von /api/heute */
export type Stand = {
  tag: string; items: Item[]; erledigtHeute: Item[]; erledigtWoche: number; zuletzt: Item[]; engpass: string;
  kraft?: { gab: string[]; kostete: string[] };
  ziele: { ziel: string; offen: number; erledigt: number }[]; sortiertAm: string | null; fehler: string | null; laeuft: boolean;
};

export const STAPEL: Record<string, string> = { jetzt: 'Jetzt', woche: 'Diese Woche', delegieren: 'Delegieren', geparkt: 'Parkplatz', streichen: 'Streichen vorgeschlagen' };
export const aufwandLabel = (m: number | null) => (m ? (m <= 20 ? '15 Min.' : m <= 90 ? '1 Std.' : 'halber Tag') : null);

export const TYP: Record<string, string> = { gedanke: 'Gedanke', zitat: 'Zitat', video: 'Video', buch: 'Buch', link: 'Artikel' };
export const KAT: Record<string, string> = { engpass: 'Engpass', entscheidung: 'Entscheidung', aufgabe: 'Aufgabe', projekt: 'Projekt', privat: 'Privat', notiz: 'Notiz', idee: 'Idee', wissen: 'Wissen' };
export const ART: Record<string, string> = { zeit: 'Zeit', sozial: 'Sozial', mental: 'Mental', koerper: 'Körper', geld: 'Geld' };

const TZ = 'Europe/Berlin';
const dayKey = (x: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(x);
export const fTime = (d: string) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d));
export const fDayLabel = (d: string) => {
  const now = new Date(); const v = new Date(d);
  if (dayKey(v) === dayKey(now)) return 'Heute';
  if (dayKey(v) === dayKey(new Date(now.getTime() - 864e5))) return 'Gestern';
  const sameYear = v.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }).format(v);
};
export const fWhen = (d: string) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const fWeekday = (d: string) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'short' }).format(new Date(d));
export const heute = () => dayKey(new Date());
/** Frist als Wort: heute, morgen, bis Do., überfällig. */
export function fristLabel(f: string | null): { text: string; spaet: boolean } | null {
  if (!f) return null;
  const t = heute();
  const diff = Math.round((new Date(f + 'T12:00:00Z').getTime() - new Date(t + 'T12:00:00Z').getTime()) / 864e5);
  if (diff < 0) return { text: diff === -1 ? 'seit gestern fällig' : `seit ${-diff} Tagen fällig`, spaet: true };
  if (diff === 0) return { text: 'heute fällig', spaet: true };
  if (diff === 1) return { text: 'bis morgen', spaet: false };
  if (diff < 7) return { text: 'bis ' + new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' }).format(new Date(f + 'T12:00:00Z')), spaet: false };
  return { text: 'bis ' + new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(f + 'T12:00:00Z')), spaet: false };
}
export const taskTitle = (it: Item) => it.schritt || it.titel || bodyText(it) || it.text;

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
/** Text ohne den Link selbst, damit Einträge nicht als rohe Adresse erscheinen. */
export function bodyText(it: Item) {
  let t = it.text || '';
  if (it.url) t = t.split(it.url).join(' ');
  return t.replace(/\s+\n/g, '\n').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').trim();
}
export const sourceLabel = (it: Item) => it.quelle || (it.url ? host(it.url) : null);
export const isPending = (it: Item) => it.status === 'neu' && !it.fehler;
export const isParked = (it: Item) => it.kategorie === 'idee' && !!it.parken_bis && new Date(it.parken_bis) > new Date();

/* Symbole, an SF Symbols angelehnt, alle inline */
export const Icon = {
  play: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>,
  pause: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.2" /><rect x="13.5" y="5" width="4.5" height="14" rx="1.2" /></svg>,
  chevronLeft: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>,
  chevronRight: <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>,
  updown: <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9l4-4 4 4M8 15l4 4 4-4" /></svg>,
  external: <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6h9v9M18 6L7 17" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>,
  mic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>,
  stop: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.5" /></svg>,
  video: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>,
  buch: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6v13c-2.5-1.5-5.5-1.5-8-.5zM20 5.5c-2.5-1-5.5-1-8 .5v13c2.5-1.5 5.5-1.5 8-.5z" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 2" /></svg>,
  later: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h12M13 7l5 5-5 5" /></svg>,
  up: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6" /></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  close: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  down: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v13M6 13l6 6 6-6" /></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>,
};

/** Ein Logbuch-Eintrag. Kein Chip-Gewimmel: Inhalt zuerst, Einordnung als eine leise Zeile darunter. */
export function Entry({ it, from, fresh }: { it: Item; from?: string; fresh?: boolean }) {
  const pending = isPending(it);
  const text = bodyText(it);
  const src = sourceLabel(it);
  const title = it.titel && it.typ !== 'gedanke' ? it.titel : null;
  const srcIcon = it.typ === 'video' ? Icon.video : it.typ === 'buch' ? Icon.buch : it.url ? Icon.link : null;
  return (
    <li className={fresh ? 'fresh' : undefined}>
      <Link href={`/eintrag/${it.id}${from ? `?von=${from}` : ''}`} className="entry">
        <time className="etime" dateTime={it.created_at}>{fTime(it.created_at)}</time>
        <div className="ebody">
          {title ? <div className="etitle">{title}</div> : null}
          {text ? <div className={'etext' + (title ? ' sub' : '')}>{it.typ === 'zitat' ? `„${text.replace(/^[„"“]+|[“"”]+$/g, '')}“` : text}</div> : null}
          {src ? <div className="esrc">{srcIcon}<span>{src}</span></div> : null}
          {it.schritt && it.schritt.replace(/[.\s]+$/, '') !== text.replace(/[.\s]+$/, '') ? <div className="estep">{Icon.arrow}<span>{it.schritt}</span></div> : null}
          <div className="emeta">
            {pending ? <span className="working">Claude ordnet ein …</span> : null}
            {it.status === 'erledigt' ? <span className="ok">erledigt</span> : null}
            {it.fehler ? <span className="bad">Nicht eingeordnet</span> : null}
            {it.kategorie ? <span className={`k k-${it.kategorie}`}>{KAT[it.kategorie] ?? it.kategorie}</span> : null}
            {it.art ? <span>{ART[it.art]}</span> : null}
            {isParked(it) ? <span>geparkt bis {fWeekday(it.parken_bis!)}</span> : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

/** Logbuch nach Tagen gruppiert, wie die Mitteilungen auf dem iPhone. */
export function Log({ items, from, freshId }: { items: Item[]; from?: string; freshId?: string | null }) {
  const days: { label: string; items: Item[] }[] = [];
  for (const it of items) {
    const label = fDayLabel(it.created_at);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(it); else days.push({ label, items: [it] });
  }
  return (
    <div className="days">
      {days.map((d) => (
        <section key={d.label} className="day" aria-label={d.label}>
          <h3 className="dayhead">{d.label}<span>{d.items.length}</span></h3>
          <ul className="log">{d.items.map((it) => <Entry key={it.id} it={it} from={from} fresh={it.id === freshId} />)}</ul>
        </section>
      ))}
    </div>
  );
}

/** Obere Leiste: unsichtbar, solange der große Titel zu sehen ist; danach Material mit kleinem Titel (Scroll-Edge statt harter Linie). */
/** Obere Leiste. Auf den vier Hauptseiten führt der Kreis rechts zu den Einstellungen (0.28, Peter 31.10.2026). */
export function TopBar({ title, back, profil }: { title: string; back?: { label: string; href: string }; profil?: boolean }) {
  const router = useRouter();
  const [edge, setEdge] = useState(false);
  const [titled, setTitled] = useState(false);
  useEffect(() => {
    const on = () => { const y = window.scrollY; setEdge(y > 2); setTitled(y > 64); };
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const goBack = () => { if (back && window.history.length > 1) router.back(); else router.push(back?.href ?? '/'); };
  return (
    <div className={'topbar' + (edge ? ' edge' : '') + (titled ? ' titled' : '')}>
      {back ? <button type="button" className="back" onClick={goBack}>{Icon.chevronLeft}<span>{back.label}</span></button> : <span />}
      <span className="toptitle" aria-hidden="true">{title}</span>
      {profil ? (
        <Link href="/einstellungen" className="tb-profil" aria-label="Einstellungen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="9" r="3.4" /><path d="M5.6 19.2c1-3 3.4-4.6 6.4-4.6s5.4 1.6 6.4 4.6" /></svg>
        </Link>
      ) : <span />}
    </div>
  );
}

/** Ab welcher Breite die große Ansicht gilt. Startet schmal, damit Server und Browser gleich rendern. */
export function useBreit(px: number) {
  const [b, setB] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(min-width: ${px}px)`);
    const f = () => setB(m.matches); f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [px]);
  return b;
}

/** iOS zeigt :active nur, wenn ein touchstart-Listener hängt. Ohne ihn gibt es beim Drücken kein Feedback. */
export function usePressFeedback() {
  useEffect(() => { const f = () => {}; document.addEventListener('touchstart', f, { passive: true }); return () => document.removeEventListener('touchstart', f); }, []);
}

/** Die untere Leiste liegt in tabbar.tsx. */
export { TabBar } from './tabbar';

type ToastAction = { label: string; run: () => void };
type ToastState = { text: string; kind: 'ok' | 'err'; action?: ToastAction; n: number } | null;
/** Meldung kommt von unten und geht auf demselben Weg zurück. Mit Aktion (Rückgängig) bleibt sie länger stehen. */
export function useToast(): [ReactNode, (text: string, kind?: 'ok' | 'err', action?: ToastAction) => void] {
  const [t, setT] = useState<ToastState>(null);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (!t) return;
    setOut(false);
    const ms = t.action ? 5000 : t.kind === 'err' ? 4000 : 2200;
    const a = setTimeout(() => setOut(true), ms);
    const b = setTimeout(() => setT(null), ms + 220);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [t]);
  const show = useCallback((text: string, kind: 'ok' | 'err' = 'ok', action?: ToastAction) => setT((p) => ({ text, kind, action, n: (p?.n ?? 0) + 1 })), []);
  const el = t ? (
    <div key={t.n} className={'toast' + (t.kind === 'err' ? ' err' : '') + (t.action ? ' has-action' : '') + (out ? ' out' : '')} role={t.kind === 'err' ? 'alert' : 'status'}>
      {t.kind === 'ok' ? Icon.check : null}<span>{t.text}</span>
      {t.action ? <button type="button" onClick={() => { t.action!.run(); setOut(true); setTimeout(() => setT(null), 220); }}>{t.action.label}</button> : null}
    </div>
  ) : null;
  return [el, show];
}

/** Uhrzeit für heute. Auf dem iPhone öffnet sich das Zeitrad. */
export function TimeChip({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <label className={'chipbtn' + (value ? ' set' : '')}>
      {Icon.clock}<span>{value || 'Uhrzeit'}</span>
      <input type="time" value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label="Uhrzeit für heute" />
    </label>
  );
}

/** Aufgabenzeile wie in Erinnerungen: Kreis zum Abhaken, Titel, höchstens Frist und Übergabe. Gründe und Einordnung stehen im Eintrag (0.19, so wenig wie nötig). */
export function TaskRow({ it, big, from, onToggle, children, leaving }: { it: Item; big?: boolean; from?: string; onToggle?: () => void; children?: ReactNode; leaving?: boolean }) {
  const done = it.status === 'erledigt';
  const frist = done ? null : fristLabel(it.frist);
  return (
    <li className={'task' + (big ? ' lead' : '') + (done ? ' done' : '') + (leaving ? ' leaving' : '')}>
      {onToggle ? <button type="button" className="tick" aria-pressed={done} aria-label={done ? 'Wieder öffnen' : 'Erledigt'} onClick={onToggle}>{Icon.check}</button> : <span className="tick-space" />}
      <div className="tbody">
        <Link href={`/eintrag/${it.id}${from ? `?von=${from}` : ''}`} className="ttitle">{taskTitle(it)}</Link>
        <div className="tmeta">
          {frist ? <span className={frist.spaet ? 'spaet' : undefined}>{frist.text}</span> : null}
          {it.wer === 'delegieren' && it.delegieren_an ? <span>an {it.delegieren_an}</span> : null}
        </div>
        {children ? <div className="tact">{children}</div> : null}
      </div>
    </li>
  );
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('nicht angemeldet'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Fehler');
  return data as T;
}
