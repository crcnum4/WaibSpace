#!/usr/bin/env bash
# Reset WaibSpace user data.
#
# Usage:
#   ./scripts/reset-user-data.sh          # full reset (nuke everything)
#   ./scripts/reset-user-data.sh --soft   # clear interactions/memory, keep MCP connections

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_ROOT/apps/backend/data"
DB_FILE="$DATA_DIR/waibspace.db"
MODE="${1:-full}"

# Stop running servers first
if pgrep -f "bun.*backend" > /dev/null 2>&1; then
  echo "  Stopping running backend processes..."
  pkill -f "bun.*backend" 2>/dev/null || true
  sleep 1
fi

if [ "$MODE" = "--soft" ]; then
  echo "Soft reset — clearing interactions & memory, keeping MCP connections..."

  if [ -f "$DB_FILE" ]; then
    sqlite3 "$DB_FILE" <<SQL
DELETE FROM memory;
DELETE FROM memory_fts;
DELETE FROM event_log;
DELETE FROM user_feedback;
DELETE FROM compositions;
DELETE FROM component_templates;
DELETE FROM user_preferences;
VACUUM;
SQL
    echo "  Cleared: memory, event_log, user_feedback, compositions, preferences"
    echo "  Kept:    mcp_servers"
  else
    echo "  No database found — nothing to clear."
  fi

else
  echo "Full reset — removing all user data..."

  # Remove SQLite database and WAL files
  if [ -f "$DB_FILE" ]; then
    rm -f "$DB_FILE" "$DB_FILE-shm" "$DB_FILE-wal"
    echo "  Removed waibspace.db"
  fi

  # Remove legacy memory file
  rm -f "$DATA_DIR/memory.json.migrated"
fi

# Keep .gitkeep
touch "$DATA_DIR/.gitkeep"

echo "Done. Run 'bun dev' to start fresh."
