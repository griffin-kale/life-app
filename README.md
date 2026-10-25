# Lage

Peters Logbuch: Gedanken, Zitate, Videos, Bücher und Artikel festhalten. Claude ordnet jeden Eintrag ein, räumt diktierten Text auf und hält bei Wissen die Kernidee und eine Frage an dich fest.

Läuft komplett in Deutschland auf einem eigenen Hetzner-Server. Claude kommt über Amazon Bedrock mit EU-Profil, aufgerufen in Frankfurt; die Verarbeitung bleibt in EU-Rechenzentren.

## Was drin ist (Version 0.3)

- **Erfassen:** Textfeld mit Mikrofon (wo der Browser es kann) oder Tastatur-Diktat. Auf dem iPhone zusätzlich per Kurzbefehl über Aktionstaste und Teilen-Menü (`POST /api/capture`).
- **Heute:** oben der Engpass, darunter „Jetzt dran“ mit höchstens drei Aufgaben. Jede lässt sich abhaken, auf eine Uhrzeit legen oder mit „Nicht heute“ in die Woche schieben. Beides lässt sich rückgängig machen.
- **Priorisieren:** Claude gibt jeder Aufgabe Ziel, Hebel auf den Engpass (0 bis 3), Aufwand, Frist und Zuständigkeit. Beim ersten Öffnen am Tag sortiert Claude alle offenen Aufgaben gemeinsam in Jetzt, Diese Woche, Delegieren, Geparkt und Streichen vorgeschlagen, mit einer Zeile Begründung. Doppelte Einträge führt Claude zusammen. Neue Aufgaben ordnet Claude gleich ein, ohne die Jetzt-Liste umzuwerfen.
- **Lernen:** Jede Verschiebung von dir landet als Korrektur in der Datenbank. Die letzten 20 gehen beim nächsten Sortieren mit. Was du binnen zwei Minuten rückgängig machst, zählt nicht.
- **Woche:** Ziele mit offenen und erledigten Aufgaben, alle Stapel, Verschieben per Auswahlrad, Streichvorschläge annehmen oder behalten.
- **Einordnen:** Typ (Gedanke, Zitat, Video, Buch, Artikel), Kategorie (Engpass, Entscheidung, Aufgabe, Projekt, Privat, Notiz, Idee, Wissen), Art von Wohlstand nach Sahil Bloom, nächster Schritt. Ideen werden 72 Stunden geparkt.
- **Links:** YouTube-Titel über oEmbed, bei anderen Seiten Titel und Textauszug. Nur öffentliche Adressen werden abgerufen.
- **Archiv:** Filter nach Typ, Suche, archivierte Einträge.
- **Export:** alles als eine Markdown-Datei (`/api/export`).
- **Anmeldung:** nur per Passkey (Face ID). Einrichten mit einmaligem Code unter `/setup`.
- **Gestaltung:** nach Apples Gestaltungsregeln fürs Web: Schrift folgt der iPhone-Textgröße, Feedback beim Drücken, durchscheinende Leisten mit Scroll-Kante, Zurück-Navigation, Meldungen kommen und gehen auf demselben Weg, Rücksicht auf „Bewegung reduzieren“, „Transparenz reduzieren“ und „Kontrast erhöhen“.

## Aufbau

| Teil | Technik |
|---|---|
| App | Next.js 15, TypeScript, keine externen Skripte oder Schriften (Instrument Serif liegt im Projekt) |
| Datenbank | PostgreSQL 16 im selben Server |
| HTTPS | Caddy, Zertifikat automatisch |
| Claude | `@anthropic-ai/bedrock-sdk`, Modelle `eu.anthropic.claude-haiku-5-5` und `eu.anthropic.claude-sonnet-5-5` |

## Inbetriebnahme

1. Hetzner Cloud: Server **CX22** (oder Nachfolger), Ubuntu 24.04, Standort Nürnberg oder Falkenstein, SSH-Schlüssel vom Mac hinterlegen, Sicherungen einschalten.
2. Bei Hetzner DNS: A-Eintrag `lage.deinedomain.de` auf die Server-IP.
3. Auf den Server kopieren und einrichten:
   ```sh
   scp deploy/setup-server.sh root@SERVER-IP:/root/
   ssh root@SERVER-IP 'bash /root/setup-server.sh lage.deinedomain.de'
   ```
4. AWS: IAM-Benutzer nur mit `bedrock:InvokeModel` für die EU-Profile anlegen, Schlüssel in `/opt/lage/deploy/.env` auf dem Server eintragen (`ssh root@SERVER-IP`, dann `nano /opt/lage/deploy/.env`).
5. Vom Mac aus: `bash deploy/deploy.sh SERVER-IP`
6. Auf dem iPhone `https://lage.deinedomain.de/setup` öffnen, den `SETUP_TOKEN` aus der `.env` eingeben, Passkey anlegen. In Safari: Teilen → „Zum Home-Bildschirm“.
7. Kurzbefehl einrichten (Anleitung in der App unter Einstellungen), dort den `CAPTURE_TOKEN` eintragen.

## Betrieb

- **Updates der App:** `bash deploy/deploy.sh SERVER-IP`
- **Sicherheitsupdates des Systems:** laufen automatisch (unattended-upgrades).
- **Datensicherung:** täglich 3:15 Uhr nach `/opt/lage/deploy/backups`, 30 Tage. Zusätzlich die Hetzner-Sicherungen des ganzen Servers.
- **Neues Gerät:** `/setup` mit dem `SETUP_TOKEN` öffnen und einen weiteren Passkey anlegen.

## Lokal entwickeln

```sh
cp .env.example .env.local   # Werte eintragen, DATABASE_URL auf eine lokale Postgres zeigen lassen
npm install && npm run dev
```
