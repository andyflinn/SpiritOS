#!/usr/bin/env bash
# platform/wsl/start-spirit.sh — the WSL half of starting SpiritOS in one go.
#
# Andy, 2026-09-22: "starting all of them your personal nodes, labMaster and
# personal node for me should occur in one fell swoop when SpiritOS sessions
# start." The Windows half is platform/windows/start-spirit.ps1, run by a VS
# Code task when the SpiritOS folder opens; it calls this last, through
# wsl.exe, if this file is executable.
#
# Starts only what is down, detached, so it outlives the call:
#   - wsl-claude's own node, :45441, from the clone this file lives in;
#   - the WSL desktop, :45480 (platform/wsl/desktop).
# One line per piece: started / already running / DID NOT COME UP.
#
# Left out on purpose: Andy's WSL node (65432) and a labMaster on WSL. The
# WSL node is his test bed and stays his (AGENT.md, rule 6 as narrowed).
# The agent's listener is not started here either: it belongs to the agent's
# session, which re-arms it (AGENT.md, Agents on the network).

set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
NODE_BIN="$(command -v node || echo /usr/bin/node)"

listening() { ss -tln 2>/dev/null | grep -q -E "127\.0\.0\.1:$1\b"; }

# $1 label, $2 port, $3 check (a command that succeeds once it answers)
wait_for() {
  for _ in $(seq 1 20); do
    if eval "$3" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  return 1
}

node_answers() {
  curl -s -m 2 -X POST -H 'Content-Type: application/json' \
    --data '{"verb":"node.card"}' "http://127.0.0.1:$1/api/spirit" | grep -q '"ok":true'
}
page_answers() { curl -s -m 2 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$1/" | grep -q '^200$'; }

# ── wsl-claude's node ────────────────────────────────────────────────
PORT=45441
if listening $PORT; then
  echo "wsl-claude node :$PORT already running"
else
  # The server refuses to start unless its working directory is spirit/run.
  setsid -f env -C "$ROOT/spirit/run" "$NODE_BIN" js/server.js --port $PORT \
    >> "$ROOT/node.log" 2>&1 < /dev/null
  if wait_for node $PORT "node_answers $PORT"; then
    echo "wsl-claude node :$PORT started"
  else
    echo "wsl-claude node :$PORT DID NOT COME UP (see $ROOT/node.log)"
  fi
fi

# ── the WSL desktop ──────────────────────────────────────────────────
PORT=45480
LOG="${XDG_CONFIG_HOME:-$HOME/.config}/wsl-desktop/desktop.log"
mkdir -p "$(dirname "$LOG")"
if listening $PORT; then
  echo "WSL desktop :$PORT already running"
else
  setsid -f "$NODE_BIN" "$ROOT/platform/wsl/desktop/desktop.js" \
    >> "$LOG" 2>&1 < /dev/null
  if wait_for desktop $PORT "page_answers $PORT"; then
    echo "WSL desktop :$PORT started"
  else
    echo "WSL desktop :$PORT DID NOT COME UP (see $LOG)"
  fi
fi
