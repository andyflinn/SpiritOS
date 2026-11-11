'use strict';

// spirit/run/spirit/test/fileSystem.js
// The tests of spirit/fileSystem.js, and of no other module (spec: ./fileSystem.md). This file holds its two gates,
// fileServable (can a path be read) and fileWritable (can it be written), against a path spelled in another case
// (goal/G41.30; Andy, 2026-11-02: "Path gates are case-sensitive, so on Windows and macOS GET /Relay-State/identity.json
// serves the private keys"). On those disks a name in any case opens the same file, so a gate that refuses
// relay-state/ but not Relay-State/ refuses nothing there. Nothing is read or written: the gates are asked only.
// The one test file of fileSystem.js: the noPreferences part (the node writes no preferences.json) and the
// vendoredFolders part (one list of vendored folders), once fileSystem-noPreferences.js and
// fileSystem-vendoredFolders.js, are sections of it, run after its own checks.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FS = require(path.join(RUN, 'spirit', 'fileSystem.js'));

function ask(fn, p) { try { return FS[fn](p); } catch (e) { return 'threw ' + (e && e.message); } }

// Each closed path, as the gate refuses it today, and the same path in other cases.
const CLOSED_READ = [
  ['spirit/state/identity.json', 'the node\'s private key'],
  ['spirit/app/desk/spirit/state/identity.json', 'an app server\'s private key, at depth'],
  ['spirit/app/desk/relay-state/new.json', 'a file under an old relay-state, at depth'],
  ['spirit/server.js', 'a server script'],
  ['spirit/DEBUG/garbageArguments.js', 'the DEBUG folder'],
  ['spirit/app/desk/element/desk/desk.js.sidecar.json', 'a sidecar\'s own path'],
];
function cases(p) {
  const up = p.toUpperCase();
  const title = p.split('/').map(function (s) { return s.split('-').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join('-'); }).join('/');
  return [up, title].filter(function (x, i, all) { return x !== p && all.indexOf(x) === i; });
}

// fileServable: what it refuses, it refuses in every case.
// Each path written out, as it stands and in its other cases, so that each check has a plain title of its own.
test.run('fileServable refuses, as written: spirit/state/identity.json (the node\'s private key)', 0.8, function () { return (ask('fileServable', 'spirit/state/identity.json') === false) ? true : 'spirit/state/identity.json (the node\'s private key) is servable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileServable refuses, in another case: SPIRIT/STATE/IDENTITY.JSON (the node\'s private key)', 0.8, function () { return (ask('fileServable', 'SPIRIT/STATE/IDENTITY.JSON') === false) ? true : 'SPIRIT/STATE/IDENTITY.JSON (the node\'s private key, another case) is servable: on a case-insensitive disk it opens spirit/state/identity.json'; }, test.limit.quick);
test.run('fileServable refuses, in another case: Spirit/State/Identity.json (the node\'s private key)', 0.8, function () { return (ask('fileServable', 'Spirit/State/Identity.json') === false) ? true : 'Spirit/State/Identity.json (the node\'s private key, another case) is servable: on a case-insensitive disk it opens spirit/state/identity.json'; }, test.limit.quick);
test.run('fileServable refuses, as written: spirit/app/desk/spirit/state/identity.json (an app server\'s private key, at depth)', 0.8, function () { return (ask('fileServable', 'spirit/app/desk/spirit/state/identity.json') === false) ? true : 'spirit/app/desk/spirit/state/identity.json (an app server\'s private key, at depth) is servable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileServable refuses, in another case: SPIRIT/APP/DESK/SPIRIT/STATE/IDENTITY.JSON (an app server\'s private key, at depth)', 0.8, function () { return (ask('fileServable', 'SPIRIT/APP/DESK/SPIRIT/STATE/IDENTITY.JSON') === false) ? true : 'SPIRIT/APP/DESK/SPIRIT/STATE/IDENTITY.JSON (an app server\'s private key, at depth, another case) is servable: on a case-insensitive disk it opens spirit/app/desk/spirit/state/identity.json'; }, test.limit.quick);
test.run('fileServable refuses, in another case: Spirit/App/Desk/Spirit/State/Identity.json (an app server\'s private key, at depth)', 0.8, function () { return (ask('fileServable', 'Spirit/App/Desk/Spirit/State/Identity.json') === false) ? true : 'Spirit/App/Desk/Spirit/State/Identity.json (an app server\'s private key, at depth, another case) is servable: on a case-insensitive disk it opens spirit/app/desk/spirit/state/identity.json'; }, test.limit.quick);
test.run('fileServable refuses, as written: spirit/app/desk/relay-state/new.json (a file under an old relay-state, at depth)', 0.8, function () { return (ask('fileServable', 'spirit/app/desk/relay-state/new.json') === false) ? true : 'spirit/app/desk/relay-state/new.json (a file under an old relay-state, at depth) is servable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileServable refuses, in another case: SPIRIT/APP/DESK/RELAY-STATE/NEW.JSON (a file under an old relay-state, at depth)', 0.8, function () { return (ask('fileServable', 'SPIRIT/APP/DESK/RELAY-STATE/NEW.JSON') === false) ? true : 'SPIRIT/APP/DESK/RELAY-STATE/NEW.JSON (a file under an old relay-state, at depth, another case) is servable: on a case-insensitive disk it opens spirit/app/desk/relay-state/new.json'; }, test.limit.quick);
test.run('fileServable refuses, in another case: Spirit/App/Desk/Relay-State/New.json (a file under an old relay-state, at depth)', 0.8, function () { return (ask('fileServable', 'Spirit/App/Desk/Relay-State/New.json') === false) ? true : 'Spirit/App/Desk/Relay-State/New.json (a file under an old relay-state, at depth, another case) is servable: on a case-insensitive disk it opens spirit/app/desk/relay-state/new.json'; }, test.limit.quick);
test.run('fileServable refuses, as written: spirit/server.js (a server script)', 0.8, function () { return (ask('fileServable', 'spirit/server.js') === false) ? true : 'spirit/server.js (a server script) is servable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileServable refuses, in another case: SPIRIT/SERVER.JS (a server script)', 0.8, function () { return (ask('fileServable', 'SPIRIT/SERVER.JS') === false) ? true : 'SPIRIT/SERVER.JS (a server script, another case) is servable: on a case-insensitive disk it opens spirit/server.js'; }, test.limit.quick);
test.run('fileServable refuses, in another case: Spirit/Server.js (a server script)', 0.8, function () { return (ask('fileServable', 'Spirit/Server.js') === false) ? true : 'Spirit/Server.js (a server script, another case) is servable: on a case-insensitive disk it opens spirit/server.js'; }, test.limit.quick);
test.run('fileServable refuses, as written: spirit/DEBUG/garbageArguments.js (the DEBUG folder)', 0.8, function () { return (ask('fileServable', 'spirit/DEBUG/garbageArguments.js') === false) ? true : 'spirit/DEBUG/garbageArguments.js (the DEBUG folder) is servable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileServable refuses, in another case: SPIRIT/DEBUG/GARBAGEARGUMENTS.JS (the DEBUG folder)', 0.8, function () { return (ask('fileServable', 'SPIRIT/DEBUG/GARBAGEARGUMENTS.JS') === false) ? true : 'SPIRIT/DEBUG/GARBAGEARGUMENTS.JS (the DEBUG folder, another case) is servable: on a case-insensitive disk it opens spirit/DEBUG/garbageArguments.js'; }, test.limit.quick);
test.run('fileServable refuses, in another case: Spirit/DEBUG/GarbageArguments.js (the DEBUG folder)', 0.8, function () { return (ask('fileServable', 'Spirit/DEBUG/GarbageArguments.js') === false) ? true : 'Spirit/DEBUG/GarbageArguments.js (the DEBUG folder, another case) is servable: on a case-insensitive disk it opens spirit/DEBUG/garbageArguments.js'; }, test.limit.quick);
test.run('fileServable refuses, as written: spirit/app/desk/element/desk/desk.js.sidecar.json (a sidecar\'s own path)', 0.8, function () { return (ask('fileServable', 'spirit/app/desk/element/desk/desk.js.sidecar.json') === false) ? true : 'spirit/app/desk/element/desk/desk.js.sidecar.json (a sidecar\'s own path) is servable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileServable refuses, in another case: SPIRIT/APP/DESK/ELEMENT/DESK/DESK.JS.SIDECAR.JSON (a sidecar\'s own path)', 0.8, function () { return (ask('fileServable', 'SPIRIT/APP/DESK/ELEMENT/DESK/DESK.JS.SIDECAR.JSON') === false) ? true : 'SPIRIT/APP/DESK/ELEMENT/DESK/DESK.JS.SIDECAR.JSON (a sidecar\'s own path, another case) is servable: on a case-insensitive disk it opens spirit/app/desk/element/desk/desk.js.sidecar.json'; }, test.limit.quick);
test.run('fileServable refuses, in another case: Spirit/App/Desk/Element/Desk/Desk.js.sidecar.json (a sidecar\'s own path)', 0.8, function () { return (ask('fileServable', 'Spirit/App/Desk/Element/Desk/Desk.js.sidecar.json') === false) ? true : 'Spirit/App/Desk/Element/Desk/Desk.js.sidecar.json (a sidecar\'s own path, another case) is servable: on a case-insensitive disk it opens spirit/app/desk/element/desk/desk.js.sidecar.json'; }, test.limit.quick);

// fileWritable: what it refuses, it refuses in every case.
const CLOSED_WRITE = [
  ['spirit/state/identity.json', 'the node\'s private key'],
  ['spirit/state/new.json', 'anything under relay-state'],
  ['spirit/server.js', 'a core file'],
  ['spirit/element/icon.js', 'a core file under spirit/element'],
  ['spirit/app/desk/element/desk/desk.js.sidecar.json', 'a sidecar\'s own path'],
];
// Each path written out, as it stands and in its other cases, so that each check has a plain title of its own.
test.run('fileWritable refuses, as written: spirit/state/identity.json (the node\'s private key)', 0.8, function () { return (ask('fileWritable', 'spirit/state/identity.json') === false) ? true : 'spirit/state/identity.json (the node\'s private key) is writable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileWritable refuses, in another case: SPIRIT/STATE/IDENTITY.JSON (the node\'s private key)', 0.8, function () { return (ask('fileWritable', 'SPIRIT/STATE/IDENTITY.JSON') === false) ? true : 'SPIRIT/STATE/IDENTITY.JSON (the node\'s private key, another case) is writable: on a case-insensitive disk it writes spirit/state/identity.json'; }, test.limit.quick);
test.run('fileWritable refuses, in another case: Spirit/State/Identity.json (the node\'s private key)', 0.8, function () { return (ask('fileWritable', 'Spirit/State/Identity.json') === false) ? true : 'Spirit/State/Identity.json (the node\'s private key, another case) is writable: on a case-insensitive disk it writes spirit/state/identity.json'; }, test.limit.quick);
test.run('fileWritable refuses, as written: spirit/state/new.json (anything under relay-state)', 0.8, function () { return (ask('fileWritable', 'spirit/state/new.json') === false) ? true : 'spirit/state/new.json (anything under relay-state) is writable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileWritable refuses, in another case: SPIRIT/STATE/NEW.JSON (anything under relay-state)', 0.8, function () { return (ask('fileWritable', 'SPIRIT/STATE/NEW.JSON') === false) ? true : 'SPIRIT/STATE/NEW.JSON (anything under relay-state, another case) is writable: on a case-insensitive disk it writes spirit/state/new.json'; }, test.limit.quick);
test.run('fileWritable refuses, in another case: Spirit/State/New.json (anything under relay-state)', 0.8, function () { return (ask('fileWritable', 'Spirit/State/New.json') === false) ? true : 'Spirit/State/New.json (anything under relay-state, another case) is writable: on a case-insensitive disk it writes spirit/state/new.json'; }, test.limit.quick);
test.run('fileWritable refuses, as written: spirit/server.js (a core file)', 0.8, function () { return (ask('fileWritable', 'spirit/server.js') === false) ? true : 'spirit/server.js (a core file) is writable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileWritable refuses, in another case: SPIRIT/SERVER.JS (a core file)', 0.8, function () { return (ask('fileWritable', 'SPIRIT/SERVER.JS') === false) ? true : 'SPIRIT/SERVER.JS (a core file, another case) is writable: on a case-insensitive disk it writes spirit/server.js'; }, test.limit.quick);
test.run('fileWritable refuses, in another case: Spirit/Server.js (a core file)', 0.8, function () { return (ask('fileWritable', 'Spirit/Server.js') === false) ? true : 'Spirit/Server.js (a core file, another case) is writable: on a case-insensitive disk it writes spirit/server.js'; }, test.limit.quick);
test.run('fileWritable refuses, as written: spirit/element/icon.js (a core file under spirit/element)', 0.8, function () { return (ask('fileWritable', 'spirit/element/icon.js') === false) ? true : 'spirit/element/icon.js (a core file under spirit/element) is writable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileWritable refuses, in another case: SPIRIT/ELEMENT/ICON.JS (a core file under spirit/element)', 0.8, function () { return (ask('fileWritable', 'SPIRIT/ELEMENT/ICON.JS') === false) ? true : 'SPIRIT/ELEMENT/ICON.JS (a core file under spirit/element, another case) is writable: on a case-insensitive disk it writes spirit/element/icon.js'; }, test.limit.quick);
test.run('fileWritable refuses, in another case: Spirit/Element/Icon.js (a core file under spirit/element)', 0.8, function () { return (ask('fileWritable', 'Spirit/Element/Icon.js') === false) ? true : 'Spirit/Element/Icon.js (a core file under spirit/element, another case) is writable: on a case-insensitive disk it writes spirit/element/icon.js'; }, test.limit.quick);
test.run('fileWritable refuses, as written: spirit/app/desk/element/desk/desk.js.sidecar.json (a sidecar\'s own path)', 0.8, function () { return (ask('fileWritable', 'spirit/app/desk/element/desk/desk.js.sidecar.json') === false) ? true : 'spirit/app/desk/element/desk/desk.js.sidecar.json (a sidecar\'s own path) is writable as written: the case below judges nothing'; }, test.limit.quick);
test.run('fileWritable refuses, in another case: SPIRIT/APP/DESK/ELEMENT/DESK/DESK.JS.SIDECAR.JSON (a sidecar\'s own path)', 0.8, function () { return (ask('fileWritable', 'SPIRIT/APP/DESK/ELEMENT/DESK/DESK.JS.SIDECAR.JSON') === false) ? true : 'SPIRIT/APP/DESK/ELEMENT/DESK/DESK.JS.SIDECAR.JSON (a sidecar\'s own path, another case) is writable: on a case-insensitive disk it writes spirit/app/desk/element/desk/desk.js.sidecar.json'; }, test.limit.quick);
test.run('fileWritable refuses, in another case: Spirit/App/Desk/Element/Desk/Desk.js.sidecar.json (a sidecar\'s own path)', 0.8, function () { return (ask('fileWritable', 'Spirit/App/Desk/Element/Desk/Desk.js.sidecar.json') === false) ? true : 'Spirit/App/Desk/Element/Desk/Desk.js.sidecar.json (a sidecar\'s own path, another case) is writable: on a case-insensitive disk it writes spirit/app/desk/element/desk/desk.js.sidecar.json'; }, test.limit.quick);

// WINDOWS SPELLINGS OF ONE FILE (goal/G41.30, the review: "Three Windows spellings still pass both checks: 8.3 short names
// like RELAY-~1/IDENTI~1.JSO, which can reach the private key wherever short names are on; folder names ending in a
// dot or space; and ::$DATA. The fix is to refuse any path segment with ~ plus a digit, a :, or a trailing dot or
// space."). Windows opens the same file under each; so each is refused by both gates.
// Windows spellings of a closed path are refused, for reading and for writing.
// Each spelling written out, so that each check has a plain title of its own.
test.run('not servable: "RELAY-~1/IDENTI~1.JSO" (an 8.3 short name of spirit/state/identity.json)', 0.8, function () { return (ask('fileServable', 'RELAY-~1/IDENTI~1.JSO') === false) ? true : '"RELAY-~1/IDENTI~1.JSO" (an 8.3 short name of spirit/state/identity.json) is servable: on Windows it opens the closed file'; }, test.limit.quick);
test.run('not writable: "RELAY-~1/IDENTI~1.JSO" (an 8.3 short name of spirit/state/identity.json)', 0.8, function () { return (ask('fileWritable', 'RELAY-~1/IDENTI~1.JSO') === false) ? true : '"RELAY-~1/IDENTI~1.JSO" (an 8.3 short name of spirit/state/identity.json) is writable: on Windows it writes the closed file'; }, test.limit.quick);
test.run('not servable: "SPIRIT~1/SERVER~1.JS" (an 8.3 short name of spirit/server.js)', 0.8, function () { return (ask('fileServable', 'SPIRIT~1/SERVER~1.JS') === false) ? true : '"SPIRIT~1/SERVER~1.JS" (an 8.3 short name of spirit/server.js) is servable: on Windows it opens the closed file'; }, test.limit.quick);
test.run('not writable: "SPIRIT~1/SERVER~1.JS" (an 8.3 short name of spirit/server.js)', 0.8, function () { return (ask('fileWritable', 'SPIRIT~1/SERVER~1.JS') === false) ? true : '"SPIRIT~1/SERVER~1.JS" (an 8.3 short name of spirit/server.js) is writable: on Windows it writes the closed file'; }, test.limit.quick);
test.run('not servable: "relay-state./identity.json" (a folder name ending in a dot)', 0.8, function () { return (ask('fileServable', 'relay-state./identity.json') === false) ? true : '"relay-state./identity.json" (a folder name ending in a dot) is servable: on Windows it opens the closed file'; }, test.limit.quick);
test.run('not writable: "relay-state./identity.json" (a folder name ending in a dot)', 0.8, function () { return (ask('fileWritable', 'relay-state./identity.json') === false) ? true : '"relay-state./identity.json" (a folder name ending in a dot) is writable: on Windows it writes the closed file'; }, test.limit.quick);
test.run('not servable: "relay-state /new.json" (a folder name ending in a space)', 0.8, function () { return (ask('fileServable', 'relay-state /new.json') === false) ? true : '"relay-state /new.json" (a folder name ending in a space) is servable: on Windows it opens the closed file'; }, test.limit.quick);
test.run('not writable: "relay-state /new.json" (a folder name ending in a space)', 0.8, function () { return (ask('fileWritable', 'relay-state /new.json') === false) ? true : '"relay-state /new.json" (a folder name ending in a space) is writable: on Windows it writes the closed file'; }, test.limit.quick);
test.run('not servable: "spirit./server.js" (a core folder ending in a dot)', 0.8, function () { return (ask('fileServable', 'spirit./server.js') === false) ? true : '"spirit./server.js" (a core folder ending in a dot) is servable: on Windows it opens the closed file'; }, test.limit.quick);
test.run('not writable: "spirit./server.js" (a core folder ending in a dot)', 0.8, function () { return (ask('fileWritable', 'spirit./server.js') === false) ? true : '"spirit./server.js" (a core folder ending in a dot) is writable: on Windows it writes the closed file'; }, test.limit.quick);
test.run('not servable: "spirit/server.js." (a file name ending in a dot)', 0.8, function () { return (ask('fileServable', 'spirit/server.js.') === false) ? true : '"spirit/server.js." (a file name ending in a dot) is servable: on Windows it opens the closed file'; }, test.limit.quick);
test.run('not writable: "spirit/server.js." (a file name ending in a dot)', 0.8, function () { return (ask('fileWritable', 'spirit/server.js.') === false) ? true : '"spirit/server.js." (a file name ending in a dot) is writable: on Windows it writes the closed file'; }, test.limit.quick);
test.run('not servable: "spirit/element/icon.js " (a file name ending in a space)', 0.8, function () { return (ask('fileServable', 'spirit/element/icon.js ') === false) ? true : '"spirit/element/icon.js " (a file name ending in a space) is servable: on Windows it opens the closed file'; }, test.limit.quick);
test.run('not writable: "spirit/element/icon.js " (a file name ending in a space)', 0.8, function () { return (ask('fileWritable', 'spirit/element/icon.js ') === false) ? true : '"spirit/element/icon.js " (a file name ending in a space) is writable: on Windows it writes the closed file'; }, test.limit.quick);
test.run('not servable: "spirit/server.js::$DATA" (the file\'s data stream, ::$DATA)', 0.8, function () { return (ask('fileServable', 'spirit/server.js::$DATA') === false) ? true : '"spirit/server.js::$DATA" (the file\'s data stream, ::$DATA) is servable: on Windows it opens the closed file'; }, test.limit.quick);
test.run('not writable: "spirit/server.js::$DATA" (the file\'s data stream, ::$DATA)', 0.8, function () { return (ask('fileWritable', 'spirit/server.js::$DATA') === false) ? true : '"spirit/server.js::$DATA" (the file\'s data stream, ::$DATA) is writable: on Windows it writes the closed file'; }, test.limit.quick);
test.run('not servable: "spirit/state/identity.json:secret" (a named stream, a : in the name)', 0.8, function () { return (ask('fileServable', 'spirit/state/identity.json:secret') === false) ? true : '"spirit/state/identity.json:secret" (a named stream, a : in the name) is servable: on Windows it opens the closed file'; }, test.limit.quick);
test.run('not writable: "spirit/state/identity.json:secret" (a named stream, a : in the name)', 0.8, function () { return (ask('fileWritable', 'spirit/state/identity.json:secret') === false) ? true : '"spirit/state/identity.json:secret" (a named stream, a : in the name) is writable: on Windows it writes the closed file'; }, test.limit.quick);

// What is open stays open.
test.run('fileServable keeps index.html open', 0.2, function () { return (ask('fileServable', 'index.html') === true) ? true : 'fileServable closed index.html: the fix went too wide'; }, test.limit.quick);
test.run('fileServable keeps spirit/element/icon.js open', 0.2, function () { return (ask('fileServable', 'spirit/element/icon.js') === true) ? true : 'fileServable closed spirit/element/icon.js: the fix went too wide'; }, test.limit.quick);

// THE NOPREFERENCES PART, once fileSystem-noPreferences.js.
// Once spirit/run/spirit/test/fileSystem-noPreferences.js.
// THE NODE WRITES NO preferences.json (goal/G43.17; spec: ./fileSystem.md). Andy: "i want to remove that
// information and all the code that references it, gone.", "go do it!". spirit/fileSystem.js held preferences.json as the
// node's one writable root file (WRITABLE_ROOT_FILES) until 7bfb9514, so what the node writes is judged beside it
// (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING BELONG"; moved from
// spirit/test/nodeSettings-noPreferences.js). A real node on a scratch copy of the tracked files. Neither Andy's node nor
// an agent's is touched.
// fileSystem-noPreferences: the node writes no preferences.json (goal/G43.17).
// Andy: "i want to remove that information and all the code that references it, gone."
const fs = require('fs');
const { scratchNode } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const P = {};
test.run('the world: a scratch node comes up', 0.2, async function () {
  P.N = await scratchNode();
  return P.N.up ? true : 'the scratch node did not come up: nothing judged';
}, test.limit.slow);
test.after(function () {
  const N = P.N || {};
  try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
  try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
test.run('and the node writes no preferences.json', 0.2, function () {
  if (!P.N || !P.N.up || !P.N.root) return 'no scratch node: the world failed';
  return !fs.existsSync(path.join(P.N.root, 'spirit', 'run', 'preferences.json')) ? true : 'the scratch node holds a preferences.json';
}, test.limit.quick);

// THE VENDOREDFOLDERS PART, once fileSystem-vendoredFolders.js.
// Once spirit/run/spirit/test/fileSystem-vendoredFolders.js.
// ONE LIST OF VENDORED FOLDERS, IN fileSystem.js (goal/G43.25; spec: ./fileSystem.md). Andy: "can we hide those
// suckers in spirit/jobs/ for now? without the damn node_modules container?". fileSystem.js keeps the one list of vendored
// folders that every walker reads; the node's file scan lists nothing of them; vendor code is servable, never writable. The
// move of chokidar and readdirp itself is ./job.js, its vendoredLibraries part. The tree read as it is. No node, no port.
// fileSystem-vendoredFolders: one list of vendored folders, in fileSystem.js, read by every walker (goal/G43.25).
// 6. one list of vendored folders, in fileSystem.js, read by every walker.
const { execSync } = require('child_process');
const REPO = path.resolve(RUN, '..', '..');
// The tree before the move: the commit the red was written on, which holds spirit/run/node_modules/.
const BASE = '2fb29140';
const OLD = 'spirit/run/node_modules/';
const VENDORED = ['spirit/job/chokidar', 'spirit/job/readdirp', 'spirit/element/codeMirror'];
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function git(args) { return execSync('git ' + args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
function trim(p) { return String(p).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '').replace(/\/+$/, ''); }
const fsm = FS;
const V = { listName: '', scanned: [] };
test.run('it exports the vendored folders, spirit/job/chokidar, spirit/job/readdirp and spirit/element/codeMirror, as one list', 0.2, function () {
  V.listName = Object.keys(fsm).filter(function (k) {
    const v = fsm[k];
    const arr = Array.isArray(v) ? v : (v instanceof Set ? Array.from(v) : null);
    return arr && arr.length === VENDORED.length && arr.every(function (x) { return typeof x === 'string'; }) &&
      JSON.stringify(arr.map(trim).sort()) === JSON.stringify(VENDORED.slice().sort());
  })[0] || '';
  return V.listName ? true : 'fileSystem.js exports no list of exactly ' + VENDORED.join(', ') + ' (it exports ' + short(Object.keys(fsm)) + ')';
}, test.limit.quick);
// Not listed in Files: the node's file scan, from spirit/run.
test.run('the world: the node\'s file scan lists spirit/job/api.js', 0.2, function () {
  V.scanned = typeof fsm.scanFolder === 'function' ? fsm.scanFolder(RUN, []).map(function (e) { return path.relative(RUN, path.join(e.parentPath, e.name)).split(path.sep).join('/'); }) : [];
  return V.scanned.indexOf('spirit/job/api.js') !== -1 ? true : 'the scan lists ' + V.scanned.length + ' entries, no spirit/job/api.js: nothing judged';
}, test.limit.quick);
const scanOf = function (v) {
  const inside = V.scanned.filter(function (s) { return s === v || s.indexOf(v + '/') === 0; });
  const there = fs.existsSync(path.join(RUN, v));
  return (there && !inside.length) ? true : (there ? 'the file scan lists ' + inside.length + ' entries of ' + v + ', e.g. ' + short(inside.slice(0, 3)) : v + ' is not there to judge');
};
test.run('the file scan lists nothing of spirit/job/chokidar', 0.2, function () { return scanOf('spirit/job/chokidar'); }, test.limit.quick);
test.run('the file scan lists nothing of spirit/job/readdirp', 0.2, function () { return scanOf('spirit/job/readdirp'); }, test.limit.quick);
test.run('the file scan lists nothing of spirit/element/codeMirror', 0.2, function () { return scanOf('spirit/element/codeMirror'); }, test.limit.quick);
// Served, never written. Andy, Q1 (the page loads CodeMirror from spirit/element/codeMirror/): "servable but not writeable."
const servedOnly = function (f) {
  const there = fs.existsSync(path.join(RUN, f));
  return (there && fsm.fileServable(f) && !fsm.fileWritable(f)) ? true : (there ? f + ': servable ' + fsm.fileServable(f) + ', writable ' + fsm.fileWritable(f) : f + ' is not there to judge');
};
test.run('spirit/job/chokidar/index.js is servable but not writable', 0.8, function () { return servedOnly('spirit/job/chokidar/index.js'); }, test.limit.quick);
test.run('spirit/job/readdirp/index.js is servable but not writable', 0.8, function () { return servedOnly('spirit/job/readdirp/index.js'); }, test.limit.quick);
test.run('spirit/element/codeMirror/lib/codemirror.js is servable but not writable', 0.8, function () { return servedOnly('spirit/element/codeMirror/lib/codemirror.js'); }, test.limit.quick);
// The walkers: every tracked script that skipped node_modules at BASE, and the ones that skipped codeMirror beside it.
// The old system's walkers under spirit/test/ went with it (e9c6cb8c, "KILL!"): what is left in the tree is judged, 16 today.
test.run('the world: more than ten walkers skipped node_modules at the base commit, fileSystem.js and word.js among them', 0.2, function () {
  const atBase = git('ls-tree -r --name-only ' + BASE).split('\n').filter(function (f) { return /\.js$/.test(f) && f.indexOf(OLD) !== 0; });
  const grepped = git('grep -l -e node_modules ' + BASE + ' -- "*.js"').split('\n').filter(Boolean).map(function (l) { return l.replace(BASE + ':', ''); });
  const walkers = grepped.filter(function (f) {
    if (atBase.indexOf(f) === -1 || f === 'spirit/test/fsWatcherCommands.js' || !fs.existsSync(path.join(REPO, f))) return false;
    return /node_modules/.test(code(execSync('git show ' + BASE + ':' + f, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })).replace(/shell\\?\/node_modules/g, ''));
  });
  return (walkers.length > 10 && walkers.indexOf('spirit/run/spirit/fileSystem.js') !== -1 && walkers.indexOf('spirit/run/spirit/word.js') !== -1) ? true : 'only ' + walkers.length + ' walkers found at ' + BASE + ': nothing judged';
}, test.limit.quick);
const CM_SKIPPERS = ['spirit/run/spirit/test/testModule.js', 'spirit/run/spirit/test/spirit-sibling-generalRules.js', 'spirit/run/spirit/test/spirit-sibling-testReachRules.js', 'spirit/run/spirit/test/test/testReport-verifier.js'];
// Each walker found at the base commit written out, so that each check has a plain title of its own.
const walks = function (f) {
  const c = code(fs.readFileSync(path.join(REPO, f), 'utf8'));
  const own = /node_modules/.test(c.replace(/shell\\?\/node_modules/g, '')) ? 'node_modules' : (CM_SKIPPERS.indexOf(f) !== -1 && /codeMirror|codemirror/.test(c) ? 'codeMirror' : '');
  const reads = !!V.listName && new RegExp('\\b' + V.listName + '\\b').test(c) && (f === 'spirit/run/spirit/fileSystem.js' || /fileSystem/.test(c));
  return (!own && reads) ? true : f + ': ' + (own ? 'still skips ' + own + ' itself' : '') + (own && !reads ? ', and ' : '') + (!reads ? 'does not read fileSystem.js\'s list' : '');
};
test.run('spirit/run/spirit/element/test/codeMirror.js: reads VENDORED_FOLDERS, no skip of its own', 0.2, function () { return walks('spirit/run/spirit/element/test/codeMirror.js'); }, test.limit.quick);
test.run('spirit/run/spirit/element/test/fstat.js: reads VENDORED_FOLDERS, no skip of its own', 0.2, function () { return walks('spirit/run/spirit/element/test/fstat.js'); }, test.limit.quick);
test.run('spirit/run/spirit/element/test/panel.js: reads VENDORED_FOLDERS, no skip of its own', 0.2, function () { return walks('spirit/run/spirit/element/test/panel.js'); }, test.limit.quick);
test.run('spirit/run/spirit/fileSystem.js: reads VENDORED_FOLDERS, no skip of its own', 0.2, function () { return walks('spirit/run/spirit/fileSystem.js'); }, test.limit.quick);
test.run('spirit/run/spirit/test/appServer.js: reads VENDORED_FOLDERS, no skip of its own', 0.2, function () { return walks('spirit/run/spirit/test/appServer.js'); }, test.limit.quick);
test.run('spirit/run/spirit/test/word.js: reads VENDORED_FOLDERS, no skip of its own', 0.2, function () { return walks('spirit/run/spirit/test/word.js'); }, test.limit.quick);
test.run('spirit/run/spirit/word.js: reads VENDORED_FOLDERS, no skip of its own', 0.2, function () { return walks('spirit/run/spirit/word.js'); }, test.limit.quick);
test.run('spirit/test/tools/inspect.js: reads VENDORED_FOLDERS, no skip of its own', 0.2, function () { return walks('spirit/test/tools/inspect.js'); }, test.limit.quick);
test.run('spirit/test/tools/wirePaths.js: reads VENDORED_FOLDERS, no skip of its own', 0.2, function () { return walks('spirit/test/tools/wirePaths.js'); }, test.limit.quick);
