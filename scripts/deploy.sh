#!/usr/bin/env bash
# Redeploy the VPS from this machine (see README → Deployment → Redeploy).
# The VPS pulls origin/main, so push your commits first.
#
#   bash scripts/deploy.sh        (or: npm run deploy)
#
# Override the defaults with VPS_HOST, VPS_USER, VPS_KEY, VPS_APP_DIR.
set -euo pipefail

VPS_HOST="${VPS_HOST:-179.198.218.121}"
VPS_USER="${VPS_USER:-root}"
VPS_KEY="${VPS_KEY:-$HOME/.ssh/wits_vps}"
VPS_APP_DIR="${VPS_APP_DIR:-/var/www/wits-csd}"

# Warn if local main has commits the VPS won't see.
git fetch -q origin main
ahead=$(git rev-list --count origin/main..main)
if [ "$ahead" -gt 0 ]; then
  echo "Local main is $ahead commit(s) ahead of origin/main — run 'git push' first." >&2
  exit 1
fi
echo "Deploying $(git rev-parse --short origin/main) to $VPS_USER@$VPS_HOST..."

ssh -i "$VPS_KEY" -o BatchMode=yes "$VPS_USER@$VPS_HOST" bash -s -- "$VPS_APP_DIR" <<'REMOTE'
set -e
cd "$1"
git fetch origin main
git reset --hard origin/main
docker compose up -d --build
docker image prune -f

# Wait for the web container to report healthy.
for i in $(seq 1 30); do
  if curl -fs http://127.0.0.1:3000/api/health > /dev/null; then
    echo "Deploy OK ($(git rev-parse --short HEAD))"
    exit 0
  fi
  sleep 5
done
echo "Health check failed" >&2
docker compose logs --tail=100 web
exit 1
REMOTE
