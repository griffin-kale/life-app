# Änderungen

Alle Versionen von Life, neueste oben. Nummern nach [Semantic Versioning](https://semver.org/lang/de/): erste Zahl bei Umbrüchen, zweite bei neuen Funktionen, dritte bei Reparaturen.

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
