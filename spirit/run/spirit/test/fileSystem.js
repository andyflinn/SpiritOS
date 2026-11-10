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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function ask(fn, p) { try { return FS[fn](p); } catch (e) { return 'threw ' + (e && e.message); } }

test.startTest('fileSystem.js: its gates refuse a path in any case');

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

test.subHeading('fileServable: what it refuses, it refuses in every case');
CLOSED_READ.forEach(function (c) {
  ok(ask('fileServable', c[0]) === false, 'refused as written: ' + c[0] + ' (' + c[1] + ')', c[0] + ' (' + c[1] + ') is servable as written: the case below judges nothing');
  cases(c[0]).forEach(function (v) {
    ok(ask('fileServable', v) === false, 'refused: ' + v + ' (' + c[1] + ', another case)', v + ' (' + c[1] + ', another case) is servable: on a case-insensitive disk it opens ' + c[0]);
  });
});

test.subHeading('fileWritable: what it refuses, it refuses in every case');
const CLOSED_WRITE = [
  ['spirit/state/identity.json', 'the node\'s private key'],
  ['spirit/state/new.json', 'anything under relay-state'],
  ['spirit/server.js', 'a core file'],
  ['spirit/element/icon.js', 'a core file under spirit/element'],
  ['spirit/app/desk/element/desk/desk.js.sidecar.json', 'a sidecar\'s own path'],
];
CLOSED_WRITE.forEach(function (c) {
  ok(ask('fileWritable', c[0]) === false, 'refused as written: ' + c[0] + ' (' + c[1] + ')', c[0] + ' (' + c[1] + ') is writable as written: the case below judges nothing');
  cases(c[0]).forEach(function (v) {
    ok(ask('fileWritable', v) === false, 'refused: ' + v + ' (' + c[1] + ', another case)', v + ' (' + c[1] + ', another case) is writable: on a case-insensitive disk it writes ' + c[0]);
  });
});

// WINDOWS SPELLINGS OF ONE FILE (goal/G41.30, the review: "Three Windows spellings still pass both checks: 8.3 short names
// like RELAY-~1/IDENTI~1.JSO, which can reach the private key wherever short names are on; folder names ending in a
// dot or space; and ::$DATA. The fix is to refuse any path segment with ~ plus a digit, a :, or a trailing dot or
// space."). Windows opens the same file under each; so each is refused by both gates.
test.subHeading('Windows spellings of a closed path are refused, for reading and for writing');
[
  ['RELAY-~1/IDENTI~1.JSO', 'an 8.3 short name of spirit/state/identity.json'],
  ['SPIRIT~1/SERVER~1.JS', 'an 8.3 short name of spirit/server.js'],
  ['relay-state./identity.json', 'a folder name ending in a dot'],
  ['relay-state /new.json', 'a folder name ending in a space'],
  ['spirit./server.js', 'a core folder ending in a dot'],
  ['spirit/server.js.', 'a file name ending in a dot'],
  ['spirit/element/icon.js ', 'a file name ending in a space'],
  ['spirit/server.js::$DATA', 'the file\'s data stream, ::$DATA'],
  ['spirit/state/identity.json:secret', 'a named stream, a : in the name'],
].forEach(function (c) {
  ok(ask('fileServable', c[0]) === false, 'not servable: ' + JSON.stringify(c[0]) + ' (' + c[1] + ')', JSON.stringify(c[0]) + ' (' + c[1] + ') is servable: on Windows it opens the closed file');
  ok(ask('fileWritable', c[0]) === false, 'not writable: ' + JSON.stringify(c[0]) + ' (' + c[1] + ')', JSON.stringify(c[0]) + ' (' + c[1] + ') is writable: on Windows it writes the closed file');
});

test.subHeading('what is open stays open');
[['index.html', 'fileServable'], ['spirit/element/icon.js', 'fileServable']].forEach(function (c) {
  ok(ask(c[1], c[0]) === true, c[1] + ' keeps ' + c[0] + ' open', c[1] + ' closed ' + c[0] + ': the fix went too wide');
});

// THE NOPREFERENCES PART, once fileSystem-noPreferences.js.
async function noPreferencesPart() {
  // Once spirit/run/spirit/test/fileSystem-noPreferences.js.
  // THE NODE WRITES NO preferences.json (goal/G43.17; spec: ./fileSystem.md). Andy: "i want to remove that
  // information and all the code that references it, gone.", "go do it!". spirit/fileSystem.js held preferences.json as the
  // node's one writable root file (WRITABLE_ROOT_FILES) until 7bfb9514, so what the node writes is judged beside it
  // (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING BELONG"; moved from
  // spirit/test/nodeSettings-noPreferences.js). A real node on a scratch copy of the tracked files. Neither Andy's node nor
  // an agent's is touched.

  const fs = require('fs');
  const { scratchNode } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));


  test.subHeading('fileSystem-noPreferences: the node writes no preferences.json (goal/G43.17)');

  await (async function () {
    test.subHeading('Andy: "i want to remove that information and all the code that references it, gone."');
    const N = await scratchNode();
    try {
      ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
      if (!N.up) return;
      if (N.root) ok(!fs.existsSync(path.join(N.root, 'spirit', 'run', 'preferences.json')), 'and the node writes no preferences.json', 'the scratch node holds a preferences.json');
    } finally {
      try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
      try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}

// THE VENDOREDFOLDERS PART, once fileSystem-vendoredFolders.js.
function vendoredFoldersPart() {
  // Once spirit/run/spirit/test/fileSystem-vendoredFolders.js.
  // ONE LIST OF VENDORED FOLDERS, IN fileSystem.js (goal/G43.25; spec: ./fileSystem.md). Andy: "can we hide those
  // suckers in spirit/jobs/ for now? without the damn node_modules container?". fileSystem.js keeps the one list of vendored
  // folders that every walker reads; the node's file scan lists nothing of them; vendor code is servable, never writable. The
  // move of chokidar and readdirp itself is ./job.js, its vendoredLibraries part. The tree read as it is. No node, no port.

  const fs = require('fs');
  const { execSync, spawnSync } = require('child_process');
  const REPO = path.resolve(RUN, '..', '..');
  // The tree before the move: the commit the red was written on, which holds spirit/run/node_modules/.
  const BASE = '2fb29140';
  const OLD = 'spirit/run/node_modules/';
  const NEW = 'spirit/run/spirit/job/';
  const VENDORED = ['spirit/job/chokidar', 'spirit/job/readdirp', 'spirit/element/codeMirror'];
  const SELF = /spirit\/run\/spirit\/test\/fileSystem\.(js|md)$/;

  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
  function git(args) { return execSync('git ' + args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); }
  function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
  function trim(p) { return String(p).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '').replace(/\/+$/, ''); }

  test.subHeading('fileSystem-vendoredFolders: one list of vendored folders, in fileSystem.js, read by every walker (goal/G43.25)');

  test.subHeading('6. one list of vendored folders, in fileSystem.js, read by every walker');
  const fsPath = path.join(RUN, 'spirit', 'fileSystem.js');
  const fsm = require(fsPath);
  const listName = Object.keys(fsm).filter(function (k) {
    const v = fsm[k];
    const arr = Array.isArray(v) ? v : (v instanceof Set ? Array.from(v) : null);
    return arr && arr.length === VENDORED.length && arr.every(function (x) { return typeof x === 'string'; }) &&
      JSON.stringify(arr.map(trim).sort()) === JSON.stringify(VENDORED.slice().sort());
  })[0] || '';
  ok(!!listName, 'fileSystem.js exports the vendored folders, ' + listName + ': ' + VENDORED.join(', '), 'fileSystem.js exports no list of exactly ' + VENDORED.join(', ') + ' (it exports ' + short(Object.keys(fsm)) + ')');
  // Not listed in Files: the node's file scan, from spirit/run.
  const scanned = typeof fsm.scanFolder === 'function' ? fsm.scanFolder(RUN, []).map(function (e) { return path.relative(RUN, path.join(e.parentPath, e.name)).split(path.sep).join('/'); }) : [];
  ok(scanned.indexOf('spirit/job/api.js') !== -1, 'the world: the node\'s file scan lists ' + scanned.length + ' entries, spirit/job/api.js among them', 'the scan lists ' + scanned.length + ' entries, no spirit/job/api.js: nothing judged');
  VENDORED.forEach(function (v) {
    const inside = scanned.filter(function (s) { return s === v || s.indexOf(v + '/') === 0; });
    const there = fs.existsSync(path.join(RUN, v));
    ok(there && !inside.length, 'the file scan lists nothing of ' + v, there ? 'the file scan lists ' + inside.length + ' entries of ' + v + ', e.g. ' + short(inside.slice(0, 3)) : v + ' is not there to judge');
  });
  // Served, never written. Andy, Q1 (the page loads CodeMirror from spirit/element/codeMirror/): "servable but not writeable."
  ['spirit/job/chokidar/index.js', 'spirit/job/readdirp/index.js', 'spirit/element/codeMirror/lib/codemirror.js'].forEach(function (f) {
    const there = fs.existsSync(path.join(RUN, f));
    ok(there && fsm.fileServable(f) && !fsm.fileWritable(f), f + ' is servable but not writable',
      there ? f + ': servable ' + fsm.fileServable(f) + ', writable ' + fsm.fileWritable(f) : f + ' is not there to judge');
  });
  // The walkers: every tracked script that skipped node_modules at BASE, and the ones that skipped codeMirror beside it.
  const atBase = git('ls-tree -r --name-only ' + BASE).split('\n').filter(function (f) { return /\.js$/.test(f) && f.indexOf(OLD) !== 0; });
  const grepped = git('grep -l -e node_modules ' + BASE + ' -- "*.js"').split('\n').filter(Boolean).map(function (l) { return l.replace(BASE + ':', ''); });
  const walkers = grepped.filter(function (f) {
    if (atBase.indexOf(f) === -1 || f === 'spirit/test/fsWatcherCommands.js' || !fs.existsSync(path.join(REPO, f))) return false;
    return /node_modules/.test(code(execSync('git show ' + BASE + ':' + f, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })).replace(/shell\\?\/node_modules/g, ''));
  });
  // The old system's walkers under spirit/test/ went with it (e9c6cb8c, "KILL!"): what is left in the tree is judged, 16 today.
  ok(walkers.length > 10 && walkers.indexOf('spirit/run/spirit/fileSystem.js') !== -1 && walkers.indexOf('spirit/run/spirit/word.js') !== -1,
    'the world: ' + walkers.length + ' walkers skipped node_modules at ' + BASE + ', fileSystem.js and word.js among them', 'only ' + walkers.length + ' walkers found at ' + BASE + ': nothing judged');
  const CM_SKIPPERS = ['spirit/run/spirit/test/testModule.js', 'spirit/run/spirit/test/spirit-sibling-generalRules.js', 'spirit/run/spirit/test/spirit-sibling-testReachRules.js', 'spirit/run/spirit/test/test/testReport-verifier.js'];
  walkers.forEach(function (f) {
    const c = code(fs.readFileSync(path.join(REPO, f), 'utf8'));
    const own = /node_modules/.test(c.replace(/shell\\?\/node_modules/g, '')) ? 'node_modules' : (CM_SKIPPERS.indexOf(f) !== -1 && /codeMirror|codemirror/.test(c) ? 'codeMirror' : '');
    const reads = !!listName && new RegExp('\\b' + listName + '\\b').test(c) && (f === 'spirit/run/spirit/fileSystem.js' || /fileSystem/.test(c));
    ok(!own && reads, f + ': reads ' + (listName || 'the list') + ', no skip of its own', f + ': ' + (own ? 'still skips ' + own + ' itself' : '') + (own && !reads ? ', and ' : '') + (!reads ? 'does not read fileSystem.js\'s list' : ''));
  });
}

(async function () {
  for (const p of [['noPreferences', noPreferencesPart], ['vendoredFolders', vendoredFoldersPart]]) {
    try { await p[1](); } catch (e) { test.fail('the ' + p[0] + ' part threw ' + (e && e.stack || e)); }
  }
  test.reportSuccessFailureCount();
  process.exit(process.exitCode || 0);
}());
