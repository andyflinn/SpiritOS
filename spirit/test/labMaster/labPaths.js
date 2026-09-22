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
