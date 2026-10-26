import { aktuelleSitzung } from '@/lib/sitzung';
import { Einrichten } from './einrichten';

export const dynamic = 'force-dynamic';

/** Erstes Gerät mit Einrichtungscode, jedes weitere angemeldet. Der Server sagt, was gilt. */
export default async function Setup() {
  return <Einrichten angemeldet={!!(await aktuelleSitzung())} />;
}
