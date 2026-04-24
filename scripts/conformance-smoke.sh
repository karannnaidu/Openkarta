#!/usr/bin/env bash
set -euo pipefail

# Build everything fresh
pnpm build

# Track background PIDs for cleanup
declare -a PIDS=()
cleanup() {
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

# Output directory for badge JSON; relative path keeps it portable across
# git-bash on Windows (where /tmp is not visible to native Node) and Linux CI.
BADGE_DIR=".smoke-out"
mkdir -p "$BADGE_DIR"

run_against() {
  local name="$1" port="$2" pkg="$3"
  echo "[smoke] booting $name on :$port"
  node "packages/$pkg/dist/bin.js" &
  local pid=$!
  PIDS+=("$pid")
  # wait up to 10s for the port to be reachable
  for _ in $(seq 1 20); do
    if curl -fs "http://localhost:$port/v0/discover" >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
  echo "[smoke] running conformance against $name"
  node packages/conformance-tests/dist/cli.js --target "http://localhost:$port" --json > "$BADGE_DIR/$name-badge.json"
  local failed
  failed=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$BADGE_DIR/$name-badge.json','utf8')).badge.testsFailed)")
  if [ "$failed" != "0" ]; then
    echo "[smoke] FAIL: $name had $failed failed tests" >&2
    cat "$BADGE_DIR/$name-badge.json" >&2
    exit 1
  fi
  echo "[smoke] $name passed (testsFailed=$failed)"
  kill "$pid" 2>/dev/null || true
}

run_against shop   4001 reference-agent-shop
run_against stays  4002 reference-agent-stays
run_against travel 4003 reference-agent-travel

echo "[smoke] all three agents passed"
