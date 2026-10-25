#!/usr/bin/env bash
# Vom Mac aus: bash deploy/deploy.sh <server-ip>
set -euo pipefail
HOST="${1:?Server-IP fehlt}"
cd "$(dirname "$0")/.."
rsync -az --delete --exclude node_modules --exclude .next --exclude 'deploy/.env' --exclude 'deploy/backups' ./ "root@$HOST:/opt/lage/"
ssh "root@$HOST" 'cd /opt/lage/deploy && docker compose up -d --build && docker image prune -f >/dev/null'
echo "Läuft. Erste Anmeldung: https://<deine-domain>/setup"
