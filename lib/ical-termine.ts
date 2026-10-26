import ICAL from 'ical.js';

/** iCalendar lesen, rein und ohne Netz. Wiederholungen und verschobene Einzeltermine rechnet ical.js aus. */

export type Vorkommen = { uid: string; beginn: string; ende: string; ganztag: boolean; titel: string };

/** Ein iCalendar-Objekt in Vorkommen zerlegen. Abgesagte Termine fallen weg. */
export function auswerten(ics: string, von: Date, bis: Date): Vorkommen[] {
  let comp: InstanceType<typeof ICAL.Component>;
  try { comp = new ICAL.Component(ICAL.parse(ics)); } catch { return []; }
  for (const tz of comp.getAllSubcomponents('vtimezone')) { try { ICAL.TimezoneService.register(tz); } catch { /* doppelt registriert */ } }
  const events = comp.getAllSubcomponents('vevent').map((v) => new ICAL.Event(v));
  const master = events.find((e) => !e.isRecurrenceException()) ?? events[0];
  if (!master) return [];
  for (const e of events) if (e !== master && e.isRecurrenceException()) { try { master.relateException(e); } catch { /* fremde UID */ } }
  const out: Vorkommen[] = [];
  const add = (start: InstanceType<typeof ICAL.Time>, ende: InstanceType<typeof ICAL.Time> | null, item: InstanceType<typeof ICAL.Event>) => {
    if (String(item.component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') return;
    const ganztag = start.isDate;
    const e = ende ?? start;
    const b = ganztag ? `${start.toString().slice(0, 10)}T00:00:00Z` : start.toJSDate().toISOString();
    const en = ganztag ? `${e.toString().slice(0, 10)}T00:00:00Z` : e.toJSDate().toISOString();
    if (Date.parse(en) < von.getTime() || Date.parse(b) > bis.getTime()) return;
    out.push({ uid: String(master.uid || '').slice(0, 200), beginn: b, ende: en, ganztag, titel: String(item.summary || '').replace(/\s+/g, ' ').trim().slice(0, 200) });
  };
  if (master.isRecurring()) {
    const it = master.iterator();
    for (let i = 0, t = it.next(); t && i < 5000; i++, t = it.next()) {
      if (t.toJSDate().getTime() > bis.getTime()) break;
      const d = master.getOccurrenceDetails(t);
      add(d.startDate, d.endDate, d.item);
    }
  } else add(master.startDate, master.endDate, master);
  return out;
}
