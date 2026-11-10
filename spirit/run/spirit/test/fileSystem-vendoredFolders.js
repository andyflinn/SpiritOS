'use strict';

// spirit/run/spirit/test/fileSystem-vendoredFolders.js
// ONE LIST OF VENDORED FOLDERS, IN fileSystem.js (goal/G43.25; spec: ./fileSystem-vendoredFolders.md). Andy: "can we hide those
// suckers in spirit/jobs/ for now? without the damn node_modules container?". fileSystem.js keeps the one list of vendored
// folders that every walker reads; the node's file scan lists nothing of them; vendor code is servable, never writable. The
// move of chokidar and readdirp itself is ./jobs-vendoredLibraries.js. The tree read as it is. No node, no port.

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// The tree before the move: the commit the red was written on, which holds spirit/run/node_modules/.
const BASE = '2fb29140';
const OLD = 'spirit/run/node_modules/';
const NEW = 'spirit/run/spirit/jobs/';
const VENDORED = ['spirit/jobs/chokidar', 'spirit/jobs/readdirp', 'spirit/element/codeMirror'];
const SELF = /spirit\/run\/spirit\/test\/fileSystem-vendoredFolders\.(js|md)$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function git(args) { return execSync('git ' + args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
function trim(p) { return String(p).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '').replace(/\/+$/, ''); }

test.startTest('fileSystem-vendoredFolders.js: one list of vendored folders, in fileSystem.js, read by every walker (goal/G43.25)');

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
ok(scanned.indexOf('spirit/jobs/api.js') !== -1, 'the world: the node\'s file scan lists ' + scanned.length + ' entries, spirit/jobs/api.js among them', 'the scan lists ' + scanned.length + ' entries, no spirit/jobs/api.js: nothing judged');
VENDORED.forEach(function (v) {
  const inside = scanned.filter(function (s) { return s === v || s.indexOf(v + '/') === 0; });
  const there = fs.existsSync(path.join(RUN, v));
  ok(there && !inside.length, 'the file scan lists nothing of ' + v, there ? 'the file scan lists ' + inside.length + ' entries of ' + v + ', e.g. ' + short(inside.slice(0, 3)) : v + ' is not there to judge');
});
// Served, never written. Andy, Q1 (the page loads CodeMirror from spirit/element/codeMirror/): "servable but not writeable."
['spirit/jobs/chokidar/index.js', 'spirit/jobs/readdirp/index.js', 'spirit/element/codeMirror/lib/codemirror.js'].forEach(function (f) {
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
const CM_SKIPPERS = ['spirit/run/spirit/test/testModule.js', 'spirit/run/spirit/test/spirit-sibling-generalRules.js', 'spirit/run/spirit/test/spirit-sibling-testReachRules.js', 'spirit/run/spirit/test/data-caches.js', 'spirit/run/spirit/test/test/testReport-verifier.js'];
walkers.forEach(function (f) {
  const c = code(fs.readFileSync(path.join(REPO, f), 'utf8'));
  const own = /node_modules/.test(c.replace(/shell\\?\/node_modules/g, '')) ? 'node_modules' : (CM_SKIPPERS.indexOf(f) !== -1 && /codeMirror|codemirror/.test(c) ? 'codeMirror' : '');
  const reads = !!listName && new RegExp('\\b' + listName + '\\b').test(c) && (f === 'spirit/run/spirit/fileSystem.js' || /fileSystem/.test(c));
  ok(!own && reads, f + ': reads ' + (listName || 'the list') + ', no skip of its own', f + ': ' + (own ? 'still skips ' + own + ' itself' : '') + (own && !reads ? ', and ' : '') + (!reads ? 'does not read fileSystem.js\'s list' : ''));
});

test.reportSuccessFailureCount();
process.exit(0);
