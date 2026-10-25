'use client';
import { TabBar, TopBar, useToast } from '../../ui';
import { Essen } from '../essen';

/** Essen heute: Barcode, Foto oder ein Satz, Protein gegen das Ziel. */
export default function EssenSeite() {
  const [toast, setToast] = useToast();
  return (
    <main className="wrap">
      <TopBar title="Essen" back={{ label: 'Körper', href: '/koerper' }} />
      <header className="head"><span className="eyebrow">Heute</span><h1 className="title">Essen<i>.</i></h1></header>
      <Essen onFehler={(m) => setToast(m, 'err')} onOk={(m) => setToast(m)} />
      {toast}
      <TabBar />
    </main>
  );
}
