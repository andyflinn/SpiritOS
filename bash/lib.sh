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

# ── THE TEMPLATE IS NOT THE UNIT NAME ────────────────────────────────
#
# One file in this repo describes how to run a relay, and it is the same
# file whichever relay you are installing — it is all placeholders. What
# VARIES is what systemd calls the installed copy.
#
# Conflating the two is what broke the first real lab-install:
# install-units read `bash/systemd/${UNIT_NAME}.service`, so setting
# SPIRIT_UNIT_NAME=spirit-lab sent it looking for a template nobody
# wrote. The error was honest — "missing .../spirit-lab.service" — and
# the fix is that the template has a name of its own.
UNIT_TEMPLATE="${SPIRIT_UNIT_TEMPLATE:-spirit-relay}"
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

# ── NEVER `cmd | grep -q` IN A CONDITION, UNDER pipefail ─────────────
#
# `set -euo pipefail` is on for every script here, and it turns a
# SUCCESSFUL match into a failed test:
#
#   grep -q exits the instant it matches
#   the producer keeps writing into a closed pipe and takes SIGPIPE (141)
#   pipefail promotes that to the PIPELINE's status
#   the `if` sees 141 and goes to the else branch
#
# Proved on spirit-3, 2026-09-16:
#
#   systemctl list-unit-files | grep -q "^spirit-relay.service"  -> MATCHED
#   ( set -o pipefail; same )                                    -> exit=141
#
# What it cost: `bash/update` has NEVER restarted the relay. It reported
# "unit spirit-relay not installed" on a box where the unit is installed,
# enabled and active — so the code updated and the process kept running
# the old copy until somebody restarted it by hand. Silent for as long as
# pipefail has been in this file, on every box.
#
# `contains` does the same job with no pipe: the producer finishes into a
# variable, and grep reads a here-string. Nothing can be signalled.
#
#   contains "$(ss -tln)" ':65420 '   instead of  ss -tln | grep -q ...
#
# And where the question is "does systemd know this unit", ask systemd
# rather than filtering its list — `unit_known` below.
contains() {
  grep -q -- "$2" <<< "$1"
}

unit_known() {
  have systemctl || return 1
  systemctl cat "$1.service" >/dev/null 2>&1
}

say() { echo "==> $*"; }

ok() { echo "    ok  $*"; }

warn() { echo "    !!  $*" >&2; }
