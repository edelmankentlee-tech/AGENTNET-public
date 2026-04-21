#!/bin/bash
AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$AGENT_DIR"

echo "Starting AgentNet Agent..."
exec node src/standalone-agent.js "$@"
