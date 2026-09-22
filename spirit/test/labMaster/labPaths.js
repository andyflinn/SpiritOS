'use strict';

// spirit/test/labMaster/labPaths.js
// WHICH labMaster, AND WHERE ITS THINGS LIVE — one answer, for labMaster
// itself and for every suite that finds its nodes on disk.
//
// ── WHY THERE CAN BE TWO (2026-09-22) ────────────────────────────────
//
// Andy keeps a labMaster running beside his WSL node, on 65420, from his
// checkout. An agent's clone running the harness then REUSED it
// (ensureMaster) — and a fixture is a copy of labMaster's OWN working
// tree, so the lab suites tested Andy's commit, not the one under test,
// and passed. A wrong green. Found by wsl-claude; settled between the
// agents (ANDYS_RULES general rule 9):
//
//   - LAB_MASTER_PORT (default 65420) lets a clone run its own labMaster,
//     outside the lab range 65400-65429 — 45420 by example.
//   - A labMaster on any other port is a HARNESS labMaster: it holds no
//     `work` row (every labMaster's work row points at 65432, and stopping
//     it kills whatever holds that port — Andy's node, from an agent's
//     code), and its live-world features are off (CLAUDE.md: no labMaster
//     against spirit-3).
//   - Its state, fixtures and lab nodes live in their own folders, keyed
//     by port, so two labMasters never write each other's files.
//   - ensureMaster checks a running labMaster serves THIS checkout before
//     reusing it, and fails loudly, naming both, when it does not.
//
// ── AND A RUNNING labMaster CARRIES THE CODE IT STARTED WITH ────────
//
// Found in cycle 9: the default labMaster is long-lived — Andy's start
// script brings it up when a session opens and it stays up for days — so
// it holds whatever `labMaster.js` said at the moment it launched. Change
// how a lab node is PLANTED and the suites will still see the old
// behaviour, because the process doing the planting never re-read its own
// file.
//
// The checkout guard above does not catch this: it asks WHICH checkout,
// not WHICH VERSION of it, and the answer is the right checkout either
// way. It cost a red that looked like a broken feature and was a stale
// process.
//
// So: after changing labMaster itself, run the lab suites with
// LAB_MASTER_PORT set. A harness labMaster is spawned fresh and dies with
// the run, which is exactly the property that makes it trustworthy here —
// and it leaves Andy's own labMaster, and the work node it holds,
// untouched.

const path = require('path');
const os = require('os');

const DEFAULT_PORT = 65420;
const PORT = Number(process.env.LAB_MASTER_PORT) || DEFAULT_PORT;
const HARNESS = PORT !== DEFAULT_PORT;
const SUFFIX = HARNESS ? '-' + PORT : '';

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

module.exports = {
  DEFAULT_PORT: DEFAULT_PORT,
  PORT: PORT,
  MASTER: 'http://127.0.0.1:' + PORT,
  // A harness labMaster: no work row, no live world, its own folders.
  HARNESS: HARNESS,
  REPO_ROOT: REPO_ROOT,
  STATE_DIR: path.join(os.tmpdir(), 'spiritos-lab-master' + SUFFIX),
  FIXTURE_ROOT: path.join(os.tmpdir(), 'spiritos-relay-fakes' + SUFFIX),
  LAB_ROOT: path.join(REPO_ROOT, '..', 'lab' + SUFFIX),
};
