export const minuten = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
/** Fällig, wenn die Uhrzeit erreicht ist und höchstens zwei Stunden zurückliegt. */
export const faellig = (jetzt: string, zeit: string) => { const d = minuten(jetzt) - minuten(zeit); return d >= 0 && d <= 120; };
