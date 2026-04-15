#!/bin/bash
set -e

echo "============================================"
echo "  AgentNet Standalone Agent - Installer"
echo "============================================"
echo ""

NODE_MAJOR=$(node -v 2>/dev/null | cut -d. -f1 | sed 's/v//')
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 18 ]; then
    echo "[ERROR] Node.js >= 18 is required. Current: $(node -v 2>/dev/null || echo 'not installed')"
    echo "Install Node.js: https://nodejs.org/"
    exit 1
fi
echo "[OK] Node.js version: $(node -v)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

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

echo ""
echo "Installing npm dependencies..."
npm install --production 2>/dev/null || echo "[WARN] npm install failed, core features still work without dependencies"

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
echo ""
