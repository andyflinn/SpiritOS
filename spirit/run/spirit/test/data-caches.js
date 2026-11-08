'use strict';

// spirit/run/spirit/test/data-caches.js
// EVERY FAMILY'S CACHE, ONE CODE IN THE BROWSER AND IN NODE (goal/G41.28; spec: ./data-caches.md). Not a test of one module:
// of the api tree's families and the two places their caches run, a page and a server process that follows a stream
// (appServer). Andy, on G41.28: "WSL, make sure you assert that every family in the api tree HAS a clientCacheManager,
// AND the a node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only
// difference is the appServer serializes the cache to disk."
//
//   1. every family in the api tree, each its own check: a data.js beside its api.js;
//   2. one code: the browser and appServer load the same data set file and the same family file, and nothing else in
//      the tree keeps a family's cache: its branches are named by its data.js alone;
//   3. the same rows make the same cache: the desk's data.js and the data set, run in node as appServer
//      runs them and in a page's window as a page runs them, are fed the same rows and end with the same spirit.data.desk.cache;
//   4. the one difference is the disk: no data.js touches a file or the browser's storage, and appServer
//      writes the cache to disk.
//   5. every family's data.js is the same: required, it stands at spirit.data.<name> through spirit.data.makeFamily (and exports
//      its cache rules where its clients keep a cache file).
//   6. the shell finds and downloads them by introspection (Andy, on G41.28: "We're not done until every family of the
//      API tree as a clientCacheManager, and clients can use that to organize their spirit.data, and the shell can
//      introspect to find and download their clientCacheManagers."): spirit.js knows where a family's manager lives, and
//      for every family the node's own api tree names, a scratch node answers that file.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(__dirname, '..', '..', 'test', 'testReport.js'));

const RUN = path.resolve(__dirname, '..', '..');
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
// A family's manager, beside its interface: the app's beside spirit.familyPath(name), the node's own beside its api.js.
const appFamilies = {};
// An app of spirit/app/<name>/ keeps its family and its manager at its top (goal/G43.27).
function managerOf(name) {
  if (fs.existsSync(path.join(RUN, 'spirit', 'app', name, 'api.js'))) return 'spirit/app/' + name + '/data.js';
  return appFamilies[name] ? path.posix.join(path.posix.dirname(path.posix.dirname(familyPath(name))), 'data.js') : 'spirit/' + name + '/data.js';
}
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A file tracked but not on disk reads as empty, so a deletion not yet committed is judged and never crashes the report.
function code(file) { let t = ''; try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);

test.startTest('caches: every family has a data.js, one code in the browser and in node');

// ── 1. EVERY FAMILY ─────────────────────────────────────────────────────────────────────────────────────────────────
// The api tree's families are their interfaces: an app's at spirit.familyPath(name), and the node's own,
// spirit/<name>/api.js (spirit.js, interfaceName). A test folder's api.js is a test, not a family. Every family path is
// spirit.familyPath's (the appServer test's rule: no file writes one by hand). An app of spirit/app/<name>/ (its
// interface at ./api.js and its manager at ./data.js, beside <name>.js, goal/G43.27) is found by neither pattern, so the agent app's
// family is not among those counted here.
test.subHeading('1. every family in the api tree has a data.js in its own folder');
// An app's family is a process folder whose familyPath is tracked.
tracked.forEach(function (f) { const m = /^process\/js\/([^/]+)\//.exec(f); if (m && tracked.indexOf(familyPath(m[1])) !== -1) appFamilies[m[1]] = true; });
const families = Object.keys(appFamilies).sort().map(function (n) { return familyPath(n); })
  .concat(tracked.filter(function (f) { return /^spirit\/[^/]+\/api\.js$/.test(f); }));
test.comment(families.length + ' families: ' + families.map(function (f) { return f.split('/').slice(-3, -1).join('/'); }).join(', '));
ok(families.length > 0, 'the api tree has ' + families.length + ' families', 'no family found in the tree');
families.forEach(function (api) {
  const manager = api.replace(/(family\/)?api\.js$/, 'data.js');
  const name = /^process\/js\/([^/]+)\//.exec(api) ? /^process\/js\/([^/]+)\//.exec(api)[1] : /^spirit\/([^/]+)\//.exec(api)[1];
  ok(tracked.indexOf(manager) !== -1, name + ': ' + manager + ' is there', name + ': no ' + manager + ' for ' + api);
});

// ── 2. ONE CODE ─────────────────────────────────────────────────────────────────────────────────────────────────────
test.subHeading('2. the browser and node load the same files, and nothing else keeps a family\'s cache');
const spiritJs = code(path.join(RUN, 'spirit', 'spirit.js'));
const appServer = code(path.join(RUN, 'spirit', 'appServer.js'));
// Andy: "we needed it so node.js based clients could share the exact same client code. please move the file to
// repo:/spirit/run/spirit/spiritData.js". Every client's file, so it sits with spirit's own, not the shell's.
ok(/['"]spirit\/data\.js['"]/.test(spiritJs) && /require\(\s*['"]\.\/data\.js['"]\s*\)/.test(appServer),
  'the data set is one file: spirit.js brings spirit/data.js to a page, and appServer requires the same file', 'spirit.js or appServer.js loads a data set from somewhere else than spirit/data.js');
ok(tracked.indexOf('spirit/data.js') !== -1, 'the data set is spirit/data.js', 'spirit/data.js is not tracked');
ok(/path\.dirname\(\s*path\.dirname\(\s*spirit\.familyPath\([^;]{0,60}?\)\s*\)\s*\)\s*,\s*['"]data\.js['"]/.test(appServer),
  'appServer takes a family\'s cache from the family\'s own data.js', 'appServer finds a family\'s cache somewhere else than the family\'s folder');
const managers = tracked.filter(function (f) { return /\/data\.js$/.test(f) && f !== 'spirit/data.js' && !/\/test\//.test(f); });
// What each manager names: its branches, the strings it gives its names to (var ITEMS = 'desk').
const owned = {};
managers.forEach(function (m) {
  const re = /\bvar\s+[A-Z][A-Z_]*\s*=\s*'([a-zA-Z]\w*)'\s*;/g; let x; const src = code(path.join(RUN, m));
  while ((x = re.exec(src))) owned[x[1]] = m;
});
test.comment('branches named by their managers: ' + Object.keys(owned).map(function (b) { return b + ' (' + owned[b] + ')'; }).join(', '));
const readers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\/|\/vendor\//.test(f) && !VENDORED_FOLDERS.holds(f) && managers.indexOf(f) === -1; });
Object.keys(owned).forEach(function (b) {
  // A path into the branch handed to a spirit.data reader or writer: D.get('desk/' + id), data.watch("deskItem/...").
  const pathOf = new RegExp('\\b(?:D|data)\\.(?:get|set|merge|del|watch|rows|branch|seat)\\(\\s*[\'"]' + b + '(?:/|[\'"])');
  const others = readers.filter(function (f) { return pathOf.test(code(path.join(RUN, f))); });
  ok(!others.length, b + ': named by ' + owned[b] + ' alone; every other file asks it', b + ': its paths are named outside ' + owned[b] + ', by ' + short(others));
});

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
function inNode() {
  const g = { spirit: {} };
  const keep = {};
  [DATA, DESK].forEach(function (f) { keep[f] = require.cache[require.resolve(f)]; delete require.cache[require.resolve(f)]; });
  const saved = globalThis.spirit;
  globalThis.spirit = g.spirit;
  let out = null;
  try {
    const D = require(DATA);
    require(DESK);
    D.homeNode(SERVER);
    ROWS.forEach(function (r) { D.desk.data.published(JSON.parse(JSON.stringify(r))); });
    out = JSON.parse(JSON.stringify(D.desk.cache));
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
managers.forEach(function (m) {
  const src = code(path.join(RUN, m));
  const disk = /require\(\s*['"](fs|node:fs|path)['"]\s*\)|\b(writeFile|readFile|appendFile|localStorage|sessionStorage|indexedDB)\b/.exec(src);
  ok(!disk, m + ': it touches no file and no browser storage', m + ': it keeps its cache itself (' + (disk && disk[0]) + '), where only appServer may');
});
ok(/cacheFile\(/.test(appServer) && /writeFileSync\([^)]*\.tmp/.test(appServer), 'appServer writes each sender\'s cache to its own file on disk', 'appServer writes no cache to disk');
const writers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && f !== 'spirit/appServer.js' && /cache[^'"]*\.json/.test(code(path.join(RUN, f))) && /writeFile/.test(code(path.join(RUN, f))); });
ok(!writers.length, 'no other module writes a cache file of its own', 'a cache file written by ' + short(writers));


// ── 5. ONE CONTRACT ─────────────────────────────────────────────────────────────────────────────────────────────────
test.subHeading('5. every family\'s data.js is the same: required, it stands at spirit.data.<name>');
managers.forEach(function (m) {
  // The family a manager makes is the name it hands makeFamily (spirit/app/chat/data.js makes chatClerver, spirit/app/data.js
  // makes app): never guessed from its folder.
  const named = /makeFamily\(\s*['"]([^'"]+)['"]/.exec(code(path.join(RUN, m)));
  const name = named ? named[1] : '';
  let mod = null;
  try { mod = require(path.join(RUN, m)); } catch (e) { mod = { threw: e.message }; }
  // Cache rules are what appServer needs to keep it on disk, and a family has them when its clients keep a cache file.
  ok(!!mod && !mod.threw && (mod.cache === undefined || (mod.cache && typeof mod.cache === 'object')), m + ': it loads' + (mod && mod.cache ? ', and exports its cache rules' : ''), m + ': it exports ' + short(mod && Object.keys(mod)));
  const f = require(DATA)[name];
  ok(!!f && !!f.data && typeof f.data === 'object' && !!f.cache, m + ': it stands at spirit.data.' + name + ', for clients to ask', m + ': spirit.data.' + name + ' is ' + short(f));
});

// ── 7. NO OTHER WAY ─────────────────────────────────────────────────────────────────────────────────────────────────
test.subHeading('7. nothing keeps node rows but spirit.data, and no file names another way');
// Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
// item. no exceptions." A client that takes the node's stream itself keeps rows outside spirit.data: only spirit/data.js
// takes it, for every client. boot.js is the face's own transport, before spirit (Andy: "boot.js MUST be an exception").
// The node's own side (spirit/, kernel, events) serves the stream and is no client. The client list below names shell/
// and shell/boot.js; goal/G43.18 moved boot.js and seal.js to spirit/shell/, which the list does not reach, so boot.js
// stays out by its new place and spirit/shell/seal.js is not read; the apps left in shell/ still are. Nor does it reach
// spirit/app/, where the apps moved to (goal/G43.12, G43.17): none of those is judged here.
const clients = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && /^(shell|spirit\/element|process\/js)\//.test(f) && f !== 'shell/boot.js'; });
const takers = clients.filter(function (f) { return /\bevents\.subscribe\(|\bev\.subscribe\(/.test(code(path.join(RUN, f))); });
ok(!takers.length, 'no client takes the node\'s stream itself: spirit/data.js takes it for all', 'clients taking the stream themselves, their rows outside spirit.data: ' + short(takers));
// "any notion that there is an alternative approach must disappear from all documentation and all comments in the
// entire repo." The ways replaced, by name: the data set's old places, the desk's old translator file, the two-level
// branches the desk kept before the tree was by node, and a page or client that runs "uncached", without them. The desk's record (currentGoal.json) and Andy's vault are no
// documentation of the repo's code; this file and its spec name them to find them.
const REPO = path.join(RUN, '..', '..');
const OLD = [/\buncached\b/i, /['"]deskItems?\//, /['"]deskState\//, /\bD\.data\.(files|contacts|desk)\b/];
const every = require('child_process').execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) {
  return f && /\.(js|md|html|json)$/.test(f) && !/currentGoal\.json$|^spirit\/run\/brains\//.test(f) && f !== 'spirit/run/spirit/test/data-caches.js' && f !== 'spirit/run/spirit/test/data-caches.md';
});
const naming = every.filter(function (f) { let t = ''; try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; } return OLD.some(function (re) { return re.test(t); }); });
ok(!naming.length, 'no file in the repo names a replaced way: running uncached, the two-level desk branches',
  naming.length + ' files still name one: ' + short(naming));

// ── 6. FOUND AND DOWNLOADED BY INTROSPECTION ────────────────────────────────────────────────────────────────────────
(async function () {
  test.subHeading('6. the shell finds every family\'s manager by the folder shape, and downloads it (goal/G43.27)');
  ok(/['"]data\.js['"]/.test(spiritJs), 'spirit.js knows where a family\'s data.js lives, so a page finds it by the family\'s name', 'spirit.js names no data.js: a page cannot find a family\'s data.js by itself');
  const node = await H.scratchNode();
  try {
    if (!node.up) { test.fail('the scratch node did not come up'); return; }
    const tree = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.json(); }, function () { return null; });
    const names = tree && typeof tree === 'object' ? Object.keys(tree).filter(function (k) { return tree[k] && typeof tree[k] === 'object' && tree[k].ok !== false; }) : [];
    test.comment('the node\'s api tree names ' + names.length + ' families: ' + names.join(', '));
    ok(names.length > 0, 'the node\'s api tree names its families', 'the node answered no tree: ' + short(tree));
    // As the shell finds it (spirit.cacheManager, goal/G43.27): an app's manager is spirit/app/<name>/data.js, a node
    // family's spirit/<name>/data.js; no family's FS is asked.
    for (const name of names) {
      const at = managerOf(name);
      const got = await fetch(node.base + '/' + at).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); }, function () { return { status: 0, text: '' }; });
      ok(got.status === 200 && got.text.indexOf('.makeFamily(') !== -1, name + ': the shell downloads its manager, /' + at,
        name + ': /' + at + ' answered ' + got.status);
    }
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    await H.sleep(300);
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
  }
}());
