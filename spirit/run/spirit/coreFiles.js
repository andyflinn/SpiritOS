'use strict';

// spirit/run/spirit/coreFiles.js
// WHICH FILES ARE CORE, GRANT-LOCKED (goal/G4.23, fixed in goal/G6.7). The one table the commit check reads and the test
// reads. It needs nothing of the desk's.
//
//   Andy, 2026-10-06 (goal/G6.7): "coreFiles.js goes in \"spirit/run/spirit/coreFiles.js\", with NO dependencies on any desk stuff";
//   the shell's frame (then index.html, elements.css, tokens.css) core: "yes."
//
//   Andy, 2026-10-04: "the scope still has a grant-lock on core files.", and asked which: "basicall run/js and
//   intrinsics". So a file is core when it lies under spirit/run/spirit/ (an app of spirit/app/ as its <name>.json says,
//   below), is the shell's frame or the face's boot, or is a product test of spirit/run/test/. A
//   commit touching one needs his grant on the item, inside an agent's scope or not. No git hook checks it any more
//   (goal/G43.27; Andy: "all, just get rid of the fucking git hooks.").
//
// isCore(repoPath, repoRoot): repoPath is relative to the repo, '/'-separated; repoRoot is where the manifests are read
// (the clone the commit is made in), by default the checkout holding this file.

const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..', '..');
// THE CODED INTRINSIC LIST IS GONE (goal/G43.30): it named shell/ app folders, and shell/ is gone (Andy: "can we delete
// run://shell/"). Every app of spirit/app/ says whether it is intrinsic in its own <name>.json.
// AN APP OF spirit/app/ SAYS IT ITSELF (goal/G43.14; Andy: "i think in spirit/app/<name>/<name>.json
// (identity:intrinsic:true|false)", and Q2: "anything in spirit/app/ is core unless spirit/app/<name>/<name>.json says it's not
// intrinsic."): what its <name>.json says of identity.intrinsic, read on disc ("no dependency on git"), undefined when it
// says nothing or there is none.
function appIntrinsic(root, name) {
  try { return JSON.parse(require('fs').readFileSync(path.join(root, 'spirit', 'run', 'spirit', 'app', name, name + '.json'), 'utf8')).identity.intrinsic; } catch (e) { return undefined; }
}
// The shell's frame: every app is loaded and drawn by these (goal/G6.7).
// spirit.js at the run root is the one spirit object (goal/G40.1): core.
// index.html and the navigation wrapper left this list with goal/G43.30, both gone.
// The shell's shell.css and its favicon too (goal/G41.30; Andy: "those files that core files depend on, are core-files,
// too"): face.html loads them on every boot. Both sit in spirit/shell/ since goal/G43.18; /favicon.svg is
// served from ghost.svg (serveCommon.pageFile), the face's own favicon.svg is in BOOT below.
const FRAME = ['spirit/run/spirit/spirit.js', 'spirit/run/spirit/shell/elements.css', 'spirit/run/spirit/shell/tokens.css',
  'spirit/run/spirit/shell/shell.css', 'spirit/run/spirit/shell/ghost.svg'];

// THE FACE'S BOOT IS CORE (goal/G41.3): face/ moved into shell/, and what was core there is core here, the page itself
// at the run root as before.
// goal/G43.18 (Andy: "i want all vital files under run://spirit/"): the page and the boot's files are in spirit/shell/ now, served at
// the addresses they always had (serveCommon.pageFile).
const BOOT = ['spirit/run/spirit/shell/face.html', 'spirit/run/spirit/shell/boot.js', 'spirit/run/spirit/shell/seal.js', 'spirit/run/spirit/shell/face.css', 'spirit/run/spirit/shell/favicon.svg'];
const FRAME_LOWER = FRAME.map(function (p) { return p.toLowerCase(); });
const BOOT_LOWER = BOOT.map(function (p) { return p.toLowerCase(); });

// BLIND TO CASE (goal/G41.30; the report: "Path gates are case-sensitive, so on Windows and macOS GET
// /Relay-State/identity.json serves the private keys"): the path and every list it is held against, lower-cased, so
// SPIRIT/SERVER.JS is as core as spirit/server.js.
function isCore(repoPath, repoRoot) {
  const p = String(repoPath || '').replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  if (BOOT_LOWER.indexOf(p) !== -1) return true;
  // A CORE FILE'S COMPANION TESTS ARE CORE (goal/G41.29; Andy: "the red for a core file is a core file, too", and "change
  // spirit/coreFiles as well, by making a coreFiles-companion files in the test-folder core files as well."): a file in a
  // test/ folder beside a core file, named after it (test/<name>.js, test/<name>.md), is core with it.
  const companion = /^(.*)\/test\/([^/]+)\.(js|md)$/.exec(p);
  if (companion && ['.js', '.css', '.html'].some(function (ext) { return isCore(companion[1] + '/' + companion[2] + ext, repoRoot); })) return true;
  // A FILE OF AN APP IN spirit/app/<name>/ (goal/G43.14): its <name>.json is always core, whatever it says, so turning intrinsic
  // off needs his grant; the rest of its folder is core unless that json says intrinsic false. A folder with no json, as
  // appSelector/ and test/ are, stays core.
  const own = /^spirit\/run\/spirit\/app\/([^/]+)\/(.+)$/.exec(String(repoPath || '').replace(/\\/g, '/').replace(/^\.\//, ''));
  if (own) return own[2].toLowerCase() === own[1].toLowerCase() + '.json' || appIntrinsic(repoRoot || DEFAULT_ROOT, own[1]) !== false;
  if (p.indexOf('spirit/run/spirit/') === 0) return true;
  // WHAT THE PAGE LOADS ON EVERY BOOT IS CORE TOO (goal/G41.30; the review, H5): CodeMirror lives in spirit/element/codeMirror/
  // since goal/G43.5, so the line above holds it, and so with the progress bar.
  // THE ROOT TEST FOLDER IS CORE (goal/G40.6; Andy: "also: additional \"core\" designation: spirit/run/test/"): the
  // product's permanent tests need his grant like the code they judge.
  if (p.indexOf('spirit/run/test/') === 0) return true;
  return FRAME_LOWER.indexOf(p) !== -1;
}

module.exports = { isCore: isCore, appIntrinsic: appIntrinsic };
