'use strict';

// spirit/run/js/coreFiles.js
// WHICH FILES ARE CORE, GRANT-LOCKED (goal/G4.23, fixed in goal/G6.7). The one table the commit check reads and the test
// reads. It needs nothing of the desk's.
//
//   Andy, 2026-10-06 (goal/G6.7): "coreFiles.js goes in \"spirit/run/js/coreFiles.js\", with NO dependencies on any desk
//   stuff, and it is updated to include all files in spirit/run/shell/js"; "apps in spirit/run/shell/<appname>/ are
//   intrinsic (core) if the manifest says so."; index.html, shell/elements.css and shell/tokens.css core: "yes."
//
//   Andy, 2026-10-04: "the scope still has a grant-lock on core files.", and asked which: "basicall run/js and
//   intrinsics". So a file is core when it lies under spirit/run/js/, or in the folder of a shell app whose manifest
//   (spirit/run/shell/<name>/<name>.json) says "intrinsic": true. A commit touching one needs his grant on the item,
//   inside an agent's scope or not (commitCheck.js).
//
// isCore(repoPath, repoRoot): repoPath is relative to the repo, '/'-separated; repoRoot is where the manifests are read
// (the clone the commit is made in), by default the checkout holding this file.

const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..', '..');
const intrinsic = Object.create(null); // root + app name -> true | false, read once

function isIntrinsicApp(root, name) {
  const key = root + '\n' + name;
  if (!(key in intrinsic)) {
    let m = null;
    try { m = JSON.parse(fs.readFileSync(path.join(root, 'spirit', 'run', 'shell', name, name + '.json'), 'utf8')); } catch (e) { m = null; }
    intrinsic[key] = !!(m && m.intrinsic === true);
  }
  return intrinsic[key];
}

// The shell's frame: every app is loaded and drawn by these (goal/G6.7).
const FRAME = ['spirit/run/index.html', 'spirit/run/shell/elements.css', 'spirit/run/shell/tokens.css'];

function isCore(repoPath, repoRoot) {
  const p = String(repoPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (p.indexOf('spirit/run/js/') === 0 || p.indexOf('spirit/run/shell/js/') === 0) return true;
  if (FRAME.indexOf(p) !== -1) return true;
  const app = /^spirit\/run\/shell\/([^/]+)\//.exec(p);
  return !!(app && isIntrinsicApp(repoRoot || DEFAULT_ROOT, app[1]));
}

module.exports = { isCore: isCore };
