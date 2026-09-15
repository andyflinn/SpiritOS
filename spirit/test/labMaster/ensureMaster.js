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

const MASTER = 'http://127.0.0.1:65420';
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
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

async function ensure() {
  if (await up()) return { ok: true, started: false };

  spawned = spawn(process.execPath, [SCRIPT], { cwd: REPO_ROOT, stdio: 'ignore' });
  for (let n = 0; n < TRIES; n += 1) {
    /* eslint-disable no-await-in-loop */
    await sleep(WAIT_MS);
    if (await up()) return { ok: true, started: true };
  }
  return {
    ok: false,
    error: 'labMaster did not come up on 65420 after ' +
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
async function api(method, pathname, body) {
  try {
    const res = await fetch(MASTER + pathname, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
    return { status: res.status, json: parsed, text: text };
  } catch (e) {
    return { status: 0, json: null, text: String((e && e.message) || e) };
  }
}

module.exports = { ensure: ensure, stop: stop, api: api, MASTER: MASTER, up: up };
