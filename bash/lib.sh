#!/bin/bash
# Shared helpers for bash/*. Do not run this file by itself.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/spirit/run"
UNIT_NAME="spirit-relay"
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
