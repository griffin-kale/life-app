import { redirect } from 'next/navigation';

/** Der Kompass steht seit 0.28 oben auf „Stand“. Alte Lesezeichen und Mitteilungen landen dort. */
export default function Kompass() {
  redirect('/stand');
}
