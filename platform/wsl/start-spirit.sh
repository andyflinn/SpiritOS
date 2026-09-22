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
#   - Andy's labMaster, :65420, from HIS checkout (~/SpiritOS) — "no
#     labMaster yet on wsl" — the same arrangement as on Windows;
#   - Andy's WSL node, :65432, brought up THROUGH that labMaster as its work
#     row. Andy: "that's what i needed chrome for easily accessible on the
#     wsl side, to see the shell there." Started only — never pulled or
#     restarted here: the checkout and when it moves are his (AGENT.md,
#     rule 6 as narrowed). A node already up is left as it is: labMaster
#     sees it by its port and adopts it, and start never kills a process.
#
# The agent's listener is not started here: it belongs to the agent's
# session, which re-arms it (AGENT.md, Agents on the network).
#
# Order matters on one point: WSL2 mirrors a Linux listener onto Windows'
# 127.0.0.1 when that port is free there. The Windows script starts Andy's
# Windows node on 65432 BEFORE calling this, so his WSL node never takes
# that port on the Windows side. Run this alone first and it could.

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

ANDY="$HOME/SpiritOS"
master_answers() { curl -s -m 2 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$1/api/nodes" | grep -q '^200$'; }

# ── Andy's labMaster ─────────────────────────────────────────────────
PORT=65420
if listening $PORT; then
  echo "Andy's labMaster :$PORT already running"
elif [ ! -f "$ANDY/spirit/test/labMaster/labMaster.js" ]; then
  echo "Andy's labMaster :$PORT DID NOT COME UP (no checkout at $ANDY)"
else
  # From his checkout, so its work row is his node's home. Log gitignored.
  setsid -f env -C "$ANDY" "$NODE_BIN" spirit/test/labMaster/labMaster.js \
    >> "$ANDY/labmaster.log" 2>&1 < /dev/null
  if wait_for master $PORT "master_answers $PORT"; then
    echo "Andy's labMaster :$PORT started"
  else
    echo "Andy's labMaster :$PORT DID NOT COME UP (see $ANDY/labmaster.log)"
  fi
fi

# ── Andy's WSL node, through his labMaster ───────────────────────────
PORT=65432
if listening $PORT; then
  echo "Andy's WSL node :$PORT already running"
elif master_answers 65420; then
  curl -s -m 10 -o /dev/null -X POST -H 'Content-Type: application/json' --data '{}' \
    http://127.0.0.1:65420/api/nodes/work/start
  if wait_for andy $PORT "node_answers $PORT"; then
    echo "Andy's WSL node :$PORT started (through labMaster)"
  else
    echo "Andy's WSL node :$PORT DID NOT COME UP (labMaster's work row; see $ANDY/labmaster.log)"
  fi
else
  echo "Andy's WSL node :$PORT DID NOT COME UP (no labMaster to start it)"
fi

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

# ── wsl-claude's second node ─────────────────────────────────────────
#
# Andy, 2026-09-23: "i want to be able to filter by either one of you or
# any of your local persitent nodes, that i have a choice of ID's to
# filter by, so two more permanent nodes to add to the test environment
# (one more for each of you)." The Relay Monitor's traffic console filters
# by identity, and two keys barely test a filter.
#
# Its own checkout, because a node's identity lives in its home's
# relay-state/ — two nodes from one tree would be one identity twice.
PORT=45442
TWO="$HOME/SpiritOS-agent-wsl-claude-2"
if listening $PORT; then
  echo "wsl-claude-2 node :$PORT already running"
elif [ ! -f "$TWO/spirit/run/js/server.js" ]; then
  echo "wsl-claude-2 node :$PORT DID NOT COME UP (no checkout at $TWO)"
else
  setsid -f env -C "$TWO/spirit/run" "$NODE_BIN" js/server.js --port $PORT \
    >> "$TWO/node.log" 2>&1 < /dev/null
  # It answers `node.card` only once it holds a key, which a node gets when
  # it claims its relay seat — so a node awaiting its invite is UP and
  # cardless, and the port is what says it is running.
  if wait_for node2 $PORT "listening $PORT"; then
    echo "wsl-claude-2 node :$PORT started"
  else
    echo "wsl-claude-2 node :$PORT DID NOT COME UP (see $TWO/node.log)"
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
