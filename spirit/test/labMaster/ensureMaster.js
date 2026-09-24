'use strict';

// spirit/test/labMaster/ensureMaster.js
// Bring the lab control plane up, if it is not already.
//
// ── WHY THIS IS ITS OWN FILE ─────────────────────────────────────────
//
// It is the one thing that stood between the suites in this directory
// and the harness. They each assumed labMaster was ALREADY listening on
// 65420 — started by hand, by a person, before running anything — so
// `runAll.js` could not run them and did not try, and they rotted for
// months without going red anywhere (see STATE.md).
//
// labWorld.js solved this for itself back when liveFrontDoor was
// written, and kept the solution private. That is the whole of the
// difference between a suite nobody can run unattended and one the
// harness picks up: twenty lines that nobody had lifted out.
//
// ── PROVE THE DEPENDENCY BEFORE ASSERTING ANYTHING ABOUT IT ──────────
//
// A suite that needs labMaster and does not check for it reports PRODUCT
// failures for a control plane that was never running — which is the
// lesson presenceWire paid for with five false red lines. So the answer
// here is { ok: false } with a reason, and a caller that cannot get a
// lab says so as its own first failure rather than blaming the relay.
//
// ── AND STOP WHAT WE STARTED, ONLY ─────────────────────────────────
//
// A person debugging has their own labMaster up with their own rows in
// it. A suite that killed it on the way out would take that with it. So
// `stop()` is a no-op unless this process is the one that spawned it.

const path = require('path');
const { spawn } = require('child_process');

// Which labMaster, and its port: labPaths.js (LAB_MASTER_PORT, default
// 65420). A clone that must not reuse Andy's sets it, e.g. 45420.
const labPaths = require('./labPaths');
const MASTER = labPaths.MASTER;
const REPO_ROOT = labPaths.REPO_ROOT;
const SCRIPT = 'spirit/test/labMaster/labMaster.js';

// Long enough for a cold node process on a laptop that is also running
// five other suites, short enough that a labMaster which is never coming
// up is reported rather than waited on.
const TRIES = 20;
const WAIT_MS = 250;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function up() {
  try {
    const res = await fetch(MASTER + '/api/nodes');
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

let spawned = null;

// ── REUSE ONLY A labMaster THAT SERVES THIS CHECKOUT (2026-09-22) ────
//
// A fixture is a copy of labMaster's OWN working tree, so a labMaster
// started from another checkout makes every lab suite test THAT tree —
// and pass. Found by wsl-claude, whose clone's harness reused Andy's
// labMaster on WSL. So a running labMaster is asked which checkout it
// copies from before it is reused: /api/root, or — for a labMaster from
// before that route — the home of its work row. Anything else fails
// loudly, naming both, and says how to run a labMaster of one's own.
// Case folds only on Windows, where the file system does too. On Linux two
// folders differing only in case are two checkouts (wsl-claude, 2026-09-22).
function norm(p) {
  const s = path.resolve(String(p || '')).replace(/\\/g, '/');
  return process.platform === 'win32' ? s.toLowerCase() : s;
}

// Through api(), below — one reach for every call this file makes, so
// oneDoor's roll for it does not grow.
async function servesThisCheckout() {
  const mine = norm(REPO_ROOT);
  const root = await api('GET', '/api/root');
  if (root.status === 200 && root.json && root.json.root) {
    return { same: norm(root.json.root) === mine, theirs: root.json.root };
  }
  const listed = await api('GET', '/api/nodes');
  const work = ((listed.json && listed.json.nodes) || []).filter(function (n) { return n.id === 'work'; })[0];
  const theirs = work && work.home ? norm(work.home).replace(/\/spirit\/run$/, '') : '';
  return { same: !!theirs && theirs === mine, theirs: theirs || '(it will not say which checkout)' };
}

async function ensure() {
  if (await up()) {
    const check = await servesThisCheckout();
    if (!check.same) {
      return {
        ok: false,
        // ── MARKED AS THE MACHINE'S CONDITION, NOT THE TREE'S ─────────
        //
        // `foreign` is what lets a caller stand down instead of going
        // red. The two ways ensure() can fail are not the same kind of
        // thing: a labMaster that WILL NOT START is a fault worth a red,
        // while a labMaster belonging to somebody else's checkout is a
        // fact about this machine that the developer can clear in one
        // command. Without the flag a caller has to match on the
        // sentence, which is how a message becomes an API by accident.
        foreign: true,
        theirs: check.theirs,
        error: 'the labMaster on ' + labPaths.PORT + ' copies from ' + check.theirs +
          ', not from this checkout (' + norm(REPO_ROOT) + '), so a lab suite here would test the ' +
          'wrong tree. Run your own: LAB_MASTER_PORT=45420 (any free port outside 65400-65429), ' +
          'or stop theirs — the harness starts its own when none is up.',
      };
    }
    return { ok: true, started: false };
  }

  spawned = spawn(process.execPath, [SCRIPT], { cwd: REPO_ROOT, stdio: 'ignore' });
  for (let n = 0; n < TRIES; n += 1) {
    /* eslint-disable no-await-in-loop */
    await sleep(WAIT_MS);
    if (await up()) return { ok: true, started: true };
  }
  return {
    ok: false,
    error: 'labMaster did not come up on ' + labPaths.PORT + ' after ' +
      ((TRIES * WAIT_MS) / 1000) + 's',
  };
}

// Only ours. See the header — somebody may be using theirs.
function stop() {
  if (!spawned) return;
  try { spawned.kill(); } catch (e) { /* already gone */ }
  spawned = null;
}

// The ordinary call to labMaster, so the suites here stop each carrying
// their own copy of it.
// ── ONE labMaster, UP TO SIX CALLERS ─────────────────────────────────
//
// The runner starts labMaster once and every lab suite is a client of it,
// six suites at a time. It spawns and stops real node processes, so it
// has moments where it is not accepting connections, and a refused
// connect would fail a suite outright over a service that was merely
// busy.
//
// THIS DID NOT FIX THE FLAKE IT WAS WRITTEN FOR, and the comment used to
// say it did. labLifecycle's `start relay: 0 fetch failed` turned out to
// be ECONNRESET, not ECONNREFUSED — labMaster blocked on two synchronous
// `netstat` subprocesses per node, its listen backlog filled, and Windows
// answers a connection on a full backlog with RST. The cause and its
// repair are in labMaster.js (portScanText); this retry never fired for
// it and could not have.
//
// It stays because it is still true on its own terms: a refused connect
// can happen while labMaster is restarting, and it is the one failure
// that is safe to retry. Kept as what it is, not as what it was hoped to
// be.
//
// ONLY ECONNREFUSED IS RETRIED, and that restraint is the whole safety of
// it. These calls are not idempotent — POST /api/nodes creates a node —
// so a request that may have ARRIVED must never be sent twice. A refused
// connect is the one failure that says nothing was accepted: no socket,
// no read, nothing at the far end to have acted on it. A reset or a
// hang-up mid-response could mean the opposite, and is reported as it
// always was.
function refusedConnect(e) {
  const code = (e && e.cause && e.cause.code) || (e && e.code) || '';
  return code === 'ECONNREFUSED';
}

async function api(method, pathname, body) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const res = await fetch(MASTER + pathname, {
        method: method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
      // AN HTTP STATUS IS AN ANSWER and is never retried. A 500 from
      // labMaster is a fact about what it did, and asking again would
      // hide it.
      return { status: res.status, json: parsed, text: text };
    } catch (e) {
      if (attempt < 2 && refusedConnect(e)) {
        await new Promise(function (r) { setTimeout(r, 150 * (attempt + 1)); });
        continue;
      }
      // NAME THE CAUSE. `fetch failed` is node's generic wrapper and says
      // nothing about why — and the retry above turns on exactly that
      // distinction, so a report without it cannot say whether the retry
      // should have fired. It cost one run already (2026-09-21): the
      // fix was aimed at ECONNREFUSED on the strength of a message that
      // never named a code.
      const code = (e && e.cause && e.cause.code) || (e && e.code) || '';
      return {
        status: 0, json: null, code: code,
        text: String((e && e.message) || e) + (code ? ' (' + code + ')' : ' (no code)'),
      };
    }
  }
}

// `refusedConnect` is exported for one reason: it decides whether a
// non-idempotent POST may be sent twice, and that decision is worth
// pinning where it can be read. The race it exists for cannot be
// provoked on demand; this predicate can.
module.exports = {
  ensure: ensure, stop: stop, api: api, MASTER: MASTER, up: up,
  // For a suite with its own start-up code: is the labMaster that answers
  // one of THIS checkout's? { same, theirs }.
  checkout: servesThisCheckout,
  refusedConnect: refusedConnect,
};
