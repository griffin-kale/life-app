'use client';
import Link from 'next/link';
import { Icon, TabBar, TopBar } from '../ui';

/** Alles, was nicht jeden Tag gebraucht wird. */
export default function Mehr() {
  return (
    <main className="wrap">
      <TopBar title="Mehr" />
      <header className="head"><h1 className="title">Mehr<i>.</i></h1></header>
      <section className="gsec">
        <div className="group">
          <Link className="cell" href="/kompass"><span>Kompass</span>{Icon.chevronRight}</Link>
          <Link className="cell" href="/archiv"><span>Logbuch</span>{Icon.chevronRight}</Link>
          <Link className="cell" href="/einstellungen"><span>Einstellungen</span>{Icon.chevronRight}</Link>
        </div>
      </section>
      <TabBar />
    </main>
  );
}
