#!/usr/bin/env bash
# Nächtliche Sicherung der Datenbank auf dem Server (cron, 3:15 Uhr). Das Hetzner-Backup nimmt den Ordner mit.
# Ein Dump zählt nur, wenn er vollständig ist: Fehler in der Kette, kaputtes gzip, fehlendes Endzeichen oder zu klein
# brechen ab. Dann bleibt der alte Stand stehen, und /api/health meldet nach 26 Stunden einen Fehler.
set -euo pipefail
cd "${LIFE_DIR:-/opt/life/deploy}"
umask 077
mkdir -p backups
# Die App liest nur die Statusdateien (711: hinein ja, auflisten nein). Dumps bleiben 600.
chmod 711 backups
ZIEL="backups/life-$(date +%F).sql.gz"
TMP="$(mktemp backups/.life-XXXXXX.sql.gz)"
trap 'rm -f "$TMP"' EXIT

docker compose exec -T db pg_dump -U life life | gzip > "$TMP"
gunzip -t "$TMP"
[ "$(stat -c %s "$TMP")" -ge 1024 ] || { echo "$(date -Is) fehler: Dump zu klein" >&2; exit 1; }
gunzip -c "$TMP" | tail -n 5 | grep -q 'PostgreSQL database dump complete' || { echo "$(date -Is) fehler: Dump unvollständig" >&2; exit 1; }

mv "$TMP" "$ZIEL"
trap - EXIT
# 30 Tage aufbewahren (wie seit 0.4)
find backups -name 'life-*.sql.gz' -mtime +30 -delete
date -Is > backups/status-backup
chmod 644 backups/status-backup
echo "$(date -Is) ok $ZIEL $(stat -c %s "$ZIEL") Bytes"
