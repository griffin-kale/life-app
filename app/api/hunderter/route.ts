import { NextResponse, type NextRequest } from 'next/server';
import { oeffentlich } from '@/lib/fehler';
import { abschliessen, anlegen, hakenSetzen, heuteStand, joker, lebenAbhaken, phaseHand, uebersicht } from '@/lib/hunderter';
import { FORMAT_START, KONTEN_L, istTag, pruefeFormat, type LKonto } from '@/lib/hunderter-regeln';

const KEY = /^[a-z][a-z0-9]{0,11}$/;
import { mitNutzer } from '@/lib/sitzung';
import { heuteBerlin } from '@/lib/zeit';

/** Challenge (früher „Die Hunderter“): Stand heute, mit ?ganz=1 dazu Raster und Zähler der ganzen Saison. */
export async function GET(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  try {
    const ganz = req.nextUrl.searchParams.get('ganz') === '1';
    const [heute, saison] = await Promise.all([heuteStand(uid), ganz ? uebersicht(uid) : Promise.resolve(null)]);
    return NextResponse.json({ heute, saison, datum: heuteBerlin() });
  } catch (e) {
    return NextResponse.json({ error: oeffentlich(e, 'Die Challenge lässt sich gerade nicht laden.', 'hunderter') }, { status: 500 });
  }
}

/** Aktionen: anlegen, content, phase, leben, joker, abschluss. Jede Eingabe gegen feste Listen geprüft. */
export async function POST(req: NextRequest) {
  const { aus, uid } = await mitNutzer(); if (aus) return aus;
  const b = await req.json().catch(() => ({}));
  const falsch = () => NextResponse.json({ error: 'Ungültige Angaben.' }, { status: 400 });
  try {
    switch (b.aktion) {
      case 'anlegen': {
        if (!istTag(b.start)) return falsch();
        // Ohne Format gelten Name, Länge und Standards der ersten Hunderter
        const f = b.format === undefined ? FORMAT_START : pruefeFormat(b.format);
        if (typeof f === 'string') return NextResponse.json({ error: f }, { status: 400 });
        await anlegen(b.start, f, uid); break;
      }
      case 'content':
        if (![0, 1, 2].includes(b.n)) return falsch();
        await hakenSetzen('content', b.n, uid); break;
      case 'haken':
        if (typeof b.key !== 'string' || !KEY.test(b.key) || ![0, 1, 2].includes(b.n)) return falsch();
        await hakenSetzen(b.key, b.n, uid); break;
      case 'phase':
        if (typeof b.bereich !== 'string' || !KEY.test(b.bereich) || (b.delta !== 1 && b.delta !== -1)) return falsch();
        await phaseHand(b.bereich, b.delta, uid); break;
      case 'leben':
        if (!KONTEN_L.includes(b.konto) || typeof b.erledigt !== 'boolean') return falsch();
        await lebenAbhaken(b.konto as LKonto, b.erledigt, uid); break;
      case 'joker':
        if (!istTag(b.tag) || typeof b.setzen !== 'boolean') return falsch();
        await joker(b.tag, b.setzen, uid); break;
      case 'abschluss':
        if (typeof b.fazit !== 'string' || !Array.isArray(b.bremsen) || b.bremsen.length > 10) return falsch();
        await abschliessen(b.fazit, b.bremsen.filter((x: unknown) => typeof x === 'string'), uid); break;
      default:
        return falsch();
    }
    return NextResponse.json({ heute: await heuteStand(uid, false) });
  } catch (e) {
    return NextResponse.json({ error: oeffentlich(e, 'Das hat nicht geklappt.', 'hunderter') }, { status: 409 });
  }
}
