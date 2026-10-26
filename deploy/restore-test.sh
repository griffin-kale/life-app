#!/usr/bin/env bash
# Einmal im Monat (cron, am 1. um 4:30 Uhr): die neueste Sicherung in eine Wegwerf-Datenbank ohne Netz einspielen.
# Ergebnis steht in backups/status-restore („ok …“ oder „fehler …“), /api/health meldet einen Fehler bei „fehler“.
# Von Hand: bash /opt/life/deploy/restore-test.sh
set -euo pipefail
cd "${LIFE_DIR:-/opt/life/deploy}"
umask 077
NAME="life-restore-test-$$"
melde_fehler() { echo "fehler $(date -Is)" > backups/status-restore; chmod 644 backups/status-restore; echo "$(date -Is) Wiederherstellung fehlgeschlagen" >&2; }
trap 'melde_fehler' ERR
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

NEUESTES="$(ls -1t backups/life-*.sql.gz | head -n 1)"
[ -n "$NEUESTES" ]
docker run -d --name "$NAME" --network none -e POSTGRES_USER=life -e POSTGRES_DB=life \
  -e POSTGRES_PASSWORD="wegwerf-$$" postgres:16-alpine >/dev/null
# Erst bereit, wenn der endgültige Server auf TCP hört (die Einrichtung läuft vorher nur über den Socket)
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -h 127.0.0.1 -U life -q && break; sleep 2; done
docker exec "$NAME" pg_isready -h 127.0.0.1 -U life -q

gunzip -c "$NEUESTES" | docker exec -i "$NAME" psql -U life -d life -v ON_ERROR_STOP=1 -q >/dev/null
TABELLEN="$(docker exec "$NAME" psql -U life -d life -tAc "select count(*) from information_schema.tables where table_schema = 'public'")"
EINTRAEGE="$(docker exec "$NAME" psql -U life -d life -tAc 'select count(*) from items')"
[ "$TABELLEN" -ge 5 ]
echo "ok $(date -Is)" > backups/status-restore
chmod 644 backups/status-restore
echo "$(date -Is) ok $NEUESTES: $TABELLEN Tabellen, $EINTRAEGE Einträge"
