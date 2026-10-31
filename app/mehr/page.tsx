import { redirect } from 'next/navigation';

/** „Mehr“ heißt seit 0.28 „Leben“. Alte Lesezeichen und Kurzbefehle landen dort. */
export default function Mehr() {
  redirect('/leben');
}
