'use strict';

// spirit/run/spirit/fileSystem.js
// THE NODE'S FILE SYSTEM (goal/G40.6): the files of the run folder, read, written, stated, annotated and listed, and
// the two rules of what may ever be served or written. Andy, 2026-10-25: "lift the node version of those function from
// kernel.js and put them in spirit/fileSystem.js, then have both the node and relay use those." Lifted whole from the
// kernel's node half; kernel.js keeps its names pointing here until it is deleted.
//
// Node only: never served to a page (UNSERVABLE_FILES below names it, as it names kernel.js).

// The spirit object first, as the global spirit (goal/G40.1).
require('./spirit.js');
const fs = require('fs');
const path = require('path');

// Pinned to this file's own location, not process.cwd() — this file always lives at spirit/run/spirit/, so spirit/run/
// is always exactly one level up, regardless of which directory the server was actually launched from.
// process.cwd() silently broke every path, discovery rule, and writable-root check if you started the server from
// anywhere but spirit/run/ itself, with no error pointing at why.
const ROOT_DIR = path.join(__dirname, '..');

function error(e) { console.log('ERROR: ' + e); }

function fsPath(baseDir, requestPath) {
  const safePath = path.normalize(requestPath).replace(/^\/+/, '');
  const joined = path.join(baseDir, safePath);
  const relative = path.relative(baseDir, joined);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return joined;
}

function loadFileInternal(filePath) {
  filePath = fsPath(ROOT_DIR, filePath);
  try {
    return fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
  } catch (err) {
    return null;
  }
}

function loadFile(filePath) {
  if (!fileServable(filePath)) return null;
  return loadFileInternal(filePath);
}

// Read-only, same boundary as loadFile (anywhere under ROOT_DIR, not just
// the writable roots) — file metadata for display purposes (viewer info
// bubbles), not a write capability.
function statFile(filePath) {
  if (!fileServable(filePath)) return null;
  const resolved = fsPath(ROOT_DIR, filePath);
  if (!resolved) return null;
  try {
    const stats = fs.statSync(resolved);
    return { size: stats.size, mtimeMs: stats.mtimeMs, birthtimeMs: stats.birthtimeMs };
  } catch (err) {
    return null;
  }
}

// ONLY CORE FILES ARE WRITE-PROTECTED (goal/G30.21). Andy: "only "core" files are write-protected, manifests are no
// longer core", "any non-core file is fair game", and "the notion that we dictate to a user how to organize his file
// is dumb": no folder like media/ or published/ is special. What the gate still refuses: a core file (spirit/coreFiles.js,
// the commit check's own rule), a node's state at any depth, a sidecar's own path, and the node's root-level files,
// every one of them: no root-level file is writable (goal/G43.17, the last one it named gone). A server's own state is
// its spirit/state/<name>/data/, handed to it as --state; no page writes there (goal/G43.20).

// A CORE FILE, by the one rule the commit check reads (spirit/coreFiles.js): spirit/run/spirit/, spirit/run/spirit/element/, the
// shell's frame and an intrinsic app's folder, never a manifest. The repo root is two folders above the run folder.
function isCoreFile(canonical) {
  return require('./coreFiles').isCore('spirit/run/' + canonical, path.resolve(ROOT_DIR, '..', '..'));
}
// The one sidecar per annotated file gets a suffix, never a same-name
// extension swap — <file>.sidecar.json can never collide with the
// target itself, whatever the target's own extension is (a plain
// extension-replace, like an earlier hand-rolled convention this
// project also had, collides for any target that's already .json).
const SIDECAR_SUFFIX = '.sidecar.json';

// These never reach a browser at all — jobs.js/server.js have no
// isBrowser() half to justify it, and kernel.js's is served only via
// the boot-asset allowlist in server.js's static route (a separate,
// narrower exception), never through the generic fileServable-gated
// path loadFile/scanFolder/the rest of the static route all share.
// relayServer.js and serveCommon.js joined the list with cycle 0, when
// the relay got its own startup module: same kind of file as server.js.
// fileSystem.js, this file, joined it when it was lifted out of kernel.js (goal/G40.6).
// DEBUG.js and its generators joined it with goal/G41.19: server code, never a page's (spirit/test/DEBUG.md).
const UNSERVABLE_FILES = ['spirit/kernel.js', 'spirit/fileSystem.js', 'spirit/jobs.js', 'spirit/server.js', 'spirit/relayServer.js', 'spirit/serveCommon.js', 'spirit/relayConfig.js', 'spirit/relay.js', 'spirit/hub.js', 'spirit/relayAuth.js', 'spirit/DEBUG.js'].map(function (p) { return p.toLowerCase(); });
// goal/G43.9, Andy's box: "spirit/state/ is not servable, so a page cannot read other apps' state through a plain GET."
const UNSERVABLE_FOLDERS = ['spirit/DEBUG/', 'spirit/state/'].map(function (p) { return p.toLowerCase(); });

// Path-only, caller-independent by design: nothing server-side can verify
// which app is really asking, only whether the path itself is allowed.
// The one shape every gate below depends on: a caller-supplied path
// reduced to its ROOT_DIR-relative, forward-slashed canonical form, or
// null if it escapes ROOT_DIR entirely.
//
// This exists because both gates used to pattern-match the raw string the
// caller handed in, while fsPath resolved that same string separately —
// so the two could disagree, and the filesystem always obeyed the second
// one. 'spirit/state/identity.json' was denied while
// './spirit/state/identity.json' was not, and both name the same file: on
// a relay, the Ed25519 PRIVATE KEY. The same gap let
// 'shell/./natter/natter.js' through a guard that refused
// 'shell/natter/natter.js'. Every pattern below now runs against this
// function's OUTPUT, never against the input, so a path gets exactly one
// verdict no matter how it is spelled.
//
// Note this deliberately resolves rather than rejecting dot segments
// outright: './index.html' and 'shell/./natter/session.json' are legitimate
// and have to keep working (pathJail.js and pathCanonicalization.js both
// assert it). Canonicalize, then check — don't blanket-refuse.
function canonicalPath(filePath) {
  if (typeof filePath !== 'string') return null;
  const resolved = fsPath(ROOT_DIR, filePath);
  if (!resolved) return null;
  return path.relative(ROOT_DIR, resolved).replace(/\\/g, '/');
}

// THE GATES ARE BLIND TO CASE (goal/G41.30; the report: "Path gates are case-sensitive, so on Windows and macOS GET
// /Relay-State/identity.json serves the private keys"). On those discs relay-state answers to any case, while the
// gates compared the text as typed. So each gate judges the canonical path lower-cased, against lists lower-cased too
// (coreFiles.isCore folds as well): one verdict for every spelling, on every disc. On Linux a path in other case is
// another file, and refusing it as its lower-cased twin is refused costs nothing.
// NO SECOND NAME FOR A FILE EITHER (goal/G41.30; the review, H6: "8.3 short names like RELAY-~1/IDENTI~1.JSO", "folder
// names ending in a dot or space; and ::$DATA"; "refuse any path segment with ~ plus a digit, a :, or a trailing dot or
// space"): Windows reaches the same file by those spellings, so a segment holding one is no path of the tree, on every
// disc. No file of the tree is named so.
const ALIAS_SEGMENT = /~\d|:|[. ]$/;
// A node's own state, at any depth (goal/G43.8): a nested node keeps its key in its own spirit/state/.
const NODE_STATE = /(^|\/)spirit\/state(\/|$)/;
function gatePath(filePath) {
  const canonical = canonicalPath(filePath);
  if (canonical === null) return null;
  if (canonical.split('/').some(function (s) { return ALIAS_SEGMENT.test(s); })) return null;
  return canonical.toLowerCase();
}

function fileWritable(filePath) {
  const canonical = gatePath(filePath);
  if (canonical === null) return false;
  if (canonical.endsWith(SIDECAR_SUFFIX)) return false; // only annotateFace touches a sidecar's own path
  if (NODE_STATE.test(canonical)) return false; // the node's alone
  if (canonical.split('/').indexOf('relay-state') !== -1) return false; // an old tree's keys, wherever one is left
  if (canonical.indexOf('/') === -1) return false;
  if (isVendored(canonical)) return false; // Andy's Q1 (goal/G43.25): "servable but not writeable."
  // THE CORE CHECK GETS THE PATH IN ITS OWN CASE (goal/G43.20, wsl's verify: a starred face's fs.save answered 403 on Linux):
  // coreFiles.isCore folds case for its lists itself, but reads an app's own <name>.json by the folder's name, so the
  // lower-cased spirit/app/zzstar/ found no zzstar.json on a disc that tells case apart, and every app read as core.
  return !isCoreFile(canonicalPath(filePath));
}

// Same idea as fileWritable, for "can this path ever be read or listed
// at all" instead of "written". A sidecar is hidden from every generic
// consumer the same way — the only sanctioned way to see one is through
// getAnnotations, never loadFile/scanFolder/the static route.
function fileServable(filePath) {
  const canonical = gatePath(filePath);
  // A path that escapes ROOT_DIR is refused by the read gate itself,
  // not only by fsPath further down inside loadFile — one verdict, made
  // in one place, for every consumer (loadFile, statFile, scanFolder,
  // getAnnotations, and server.js's static route alike).
  if (canonical === null) return false;
  if (UNSERVABLE_FILES.indexOf(canonical) !== -1) return false;
  if (UNSERVABLE_FOLDERS.some(function (f) { return canonical.indexOf(f) === 0; })) return false;
  if (canonical.endsWith(SIDECAR_SUFFIX)) return false;
  // AT ANY DEPTH, not only the node's own: a node's spirit/state/ (NODE_STATE), and an old tree's relay-state/ with its
  // keys, are refused wherever they sit, because a top-level-only check once served a nested identity's private key
  // (faceServer's, gone with goal/G13.2) to any shell app and to the static route (wsl-claude found it, 2026-09-27; Andy's
  // "go." on the fix).
  if (canonical.split('/').indexOf('relay-state') !== -1 || NODE_STATE.test(canonical)) return false;
  return true;
}

function saveFileInternal(filePath, content) {
  const resolved = fsPath(ROOT_DIR, filePath);
  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, 'utf8');
    return { ok: true };
  } catch (err) {
    // A NAME THE FILE SYSTEM WILL NOT TAKE IS THE CALLER'S (goal/G41.30; the red: <, > or control characters in a path
    // made fs.save answer 500): Windows refuses what Linux takes. Said as a bad path; any other failure is the node's.
    if (err && ['EINVAL', 'ENOENT', 'ENAMETOOLONG', 'EISDIR', 'ENOTDIR', 'EEXIST'].indexOf(err.code) !== -1) return { ok: false, reason: 'bad-path' };
    error(err);
    return { ok: false, reason: 'error' };
  }
}

function saveFile(filePath, content) {
  if (!fileWritable(filePath)) return { ok: false, reason: 'forbidden' };
  return saveFileInternal(filePath, content);
}

function loadJsonValue(filePath) {
  console.log('inside loadJsonValue(' + filePath + ')');
  let file = loadFile(filePath);
  if (file === null) return null;
  try {
    return JSON.parse(file);
  } catch (e) {
    return null;
  }
}

function saveJsonValue(filePath, value) {
  console.log('inside saveJsonValue(' + filePath + ', ' + JSON.stringify(value) + ')');
  try {
    let jsonString = JSON.stringify(value, null, 2);
    return saveFile(filePath, jsonString);
  } catch (e) {
    console.log('inside saveJsonValue(' + filePath + ', ' + JSON.stringify(value) + ') failed: ' + e.message);
    return Promise.reject(new Error('failed to save JSON value: ' + e.message));
  }
}

function deleteFile(filePath) {
  const resolved = fsPath(ROOT_DIR, filePath);
  if (!fileWritable(filePath)) return { ok: false, reason: 'forbidden' };
  try {
    fs.unlinkSync(resolved);
    return { ok: true };
  } catch (err) {
    if (err.code === 'ENOENT') return { ok: true }; // already gone — idempotent delete
    error(err);
    return { ok: false, reason: 'error' };
  }
}

// Per-file annotation interface: one sidecar JSON file per annotated file, its one written part the face part (goal/G41.1).
// THE NODE'S ONLY (goal/G43.20; Andy: "ANNOTATIONS WILL BE NODE ONLY."): no verb reads or writes one for a caller.
// A NODE'S SIDECARS ARE ITS STATE (box v16 and v17; Andy: "because of desk we MUST run different configurations", "why
// would we track app sidecars?"): the sidecar lives at the mirror of its file's path in the node's state, out of git,
// this node's alone: spirit/state/<path>.sidecar.json. None beside the code counts.
function sidecarPathFor(filePath) {
  const p = canonicalPath(filePath) || String(filePath || '');
  return 'spirit/state/' + p + SIDECAR_SUFFIX;
}

function readSidecar(filePath) {
  const resolved = fsPath(ROOT_DIR, sidecarPathFor(filePath));
  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (err) {
    return {};
  }
}

// A SIDECAR IS NEVER CORE (goal/G30.21): its target must be a file that may be read, not one that may be written, so
// an intrinsic app's .js, which is core, still takes its notes.
function writeBucket(bucket, filePath, payload) {
  if (!fileServable(filePath)) return { ok: false, reason: 'forbidden' };
  const resolvedTarget = fsPath(ROOT_DIR, filePath);
  let stat;
  try {
    stat = fs.statSync(resolvedTarget);
  } catch (err) {
    // target doesn't exist — stat stays undefined, handled below
  }
  if (!stat || !stat.isFile()) return { ok: false, reason: 'file-not-found' };
  const sidecar = readSidecar(filePath);
  // INTRINSIC IS NO NODE'S TO WRITE: the coded list says it (spirit/coreFiles.js), so it is never kept in a sidecar.
  const part = Object.assign({}, payload || {});
  if (bucket === 'face') delete part.intrinsic;
  sidecar[bucket] = part;
  const resolvedSidecar = fsPath(ROOT_DIR, sidecarPathFor(filePath));
  fs.mkdirSync(path.dirname(resolvedSidecar), { recursive: true });
  fs.writeFileSync(resolvedSidecar, JSON.stringify(sidecar, null, 2), 'utf8');
  return { ok: true };
}

// THE FACE PART (goal/G30.21), the entry point for every caller (goal/G41.1): wholesale, not a deep merge. A caller
// changing one key without disturbing the others reads getAnnotations(...).face first and writes it back whole.
function annotateFace(filePath, payload) {
  return writeBucket('face', filePath, payload);
}

// The node's sidecar, all its parts ({} if none), its face part carrying intrinsic from the coded list.
function getAnnotations(filePath) {
  if (!fileServable(filePath)) return {};
  const sidecar = readSidecar(filePath);
  const face = Object.assign({}, sidecar.face || {}, { intrinsic: require('./coreFiles').intrinsic(canonicalPath(filePath) || '') });
  return Object.assign({}, sidecar, { face: face });
}

// Directories no tool should ever need to see: VCS internals. Skipped
// entirely (not recursed into, not added to result).
const SCAN_EXCLUDED_DIR_NAMES = new Set(['.git']);

// THE VENDORED FOLDERS, ONE LIST (goal/G43.25, box requirement 6; Andy:
// "can we hide those suckers in spirit/jobs/ for now? without the damn
// node_modules container?"): libraries we carry but did not write, each a
// folder relative to spirit/run. Every walker of the tree reads this list
// instead of a skip of its own, so vendor code is neither judged by our
// rules nor listed in Files; the next library is one line here. Andy's Q1:
// "servable but not writeable." A page still loads it (CodeMirror), and
// fileWritable refuses every file inside.
const VENDORED_FOLDERS = ['spirit/jobs/chokidar', 'spirit/jobs/readdirp', 'spirit/element/codeMirror'];
// VENDORED_FOLDERS.holds(p), the one question every walker asks of the
// list: is p, absolute or relative to the checkout or to spirit/run, with
// either slash, a vendored folder or inside one?
function isVendored(p) {
  const slashed = '/' + String(p || '').replace(/\\/g, '/') + '/';
  return VENDORED_FOLDERS.some(function (v) { return slashed.indexOf('/' + v + '/') !== -1; });
}
VENDORED_FOLDERS.holds = isVendored;
Object.freeze(VENDORED_FOLDERS);

function scanFolder(dirPath, result = []) {
  try {
    // Returns an array of fs.Dirent objects
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    while (entries.length > 0) {
      let entry = entries.shift();

      if (entry.isDirectory()) {
        if (SCAN_EXCLUDED_DIR_NAMES.has(entry.name)) continue;
        if (isVendored(path.relative(ROOT_DIR, path.resolve(entry.parentPath, entry.name)))) continue;

        // A directory is asked the same question a file is.
        // fileServable already refuses the node's state and
        // everything under it, but only files were ever asked —
        // so the identity key, the contactBook, the allow list and
        // the mailbox were all correctly hidden while the empty
        // folder holding them stayed in every listing. A row
        // that can never be opened is a tease, and one verdict
        // that half its callers do not consult is the shape of
        // bug this gate exists to avoid.
        //
        // Refused means refused whole: neither the folder nor
        // anything below it is walked, so nothing inside can be
        // reported by some later change to the file branch.
        const dirFull = path.resolve(entry.parentPath, entry.name);
        const dirRelative = path.relative(ROOT_DIR, dirFull).split(path.sep).join('/');
        if (!fileServable(dirRelative)) continue;

        let subfolder = path.join(entry.parentPath, entry.name);
        scanFolder(subfolder, result);
        result.push(entry);

      } else if (entry.isFile()) {
        // fileServable expects a ROOT_DIR-relative, forward-slashed
        // path — the same shape jobs.js's mapEntry later derives
        // independently for the same entry. path.resolve (not a
        // plain join) is kept deliberately: entry.parentPath
        // inherits whichever style the initial call used, so a
        // relative dirPath still resolves correctly even though
        // every caller today (jobs.js's spirit.fs,
        // servableAssets.js) passes an absolute one.
        const fullPath = path.resolve(entry.parentPath, entry.name);
        const relativePath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
        if (fileServable(relativePath)) result.push(entry);
      }
    }
  } catch (err) {
    error(err);
  }

  return result;
}

module.exports = {
  ROOT_DIR: ROOT_DIR,
  VENDORED_FOLDERS: VENDORED_FOLDERS,
  fsPath: fsPath,
  fileWritable: fileWritable,
  fileServable: fileServable,
  loadFile: loadFile,
  statFile: statFile,
  saveFile: saveFile,
  loadJsonValue: loadJsonValue,
  saveJsonValue: saveJsonValue,
  deleteFile: deleteFile,
  annotateFace: annotateFace,
  getAnnotations: getAnnotations,
  scanFolder: scanFolder,
};
