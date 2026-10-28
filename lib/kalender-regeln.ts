/**
 * Kalender als Lage: Termine des Tages, freie Lücken, ein Platz fürs Tagesziel und eine Zusammenfassung für den Coach.
 * Rein, ohne Datenbank und ohne Netz, damit testbar. Zeiten rechnet Life in Berliner Zeit.
 */

export type KalenderArt = 'privat' | 'familie' | 'arbeit';
export const KALENDER_ARTEN: [KalenderArt, string][] = [['privat', 'Privat'], ['familie', 'Familie'], ['arbeit', 'Arbeit']];
export type Termin = { beginn: string; ende: string; ganztag: boolean; titel: string; art: KalenderArt };
export type Block = { von: number; bis: number; titel: string; art: KalenderArt | 'frei' | 'vorschlag' };

const TZ = 'Europe/Berlin';
const teile = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const g = (k: string) => p.find((x) => x.type === k)?.value ?? '00';
  return { tag: `${g('year')}-${g('month')}-${g('day')}`, min: Number(g('hour')) * 60 + Number(g('minute')) };
};
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Minuten seit Mitternacht an diesem Tag. Vor dem Tag gibt 0, danach 1440. */
export function minutenAm(iso: string, tag: string): number {
  const t = teile(new Date(iso));
  if (t.tag < tag) return 0;
  if (t.tag > tag) return 1440;
  return t.min;
}

/** Termine, die diesen Tag berühren. Ganztägige zählen nach ihrem Datum, ohne Zeit. */
export function amTag(termine: Termin[], tag: string): Termin[] {
  return termine.filter((t) => {
    if (t.ganztag) { const b = t.beginn.slice(0, 10); const e = t.ende.slice(0, 10); return b === tag || (b <= tag && tag < e); }
    return minutenAm(t.beginn, tag) < 1440 && minutenAm(t.ende, tag) > 0;
  });
}

/**
 * Tagesplan zwischen `von` und `bis`: Termine und Lücken ab 30 Minuten.
 * Das Tagesziel bekommt die erste Lücke ab `ab`, die lang genug ist (mindestens `dauer`, höchstens 90 Minuten Block).
 */
export function tagesplan(termine: Termin[], tag: string, opt: { von?: number; bis?: number; ab?: number; ziel?: string; dauer?: number } = {}): { ganztag: Termin[]; bloecke: Block[]; frei: number } {
  const von = opt.von ?? 8 * 60; const bis = opt.bis ?? 19 * 60;
  const heute = amTag(termine, tag);
  const ganztag = heute.filter((t) => t.ganztag);
  const fest: Block[] = heute.filter((t) => !t.ganztag)
    .map((t) => ({ von: minutenAm(t.beginn, tag), bis: minutenAm(t.ende, tag), titel: t.titel, art: t.art }))
    .filter((b) => b.bis > b.von)
    .sort((a, b) => a.von - b.von || a.bis - b.bis);
  const bloecke: Block[] = []; let zeiger = von; let frei = 0;
  const luecke = (a: number, b: number) => { if (b - a >= 30) { bloecke.push({ von: a, bis: b, titel: '', art: 'frei' }); frei += b - a; } };
  for (const b of fest) {
    if (b.von > zeiger && zeiger < bis) luecke(zeiger, Math.min(b.von, bis));
    bloecke.push(b);
    zeiger = Math.max(zeiger, b.bis);
  }
  if (zeiger < bis) luecke(zeiger, bis);
  if (opt.ziel) {
    const ab = Math.max(opt.ab ?? 0, von); const dauer = Math.max(30, Math.min(opt.dauer ?? 60, 90));
    const i = bloecke.findIndex((b) => b.art === 'frei' && Math.min(b.bis, bis) - Math.max(b.von, ab) >= dauer);
    if (i >= 0) {
      const f = bloecke[i]; const start = Math.ceil(Math.max(f.von, ab) / 15) * 15; const ende = start + dauer;
      if (ende <= f.bis) {
        const neu: Block[] = [];
        if (start - f.von >= 30) neu.push({ ...f, bis: start });
        neu.push({ von: start, bis: ende, titel: opt.ziel, art: 'vorschlag' });
        if (f.bis - ende >= 30) neu.push({ ...f, von: ende });
        bloecke.splice(i, 1, ...neu);
      }
    }
  }
  return { ganztag, bloecke, frei };
}

const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/**
 * Was der Coach vom Kalender erfährt. Familientermine nur als „Familie“, ohne Titel.
 * Kein Datum, nur „heute“ und Wochentage. Namen in Titeln pseudonymisiert askJson ohnehin.
 */
/** Wörter, bei denen ein Termin nur als „Termin privat“ an Claude geht (Phase 3, Peter 26.10.2026). */
const SCHUTZ = /(arzt|ärzt|praxis|therap|psych|klinik|krankenhaus|zahn|physio|ortho|gyn|\burolog|derma|\blabor|blutabnahme|impf|untersuch|\bop\b|\breha\b|beratung|coaching|anwalt|anwält|gericht|notar|polizei|bank|kredit|schuld|amt\b|jobcenter|bewerbung|vorstellungsgespräch|beerdigung|trauer)/i;

/** Ein Termintitel, wie Claude ihn sehen darf. Bekannte Namen ersetzt die Pseudonymisierung, unbekannte nach „mit“, „bei“, „von“, „für“ fallen hier weg. */
export function schutzTitel(roh: string, bekannte: string[] = []): string {
  const t = roh.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!t || SCHUTZ.test(t)) return 'Termin privat';
  const bek = bekannte.map((n) => n.toLowerCase());
  return t.replace(/\b(mit|bei|von|für)\s+((?:(?:Frau|Herrn?|Dr\.?)\s+)?[A-ZÄÖÜ][\p{L}-]+(?:\s+[A-ZÄÖÜ][\p{L}-]+)?)/gu, (ganz, w: string, name: string) => {
    const kern = name.replace(/^(Frau|Herrn?|Dr\.?)\s+/, '');
    return bek.some((b) => b === kern.toLowerCase() || b.split(' ').includes(kern.toLowerCase().split(' ')[0])) ? ganz : `${w} jemandem`;
  });
}

export function kalenderZeilen(termine: Termin[], heute: string, jetztMin: number, bekannte: string[] = []): string[] {
  if (!termine.length) return ['Kalender: heute keine Termine eingetragen.'];
  const titel = (t: { titel: string; art: KalenderArt }) => (t.art === 'familie' ? 'Familie (geschützt, nichts hineinplanen)' : `${schutzTitel(t.titel, bekannte)}${t.art === 'arbeit' ? ' (Arbeit)' : ''}`);
  const plan = tagesplan(termine, heute);
  const zeilen: string[] = [];
  const heuteT = plan.bloecke.filter((b) => b.art !== 'frei' && b.art !== 'vorschlag');
  zeilen.push(heuteT.length || plan.ganztag.length
    ? 'Termine heute:\n' + [...plan.ganztag.map((t) => `- ganztägig: ${titel(t)}`), ...heuteT.map((b) => `- ${hhmm(b.von)}–${hhmm(b.bis)} ${titel({ titel: b.titel, art: b.art as KalenderArt })}`)].join('\n')
    : 'Termine heute: keine.');
  const frei = plan.bloecke.filter((b) => b.art === 'frei' && b.bis > jetztMin);
  zeilen.push(frei.length ? 'Freie Zeit heute (zwischen 8 und 19 Uhr): ' + frei.map((b) => `${hhmm(Math.max(b.von, jetztMin))}–${hhmm(b.bis)}`).join(', ') : 'Heute keine freie Zeit mehr zwischen 8 und 19 Uhr.');
  // Die nächsten sechs Tage als Last: verplante Stunden pro Tag
  const last: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(Date.parse(heute + 'T12:00:00Z') + i * 864e5); const tag = d.toISOString().slice(0, 10);
    const p = tagesplan(termine, tag);
    const verplant = p.bloecke.filter((b) => b.art !== 'frei').reduce((a, b) => a + (b.bis - b.von), 0);
    const fam = p.bloecke.some((b) => b.art === 'familie') || p.ganztag.some((t) => t.art === 'familie');
    last.push(`${WT[d.getUTCDay()]} ${Math.round(verplant / 30) / 2} Std.${fam ? ' (mit Familie)' : ''}`);
  }
  zeilen.push('Verplant in den nächsten Tagen (8 bis 19 Uhr): ' + last.join(', '));
  return zeilen;
}

/** Ein Kalendername, der nach Familie klingt, wird beim ersten Abgleich als Familie markiert. */
export const artRaten = (name: string): KalenderArt => (/famil|kinder|gemeinsam|zuhause/i.test(name) ? 'familie' : /arbeit|work|büro|buero|job/i.test(name) ? 'arbeit' : 'privat');

/** Nur Antworten von iCloud. In Tests darf ein fest eingestellter Server dazu. */
export function hostErlaubt(raw: string, testBasis?: string): boolean {
  try {
    const u = new URL(raw);
    if (testBasis) { const t = new URL(testBasis); if (u.origin === t.origin) return true; }
    return u.protocol === 'https:' && (u.port === '' || u.port === '443') && /^(p\d{1,3}-)?caldav\.icloud\.com$/.test(u.hostname);
  } catch { return false; }
}

/* ===== Woche (Life 2.0): ein Tag mit Blöcken und freier Zeit ===== */
const WT_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export type TagBlock = { von: number; bis: number; titel: string; art: string };
export type WochenTag = { tag: string; wt: (typeof WT_KURZ)[number]; nr: number; ganztag: string[]; bloecke: TagBlock[]; frei: number };

/** Freie Minuten zwischen `von` und `bis`, überlappende Termine zählen einmal. */
export function freiAm(bloecke: { von: number; bis: number }[], von = 8 * 60, bis = 19 * 60): number {
  let belegt = 0, ende = von;
  for (const b of [...bloecke].sort((x, y) => x.von - y.von)) {
    const a = Math.max(b.von, ende), e = Math.min(b.bis, bis);
    if (e > a) { belegt += e - a; ende = e; }
  }
  return Math.max(0, bis - von - belegt);
}

/** Ein Tag der Woche: Termine mit Uhrzeit als Blöcke, ganztägige als Titel, freie Zeit von 8 bis 19 Uhr. */
export function wochenTag(termine: Termin[], tag: string, i: number): WochenTag {
  const am = amTag(termine, tag);
  const bloecke = am.filter((t) => !t.ganztag)
    .map((t) => ({ von: minutenAm(t.beginn, tag), bis: minutenAm(t.ende, tag), titel: t.titel, art: t.art }))
    .filter((b) => b.bis > b.von).sort((a, b) => a.von - b.von);
  return { tag, wt: WT_KURZ[i], nr: Number(tag.slice(8, 10)), ganztag: am.filter((t) => t.ganztag).map((t) => t.titel), bloecke, frei: freiAm(bloecke) };
}

