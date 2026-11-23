import { redirect } from 'next/navigation';

/** Die Hunderter sind seit 0.33 eine Saison im Format Challenge und stehen unter Plan → Saison. Alte Links und Lesezeichen landen dort. */
export default function Hunderter() {
  redirect('/ziele');
}
