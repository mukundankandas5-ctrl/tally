#!/bin/bash
# ── Tally AI — one-click launcher ───────────────────────────
# Double-click in Finder. Installs deps on first run,
# builds the client once, then starts the server.

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# ── helpers ──────────────────────────────────────────────────
log()  { echo "[TALLY] $*"; }
ok()   { echo "[TALLY] ✅  $*"; }
warn() { echo "[TALLY] ⚠️   $*"; }
die()  { echo "[TALLY] ❌  $*"; echo ""; read -p "Press Enter to close…"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           Tally AI — Starting Up                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. check node / npm ──────────────────────────────────────
if ! command -v node &>/dev/null; then
  die "Node.js not found. Install it from https://nodejs.org then try again."
fi
if ! command -v npm &>/dev/null; then
  die "npm not found. Install Node.js from https://nodejs.org then try again."
fi
ok "Node $(node --version)  /  npm $(npm --version)"

# ── 2. check .env ────────────────────────────────────────────
if [ ! -f "$DIR/.env" ]; then
  die ".env not found at $DIR/.env — copy .env.example and add your ANTHROPIC_API_KEY."
fi
if ! grep -q "ANTHROPIC_API_KEY=sk-" "$DIR/.env" 2>/dev/null; then
  warn "ANTHROPIC_API_KEY looks empty in .env — AI features won't work until it's set."
fi

# ── 3. install server deps if missing ───────────────────────
if [ ! -d "$DIR/server/node_modules" ]; then
  log "Installing server dependencies (first run — takes ~30 s)…"
  (cd "$DIR/server" && npm install) || die "npm install failed in server/. Check your internet connection."
  ok "Server dependencies installed"
else
  ok "Server dependencies present"
fi

# ── 4. install client deps if missing ───────────────────────
if [ ! -d "$DIR/client/node_modules" ]; then
  log "Installing client dependencies (first run — takes ~30 s)…"
  (cd "$DIR/client" && npm install) || die "npm install failed in client/. Check your internet connection."
  ok "Client dependencies installed"
else
  ok "Client dependencies present"
fi

# ── 5. build client if dist doesn't exist ───────────────────
# To force a rebuild (after UI changes): delete client/dist and re-run.
if [ ! -d "$DIR/client/dist" ]; then
  log "Building client app (first run — takes ~20 s)…"
  (cd "$DIR/client" && npm run build) || die "Client build failed. Run: cd client && npm run build"
  ok "Client built → client/dist"
else
  ok "Client build present (delete client/dist to rebuild)"
fi

# ── 6. kill any stale process on port 4000 ──────────────────
STALE=$(lsof -ti tcp:4000 2>/dev/null || true)
if [ -n "$STALE" ]; then
  warn "Port 4000 already in use — clearing stale process…"
  echo "$STALE" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ── 7. open browser once server is ready ────────────────────
(sleep 3 && open http://localhost:4000) &

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  App  →  http://localhost:4000              │"
echo "  │                                             │"
echo "  │  Ctrl+C to stop                             │"
echo "  └─────────────────────────────────────────────┘"
echo ""

# ── 8. start server (foreground) ────────────────────────────
# caffeinate keeps Mac awake while the server is running.
trap 'log "Shutting down…"; exit 0' INT TERM

caffeinate -i -m node "$DIR/server/src/index.js"

echo ""
read -p "Server stopped. Press Enter to close…"
