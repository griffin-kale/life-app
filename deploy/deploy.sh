#!/usr/bin/env bash
# Update vom Mac aus.
#   bash deploy/deploy.sh <server> v0.17.0   fertiges Paket dieser Version von GitHub holen (Standard), 2× Touch ID
#   bash deploy/deploy.sh <server> v0.16.1   genauso zurück auf eine ältere Version
#   bash deploy/deploy.sh <server> --build   Notweg: Code hochladen und auf dem Server bauen, 3× Touch ID
# Die eigentliche Arbeit macht deploy/aufspielen.sh auf dem Server in einer einzigen Verbindung:
# Sicherung vorher, Update, Warten auf /api/health.
set -euo pipefail
HOST="${1:?Server fehlt}"
MODE="${2:?Version wie v0.17.0 oder --build angeben}"
cd "$(dirname "$0")/.."
SSH="ssh -o StrictHostKeyChecking=accept-new root@$HOST"

rsync -az deploy/docker-compose.yml deploy/Caddyfile deploy/aufspielen.sh deploy/backup.sh deploy/restore-test.sh "root@$HOST:/opt/life/deploy/"

if [ "$MODE" = "--build" ]; then
  rsync -az --delete --exclude node_modules --exclude .next --exclude .git --exclude test-results --exclude playwright-report \
    --exclude 'deploy/.env' --exclude 'deploy/backups' ./ "root@$HOST:/opt/life/"
fi
$SSH "bash /opt/life/deploy/aufspielen.sh '$MODE'"
