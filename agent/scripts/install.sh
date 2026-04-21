#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo "  AgentNet Standalone Agent - Installer"
echo "============================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed"
  echo "Download: https://nodejs.org/"
  exit 1
fi

NODE_MAJOR="$(node -v | sed -n 's/^v\([0-9][0-9]*\).*/\1/p')"
if [ -z "$NODE_MAJOR" ] || [ "${NODE_MAJOR}" -lt 18 ]; then
  echo "[ERROR] Node.js >= 18 is required. Current: $(node -v)"
  echo "Download: https://nodejs.org/"
  exit 1
fi
echo "[OK] Node.js version: $(node -v)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$AGENT_DIR"

if [ ! -f "config/agent.json" ]; then
  cp config/agent.json.example config/agent.json
  echo "[OK] Created config/agent.json from template"
else
  echo "[SKIP] config/agent.json already exists"
fi

if [ ! -f "config/llm.json" ]; then
  cp config/llm.json.example config/llm.json
  echo "[OK] Created config/llm.json from template"
else
  echo "[SKIP] config/llm.json already exists"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[WARN] npm not found, skip dependency installation"
else
  echo ""
  echo "Installing npm dependencies..."
  npm install --omit=dev 2>/dev/null || echo "[WARN] npm install failed, core features still work for basic usage"
fi

echo ""
echo "Running built-in self-check..."
if node src/standalone-agent.js --self-check; then
  echo "[OK] Self-check passed"
else
  echo "[WARN] Self-check failed, please rerun: node src/standalone-agent.js --self-check"
fi

echo ""
echo "============================================"
echo "  Installation complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Edit config/agent.json with your API Key"
echo "  2. (Optional) Edit config/llm.json for LLM support"
echo "  3. Run: npm start"
echo ""
echo "Or use the setup wizard: npm run setup"
echo "For deployment packages: run scripts/start.sh or scripts/start.bat"
echo ""
