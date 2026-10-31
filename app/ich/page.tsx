import { redirect } from 'next/navigation';

/** „Ich“ heißt seit 0.28 „Leben“. Alte Lesezeichen und Kurzbefehle landen dort. */
export default function Ich() {
  redirect('/leben');
}
