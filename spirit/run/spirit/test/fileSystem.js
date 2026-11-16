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

function ask(fn, p) { try { return FS[fn](p); } catch (e) { return null; } }

// Each closed path, as the gate refuses it today, and the same path in other cases.
const CLOSED_READ = [
  ['spirit/state/identity.json', 'the node\'s private key'],
  ['spirit/app/desk/spirit/state/identity.json', 'an app server\'s private key, at depth'],
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
test.run('fileServable refuses spirit/state/identity.json, the node\'s private key, as written', 0.8, function () { return (ask('fileServable', 'spirit/state/identity.json') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses SPIRIT/STATE/IDENTITY.JSON, the node\'s private key in another letter case', 0.8, function () { return (ask('fileServable', 'SPIRIT/STATE/IDENTITY.JSON') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses Spirit/State/Identity.json, the node\'s private key in another letter case', 0.8, function () { return (ask('fileServable', 'Spirit/State/Identity.json') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses spirit/app/desk/spirit/state/identity.json, an app server\'s private key deep in the tree, as written', 0.8, function () { return (ask('fileServable', 'spirit/app/desk/spirit/state/identity.json') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses SPIRIT/APP/DESK/SPIRIT/STATE/IDENTITY.JSON, an app server\'s private key deep in the tree in another letter case', 0.8, function () { return (ask('fileServable', 'SPIRIT/APP/DESK/SPIRIT/STATE/IDENTITY.JSON') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses Spirit/App/Desk/Spirit/State/Identity.json, an app server\'s private key deep in the tree in another letter case', 0.8, function () { return (ask('fileServable', 'Spirit/App/Desk/Spirit/State/Identity.json') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses spirit/server.js, a server script, as written', 0.8, function () { return (ask('fileServable', 'spirit/server.js') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses SPIRIT/SERVER.JS, a server script in another letter case', 0.8, function () { return (ask('fileServable', 'SPIRIT/SERVER.JS') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses Spirit/Server.js, a server script in another letter case', 0.8, function () { return (ask('fileServable', 'Spirit/Server.js') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses spirit/DEBUG/garbageArguments.js, in the DEBUG folder, as written', 0.8, function () { return (ask('fileServable', 'spirit/DEBUG/garbageArguments.js') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses SPIRIT/DEBUG/GARBAGEARGUMENTS.JS, in the DEBUG folder in another letter case', 0.8, function () { return (ask('fileServable', 'SPIRIT/DEBUG/GARBAGEARGUMENTS.JS') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses Spirit/DEBUG/GarbageArguments.js, in the DEBUG folder in another letter case', 0.8, function () { return (ask('fileServable', 'Spirit/DEBUG/GarbageArguments.js') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses spirit/app/desk/element/desk/desk.js.sidecar.json, a sidecar\'s own path, as written', 0.8, function () { return (ask('fileServable', 'spirit/app/desk/element/desk/desk.js.sidecar.json') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses SPIRIT/APP/DESK/ELEMENT/DESK/DESK.JS.SIDECAR.JSON, a sidecar\'s own path in another letter case', 0.8, function () { return (ask('fileServable', 'SPIRIT/APP/DESK/ELEMENT/DESK/DESK.JS.SIDECAR.JSON') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses Spirit/App/Desk/Element/Desk/Desk.js.sidecar.json, a sidecar\'s own path in another letter case', 0.8, function () { return (ask('fileServable', 'Spirit/App/Desk/Element/Desk/Desk.js.sidecar.json') === false) ? true : false; }, test.limit.quick);

// fileWritable: what it refuses, it refuses in every case.
const CLOSED_WRITE = [
  ['spirit/state/identity.json', 'the node\'s private key'],
  ['spirit/state/new.json', 'anything under spirit/state'],
  ['spirit/server.js', 'a core file'],
  ['spirit/element/icon.js', 'a core file under spirit/element'],
  ['spirit/app/desk/element/desk/desk.js.sidecar.json', 'a sidecar\'s own path'],
];
// Each path written out, as it stands and in its other cases, so that each check has a plain title of its own.
test.run('fileWritable refuses spirit/state/identity.json, the node\'s private key, as written', 0.8, function () { return (ask('fileWritable', 'spirit/state/identity.json') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses SPIRIT/STATE/IDENTITY.JSON, the node\'s private key in another letter case', 0.8, function () { return (ask('fileWritable', 'SPIRIT/STATE/IDENTITY.JSON') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses Spirit/State/Identity.json, the node\'s private key in another letter case', 0.8, function () { return (ask('fileWritable', 'Spirit/State/Identity.json') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses spirit/state/new.json, as anything under spirit/state, as written', 0.8, function () { return (ask('fileWritable', 'spirit/state/new.json') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses SPIRIT/STATE/NEW.JSON, as anything under spirit/state, in another letter case', 0.8, function () { return (ask('fileWritable', 'SPIRIT/STATE/NEW.JSON') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses Spirit/State/New.json, as anything under spirit/state, in another letter case', 0.8, function () { return (ask('fileWritable', 'Spirit/State/New.json') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses spirit/server.js, a core file, as written', 0.8, function () { return (ask('fileWritable', 'spirit/server.js') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses SPIRIT/SERVER.JS, a core file in another letter case', 0.8, function () { return (ask('fileWritable', 'SPIRIT/SERVER.JS') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses Spirit/Server.js, a core file in another letter case', 0.8, function () { return (ask('fileWritable', 'Spirit/Server.js') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses spirit/element/icon.js, a core file under spirit/element, as written', 0.8, function () { return (ask('fileWritable', 'spirit/element/icon.js') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses SPIRIT/ELEMENT/ICON.JS, a core file under spirit/element in another letter case', 0.8, function () { return (ask('fileWritable', 'SPIRIT/ELEMENT/ICON.JS') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses Spirit/Element/Icon.js, a core file under spirit/element in another letter case', 0.8, function () { return (ask('fileWritable', 'Spirit/Element/Icon.js') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses spirit/app/desk/element/desk/desk.js.sidecar.json, a sidecar\'s own path, as written', 0.8, function () { return (ask('fileWritable', 'spirit/app/desk/element/desk/desk.js.sidecar.json') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses SPIRIT/APP/DESK/ELEMENT/DESK/DESK.JS.SIDECAR.JSON, a sidecar\'s own path in another letter case', 0.8, function () { return (ask('fileWritable', 'SPIRIT/APP/DESK/ELEMENT/DESK/DESK.JS.SIDECAR.JSON') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses Spirit/App/Desk/Element/Desk/Desk.js.sidecar.json, a sidecar\'s own path in another letter case', 0.8, function () { return (ask('fileWritable', 'Spirit/App/Desk/Element/Desk/Desk.js.sidecar.json') === false) ? true : false; }, test.limit.quick);

// WINDOWS SPELLINGS OF ONE FILE (goal/G41.30, the review: "Three Windows spellings still pass both checks: 8.3 short names
// like RELAY-~1/IDENTI~1.JSO, which can reach the private key wherever short names are on; folder names ending in a
// dot or space; and ::$DATA. The fix is to refuse any path segment with ~ plus a digit, a :, or a trailing dot or
// space."). Windows opens the same file under each; so each is refused by both gates.
// Windows spellings of a closed path are refused, for reading and for writing.
// Each spelling written out, so that each check has a plain title of its own.
test.run('fileServable refuses "RELAY-~1/IDENTI~1.JSO", an 8.3 short name of spirit/state/identity.json', 0.8, function () { return (ask('fileServable', 'RELAY-~1/IDENTI~1.JSO') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses "RELAY-~1/IDENTI~1.JSO", an 8.3 short name of spirit/state/identity.json', 0.8, function () { return (ask('fileWritable', 'RELAY-~1/IDENTI~1.JSO') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses "SPIRIT~1/SERVER~1.JS", an 8.3 short name of spirit/server.js', 0.8, function () { return (ask('fileServable', 'SPIRIT~1/SERVER~1.JS') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses "SPIRIT~1/SERVER~1.JS", an 8.3 short name of spirit/server.js', 0.8, function () { return (ask('fileWritable', 'SPIRIT~1/SERVER~1.JS') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses "relay-state./identity.json", a folder name ending in a dot', 0.8, function () { return (ask('fileServable', 'relay-state./identity.json') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses "relay-state./identity.json", a folder name ending in a dot', 0.8, function () { return (ask('fileWritable', 'relay-state./identity.json') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses "relay-state /new.json", a folder name ending in a space', 0.8, function () { return (ask('fileServable', 'relay-state /new.json') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses "relay-state /new.json", a folder name ending in a space', 0.8, function () { return (ask('fileWritable', 'relay-state /new.json') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses "spirit./server.js", a core folder ending in a dot', 0.8, function () { return (ask('fileServable', 'spirit./server.js') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses "spirit./server.js", a core folder ending in a dot', 0.8, function () { return (ask('fileWritable', 'spirit./server.js') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses "spirit/server.js.", a file name ending in a dot', 0.8, function () { return (ask('fileServable', 'spirit/server.js.') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses "spirit/server.js.", a file name ending in a dot', 0.8, function () { return (ask('fileWritable', 'spirit/server.js.') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses "spirit/element/icon.js ", a file name ending in a space', 0.8, function () { return (ask('fileServable', 'spirit/element/icon.js ') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses "spirit/element/icon.js ", a file name ending in a space', 0.8, function () { return (ask('fileWritable', 'spirit/element/icon.js ') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses "spirit/server.js::$DATA", the file\'s data stream', 0.8, function () { return (ask('fileServable', 'spirit/server.js::$DATA') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses "spirit/server.js::$DATA", the file\'s data stream', 0.8, function () { return (ask('fileWritable', 'spirit/server.js::$DATA') === false) ? true : false; }, test.limit.quick);
test.run('fileServable refuses "spirit/state/identity.json:secret", a named stream with a colon in the name', 0.8, function () { return (ask('fileServable', 'spirit/state/identity.json:secret') === false) ? true : false; }, test.limit.quick);
test.run('fileWritable refuses "spirit/state/identity.json:secret", a named stream with a colon in the name', 0.8, function () { return (ask('fileWritable', 'spirit/state/identity.json:secret') === false) ? true : false; }, test.limit.quick);

// What is open stays open.
test.run('fileServable keeps index.html open', 0.2, function () { return (ask('fileServable', 'index.html') === true) ? true : false; }, test.limit.quick);
test.run('fileServable keeps spirit/element/icon.js open', 0.2, function () { return (ask('fileServable', 'spirit/element/icon.js') === true) ? true : false; }, test.limit.quick);

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
test.run('a scratch node comes up', 0.2, async function () {
  P.N = await scratchNode();
  return P.N.up ? true : false;
}, test.limit.slow);
test.after(function () {
  const N = P.N || {};
  try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
  try { if (N.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(N); } catch (e) { /* scratch */ }
});
test.run('the node writes no preferences.json', 0.2, function () {
  if (!P.N || !P.N.up || !P.N.root) return false;
  return !fs.existsSync(path.join(P.N.root, 'spirit', 'run', 'preferences.json')) ? true : false;
}, test.limit.quick);

// THE VENDOREDFOLDERS PART, once fileSystem-vendoredFolders.js.
// Once spirit/run/spirit/test/fileSystem-vendoredFolders.js.
// ONE LIST OF VENDORED FOLDERS, IN fileSystem.js (goal/G43.25; spec: ./fileSystem.md). Andy: "can we hide those
// suckers in spirit/jobs/ for now? without the damn node_modules container?". fileSystem.js keeps the one list of vendored
// folders that every walker reads; the node's file scan lists nothing of them; vendor code is servable, never writable. The
// move of chokidar and readdirp itself is ./job.js, its vendoredLibraries part. The tree read as it is. No node, no port.
// fileSystem-vendoredFolders: one list of vendored folders, in fileSystem.js, read by every walker (goal/G43.25).
// 6. one list of vendored folders, in fileSystem.js, read by every walker.
const VENDORED = ['spirit/job/chokidar', 'spirit/job/readdirp', 'spirit/element/codeMirror'];
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
  return V.listName ? true : false;
}, test.limit.quick);
// Not listed in Files: the node's file scan, from spirit/run.
test.run('the node\'s file scan lists spirit/job/api.js', 0.2, function () {
  V.scanned = typeof fsm.scanFolder === 'function' ? fsm.scanFolder(RUN, []).map(function (e) { return path.relative(RUN, path.join(e.parentPath, e.name)).split(path.sep).join('/'); }) : [];
  return V.scanned.indexOf('spirit/job/api.js') !== -1 ? true : false;
}, test.limit.quick);
const scanOf = function (v) {
  const inside = V.scanned.filter(function (s) { return s === v || s.indexOf(v + '/') === 0; });
  const there = fs.existsSync(path.join(RUN, v));
  return (there && !inside.length) ? true : false;
};
test.run('the file scan lists nothing of spirit/job/chokidar', 0.2, function () { return scanOf('spirit/job/chokidar'); }, test.limit.quick);
test.run('the file scan lists nothing of spirit/job/readdirp', 0.2, function () { return scanOf('spirit/job/readdirp'); }, test.limit.quick);
test.run('the file scan lists nothing of spirit/element/codeMirror', 0.2, function () { return scanOf('spirit/element/codeMirror'); }, test.limit.quick);
// Served, never written. Andy, Q1 (the page loads CodeMirror from spirit/element/codeMirror/): "servable but not writeable."
const servedOnly = function (f) {
  const there = fs.existsSync(path.join(RUN, f));
  return (there && fsm.fileServable(f) && !fsm.fileWritable(f)) ? true : false;
};
test.run('spirit/job/chokidar/index.js is servable but not writable', 0.8, function () { return servedOnly('spirit/job/chokidar/index.js'); }, test.limit.quick);
test.run('spirit/job/readdirp/index.js is servable but not writable', 0.8, function () { return servedOnly('spirit/job/readdirp/index.js'); }, test.limit.quick);
test.run('spirit/element/codeMirror/lib/codemirror.js is servable but not writable', 0.8, function () { return servedOnly('spirit/element/codeMirror/lib/codemirror.js'); }, test.limit.quick);
// The walkers: that no code skips node_modules by its own name, every walker reading the one list above, is the general
// test's, spirit/test/spirit-sibling-general.js, over every file (goal/G47.1); once a list of the walkers at one old commit here.
