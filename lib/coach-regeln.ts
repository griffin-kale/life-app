import type { Item } from './db';

/** Feste Regeln des Coachs. Was hier steht, kommt in jedem Fall auf den Bildschirm, auch wenn Claude ausfällt. */
const TAGE_ENGPASS = 3;

export function warnsignale(items: Pick<Item, 'kategorie' | 'hebel' | 'status' | 'stapel' | 'created_at' | 'schritt' | 'titel' | 'text'>[], jetzt = Date.now()): string[] {
  const w: string[] = [];
  const alt = items.filter((i) => (i.kategorie === 'engpass' || i.hebel === 3) && i.status === 'sortiert'
    && (i.stapel === 'jetzt' || i.stapel === 'woche') && jetzt - new Date(i.created_at).getTime() > TAGE_ENGPASS * 864e5);
  for (const i of alt.slice(0, 2)) {
    const tage = Math.floor((jetzt - new Date(i.created_at).getTime()) / 864e5);
    w.push(`„${(i.schritt || i.titel || i.text).slice(0, 70)}“ wirkt auf den Engpass und liegt seit ${tage} Tagen.`);
  }
  return w;
}
