#!/bin/bash
# Shared helpers for bash/*. Do not run this file by itself.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/spirit/run"
# ── ONE BOX, MORE THAN ONE RELAY ────────────────────────────────────
#
#   Andy: "we'll need to fake multiple public relays without me shelling
#   out another bunch of bucks per month for that test environment."
#
# This was a constant, and it was the ONE thing stopping a second clone.
# Everything else here already derives from where the script lives or
# from an env override — REPO_ROOT walks up from $BASH_SOURCE, so a clone
# at /root/lab/SpiritOS computes its own RUN_DIR, its own relay-state,
# its own key. Only the unit name was shared, and a shared unit name is
# not a clash you notice: `install-units` from the second clone
# OVERWRITES /etc/systemd/system/spirit-relay.service and points the
# LIVE relay at the lab's directory and port. Nothing fails until the
# next restart, and then the public box comes back as the lab.
#
# NOT A SECOND UNIX USER, deliberately, and bash/ONE-OPERATOR.md still
# stands: what makes lab.andyflinn.com a different RELAY is its own
# clone, its own relay-state and its own Ed25519 identity. None of that
# needs a second account, and inventing one to run a test fixture would
# be the split that document exists to refuse.
UNIT_NAME="${SPIRIT_UNIT_NAME:-spirit-relay}"
NODE_PORT="${SPIRIT_RELAY_PORT:-65430}"
DOMAIN="${SPIRIT_RELAY_DOMAIN:-spirit.andyflinn.com}"
# Live clone on spirit-3 is /root/SpiritOS. That is the one-operator model:
# root is spirit. Do not invent a second Unix user for the same entity.
CLONE_DIR="${SPIRIT_CLONE_DIR:-/root/SpiritOS}"

die() { echo "ERROR: $*" >&2; exit 1; }

need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    die "this command must run as root on the relay host (try: sudo $0)"
  fi
}

on_relay_host() {
  [ "${SPIRIT_HOST:-}" = "relay" ] && return 0
  [ -d "$RUN_DIR" ] && [ -f "$RUN_DIR/js/server.js" ]
}

have() { command -v "$1" >/dev/null 2>&1; }

say() { echo "==> $*"; }

ok() { echo "    ok  $*"; }

warn() { echo "    !!  $*" >&2; }
