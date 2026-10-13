#!/usr/bin/env bash
set -euo pipefail

HOST="${VPS_HOST:-162.35.127.54}"
USER="${VPS_USER:?Set VPS_USER (SSH username)}"
REMOTE_DIR="${VPS_DIR:-/var/www/localapp}"
SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://162.35.127.54}"
PASSWORD="${VPS_PASSWORD:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NEXT_PUBLIC_SITE_URL="$SITE_URL"
npm ci --legacy-peer-deps
npm run build

SSH_OPTS="-o StrictHostKeyChecking=accept-new"
SSH=(ssh $SSH_OPTS)
RSYNC_E="ssh $SSH_OPTS"
if [[ -n "$PASSWORD" ]] && command -v sshpass >/dev/null 2>&1; then
  SSH=(sshpass -p "$PASSWORD" ssh $SSH_OPTS -o PreferredAuthentications=password -o PubkeyAuthentication=no)
  RSYNC_E="sshpass -p $PASSWORD ssh $SSH_OPTS -o PreferredAuthentications=password -o PubkeyAuthentication=no"
fi

"${SSH[@]}" "${USER}@${HOST}" "mkdir -p '${REMOTE_DIR}'"
rsync -az --delete -e "$RSYNC_E" \
  --exclude node_modules --exclude .git --exclude functions/node_modules \
  "${ROOT}/" "${USER}@${HOST}:${REMOTE_DIR}/"
"${SSH[@]}" "${USER}@${HOST}" "cd '${REMOTE_DIR}' && npm ci --legacy-peer-deps && NEXT_PUBLIC_SITE_URL='${SITE_URL}' npm run build && (command -v pm2 >/dev/null && pm2 restart localapp --update-env || (pkill -f 'next start' || true; nohup npx next start -p 3000 >/var/log/localapp.log 2>&1 &))"

echo "Deployed ${SITE_URL}"
