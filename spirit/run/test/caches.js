'use strict';

// spirit/run/test/caches.js
// EVERY FAMILY'S CACHE, ONE CODE IN THE BROWSER AND IN NODE (goal/G41.28; spec: ./caches.md). Not a test of one module:
// of the api tree's families and the two places their caches run, a page and a server process that follows a stream
// (appServer). Andy, on G41.28: "WSL, make sure you assert that every family in the api tree HAS a clientCacheManager,
// AND the a node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only
// difference is the appServer serializes the cache to disk."
//
//   1. every family in the api tree, each its own check: a clientCacheManager.js beside its api.js;
//   2. one code: the browser and appServer load the same data set file and the same family file, and nothing else in
//      the tree keeps a family's cache: its branches are named by its clientCacheManager.js alone;
//   3. the same rows make the same cache: the desk's clientCacheManager.js and the data set, run in node as appServer
//      runs them and in a page's window as a page runs them, are fed the same rows and end with the same spirit.data;
//   4. the one difference is the disk: no clientCacheManager.js touches a file or the browser's storage, and appServer
//      writes the cache to disk.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);

test.startTest('caches: every family has a clientCacheManager, one code in the browser and in node');

// ── 1. EVERY FAMILY ─────────────────────────────────────────────────────────────────────────────────────────────────
// The api tree's families are their interfaces: process/js/<name>/family/api.js (spirit.familyPath) and the node's own,
// spirit/<name>/api.js (spirit.js, interfaceName). A test folder's api.js is a test, not a family.
test.subHeading('1. every family in the api tree has a clientCacheManager beside its api.js');
const families = tracked.filter(function (f) { return /^process\/js\/[^/]+\/family\/api\.js$/.test(f) || /^spirit\/[^/]+\/api\.js$/.test(f); });
test.comment(families.length + ' families: ' + families.map(function (f) { return f.split('/').slice(-3, -1).join('/'); }).join(', '));
ok(families.length > 0, 'the api tree has ' + families.length + ' families', 'no family found in the tree');
families.forEach(function (api) {
  const manager = path.posix.join(path.posix.dirname(api), 'clientCacheManager.js');
  const name = /^process\/js\/([^/]+)\//.exec(api) ? /^process\/js\/([^/]+)\//.exec(api)[1] : /^spirit\/([^/]+)\//.exec(api)[1];
  ok(tracked.indexOf(manager) !== -1, name + ': ' + manager + ' is there', name + ': no ' + manager + ' beside ' + api);
});

// ── 2. ONE CODE ─────────────────────────────────────────────────────────────────────────────────────────────────────
test.subHeading('2. the browser and node load the same files, and nothing else keeps a family\'s cache');
const spiritJs = code(path.join(RUN, 'spirit.js'));
const appServer = code(path.join(RUN, 'spirit', 'appServer.js'));
ok(/['"]shell\/shared\/js\/spiritData\.js['"]/.test(spiritJs) && /require\(\s*['"]\.\.\/shell\/shared\/js\/spiritData\.js['"]\s*\)/.test(appServer),
  'the data set is one file: spirit.js brings shell/shared/js/spiritData.js to a page, and appServer requires the same file', 'spirit.js or appServer.js loads a data set of its own');
ok(/path\.dirname\(\s*spirit\.familyPath\([^;]{0,60}?\)\s*\)\s*,\s*['"]clientCacheManager\.js['"]/.test(appServer),
  'appServer takes a family\'s cache from the family\'s own clientCacheManager.js, beside its api.js', 'appServer finds a family\'s cache somewhere else than beside its api.js');
const managers = tracked.filter(function (f) { return /\/clientCacheManager\.js$/.test(f) && !/\/test\//.test(f); });
// What each manager names: its branches, the strings it gives its names to (var ITEMS = 'desk').
const owned = {};
managers.forEach(function (m) {
  const re = /\bvar\s+[A-Z][A-Z_]*\s*=\s*'([a-zA-Z]\w*)'\s*;/g; let x; const src = code(path.join(RUN, m));
  while ((x = re.exec(src))) owned[x[1]] = m;
});
test.comment('branches named by their managers: ' + Object.keys(owned).map(function (b) { return b + ' (' + owned[b] + ')'; }).join(', '));
const readers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\/|node_modules|\/vendor\//.test(f) && managers.indexOf(f) === -1; });
Object.keys(owned).forEach(function (b) {
  // A path into the branch handed to a spirit.data reader or writer: D.get('desk/' + id), data.watch("deskItem/...").
  const pathOf = new RegExp('\\b(?:D|data)\\.(?:get|set|merge|del|watch|rows|branch|seat)\\(\\s*[\'"]' + b + '(?:/|[\'"])');
  const others = readers.filter(function (f) { return pathOf.test(code(path.join(RUN, f))); });
  ok(!others.length, b + ': named by ' + owned[b] + ' alone; every other file asks it', b + ': its paths are named outside ' + owned[b] + ', by ' + short(others));
});

// ── 3. THE SAME ROWS, THE SAME CACHE ────────────────────────────────────────────────────────────────────────────────
test.subHeading('3. the same rows make the same spirit.data in node and in a page');
const DATA = path.join(RUN, 'shell', 'shared', 'js', 'spiritData.js');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'family', 'clientCacheManager.js');
const ROWS = [
  { verb: 'goal.whole', change: 3, item: { id: 'goal/G9', goal: '', title: 'A goal', status: 'open' } },
  { verb: 'goal.whole', change: 3, item: { id: 'goal/G9.1', goal: 'goal/G9', title: 'An item', status: 'open', tags: ['a'] } },
  { verb: 'item.set', change: 4, item: JSON.stringify({ id: 'goal/G9.2', goal: 'goal/G9', title: 'Another', status: 'build' }) },
  { rule: 'rule/1', row: { key: 'rule/1', label: 'A rule', status: 'active' }, change: 5 },
];
// In node, as appServer runs them: the data set required, the manager required and attached to the process's global.
function inNode() {
  const g = { spirit: {} };
  const keep = {};
  [DATA, DESK].forEach(function (f) { keep[f] = require.cache[require.resolve(f)]; delete require.cache[require.resolve(f)]; });
  const saved = globalThis.spirit;
  globalThis.spirit = g.spirit;
  let out = null;
  try {
    const D = require(DATA);
    g.spirit.data = D;
    const M = require(DESK);
    M.attach(g);
    ROWS.forEach(function (r) { g.spirit.deskData.published(JSON.parse(JSON.stringify(r))); });
    out = JSON.parse(JSON.stringify(D.data));
  } catch (e) { out = { threw: e.message }; }
  globalThis.spirit = saved;
  [DATA, DESK].forEach(function (f) { if (keep[f]) require.cache[require.resolve(f)] = keep[f]; else delete require.cache[require.resolve(f)]; });
  return out;
}
// In a page's window, as a page runs them: both files run as scripts, with no module and no require.
function inPage() {
  const win = { console: { log: function () {}, error: function () {}, warn: function () {} }, setTimeout: setTimeout, clearTimeout: clearTimeout, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Math: Math, Date: Date, Error: Error, Promise: Promise };
  win.window = win; win.spirit = {};
  vm.createContext(win);
  try {
    vm.runInContext(fs.readFileSync(DATA, 'utf8'), win, { filename: 'spiritData.js' });
    vm.runInContext(fs.readFileSync(DESK, 'utf8'), win, { filename: 'clientCacheManager.js' });
    if (!win.spirit.deskData && typeof win.spirit.deskAttach === 'function') win.spirit.deskAttach(win);
    if (!win.spirit.deskData) return { threw: 'the page has no spirit.deskData once both files ran' };
    ROWS.forEach(function (r) { win.spirit.deskData.published(JSON.parse(JSON.stringify(r))); });
    return JSON.parse(JSON.stringify(win.spirit.data.data));
  } catch (e) { return { threw: e.message }; }
}
const node = inNode();
const page = inPage();
ok(!node.threw && Object.keys(node).length > 0, 'in node, as appServer runs it, the rows land in spirit.data: ' + Object.keys(node).join(', '), 'in node: ' + short(node));
ok(!page.threw && Object.keys(page).length > 0, 'in a page, as a page runs it, the rows land in spirit.data: ' + Object.keys(page).join(', '), 'in a page: ' + short(page));
ok(!node.threw && !page.threw && JSON.stringify(node) === JSON.stringify(page), 'the same rows make the same spirit.data in node and in a page', 'node ' + short(node) + ' against the page ' + short(page));

// ── 4. THE ONE DIFFERENCE IS THE DISK ───────────────────────────────────────────────────────────────────────────────
test.subHeading('4. the one difference: appServer writes the cache to disk, no manager does');
managers.forEach(function (m) {
  const src = code(path.join(RUN, m));
  const disk = /require\(\s*['"](fs|node:fs|path)['"]\s*\)|\b(writeFile|readFile|appendFile|localStorage|sessionStorage|indexedDB)\b/.exec(src);
  ok(!disk, m + ': it touches no file and no browser storage', m + ': it keeps its cache itself (' + (disk && disk[0]) + '), where only appServer may');
});
ok(/cacheFile\(/.test(appServer) && /writeFileSync\([^)]*\.tmp/.test(appServer), 'appServer writes each sender\'s cache to its own file on disk', 'appServer writes no cache to disk');
const writers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && f !== 'spirit/appServer.js' && /cache[^'"]*\.json/.test(code(path.join(RUN, f))) && /writeFile/.test(code(path.join(RUN, f))); });
ok(!writers.length, 'no other module writes a cache file of its own', 'a cache file written by ' + short(writers));

test.reportSuccessFailureCount();
