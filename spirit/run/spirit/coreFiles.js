'use strict';

// spirit/run/spirit/coreFiles.js
// WHICH FILES ARE CORE, GRANT-LOCKED (goal/G4.23, fixed in goal/G6.7). The one table the commit check reads and the test
// reads. It needs nothing of the desk's.
//
//   Andy, 2026-10-06 (goal/G6.7): "coreFiles.js goes in \"spirit/run/spirit/coreFiles.js\", with NO dependencies on any desk
//   stuff, and it is updated to include all files in spirit/run/shell/js"; "apps in spirit/run/shell/<appname>/ are
//   intrinsic (core) if the manifest says so."; index.html, shell/elements.css and shell/tokens.css core: "yes."
//
//   Andy, 2026-10-04: "the scope still has a grant-lock on core files.", and asked which: "basicall run/js and
//   intrinsics". So a file is core when it lies under spirit/run/spirit/ or spirit/run/shell/js/, is the shell's frame, or
//   is a code file (.js, .css, .html) of an app or server on the coded INTRINSIC list (goal/G41.1, below). A
//   commit touching one needs his grant on the item, inside an agent's scope or not (commitCheck.js).
//
// isCore(repoPath, repoRoot): repoPath is relative to the repo, '/'-separated; repoRoot is where the manifests are read
// (the clone the commit is made in), by default the checkout holding this file.

const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..', '..');
// INTRINSIC IS A CODED LIST (goal/G41.1, box v17; Andy: "the user doesn't decide intrinsic, our development team does. so
// i would agree on a \"coded\" intrinsic list."): the app folders whose code is core, which every node runs and shows.
// Changed here only, under his grant; no sidecar or manifest says it. Every reader asks it: the commit check below, the
// node starting servers (js/jobs.js), and every face part the node hands out (js/fileSystem.js).
const INTRINSIC = [
  'process/js/fileServer',
  'shell/apps', 'shell/contacts', 'shell/files', 'shell/grants', 'shell/icons', 'shell/info',
  'shell/introSpector', 'shell/jobs', 'shell/jobsDetails', 'shell/join', 'shell/relayMonitor', 'shell/rotateKey', 'shell/stats',
];
// An app folder (shell/<name> or process/js/<name>), or a path inside one, is intrinsic.
function intrinsic(folder) {
  const m = /^(shell\/[^/]+|process\/js\/[^/]+)(\/|$)/.exec(String(folder || '').replace(/\\/g, '/').replace(/^spirit\/run\//, ''));
  return !!m && INTRINSIC.indexOf(m[1]) !== -1;
}
function isIntrinsic(root, dir, name) { return intrinsic(dir + '/' + name); }
// The shell's frame: every app is loaded and drawn by these (goal/G6.7).
// spirit.js at the run root is the one spirit object (goal/G40.1): core.
const FRAME = ['spirit/run/index.html', 'spirit/run/spirit.js', 'spirit/run/shell/elements.css', 'spirit/run/shell/tokens.css'];

// THE FACE'S BOOT IS CORE (goal/G41.3): face/ moved into shell/, and what was core there is core here, the page itself
// at the run root as before.
const BOOT = ['spirit/run/face.html', 'spirit/run/shell/boot.js', 'spirit/run/shell/seal.js', 'spirit/run/shell/face.css', 'spirit/run/shell/favicon.svg'];

function isCore(repoPath, repoRoot) {
  const p = String(repoPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (BOOT.indexOf(p) !== -1) return true;
  // LOGIN AND JOIN ARE CORE WHOLE (goal/G41.3). Andy: the two are "mandatory components of shell/boot.js in loopback or
  // face mode respectively", boot "makes hard-coded assumptions" about them, and no page may change them. Their .json
  // files are no manifests but code, their UI text (Q9: "if they're code, just keep them, they are obviously NOT
  // manifests."), so they are asked here, before the manifest rule below.
  if (p.indexOf('spirit/run/shell/login/') === 0 || p.indexOf('spirit/run/shell/join/') === 0) return true;
  // A MANIFEST IS NEVER CORE (goal/G30.21; Andy: "manifests are no longer core"), an intrinsic app's included.
  if (/^spirit\/run\/(shell|process\/js)\/([^/]+)\/\2\.json$/.test(p)) return false;
  // shell/json/ too (goal/G40.8; Andy: "the folder spirit/run/shell/json/ is a core folder as well. this way i can update
  // that system file manually once in a while, when i actually want it to go into github").
  if (p.indexOf('spirit/run/spirit/') === 0 || p.indexOf('spirit/run/shell/js/') === 0 || p.indexOf('spirit/run/shell/json/') === 0) return true;
  // THE ROOT TEST FOLDER IS CORE (goal/G40.6; Andy: "also: additional \"core\" designation: spirit/run/test/"): the
  // product's permanent tests need his grant like the code they judge.
  if (p.indexOf('spirit/run/test/') === 0) return true;
  if (FRAME.indexOf(p) !== -1) return true;
  // AN INTRINSIC APP'S CORE IS ITS CODE ONLY (goal/G30.21; Andy: "core for an intrinsic app is its code only (.js, .css,
  // .html), so its data files stay writable"), a server's the same.
  const app = /^spirit\/run\/(shell|process\/js)\/([^/]+)\//.exec(p);
  return !!(app && /\.(js|css|html)$/.test(p) && isIntrinsic(repoRoot || DEFAULT_ROOT, app[1], app[2]));
}

module.exports = { isCore: isCore, INTRINSIC: INTRINSIC, intrinsic: intrinsic };
