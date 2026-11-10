'use strict';

// spirit/run/spirit/test/data-caches.js
// ONE CACHE CODE IN THE BROWSER AND IN NODE, THE DATA SET'S SIDE (goal/G41.28; spec: ./data-caches.md). A test by name of
// spirit/data.js, the data set. Andy, on G41.28: "WSL, make sure you assert that every family in the api tree HAS a
// clientCacheManager, AND the a node.js Process like DeskClient uses the Exact same code as the browser for the cache
// management. The only difference is the appServer serializes the cache to disk."
//
// What every branch's data.js must be (1, its branches named by it alone in 2, its disk in 4, 5, 6's downloads, 8) is
// judged on each branch folder by ./spirit-sibling-branchRules.js (goal/G43.32, Q6, Q7). Here what judges no branch:
//   2. one code: the browser and appServer load the same data set file, and appServer a family's cache from its own data.js;
//   3. the same rows make the same cache: the desk's data.js and the data set, run in node as appServer
//      runs them and in a page's window as a page runs them, are fed the same rows and end with the same spirit.data.desk.cache;
//   4. the one difference is the disk: appServer writes the cache to disk, and no other module does;
//   6. spirit.js knows where a family's manager lives;
//   7. nothing keeps node rows but spirit.data, and no file names another way.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(__dirname, '..', '..', 'spirit', 'test', 'testReport.js'));

const RUN = path.resolve(__dirname, '..', '..');
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
// An app of spirit/app/<name>/ keeps its family and its manager at its top (goal/G43.27).
function managerOf(name) {
  if (fs.existsSync(path.join(RUN, 'spirit', 'app', name, 'api.js'))) return 'spirit/app/' + name + '/data.js';
  return 'spirit/' + name + '/data.js';
}
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A file tracked but not on disk reads as empty, so a deletion not yet committed is judged and never crashes the report.
function code(file) { let t = ''; try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
// NOBODY ADDS A FAMILY PAST THE RULES (goal/G43.32; Andy: "make sure nobody can add an app implementing a family, without
// adhering to the rules, this means that a test outside of each branch must assert this."): the tree is every file git
// keeps and every file not yet added that git does not ignore, so a new app's family is judged before it is committed.
const tracked = require('child_process').execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);

test.startTest('caches: one cache code in the browser and in node, the data set\'s side');

// ── 2. ONE CODE ─────────────────────────────────────────────────────────────────────────────────────────────────────
test.subHeading('2. the browser and node load the same files, and nothing else keeps a family\'s cache');
const spiritJs = code(path.join(RUN, 'spirit', 'spirit.js'));
const appServer = code(path.join(RUN, 'spirit', 'appServer.js'));
// Andy: "we needed it so node.js based clients could share the exact same client code. please move the file to
// repo:/spirit/run/spirit/spiritData.js". Every client's file, so it sits with spirit's own, not the shell's.
// goal/G43.32: appServer loads it by spirit.require and its run-root path, as every script loads the tree.
ok(/['"]spirit\/data\.js['"]/.test(spiritJs) && /\.require\(\s*['"]spirit\/data\.js['"]\s*\)/.test(appServer),
  'the data set is one file: spirit.js brings spirit/data.js to a page, and appServer requires the same file', 'spirit.js or appServer.js loads a data set from somewhere else than spirit/data.js');
ok(tracked.indexOf('spirit/data.js') !== -1, 'the data set is spirit/data.js', 'spirit/data.js is not tracked');
ok(/path\.dirname\(\s*spirit\.familyPath\([^;]{0,60}?\)\s*\)\s*,\s*['"]data\.js['"]/.test(appServer),
  'appServer takes a family\'s cache from the family\'s own data.js', 'appServer finds a family\'s cache somewhere else than the family\'s folder');
const managers = tracked.filter(function (f) { return /\/data\.js$/.test(f) && f !== 'spirit/data.js' && !/\/test\//.test(f); });

// ── 3. THE SAME ROWS, THE SAME CACHE ────────────────────────────────────────────────────────────────────────────────
test.subHeading('3. the same rows make the same spirit.data in node and in a page');
const DATA = path.join(RUN, 'spirit', 'data.js');
const DESK = path.join(RUN, managerOf('desk'));
const ROWS = [
  { verb: 'goal.whole', change: 3, item: { id: 'goal/G9', goal: '', title: 'A goal', status: 'open' } },
  { verb: 'goal.whole', change: 3, item: { id: 'goal/G9.1', goal: 'goal/G9', title: 'An item', status: 'open', tags: ['a'] } },
  { verb: 'item.set', change: 4, item: JSON.stringify({ id: 'goal/G9.2', goal: 'goal/G9', title: 'Another', status: 'build' }) },
  { rule: 'rule/1', row: { key: 'rule/1', label: 'A rule', status: 'active' }, change: 5 },
];
// The node that served the rows: a public key holding a + and a /, as real keys do. Andy, the box: "The RAM-CACHE-is
// organized BY SERVER-NODE-ID at it's lowest level. IE: spirit.data.<server-public-key-in-base64url>.<api-family>....".
// Both sides are told it the one way the data set offers, homeNode(key): a page learns it from node.card, a process from
// the sender whose rows it takes.
const SERVER = Buffer.from('KEY-CACHES\xfb\xef\xbf\xfe', 'latin1').toString('base64');
const SERVER_ID = Buffer.from(SERVER, 'base64').toString('base64url');
// In node, as appServer runs them: the data set required, then the family's data.js, on the process's global.
// goal/G43.32: the data set and the family's data.js are spirit.require()d, as appServer and the family's file load them,
// so both hold the one instance at spirit.required.spirit.data.
function inNode() {
  let out = null;
  try {
    const S = require(path.join(RUN, 'spirit', 'spirit.js'));
    const D = S.require('spirit/data.js');
    S.require(path.relative(RUN, DESK).split(path.sep).join('/'));
    D.homeNode(SERVER);
    ROWS.forEach(function (r) { D.desk.data.published(JSON.parse(JSON.stringify(r))); });
    out = JSON.parse(JSON.stringify(D.desk.cache));
  } catch (e) { out = { threw: e.message }; }
  return out;
}
// In a page's window, as a page runs them: both files run as scripts, with no module and no require.
function inPage() {
  const win = { console: { log: function () {}, error: function () {}, warn: function () {} }, setTimeout: setTimeout, clearTimeout: clearTimeout, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Math: Math, Date: Date, Error: Error, Promise: Promise };
  win.window = win; win.spirit = {};
  vm.createContext(win);
  try {
    vm.runInContext(fs.readFileSync(DATA, 'utf8'), win, { filename: 'spirit/data.js' });
    vm.runInContext(fs.readFileSync(DESK, 'utf8'), win, { filename: 'data.js' });
    if (!win.spirit.data.desk) return { threw: 'the page has no spirit.data.desk once both files ran' };
    win.spirit.data.homeNode(SERVER);
    ROWS.forEach(function (r) { win.spirit.data.desk.data.published(JSON.parse(JSON.stringify(r))); });
    return JSON.parse(JSON.stringify(win.spirit.data.desk.cache));
  } catch (e) { return { threw: e.message }; }
}
const node = inNode();
const page = inPage();
ok(!node.threw && Object.keys(node).length > 0, 'in node, as appServer runs it, the rows land in spirit.data.desk.cache: ' + Object.keys(node).join(', '), 'in node: ' + short(node));
ok(!page.threw && Object.keys(page).length > 0, 'in a page, as a page runs it, the rows land in spirit.data.desk.cache: ' + Object.keys(page).join(', '), 'in a page: ' + short(page));
ok(!node.threw && JSON.stringify(Object.keys(node)) === JSON.stringify([SERVER_ID]) && node[SERVER_ID] && typeof node[SERVER_ID] === 'object',
  'its top level is the serving node alone, its key in base64url (Q5)', 'in node the top level is ' + short(Object.keys(node)) + ', not ' + SERVER_ID);
ok(!node.threw && !page.threw && JSON.stringify(node) === JSON.stringify(page), 'the same rows make the same spirit.data.desk.cache in node and in a page', 'node ' + short(node) + ' against the page ' + short(page));

// ── 4. THE ONE DIFFERENCE IS THE DISK ───────────────────────────────────────────────────────────────────────────────
test.subHeading('4. the one difference: appServer writes the cache to disk, no manager does');
ok(/cacheFile\(/.test(appServer) && /writeFileSync\([^)]*\.tmp/.test(appServer), 'appServer writes each sender\'s cache to its own file on disk', 'appServer writes no cache to disk');
const writers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && f !== 'spirit/appServer.js' && /cache[^'"]*\.json/.test(code(path.join(RUN, f))) && /writeFile/.test(code(path.join(RUN, f))); });
ok(!writers.length, 'no other module writes a cache file of its own', 'a cache file written by ' + short(writers));


// ── 7. NO OTHER WAY ─────────────────────────────────────────────────────────────────────────────────────────────────
test.subHeading('7. nothing keeps node rows but spirit.data, and no file names another way');
// Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
// item. no exceptions." A client that takes the node's stream itself keeps rows outside spirit.data: only spirit/data.js
// takes it, for every client. boot.js is the face's own transport, before spirit (Andy: "boot.js MUST be an exception").
// The node's own side (spirit/, kernel, events) serves the stream and is no client. The client list below names shell/
// and shell/boot.js; goal/G43.18 moved boot.js and seal.js to spirit/shell/, which the list does not reach, so boot.js
// stays out by its new place and spirit/shell/seal.js is not read; the apps left in shell/ still are, and every app of
// spirit/app/, where the apps and the servers moved to (goal/G43.12, G43.17, G43.20).
const clients = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && /^(shell|spirit\/element|spirit\/app)\//.test(f) && f !== 'shell/boot.js'; });
const takers = clients.filter(function (f) { return /\bevents\.subscribe\(|\bev\.subscribe\(/.test(code(path.join(RUN, f))); });
ok(!takers.length, 'no client takes the node\'s stream itself: spirit/data.js takes it for all', 'clients taking the stream themselves, their rows outside spirit.data: ' + short(takers));
// "any notion that there is an alternative approach must disappear from all documentation and all comments in the
// entire repo." The ways replaced, by name: the data set's old places, the desk's old translator file, the two-level
// branches the desk kept before the tree was by node, and a page or client that runs "uncached", without them. Andy's vault is no documentation of the
// repo's code; this file and its spec name them to find them.
const REPO = path.join(RUN, '..', '..');
const OLD = [/\buncached\b/i, /['"]deskItems?\//, /['"]deskState\//, /\bD\.data\.(files|contacts|desk)\b/];
const every = require('child_process').execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) {
  return f && /\.(js|md|html|json)$/.test(f) && !/^spirit\/run\/brains\//.test(f) && f !== 'spirit/run/spirit/test/data-caches.js' && f !== 'spirit/run/spirit/test/data-caches.md';
});
const naming = every.filter(function (f) { let t = ''; try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; } return OLD.some(function (re) { return re.test(t); }); });
ok(!naming.length, 'no file in the repo names a replaced way: running uncached, the two-level desk branches',
  naming.length + ' files still name one: ' + short(naming));

// ── 6. FOUND BY INTROSPECTION ───────────────────────────────────────────────────────────────────────────────────────
test.subHeading('6. the shell finds a family\'s manager by the folder shape (goal/G43.27)');
ok(/['"]data\.js['"]/.test(spiritJs), 'spirit.js knows where a family\'s data.js lives, so a page finds it by the family\'s name', 'spirit.js names no data.js: a page cannot find a family\'s data.js by itself');
// That the node serves each family's manager, and a page asking by the name gets it, is a rule of every branch, judged
// on each branch folder in ./spirit-sibling-branchRules.js (goal/G43.32).
test.reportSuccessFailureCount();
