# Änderungen

Alle Versionen von Life, neueste oben. Nummern nach [Semantic Versioning](https://semver.org/lang/de/): erste Zahl bei Umbrüchen, zweite bei neuen Funktionen, dritte bei Reparaturen.

## [0.30.1] – 2026-10-31

### Geändert
- **Schmale Seitenleiste auf Mac und iPad** (Peter, 31.10.2026: „ich mag das Menü aufm Desktop nicht“). Vier Bereiche untereinander, Unterpunkte erscheinen nur beim Bereich, in dem du gerade bist. Die Leiste ist 40 px schmaler, der Inhalt bekommt den Platz.

## [0.30.0] – 2026-10-31

Ablage: ein verborgener Bereich, Ende-zu-Ende verschlüsselt (Peter, 31.10.2026).

### Neu
- **Ablage.** Ohne Menüpunkt, Zugang über eine Geste. Öffnen braucht Face ID (Passkey) und eine eigene Passphrase. Der Browser verschlüsselt alles mit AES-256-GCM, bevor es zum Server geht. Ein zufälliger Inhaltsschlüssel liegt zweimal eingepackt auf dem Server: mit der Passphrase (PBKDF2-SHA-256, 600.000 Wiederholungen) und mit einem Wiederherstellungsschlüssel zum Ausdrucken. Server, Backups, Logs, andere Konten und Claude sehen nur Unlesbares.
- Sperrt sich nach zwei Minuten ohne Eingabe und sofort, wenn die App in den Hintergrund geht. Der Riegel nach Face ID gilt höchstens zehn Minuten und nur für diese Sitzung.
- Plan-Datei einlesen (im Browser gelesen, nur verschlüsselt gespeichert), Ansicht mit Überblick, Kategorien, Phasen, abhakbaren Jahreszielen, Gewohnheiten und Rhythmen. Dazu Notizen und Aufgaben mit Meilensteinen.
- Verschlüsselter Export als Datei, neue Passphrase über den Wiederherstellungsschlüssel.
- Keine KI, keine Suche, kein Coach, keine Mitteilungen, kein Diktat und keine Rechtschreibprüfung in der Ablage.

## [0.29.0] – 2026-10-31

Der Coach merkt sich Dinge, und Mac und iPad folgen dem neuen Menü ganz (Peter, 31.10.2026).

### Neu
- **Merkzettel des Coachs.** Sagst du dem Coach etwas Festes (Wohlfühlsumme, Vorlieben, Entscheidungen), merkt er es sich, und Life zeigt „✓ Gemerkt: …“. Der Merkzettel steht in jeder Antwort des Coachs, morgens wie im Gespräch. Unter Einstellungen siehst du alles und streichst einzelne Punkte, im Gespräch geht „vergiss …“. Höchstens 60 Punkte.
- **Gespräch der letzten sieben Tage.** Der Coach kennt jetzt, was ihr in der Woche besprochen habt, nicht nur heute.
- **Expertenmeinung.** Ein Knopf im Coach: Die nächste Antwort kommt von Opus, darf länger sein und wägt ab. Die Antwort trägt das Zeichen „Expertenmeinung“. Die Automatik für wichtige Fragen bleibt.
- **Der Coach trägt mehr selbst ein**, jede Aktion geprüft und von Life bestätigt: Gedanken ins Logbuch schreiben, das Wochenziel setzen und, wenn keine Saison läuft, Ziele für die nächste Saison vorschlagen. Die Vorschläge stehen vorgewählt im Blatt „Neue Saison“.
- **Seitenleiste als Baum** auf Mac und iPad: Plan mit Woche und Saison, Leben mit Körper, Ruhe, Geld, Menschen und Stand, dazu Logbuch. Oben steht Deep Work neben Festhalten (Taste F). Ab Mac-Breite zeigt die rechte Spalte der Woche die Saison mit allen Zielen.

### Repariert
- Sätze wie „Meine Wohlfühlsumme sind …“ landeten als Notiz im Logbuch und erreichten den Coach nie. Jetzt erkennt Life sie als Nachricht an den Coach.
- Links in Chips („Deep Work“ in der Liste) sind nicht mehr unterstrichen.

## [0.28.0] – 2026-10-31

Neues Menü nach Häufigkeit (Peter, 31.10.2026, Entwürfe „Life Menüstruktur“, Wahl A „Tun, Planen, Leben“).

### Geändert
- **Leiste: Heute · Plan · + · Leben · Logbuch.** Woche und Ziele sind jetzt „Plan“ mit dem Umschalter Woche | Saison. „Ich“ heißt „Leben“ und zeigt die vier Konten Körper, Ruhe, Geld und Menschen, jedes mit einem direkten Weg (Essen festhalten, Ruhe starten, Ausgabe festhalten, Wer ist dran?). Das Logbuch hat einen eigenen Tab. Einstellungen öffnet der Kreis oben rechts auf den vier Hauptseiten. `/ich` und `/mehr` führen zu Leben.
- **Deep Work und schnelle Wege sichtbar auf Heute.** Unter dem Cockpit stehen „Deep Work starten“ (mit der einen Sache) und die vier Wege Gedanke, Ausgabe, Essen und Ruhe. Das Haltemenü auf dem Plus bleibt als Abkürzung. Gespeicherte Heute-Listen bekommen den Baustein einmal unter das Cockpit, wer ihn ausschaltet, behält das.
- **Stand fasst Kompass und Standortbestimmung zusammen.** Oben die Wochenringe mit den Konten zum Aufklappen und dem Wohlbefinden, darunter Baseline, Engpass, Richtung und Etappen. `/kompass` führt zu Stand.
- **Mac und iPad** zeigen dieselben vier Bereiche, darunter Konten und Stand.

### Repariert
- **Musik spielt von selbst weiter.** Am Ende eines Stücks startet das nächste, auch wenn das erste Stück zufällig das erste der Liste war (Peter, 31.10.2026: „muss ich grade noch manuell drücken“).
- Die kleinen Ringe stehen in Zellen nicht mehr als Link im Link.

## [0.27.0] – 2026-10-31

Liste, Fokus und Rituale in einem Update (Peter, 31.10.2026: „Alles zusammen“). Phase 2 von Life 2.0 ist damit fertig.

### Neu
- **Liste auf Heute.** Ersetzt „Danach“: Jetzt mit Balken („2 von 3 geschafft“), gerade Festgehaltenes, solange Claude einordnet, und aus jeder Aufgabe Deep Work. Die ganze Liste mit allen Stapeln steht unter Woche. Kein Punktestand.
- **Deep Work.** Ein eigener Bildschirm mit Timer (25 + 5, 50 + 10 oder 90 + 20 Minuten, feste Pause), der einen Sache, der nächsten Aufgabe, dem nächsten Termin und der Musik. „Gedanke parken“ hält Ablenkungen fest, ohne den Modus zu verlassen. Erreichbar an der einen Sache, an jeder Aufgabe der Liste, als erster Weg im Haltemenü der Mitte und auf dem Mac mit Taste F. Auf dem iPhone bleibt der Bildschirm an (ab iOS 18.4), und solange Musik läuft, zeigt der Sperrbildschirm Aufgabe und Restzeit. Auf dem Mac gibt es Vollbild und, in Chrome, Edge, Arc und Firefox, ein Mini-Fenster über allen Programmen. Der Timer rechnet mit der Startzeit und der Uhr des Servers. Nach jedem Block ein Tipp: zäh, okay oder im Fluss.
- **Musik zum Fokus.** Zehn freie Aufnahmen von Musopen (CC0, Bach, Chopin, Albinoni, Beethoven, Brahms, zusammen 54 Minuten), dazu eine Fokus-Welle (dieselbe Musik mit einer schnellen, leisen Lautstärke-Welle wie bei Brain.fm), braunes Rauschen und Stille. Alles kommt vom eigenen Server oder entsteht im Browser.
- **Musiktest über 14 Tage.** Life wechselt fair zwischen Klassik, Fokus-Welle und Stille und zeigt, mit welcher Musik du am häufigsten im Fluss warst. Ab drei Blöcken pro Art und mit klarem Abstand nennt Life eine Gewinnerin, sonst sagt es ehrlich: kein klarer Unterschied.
- Im Haltemenü der Mitte steht Deep Work an erster Stelle, Training ist weiter unter Körper.
- **Morgen und Abschluss als Blatt.** Morgens: wie erholt du bist, was von gestern übrig ist, die eine Sache. Abends: abhaken, Offenes verteilen, wie der Tag war. Auf Heute steht dafür eine Karte, die Mitteilungen öffnen das Blatt direkt.
- **Wochenrunde.** Ersetzt Wochenstart und Wochenbogen: Rückblick mit Fokusminuten, Hebel der Saison bewerten (auf Kurs, anpassen, daneben), Hebel dazunehmen oder entfernen, ein Ziel in einem freien Bereich ergänzen, Engpass, drei Dinge, Geld-Check, alle zwei Wochen „Wie geht es dir?“ mit WHO-5, Parkplatz.

### Geändert
- **Kompass ohne Punkte.** Die fünf Ringe bleiben, Level, Punkte und Meilensteine samt Mitteilungen fallen weg. Die Daten bleiben gespeichert.
- Der Wochenbogen steht nicht mehr auf Woche, die Fragebögen nicht mehr auf Heute.

### Technik
- Datenbank-Schritt 6: Tabelle `fokus_bloecke` mit `user_id`.
- `lib/fokus-regeln.ts`, `lib/fokus.ts`, `GET`/`POST /api/fokus`, `PATCH`/`DELETE /api/saison/hebel/[id]`, `POST /api/saison/ziele`, `POST /api/saison/ziele/[id]`. Musik unter `public/musik` mit Quellen in `public/musik/QUELLEN.md`.

### Tests
- Unit-Tests für Timer, Musiktest-Wechsel und Auswertung, Liste statt Danach. Ende-zu-Ende: Liste, Morgen, Abschluss, Wochenrunde mit WHO-5, Hebel bewerten und ändern, Fokus mit Bewertung und Musiktest, Kompass ohne Punkte, Musik nur mit Anmeldung, die Zweite sieht Peters Fokus nicht.

## [0.26.0] – 2026-10-29

Phase 2 von Life 2.0, erster Teil: Saison und Ziele (Peter, 29.10.2026: „A Zielkarten“, „Eins pro Bereich“, „Blatt in drei Schritten“, „Ringe bleiben, Punkte gehen“).

### Neu
- **Saison mit zwölf Wochen.** Unter Ziele legst du eine Saison an: Start an einem Montag, ein Leitsatz, höchstens ein Ziel pro Bereich (Geschäft, Zeit, Körper, Ruhe und Geist, Menschen, Geld), je bis zu drei Hebel und ein Wenn-dann-Plan.
- **Blatt „Neue Saison“ zum Antippen.** Vorschläge kommen aus „Dein Stand“, aus deiner bisherigen Zielliste und aus festen Ideen pro Bereich. Claude schlägt pro Ziel drei Hebel und einen Dann-Satz vor und sieht dabei nur Platzhalter. Eigene Worte gehen überall.
- **Zielkarten.** Jede Karte zeigt Bereich, Ziel, Stand mit Zählern (+1, −1) und ob du im Plan bist, die Hebel mit ihrer letzten Bewertung und den Wenn-dann-Satz. Karten ohne Handlungsbedarf klappen zu.
- **Die Saison gilt überall.** Einordnen, Sortieren, Coach und die Ziel-Auswahl im Eintrag nehmen die Saisonziele. Benennst du ein Ziel um, ziehen die Einträge mit. Die Einstellungen zeigen die Saisonziele statt des Textfelds.

### Technik
- Datenbank-Schritt 5: Tabellen `saisons`, `saison_ziele`, `hebel`, `hebel_wochen`, alle mit `user_id`.
- `lib/saison-regeln.ts` (reine Regeln), `lib/saison.ts`, `GET`/`POST /api/saison`, `POST /api/saison/hebel`, `PATCH /api/saison/ziele/[id]`.

### Tests
- Unit-Tests für Zeitraum, Prüfung des Blatts, Wenn-dann-Satz, Vorschläge und Claudes Hebel. Ende-zu-Ende: Blatt durchklicken, Zielkarten, Zähler, Umbenennen, zweite Saison abgelehnt, die Zweite sieht Peters Saison nicht.

## [0.25.2] – 2026-10-28

### Behoben
- **Coach auf dem Mac sieht ruhig aus.** Der Text reißt nicht mehr an einer harten Kante unter dem Feld ab, unten leuchtet kein heller Streifen mehr, und die Vorschläge brechen um, statt aus dem Rahmen zu laufen.

### Technik
- Anthropic-SDK 0.137.0 und Playwright 1.64.1 (Dependabot, #27), geprüft mit Typecheck, Unit-Tests, Build und e2e.

## [0.25.1] – 2026-10-28

### Behoben
- **Der Zeitplan bleibt nicht mehr stehen.** Am 27.10. um 5:25 Uhr kam in einem Lauf ein Schritt nie zurück. Seitdem fiel jeder weitere Lauf aus: keine Mitteilungen, kein WHOOP- und Kalenderabgleich, `/api/health` meldete Verzug. Jetzt gibt der nächste Lauf einen hängenden nach zehn Minuten frei. Doppelte Arbeit verhindert weiter die Sperre in der Datenbank.
- **Das Log nennt den Schritt, an dem ein Lauf hängt** (zum Beispiel „whoop“ oder „kalender“), nie einen Inhalt. So lässt sich die eigentliche Ursache beim nächsten Mal finden.

## [0.25.0] – 2026-10-27

Phase 1 von Life 2.0: Heute als Cockpit, Woche mit Kalender, vier Tabs (Peter, 27.10.2026: „B Cockpit mit Tagesstreifen“, „Vier Tabs + Festhalten“).

### Neu
- **Heute ist ein Cockpit.** Oben drei Kacheln: Erholung mit Schlaf aus WHOOP, freie Zeit heute aus dem Kalender, Erledigtes dieser Woche. Darunter die eine Sache, dann der **Tagesstreifen** mit den nächsten drei Blöcken aus Terminen und Aufgaben, dann **Konten heute**: je Konto eine Zeile, was heute zählt (zum Beispiel „Protein-Ziel heute 150 g“). Wo Daten fehlen, steht, was fehlt, nie eine nackte Null.
- **Woche zeigt den Kalender.** Auf dem iPhone ein Streifen mit sieben Tagen und darunter die Termine des gewählten Tags, ab 900 px ein Wochenraster. Darunter fünf **Rhythmen** der Woche (Erledigt, Bewegung, Ruhe, Menschen, Geld) statt Serien. Parkplatz, Zeit kaufen und Energie-Bilanz stehen unter „Mehr zur Woche“.
- **Vier Tabs: Heute · Woche · Ziele · Ich**, Festhalten in der Mitte. Ein Tipp hält einen Gedanken fest, Halten öffnet die sechs schnellen Wege (Gedanke, Ausgabe, Essen, Training, Ruhe, Coach).
- **Ziele** hat eine eigene Seite: Wochenziel, deine Ziele mit Fortschritt, Kompass und Dein Stand.
- **Ich** bündelt die fünf Konten Körper, Ruhe, Geld, Menschen, Logbuch und die Einstellungen. „Mehr“ leitet dorthin weiter, alte Lesezeichen gehen also nicht kaputt.

### Geändert
- **Design-Token 2.0:** tieferes Nachtblau, Flächen in zwei Stufen, besser lesbares Grau in Hell und Dunkel. Imperial Blue bleibt.
- Heute zeigt keine Wochenringe und kein „Empfohlen“ mehr, der Kompass steht unter Ziele. Eine gespeicherte Heute-Reihenfolge wird beim ersten Öffnen nachgerüstet.
- Auf der Woche steht der WHO-5-Hinweis nicht mehr, WHO-5 hat einen festen Ort.

### Technik
- `lib/cockpit.ts` und `GET /api/heute/cockpit`, `lib/woche.ts` und `GET /api/woche`, reine Regeln in `lib/cockpit-regeln.ts`, `lib/woche-regeln.ts` und `lib/kalender-regeln.ts` (`wochenTag`, `freiAm`).

### Tests
- Unit-Tests für Tagesstreifen, Konten heute, Wochentage, Rhythmen und freie Zeit. Ende-zu-Ende: Cockpit, Woche mit Kalender und Rhythmen, vier Tabs, Halten öffnet sechs Wege, Ich und Ziele ohne waagerechtes Scrollen auf 390 px.
- Der Coach-Schritt im großen Ablauf wackelt nicht mehr, wenn die Sortierung die beiden KGSt-Einträge schon zusammengeführt hat.

## [0.24.0] – 2026-10-27

Phase 0 von Life 2.0: Fundament (Peter, 27.10.2026). Für dich sieht Life gleich aus. Darunter ist es bereit für einen zweiten Menschen und für den Umbau von Heute und Woche.

### Sicherheit
- **Der Mensch kommt aus der Sitzung.** Keine Route und keine Bibliothek setzt mehr fest „peter“ ein. Einträge, Korrekturen, Sortierlauf, Suche und Export filtern nach dem Menschen der Sitzung. Fremde Einträge lassen sich auch per ID weder lesen noch ändern noch löschen.
- **Kein stiller Rückfall auf Peters Haushalt.** Hat ein Mensch keinen Haushalt, bricht Geld mit einem Fehler ab, statt Peters Zahlen zu zeigen.
- **Mitteilungen abbestellen** geht nur für die eigenen Abos.
- **Namen zum Schützen** umfassen jetzt auch die Teamlisten aller Menschen und die Namen im Haushalt. Von Claude gelernte Namen gehören dem Menschen, aus dessen Eintrag sie kommen (Schritt 4), geschützt werden sie bei allen.
- **Passwort und Code gehören dem ersten Menschen.** Ein anderer Mensch kann sie weder einrichten noch abschalten und sich so nie als Peter anmelden.
- **Der iCloud-Zugang aus der .env gilt nur für den ersten Menschen.** Ohne diese Grenze hätte der Zeitplan Peters Termine auch bei weiteren Menschen eingetragen.
- **Neu einordnen** geht nur für eigene Einträge. Ein Abo für Mitteilungen wechselt nicht still den Menschen.
- **Zeitplan:** Scheitert der Lauf für einen Menschen, meldet `/api/health` den Verzug, statt den Fehler zu verstecken.

### Technik
- **Nummerierte Migrationen** in `lib/migrationen.ts` mit Tabelle `schema_version`, Sperre gegen zwei gleichzeitige Starts und einer Transaktion pro Schritt. Schritt 1: fehlende Indizes `korrekturen(item_id)` und `ruhe(user_id, tag)`. Schritt 2: Engpass, Ziele, Team, Mitteilungen und Sortierstand gelten pro Mensch, Peters Werte werden übernommen. Schritt 3: „schon gesendet“ für Mitteilungen pro Mensch, damit nach dem Update keine Mitteilung doppelt kommt.
- **Zeitplan für jeden Menschen einzeln.** Scheitert der Lauf für einen, laufen die anderen weiter.
- **Anmeldung:** Ein Passkey meldet den Menschen an, dem er gehört. Passwort und Code, Einrichtungscode und Kurzbefehl gehören dem ersten Menschen.
- README und `.env.example` beschreiben die Anthropic-API statt Bedrock.

### Tests
- Neu: zwei Menschen sehen nur ihre eigenen Einträge, Einstellungen und ihr Geld (Ende-zu-Ende). Statisch: kein `'peter'` in Routen, keine Standard-Menschen in `lib`. Migrationen in der richtigen Reihenfolge. Version in `package.json`, CHANGELOG und UEBERGABE stimmt überein.
- Der Trainingsschritt im großen Ablauf läuft jetzt an jedem Wochentag.

## [0.23.0] – 2026-10-26

Coach mit Händen, Opus für entscheidende Momente, Ziehen zum Neuladen (Peter, 26.10.2026).

### Neu
- **Nach unten ziehen lädt neu.** In der App vom Home-Bildschirm ganz oben nach unten ziehen, loslassen, Life lädt neu.
- **Zielsumme ändern.** Unter Geld → Sparziele hat jedes Ziel „Ziel ändern“.
- **Der Coach kann Geldwerte setzen.** Sagst du ihm „Setz mein Sparziel Urlaub auf 3000 Euro“, ändert Life die Zielsumme. Genauso Rücklage und Sparrate. Life bestätigt selbst mit „✓ Gespeichert …“ oder sagt, warum es nicht ging. Der Coach behauptet nichts mehr, was er nicht getan hat.
- **Opus in entscheidenden Momenten.** Der Morgen-Coach, die Standortbestimmung und Gespräche über Entscheidungen, Planung oder Überlastung laufen über Claude Opus. Ist Opus nicht erreichbar, antwortet Sonnet.

### Behoben
- Der Coach hat Änderungen bestätigt, die er gar nicht machen konnte.

## [0.22.1] – 2026-10-26

Aufräumen nach dem Merge von 0.16.1 bis 0.22.0 (Peter, 26.10.2026).

### Behoben
- **`main` baut wieder.** Drei Dependabot-Updates sind zurückgenommen: TypeScript 7 (Next.js fand die Pfade `@/lib` nicht mehr), `@simplewebauthn/server` 14 (die Passkey-Anmeldung nutzt Typen, die es dort nicht mehr gibt) und React 19.3 ohne passendes `react-dom`. Der Code ist danach derselbe wie in 0.22.0, das live läuft.

### Geändert
- **Dependabot:** Große Versionssprünge kommen nicht mehr als Pull Request. Kleine Updates kommen gebündelt einmal im Monat, React und React DOM immer zusammen, GitHub-Actions als ein Pull Request. Sicherheitsupdates meldet GitHub weiter sofort.
- **React und React DOM 19.3.1**, jetzt gemeinsam (#26). Typecheck, Unit-Tests, Build und e2e laufen damit durch.
- **GitHub-Actions** `checkout`, `setup-node` und `upload-artifact` auf Version 7 (#25). Das betrifft nur die Prüfung bei GitHub, nicht die App.

## [0.22.0] – 2026-10-26

Ein Feld für alles (Peter, 26.10.2026): Mockup K1, ohne Umschalter.

### Neu
- **Die Leiste wächst zum Feld.** Ein Tippen auf „Was geht dir durch den Kopf?“ öffnet ein großes Eingabefeld mit Tastatur, darüber nur der letzte Satz vom Coach. „Gespräch öffnen“ oder ein Tipp auf den Satz zeigt das ganze Blatt.
- **Ein Knopf statt zwei.** Life hält jeden Text fest. Claude erkennt beim Einordnen, ob er sich an den Coach richtet (`anCoach`). Dann antwortet der Coach im Gespräch, das Blatt geht auf, und der Eintrag landet unter Archiviert statt in den Stapeln. Sonst schließt das Feld mit „Festgehalten“.
- Die Vorschläge im Gespräch („Was jetzt?“, „Ich bin müde“) gehen wie bisher direkt an den Coach.

### Technik
- Neue Spalte `items.an_coach` (additiv). Der Coach antwortet über `coachChat` direkt nach dem Einordnen, auf demselben pseudonymisierten Weg.

### Tests
- Ende-zu-Ende: Gedanke im Feld wird festgehalten und das Feld schließt, eine Frage öffnet das Gespräch mit Antwort und landet nicht in den Stapeln, kein „Coach fragen“-Knopf mehr.

## [0.21.0] – 2026-10-26

Phase 3 aus `docs/VERBESSERUNG.md`: Datenschutz (Peters Wahl, 26.10.2026).

### Datenschutz
- **Kein Datum an Claude.** Coach und Sortierlauf nennen nur den Wochentag. Fristen gehen relativ raus („morgen“, „in 3 Tagen“, „2 Tage überfällig“), nicht als Datum.
- **Kalendertitel mit Schutzliste.** Termine mit Wörtern zu Gesundheit, Behörden, Recht oder Geld gehen nur als „Termin privat“ an Claude. Unbekannte Namen nach „mit“, „bei“, „von“, „für“ werden zu „jemandem“. Bekannte Namen ersetzt wie bisher die Pseudonymisierung.
- **Bon zuschneiden.** Vor dem Senden ziehst du zwei Kanten auf Posten und Summe. Nur dieser Streifen verlässt den Browser, Adresse oben und Kartennummer unten bleiben auf dem iPhone. Mit Pfeiltasten geht es auch ohne Ziehen.
- **YouTube nur mit Video-ID.** Life fragt YouTube nur noch mit der ID nach dem Titel, ohne Zeitmarken, Playlists und Tracking-Parameter, und folgt keinen Weiterleitungen. Die Ausnahme steht in `CLAUDE.md`.

### Behoben
- **Zeitzone.** `lib/zeit.ts` rechnet Datum, Uhrzeit und Tagesbeginn in Berlin an einer Stelle. Der Kalender las bisher mit festem `+01:00` und verschob im Sommer den Tagesbeginn um eine Stunde. Wochenstart-Mitteilung und Zeit-kaufen-Hinweis prüfen den Montag jetzt in Berliner Zeit statt in der Zeitzone des Servers.

### Tests
- Neu: `tests/unit/zeit.test.ts` (Tagesbeginn in Winter, Sommer und an beiden Umstellungstagen, relative Fristen, Schutzliste, Video-ID). Ende-zu-Ende: Bon-Zuschnitt, kein Datum in Coach- und Sortier-Prompts.

## [0.20.0] – 2026-10-26

Neue Leiste unten (Peter, 26.10.2026): Variante N2 mit Halten aus N1. Grundlage: Apples schwebende Tab-Leiste aus iOS 26, Erfahrungen mit versteckten Gesten (3D Touch), Instagrams Umbau 2026 (die Mitte gehört dem Häufigsten), Daumenzone.

### Neu
- **Schwebende Pille:** Woche · Körper · **Heute** · Geld · Mehr, Heute groß in der Mitte. Von jeder Seite bringt die Mitte zu Heute.
- **Plus auf Heute:** Bist du auf Heute, wird die Mitte zum Plus. Ein Tipp öffnet sechs Wege: Gedanke, Ausgabe, Essen, Training, Ruhe, Coach.
- **Halten auf Körper und Geld** öffnet deren Schnellmenü: Krafteinheit, Ruhe, Mahlzeit, Nacht und Ausgabe, Pro Monat, Sparziele, Alle Buchungen. Alles darin ist auch auf der Seite selbst erreichbar.

### Geändert
- „Empfohlen für dich“ ist wieder Standard, direkt unter der einen Sache (`STAND = 7`). Die Schnellzugriffe auf Heute sind weiter zuschaltbar, das Plus in der Mitte ersetzt sie.
- Die Coach-Leiste sitzt über der Pille, Meldungen weichen beiden aus.

### Tests
- Ende-zu-Ende: Mitte führt zu Heute, Plus mit sechs Wegen, Gedanke öffnet den Coach mit Tastatur, Halten auf Körper öffnet das Menü ohne zu navigieren.

## [0.19.0] – 2026-10-26

Heute nach The ONE Thing von Gary Keller, dazu ein Sweep durch die ganze App: so wenig wie möglich, nur so viel wie nötig (Peter, 26.10.2026). Grundlage: drei Mockups (Peters Wahl O1), Recherche zu Kellers Leitfrage, Aufmerksamkeitsrest (Leroy 2009), offenen Zielen mit Plan (Masicampo und Baumeister 2011), Hick-Gesetz und Progressive Disclosure.

### Neu
- **Die eine Sache.** Heute zeigt eine große Karte mit der einen Sache des Tages, „Erledigt“ und „⋯“. Im Menü liegen Uhrzeit, „Nicht heute“, Wenn-dann-Plan und „Neu sortieren“. Freie Zeit aus dem Kalender steht als Chip auf der Karte.
- **Claude wählt mit der Leitfrage.** Beim Sortieren ist Rang 1 in „Jetzt“ die Sache, durch die alles andere leichter oder unnötig wird. Die anderen sind die Dominosteine danach.
- **Zur einen Sache.** Unter „Danach“ holt ein Tipp eine andere Aufgabe nach vorn. Claude lernt daraus wie aus jeder Korrektur.
- **Danach und Heute erledigt** sind zugeklappt und zeigen nur eine Zahl.
- **Wochenringe klein neben dem Titel.** Tippen öffnet den Kompass.

### Geändert
- **Engpass:** eine Zeile mit Zielscheibe über der Karte, ohne Erklärsatz. Auf Woche steht er nicht mehr doppelt.
- **Aufgabenzeilen überall:** nur Titel, Frist und Übergabe. Begründung, Ziel, Aufwand und Engpass-Marke stehen im Eintrag.
- **Heute standardmäßig:** Ringe, die eine Sache, Fragebogen (wenn fällig), Danach, Heute erledigt. Empfohlen und Schnellzugriffe sind nicht mehr Standard (der Coach formuliert die Empfehlung), die Tagespunkte fallen weg. Gespeicherte Listen stellt Life einmal um (`STAND = 6`).
- **Coach:** zwei Vorschläge statt vier. Wochenstart und Standortbestimmung stehen nur noch als Knopf, nicht zusätzlich als offener Punkt.
- **Woche:** Karten nur mit Zahl, Erklärsätze unter Parkplatz, Streichen und Energie weg, WHO-5 nur noch, wenn der Wert unter 51 liegt.
- **Eintrag:** eine Begründung statt zwei. Kategorie, Art, Typ, Hebel und Aufwand liegen unter „Einordnung“ zum Aufklappen.
- **Kompass:** Konten als Zeilen mit Ring, Prozent und Level, Details zum Aufklappen. Wohlbefinden und Meilensteine sind zugeklappt, der Punkte-Erklärsatz ist weg.
- **Körper:** drei Karten statt vier (Training und Ausdauer sind „Bewegung“), Erholung nur mit Zahl und Satz, Abgleich auf der Seite Nacht.
- **Geld:** Karten nur mit Zahl („Frei pro Monat“ statt „Monatlich“), Topf-Kacheln ohne Rahmen und Übertrag, kurzer Text beim Einrichten.
- **Mehr:** Zeilen ohne Unterzeile.

### Tests
- Ende-zu-Ende: die eine Sache mit Menü, Rückgängig nach „Nicht heute“, „Zur einen Sache“, zugeklappte Listen, Kompass-Konten, Körper-Abgleich auf Nacht. Unit: Umbau der gespeicherten Listen auf Stand 6.

## [0.18.0] – 2026-10-26

Heute aufgeräumt (Peter, 26.10.2026): Richtung B aus drei Mockups, der Coach geht wie in Richtung A als Blatt auf. Zieht Teile von Phase 4 aus `docs/VERBESSERUNG.md` vor.

### Neu
- **Wochenringe ganz oben.** Fünf Ringe ineinander wie bei Apple Fitness, daneben die Werte pro Konto und das Level. Tippen öffnet den Kompass.
- **Coach-Leiste unten.** Über der Tab-Leiste sitzt „Was geht dir durch den Kopf?“. Ein Tippen öffnet den Coach als Blatt von unten, die Tastatur ist sofort da. Ein gelber Punkt zeigt, dass der Coach Warnsignale oder Offenes hat.
- **Ein Feld für beides.** Im Coach entscheidest du mit zwei Knöpfen: „Festhalten“ legt einen Eintrag an, „Coach fragen“ schickt die Nachricht an den Coach. Mikrofon und Vorschläge liegen direkt darüber.
- **Spur im Gespräch.** Was du heute festhältst, steht als goldene Blase im Coach-Verlauf, mit dem Titel von Claude. Tippen öffnet den Eintrag. Die Spur kommt aus der Datenbank von Life und geht nie an Claude.
- **Gespräch kompakt.** Der Coach zeigt die letzten vier Blasen, „Ganzes Gespräch“ klappt den Rest auf. Das Blatt hat nur noch eine Scrollfläche.
- **Freie Zeit an der ersten Aufgabe.** Findet Life im Kalender Platz fürs Wichtigste, steht an der ersten Aufgabe in „Jetzt dran“ ein Chip wie „14:00–15:30 frei“. Tippen setzt die Uhrzeit.
- **Engpass bei den Aufgaben.** Der Engpass steht nicht mehr als Kasten im Kopf, sondern als getönte Zeile oben in „Jetzt dran“: „Zahlt ein auf deinen Engpass: …“. Tippen führt in die Einstellungen. Ohne Engpass steht dort „Engpass festlegen“ (Variante E3 aus vier Mockups).
- **Mac und iPad quer:** Der Coach steht fest in der rechten Spalte. N und „Festhalten“ oben rechts springen auf Heute direkt ins Feld.

### Geändert
- Heute zeigt standardmäßig: Wochenringe, Fragebogen (wenn fällig), Jetzt dran, Empfohlen, Schnellzugriffe, Als Nächstes, Heute erledigt.
- Der Kalender-Block, das Festhalten-Feld und die Tagespunkte sind nicht mehr Standard. Unter „Heute anpassen“ lassen sie sich wieder dazuschalten.
- „Zuletzt festgehalten“ ist weg von Heute. Alles steht im Logbuch.
- Gespeicherte Listen stellt Life einmal um (`STAND = 5` in `lib/heute-bausteine.ts`): Ringe nach oben, Jetzt dran früh, eigene Bausteine wie Körper kurz bleiben.
- Der Baustein „coach“ fällt weg, der Coach ist immer da.
- Das Plus oben rechts auf Heute fällt weg, die Coach-Leiste übernimmt.

### Technik
- `/api/heute` liefert in `zuletzt` alle Einträge von heute (höchstens 50) statt der letzten drei.
- Spracheingabe als eigener Hook (`app/sprache.ts`) für Coach und Festhalten-Feld.

### Tests
- Ende-zu-Ende: Festhalten über das Coach-Blatt mit Spur, Coach fragen im Blatt, Coach fest rechts auf dem Mac mit Taste N, Kalender als zuschaltbarer Baustein. Unit: Umbau der gespeicherten Listen.

## [0.17.0] – 2026-10-26

Phase 2 aus `docs/VERBESSERUNG.md`: Betrieb. Teil 1 ohne SSH, Uptime Kuma und fertige Images, die brauchen erst Schritte von Peter.

### Neu
- **`/api/health` meldet mehr.** Neben der Datenbank auch den Zeitplan (503 ab fünf Minuten Verzug, direkt nach dem Start „startet“), das Alter der letzten Sicherung (503 ab 26 Stunden) und den letzten Wiederherstellungstest (503 bei Fehler oder nach 40 Tagen). Die Antwort enthält nur Wörter wie „ok“ oder „alt“, keine Zeiten.
- **Sicherung mit Prüfung** (`deploy/backup.sh`, nachts 3:15 Uhr): bricht ab, wenn `pg_dump` scheitert, das gzip kaputt ist, das Endzeichen des Dumps fehlt oder die Datei zu klein ist. Ein halber Dump ersetzt nie mehr einen guten. Bewahrt 30 Tage auf, das Hetzner-Server-Backup nimmt den Ordner mit.
- **Wiederherstellungstest** (`deploy/restore-test.sh`, am 1. jedes Monats): spielt die neueste Sicherung in eine Wegwerf-Datenbank ohne Netz ein und zählt Tabellen und Einträge.
- **Aufspielen in einer Verbindung** (`deploy/aufspielen.sh`): sichert vorher, aktualisiert auch Postgres und Caddy, wartet auf `/api/health`. Touch ID kommt zweimal (Version) oder dreimal (`--build`), vorher bis zu 32-mal, weil jeder Gesundheits-Check eine eigene Verbindung war. Bei `--build` bleibt das alte Image als `life-app:prev` stehen.
- **Healthchecks** im Compose für App, Datenbank und Caddy, Logs aller Dienste höchstens 3 × 10 MB.
- **Zugriffslog in Caddy**, 14 Tage, ohne Query-Strings, Kopfzeilen und Cookies.

### Behoben
- **Zeitplan überlappt nicht mehr.** Ein Merker im Prozess plus eine Postgres-Sperre (`pg_try_advisory_lock`) verhindern, dass ein langsamer Lauf und der nächste gleichzeitig senden.
- **Mitteilungen kommen nur einmal.** `einmal()` setzt „gesendet“ in einer einzigen Anweisung vor dem Senden. Klappt das Senden nicht, wird der Merker zurückgesetzt und der nächste Lauf versucht es wieder.
- Fehler im Zeitplan schreiben nur noch den Fehlernamen ins Log, keine Texte.

### CI
- Die CI läuft für jeden Pull Request, egal auf welchen Zweig. Actions sind auf Commit-SHA festgelegt.
- Ein Release baut nur, wenn der Tag auf `main` steht, zur Version in `package.json` passt und dieselben Prüfungen grün sind. Der Digest des Pakets steht in der Zusammenfassung.

### Tests
- Neu: `tests/unit/zeitplan-schutz.test.ts` (Überlappung, einmal senden, Zurücksetzen, Gesundheit) und `tests/unit/betrieb.test.ts` (Alter von Sicherung und Test). Beide Skripte sind gegen eine Attrappe für `docker` geprüft: guter Dump, abgebrochener Dump, kaputte Datei.

## [0.16.1] – 2026-10-26

### Behoben
- **Sortieren brach mit Fehler 400 ab.** Das große Modell lässt kein erzwungenes Werkzeug mehr zu (`tool_choice` „tool“). Life merkt das beim ersten Aufruf, fragt sofort mit „auto“ und einer Systemanweisung nach und bleibt bis zum Neustart dabei. Das schnelle Modell antwortet weiter über das erzwungene Werkzeug. Gilt für alle Claude-Aufrufe: Sortieren, Einordnen, Coach, Essen, Bon, Standort.
- Ein Fehler beim Sortieren stand doppelt da („Sortieren hat nicht geklappt: Sortieren hat nicht geklappt.“). Jetzt steht dort, was passiert ist.

### Tests
- Die Claude-Attrappe lehnt für Modelle mit „ohne-zwang“ im Namen das erzwungene Werkzeug ab. Die Ende-zu-Ende-Tests laufen das große Modell so, das schnelle wie bisher. Neu: `tests/unit/claude-werkzeug.test.ts`.

## [0.16.0] – 2026-10-26

Phase 1 aus `docs/VERBESSERUNG.md`: Sicherheit. Nach dem Aufspielen meldet sich jedes Gerät einmal neu an.

### Sicherheit
- **Einrichtungscode ist kein Generalschlüssel mehr.** Er gilt nur, solange weder Passkey noch Passwort eingerichtet sind. Weitere Geräte richtest du angemeldet ein: Einstellungen → „Weiteres Gerät einrichten“.
- **Abmelden meldet wirklich ab.** Sitzungen stehen jetzt in der Datenbank (Tabelle `sitzungen`). Abmelden widerruft die Sitzung, ein kopiertes Cookie gilt danach nicht mehr. Neu in den Einstellungen: „Auf allen Geräten abmelden“.
- **Zwei Riegel:** Die Middleware lässt nur genau benannte Pfade ohne Anmeldung durch, keine Präfixe mehr. Jede API-Route prüft die Sitzung zusätzlich selbst gegen die Datenbank.
- **Schutz vor untergeschobenen Anfragen (CSRF):** Schreibende Anfragen an `/api` brauchen die Herkunft von Life. Ausnahme ist der Kurzbefehl mit eigenem Schlüssel. Cookies tragen über HTTPS den Präfix `__Host-`.
- **Pseudonymisierung fällt geschlossen aus:** Kann Life die Namensliste nicht lesen, bricht der Claude-Aufruf ab, statt Namen im Klartext zu schicken.
- **Begrenzungen:** Neu sortieren auf Knopfdruck höchstens zehnmal in 15 Minuten. Bei Passwort und Code zählen über alle Adressen nur noch Fehlversuche, damit dich niemand mit Anfragen aussperren kann.
- **Feste Fehlermeldungen:** Texte von Anthropic, WHOOP, iCloud und simplewebauthn gehen nicht mehr an die Oberfläche oder in die Datenbank, nur eigene deutsche Meldungen.
- **CSP ohne `unsafe-inline` für Skripte:** Jede Seite bekommt eine eigene Nonce, dazu `'strict-dynamic'` und `object-src 'none'`.
- **Fotos:** Der Server prüft, ob ein Foto ein JPEG ist, und entfernt EXIF, IPTC und Kommentare, bevor es an Claude geht. Caddy nimmt höchstens 8 MB pro Anfrage an.
- **Eigener `ENCRYPTION_KEY`** für gespeicherte Geheimnisse (Einmal-Code, WHOOP, Push). Beim Start schlüsselt Life einmal um. Ein Wechsel von `SESSION_SECRET` beendet damit nur Sitzungen und macht nichts mehr unlesbar. Ohne `ENCRYPTION_KEY` läuft alles weiter wie bisher.

### Tests
- Zu jedem Befund ein Test, der auf 0.15.3 rot war: Einrichtungscode nach der Einrichtung, kopiertes Cookie nach dem Abmelden, Anfragen ohne oder mit fremder Herkunft, CSP mit Nonce. Neu: `tests/unit/riegel.test.ts` (jede Route hat den zweiten Riegel), Tests für Umschlüsseln, JPEG und Fehlertexte.

## [0.15.3] – 2026-10-26

### Dokumentation
- Plan für das Fundament in `docs/VERBESSERUNG.md`: fünf Phasen (Sicherheit, Betrieb, Datenschutz, UX und UI, Technik), Noten der Prüfung vom 26.10.2026 und Ziele.
- `docs/UEBERGABE.md` auf Stand 0.15.3 gebracht und auf den Plan verwiesen. Der Weg nach `main` läuft jetzt über einen einzigen Pull Request vom neuesten Zweig.

## [0.15.2] – 2026-10-26

### Sicherheit
- **Kritische Lücke geschlossen:** Das Cookie aus der offenen Passkey-Anmeldung (`/api/auth/login-options`) war mit demselben Schlüssel signiert wie die Sitzung und wurde als Sitzung angenommen. Wer es zurückschickte, kam ohne Passkey an alle Daten. Sitzung und Challenge haben jetzt eigene, abgeleitete Schlüssel, einen Typ und eine Zielgruppe, die geprüft werden. Alle bisherigen Sitzungen sind damit ungültig, jedes Gerät meldet sich einmal neu an.

## [0.15.1] – 2026-10-26

### Behoben
- „Kalender suchen“ fand bei iCloud keinen Kalender. iCloud schreibt die Kalenderart als `name='VEVENT'` in einfachen Anführungszeichen, Life erwartete doppelte. Die Testattrappe antwortet jetzt genauso wie iCloud.

## [0.15.0] – 2026-10-26

### Hinzugefügt
- **Standortbestimmung** in drei Etappen zu je etwa zwölf Minuten: „Wo du stehst“ (pro Bereich eine Zahl von 1 bis 10 und der Grund dahinter), „Wohin“ (Werte, ein Jahr von heute, die nächsten zwölf Wochen, was liegen bleibt) und „Was dich bremst“ (der Coach leitet mit dir den Engpass her). Eine Frage pro Seite, du erzählst frei, gern per Diktat. Danach fasst der Coach zusammen und macht Vorschläge. In deinen Stand kommt nur, was du übernimmst oder in eigenen Worten umformulierst.
- **Dein Stand** unter Mehr: Baseline als fünf Ringe, Fokus, Engpass mit Herleitung, Werte, Jahresbild, Ziele für zwölf Wochen, Wochenziel und das Wichtigste für heute. Coach und Sortierlauf kennen den Stand bei jedem Aufruf.
- **Kalender aus iCloud**, nur lesend: privat und Familie. Auf Heute stehen Termine, freie Zeit und ein Vorschlag, wann das Wichtigste passt. In den Einstellungen schaltest du einzelne Kalender an und aus und legst fest, was Familie ist. Familienzeit gilt als geschützt: Der Coach plant nichts hinein und sieht dort nur „Familie“.
- Wochenstart mit **Wochenziel** und Feld für eigene Dinge der Woche.

### Behoben
- „Drei Dinge der Woche“ war leer, wenn noch nichts einsortiert war. Jetzt stehen auch neue Einträge zur Wahl, und eigene Dinge gehen direkt.

### Sicherheit
- Life spricht nur mit iCloud-Hosts (`caldav.icloud.com`), verfolgt Weiterleitungen einzeln und prüft jedes Ziel. Antworten sind begrenzt und landen nie im Log. Neue Abhängigkeit `ical.js` 2.2.1 (Mozilla-Umfeld, ohne Abhängigkeiten und ohne Installationsskripte) für Wiederholungen und Zeitzonen.

## [0.14.0] – 2026-10-26

### Hinzugefügt
- **Mit dem Coach sprechen:** auf Heute ein Feld und Vorschläge zum Antippen („Was jetzt?“, „Ich bin müde“, „Ich habe nur 30 Minuten“, „Ich schiebe etwas vor mir her“). Der Coach kennt den Tag, das Gespräch gilt für heute. Namen gehen wie immer nur als Platzhalter an Claude.
- **Der Coach meldet sich selbst:** In der Coach-Karte steht, was heute noch offen ist (verpasste Uhrzeit, Morgenfragen, Training, Abendfragen, Wochenstart). Dazu Mitteilungen, wenn eine geplante Uhrzeit 30 Minuten vorbei ist, um 15 Uhr, wenn aus „Jetzt dran“ noch nichts erledigt ist, und montags um 8:30 für den Wochenstart. Alle drei lassen sich in den Einstellungen abschalten.
- **Empfohlen für dich:** ein neuer Baustein auf Heute mit genau einer Sache, die jetzt passt, zum Beispiel NSDR nach kurzer Nacht, Atem am Nachmittag, Stille, Runterfahren am Abend oder die Krafteinheit am Trainingstag. Life entscheidet nach festen Regeln, der Coach greift sie in seinem Text auf, ein Tipp öffnet die passende Übung.
- **Wochenstart** als eigene Seite in vier Schritten: Rückblick auf die letzte Woche, Engpass prüfen oder neu setzen, drei Dinge der Woche wählen, Parkplatz sichten. Die drei Dinge stehen danach auf „Woche“, Claude zieht sie beim Sortieren nach vorn.

### Geändert
- **Fragebögen zum Blättern:** eine Frage pro Seite, die Fläche bleibt stehen. Nach einer Antwort auf der Skala geht es von selbst weiter, „Fertig“ sitzt oben.
- **Geld im Stil von Körper:** Töpfe der Woche als Kacheln mit Farbpunkt, großer Zahl und Balken. Buchungen als Zeilen mit Betrag rechts. Monatlich mit drei Kacheln (Einnahmen, feste Kosten, bleibt) und einer Liste pro Art, Sparziele und Taschengeld als Kacheln.

## [0.13.1] – 2026-10-26

### Behoben
- Einordnen schlug bei langen, diktierten Einträgen mit „Antwort ohne JSON“ fehl. Claude antwortet jetzt über ein erzwungenes Werkzeug und liefert damit immer ein JSON-Objekt. Wird eine Antwort abgeschnitten, fragt Life einmal mit doppeltem Platz nach. Fürs Einordnen gibt es mehr Platz (1500 statt 900 Tokens).
- Fehlermeldungen sagen jetzt, ob die Antwort abgeschnitten war oder Claude abgelehnt hat. Ins Server-Log kommen dabei nur Kennzahlen, nie Inhalte.

## [0.13.0] – 2026-10-25

### Hinzugefügt
- **Schnellzugriffe** als Baustein auf Heute: zuerst ein Plus mit allen sechs Wegen (Gedanke, Essen, Ausgabe, Ruhe starten, Training, Kontakt), dahinter Essen, Ausgabe, Ruhe und Training direkt. Ausgabe springt gleich ins Betragsfeld.
- **iPad und Mac:** ab 1100 px eine feste Seitenleiste mit allen Bereichen und farbigen Symbolen, oben rechts Suchen und Festhalten. Hochkant auf dem iPad eine schwebende Leiste oben, ☰ klappt die Seitenleiste auf.
- Heute in zwei Spalten: links alles zum Tun, rechts Coach, Kompass und die kurzen Bausteine.
- Logbuch und Woche mit Inspektor ab 1100 px: ein Klick öffnet den Eintrag rechts, ohne die Seite zu wechseln.
- Tastatur: N hält fest, ⌘K oder / öffnet die Suche im Logbuch, Esc schließt.

### Geändert
- **Körper als Übersicht:** oben die Erholung, darunter vier Karten mit je einer Zahl und einer Handlung (Training, Essen, Ruhe, Ausdauer). Details liegen eine Ebene tiefer: Letzte Nacht, Training, Essen.
- **Geld** im gleichen Muster: Ausgabe festhalten und Töpfe der Woche oben, Stufenplan, Monatlich, Sparziele und Taschengeld als Karten mit eigener Seite, „Alle Buchungen“ unter Zuletzt.
- **Woche** im gleichen Muster: Karten für Ziele, Energie, Zeit kaufen und Parkplatz, darunter die Stapel.

## [0.12.0] – 2026-10-25

### Hinzugefügt
- **Darstellung** in den Einstellungen: Dunkel (Standard), Hell oder wie das iPhone. Wirkt sofort und gilt pro Gerät. Der Server liefert die Seite gleich im richtigen Modus aus, ohne Aufblitzen.
- **Coach** als Karte mit Verlauf in Imperial Blue. Warnsignale stehen oben als eigene Felder, die Geste darunter.
- **Heute anpassen** unter Einstellungen: Bausteine an- und ausschalten und verschieben (Wochenstand, Kompass, Coach, Festhalten-Feld, Körper kurz, Geld kurz, Menschen, Als Nächstes, Heute erledigt). „Jetzt dran“ und der Fragebogen bleiben immer an. Gespeichert pro Mensch.
- Ohne Festhalten-Feld sitzt auf Heute oben rechts ein Plus, das das Feld öffnet.
- **Wochenstand** als sieben Tagespunkte: voll, halb oder leer nach Morgenfragen, Abendfragen und drei erledigten Aufgaben. Keine Serie, die reißen kann. Dazu im Kompass fünf Ringe mit Namen und der Weg mit Fahne bis zum nächsten Level.
- **Körper:** WHOOP-Werte als große Zahlen in Kacheln. Erholung als Verlauf von Rot nach Grün mit Punkt und kurzem Hinweis.
- **Ruhe:** jede Vorlage als eigene Verlaufskarte mit Dauer-Pillen und Play-Knopf.

### Geändert
- **Neue Schrift Fraunces** für Titel, Coach und große Zahlen (freie Lizenz, liegt im Projekt). Die optische Größe passt sich an. Instrument Serif fällt weg.
- Mehr zeigt Kompass, Menschen, Logbuch und Einstellungen mit farbigen Symbolen wie in den iPhone-Einstellungen. Menschen bekommen Initialen in der Farbe ihres Kreises, die Energie-Bilanz ein Band.
- Jeder Bereich trägt seine Kontenfarbe: Punkt hinter dem Titel, aktiver Reiter unten, Balken mit Verlauf. Kräftigere Kontenfarben in beiden Modi.
- Alle Farben laufen über Tokens. Keine festen Farbwerte mehr in den Komponenten.
- Der Kompass zeigt das Life-Level als Weg statt als einfachen Balken.

## [0.11.0] – 2026-10-25

### Hinzugefügt
- **Menschen** unter Mehr: Kreise Familie, Freunde, Team, Netzwerk und Kunden. Letzter Kontakt, Takt pro Person, Erinnerung, wenn es länger her ist, Geburtstage.
- Kontakt mit einem Tipp: Treffen, Abend, Telefonat, Nachricht. Stunden mit Freunden zählen bis zur nächsten Freundschaftsstufe (50, 90, 200 Stunden nach Hall 2018).
- Steht ein bekannter Name in einem Eintrag, zählt Life das als Kontakt, ohne Claude. Neue Namen aus Einträgen schlägt Life zum Zuordnen vor.
- Der Coach kennt fällige Kontakte und nahe Geburtstage und schlägt die tägliche Geste bevorzugt dafür vor.
- **Wenn-dann-Plan** zu jeder Aufgabe in „Jetzt dran“: Tageszeit und Ort antippen.
- **Energie-Bilanz:** nach dem Abhaken „gab Kraft“, „neutral“ oder „kostete Kraft“. Die Woche zeigt die Bilanz.
- **Parkplatz** für Ideen ohne Bezug zum Engpass (vorher „Geparkt“).
- **Zeit kaufen:** Liste, was du abgeben könntest, mit Stunden im Monat und Preis pro gewonnener Stunde. Montags bringt der Coach eine Idee daraus in die Wochenrunde.
- Kompass: Sozial zählt Zeit mit Menschen und Kontakte, Zeit zählt Aufgaben nach Wenn-dann-Plan.

### Sicherheit
- Alle Namen aus „Menschen“ gehören ab jetzt zu den geschützten Namen und gehen nur als Platzhalter an Claude.

## [0.10.0] – 2026-10-25

### Hinzugefügt
- **Kompass** als Dashboard: fünf Ringe für Zeit, Sozial, Mental, Körper und Geld, gefüllt aus echten Daten der Woche (Aufgaben mit Hebel, Pläne, Ruhe, Abendfragen, Training, Schlaf, Protein, Töpfe im Rahmen).
- Verlauf über acht Wochen pro Konto, WHO-5-Kurve, dein eigenes Gefühl aus dem Wochenbogen daneben.
- **Level** pro Konto und ein Life-Level: ein voller Ring bringt 100 Punkte pro Woche, die Stufen werden langsam größer.
- **Meilensteine**, die bleiben: erste Krafteinheit, 100 Minuten Ruhe, Woche im Rahmen, Perfekte Woche und mehr. Neue kommen als Mitteilung.
- Auf „Heute“ eine Leiste mit den fünf Ringen, ein Tipp öffnet den Kompass.

### Bewusst nicht
- Keine Tagesserien, die reißen. Punkte gibt es pro Woche.

## [0.9.0] – 2026-10-25

### Hinzugefügt
- **Geld** als eigener Bereich für den Haushalt: wenige Wochentöpfe, Ausgaben per Satz („12,50 Bäcker“) oder Foto vom Kassenbon, Claude ordnet dem passenden Topf zu.
- Ab Freitag zeigt Life den Rest als Spanne, übrig Gebliebenes wandert eine Woche weiter. Grund: Genaue Restbeträge gegen Ende verleiten laut Studie zum Ausgeben.
- Stufenplan in sieben Stufen nach Dave Ramsey und Verbraucherzentrale, mit Peters Ziel von einem Jahr Puffer. Einnahmen, feste Kosten, Konsumschulden, Rücklage und Sparrate monatlich.
- Sparziele und Taschengeld für die Kinder, jeden Montag kommt der Wochenbetrag dazu.
- Warnsignal und Mitteilung, wenn ein Topf über dem Rahmen ist. Der Coach bekommt nur Zählungen, keine Beträge.
- **Fehler oder Verbesserung melden** in den Einstellungen, für alle, die Life nutzen. Jede Meldung landet im Backlog, mit GitHub-Schlüssel automatisch als Aufgabe im Repo.
- Neue Leiste unten: Heute, Woche, Körper, Geld, Mehr (Logbuch und Einstellungen).

### Sicherheit
- Bon-Fotos werden im Browser neu gespeichert (ohne Ortsdaten) und nicht aufbewahrt. Claude liest nur Laden und Summe.
- Namen der Kinder bleiben auf dem Server. GitHub-Aufgaben bekommen Platzhalter statt Namen.

## [0.8.0] – 2026-10-25

### Hinzugefügt
- **Ruhe** unter Körper: Stille (5, 10, 20 Minuten), geführte Atem-Meditation, NSDR (10 und 20 Minuten), Wim-Hof-Atmung in drei Runden mit Stoppuhr fürs Halten, Runterfahren am Abend mit zyklischem Seufzen und direktem Weg zu den Abendfragen.
- Gongs entstehen im Browser, gesprochen wird mit der Stimme des iPhones. Keine Audiodateien von außen.
- Minuten und Tage pro Woche auf „Körper“, im Coach und in der Ruhe-Übersicht.

### Sicherheit
- Wim-Hof-Atmung startet erst nach drei bestätigten Regeln: sitzen oder liegen, nicht im oder am Wasser, nicht beim Fahren.

## [0.7.0] – 2026-10-25

### Hinzugefügt
- **Körper** als eigener Bereich: letzte Nacht mit Schlaf, Erholung, HRV und Ruhepuls aus WHOOP, Trainingswoche, Essen.
- **WHOOP** über die offizielle Schnittstelle. Life gleicht morgens stündlich, sonst alle zwei Stunden ab. Die Zugangsschlüssel liegen verschlüsselt in der Datenbank.
- **Training wie RP, für zu Hause:** Ganzkörper mit Kettlebell, TRX, Bändern und Körpergewicht in Blöcken von 5 Wochen. Pump, Muskelkater und Gelenke nach jeder Einheit passen die Sätze an, bei Schmerz tauscht Life die Übung. Pausentimer, Bildschirm bleibt an. Einheiten pro Woche wählst du jede Woche neu.
- Zone 2 und Intervalle 4 × 4 zählt Life aus WHOOP oder per Tipp.
- **Essen:** Barcode scannen (Nährwerte von Open Food Facts), Foto vom Teller oder ein Satz. Claude schätzt Spannen, Fotos speichert Life nicht. Protein-Ziel 1,6 g pro kg.
- **Mitteilungen** aufs iPhone: Morgen-Check-in und Coach, Abendfragen, Warnsignale (höchstens eins am Tag), Training an Trainingstagen. Uhrzeiten einstellbar.
- Neue Warnsignale: drei Nächte unter 6,5 Stunden, zwei geplante Krafteinheiten in Folge ausgefallen.

### Sicherheit
- Körperwerte gehen an Claude nur als Durchschnitt und Zählung, ohne Datum und Uhrzeit. Auch Antworten aus den Fragebögen tragen nur „gestern“ oder „vor 3 Tagen“.
- Fotos werden im Browser verkleinert und neu gespeichert, damit Ortsdaten wegfallen.
- Mitteilungen gehen Ende-zu-Ende verschlüsselt raus. Life nimmt nur Push-Adressen von Apple, Google, Mozilla und Microsoft an.
- Kamera ist nur für Life selbst freigegeben (Permissions-Policy).

## [0.6.0] – 2026-10-25

### Hinzugefügt
- **Coach:** morgens ein Satz zum Tag mit einer kleinen Geste für einen Menschen, abends ein Rückblick. Warnsignale rechnet Life selbst, zum Start: eine Engpass-Aufgabe liegt seit drei Tagen.
- **Fragebögen zum Antippen:** morgens eine Frage zur Erholung, abends Tag, Kraftfresser, Wenn-dann-Plan für morgen und drei gute Dinge, wöchentlich WHO-5 und eine Frage pro Konto. Zu jeder Frage geht ein eigener Satz.
- Der Plan vom Abend landet am nächsten Morgen ganz oben in „Jetzt dran“.
- Einstellungen: „Was Claude nie sieht“ mit eigener Namensliste und den Namen, die Claude erkannt hat.
- Datenmodell für mehrere Menschen in einem Haushalt. Sichtbar ist weiter nur Peter.

### Geändert
- Claude läuft über die Anthropic-API statt über Amazon Bedrock. Das AWS-Paket ist raus, die App ist deutlich kleiner.

### Sicherheit
- Pseudonymisierung vor jedem Claude-Aufruf: Peter, das Team und bekannte Namen von Personen, Firmen und Orten werden zu [Person 1] und so weiter, ebenso E-Mail-Adressen, Telefonnummern und IBANs. Claudes Antwort bekommt die Namen zurück. Neue Namen sieht Claude einmal und meldet sie zurück, danach sind sie geschützt.

## [0.5.0] – 2026-10-25

### Hinzugefügt
- Anmeldung mit **Passwort und Code** als zweiter Weg neben dem Passkey, für Geräte, auf denen kein Passkey geht. Der Schlüssel für die Codes erscheint als Text zum Kopieren, ein QR-Code ist nicht nötig. Codes nach RFC 6238, kompatibel mit 1Password und Apple Passwörter.
- Einstellungen zeigen unter „Anmeldung“, welche Wege aktiv sind. Passwort und Code lassen sich dort ausschalten.

### Sicherheit
- Passwörter mit scrypt gespeichert, mindestens 16 Zeichen. Der Schlüssel für die Codes liegt verschlüsselt (AES-256-GCM) in der Datenbank.
- Jeder Code gilt nur einmal. Falsches Passwort und falscher Code ergeben dieselbe Meldung und dieselbe Antwortzeit.
- Höchstens 10 Anmeldeversuche pro 15 Minuten je Adresse und 30 pro Stunde insgesamt.
- Aktiv wird die Anmeldung erst, wenn der erste Code stimmt.

## [0.4.0] – 2026-10-25

### Geändert
- Die App heißt jetzt **Life**, das Repo **life-app**. Adresse künftig life.gneuss.xyz.

### Sicherheit
- Link-Abruf folgt Weiterleitungen nur noch mit erneuter Prüfung und prüft die IP beim Verbindungsaufbau. Vorher hätte eine präparierte Seite den Server auf interne Adressen lenken können.
- Begrenzung der Anfragen für Einrichtung (10 pro 15 Minuten), Anmeldung (30 pro 15 Minuten), Kurzbefehl (60 pro Minute) und Schreiben (120 pro Minute).
- Die Domain für Passkeys kommt fest aus `PUBLIC_ORIGIN` statt aus dem Host-Header.
- Abhängigkeiten dürfen bei der Installation keine Skripte ausführen.

### Hinzugefügt
- `/api/health` meldet, ob App und Datenbank laufen.
- Tests im Repo: Ende-zu-Ende auf iPhone-Breite und Einheitstests für die Schutzfunktionen.
- GitHub Actions prüft jede Änderung auf Ubuntu 24.04 (fest eingestellt, damit ein neues Runner-Image die Prüfung nicht unbemerkt verändert). Ein Versions-Tag baut das fertige Paket für den Server.
- `deploy.sh` spielt eine bestimmte Version auf und wartet, bis sie antwortet. Zurückrollen heißt, eine ältere Version anzugeben.
- `CLAUDE.md` mit den festen Regeln für die Arbeit am Projekt.
- Life gehört der Griffin & Kale GmbH: Lizenzhinweis, Regeln für private Einträge.

## [0.3.1] – 2026-10-25

### Geändert
- Server-Einrichtung legt 2 GB Auslagerungsspeicher an, damit kleine Server reichen.

## [0.3.0] – 2026-10-25

### Hinzugefügt
- **Heute** mit „Jetzt dran“: höchstens drei Aufgaben, abhaken, Uhrzeit setzen, „Nicht heute“, Rückgängig.
- **Woche** mit Zielen und Stapeln: Jetzt, Diese Woche, Delegieren, Geparkt, Streichen vorgeschlagen.
- Claude ergänzt je Aufgabe Ziel, Hebel auf den Engpass, Aufwand, Frist und Zuständigkeit.
- Täglicher Sortierlauf, Zusammenführen doppelter Einträge, Lernen aus deinen Korrekturen.
- Einstellungen für Ziele und Team.

## [0.2.0] – 2026-10-25

### Geändert
- Gestaltung nach Apples Regeln: Logbuch nach Tagen, gruppierte Listen, Zurück-Navigation, durchscheinende Leisten, Schrift folgt der iPhone-Textgröße, Rücksicht auf Bewegung, Transparenz und Kontrast.

## [0.1.0] – 2026-10-25

### Hinzugefügt
- Erfassen per Text, Mikrofon und Kurzbefehl, Einordnung durch Claude, Archiv mit Suche, Export als Textdatei, Anmeldung per Passkey, Betrieb auf Hetzner.
