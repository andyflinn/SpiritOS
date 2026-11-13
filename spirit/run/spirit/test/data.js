'use strict';

// spirit/run/spirit/test/data.js
// The tests of spirit/data.js, and of no other module (spec: ./data.md). The faceless layer runs in node:
// required, it answers its api and ranks with the spirit's own probability files.
// The one test file of data.js: the caches part (one cache code in the browser and in node) and the families part
// (every family at spirit.data.<name>, goal/G43.7), once data-caches.js and data-families.js, are sections of it, run
// after its own checks.
// One test.run per test (goal/G47.2): the tests run one at a time in the order written, so what a test writes is what the
// next one reads; the writes of each step sit in the body of the test that judges them.

const path = require('path');
const test = require(path.join(path.resolve(__dirname, '../..'), 'spirit', 'test', 'testReport.js'));

const D = require(path.join(__dirname, '..', 'data.js'));

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

// What one test leaves for the next.
let byPath, byType, other, before, last, afterThrow, threw, second, rs, tree, treeKey, others, told, kept, snapshot, r, env, one, tight, forgot;

// set and get: one write, by path
test.run('a key may hold slashes: everything after the first / is the key', 0.2, function () {
  byPath = heard('files/a/b.txt');
  byType = heard('files');
  other = heard('contacts');
  V.set('files/a/b.txt', { size: 3 });
  return V.get('files/a/b.txt').size === 3 && T().files['a/b.txt'].size === 3 ? true : 'stored: ' + JSON.stringify(T().files);
}, test.limit.quick);
test.run('the path\'s watcher is told (path, value)', 0.2, function () {
  return byPath.calls.length === 1 && byPath.calls[0][0] === W('files/a/b.txt') && byPath.calls[0][1].size === 3 ? true : 'path watcher: ' + JSON.stringify(byPath.calls);
}, test.limit.quick);
test.run('the type\'s watcher is told of any key of it', 0.2, function () {
  return byType.calls.length === 1 && byType.calls[0][0] === W('files/a/b.txt') ? true : 'type watcher: ' + JSON.stringify(byType.calls);
}, test.limit.quick);
test.run('another type\'s watcher hears nothing', 0.2, function () {
  return other.calls.length === 0 ? true : 'contacts heard: ' + JSON.stringify(other.calls);
}, test.limit.quick);
test.run('a bare type gets the branch', 0.2, function () {
  return V.get('files') === T().files ? true : 'get(type) is not the branch';
}, test.limit.quick);
test.run('a path without a key writes nothing and tells nobody', 0.2, function () {
  V.set('files', 1); V.set('files/', 2); V.set('', 3); D.setPath(null, 4);
  return byType.calls.length === 1 && !('' in T().files) && !('' in D) ? true
    : 'keyless set: ' + JSON.stringify({ calls: byType.calls.length, files: Object.keys(T().files), data: D.allBranches() });
}, test.limit.quick);
test.run('a missing key reads undefined; a missing branch answers empty', 0.2, function () {
  return V.get('nosuch/key') === undefined && Object.keys(V.branch('fresh') || {}).length === 0 && V.rows('fresh').length === 0 ? true
    : 'missing: ' + JSON.stringify(V.get('nosuch/key'));
}, test.limit.quick);

// merge: new fields over the old
test.run('merge keeps the fields it does not name', 0.2, function () {
  V.set('contacts/K1', { name: 'ann', present: true });
  V.merge('contacts/K1', { name: 'anna' });
  return V.get('contacts/K1').name === 'anna' && V.get('contacts/K1').present === true ? true : 'merged: ' + JSON.stringify(V.get('contacts/K1'));
}, test.limit.quick);
test.run('merge on a missing key starts from {}', 0.2, function () {
  V.merge('contacts/K2', { name: 'bo' });
  return JSON.stringify(V.get('contacts/K2')) === '{"name":"bo"}' ? true : 'K2: ' + JSON.stringify(V.get('contacts/K2'));
}, test.limit.quick);
test.run('merge writes a new value, the old object untouched', 0.2, function () {
  before = V.get('contacts/K1');
  V.merge('contacts/K1', { x: 1 });
  return before.x === undefined && V.get('contacts/K1') !== before ? true : 'old object written: ' + JSON.stringify(before);
}, test.limit.quick);
test.run('every merge tells the watchers once', 0.2, function () {
  return other.calls.length === 4 ? true : 'contacts heard ' + other.calls.length;
}, test.limit.quick);

// del: the other write
test.run('del removes the key', 0.2, function () {
  V.del('contacts/K2');
  return !('K2' in T().contacts) ? true : 'K2 still there';
}, test.limit.quick);
test.run('del tells the watchers with undefined', 0.2, function () {
  last = other.calls[other.calls.length - 1];
  return other.calls.length === 5 && last[0] === W('contacts/K2') && last[1] === undefined && last.length === 2 ? true
    : 'del heard: ' + JSON.stringify(other.calls.slice(4));
}, test.limit.quick);
test.run('a delete of a key not there tells nobody', 0.2, function () {
  V.del('contacts/K2'); V.del('contacts/never'); V.del('neverType/x');
  return other.calls.length === 5 ? true : 'heard ' + (other.calls.length - 5) + ' more';
}, test.limit.quick);

// watch: until unwatched, one reader's fault its own
test.run('an unwatched reader hears no more; the others still do', 0.2, function () {
  byPath.off();
  V.set('files/a/b.txt', { size: 4 });
  return byPath.calls.length === 1 && byType.calls.length === 2 ? true : 'after off: ' + [byPath.calls.length, byType.calls.length];
}, test.limit.quick);
test.run('a watcher that throws costs the next one nothing', 0.2, function () {
  afterThrow = 0;
  const offBad = V.watch('prefs', function () { throw new Error('reader fault'); });
  const offGood = V.watch('prefs', function () { afterThrow += 1; });
  threw = null;
  try { V.set('prefs/theme', 'dark'); } catch (e) { threw = e; }
  offBad(); offGood();
  return !threw && afterThrow === 1 ? true : 'thrown: ' + threw + ', next heard ' + afterThrow;
}, test.limit.quick);
test.run('a watcher unwatching itself mid-tell does not cost the next one its call', 0.2, function () {
  second = 0;
  let offFirst = null;
  offFirst = V.watch('prefs', function () { offFirst(); });
  const offSecond = V.watch('prefs', function () { second += 1; });
  V.set('prefs/a', 1);
  V.set('prefs/b', 1);
  offSecond();
  return second === 2 ? true : 'second heard ' + second;
}, test.limit.quick);
test.run('a non-function watch answers a harmless unwatch', 0.2, function () {
  const noop = V.watch('prefs', 'not a function');
  return typeof noop === 'function' && (noop(), true) ? true : 'watch(non-fn) answered ' + typeof noop;
}, test.limit.quick);

// rows: the branch as a list
test.run('one row per key, the key added', 0.2, function () {
  rs = V.rows('contacts');
  return rs.length === 1 && rs[0].key === 'K1' && rs[0].name === 'anna' ? true : 'rows: ' + JSON.stringify(rs);
}, test.limit.quick);
test.run('a row is a copy: writing it leaves the tree alone', 0.2, function () {
  rs[0].name = 'scribbled';
  return V.get('contacts/K1').name === 'anna' ? true : 'tree written through rows';
}, test.limit.quick);
test.run('an empty or unknown branch gives []', 0.2, function () {
  return Array.isArray(V.rows('empty')) && V.rows('empty').length === 0 ? true : 'rows(empty): ' + JSON.stringify(V.rows('empty'));
}, test.limit.quick);

// seat: a search answer into the tree
test.run('an item with a JSON object label is seated by its key', 0.2, function () {
  V.seat('people', [{ key: 'P1', label: JSON.stringify({ name: 'pia' }) }, null, { label: '{"name":"nokey"}' },
    { key: 'P2', label: 'not json' }, { key: 'P3', label: '"a string"' }, { key: 'P4', label: 'null' }, { key: 0, label: '{"n":0}' }]);
  return V.get('people/P1').name === 'pia' ? true : 'P1: ' + JSON.stringify(V.get('people/P1'));
}, test.limit.quick);
test.run('null, keyless, not-JSON and non-object labels are skipped; a key of 0 is a key', 0.2, function () {
  return Object.keys(T().people).sort().join() === '0,P1' ? true : 'people: ' + Object.keys(T().people);
}, test.limit.quick);
test.run('a seat merges over what is there', 0.2, function () {
  V.seat('people', [{ key: 'P1', label: JSON.stringify({ age: 9 }) }]);
  return V.get('people/P1').name === 'pia' && V.get('people/P1').age === 9 ? true : 'P1: ' + JSON.stringify(V.get('people/P1'));
}, test.limit.quick);
test.run('seat with no items is ignored', 0.2, function () {
  threw = null;
  try { V.seat('people'); V.seat('people', null); } catch (e) { threw = e; }
  return !threw ? true : 'seat() threw ' + threw;
}, test.limit.quick);

// translate: the types' own translators
const jobs = []; const renames = [];
test.run('take and rename survive a throwing translator and a non-object registration', 0.2, function () {
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
  return !threw ? true : 'threw ' + threw;
}, test.limit.quick);
// Every job is handed over, data or none (goal/G41.28: the jobs family's manager keeps them whole); null is not a job.
test.run('take calls onJob(job, api) for every job, data or none, and not for null', 0.2, function () {
  return jobs.length === 2 && jobs[0][0].type === 'x' && jobs[1][0].type === 'nodata' && jobs[0][1] === D ? true : 'jobs: ' + jobs.length;
}, test.limit.quick);
test.run('rename calls onRename(d, api), only when d.key is set', 0.2, function () {
  return renames.length === 1 && renames[0][0].key === 'K1' && renames[0][1] === D ? true : 'renames: ' + renames.length;
}, test.limit.quick);

// quietly and ready: a branch filled without telling
test.run('while quiet the writes land and nobody hears', 0.2, function () {
  tree = heard('tree');
  treeKey = heard('tree/x');
  others = heard('contacts');
  V.quietly('tree', true);
  V.set('tree/x', 1); V.merge('tree/y', { a: 1 }); V.del('tree/x');
  V.set('contacts/K9', { name: 'z' });
  return tree.calls.length === 0 && treeKey.calls.length === 0 && V.get('tree/y').a === 1 && !('x' in T().tree) ? true
    : 'quiet heard: ' + JSON.stringify(tree.calls);
}, test.limit.quick);
test.run('another type still tells while one is quiet', 0.2, function () {
  return others.calls.length === 1 ? true : 'contacts heard ' + others.calls.length;
}, test.limit.quick);
test.run('a branch is not ready until said', 0.2, function () {
  return V.ready('tree') === false ? true : 'ready before: ' + V.ready('tree');
}, test.limit.quick);
test.run('ready(type, true) sets the flag', 0.2, function () {
  V.ready('tree', true);
  return V.ready('tree') === true ? true : 'ready after: ' + V.ready('tree');
}, test.limit.quick);
test.run('ready tells the type\'s watchers once, with (type, undefined)', 0.2, function () {
  return tree.calls.length === 1 && tree.calls[0][0] === W('tree') && tree.calls[0][1] === undefined && treeKey.calls.length === 0 ? true
    : 'ready heard: ' + JSON.stringify(tree.calls);
}, test.limit.quick);
test.run('ready ends the quiet: the next write tells', 0.2, function () {
  V.set('tree/z', 2);
  const fine = tree.calls.length === 2 && tree.calls[1][0] === W('tree/z');
  const why = 'after ready: ' + JSON.stringify(tree.calls);
  tree.off(); treeKey.off(); others.off(); byType.off(); other.off();
  return fine ? true : why;
}, test.limit.quick);

// search: every branch held, ranked, bounded
kept = function () { return JSON.stringify(D.allBranches().map(function (b) { return [b, D.branchAt(b)]; })); };
test.run('every row of every branch comes back when there is room', 0.2, function () {
  D.forgetAll();
  V.set('contacts/a', { name: 'anna' });
  V.set('contacts/b', { name: 'bert' });
  V.set('files/x/anna.txt', { size: 1 });
  V.set('prefs/theme', 'dark');
  told = heard('contacts');
  snapshot = kept();
  r = D.searchAll({ text: 'anna' });
  return r.items.length === 4 && r.more === false ? true : 'items: ' + JSON.stringify(r);
}, test.limit.quick);
test.run('the best match ranks first', 0.2, function () {
  return r.items[0].key === W('contacts/a') && r.items[0].probability > r.items[1].probability ? true
    : 'order: ' + r.items.map(function (i) { return i.key + '=' + i.probability; });
}, test.limit.quick);
test.run('a row\'s key is weighed too: a path naming the words scores', 0.2, function () {
  return r.items.some(function (i) { return i.key === W('files/x/anna.txt') && i.probability > 0; }) ? true : 'file: ' + JSON.stringify(r.items);
}, test.limit.quick);
test.run('a row the words miss still comes back, at 0', 0.2, function () {
  const miss = r.items.filter(function (i) { return i.key === W('contacts/b'); })[0];
  return miss && miss.probability === 0 ? true : 'bert: ' + JSON.stringify(miss);
}, test.limit.quick);
test.run('the items stand best first', 0.2, function () {
  return r.items.every(function (i, n) { return n === 0 || r.items[n - 1].probability >= i.probability; }) ? true
    : 'probabilities: ' + r.items.map(function (i) { return i.probability; });
}, test.limit.quick);
test.run('the label is the row as JSON, the key the row\'s whole path', 0.2, function () {
  return r.items[0].label === '{"name":"anna"}' && r.items.filter(function (i) { return i.key === W('prefs/theme'); })[0].label === '"dark"' ? true
    : 'labels: ' + JSON.stringify(r.items);
}, test.limit.quick);
test.run('search writes nothing and tells nobody', 0.2, function () {
  return kept() === snapshot && told.calls.length === 0 ? true : 'heard ' + told.calls.length;
}, test.limit.quick);
test.run('with no text every row comes back at 0', 0.2, function () {
  const blank = D.searchAll({});
  return blank.items.length === 4 && blank.items.every(function (i) { return i.probability === 0; }) ? true
    : 'blank: ' + JSON.stringify(blank.items.map(function (i) { return i.probability; }));
}, test.limit.quick);
test.run('branches limits the search to the branches named, by their whole paths', 0.2, function () {
  const only = D.searchAll({ text: 'anna', branches: [W('files')] });
  return only.items.length === 1 && only.items[0].key === W('files/x/anna.txt') ? true : 'only: ' + JSON.stringify(only.items);
}, test.limit.quick);
test.run('an empty branches list searches nothing', 0.2, function () {
  return D.searchAll({ text: 'anna', branches: [] }).items.length === 0 ? true : 'branches [] found rows';
}, test.limit.quick);
test.run('a small room keeps the best that fit and says more', 0.2, function () {
  env = Buffer.byteLength(JSON.stringify({ items: [], more: false }));
  one = Buffer.byteLength(JSON.stringify([r.items[0]]));
  tight = D.searchAll({ text: 'anna', room: env + one + 5 });
  return tight.items.length === 1 && tight.items[0].key === W('contacts/a') && tight.more === true ? true : 'tight: ' + JSON.stringify(tight);
}, test.limit.quick);
test.run('the whole answer fits the room, in bytes', 0.2, function () {
  return Buffer.byteLength(JSON.stringify(tight)) <= env + one + 5 ? true : 'tight is ' + Buffer.byteLength(JSON.stringify(tight));
}, test.limit.quick);
test.run('a row too big for the room alone is left out and said by more', 0.2, function () {
  const tiny = D.searchAll({ text: 'anna', room: 30 });
  return tiny.items.length === 0 && tiny.more === true ? true : 'tiny: ' + JSON.stringify(tiny);
}, test.limit.quick);
test.run('by default a row over the answer limit is left out, in bytes, the rest kept', 0.2, function () {
  V.set('notes/big', { body: 'é'.repeat(9000) });
  const big = D.searchAll({ text: 'anna' });
  told.off();
  return big.more === true && !big.items.some(function (i) { return i.key === W('notes/big'); }) && big.items.length === 4 ? true
    : 'big: ' + big.items.length + ' more ' + big.more;
}, test.limit.quick);

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

// forget: everything kept goes, and each type is told once
test.run('forget is part of the api', 0.2, function () {
  V.set('files/x', { size: 1 }); V.set('contacts/y', { name: 'y' }); V.ready('files', true);
  forgot = heard('files');
  return typeof D.forgetAll === 'function' ? true : 'there is no forget';
}, test.limit.quick);
test.run('every branch is empty and no type is ready', 0.2, function () {
  D.forgetAll();
  // Every branch the tree holds, node by node and family by family: forget empties each.
  const branches = D.allBranches().map(function (b) { return D.branchAt(b); });
  return branches.length > 0 && branches.every(function (b) { return !Object.keys(b).length; }) && V.ready('files') === false ? true
    : 'after forget: ' + JSON.stringify({ data: kept(), ready: V.ready('files') });
}, test.limit.quick);
test.run('a type\'s watcher is told once, (type, undefined)', 0.2, function () {
  const fine = forgot.calls.length === 1 && forgot.calls[0][0] === W('files') && forgot.calls[0][1] === undefined;
  const why = 'files watcher heard: ' + JSON.stringify(forgot.calls);
  forgot.off();
  return fine ? true : why;
}, test.limit.quick);

// on a page a snapshot is a connect: the cache forgets, and takes the partner's whole push
test.run('what the first connect brought or a search seated is gone, what the second pushed is there', 0.2, function () {
  const { P, stream } = pageCopy();
  const rec = recorder();
  P.whole.addTranslator(rec.t);
  stream.onSnapshot([{ id: 'a', data: { n: 1 } }, { id: 'b', data: { n: 1 } }]);
  P.seat('contacts', [{ key: 'K', label: JSON.stringify({ name: 'k' }) }]);
  stream.onSnapshot([{ id: 'a', data: { n: 2 } }]);
  return P.get('job/a') && P.get('job/a').n === 2 && P.get('job/b') === undefined && P.get('contacts/K') === undefined ? true
    : 'after a second snapshot: ' + JSON.stringify(P.whole.data);
}, test.limit.quick);

// on a page a type loaded late is handed its data whole
const LATE = {};
test.run('its translator is handed every job as it now stands, each once', 0.2, function () {
  const { P, stream } = pageCopy();
  LATE.P = P;
  stream.onSnapshot([{ id: 'a', data: { n: 1 } }]);
  stream.onUpdate({ id: 'a', data: { n: 2 } });
  stream.onUpdate({ id: 'c', data: { n: 1 } });
  stream.onContactRename({ key: 'K', label: 'kay' });
  LATE.r = recorder();
  P.whole.addTranslator(LATE.r.t);
  const ids = LATE.r.got.jobs.map(function (j) { return j.id + ':' + j.data.n; }).sort().join(',');
  return ids === 'a:2,c:1' ? true : 'the late translator got ' + ids;
}, test.limit.quick);
test.run('and the renames heard', 0.2, function () {
  if (!LATE.r) return 'no late translator: the test before it failed';
  return LATE.r.got.renames.length === 1 && LATE.r.got.renames[0].label === 'kay' ? true : 'renames: ' + JSON.stringify(LATE.r.got.renames);
}, test.limit.quick);
test.run('so its branch is whole at once', 0.2, function () {
  if (!LATE.P) return 'no page copy: the test before it failed';
  return (LATE.P.get('job/a') || {}).n === 2 && (LATE.P.get('job/c') || {}).n === 1 ? true : 'jobs: ' + JSON.stringify(LATE.P.branch('job'));
}, test.limit.quick);

// in a process the cache sheds oldest first past a byte cap; a page keeps everything
const CAP = {};
test.run('in a process the cache has a cap, in bytes', 0.2, function () {
  return typeof D.byteCap === 'function' && D.byteCap() > 0 && isFinite(D.byteCap()) ? true : 'the process cap is ' + (typeof D.byteCap === 'function' ? D.byteCap() : 'missing');
}, test.limit.quick);
test.run('past the cap the oldest writes go first, the newest stay, within the cap', 0.2, function () {
  CAP.was = D.byteCap();
  D.forgetAll();
  D.byteCap(300);
  CAP.shed = heard('big');
  for (let i = 1; i <= 10; i++) V.set('big/' + i, { body: 'x'.repeat(40) });
  CAP.kept = Object.keys(T().big || {});
  const bytes = CAP.kept.reduce(function (n, k) { return n + Buffer.byteLength(k) + Buffer.byteLength(JSON.stringify(T().big[k])); }, 0);
  return CAP.kept.length > 0 && CAP.kept.length < 10 && CAP.kept.indexOf('10') !== -1 && CAP.kept.indexOf('1') === -1 && bytes <= 300 ? true
    : 'kept: ' + CAP.kept.join(',') + ', ' + bytes + ' bytes';
}, test.limit.quick);
test.run('a row shed is told as a delete', 0.2, function () {
  return CAP.shed.calls.some(function (c) { return c[0] === W('big/1') && c[1] === undefined; }) ? true : 'heard: ' + JSON.stringify(CAP.shed.calls.slice(0, 3));
}, test.limit.quick);
test.run('a row written again is newest again', 0.2, function () {
  const oldest = CAP.kept[0];
  V.set('big/' + oldest, { body: 'y' });
  V.set('big/11', { body: 'x'.repeat(40) });
  const fine = V.get('big/' + oldest) && V.get('big/' + oldest).body === 'y';
  const why = 'big/' + oldest + ' is ' + JSON.stringify(V.get('big/' + oldest));
  CAP.shed.off();
  D.byteCap(CAP.was);
  return fine ? true : why;
}, test.limit.quick);
test.run('on a page there is no cap (box v17)', 0.2, function () {
  const { P } = pageCopy();
  return typeof P.whole.byteCap === 'function' && P.whole.byteCap() === Infinity ? true : 'the page cap is ' + (typeof P.whole.byteCap === 'function' ? P.whole.byteCap() : 'missing');
}, test.limit.quick);

// THE CACHES PART, once data-caches.js.
// Once spirit/run/spirit/test/data-caches.js.
// ONE CACHE CODE IN THE BROWSER AND IN NODE, THE DATA SET'S SIDE (goal/G41.28; spec: ./data.md). A test by name of
// spirit/data.js, the data set. Andy, on G41.28: "WSL, make sure you assert that every family in the api tree HAS a
// clientCacheManager, AND the a node.js Process like DeskClient uses the Exact same code as the browser for the cache
// management. The only difference is the appServer serializes the cache to disk."
//
// What every branch's data.js must be (1, its branches named by it alone in 2, its disk in 4, 5, 6's downloads, 8) is
// judged on each branch folder by ./spirit-sibling-general.js (branchRules) (goal/G43.32, Q6, Q7). Here what judges no branch:
//   2. one code: the browser and appServer load the same data set file, and appServer a family's cache from its own data.js;
//   3. the same rows make the same cache: the desk's data.js and the data set, run in node as appServer
//      runs them and in a page's window as a page runs them, are fed the same rows and end with the same spirit.data.desk.cache;
//   4. the one difference is the disk: appServer writes the cache to disk, and no other module does;
//   6. spirit.js knows where a family's manager lives;
//   7. nothing keeps node rows but spirit.data, and no file names another way.
const fs = require('fs');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..');
// An app of spirit/app/<name>/ keeps its family and its manager at its top (goal/G43.27).
function managerOf(name) {
  if (fs.existsSync(path.join(RUN, 'spirit', 'app', name, 'api.js'))) return 'spirit/app/' + name + '/data.js';
  return 'spirit/' + name + '/data.js';
}
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A file tracked but not on disk reads as empty, so a deletion not yet committed is judged and never crashes the report.
function cacheCode(file) { let t = ''; try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
// What the caches part reads, read by its first test.
const C = {};
function cachesRead() {
  if (C.tracked) return;
  C.spiritJs = cacheCode(path.join(RUN, 'spirit', 'spirit.js'));
  C.appServer = cacheCode(path.join(RUN, 'spirit', 'appServer.js'));
  // NOBODY ADDS A FAMILY PAST THE RULES (goal/G43.32; Andy: "make sure nobody can add an app implementing a family, without
  // adhering to the rules, this means that a test outside of each branch must assert this."): the tree is every file git
  // keeps and every file not yet added that git does not ignore, so a new app's family is judged before it is committed.
  C.tracked = require('child_process').execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);
}

// data-caches: caches: one cache code in the browser and in node, the data set's side
// ── 2. ONE CODE: the browser and node load the same files, and nothing else keeps a family's cache ──
// Andy: "we needed it so node.js based clients could share the exact same client code. please move the file to
// repo:/spirit/run/spirit/spiritData.js". Every client's file, so it sits with spirit's own, not the shell's.
// goal/G43.32: appServer loads it by spirit.require and its run-root path, as every script loads the tree.
test.run('the data set is one file: spirit.js brings spirit/data.js to a page, and appServer requires the same file', 0.2, function () {
  cachesRead();
  return !!/['"]spirit\/data\.js['"]/.test(C.spiritJs) && /\.require\(\s*['"]spirit\/data\.js['"]\s*\)/.test(C.appServer) ? true
    : 'spirit.js or appServer.js loads a data set from somewhere else than spirit/data.js';
}, test.limit.quick);
test.run('the data set is spirit/data.js', 0.2, function () {
  cachesRead();
  return C.tracked.indexOf('spirit/data.js') !== -1 ? true : 'spirit/data.js is not tracked';
}, test.limit.quick);
test.run('appServer takes a family\'s cache from the family\'s own data.js', 0.2, function () {
  cachesRead();
  return !!/path\.dirname\(\s*spirit\.familyPath\([^;]{0,60}?\)\s*\)\s*,\s*['"]data\.js['"]/.test(C.appServer) ? true
    : 'appServer finds a family\'s cache somewhere else than the family\'s folder';
}, test.limit.quick);

// ── 3. THE SAME ROWS, THE SAME CACHE: the same rows make the same spirit.data in node and in a page ──
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
    const SD = S.require('spirit/data.js');
    S.require(path.relative(RUN, DESK).split(path.sep).join('/'));
    SD.homeNode(SERVER);
    ROWS.forEach(function (row) { SD.desk.data.published(JSON.parse(JSON.stringify(row))); });
    out = JSON.parse(JSON.stringify(SD.desk.cache));
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
    ROWS.forEach(function (row) { win.spirit.data.desk.data.published(JSON.parse(JSON.stringify(row))); });
    return JSON.parse(JSON.stringify(win.spirit.data.desk.cache));
  } catch (e) { return { threw: e.message }; }
}
test.run('in node, as appServer runs it, the rows land in spirit.data.desk.cache', 0.2, function () {
  C.node = inNode();
  return !C.node.threw && Object.keys(C.node).length > 0 ? true : 'in node: ' + short(C.node);
}, test.limit.quick);
test.run('in a page, as a page runs it, the rows land in spirit.data.desk.cache', 0.2, function () {
  C.page = inPage();
  return !C.page.threw && Object.keys(C.page).length > 0 ? true : 'in a page: ' + short(C.page);
}, test.limit.quick);
test.run('its top level is the serving node alone, its key in base64url (Q5)', 0.2, function () {
  const node = C.node || { threw: 'not run' };
  return !node.threw && JSON.stringify(Object.keys(node)) === JSON.stringify([SERVER_ID]) && node[SERVER_ID] && typeof node[SERVER_ID] === 'object' ? true
    : 'in node the top level is ' + short(Object.keys(node)) + ', not ' + SERVER_ID;
}, test.limit.quick);
test.run('the same rows make the same spirit.data.desk.cache in node and in a page', 0.2, function () {
  const node = C.node || { threw: 'not run' };
  const page = C.page || { threw: 'not run' };
  return !node.threw && !page.threw && JSON.stringify(node) === JSON.stringify(page) ? true : 'node ' + short(node) + ' against the page ' + short(page);
}, test.limit.quick);

// ── 4. THE ONE DIFFERENCE IS THE DISK: appServer writes the cache to disk, no manager does ──
test.run('appServer writes each sender\'s cache to its own file on disk', 0.2, function () {
  cachesRead();
  return !!/cacheFile\(/.test(C.appServer) && /writeFileSync\([^)]*\.tmp/.test(C.appServer) ? true : 'appServer writes no cache to disk';
}, test.limit.quick);
test.run('no other module writes a cache file of its own', 0.2, function () {
  cachesRead();
  const writers = C.tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && f !== 'spirit/appServer.js' && /cache[^'"]*\.json/.test(cacheCode(path.join(RUN, f))) && /writeFile/.test(cacheCode(path.join(RUN, f))); });
  return !writers.length ? true : 'a cache file written by ' + short(writers);
}, test.limit.quick);

// ── 7. NO OTHER WAY: nothing keeps node rows but spirit.data, and no file names another way ──
// Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
// item. no exceptions." A client that takes the node's stream itself keeps rows outside spirit.data: only spirit/data.js
// takes it, for every client. boot.js is the face's own transport, before spirit (Andy: "boot.js MUST be an exception").
// The node's own side (spirit/, kernel, events) serves the stream and is no client. The client list below names shell/
// and shell/boot.js; goal/G43.18 moved boot.js and seal.js to spirit/shell/, which the list does not reach, so boot.js
// stays out by its new place and spirit/shell/seal.js is not read; the apps left in shell/ still are, and every app of
// spirit/app/, where the apps and the servers moved to (goal/G43.12, G43.17, G43.20).
test.run('no client takes the node\'s stream itself: spirit/data.js takes it for all', 0.2, function () {
  cachesRead();
  const clients = C.tracked.filter(function (f) { return !!/\.js$/.test(f) && !/\/test\//.test(f) && /^(shell|spirit\/element|spirit\/app)\//.test(f) && f !== 'shell/boot.js'; });
  const takers = clients.filter(function (f) { return !!/\bevent\.subscribe\(|\bev\.subscribe\(/.test(cacheCode(path.join(RUN, f))); });
  return !takers.length ? true : 'clients taking the stream themselves, their rows outside spirit.data: ' + short(takers);
}, test.limit.quick);
// "any notion that there is an alternative approach must disappear from all documentation and all comments in the
// entire repo." The ways replaced, by name: the data set's old places, the desk's old translator file, the two-level
// branches the desk kept before the tree was by node, and a page or client that runs "uncached", without them. Andy's vault is no documentation of the
// repo's code; this file and its spec name them to find them.
test.run('no file in the repo names a replaced way: running uncached, the two-level desk branches', 0.2, function () {
  const REPO = path.join(RUN, '..', '..');
  const OLD = [/\buncached\b/i, /['"]deskItems?\//, /['"]deskState\//, /\bD\.data\.(files|contacts|desk)\b/];
  const every = require('child_process').execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) {
    return f && /\.(js|md|html|json)$/.test(f) && !/^spirit\/run\/brains\//.test(f) && f !== 'spirit/run/spirit/test/data.js' && f !== 'spirit/run/spirit/test/data.md';
  });
  const naming = every.filter(function (f) { let t = ''; try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; } return OLD.some(function (re) { return re.test(t); }); });
  return !naming.length ? true : naming.length + ' files still name one: ' + short(naming);
}, test.limit.quick);

// ── 6. FOUND BY INTROSPECTION: the shell finds a family's manager by the folder shape (goal/G43.27) ──
test.run('spirit.js knows where a family\'s data.js lives, so a page finds it by the family\'s name', 0.2, function () {
  cachesRead();
  return !!/['"]data\.js['"]/.test(C.spiritJs) ? true : 'spirit.js names no data.js: a page cannot find a family\'s data.js by itself';
}, test.limit.quick);
// That the node serves each family's manager, and a page asking by the name gets it, is a rule of every branch, judged
// on each branch folder in ./spirit-sibling-general.js (branchRules) (goal/G43.32).

// THE FAMILIES PART, once data-families.js.
// Once spirit/run/spirit/test/data-families.js.
// The tests of goal/G43.7 (spec: ./data.md). Andy, the box: "we rename it spirit/data.js and it IS the the spirit.data
// object", "ALL "clientCacheManager.js" files will be converted to "data.js" files with the SAME pattern." Every check is per
// family, so the count of what is owed falls as each family moves.
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

// Code only: a comment may quote Andy, and his words are never rewritten.
function familyCode(text) { return String(text).split(/\r?\n/).map(function (l) { return l.replace(/(^|\s)\/\/.*$/, ''); }).join('\n'); }

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const at = path.join(dir, e.name);
    if (VENDORED_FOLDERS.holds(at) || e.name === 'brains' || e.name === 'app-state' || e.name === 'state' || e.name === 'media' || e.name === 'published') return;
    if (e.isDirectory()) walk(at, out); else out.push(at);
  });
  return out;
}
const F = {};

// data-families: spirit.data: every family at spirit.data.<name>, through spirit/data.js (goal/G43.7)
// the box: "we rename it spirit/data.js"
test.run('spirit/data.js stands', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'data.js')) ? true : 'spirit/data.js is missing';
}, test.limit.quick);
test.run('the old module is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'spirit', OLD_MODULE + '.js')) ? true : 'spirit/' + OLD_MODULE + '.js still stands';
}, test.limit.quick);

// the box: "ALL ... files will be converted to "data.js" files"
// Each family's own (its data.js there, the old file gone, none of it rolled by hand, data and cache in node and on a
// page) is judged on each branch folder by ./spirit-sibling-general.js (branchRules) (goal/G43.32). Here, that they share one helper.
// the box: "with the SAME pattern": one helper of spirit.data, called with the family's own name
function patternRead() {
  if (F.pattern) return;
  F.pattern = {};
  FAMILIES.forEach(function (name) {
    const file = path.join(folderOf(name), 'data.js');
    if (!fs.existsSync(file)) return;
    const text = familyCode(fs.readFileSync(file, 'utf8'));
    const called = new RegExp('\\.([A-Za-z]+)\\(\\s*[\'"]' + name + '[\'"]').exec(text);
    if (called) F.pattern[name] = called[1];
  });
}
test.run('all eighteen families call a helper with their own name', 0.2, function () {
  patternRead();
  return Object.keys(F.pattern).length === FAMILIES.length ? true : 'these do not: ' + FAMILIES.filter(function (n) { return !F.pattern[n]; }).join(', ');
}, test.limit.quick);
test.run('and it is the one helper', 0.2, function () {
  patternRead();
  const helpers = Object.keys(F.pattern).map(function (n) { return F.pattern[n]; }).filter(function (h, i, all) { return all.indexOf(h) === i; });
  return helpers.length === 1 ? true : 'not one helper: ' + short(helpers);
}, test.limit.quick);

// the box: "instead of spirit.<name>Data": nothing in the tree's code says the old names
function offendersRead() {
  if (F.offenders) return;
  const rel = function (f) { return path.relative(RUN, f); };
  const offenders = { reader: [], manager: [], module: [] };
  walk(RUN, []).filter(function (f) { return /\.(js|html)$/.test(f) && f !== __filename; }).forEach(function (f) {
    const text = familyCode(fs.readFileSync(f, 'utf8'));
    if (OLD_READER.test(text)) offenders.reader.push(rel(f));
    if (text.indexOf(OLD_MANAGER) !== -1) offenders.manager.push(rel(f));
    if (text.indexOf(OLD_MODULE) !== -1) offenders.module.push(rel(f));
  });
  F.offenders = offenders;
}
const say = function (l) { return l.length + ': ' + l.slice(0, 6).join(', ') + (l.length > 6 ? ', ...' : ''); };
test.run('no code reads a spirit.<name>Data', 0.2, function () {
  offendersRead();
  return !F.offenders.reader.length ? true : 'code that reads a spirit.<name>Data, ' + say(F.offenders.reader);
}, test.limit.quick);
test.run('no code names the old cache manager', 0.2, function () {
  offendersRead();
  return !F.offenders.manager.length ? true : 'code that names ' + OLD_MANAGER + ', ' + say(F.offenders.manager);
}, test.limit.quick);
test.run('no code names the old data module', 0.2, function () {
  offendersRead();
  return !F.offenders.module.length ? true : 'code that names ' + OLD_MODULE + ', ' + say(F.offenders.module);
}, test.limit.quick);

// ── ON A PAGE ───────────────────────────────────────────────────────────────────
const ask = async function (js) { try { return JSON.parse(await F.page.evaluate(js)); } catch (e) { return { threw: String(e) }; } };
test.run('the world: a scratch node\'s page in Chrome answers what spirit.data holds', 0.2, async function () {
  const chrome = H.findChrome();
  F.node = await H.scratchNode();
  F.page = chrome && F.node.up ? await H.chromePage(chrome) : null;
  if (!F.page || F.page.error) return 'no browser to ask: ' + short(F.page ? F.page.error : 'no Chrome, or the scratch node did not come up');
  await F.page.send('Page.navigate', { url: F.node.base + '/' });
  await H.until(function () { return F.page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
  await F.page.evaluate('window.spirit.ready.then(function () { return true; })').catch(function () { return false; });
  await H.sleep(2500);
  const got = await ask('(function () { var S = window.spirit; var names = ' + JSON.stringify(FAMILIES) + ';' +
    ' return Promise.all(names.map(function (n) { return Promise.resolve(S.cacheManager(n)).then(null, function () { return null; }); })).then(function () {' +
    ' var D = S.data || {}; var out = { first: Object.keys(S), keys: {}, families: {} };' +
    ' Object.keys(D).forEach(function (k) { out.keys[k] = typeof D[k]; });' +
    ' names.forEach(function (n) { var f = D[n]; out.families[n] = { data: f && typeof f.data, cache: f && typeof f.cache }; });' +
    ' return JSON.stringify(out); }); })()');
  if (got.threw) return 'the page answered nothing: ' + short(got);
  F.got = got;
  return true;
}, test.limit.slow);
test.after(function () {
  if (F.page && F.page.kid) F.page.kid.kill();
  if (F.node && F.node.child) F.node.child.kill();
  try { if (F.page && F.page.profile) fs.rmSync(F.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (F.node && F.node.root) fs.rmSync(F.node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});

// the box: "de-clutter": the first level of spirit holds no <name>Data
test.run('none is left', 0.2, function () {
  if (!F.got) return 'no page answer: the world failed';
  const left = F.got.first.filter(function (k) { return /Data$/.test(k); });
  return !left.length ? true : 'still on spirit: ' + left.join(', ');
}, test.limit.quick);

// the box: "this object has only helper functions and object <name> for every application"
test.run('spirit.data has its helper functions', 0.2, function () {
  if (!F.got) return 'no page answer: the world failed';
  return Object.keys(F.got.keys).some(function (k) { return F.got.keys[k] === 'function'; }) ? true : 'spirit.data has no function: ' + short(F.got.keys);
}, test.limit.quick);
test.run('and nothing else but the families', 0.2, function () {
  if (!F.got) return 'no page answer: the world failed';
  const stray = Object.keys(F.got.keys).filter(function (k) { return F.got.keys[k] !== 'function' && FAMILIES.indexOf(k) === -1; });
  return !stray.length ? true : 'on spirit.data besides helpers and families: ' + stray.join(', ');
}, test.limit.quick);
// Andy: "all the helperFunctions in objects like spirit.data should potential "words" the should have a capital in it like
// spirit.data.helper**F**unction()", and on Q10: "it belongs to "Fix 'data'", THIS item." A word is a to z, so no family can land on one.
test.run('every helper has a capital, so none is a word', 0.2, function () {
  if (!F.got) return 'no page answer: the world failed';
  const asWords = Object.keys(F.got.keys).filter(function (k) { return F.got.keys[k] === 'function' && !/[A-Z]/.test(k); });
  return !asWords.length ? true : 'helpers that are valid words, ' + asWords.length + ': ' + asWords.join(', ');
}, test.limit.quick);

// Andy: "the helpes must not be words there either, this goes for all spirit.app contained objects."
// spirit.app: no helper is a word, on it or on an app it holds
// goal/G43.32, the box: "Monitor too: its createApp becomes its element.js, and appSelector's createApp path goes."
test.run('the world: spirit.app holds keys, and no app with a createApp (monitor\'s is its element.js)', 0.2, async function () {
  if (!F.got) return 'no page answer: the world failed';
  F.onApp = await ask('(function () { var S = window.spirit; return Promise.all(["spirit/app/monitor/element.js"].map(function (p) { return Promise.resolve(S.require(p)).then(null, function () { return null; }); })).then(function () {' +
    ' var out = { keys: Object.keys(S.app || {}), words: [] };' +
    ' out.keys.forEach(function (k) { var v = S.app[k]; if (typeof v === "function" && !/[A-Z]/.test(k)) out.words.push(k);' +
    ' else if (k !== "FS" && v && typeof v === "object") Object.keys(v).forEach(function (h) { if (typeof v[h] === "function" && !/[A-Z]/.test(h)) out.words.push(k + "." + h); }); });' +
    ' out.apps = out.keys.filter(function (k) { return S.app[k] && typeof S.app[k].createApp === "function"; });' +
    ' return JSON.stringify(out); }); })()');
  const onApp = F.onApp;
  return Array.isArray(onApp.apps) && !onApp.apps.length && Array.isArray(onApp.keys) && onApp.keys.length > 0 ? true : 'on spirit.app: ' + short(onApp);
}, test.limit.quick);
test.run('and no helper there is a word', 0.2, function () {
  const onApp = F.onApp || {};
  return Array.isArray(onApp.words) && !onApp.words.length ? true : 'helpers on spirit.app that are words: ' + short(onApp.words || onApp);
}, test.limit.quick);

// Q5, "Does spirit.data.<name>.cache hold a level per node, as the tree does today?", Andy: "yes."
test.run('the app rows stand under this page\'s node', 0.2, async function () {
  if (!F.got) return 'no page answer: the world failed';
  await H.until(function () { return F.page.evaluate('(function () { var a = (window.spirit.data || {}).app; var c = a && a.cache && a.cache[window.spirit.data.homeNode()]; return !!(c && c.apps && Object.keys(c.apps).length); })()').then(Boolean); }, 8000).catch(function () { return false; });
  F.cached = await ask('(function () { var D = window.spirit.data || {}; var a = D.app || {}; var c = a.cache || {}; var home = typeof D.homeNode === "function" ? D.homeNode() : ""; var r = { home: !!home, apps: Object.keys((c[home] || {}).apps || {}).length };' +
    ' try { D.viewAt("othernode", "app").set("apps/onlythere", { key: "onlythere" }); } catch (e) { r.threw = String(e); }' +
    ' r.there = !!(((c.othernode || {}).apps || {}).onlythere); r.notHome = !((c[home] || {}).apps || {}).onlythere;' +
    ' return JSON.stringify(r); })()');
  return F.cached.home && F.cached.apps > 0 ? true : 'spirit.data.app.cache[home].apps: ' + short(F.cached);
}, test.limit.quick);
test.run('a row of another node stands under that node', 0.2, function () {
  const cached = F.cached || {};
  return cached.there === true ? true : 'a row of another node: ' + short(cached);
}, test.limit.quick);
test.run('and not under this page\'s', 0.2, function () {
  const cached = F.cached || {};
  return cached.notHome === true ? true : 'a row of another node under the home node: ' + short(cached);
}, test.limit.quick);

// the reads moved with it: spirit.data.<name>.data answers what spirit.<name>Data did
test.run('spirit.data.app.data reads the app rows', 0.2, async function () {
  if (!F.got) return 'no page answer: the world failed';
  F.reads = await ask('(function () { var D = window.spirit.data || {}; var a = (D.app || {}).data || {}; var f = (D.fs || {}).data || {}; return JSON.stringify({ rows: typeof a.rows, watch: typeof a.watch, count: typeof a.rows === "function" ? Object.keys(a.rows()).length : 0, fsWatch: typeof f.watch }); })()');
  const reads = F.reads;
  return reads.rows === 'function' && reads.watch === 'function' && reads.count > 0 ? true : 'spirit.data.app.data: ' + short(reads);
}, test.limit.quick);
test.run('spirit.data.fs.data.watch stands, which word.js follows', 0.2, function () {
  const reads = F.reads || {};
  return reads.fsWatch === 'function' ? true : 'spirit.data.fs.data: ' + short(reads);
}, test.limit.quick);
