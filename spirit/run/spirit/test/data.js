'use strict';

// spirit/run/spirit/test/data.js
// The tests of spirit/data.js, and of no other module (spec: ./data.md). The faceless layer runs in node:
// required, it answers its api and ranks with the spirit's own probability files.

const path = require('path');
const test = require(path.join(path.resolve(__dirname, '../..'), 'test', 'testReport.js'));

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
  const win = { spirit: { node: { key: NODE }, isBrowser: function () { return true; }, events: { subscribe: function (x) { Object.assign(h, x); return function () {}; } } } };
  win.window = win;
  vm.runInNewContext(require('fs').readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  // P is the page's view of the family, as its manager addresses it; P.whole the page's data set itself.
  const view = win.spirit.data.viewAt(NODE, FAMILY);
  view.whole = win.spirit.data;
  return { P: view, stream: h };
}
// A translator writing each job it is handed to jobs/<id>, and recording what it got.
function recorder() {
  const got = { jobs: [], renames: [] };
  return { got: got, t: { onJob: function (job, d) { got.jobs.push(job); d.viewAt(job.fromNode, FAMILY).set('jobs/' + job.id, job.data); }, onRename: function (r) { got.renames.push(r); } } };
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
  ok(P.get('jobs/a') && P.get('jobs/a').n === 2 && P.get('jobs/b') === undefined && P.get('contacts/K') === undefined,
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
  ok((P.get('jobs/a') || {}).n === 2 && (P.get('jobs/c') || {}).n === 1, 'so its branch is whole at once', 'jobs: ' + JSON.stringify(P.branch('jobs')));
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
    'past the cap the oldest writes go first, the newest stay, within the cap (' + kept.length + ' kept, ' + bytes + ' bytes)', 'kept: ' + kept.join(',') + ', ' + bytes + ' bytes');
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

test.reportSuccessFailureCount();
