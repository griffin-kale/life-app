import { redirect } from 'next/navigation';

/** „Mehr“ heißt seit Life 2.0 „Ich“. Alte Lesezeichen und Kurzbefehle landen dort. */
export default function Mehr() {
  redirect('/ich');
}
