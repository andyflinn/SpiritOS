'use strict';

// spirit/run/spirit/coreFiles.js
// WHICH FILES ARE CORE, GRANT-LOCKED (goal/G4.23, fixed in goal/G6.7). The one table the commit check reads and the test
// reads. It needs nothing of the desk's.
//
//   Andy, 2026-10-06 (goal/G6.7): "coreFiles.js goes in \"spirit/run/spirit/coreFiles.js\", with NO dependencies on any desk stuff, and it is updated to include all files in spirit/run/shell/js";
//   "apps in spirit/run/shell/<appname>/ are
//   intrinsic (core) if the manifest says so."; index.html, shell/elements.css and shell/tokens.css core: "yes."
//
//   Andy, 2026-10-04: "the scope still has a grant-lock on core files.", and asked which: "basicall run/js and
//   intrinsics". So a file is core when it lies under spirit/run/spirit/, is the shell's frame, or
//   is a code file (.js, .css, .html) of an app or server on the coded INTRINSIC list (goal/G41.1, below). A
//   commit touching one needs his grant on the item, inside an agent's scope or not (commitCheck.js).
//
// isCore(repoPath, repoRoot): repoPath is relative to the repo, '/'-separated; repoRoot is where the manifests are read
// (the clone the commit is made in), by default the checkout holding this file.

const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..', '..');
// INTRINSIC IS A CODED LIST (goal/G41.1, box v17; Andy: "the user doesn't decide intrinsic, our development team does. so
// i would agree on a \"coded\" intrinsic list."): the shell/ and process/js/ app folders whose code is core, which every
// node runs and shows. Changed here only, under his grant; no sidecar or manifest says it for those (an app of spirit/app/
// says it in its own <name>.json, appIntrinsic below). shell/apps, shell/icons and shell/stats name folders no longer in
// the tree (icons is spirit/app/icons/ since 64e2d054). Every reader asks it: the commit check below, the node starting
// servers (spirit/jobs.js), and every face part the node hands out (spirit/fileSystem.js).
const INTRINSIC = [
  'process/js/fileServer',
  'shell/apps', 'shell/grants', 'shell/icons', 'shell/info',
  'shell/introSpector', 'shell/jobs', 'shell/jobsDetails', 'shell/join', 'shell/relayMonitor', 'shell/rotateKey', 'shell/stats',
];
// An app folder (shell/<name> or process/js/<name>), or a path inside one, is intrinsic.
// Blind to case, as every gate (goal/G41.30): Shell/Apps is shell/apps on a disc that does not tell them apart.
function intrinsic(folder) {
  const m = /^(shell\/[^/]+|process\/js\/[^/]+)(\/|$)/.exec(String(folder || '').replace(/\\/g, '/').replace(/^spirit\/run\//, '').toLowerCase());
  return !!m && INTRINSIC_LOWER.indexOf(m[1]) !== -1;
}
const INTRINSIC_LOWER = INTRINSIC.map(function (f) { return f.toLowerCase(); });
function isIntrinsic(root, dir, name) { return intrinsic(dir + '/' + name); }
// AN APP OF spirit/app/ SAYS IT ITSELF (goal/G43.14; Andy: "i think in spirit/app/<name>/<name>.json
// (identity:intrinsic:true|false)", and Q2: "anything in spirit/app/ is core unless spirit/app/<name>/<name>.json says it's not
// intrinsic."): what its <name>.json says of identity.intrinsic, read on disc ("no dependency on git"), undefined when it
// says nothing or there is none.
function appIntrinsic(root, name) {
  try { return JSON.parse(require('fs').readFileSync(path.join(root, 'spirit', 'run', 'spirit', 'app', name, name + '.json'), 'utf8')).identity.intrinsic; } catch (e) { return undefined; }
}
// The shell's frame: every app is loaded and drawn by these (goal/G6.7).
// spirit.js at the run root is the one spirit object (goal/G40.1): core.
// The navigation wrapper, the shell's one stack, too (goal/G41.30; Andy: "make the nav wrapper \"core\""): core while it
// lived in spirit/element/, it moved to shell/ in goal/G41.19 and no rule named it there.
// The shell's shell.css and its favicon too (goal/G41.30; Andy: "those files that core files depend on, are core-files,
// too"): index.html and face.html load them on every boot. Both sit in spirit/shell/ since goal/G43.18; /favicon.svg is
// served from ghost.svg (serveCommon.pageFile), the face's own favicon.svg is in BOOT below.
const FRAME = ['spirit/run/spirit/shell/index.html', 'spirit/run/spirit/spirit.js', 'spirit/run/spirit/shell/elements.css', 'spirit/run/spirit/shell/tokens.css', 'spirit/run/shell/navigationWrapper.js',
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
  // LOGIN AND JOIN ARE CORE WHOLE (goal/G41.3). Andy: the two are "mandatory components of shell/boot.js in loopback or
  // face mode respectively", boot "makes hard-coded assumptions" about them, and no page may change them. Their .json
  // files are no manifests but code, their UI text (Q9: "if they're code, just keep them, they are obviously NOT
  // manifests."), so they are asked here, before the manifest rule below.
  // The login app went (goal/G43.18, box v29: "The login is spirit.login, in spirit.js, no app"); Join stays core whole.
  if (p.indexOf('spirit/run/shell/join/') === 0) return true;
  // A MANIFEST IS NEVER CORE (goal/G30.21; Andy: "manifests are no longer core"), an intrinsic app's included.
  if (/^spirit\/run\/(shell|process\/js)\/([^/]+)\/\2\.json$/.test(p)) return false;
  // shell/json/ too (goal/G40.8; Andy: "the folder spirit/run/shell/json/ is a core folder as well. this way i can update
  // that system file manually once in a while, when i actually want it to go into github").
  // A FILE OF AN APP IN spirit/app/<name>/ (goal/G43.14): its <name>.json is always core, whatever it says, so turning intrinsic
  // off needs his grant; the rest of its folder is core unless that json says intrinsic false. A folder with no json, as
  // appSelector/ and test/ are, stays core.
  const own = /^spirit\/run\/spirit\/app\/([^/]+)\/(.+)$/.exec(String(repoPath || '').replace(/\\/g, '/').replace(/^\.\//, ''));
  if (own) return own[2].toLowerCase() === own[1].toLowerCase() + '.json' || appIntrinsic(repoRoot || DEFAULT_ROOT, own[1]) !== false;
  if (p.indexOf('spirit/run/spirit/') === 0 || p.indexOf('spirit/run/shell/json/') === 0) return true;
  // WHAT index.html LOADS ON EVERY BOOT IS CORE TOO (goal/G41.30; the review, H5): CodeMirror lives in spirit/element/codeMirror/
  // since goal/G43.5, so the line above holds it, and so with the progress bar. NOT shell/shared/ (Andy: "no \"core\" files
  // should reside in shell/shared/ since that folder was meant to be a place where non-intrinsic apps could share modules").
  // THE ROOT TEST FOLDER IS CORE (goal/G40.6; Andy: "also: additional \"core\" designation: spirit/run/test/"): the
  // product's permanent tests need his grant like the code they judge.
  if (p.indexOf('spirit/run/test/') === 0) return true;
  if (FRAME_LOWER.indexOf(p) !== -1) return true;
  // AN INTRINSIC APP'S CORE IS ITS CODE ONLY (goal/G30.21; Andy: "core for an intrinsic app is its code only (.js, .css,
  // .html), so its data files stay writable"), a server's the same.
  const app = /^spirit\/run\/(shell|process\/js)\/([^/]+)\//.exec(p);
  return !!(app && /\.(js|css|html)$/.test(p) && isIntrinsic(repoRoot || DEFAULT_ROOT, app[1], app[2]));
}

module.exports = { isCore: isCore, INTRINSIC: INTRINSIC, intrinsic: intrinsic, appIntrinsic: appIntrinsic };
