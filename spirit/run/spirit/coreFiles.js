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
//   is a code file (.js, .css, .html) of an app or server whose face annotation says intrinsic (goal/G30.21, below). A
//   commit touching one needs his grant on the item, inside an agent's scope or not (commitCheck.js).
//
// isCore(repoPath, repoRoot): repoPath is relative to the repo, '/'-separated; repoRoot is where the manifests are read
// (the clone the commit is made in), by default the checkout holding this file.

const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..', '..');
// THE INTRINSIC MARK IS THE FACE ANNOTATION'S (goal/G30.21; Andy: "only face-annotations intrinsic mark count the code
// files in that app or process as intrinsic."): the face part of <dir>/<name>/<name>.js.sidecar.json says intrinsic: true.
// The .json's intrinsic is the home shell's and counts for nothing here. Read every time, so a mark the face writes
// counts at once.
function isIntrinsic(root, dir, name) {
  let side = null;
  try { side = JSON.parse(fs.readFileSync(path.join(root, 'spirit', 'run', dir, name, name + '.js.sidecar.json'), 'utf8')); } catch (e) { side = null; }
  return !!(side && side.face && side.face.intrinsic === true);
}
// The shell's frame: every app is loaded and drawn by these (goal/G6.7).
// spirit.js at the run root is the one spirit object (goal/G40.1): core, as it was inside face/.
const FRAME = ['spirit/run/index.html', 'spirit/run/spirit.js', 'spirit/run/shell/elements.css', 'spirit/run/shell/tokens.css'];

function isCore(repoPath, repoRoot) {
  const p = String(repoPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  // A MANIFEST IS NEVER CORE (goal/G30.21; Andy: "manifests are no longer core"), an intrinsic app's included.
  if (/^spirit\/run\/(shell|process\/js)\/([^/]+)\/\2\.json$/.test(p)) return false;
  // shell/json/ too (goal/G40.8; Andy: "the folder spirit/run/shell/json/ is a core folder as well. this way i can update
  // that system file manually once in a while, when i actually want it to go into github").
  if (p.indexOf('spirit/run/spirit/') === 0 || p.indexOf('spirit/run/shell/js/') === 0 || p.indexOf('spirit/run/shell/json/') === 0) return true;
  // THE ROOT TEST FOLDER IS CORE (goal/G40.6; Andy: "also: additional \"core\" designation: spirit/run/test/"): the
  // product's permanent tests need his grant like the code they judge.
  if (p.indexOf('spirit/run/test/') === 0) return true;
  if (FRAME.indexOf(p) !== -1) return true;
  // THE FACE IS CORE (goal/G30.21; Andy: "the face folder is core", "face.html is core"): what the relay serves a face.
  if (p.indexOf('spirit/run/face/') === 0 || p === 'spirit/run/face.html') return true;
  // AN INTRINSIC APP'S CORE IS ITS CODE ONLY (goal/G30.21; Andy: "core for an intrinsic app is its code only (.js, .css,
  // .html), so its data files stay writable"), a server's the same.
  const app = /^spirit\/run\/(shell|process\/js)\/([^/]+)\//.exec(p);
  return !!(app && /\.(js|css|html)$/.test(p) && isIntrinsic(repoRoot || DEFAULT_ROOT, app[1], app[2]));
}

module.exports = { isCore: isCore };
