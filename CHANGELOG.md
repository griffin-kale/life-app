# Änderungen

Alle Versionen von Life, neueste oben. Nummern nach [Semantic Versioning](https://semver.org/lang/de/): erste Zahl bei Umbrüchen, zweite bei neuen Funktionen, dritte bei Reparaturen.

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
