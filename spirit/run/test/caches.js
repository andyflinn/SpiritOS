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
//   5. every manager is used the same way: it exports an attach, which puts its reader on spirit (and its cache rules
//      where its clients keep a cache file).
//   6. the shell finds and downloads them by introspection (Andy, on G41.28: "We're not done until every family of the
//      API tree as a clientCacheManager, and clients can use that to organize their spirit.data, and the shell can
//      introspect to find and download their clientCacheManagers."): spirit.js knows where a family's manager lives, and
//      for every family the node's own api tree names, a scratch node answers that file.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..');
const familyPath = require(path.join(RUN, 'spirit.js')).familyPath;
// A family's manager, beside its interface: the app's beside spirit.familyPath(name), the node's own beside its api.js.
const appFamilies = {};
function managerOf(name) { return appFamilies[name] ? path.posix.join(path.posix.dirname(familyPath(name)), 'clientCacheManager.js') : 'spirit/' + name + '/clientCacheManager.js'; }
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A file tracked but not on disk reads as empty, so a deletion not yet committed is judged and never crashes the report.
function code(file) { let t = ''; try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
const H = require(path.join(__dirname, 'headLessChrome.js'));
const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);

test.startTest('caches: every family has a clientCacheManager, one code in the browser and in node');

// ── 1. EVERY FAMILY ─────────────────────────────────────────────────────────────────────────────────────────────────
// The api tree's families are their interfaces: an app's at spirit.familyPath(name), and the node's own,
// spirit/<name>/api.js (spirit.js, interfaceName). A test folder's api.js is a test, not a family. Every family path is
// spirit.familyPath's (the appServer test's rule: no file writes one by hand).
test.subHeading('1. every family in the api tree has a clientCacheManager beside its api.js');
// An app's family is a process folder whose familyPath is tracked.
tracked.forEach(function (f) { const m = /^process\/js\/([^/]+)\//.exec(f); if (m && tracked.indexOf(familyPath(m[1])) !== -1) appFamilies[m[1]] = true; });
const families = Object.keys(appFamilies).sort().map(function (n) { return familyPath(n); })
  .concat(tracked.filter(function (f) { return /^spirit\/[^/]+\/api\.js$/.test(f); }));
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
// Andy: "we needed it so node.js based clients could share the exact same client code. please move the file to
// repo:/spirit/run/spirit/spiritData.js". Every client's file, so it sits with spirit's own, not the shell's.
ok(/['"]spirit\/spiritData\.js['"]/.test(spiritJs) && /require\(\s*['"]\.\/spiritData\.js['"]\s*\)/.test(appServer),
  'the data set is one file: spirit.js brings spirit/spiritData.js to a page, and appServer requires the same file', 'spirit.js or appServer.js loads a data set from somewhere else than spirit/spiritData.js');
ok(tracked.indexOf('spirit/spiritData.js') !== -1 && tracked.indexOf('shell/shared/js/spiritData.js') === -1,
  'spiritData.js is in spirit/, the old shell/shared/js/spiritData.js gone', 'spiritData.js is not at spirit/spiritData.js alone' + (tracked.indexOf('shell/shared/js/spiritData.js') !== -1 ? ': shell/shared/js/spiritData.js is still there' : ''));
const oldPlace = tracked.filter(function (f) { return /\.(js|html)$/.test(f) && f !== 'test/caches.js' && /shell\/shared\/js\/spiritData\.js|shared['"],\s*['"]js['"],\s*['"]spiritData/.test(code(path.join(RUN, f))); });
ok(!oldPlace.length, 'no file loads spiritData.js from the shell', 'still naming shell/shared/js/spiritData.js: ' + short(oldPlace));
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
const readers = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\/|node_modules|\/vendor\/|element\/codeMirror\//.test(f) && managers.indexOf(f) === -1; });
Object.keys(owned).forEach(function (b) {
  // A path into the branch handed to a spirit.data reader or writer: D.get('desk/' + id), data.watch("deskItem/...").
  const pathOf = new RegExp('\\b(?:D|data)\\.(?:get|set|merge|del|watch|rows|branch|seat)\\(\\s*[\'"]' + b + '(?:/|[\'"])');
  const others = readers.filter(function (f) { return pathOf.test(code(path.join(RUN, f))); });
  ok(!others.length, b + ': named by ' + owned[b] + ' alone; every other file asks it', b + ': its paths are named outside ' + owned[b] + ', by ' + short(others));
});

// ── 3. THE SAME ROWS, THE SAME CACHE ────────────────────────────────────────────────────────────────────────────────
test.subHeading('3. the same rows make the same spirit.data in node and in a page');
const DATA = path.join(RUN, 'spirit', 'spiritData.js');
const DESK = path.join(RUN, managerOf('desk'));
const ROWS = [
  { verb: 'goal.whole', change: 3, item: { id: 'goal/G9', goal: '', title: 'A goal', status: 'open' } },
  { verb: 'goal.whole', change: 3, item: { id: 'goal/G9.1', goal: 'goal/G9', title: 'An item', status: 'open', tags: ['a'] } },
  { verb: 'item.set', change: 4, item: JSON.stringify({ id: 'goal/G9.2', goal: 'goal/G9', title: 'Another', status: 'build' }) },
  { rule: 'rule/1', row: { key: 'rule/1', label: 'A rule', status: 'active' }, change: 5 },
];
// The node that served the rows: a public key holding a + and a /, as real keys do. Andy, the box: "The RAM-CACHE-is
// organized BY SERVER-NODE-ID at it's lowest level. IE: spirit.data.<server-public-key-in-base64url>.<api-family>....".
// Both sides are told it the one way the data set offers, home(key): a page learns it from node.card, a process from
// the sender whose rows it takes.
const SERVER = Buffer.from('KEY-CACHES\xfb\xef\xbf\xfe', 'latin1').toString('base64');
const SERVER_ID = Buffer.from(SERVER, 'base64').toString('base64url');
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
    D.home(SERVER);
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
    win.spirit.data.home(SERVER);
    ROWS.forEach(function (r) { win.spirit.deskData.published(JSON.parse(JSON.stringify(r))); });
    return JSON.parse(JSON.stringify(win.spirit.data.data));
  } catch (e) { return { threw: e.message }; }
}
const node = inNode();
const page = inPage();
ok(!node.threw && Object.keys(node).length > 0, 'in node, as appServer runs it, the rows land in spirit.data: ' + Object.keys(node).join(', '), 'in node: ' + short(node));
ok(!page.threw && Object.keys(page).length > 0, 'in a page, as a page runs it, the rows land in spirit.data: ' + Object.keys(page).join(', '), 'in a page: ' + short(page));
ok(!node.threw && JSON.stringify(Object.keys(node)) === JSON.stringify([SERVER_ID]) && node[SERVER_ID] && node[SERVER_ID].desk && typeof node[SERVER_ID].desk === 'object',
  'its top level is the serving node alone, its key in base64url, and the desk family under it', 'in node the top level is ' + short(Object.keys(node)) + ', not ' + SERVER_ID + ' with desk under it');
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


// ── 5. ONE CONTRACT ─────────────────────────────────────────────────────────────────────────────────────────────────
test.subHeading('5. every manager is used the same way: an attach that puts its reader on spirit');
managers.forEach(function (m) {
  let mod = null;
  try { mod = require(path.join(RUN, m)); } catch (e) { mod = { threw: e.message }; }
  // attach is what a client uses to organise its spirit.data; cache rules are what appServer needs to keep it on disk,
  // and a manager has them when its family's clients keep a cache file.
  ok(!!mod && typeof mod.attach === 'function' && (mod.cache === undefined || (mod.cache && typeof mod.cache === 'object')), m + ': it exports an attach' + (mod && mod.cache ? ', and its cache rules' : ''), m + ': it exports ' + short(mod && Object.keys(mod)));
  const g = { spirit: { data: require(DATA) } };
  let before = Object.keys(g.spirit).length;
  try { if (mod && typeof mod.attach === 'function') mod.attach(g); } catch (e) { /* judged below */ }
  ok(Object.keys(g.spirit).length > before, m + ': attached, it puts its reader on spirit, for clients to ask', m + ': attach put nothing on spirit');
});

// ── 7. NO OTHER WAY ─────────────────────────────────────────────────────────────────────────────────────────────────
test.subHeading('7. nothing keeps node rows but spirit.data, and no file names another way');
// Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
// item. no exceptions." A client that takes the node's stream itself keeps rows outside spirit.data: only spiritData.js
// takes it, for every client. boot.js is the face's own transport, before spirit (Andy: "boot.js MUST be an exception").
// The node's own side (spirit/, kernel, events) serves the stream and is no client.
const clients = tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && /^(shell|spirit\/element|process\/js)\//.test(f) && f !== 'shell/boot.js'; });
const takers = clients.filter(function (f) { return /\bevents\.subscribe\(|\bev\.subscribe\(/.test(code(path.join(RUN, f))); });
ok(!takers.length, 'no client takes the node\'s stream itself: spiritData.js takes it for all', 'clients taking the stream themselves, their rows outside spirit.data: ' + short(takers));
// "any notion that there is an alternative approach must disappear from all documentation and all comments in the
// entire repo." The ways replaced, by name: the data set's old places, the desk's old translator file, the two-level
// branches the desk kept before the tree was by node, and a page or client that runs "uncached", without them. The desk's record (currentGoal.json) and Andy's vault are no
// documentation of the repo's code; this file and its spec name them to find them.
const REPO = path.join(RUN, '..', '..');
const OLD = [/\buncached\b/i, /spirit\/element\/spiritData\.js/, /shell\/shared\/js\/spiritData\.js/, /deskData\.js/, /['"]deskItems?\//, /['"]deskState\//, /\bD\.data\.(files|contacts|desk)\b/];
const every = require('child_process').execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) {
  return f && /\.(js|md|html|json)$/.test(f) && !/currentGoal\.json$|^spirit\/run\/brains\//.test(f) && f !== 'spirit/run/test/caches.js' && f !== 'spirit/run/test/caches.md';
});
const naming = every.filter(function (f) { let t = ''; try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; } return OLD.some(function (re) { return re.test(t); }); });
ok(!naming.length, 'no file in the repo names a replaced way: running uncached, the old data set places, deskData.js, the two-level desk branches',
  naming.length + ' files still name one: ' + short(naming));

// ── 6. FOUND AND DOWNLOADED BY INTROSPECTION ────────────────────────────────────────────────────────────────────────
(async function () {
  test.subHeading('6. the shell finds every family\'s manager from the api tree, and downloads it');
  ok(/['"]clientCacheManager\.js['"]/.test(spiritJs), 'spirit.js knows where a family\'s clientCacheManager.js lives, so a page finds it by the family\'s name', 'spirit.js names no clientCacheManager.js: a page cannot find a family\'s manager by itself');
  const node = await H.scratchNode();
  try {
    if (!node.up) { test.fail('the scratch node did not come up'); return; }
    const tree = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.json(); }, function () { return null; });
    const names = tree && typeof tree === 'object' ? Object.keys(tree).filter(function (k) { return tree[k] && typeof tree[k] === 'object' && tree[k].ok !== false; }) : [];
    test.comment('the node\'s api tree names ' + names.length + ' families: ' + names.join(', '));
    ok(names.length > 0, 'the node\'s api tree names its families', 'the node answered no tree: ' + short(tree));
    // As the shell finds it (spirit.cacheManager): the family is asked where its manager is, <family>.FS.path, the
    // owner's verb on loopback, and the path it answers is downloaded; no folder is guessed from the name.
    const ask = function (call, args) {
      return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args }) })
        .then(function (r) { return r.json(); }, function () { return null; });
    };
    for (const name of names) {
      const where = await ask(name + '.FS.path', { path: 'clientCacheManager.js' });
      const at = where && typeof where.path === 'string' ? where.path : '';
      if (!at) { test.fail(name + ': ' + name + '.FS.path names no clientCacheManager.js: ' + short(where)); continue; }
      const got = await fetch(node.base + '/' + at).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); }, function () { return { status: 0, text: '' }; });
      ok(at === managerOf(name) && got.status === 200 && /\battach\b/.test(got.text), name + ': the shell asks ' + name + '.FS.path and downloads its manager, /' + at,
        name + ': ' + name + '.FS.path answered ' + at + (at === managerOf(name) ? '' : ', not ' + managerOf(name)) + '; /' + at + ' answered ' + got.status);
    }
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    await H.sleep(300);
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
  }
}());
