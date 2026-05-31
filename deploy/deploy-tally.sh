#!/usr/bin/env bash
# deploy/deploy-tally.sh
#
# Push local changes to GitHub, pull on server, rebuild, reload.
# Run this every time you update Tally AI code.
#
# Usage (from Tally Automation repo root):
#   bash deploy/deploy-tally.sh
#
# Requires setup-tally-server.sh to have been run once first.

set -euo pipefail

PEM_KEY=$(find ~ -maxdepth 3 -name "*.pem" 2>/dev/null | head -1)
if [ -z "$PEM_KEY" ]; then
  echo "❌ .pem key not found."
  exit 1
fi

SERVER="ubuntu@3.108.108.227"
TALLY_DIR="/home/ubuntu/tally-ai"
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

SSH="ssh -i $PEM_KEY -o StrictHostKeyChecking=no $SERVER"

echo "╔══════════════════════════════════════════════════╗"
echo "║  Tally AI — Deploy  commit: ${GIT_HASH}         ║"
echo "╚══════════════════════════════════════════════════╝"

# ── Push to GitHub ─────────────────────────────────────────────────────────
echo "→ [1/4] Pushing to GitHub..."
if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A
  git commit -m "deploy: $GIT_HASH" || true
fi
git push origin main
echo "  ✓ GitHub up to date"

# ── Pull on server ─────────────────────────────────────────────────────────
echo ""
echo "→ [2/4] Pulling on server..."
$SSH "cd ${TALLY_DIR} && git pull --ff-only origin main"
echo "  ✓ Server updated: $($SSH "cd ${TALLY_DIR} && git log --oneline -1")"

# ── Rebuild client if frontend files changed ──────────────────────────────
echo ""
echo "→ [3/4] Rebuilding React client..."
$SSH "
  cd ${TALLY_DIR}/client
  npm install --silent
  VITE_BASE_PATH=/tally/ npm run build
  echo '  React build done'
"

# Also install any new server deps
$SSH "cd ${TALLY_DIR}/server && npm install --silent --production=false"
echo "  ✓ Build complete"

# ── Reload Tally AI (zero-downtime) ───────────────────────────────────────
echo ""
echo "→ [4/4] Reloading Tally AI..."
$SSH "pm2 reload tally-ai"
sleep 2
$SSH "pm2 show tally-ai | grep -E 'status|uptime|restarts'"
echo "  ✓ Reload complete"

echo ""
echo "✓ Deploy done — commit $GIT_HASH"
echo "  Tally AI: https://bot.mukundankandasamy.org/tally/"
