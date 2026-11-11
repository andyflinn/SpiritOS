'use strict';

// spirit/run/spirit/test/data.js
// The tests of spirit/data.js, and of no other module (spec: ./data.md). The faceless layer runs in node:
// required, it answers its api and ranks with the spirit's own probability files.
// The one test file of data.js: the caches part (one cache code in the browser and in node) and the families part
// (every family at spirit.data.<name>, goal/G43.7), once data-caches.js and data-families.js, are sections of it, run
// after its own checks.

const path = require('path');
const test = require(path.join(path.resolve(__dirname, '../..'), 'spirit', 'test', 'testReport.js'));

const D = require(path.join(__dirname, '..', 'data.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
// THE TREE IS BY SERVER NODE FIRST (goal/G41.28; Andy, the box: "spirit.data.<server-public-key-in-base64url>.<api-family>....").
// Every check below writes and reads through one family's view of one node, at(NODE, FAMILY), as a data.js
// does; T() is that family's level of the tree, and W(p) the whole path a watcher is told. NODE holds a + and a /.
const NODE = 'KEY+SPIRIT/DATA==';
const NID = D.nodeId(NODE);
const FAMILY = 'probe';
const V = D.viewAt(NODE, FAMILY);
function T() { return ((D[FAMILY] || {}).cache || {})[NID] || {}; }
function W(p) { return NID + '/' + FAMILY + '/' + p; }
function heard(p) { const calls = []; const off = V.watch(p, function (at, v) { calls.push([at, v]); }); return { calls: calls, off: off }; }

test.startTest('data.js: the faceless layer');

test.subHeading('set and get: one write, by path');
const byPath = heard('files/a/b.txt');
const byType = heard('files');
const other = heard('contacts');
V.set('files/a/b.txt', { size: 3 });
ok(V.get('files/a/b.txt').size === 3 && T().files['a/b.txt'].size === 3, 'a key may hold slashes: everything after the first / is the key',
  'stored: ' + JSON.stringify(T().files));
ok(byPath.calls.length === 1 && byPath.calls[0][0] === W('files/a/b.txt') && byPath.calls[0][1].size === 3,
  'the path\'s watcher is told (path, value)', 'path watcher: ' + JSON.stringify(byPath.calls));
ok(byType.calls.length === 1 && byType.calls[0][0] === W('files/a/b.txt'), 'the type\'s watcher is told of any key of it',
  'type watcher: ' + JSON.stringify(byType.calls));
ok(other.calls.length === 0, 'another type\'s watcher hears nothing', 'contacts heard: ' + JSON.stringify(other.calls));
ok(V.get('files') === T().files, 'a bare type gets the branch', 'get(type) is not the branch');
V.set('files', 1); V.set('files/', 2); V.set('', 3); D.setPath(null, 4);
ok(byType.calls.length === 1 && !('' in T().files) && !('' in D), 'a path without a key writes nothing and tells nobody',
  'keyless set: ' + JSON.stringify({ calls: byType.calls.length, files: Object.keys(T().files), data: D.allBranches() }));
ok(V.get('nosuch/key') === undefined && Object.keys(V.branch('fresh') || {}).length === 0 && V.rows('fresh').length === 0, 'a missing key reads undefined; a missing branch answers empty',
  'missing: ' + JSON.stringify(V.get('nosuch/key')));

test.subHeading('merge: new fields over the old');
V.set('contacts/K1', { name: 'ann', present: true });
V.merge('contacts/K1', { name: 'anna' });
ok(V.get('contacts/K1').name === 'anna' && V.get('contacts/K1').present === true, 'merge keeps the fields it does not name',
  'merged: ' + JSON.stringify(V.get('contacts/K1')));
V.merge('contacts/K2', { name: 'bo' });
ok(JSON.stringify(V.get('contacts/K2')) === '{"name":"bo"}', 'merge on a missing key starts from {}', 'K2: ' + JSON.stringify(V.get('contacts/K2')));
const before = V.get('contacts/K1');
V.merge('contacts/K1', { x: 1 });
ok(before.x === undefined && V.get('contacts/K1') !== before, 'merge writes a new value, the old object untouched', 'old object written: ' + JSON.stringify(before));
ok(other.calls.length === 4, 'every merge tells the watchers once', 'contacts heard ' + other.calls.length);

test.subHeading('del: the other write');
V.del('contacts/K2');
ok(!('K2' in T().contacts), 'del removes the key', 'K2 still there');
const last = other.calls[other.calls.length - 1];
ok(other.calls.length === 5 && last[0] === W('contacts/K2') && last[1] === undefined && last.length === 2, 'del tells the watchers with undefined',
  'del heard: ' + JSON.stringify(other.calls.slice(4)));
V.del('contacts/K2'); V.del('contacts/never'); V.del('neverType/x');
ok(other.calls.length === 5, 'a delete of a key not there tells nobody', 'heard ' + (other.calls.length - 5) + ' more');

test.subHeading('watch: until unwatched, one reader\'s fault its own');
byPath.off();
V.set('files/a/b.txt', { size: 4 });
ok(byPath.calls.length === 1 && byType.calls.length === 2, 'an unwatched reader hears no more; the others still do',
  'after off: ' + [byPath.calls.length, byType.calls.length]);
let afterThrow = 0;
const offBad = V.watch('prefs', function () { throw new Error('reader fault'); });
const offGood = V.watch('prefs', function () { afterThrow += 1; });
let threw = null;
try { V.set('prefs/theme', 'dark'); } catch (e) { threw = e; }
ok(!threw && afterThrow === 1, 'a watcher that throws costs the next one nothing', 'thrown: ' + threw + ', next heard ' + afterThrow);
offBad(); offGood();
let second = 0;
let offFirst = null;
offFirst = V.watch('prefs', function () { offFirst(); });
const offSecond = V.watch('prefs', function () { second += 1; });
V.set('prefs/a', 1);
V.set('prefs/b', 1);
ok(second === 2, 'a watcher unwatching itself mid-tell does not cost the next one its call', 'second heard ' + second);
offSecond();
const noop = V.watch('prefs', 'not a function');
ok(typeof noop === 'function' && (noop(), true), 'a non-function watch answers a harmless unwatch', 'watch(non-fn) answered ' + typeof noop);

test.subHeading('rows: the branch as a list');
const rs = V.rows('contacts');
ok(rs.length === 1 && rs[0].key === 'K1' && rs[0].name === 'anna', 'one row per key, the key added', 'rows: ' + JSON.stringify(rs));
rs[0].name = 'scribbled';
ok(V.get('contacts/K1').name === 'anna', 'a row is a copy: writing it leaves the tree alone', 'tree written through rows');
ok(Array.isArray(V.rows('empty')) && V.rows('empty').length === 0, 'an empty or unknown branch gives []', 'rows(empty): ' + JSON.stringify(V.rows('empty')));

test.subHeading('seat: a search answer into the tree');
V.seat('people', [{ key: 'P1', label: JSON.stringify({ name: 'pia' }) }, null, { label: '{"name":"nokey"}' },
  { key: 'P2', label: 'not json' }, { key: 'P3', label: '"a string"' }, { key: 'P4', label: 'null' }, { key: 0, label: '{"n":0}' }]);
ok(V.get('people/P1').name === 'pia', 'an item with a JSON object label is seated by its key', 'P1: ' + JSON.stringify(V.get('people/P1')));
ok(Object.keys(T().people).sort().join() === '0,P1', 'null, keyless, not-JSON and non-object labels are skipped; a key of 0 is a key',
  'people: ' + Object.keys(T().people));
V.seat('people', [{ key: 'P1', label: JSON.stringify({ age: 9 }) }]);
ok(V.get('people/P1').name === 'pia' && V.get('people/P1').age === 9, 'a seat merges over what is there', 'P1: ' + JSON.stringify(V.get('people/P1')));
threw = null;
try { V.seat('people'); V.seat('people', null); } catch (e) { threw = e; }
ok(!threw, 'seat with no items is ignored', 'seat() threw ' + threw);

test.subHeading('translate: the types\' own translators');
const jobs = []; const renames = [];
D.addTranslator({ onJob: function () { throw new Error('a type\'s fault'); } });
D.addTranslator({ onJob: function (job, api) { jobs.push([job, api]); }, onRename: function (d, api) { renames.push([d, api]); } });
D.addTranslator(null); D.addTranslator('text');
threw = null;
try {
  D.takeJob({ type: 'x', data: { a: 1 } });
  D.takeJob({ type: 'nodata' }); D.takeJob(null);
  D.takeRename({ key: 'K1', caption: 'c' });
  D.takeRename({ caption: 'nokey' }); D.takeRename(null);
} catch (e) { threw = e; }
ok(!threw, 'take and rename survive a throwing translator and a non-object registration', 'threw ' + threw);
// Every job is handed over, data or none (goal/G41.28: the jobs family's manager keeps them whole); null is not a job.
ok(jobs.length === 2 && jobs[0][0].type === 'x' && jobs[1][0].type === 'nodata' && jobs[0][1] === D, 'take calls onJob(job, api) for every job, data or none, and not for null',
  'jobs: ' + jobs.length);
ok(renames.length === 1 && renames[0][0].key === 'K1' && renames[0][1] === D, 'rename calls onRename(d, api), only when d.key is set',
  'renames: ' + renames.length);

test.subHeading('quietly and ready: a branch filled without telling');
const tree = heard('tree');
const treeKey = heard('tree/x');
const others = heard('contacts');
V.quietly('tree', true);
V.set('tree/x', 1); V.merge('tree/y', { a: 1 }); V.del('tree/x');
V.set('contacts/K9', { name: 'z' });
ok(tree.calls.length === 0 && treeKey.calls.length === 0 && V.get('tree/y').a === 1 && !('x' in T().tree),
  'while quiet the writes land and nobody hears', 'quiet heard: ' + JSON.stringify(tree.calls));
ok(others.calls.length === 1, 'another type still tells while one is quiet', 'contacts heard ' + others.calls.length);
ok(V.ready('tree') === false, 'a branch is not ready until said', 'ready before: ' + V.ready('tree'));
V.ready('tree', true);
ok(V.ready('tree') === true, 'ready(type, true) sets the flag', 'ready after: ' + V.ready('tree'));
ok(tree.calls.length === 1 && tree.calls[0][0] === W('tree') && tree.calls[0][1] === undefined && treeKey.calls.length === 0,
  'ready tells the type\'s watchers once, with (type, undefined)', 'ready heard: ' + JSON.stringify(tree.calls));
V.set('tree/z', 2);
ok(tree.calls.length === 2 && tree.calls[1][0] === W('tree/z'), 'ready ends the quiet: the next write tells', 'after ready: ' + JSON.stringify(tree.calls));
tree.off(); treeKey.off(); others.off(); byType.off(); other.off();

test.subHeading('search: every branch held, ranked, bounded');
D.forgetAll();
V.set('contacts/a', { name: 'anna' });
V.set('contacts/b', { name: 'bert' });
V.set('files/x/anna.txt', { size: 1 });
V.set('prefs/theme', 'dark');
const told = heard('contacts');
const kept = function () { return JSON.stringify(D.allBranches().map(function (b) { return [b, D.branchAt(b)]; })); };
const snapshot = kept();
const r = D.searchAll({ text: 'anna' });
ok(r.items.length === 4 && r.more === false, 'every row of every branch comes back when there is room', 'items: ' + JSON.stringify(r));
ok(r.items[0].key === W('contacts/a') && r.items[0].probability > r.items[1].probability, 'the best match ranks first',
  'order: ' + r.items.map(function (i) { return i.key + '=' + i.probability; }));
ok(r.items.some(function (i) { return i.key === W('files/x/anna.txt') && i.probability > 0; }), 'a row\'s key is weighed too: a path naming the words scores',
  'file: ' + JSON.stringify(r.items));
const miss = r.items.filter(function (i) { return i.key === W('contacts/b'); })[0];
ok(miss && miss.probability === 0, 'a row the words miss still comes back, at 0', 'bert: ' + JSON.stringify(miss));
ok(r.items.every(function (i, n) { return n === 0 || r.items[n - 1].probability >= i.probability; }), 'the items stand best first',
  'probabilities: ' + r.items.map(function (i) { return i.probability; }));
ok(r.items[0].label === '{"name":"anna"}' && r.items.filter(function (i) { return i.key === W('prefs/theme'); })[0].label === '"dark"',
  'the label is the row as JSON, the key the row\'s whole path', 'labels: ' + JSON.stringify(r.items));
ok(kept() === snapshot && told.calls.length === 0, 'search writes nothing and tells nobody', 'heard ' + told.calls.length);
const blank = D.searchAll({});
ok(blank.items.length === 4 && blank.items.every(function (i) { return i.probability === 0; }), 'with no text every row comes back at 0',
  'blank: ' + JSON.stringify(blank.items.map(function (i) { return i.probability; })));
const only = D.searchAll({ text: 'anna', branches: [W('files')] });
ok(only.items.length === 1 && only.items[0].key === W('files/x/anna.txt'), 'branches limits the search to the branches named, by their whole paths',
  'only: ' + JSON.stringify(only.items));
ok(D.searchAll({ text: 'anna', branches: [] }).items.length === 0, 'an empty branches list searches nothing', 'branches [] found rows');
const env = Buffer.byteLength(JSON.stringify({ items: [], more: false }));
const one = Buffer.byteLength(JSON.stringify([r.items[0]]));
const tight = D.searchAll({ text: 'anna', room: env + one + 5 });
ok(tight.items.length === 1 && tight.items[0].key === W('contacts/a') && tight.more === true, 'a small room keeps the best that fit and says more',
  'tight: ' + JSON.stringify(tight));
ok(Buffer.byteLength(JSON.stringify(tight)) <= env + one + 5, 'the whole answer fits the room, in bytes', 'tight is ' + Buffer.byteLength(JSON.stringify(tight)));
const tiny = D.searchAll({ text: 'anna', room: 30 });
ok(tiny.items.length === 0 && tiny.more === true, 'a row too big for the room alone is left out and said by more', 'tiny: ' + JSON.stringify(tiny));
V.set('notes/big', { body: 'é'.repeat(9000) });
const big = D.searchAll({ text: 'anna' });
ok(big.more === true && !big.items.some(function (i) { return i.key === W('notes/big'); }) && big.items.length === 4,
  'by default a row over the answer limit is left out, in bytes, the rest kept', 'big: ' + big.items.length + ' more ' + big.more);
told.off();

// ── THE CACHE'S LIFE (goal/G41.3, Q2) ────────────────────────────────────────────────────────────────────────────
// A page's copy: the same file in a vm of its own, a browser by spirit.isBrowser, its stream a recorder of handlers.
function pageCopy() {
  const vm = require('vm');
  const h = {};
  const win = { spirit: { node: { key: NODE }, isBrowser: function () { return true; }, event: { subscribe: function (x) { Object.assign(h, x); return function () {}; } } } };
  win.window = win;
  vm.runInNewContext(require('fs').readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  // P is the page's view of the family, as its manager addresses it; P.whole the page's data set itself.
  const view = win.spirit.data.viewAt(NODE, FAMILY);
  view.whole = win.spirit.data;
  return { P: view, stream: h };
}
// A translator writing each job it is handed to job/<id>, and recording what it got.
function recorder() {
  const got = { jobs: [], renames: [] };
  return { got: got, t: { onJob: function (job, d) { got.jobs.push(job); d.viewAt(job.fromNode, FAMILY).set('job/' + job.id, job.data); }, onRename: function (r) { got.renames.push(r); } } };
}

test.subHeading('forget: everything kept goes, and each type is told once');
V.set('files/x', { size: 1 }); V.set('contacts/y', { name: 'y' }); V.ready('files', true);
const forgot = heard('files');
ok(typeof D.forgetAll === 'function', 'forget is part of the api', 'there is no forget');
if (typeof D.forgetAll === 'function') {
  D.forgetAll();
  // Every branch the tree holds, node by node and family by family: forget empties each.
  const branches = D.allBranches().map(function (b) { return D.branchAt(b); });
  ok(branches.length > 0 && branches.every(function (b) { return !Object.keys(b).length; }) && V.ready('files') === false,
    'every branch is empty and no type is ready', 'after forget: ' + JSON.stringify({ data: kept(), ready: V.ready('files') }));
  ok(forgot.calls.length === 1 && forgot.calls[0][0] === W('files') && forgot.calls[0][1] === undefined, 'a type\'s watcher is told once, (type, undefined)',
    'files watcher heard: ' + JSON.stringify(forgot.calls));
}
forgot.off();

test.subHeading('on a page a snapshot is a connect: the cache forgets, and takes the partner\'s whole push');
{
  const { P, stream } = pageCopy();
  const r = recorder();
  P.whole.addTranslator(r.t);
  stream.onSnapshot([{ id: 'a', data: { n: 1 } }, { id: 'b', data: { n: 1 } }]);
  P.seat('contacts', [{ key: 'K', label: JSON.stringify({ name: 'k' }) }]);
  stream.onSnapshot([{ id: 'a', data: { n: 2 } }]);
  ok(P.get('job/a') && P.get('job/a').n === 2 && P.get('job/b') === undefined && P.get('contacts/K') === undefined,
    'what the first connect brought or a search seated is gone, what the second pushed is there',
    'after a second snapshot: ' + JSON.stringify(P.whole.data));
}

test.subHeading('on a page a type loaded late is handed its data whole');
{
  const { P, stream } = pageCopy();
  stream.onSnapshot([{ id: 'a', data: { n: 1 } }]);
  stream.onUpdate({ id: 'a', data: { n: 2 } });
  stream.onUpdate({ id: 'c', data: { n: 1 } });
  stream.onContactRename({ key: 'K', label: 'kay' });
  const r = recorder();
  P.whole.addTranslator(r.t);
  const ids = r.got.jobs.map(function (j) { return j.id + ':' + j.data.n; }).sort().join(',');
  ok(ids === 'a:2,c:1', 'its translator is handed every job as it now stands, each once', 'the late translator got ' + ids);
  ok(r.got.renames.length === 1 && r.got.renames[0].label === 'kay', 'and the renames heard', 'renames: ' + JSON.stringify(r.got.renames));
  ok((P.get('job/a') || {}).n === 2 && (P.get('job/c') || {}).n === 1, 'so its branch is whole at once', 'jobs: ' + JSON.stringify(P.branch('job')));
}

test.subHeading('in a process the cache sheds oldest first past a byte cap; a page keeps everything');
ok(typeof D.byteCap === 'function' && D.byteCap() > 0 && isFinite(D.byteCap()), 'in a process the cache has a cap, in bytes', 'the process cap is ' + (typeof D.byteCap === 'function' ? D.byteCap() : 'missing'));
if (typeof D.byteCap === 'function') {
  const was = D.byteCap();
  D.forgetAll();
  D.byteCap(300);
  const shed = heard('big');
  for (let i = 1; i <= 10; i++) V.set('big/' + i, { body: 'x'.repeat(40) });
  const kept = Object.keys(T().big || {});
  const bytes = kept.reduce(function (n, k) { return n + Buffer.byteLength(k) + Buffer.byteLength(JSON.stringify(T().big[k])); }, 0);
  ok(kept.length > 0 && kept.length < 10 && kept.indexOf('10') !== -1 && kept.indexOf('1') === -1 && bytes <= 300,
    'past the cap the oldest writes go first, the newest stay, within the cap', 'kept: ' + kept.join(',') + ', ' + bytes + ' bytes');
  ok(shed.calls.some(function (c) { return c[0] === W('big/1') && c[1] === undefined; }), 'a row shed is told as a delete', 'heard: ' + JSON.stringify(shed.calls.slice(0, 3)));
  const oldest = kept[0];
  V.set('big/' + oldest, { body: 'y' });
  V.set('big/11', { body: 'x'.repeat(40) });
  ok(V.get('big/' + oldest) && V.get('big/' + oldest).body === 'y', 'a row written again is newest again', 'big/' + oldest + ' is ' + JSON.stringify(V.get('big/' + oldest)));
  shed.off();
  D.byteCap(was);
  const { P } = pageCopy();
  ok(typeof P.whole.byteCap === 'function' && P.whole.byteCap() === Infinity, 'on a page there is no cap (box v17)', 'the page cap is ' + (typeof P.whole.byteCap === 'function' ? P.whole.byteCap() : 'missing'));
}

// THE CACHES PART, once data-caches.js.
function cachesPart() {
  // Once spirit/run/spirit/test/data-caches.js.
  // ONE CACHE CODE IN THE BROWSER AND IN NODE, THE DATA SET'S SIDE (goal/G41.28; spec: ./data.md). A test by name of
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
  const vm = require('vm');

  const RUN = path.resolve(__dirname, '..', '..');
  const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
  const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
  // An app of spirit/app/<name>/ keeps its family and its manager at its top (goal/G43.27).
  function managerOf(name) {
    if (fs.existsSync(path.join(RUN, 'spirit', 'app', name, 'api.js'))) return 'spirit/app/' + name + '/data.js';
    return 'spirit/' + name + '/data.js';
  }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  // A file tracked but not on disk reads as empty, so a deletion not yet committed is judged and never crashes the report.
  function code(file) { let t = ''; try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
  // NOBODY ADDS A FAMILY PAST THE RULES (goal/G43.32; Andy: "make sure nobody can add an app implementing a family, without
  // adhering to the rules, this means that a test outside of each branch must assert this."): the tree is every file git
  // keeps and every file not yet added that git does not ignore, so a new app's family is judged before it is committed.
  const tracked = require('child_process').execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);

  test.subHeading('data-caches: caches: one cache code in the browser and in node, the data set\'s side');

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
  ok(!node.threw && Object.keys(node).length > 0, 'in node, as appServer runs it, the rows land in spirit.data.desk.cache', 'in node: ' + short(node));
  ok(!page.threw && Object.keys(page).length > 0, 'in a page, as a page runs it, the rows land in spirit.data.desk.cache', 'in a page: ' + short(page));
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
  const takers = clients.filter(function (f) { return /\bevent\.subscribe\(|\bev\.subscribe\(/.test(code(path.join(RUN, f))); });
  ok(!takers.length, 'no client takes the node\'s stream itself: spirit/data.js takes it for all', 'clients taking the stream themselves, their rows outside spirit.data: ' + short(takers));
  // "any notion that there is an alternative approach must disappear from all documentation and all comments in the
  // entire repo." The ways replaced, by name: the data set's old places, the desk's old translator file, the two-level
  // branches the desk kept before the tree was by node, and a page or client that runs "uncached", without them. Andy's vault is no documentation of the
  // repo's code; this file and its spec name them to find them.
  const REPO = path.join(RUN, '..', '..');
  const OLD = [/\buncached\b/i, /['"]deskItems?\//, /['"]deskState\//, /\bD\.data\.(files|contacts|desk)\b/];
  const every = require('child_process').execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) {
    return f && /\.(js|md|html|json)$/.test(f) && !/^spirit\/run\/brains\//.test(f) && f !== 'spirit/run/spirit/test/data.js' && f !== 'spirit/run/spirit/test/data.md';
  });
  const naming = every.filter(function (f) { let t = ''; try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; } return OLD.some(function (re) { return re.test(t); }); });
  ok(!naming.length, 'no file in the repo names a replaced way: running uncached, the two-level desk branches',
    naming.length + ' files still name one: ' + short(naming));

  // ── 6. FOUND BY INTROSPECTION ───────────────────────────────────────────────────────────────────────────────────────
  test.subHeading('6. the shell finds a family\'s manager by the folder shape (goal/G43.27)');
  ok(/['"]data\.js['"]/.test(spiritJs), 'spirit.js knows where a family\'s data.js lives, so a page finds it by the family\'s name', 'spirit.js names no data.js: a page cannot find a family\'s data.js by itself');
  // That the node serves each family's manager, and a page asking by the name gets it, is a rule of every branch, judged
  // on each branch folder in ./spirit-sibling-branchRules.js (goal/G43.32).
}

// THE FAMILIES PART, once data-families.js.
async function familiesPart() {
  // Once spirit/run/spirit/test/data-families.js.
  // The tests of goal/G43.7 (spec: ./data.md). Andy, the box: "we rename it spirit/data.js and it IS the the spirit.data
  // object", "ALL "clientCacheManager.js" files will be converted to "data.js" files with the SAME pattern." Every check is per
  // family, so the count of what is owed falls as each family moves.

  const fs = require('fs');
  const RUN = path.resolve(__dirname, '../..');
  const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

  // Andy on Q2: "yes, of course all 19". Q1: each under the family's own name.
  const NODE_FAMILIES = ['app', 'auth', 'config', 'contact', 'event', 'fs', 'job', 'net', 'node', 'owner', 'peer', 'relay'];
  // fileServer went with run://process (goal/G43.20), so 18 are left.
  const SERVER_FAMILIES = ['agent', 'backup', 'chat', 'desk', 'deskClient', 'deskVerify'];
  const FAMILIES = NODE_FAMILIES.concat(SERVER_FAMILIES);
  // A server's branch is its app's folder, spirit/app/<name>/ (goal/G43.20), named as the folder (goal/G43.31: chat, once chatClerver).
  const folderOf = function (name) { return NODE_FAMILIES.indexOf(name) !== -1 ? path.join(RUN, 'spirit', name) : path.join(RUN, 'spirit', 'app', name); };
  // The old spirit.<name>Data: chatData was the chat server's, verifyData deskVerify's.
  const OLD_READER = /(?:\b|\.)(?:agent|app|auth|backup|chat|chatClerver|config|contact|desk|deskClient|deskVerify|events|fileServer|fs|jobs|net|node|owner|peer|relay|verify)Data\b/;
  // A retired name's parts, so this file does not hold it whole.
  const OLD_MANAGER = 'clientCache' + 'Manager';
  const OLD_MODULE = 'spirit' + 'Data';

  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  // Code only: a comment may quote Andy, and his words are never rewritten.
  function code(text) { return String(text).split(/\r?\n/).map(function (l) { return l.replace(/(^|\s)\/\/.*$/, ''); }).join('\n'); }

  function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      const at = path.join(dir, e.name);
      if (VENDORED_FOLDERS.holds(at) || e.name === 'brains' || e.name === 'app-state' || e.name === 'state' || e.name === 'media' || e.name === 'published') return;
      if (e.isDirectory()) walk(at, out); else out.push(at);
    });
    return out;
  }

  test.subHeading('data-families: spirit.data: every family at spirit.data.<name>, through spirit/data.js (goal/G43.7)');

  await (async function () {
    const files = walk(RUN, []);
    const rel = function (f) { return path.relative(RUN, f); };

    test.subHeading('the box: "we rename it spirit/data.js"');
    ok(fs.existsSync(path.join(RUN, 'spirit', 'data.js')), 'spirit/data.js stands', 'spirit/data.js is missing');
    ok(!fs.existsSync(path.join(RUN, 'spirit', OLD_MODULE + '.js')), 'the old module is gone', 'spirit/' + OLD_MODULE + '.js still stands');

    test.subHeading('the box: "ALL ... files will be converted to "data.js" files"');
    const pattern = {};
    // Each family's own (its data.js there, the old file gone, none of it rolled by hand, data and cache in node and on a
    // page) is judged on each branch folder by ./spirit-sibling-branchRules.js (goal/G43.32). Here, that they share one helper.
    FAMILIES.forEach(function (name) {
      const file = path.join(folderOf(name), 'data.js');
      if (!fs.existsSync(file)) return;
      const text = code(fs.readFileSync(file, 'utf8'));
      const called = new RegExp('\\.([A-Za-z]+)\\(\\s*[\'"]' + name + '[\'"]').exec(text);
      if (called) pattern[name] = called[1];
    });
    test.subHeading('the box: "with the SAME pattern": one helper of spirit.data, called with the family\'s own name');
    const helpers = Object.keys(pattern).map(function (n) { return pattern[n]; }).filter(function (h, i, all) { return all.indexOf(h) === i; });
    ok(Object.keys(pattern).length === FAMILIES.length, 'all eighteen families call a helper with their own name', 'these do not: ' + FAMILIES.filter(function (n) { return !pattern[n]; }).join(', '));
    ok(helpers.length === 1, 'and it is the one helper', 'not one helper: ' + short(helpers));

    test.subHeading('the box: "instead of spirit.<name>Data": nothing in the tree\'s code says the old names');
    const offenders = { reader: [], manager: [], module: [] };
    files.filter(function (f) { return /\.(js|html)$/.test(f) && f !== __filename; }).forEach(function (f) {
      const text = code(fs.readFileSync(f, 'utf8'));
      if (OLD_READER.test(text)) offenders.reader.push(rel(f));
      if (text.indexOf(OLD_MANAGER) !== -1) offenders.manager.push(rel(f));
      if (text.indexOf(OLD_MODULE) !== -1) offenders.module.push(rel(f));
    });
    const say = function (l) { return l.length + ': ' + l.slice(0, 6).join(', ') + (l.length > 6 ? ', ...' : ''); };
    ok(!offenders.reader.length, 'no code reads a spirit.<name>Data', 'code that reads a spirit.<name>Data, ' + say(offenders.reader));
    ok(!offenders.manager.length, 'no code names the old cache manager', 'code that names ' + OLD_MANAGER + ', ' + say(offenders.manager));
    ok(!offenders.module.length, 'no code names the old data module', 'code that names ' + OLD_MODULE + ', ' + say(offenders.module));

    // ── ON A PAGE ───────────────────────────────────────────────────────────────────
    const chrome = H.findChrome();
    const node = await H.scratchNode();
    let page = null;
    try {
      page = chrome && node.up ? await H.chromePage(chrome) : null;
      if (!page || page.error) { test.fail('no browser to ask: ' + short(page ? page.error : 'no Chrome, or the scratch node did not come up')); return; }
      await page.send('Page.navigate', { url: node.base + '/' });
      await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
      await page.evaluate('window.spirit.ready.then(function () { return true; })').catch(function () { return false; });
      await H.sleep(2500);
      const ask = async function (js) { try { return JSON.parse(await page.evaluate(js)); } catch (e) { return { threw: String(e) }; } };
      const got = await ask('(function () { var S = window.spirit; var names = ' + JSON.stringify(FAMILIES) + ';' +
        ' return Promise.all(names.map(function (n) { return Promise.resolve(S.cacheManager(n)).then(null, function () { return null; }); })).then(function () {' +
        ' var D = S.data || {}; var out = { first: Object.keys(S), keys: {}, families: {} };' +
        ' Object.keys(D).forEach(function (k) { out.keys[k] = typeof D[k]; });' +
        ' names.forEach(function (n) { var f = D[n]; out.families[n] = { data: f && typeof f.data, cache: f && typeof f.cache }; });' +
        ' return JSON.stringify(out); }); })()');
      if (got.threw) { test.fail('the page answered nothing: ' + short(got)); return; }

      test.subHeading('the box: "de-clutter": the first level of spirit holds no <name>Data');
      const left = got.first.filter(function (k) { return /Data$/.test(k); });
      ok(!left.length, 'none is left', 'still on spirit: ' + left.join(', '));

      test.subHeading('the box: "this object has only helper functions and object <name> for every application"');
      const stray = Object.keys(got.keys).filter(function (k) { return got.keys[k] !== 'function' && FAMILIES.indexOf(k) === -1; });
      ok(Object.keys(got.keys).some(function (k) { return got.keys[k] === 'function'; }), 'spirit.data has its helper functions', 'spirit.data has no function: ' + short(got.keys));
      ok(!stray.length, 'and nothing else but the families', 'on spirit.data besides helpers and families: ' + stray.join(', '));
      // Andy: "all the helperFunctions in objects like spirit.data should potential "words" the should have a capital in it like
      // spirit.data.helper**F**unction()", and on Q10: "it belongs to "Fix 'data'", THIS item." A word is a to z, so no family can land on one.
      const asWords = Object.keys(got.keys).filter(function (k) { return got.keys[k] === 'function' && !/[A-Z]/.test(k); });
      ok(!asWords.length, 'every helper has a capital, so none is a word', 'helpers that are valid words, ' + asWords.length + ': ' + asWords.join(', '));

      // Andy: "the helpes must not be words there either, this goes for all spirit.app contained objects."
      test.subHeading('spirit.app: no helper is a word, on it or on an app it holds');
      const onApp = await ask('(function () { var S = window.spirit; return Promise.all(["spirit/app/monitor/element.js"].map(function (p) { return Promise.resolve(S.require(p)).then(null, function () { return null; }); })).then(function () {' +
        ' var out = { keys: Object.keys(S.app || {}), words: [] };' +
        ' out.keys.forEach(function (k) { var v = S.app[k]; if (typeof v === "function" && !/[A-Z]/.test(k)) out.words.push(k);' +
        ' else if (k !== "FS" && v && typeof v === "object") Object.keys(v).forEach(function (h) { if (typeof v[h] === "function" && !/[A-Z]/.test(h)) out.words.push(k + "." + h); }); });' +
        ' out.apps = out.keys.filter(function (k) { return S.app[k] && typeof S.app[k].createApp === "function"; });' +
        ' return JSON.stringify(out); }); })()');
      // goal/G43.32, the box: "Monitor too: its createApp becomes its element.js, and appSelector's createApp path goes."
      ok(Array.isArray(onApp.apps) && !onApp.apps.length && Array.isArray(onApp.keys) && onApp.keys.length > 0, 'the world: spirit.app holds keys, and no app with a createApp (monitor\'s is its element.js)', 'on spirit.app: ' + short(onApp));
      ok(Array.isArray(onApp.words) && !onApp.words.length, 'and no helper there is a word', 'helpers on spirit.app that are words: ' + short(onApp.words || onApp));

      // Q5, "Does spirit.data.<name>.cache hold a level per node, as the tree does today?", Andy: "yes."
      test.subHeading('Q5: .cache holds a level per node');
      await H.until(function () { return page.evaluate('(function () { var a = (window.spirit.data || {}).app; var c = a && a.cache && a.cache[window.spirit.data.homeNode()]; return !!(c && c.apps && Object.keys(c.apps).length); })()').then(Boolean); }, 8000).catch(function () { return false; });
      const cached = await ask('(function () { var D = window.spirit.data || {}; var a = D.app || {}; var c = a.cache || {}; var home = typeof D.homeNode === "function" ? D.homeNode() : ""; var r = { home: !!home, apps: Object.keys((c[home] || {}).apps || {}).length };' +
        ' try { D.viewAt("othernode", "app").set("apps/onlythere", { key: "onlythere" }); } catch (e) { r.threw = String(e); }' +
        ' r.there = !!(((c.othernode || {}).apps || {}).onlythere); r.notHome = !((c[home] || {}).apps || {}).onlythere;' +
        ' return JSON.stringify(r); })()');
      ok(cached.home && cached.apps > 0, 'the app rows stand under this page\'s node', 'spirit.data.app.cache[home].apps: ' + short(cached));
      ok(cached.there === true, 'a row of another node stands under that node', 'a row of another node: ' + short(cached));
      ok(cached.notHome === true, 'and not under this page\'s', 'a row of another node under the home node: ' + short(cached));

      test.subHeading('the reads moved with it: spirit.data.<name>.data answers what spirit.<name>Data did');
      const reads = await ask('(function () { var D = window.spirit.data || {}; var a = (D.app || {}).data || {}; var f = (D.fs || {}).data || {}; return JSON.stringify({ rows: typeof a.rows, watch: typeof a.watch, count: typeof a.rows === "function" ? Object.keys(a.rows()).length : 0, fsWatch: typeof f.watch }); })()');
      ok(reads.rows === 'function' && reads.watch === 'function' && reads.count > 0, 'spirit.data.app.data reads the app rows', 'spirit.data.app.data: ' + short(reads));
      ok(reads.fsWatch === 'function', 'spirit.data.fs.data.watch stands, which word.js follows', 'spirit.data.fs.data: ' + short(reads));
    } finally {
      if (page && page.kid) page.kid.kill();
      if (node.child) node.child.kill();
      try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
      try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    }
  }());
}

(async function () {
  for (const p of [['caches', cachesPart], ['families', familiesPart]]) {
    try { await p[1](); } catch (e) { test.fail('the ' + p[0] + ' part threw ' + (e && e.stack || e)); }
  }
  test.reportSuccessFailureCount();
  process.exit(process.exitCode || 0);
}());
