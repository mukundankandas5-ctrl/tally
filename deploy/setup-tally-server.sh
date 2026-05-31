#!/usr/bin/env bash
# deploy/setup-tally-server.sh
#
# ONE-TIME setup that adds Tally AI alongside the existing NIFTY FVG bot.
#
# What it does:
#   1. Installs Nginx and configures it as a reverse proxy on port 8080
#      (the port Cloudflare already points at — no DNS/Cloudflare changes needed)
#   2. Moves Flask bot from port 8080 → 8081 (internal only)
#   3. Clones the Tally AI repo to /home/ubuntu/tally-ai
#   4. Installs Node deps, builds the React client
#   5. Creates a Python venv with openpyxl for the reconcile script
#   6. Creates the .env template
#   7. Registers tally-ai in PM2 and saves the process list
#
# Prerequisites (already done by oracle_setup.sh):
#   - Ubuntu 22.04, Node 20, PM2, Python 3.11 installed
#   - Port 8080 open in iptables
#
# Usage (run from your Mac):
#   bash deploy/setup-tally-server.sh
#
# After this script:
#   → Edit /home/ubuntu/tally-ai/server/.env on the server and add your keys
#   → pm2 reload tally-ai (picks up the .env)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PEM_KEY=$(find ~ -maxdepth 3 -name "*.pem" 2>/dev/null | head -1)
if [ -z "$PEM_KEY" ]; then
  echo "❌ .pem key not found. Place it at ~/nifty-bot-key.pem"
  exit 1
fi

SERVER="ubuntu@3.108.108.227"
TALLY_REPO="https://github.com/mukundankandas5-ctrl/tally.git"
TALLY_DIR="/home/ubuntu/tally-ai"
BOT_DIR="/home/ubuntu/zerodha-bot"
DOMAIN="bot.mukundankandasamy.org"

SSH="ssh -i $PEM_KEY -o StrictHostKeyChecking=no $SERVER"

echo "╔══════════════════════════════════════════════════╗"
echo "║  Tally AI — One-time server setup                ║"
echo "║  Server : $SERVER   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Install Nginx ─────────────────────────────────────────────────────
echo "→ [1/7] Installing Nginx..."
$SSH "sudo apt-get install -y nginx && sudo systemctl stop nginx || true"
echo "  ✓ Nginx installed"

# ── Step 2: Write Nginx config ────────────────────────────────────────────────
echo ""
echo "→ [2/7] Writing Nginx config (port 8080, routes /tally → Tally AI, / → Bot)..."
$SSH "sudo tee /etc/nginx/sites-available/${DOMAIN} > /dev/null" << NGINX
server {
    listen 8080;
    server_name ${DOMAIN};

    # ── Tally AI: static React app ──────────────────────────────────────────
    # Nginx strips the /tally/ prefix before forwarding to Express.
    # The React build uses base='/tally/' so all asset URLs start with /tally/.
    location ^~ /tally/ {
        proxy_pass         http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    # ── Tally AI: API routes (unique prefixes — no overlap with bot routes) ──
    # Bot uses: /api/status /api/trades /api/equity-curve /api/claude-log etc.
    # Tally uses: /api/auth /api/gst /api/reconcile /api/invoices etc.
    location ~ ^/api/(auth|reference|invoices|bank-statements|recommendations|gst|tally|activity|history|compliance|ml-classify|reconcile|transactions|tally-status|pair-device|test-connection|complete-pairing|push-to-tally|sync-ledgers|connector-download|health) {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        client_max_body_size 25m;
    }

    # ── NIFTY Bot: everything else (dashboard + /api/status, /api/trades etc.) ─
    location / {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
NGINX

$SSH "
  sudo ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
"
echo "  ✓ Nginx config written and validated"

# ── Step 3: Move Flask bot from 8080 → 8081 ──────────────────────────────────
echo ""
echo "→ [3/7] Moving bot from port 8080 → 8081..."
$SSH "
  BOT_ENV='${BOT_DIR}/nifty_fvg_bot/.env'
  if grep -q 'WEBHOOK_PORT' \"\$BOT_ENV\" 2>/dev/null; then
    sed -i 's/^WEBHOOK_PORT=.*/WEBHOOK_PORT=8081/' \"\$BOT_ENV\"
    echo '  Updated existing WEBHOOK_PORT in .env'
  else
    echo 'WEBHOOK_PORT=8081' >> \"\$BOT_ENV\"
    echo '  Added WEBHOOK_PORT=8081 to .env'
  fi
"
echo "  ✓ Bot .env updated"

# ── Step 4: Clone Tally AI repo ───────────────────────────────────────────────
echo ""
echo "→ [4/7] Cloning Tally AI repo..."
$SSH "
  if [ ! -d '${TALLY_DIR}' ]; then
    git clone ${TALLY_REPO} ${TALLY_DIR}
    echo '  Cloned fresh'
  else
    cd ${TALLY_DIR} && git pull --ff-only origin main
    echo '  Already exists — pulled latest'
  fi
  mkdir -p ${TALLY_DIR}/logs
  mkdir -p ${TALLY_DIR}/server/src/data/tally-ai-gst
  mkdir -p ${TALLY_DIR}/server/src/data/tally-ai-gstr2b
"
echo "  ✓ Tally AI code on server"

# ── Step 5: Install Node deps and build React ─────────────────────────────────
echo ""
echo "→ [5/7] npm install + build (this takes ~2 min)..."
$SSH "
  cd ${TALLY_DIR}/server && npm install --production=false
  cd ${TALLY_DIR}/client && npm install
  VITE_BASE_PATH=/tally/ npm run build
"
echo "  ✓ React client built"

# ── Step 6: Python venv + openpyxl ───────────────────────────────────────────
echo ""
echo "→ [6/7] Creating Python venv with openpyxl..."
$SSH "
  if [ ! -d '${TALLY_DIR}/venv' ]; then
    python3.11 -m venv ${TALLY_DIR}/venv
  fi
  ${TALLY_DIR}/venv/bin/pip install --quiet --upgrade pip
  ${TALLY_DIR}/venv/bin/pip install --quiet openpyxl
"
echo "  ✓ openpyxl installed"

# ── Step 7: .env template + PM2 ──────────────────────────────────────────────
echo ""
echo "→ [7/7] Creating .env template + starting PM2..."
$SSH "
  ENV_FILE='${TALLY_DIR}/server/.env'
  if [ ! -f \"\$ENV_FILE\" ]; then
    cat > \"\$ENV_FILE\" << 'ENVEOF'
PORT=4000
NODE_ENV=production
PYTHON_BIN=/home/ubuntu/tally-ai/venv/bin/python3
ANTHROPIC_API_KEY=REPLACE_WITH_YOUR_KEY
ENVEOF
    echo '  Created .env template — YOU MUST add your ANTHROPIC_API_KEY'
  else
    echo '  .env already exists — skipping creation'
  fi

  # Restart bot on new port, start Tally AI, start Nginx
  cd ${BOT_DIR} && pm2 restart nifty-fvg-bot || pm2 start ecosystem.config.js --only nifty-fvg-bot
  cd ${TALLY_DIR} && pm2 start tally-ecosystem.config.js || true
  pm2 save

  sudo systemctl enable nginx
  sudo systemctl start nginx
"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✓ Setup complete!"
echo ""
echo "IMPORTANT — before Tally AI will work:"
echo "  1. SSH to the server:"
echo "     ssh -i $PEM_KEY $SERVER"
echo "  2. Add your Anthropic API key:"
echo "     nano ${TALLY_DIR}/server/.env"
echo "     (Set ANTHROPIC_API_KEY=sk-ant-...)"
echo "  3. Reload Tally AI:"
echo "     pm2 reload tally-ai"
echo ""
echo "URLs:"
echo "  Bot dashboard : https://${DOMAIN}/"
echo "  Tally AI      : https://${DOMAIN}/tally/"
echo "═══════════════════════════════════════════════════════════"
