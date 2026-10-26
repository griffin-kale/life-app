/** Zeit in Berlin an einer Stelle (Phase 3). Ohne Datenbank, damit die Unit-Tests Sommer- und Winterzeit prüfen können. */
export const TZ = 'Europe/Berlin';

const teile = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { jahr: g('year'), monat: g('month'), tag: g('day'), stunde: Number(g('hour')), minute: Number(g('minute')), sekunde: Number(g('second')), wt: g('weekday') };
};

/** Heutiges Datum in Berlin als JJJJ-MM-TT. */
export const heuteBerlin = (d = new Date()) => { const t = teile(d); return `${t.jahr}-${t.monat}-${t.tag}`; };
/** Stunde und Minute in Berlin. */
export const jetztBerlin = (d = new Date()) => { const t = teile(d); return { stunde: t.stunde, minute: t.minute, wochentag: t.wt }; };
/** Minuten seit Mitternacht in Berlin. */
export const minutenBerlin = (d = new Date()) => { const t = teile(d); return t.stunde * 60 + t.minute; };

/** Abstand Berlin zu UTC in Minuten zu einem Zeitpunkt: 60 im Winter, 120 im Sommer. */
export function versatzMin(d: Date): number {
  const t = teile(d);
  const alsUtc = Date.UTC(Number(t.jahr), Number(t.monat) - 1, Number(t.tag), t.stunde, t.minute, t.sekunde);
  return Math.round((alsUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** Mitternacht in Berlin für einen Tag (JJJJ-MM-TT) als echter Zeitpunkt. Stimmt auch an den Tagen der Zeitumstellung. */
export function tagesbeginn(tag: string): Date {
  const basis = Date.parse(`${tag}T00:00:00Z`);
  // Zweimal rechnen: Wechselt der Versatz in dieser Nacht, gilt der Versatz um Mitternacht Berliner Zeit
  let ts = basis - versatzMin(new Date(basis)) * 60000;
  ts = basis - versatzMin(new Date(ts)) * 60000;
  return new Date(ts);
}

/** Der Tag n Tage später, als JJJJ-MM-TT. */
export const plusTage = (tag: string, n: number) => new Date(Date.parse(`${tag}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Frist relativ zu heute, damit kein Datum an Claude geht: „heute“, „morgen“, „in 3 Tagen“, „2 Tage überfällig“. */
export function fristRelativ(frist: string | null | undefined, heute = heuteBerlin()): string {
  if (!frist || !/^\d{4}-\d{2}-\d{2}/.test(frist)) return '-';
  const t = Math.round((Date.parse(frist.slice(0, 10) + 'T12:00:00Z') - Date.parse(heute + 'T12:00:00Z')) / 864e5);
  if (t === 0) return 'heute';
  if (t === 1) return 'morgen';
  if (t > 1) return `in ${t} Tagen`;
  return t === -1 ? 'gestern überfällig' : `${-t} Tage überfällig`;
}
