'use strict';

// spirit/run/spirit/client/test/script.js
// The tests of spirit/client/script.js, and of no other module (spec: ./script.md). The faceless layer runs in node:
// required, it answers its api and ranks with the spirit's own probability files.
// The one test file of data.js: the caches part (one cache code in the browser and in node) and the families part
// (every family at spirit.client.<name>, goal/G43.7; its place since goal/G49.23), once data-caches.js and data-families.js, are sections of it, run
// after its own checks.
// One test.run per test (goal/G47.2): the tests run one at a time in the order written, so what a test writes is what the
// next one reads; the writes of each step sit in the body of the test that judges them.

const path = require('path');
const test = require(path.join(path.resolve(__dirname, '..', '..', '..'), 'spirit', 'testicle', 'testReport', 'script.js'));

const D = require(path.join(__dirname, '..', 'script.js'));

// THE TREE IS BY SERVER NODE FIRST (goal/G41.28; Andy, the box: "spirit.data.<server-public-key-in-base64url>.<api-family>....").
// Every check below writes and reads through one family's view of one node, at(NODE, FAMILY), as a data.js
// does; T() is that family's level of the tree, and W(p) the whole path a watcher is told. NODE holds a + and a /.
const NODE = 'KEY+SPIRIT/DATA==';
const NID = D.nodeId(NODE);
const FAMILY = 'probe';
const V = D.viewAt(NODE, FAMILY);
// The family's level read through its own view (goal/G49.23, box v22 Part 1: the store hands no family out by name).
function T() { return V.branch(''); }
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
  return V.get('files/a/b.txt').size === 3 && T().files['a/b.txt'].size === 3 ? true : false;
}, test.limit.quick);
test.run('the path\'s watcher is told the path and the value', 0.2, function () {
  return byPath.calls.length === 1 && byPath.calls[0][0] === W('files/a/b.txt') && byPath.calls[0][1].size === 3 ? true : false;
}, test.limit.quick);
test.run('the type\'s watcher is told of any key of it', 0.2, function () {
  return byType.calls.length === 1 && byType.calls[0][0] === W('files/a/b.txt') ? true : false;
}, test.limit.quick);
test.run('another type\'s watcher hears nothing', 0.2, function () {
  return other.calls.length === 0 ? true : false;
}, test.limit.quick);
test.run('a bare type gets the branch', 0.2, function () {
  return V.get('files') === T().files ? true : false;
}, test.limit.quick);
test.run('a path without a key writes nothing and tells nobody', 0.2, function () {
  V.set('files', 1); V.set('files/', 2); V.set('', 3); D.setPath(null, 4);
  return byType.calls.length === 1 && !('' in T().files) && !('' in D) ? true
    : false;
}, test.limit.quick);
test.run('a missing key reads undefined; a missing branch answers empty', 0.2, function () {
  return V.get('nosuch/key') === undefined && Object.keys(V.branch('fresh') || {}).length === 0 && V.rows('fresh').length === 0 ? true
    : false;
}, test.limit.quick);

// merge: new fields over the old
test.run('merge keeps the fields it does not name', 0.2, function () {
  V.set('contacts/K1', { name: 'ann', present: true });
  V.merge('contacts/K1', { name: 'anna' });
  return V.get('contacts/K1').name === 'anna' && V.get('contacts/K1').present === true ? true : false;
}, test.limit.quick);
test.run('merge on a missing key starts from {}', 0.2, function () {
  V.merge('contacts/K2', { name: 'bo' });
  return JSON.stringify(V.get('contacts/K2')) === '{"name":"bo"}' ? true : false;
}, test.limit.quick);
test.run('merge writes a new value, the old object untouched', 0.2, function () {
  before = V.get('contacts/K1');
  V.merge('contacts/K1', { x: 1 });
  return before.x === undefined && V.get('contacts/K1') !== before ? true : false;
}, test.limit.quick);
test.run('every merge tells the watchers once', 0.2, function () {
  return other.calls.length === 4 ? true : false;
}, test.limit.quick);

// del: the other write
test.run('a delete removes the key', 0.2, function () {
  V.del('contacts/K2');
  return !('K2' in T().contacts) ? true : false;
}, test.limit.quick);
test.run('a delete tells the watchers with no value', 0.2, function () {
  last = other.calls[other.calls.length - 1];
  return other.calls.length === 5 && last[0] === W('contacts/K2') && last[1] === undefined && last.length === 2 ? true
    : false;
}, test.limit.quick);
test.run('a delete of a key not there tells nobody', 0.2, function () {
  V.del('contacts/K2'); V.del('contacts/never'); V.del('neverType/x');
  return other.calls.length === 5 ? true : false;
}, test.limit.quick);

// watch: until unwatched, one reader's fault its own
test.run('an unwatched reader hears no more; the others still do', 0.2, function () {
  byPath.off();
  V.set('files/a/b.txt', { size: 4 });
  return byPath.calls.length === 1 && byType.calls.length === 2 ? true : false;
}, test.limit.quick);
test.run('a watcher that throws costs the next one nothing', 0.2, function () {
  afterThrow = 0;
  const offBad = V.watch('prefs', function () { throw new Error(); });
  const offGood = V.watch('prefs', function () { afterThrow += 1; });
  threw = null;
  try { V.set('prefs/theme', 'dark'); } catch (e) { threw = e; }
  offBad(); offGood();
  return !threw && afterThrow === 1 ? true : false;
}, test.limit.quick);
test.run('a watcher unwatching itself mid-tell does not cost the next one its call', 0.2, function () {
  second = 0;
  let offFirst = null;
  offFirst = V.watch('prefs', function () { offFirst(); });
  const offSecond = V.watch('prefs', function () { second += 1; });
  V.set('prefs/a', 1);
  V.set('prefs/b', 1);
  offSecond();
  return second === 2 ? true : false;
}, test.limit.quick);
test.run('a non-function watch answers a harmless unwatch', 0.2, function () {
  const noop = V.watch('prefs', 'not a function');
  return typeof noop === 'function' && (noop(), true) ? true : false;
}, test.limit.quick);

// rows: the branch as a list
test.run('a branch\'s rows are one row per key, each with its key added', 0.2, function () {
  rs = V.rows('contacts');
  return rs.length === 1 && rs[0].key === 'K1' && rs[0].name === 'anna' ? true : false;
}, test.limit.quick);
test.run('a row is a copy: writing it leaves the tree alone', 0.2, function () {
  rs[0].name = 'scribbled';
  return V.get('contacts/K1').name === 'anna' ? true : false;
}, test.limit.quick);
test.run('an empty or unknown branch gives an empty list of rows', 0.2, function () {
  return Array.isArray(V.rows('empty')) && V.rows('empty').length === 0 ? true : false;
}, test.limit.quick);

// seat: a search answer into the tree
test.run('an item with a JSON object label is seated by its key', 0.2, function () {
  V.seat('people', [{ key: 'P1', label: JSON.stringify({ name: 'pia' }) }, null, { label: '{"name":"nokey"}' },
    { key: 'P2', label: 'not json' }, { key: 'P3', label: '"a string"' }, { key: 'P4', label: 'null' }, { key: 0, label: '{"n":0}' }]);
  return V.get('people/P1').name === 'pia' ? true : false;
}, test.limit.quick);
test.run('null, keyless, not-JSON and non-object labels are skipped; a key of 0 is a key', 0.2, function () {
  return Object.keys(T().people).sort().join() === '0,P1' ? true : false;
}, test.limit.quick);
test.run('a seat merges over what is there', 0.2, function () {
  V.seat('people', [{ key: 'P1', label: JSON.stringify({ age: 9 }) }]);
  return V.get('people/P1').name === 'pia' && V.get('people/P1').age === 9 ? true : false;
}, test.limit.quick);
test.run('seat with no items is ignored', 0.2, function () {
  threw = null;
  try { V.seat('people'); V.seat('people', null); } catch (e) { threw = e; }
  return !threw ? true : false;
}, test.limit.quick);

// translate: the types' own translators
const jobs = []; const renames = [];
test.run('take and rename survive a throwing translator and a non-object registration', 0.2, function () {
  D.addTranslator({ onJob: function () { throw new Error(); } });
  D.addTranslator({ onJob: function (job, api) { jobs.push([job, api]); }, onRename: function (d, api) { renames.push([d, api]); } });
  D.addTranslator(null); D.addTranslator('text');
  threw = null;
  try {
    D.takeJob({ type: 'x', data: { a: 1 } });
    D.takeJob({ type: 'nodata' }); D.takeJob(null);
    D.takeRename({ key: 'K1', caption: 'c' });
    D.takeRename({ caption: 'nokey' }); D.takeRename(null);
  } catch (e) { threw = e; }
  return !threw ? true : false;
}, test.limit.quick);
// Every job is handed over, data or none (goal/G41.28: the jobs family's manager keeps them whole); null is not a job.
test.run('every job taken is handed to the translators with the api, with data or without, and null is not', 0.2, function () {
  return jobs.length === 2 && jobs[0][0].type === 'x' && jobs[1][0].type === 'nodata' && jobs[0][1] === D ? true : false;
}, test.limit.quick);

// EVERY SERVER'S remote ROW, FILED HERE (goal/G47.5; Andy: "all, agreed. spirit/client/script.js", on where the data of appServer's
// auto-verbs belongs: not a server's own data.js, "would have to be duplicated for all servers"): a server publishes
// { remote: { current, items, more } } as a job of its module, spirit.app.<name>, and it lands on that server's client as its remote,
// a later row replacing it; filed under the module's id whole, where the panel listens (goal/G49.19). No server's data.js is loaded for it.
// ON ITS OWN CLIENT (goal/G49.23, box v22 Part 1, cw's 66e1d112a: "a server's remote row stands on its own client too", never read
// from the store by name): each server's client here is what a client puts out, handOut(out, makeFamily(<its id>)).
const remoteOf = function (id) { return D.handOut({}, D.makeFamily(id)).remote; };
const REMOTE1 = { current: 'K-ZZ1', items: [{ key: 'K-ZZ1', label: 'zz one' }, { key: 'K-ZZ2', label: 'zz two' }], more: false };
const REMOTE2 = { current: 'K-ZZ2', items: [{ key: 'K-ZZ1', label: 'zz one' }, { key: 'K-ZZ2', label: 'zz two' }], more: false };
test.run('a server\'s published remote row lands on its client as remote', 0.2, function () {
  D.takeJob({ id: 'zzremote-job', type: 'app', module: 'spirit.app.zzremote', app: { remote: REMOTE1 } });
  return JSON.stringify(remoteOf('spirit.app.zzremote')) === JSON.stringify(REMOTE1) || false;
}, test.limit.quick);
test.run('a later remote row of the same server replaces it', 0.2, function () {
  D.takeJob({ id: 'zzremote-job', type: 'app', module: 'spirit.app.zzremote', app: { remote: REMOTE2 } });
  return JSON.stringify(remoteOf('spirit.app.zzremote')) === JSON.stringify(REMOTE2) || false;
}, test.limit.quick);
test.run('another server\'s remote row lands under its own id and leaves the first as it is', 0.2, function () {
  D.takeJob({ id: 'zzother-job', type: 'app', module: 'spirit.app.zzother', app: { remote: REMOTE1 } });
  return JSON.stringify(remoteOf('spirit.app.zzother')) === JSON.stringify(REMOTE1) && JSON.stringify(remoteOf('spirit.app.zzremote')) === JSON.stringify(REMOTE2) || false;
}, test.limit.quick);
test.run('a rename is handed to the translators with the api only when it names a key', 0.2, function () {
  return renames.length === 1 && renames[0][0].key === 'K1' && renames[0][1] === D ? true : false;
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
    : false;
}, test.limit.quick);
test.run('another type still tells while one is quiet', 0.2, function () {
  return others.calls.length === 1 ? true : false;
}, test.limit.quick);
test.run('a branch is not ready until said', 0.2, function () {
  return V.ready('tree') === false ? true : false;
}, test.limit.quick);
test.run('marking a branch ready sets its ready flag', 0.2, function () {
  V.ready('tree', true);
  return V.ready('tree') === true ? true : false;
}, test.limit.quick);
test.run('marking a branch ready tells the type\'s watchers once, with the type and no value', 0.2, function () {
  return tree.calls.length === 1 && tree.calls[0][0] === W('tree') && tree.calls[0][1] === undefined && treeKey.calls.length === 0 ? true
    : false;
}, test.limit.quick);
test.run('marking a branch ready ends its quiet, so the next write tells the watchers', 0.2, function () {
  V.set('tree/z', 2);
  const fine = tree.calls.length === 2 && tree.calls[1][0] === W('tree/z');
  tree.off(); treeKey.off(); others.off(); byType.off(); other.off();
  return fine ? true : false;
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
  return r.items.length === 4 && r.more === false ? true : false;
}, test.limit.quick);
test.run('the best match ranks first', 0.2, function () {
  return r.items[0].key === W('contacts/a') && r.items[0].probability > r.items[1].probability ? true
    : false;
}, test.limit.quick);
test.run('a row\'s key is weighed too: a path naming the words scores', 0.2, function () {
  return r.items.some(function (i) { return i.key === W('files/x/anna.txt') && i.probability > 0; }) ? true : false;
}, test.limit.quick);
test.run('a row the words miss still comes back, at 0', 0.2, function () {
  const miss = r.items.filter(function (i) { return i.key === W('contacts/b'); })[0];
  return miss && miss.probability === 0 ? true : false;
}, test.limit.quick);
test.run('the items stand best first', 0.2, function () {
  return r.items.every(function (i, n) { return n === 0 || r.items[n - 1].probability >= i.probability; }) ? true
    : false;
}, test.limit.quick);
test.run('the label is the row as JSON, the key the row\'s whole path', 0.2, function () {
  return r.items[0].label === '{"name":"anna"}' && r.items.filter(function (i) { return i.key === W('prefs/theme'); })[0].label === '"dark"' ? true
    : false;
}, test.limit.quick);
test.run('search writes nothing and tells nobody', 0.2, function () {
  return kept() === snapshot && told.calls.length === 0 ? true : false;
}, test.limit.quick);
test.run('with no text every row comes back at 0', 0.2, function () {
  const blank = D.searchAll({});
  return blank.items.length === 4 && blank.items.every(function (i) { return i.probability === 0; }) ? true
    : false;
}, test.limit.quick);
test.run('a search given a list of branches looks only in the branches named, by their whole paths', 0.2, function () {
  const only = D.searchAll({ text: 'anna', branches: [W('files')] });
  return only.items.length === 1 && only.items[0].key === W('files/x/anna.txt') ? true : false;
}, test.limit.quick);
test.run('an empty branches list searches nothing', 0.2, function () {
  return D.searchAll({ text: 'anna', branches: [] }).items.length === 0 ? true : false;
}, test.limit.quick);
test.run('a small room keeps the best rows that fit and says there are more', 0.2, function () {
  env = Buffer.byteLength(JSON.stringify({ items: [], more: false }));
  one = Buffer.byteLength(JSON.stringify([r.items[0]]));
  tight = D.searchAll({ text: 'anna', room: env + one + 5 });
  return tight.items.length === 1 && tight.items[0].key === W('contacts/a') && tight.more === true ? true : false;
}, test.limit.quick);
test.run('the whole answer fits the room, in bytes', 0.2, function () {
  return Buffer.byteLength(JSON.stringify(tight)) <= env + one + 5 ? true : false;
}, test.limit.quick);
test.run('a row too big for the room on its own is left out, and the answer says there are more', 0.2, function () {
  const tiny = D.searchAll({ text: 'anna', room: 30 });
  return tiny.items.length === 0 && tiny.more === true ? true : false;
}, test.limit.quick);
test.run('by default a row over the answer limit is left out, in bytes, the rest kept', 0.2, function () {
  V.set('notes/big', { body: 'é'.repeat(9000) });
  const big = D.searchAll({ text: 'anna' });
  told.off();
  return big.more === true && !big.items.some(function (i) { return i.key === W('notes/big'); }) && big.items.length === 4 ? true
    : false;
}, test.limit.quick);

// ── THE CACHE'S LIFE (goal/G41.3, Q2) ────────────────────────────────────────────────────────────────────────────
// A page's copy: the same file in a vm of its own, a browser by spirit.isBrowser, its stream a recorder of handlers.
function pageCopy() {
  const vm = require('vm');
  const h = {};
  const win = { spirit: { nodeFacts: { key: NODE }, isBrowser: function () { return true; }, eventStream: { subscribe: function (x) { Object.assign(h, x); return function () {}; } } } };
  win.window = win;
  // THE PAGE'S LOADER, STOOD IN FOR (goal/G49.8, point 1): spirit.requireScript runs a file of the tree in this page once and
  // answers what it placed, as the page's own loader does; nothing is loaded that the page does not ask for itself.
  // goal/G49.23: the helper's stand-in (spirit/testicle/headLessChrome/script.js pageSpirit), each file in a module box as the page's
  // loader runs it, placed at its path on the spirit object (no spirit.required); the store is what it hands back.
  vm.createContext(win);
  require(path.join(path.resolve(__dirname, '..', '..', '..'), 'spirit', 'script.js')).requireScript('spirit/testicle/headLessChrome/script.js')
    .pageSpirit(win.spirit, null, { window: win, real: function () { return true; } });
  let store = null;
  win.spirit.requireScript('spirit/client/script.js').then(function (d) { store = d; });
  // P is the page's view of the family, as its manager addresses it; P.whole the page's data set itself.
  const view = store.viewAt(NODE, FAMILY);
  view.whole = store;
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
  return typeof D.forgetAll === 'function' ? true : false;
}, test.limit.quick);
test.run('every branch is empty and no type is ready', 0.2, function () {
  D.forgetAll();
  // Every branch the tree holds, node by node and family by family: forget empties each.
  const branches = D.allBranches().map(function (b) { return D.branchAt(b); });
  return branches.length > 0 && branches.every(function (b) { return !Object.keys(b).length; }) && V.ready('files') === false ? true
    : false;
}, test.limit.quick);
test.run('after a forget a type\'s watcher is told once, with the type and no value', 0.2, function () {
  const fine = forgot.calls.length === 1 && forgot.calls[0][0] === W('files') && forgot.calls[0][1] === undefined;
  forgot.off();
  return fine ? true : false;
}, test.limit.quick);

// ON A RECONNECT THE CACHE STAYS (goal/G47.1, Andy, overruling goal/G41.3 Q2's "on a reconnect a cache forgets": "THE FUCKING
// CACHE IS NOT WIPED OUT.", "it sound totally wasteful, when mostly good data already sits in the cache"). A page's second
// snapshot is a reconnect: what a search seated is still there, and the jobs it pushes bring the cache up to date.
test.run('on a reconnect what a search seated stays in the cache', 0.4, function () {
  const { P, stream } = pageCopy();
  const rec = recorder();
  P.whole.addTranslator(rec.t);
  stream.onSnapshot([{ id: 'a', data: { n: 1 } }]);
  P.seat('contacts', [{ key: 'K', label: JSON.stringify({ name: 'k' }) }]);
  stream.onSnapshot([{ id: 'a', data: { n: 2 } }]);
  return P.get('contacts/K') !== undefined || false;
}, test.limit.quick);
test.run('the jobs a reconnect pushes bring the cache up to date', 0.4, function () {
  const { P, stream } = pageCopy();
  const rec = recorder();
  P.whole.addTranslator(rec.t);
  stream.onSnapshot([{ id: 'a', data: { n: 1 } }]);
  stream.onSnapshot([{ id: 'a', data: { n: 2 } }]);
  return (P.get('job/a') || {}).n === 2 || false;
}, test.limit.quick);

// on a page a type loaded late is handed its data whole
const LATE = {};
test.run('a translator added late on a page is handed every job as it now stands, each once', 0.2, function () {
  const { P, stream } = pageCopy();
  LATE.P = P;
  stream.onSnapshot([{ id: 'a', data: { n: 1 } }]);
  stream.onUpdate({ id: 'a', data: { n: 2 } });
  stream.onUpdate({ id: 'c', data: { n: 1 } });
  stream.onContactRename({ key: 'K', label: 'kay' });
  LATE.r = recorder();
  P.whole.addTranslator(LATE.r.t);
  const ids = LATE.r.got.jobs.map(function (j) { return j.id + ':' + j.data.n; }).sort().join(',');
  return ids === 'a:2,c:1' ? true : false;
}, test.limit.quick);
test.run('a translator added late on a page is handed the renames heard before it came', 0.2, function () {
  if (!LATE.r) return false;
  return LATE.r.got.renames.length === 1 && LATE.r.got.renames[0].label === 'kay' ? true : false;
}, test.limit.quick);
test.run('a translator added late on a page has its branch whole at once', 0.2, function () {
  if (!LATE.P) return false;
  return (LATE.P.get('job/a') || {}).n === 2 && (LATE.P.get('job/c') || {}).n === 1 ? true : false;
}, test.limit.quick);

// goal/G47.1, Q7, Andy: "For the detail missing files, shall spirit/client/script.js keep the whole file list for late loaders (1), or
// the late fs list ask the node for it (2)?" "then the choice is 1." The node's files are one job, spirit.fs, one update per
// file (job.js:204, "data.command {op, path, at}"); a late fs mirror is handed the tree as it stands, every path once.
const TREE = {};
const fsJob = function (data) { return { id: 'spirit.fs', kind: 'permanent', status: 'running', data: data }; };
test.run('a late loader of the files is handed the whole tree: every file the stream told, each path once', 0.4, function () {
  const { P, stream } = pageCopy();
  stream.onSnapshot([fsJob({})]);
  stream.onUpdate(fsJob({ command: { op: 'createDirectory', path: 'spirit', at: 1 } }));
  ['spirit/a.js', 'spirit/b.js', 'spirit/c.js'].forEach(function (f, i) { stream.onUpdate(fsJob({ command: { op: 'createFile', path: f, size: 10 + i, at: 2 + i } })); });
  stream.onUpdate(fsJob({ command: { op: 'changeFile', path: 'spirit/a.js', size: 99, at: 9 } }));
  stream.onUpdate(fsJob({ treeComplete: true }));
  TREE.r = recorder();
  P.whole.addTranslator(TREE.r.t);
  TREE.cmds = TREE.r.got.jobs.filter(function (j) { return j.id === 'spirit.fs' && j.data && j.data.command; }).map(function (j) { return j.data.command; });
  const paths = TREE.cmds.map(function (c) { return c.path; });
  const a = TREE.cmds.filter(function (c) { return c.path === 'spirit/a.js'; });
  return (['spirit', 'spirit/a.js', 'spirit/b.js', 'spirit/c.js'].every(function (f) { return paths.indexOf(f) !== -1; }) && new Set(paths).size === paths.length && a.length === 1 && a[0].size === 99)
    || false;
}, test.limit.quick);
test.run('a late loader of the files is told once that the tree is complete, after every file', 0.4, function () {
  if (!TREE.r) return false;
  const fs = TREE.r.got.jobs.filter(function (j) { return j.id === 'spirit.fs'; });
  const at = fs.map(function (j) { return !!(j.data && j.data.treeComplete); });
  const n = at.filter(Boolean).length;
  return (n === 1 && at.lastIndexOf(true) > fs.map(function (j) { return !!(j.data && j.data.command); }).lastIndexOf(true)) || false;
}, test.limit.quick);
test.run('a file deleted before the late loader came is not handed to it', 0.4, function () {
  const { P, stream } = pageCopy();
  stream.onSnapshot([fsJob({})]);
  stream.onUpdate(fsJob({ command: { op: 'createFile', path: 'spirit/gone.js', size: 1, at: 1 } }));
  stream.onUpdate(fsJob({ command: { op: 'createFile', path: 'spirit/kept.js', size: 1, at: 2 } }));
  stream.onUpdate(fsJob({ command: { op: 'deleteFile', path: 'spirit/gone.js', at: 3 } }));
  stream.onUpdate(fsJob({ treeComplete: true }));
  const r = recorder();
  P.whole.addTranslator(r.t);
  const made = r.got.jobs.filter(function (j) { return j.id === 'spirit.fs' && j.data && j.data.command && /^create/.test(j.data.command.op); }).map(function (j) { return j.data.command.path; });
  return (made.indexOf('spirit/kept.js') !== -1 && made.indexOf('spirit/gone.js') === -1) || false;
}, test.limit.quick);

// in a process the cache sheds oldest first past a byte cap; a page has the same cap (goal/G49.8, box v3: "spirit/client/script.js caps a
// page's cache at 4 MB, as a process's already is"; Andy: "the browser will need a cache limit", "I'd say 9000 rows are more than plenty")
const CAP = {};
test.run('in a process the cache has a cap, in bytes', 0.2, function () {
  return typeof D.byteCap === 'function' && D.byteCap() > 0 && isFinite(D.byteCap()) ? true : false;
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
    : false;
}, test.limit.quick);
test.run('a row shed is told as a delete', 0.2, function () {
  return CAP.shed.calls.some(function (c) { return c[0] === W('big/1') && c[1] === undefined; }) ? true : false;
}, test.limit.quick);
test.run('a row written again is newest again', 0.2, function () {
  const oldest = CAP.kept[0];
  V.set('big/' + oldest, { body: 'y' });
  V.set('big/11', { body: 'x'.repeat(40) });
  const fine = V.get('big/' + oldest) && V.get('big/' + oldest).body === 'y';
  CAP.shed.off();
  D.byteCap(CAP.was);
  return fine ? true : false;
}, test.limit.quick);
test.run('on a page the cache has the 4 MB cap, the same as a process', 0.4, function () {
  const { P } = pageCopy();
  return typeof P.whole.byteCap === 'function' && P.whole.byteCap() === 4 * 1024 * 1024 && P.whole.byteCap() === CAP.was ? true : false;
}, test.limit.quick);
// THE PAGE IS A CACHE NODE OF ITS OWN (goal/G49.8, point 1, box v12; Andy: "a publish-stream-cache. that's all it really is,
// where the input is filtered by data.js", "it uses the exact same shedding logic as the intermediary cache. instead of disc it
// uses the caches \"RAM-DRIVER\"", "for the bucket, the default is: arrival sequence.", "shedding: the longest held seat"; Q1:
// "Absolutely"): one bucket per branch and remote, 4 MB each, of what the stream brings: each row a job taken on the page, with
// what its branch's translator wrote for it. Rows of about 1 KB are fed until one branch holds some 5 MB. The translator here
// files a job under the branch and table its app names: { fam, table }.
const PAGE_CAP = {};
const KB_ROW = function (i, more) { return Object.assign({ body: 'x'.repeat(1000), n: i }, more || {}); };
const PAGE_ROWS = 5200;
const OTHER_NODE = 'OTHER+NODE/KEY==';
let pageJob = 0;
const feed = function (P, fam, table, data, from) { pageJob += 1; P.whole.takeJob({ id: 'zz' + pageJob, module: 'spirit.app.zz', data: data, app: { fam: fam, table: table } }, from || NODE); };
test.run('on a page, a branch fed past 4 MB by the stream keeps its newest rows within 4 MB, its oldest gone first', 0.4, async function () {
  const { P } = pageCopy();
  // What the page loads for itself, loaded before the stream's first row comes.
  await new Promise(function (r) { setTimeout(r, 50); });
  PAGE_CAP.P = P;
  P.whole.addTranslator({ onJob: function (job, d) { if (job.app && job.app.fam) d.viewAt(job.fromNode, job.app.fam).set(job.app.table + '/' + job.data.n, job.data); } });
  PAGE_CAP.gone = [];
  PAGE_CAP.off = P.watch('big', function (at, v) { if (v === undefined) PAGE_CAP.gone.push(at); });
  // Beside it, before it: another branch of the same node, and the same branch of another node.
  for (let i = 0; i < 20; i++) { feed(P, 'zzother', 'small', KB_ROW(i)); feed(P, FAMILY, 'big', KB_ROW(i), OTHER_NODE); }
  for (let i = 0; i < PAGE_ROWS; i++) feed(P, FAMILY, 'big', KB_ROW(i));
  const kept = Object.keys(P.branch('big') || {});
  const bytes = kept.reduce(function (n, k) { return n + Buffer.byteLength(JSON.stringify(P.get('big/' + k))); }, 0);
  PAGE_CAP.kept = kept;
  return (kept.length > 0 && kept.length < PAGE_ROWS && kept.indexOf(String(PAGE_ROWS - 1)) !== -1 && kept.indexOf('0') === -1 && bytes <= 4 * 1024 * 1024) || false;
}, test.limit.slow);
test.run('on a page, a row its branch sheds is told as a delete', 0.4, function () {
  if (!PAGE_CAP.P) return false;
  return PAGE_CAP.gone.some(function (at) { return /\/big\/0$/.test(String(at)); }) || false;
}, test.limit.quick);
test.run('on a page, another branch of the same node keeps every row when one branch passes 4 MB', 0.4, function () {
  if (!PAGE_CAP.P) return false;
  return Object.keys(PAGE_CAP.P.whole.viewAt(NODE, 'zzother').branch('small') || {}).length === 20 || false;
}, test.limit.quick);
test.run('on a page, the same branch of another node keeps every row when this node\'s passes 4 MB', 0.4, function () {
  if (!PAGE_CAP.P) return false;
  const fine = Object.keys(PAGE_CAP.P.whole.viewAt(OTHER_NODE, FAMILY).branch('big') || {}).length === 20;
  if (PAGE_CAP.off) PAGE_CAP.off();
  return fine || false;
}, test.limit.quick);
// Q1: "May each branch data.js export probability(row) ... ?" "Absolutely": the branch's own make() answers it (cw's build:
// probability(job), the stream's job as it arrives). Here every tenth row is marked keep, at 1; every other at 0.1.
test.run('on a page, a branch\'s probability decides what goes: past 4 MB its low rows go and its high ones stay', 0.4, async function () {
  const { P } = pageCopy();
  await new Promise(function (r) { setTimeout(r, 50); });
  P.whole.makeFamily('zzweighed', function () { return { probability: function (job) { return job && job.data && job.data.keep ? 1 : 0.1; } }; });
  P.whole.addTranslator({ onJob: function (job, d) { if (job.app && job.app.fam) d.viewAt(job.fromNode, job.app.fam).set(job.app.table + '/' + job.data.n, job.data); } });
  for (let i = 0; i < PAGE_ROWS; i++) feed(P, 'zzweighed', 'rows', KB_ROW(i, i % 10 === 0 ? { keep: true } : {}));
  const kept = Object.keys(P.whole.viewAt(NODE, 'zzweighed').branch('rows') || {});
  const high = kept.filter(function (k) { return Number(k) % 10 === 0; }).length;
  return (kept.length < PAGE_ROWS && high === PAGE_ROWS / 10 && kept.indexOf('0') !== -1) || false;
}, test.limit.slow);

// THE CACHES PART, once data-caches.js.
// Once spirit/run/spirit/test/data-caches.js.
// ONE CACHE CODE IN THE BROWSER AND IN NODE, THE DATA SET'S SIDE (goal/G41.28; spec: ./script.md). A test by name of
// spirit/client/script.js, the data set. Andy, on G41.28: "WSL, make sure you assert that every family in the api tree HAS a
// clientCacheManager, AND the a node.js Process like DeskClient uses the Exact same code as the browser for the cache
// management. The only difference is the appServer serializes the cache to disk."
//
// What every branch's data.js must be (1, its branches named by it alone in 2, its disk in 4, 5, 6's downloads, 8) is
// judged on each branch folder by spirit/testicle/general/any/branchRules/script.js (goal/G43.32, Q6, Q7). Here what judges no branch:
//   2. one code: the browser and appServer load the same data set file, and appServer a family's cache from its own data.js;
//   3. the same rows make the same cache: the desk's data.js and the data set, run in node as appServer
//      runs them and in a page's window as a page runs them, are fed the same rows and end with the same spirit.client.desk.cache;
//   4. the one difference is the disk: appServer writes the cache to disk, and no other module does;
//   7. nothing keeps node rows but the store, spirit.client, and no file names another way.
const fs = require('fs');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
// An app of spirit/app/<name>/ keeps its family and its manager at its top (goal/G43.27).
function managerOf(name) {
  if (fs.existsSync(path.join(RUN, 'spirit', 'app', name, 'api.js'))) return 'spirit/app/' + name + '/data.js';
  return 'spirit/' + name + '/data.js';
}
// A file tracked but not on disk reads as empty, so a deletion not yet committed is judged and never crashes the report.
function cacheCode(file) { let t = ''; try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
// What the caches part reads, read by its first test.
const C = {};
function cachesRead() {
  if (C.tracked) return;
  C.spiritJs = cacheCode(path.join(RUN, 'spirit', 'script.js'));
  C.appServer = cacheCode(path.join(RUN, 'spirit', 'server', 'app', 'script.js'));
  // NOBODY ADDS A FAMILY PAST THE RULES (goal/G43.32; Andy: "make sure nobody can add an app implementing a family, without
  // adhering to the rules, this means that a test outside of each branch must assert this."): the tree is every file git
  // keeps and every file not yet added that git does not ignore, so a new app's family is judged before it is committed.
  C.tracked = require('child_process').execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);
}

// data-caches: caches: one cache code in the browser and in node, the data set's side
// ── 2. ONE CODE: the browser and node load the same files, and nothing else keeps a family's cache ──
// Andy: "we needed it so node.js based clients could share the exact same client code. please move the file to
// repo:/spirit/run/spirit/spiritData.js". Every client's file, so it sits with spirit's own, not the shell's.
// goal/G43.32: appServer loads it by spirit.requireScript and its run-root path, as every script loads the tree.
test.run('the data set is one file: spirit.js brings spirit/client/script.js to a page, and appServer requires the same file', 0.2, function () {
  cachesRead();
  return !!/['"]spirit\/client\/script\.js['"]/.test(C.spiritJs) && /\.require(?:Script)?\(\s*['"]spirit\/client\/script\.js['"]\s*\)/.test(C.appServer) ? true
    : false;
}, test.limit.quick);
test.run('the data set is spirit/client/script.js', 0.2, function () {
  cachesRead();
  return C.tracked.indexOf('spirit/client/script.js') !== -1 ? true : false;
}, test.limit.quick);
// From the branch's own folder, its client/script.js or, of the old shape, its data.js (goal/G49.22, cw's 327d49c98: a branch of
// the new shape holds its client as client/script.js), the folder named by the family's id (goal/G49.19, spirit.slashedPath).
test.run('appServer takes a branch\'s cache from the branch\'s own client or data.js, in the branch\'s folder', 0.2, function () {
  cachesRead();
  const m = /const (\w+) = [^;\n]*spirit\.slashedPath\(String\(family\)\)[^;\n]*;\s*const \w+ = \[\s*\1 \+ ['"]\/client\/script\.js['"]\s*,\s*\1 \+ ['"]\/data\.js['"]\s*\]/.exec(C.appServer);
  return !!m || false;
}, test.limit.quick);

// ── 3. THE SAME ROWS, THE SAME CACHE: the same rows make the same store (spirit.client) in node and in a page ──
const DATA = path.join(RUN, 'spirit', 'client', 'script.js');
const DESK = path.join(RUN, managerOf('desk'));
// The desk's family is its id (goal/G49.19).
const DESK_FAMILY = 'spirit.app.desk';
const ROWS = [
  { verb: 'goal.whole', change: 3, item: { id: 'goal/G9', goal: '', title: 'A goal', status: 'open' } },
  { verb: 'goal.whole', change: 3, item: { id: 'goal/G9.1', goal: 'goal/G9', title: 'An item', status: 'open', tags: ['a'] } },
  { verb: 'item.set', change: 4, item: JSON.stringify({ id: 'goal/G9.2', goal: 'goal/G9', title: 'Another', status: 'build' }) },
  { rule: 'rule/1', row: { key: 'rule/1', label: 'A rule', status: 'active' }, change: 5 },
];
// The node that served the rows: a public key holding a + and a /, as real keys do. Andy, the box: "The RAM-CACHE-is
// organized BY SERVER-NODE-ID at it's lowest level. IE: spirit.required.spirit.data.<server-public-key-in-base64url>.<api-family>....".
// Both sides are told it the one way the data set offers, homeNode(key): a page learns it from node.card, a process from
// the sender whose rows it takes.
const SERVER = Buffer.from('KEY-CACHES\xfb\xef\xbf\xfe', 'latin1').toString('base64');
const SERVER_ID = Buffer.from(SERVER, 'base64').toString('base64url');
// In node, as appServer runs them: the data set required, then the family's data.js, on the process's global.
// goal/G43.32: the data set and the family's data.js are spirit.requireScript()d, as appServer and the family's file load them,
// so both hold the one instance, the store at spirit.client (goal/G49.23).
// THE FAMILY'S CACHE, READ THROUGH THE STORE'S OWN READERS (goal/G49.23, box v22 Part 1: the store hands no family out by name, and
// a branch's reads are what its data.js hands back): node -> its branches, for every node the store holds a branch of the family under.
function cacheOf(store, family) {
  const out = {};
  store.allBranches().forEach(function (b) {
    const parts = b.split('/');
    if (parts[1] === family && !out[parts[0]]) out[parts[0]] = store.branchAt(parts[0] + '/' + family);
  });
  return out;
}
function inNode() {
  let out = null;
  try {
    const S = require(path.join(RUN, 'spirit', 'script.js'));
    const SD = S.requireScript('spirit/client/script.js');
    const desk = S.requireScript(path.relative(RUN, DESK).split(path.sep).join('/'));
    SD.homeNode(SERVER);
    ROWS.forEach(function (row) { desk.published(JSON.parse(JSON.stringify(row))); });
    out = JSON.parse(JSON.stringify(cacheOf(SD, DESK_FAMILY)));
  } catch (e) { out = { threw: true }; }
  return out;
}
// In a page's window, as a page runs them: both files in a module box as the page's loader runs them, with no require
// (goal/G49.23: spirit/testicle/headLessChrome/script.js pageSpirit; the store is what spirit.requireScript hands back, no spirit.required).
function inPage() {
  const win = { console: { log: function () {}, error: function () {}, warn: function () {} }, setTimeout: setTimeout, clearTimeout: clearTimeout, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Math: Math, Date: Date, Error: Error, Promise: Promise };
  win.window = win; win.spirit = {};
  vm.createContext(win);
  try {
    const rel = function (f) { return path.relative(RUN, f).split(path.sep).join('/'); };
    S.requireScript('spirit/testicle/headLessChrome/script.js').pageSpirit(win.spirit, null, { window: win, real: [rel(DATA), rel(DESK)] });
    let store = null;
    let desk = null;
    win.spirit.requireScript(rel(DATA)).then(function (d) { store = d; });
    win.spirit.requireScript(rel(DESK)).then(function (d) { desk = d; });
    if (!store || !desk || typeof desk.published !== 'function') return { threw: true };
    store.homeNode(SERVER);
    ROWS.forEach(function (row) { desk.published(JSON.parse(JSON.stringify(row))); });
    return JSON.parse(JSON.stringify(cacheOf(store, DESK_FAMILY)));
  } catch (e) { return { threw: true }; }
}
test.run('in node, as appServer runs it, the rows land in the store under spirit.app.desk', 0.2, function () {
  C.node = inNode();
  return !C.node.threw && Object.keys(C.node).length > 0 ? true : false;
}, test.limit.quick);
test.run('in a page, as a page runs it, the rows land in the store under spirit.app.desk', 0.2, function () {
  C.page = inPage();
  return !C.page.threw && Object.keys(C.page).length > 0 ? true : false;
}, test.limit.quick);
test.run('the cache\'s top level is the serving node alone, its key in base64url', 0.2, function () {
  const node = C.node || { threw: true };
  return !node.threw && JSON.stringify(Object.keys(node)) === JSON.stringify([SERVER_ID]) && node[SERVER_ID] && typeof node[SERVER_ID] === 'object' ? true
    : false;
}, test.limit.quick);
test.run('the same rows make the same spirit.app.desk cache in node and in a page', 0.2, function () {
  const node = C.node || { threw: true };
  const page = C.page || { threw: true };
  return !node.threw && !page.threw && JSON.stringify(node) === JSON.stringify(page) ? true : false;
}, test.limit.quick);

// ── 4. THE ONE DIFFERENCE IS THE DISK: appServer writes the cache to disk, no manager does ──
test.run('appServer writes each sender\'s cache to its own file on disk', 0.2, function () {
  cachesRead();
  return !!/cacheFile\(/.test(C.appServer) && /writeFileSync\([^)]*\.tmp/.test(C.appServer) ? true : false;
}, test.limit.quick);
test.run('no other module writes a cache file of its own', 0.2, function () {
  cachesRead();
  const writers = C.tracked.filter(function (f) { return /\.js$/.test(f) && !/\/test\//.test(f) && f !== 'spirit/server/app/script.js' && /cache[^'"]*\.json/.test(cacheCode(path.join(RUN, f))) && /writeFile/.test(cacheCode(path.join(RUN, f))); });
  return !writers.length ? true : false;
}, test.limit.quick);

// ── 7. NO OTHER WAY: nothing keeps node rows but the store, spirit.client, and no file names another way ──
// Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
// item. no exceptions." A client that takes the node's stream itself keeps rows outside the store: only spirit/client/script.js
// takes it, for every client. boot.js is the face's own transport, before spirit (Andy: "boot.js MUST be an exception").
// The node's own side (spirit/, kernel, events) serves the stream and is no client. The client list below names shell/
// and shell/boot.js; goal/G43.18 moved boot.js and seal.js to spirit/shell/, which the list does not reach, so boot.js
// stays out by its new place and spirit/shell/seal/script.js is not read; the apps left in shell/ still are, and every app of
// spirit/app/, where the apps and the servers moved to (goal/G43.12, G43.17, G43.20).
test.run('no client takes the node\'s stream itself: spirit/client/script.js takes it for all', 0.2, function () {
  cachesRead();
  const clients = C.tracked.filter(function (f) { return !!/\.js$/.test(f) && !/\/test\//.test(f) && /^(shell|spirit\/element|spirit\/app)\//.test(f) && f !== 'shell/boot.js'; });
  const takers = clients.filter(function (f) { return !!/\bevent\.subscribe\(|\bev\.subscribe\(/.test(cacheCode(path.join(RUN, f))); });
  return !takers.length ? true : false;
}, test.limit.quick);
// "any notion that there is an alternative approach must disappear from all documentation and all comments in the
// entire repo." The ways replaced, by name: the data set's old places, the desk's old translator file, the two-level
// branches the desk kept before the tree was by node, and a page or client that runs "uncached", without them. Andy's vault is no documentation of the
// repo's code; this file and its spec name them to find them.
test.run('no file in the repo names a replaced way, neither running uncached nor the two-level desk branches', 0.2, function () {
  const REPO = path.join(RUN, '..', '..');
  const OLD = [/\buncached\b/i, /['"]deskItems?\//, /['"]deskState\//, /\bD\.data\.(files|contacts|desk)\b/];
  const every = require('child_process').execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) {
    return f && /\.(js|md|html|json)$/.test(f) && !/^spirit\/run\/brains\//.test(f) && f !== 'spirit/run/spirit/client/test/script.js' && f !== 'spirit/run/spirit/client/test/script.md';
  });
  const naming = every.filter(function (f) { let t = ''; try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; } return OLD.some(function (re) { return re.test(t); }); });
  return !naming.length ? true : false;
}, test.limit.quick);

// That the node serves each family's data.js, and a page requiring the family's api.js gets it, is a rule of every
// branch, judged on each branch folder in spirit/testicle/general/any/branchRules/script.js (goal/G43.32, goal/G47.1).

// THE FAMILIES PART, once data-families.js.
// Once spirit/run/spirit/test/data-families.js.
// The tests of goal/G43.7 (spec: ./script.md). Andy, the box: "we rename it spirit/client/script.js and it IS the the spirit.required.spirit.data
// object", "ALL "clientCacheManager.js" files will be converted to "data.js" files with the SAME pattern." Every check is per
// family, so the count of what is owed falls as each family moves.
const H = S.requireScript('spirit/testicle/headLessChrome/script.js');
const VENDORED_FOLDERS = S.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;

// Andy on Q2: "yes, of course all 19". Q1: each under the family's own name.
// EVERY FAMILY OF THE TREE, READ FROM ITS FOLDERS (goal/G47.4; Andy: "you make bloody well sure that such stupid hard-coded
// tests move"): a node family is a folder spirit/<name>/ holding api.js, the app family spirit/app/script.js, an app's family a
// folder spirit/app/<name>/ holding api.js. No family is named here, so one added or gone is judged the day it changes.
// A BRANCH OF THE NEW SHAPE COUNTS TOO (goal/G49.15, step 3: "a folder ./ is a branch when it has ./script.js ./client/script.js"):
// spirit/fs is the first; its interface is its script.js.
const newShape = function (dir) { return fs.existsSync(path.join(dir, 'script.js')) && fs.existsSync(path.join(dir, 'client', 'script.js')); };
const NODE_FAMILIES = ['app'].concat(fs.readdirSync(path.join(RUN, 'spirit')).filter(function (n) { return n !== 'app' && n !== 'test' && (fs.existsSync(path.join(RUN, 'spirit', n, 'api.js')) || newShape(path.join(RUN, 'spirit', n))); }));
// An app's family is its id, its folder's path in dots, spirit.app.desk (goal/G49.19).
const SERVER_FAMILIES = fs.readdirSync(path.join(RUN, 'spirit', 'app')).filter(function (n) { return n !== 'test' && fs.existsSync(path.join(RUN, 'spirit', 'app', n, 'api.js')); }).map(function (n) { return 'spirit.app.' + n; });
const FAMILIES = NODE_FAMILIES.concat(SERVER_FAMILIES);
// Each family's interface, as a page requires it; its api.js brings its data.js (goal/G47.1: "every api.js requires it's
// companion data.js, and is the only script to require that data.js"): the app family's spirit/app/script.js, a node
// family's spirit/<name>/api.js, an app's spirit/app/<name>/api.js.
const API_PATHS = FAMILIES.map(function (n) { return n === 'app' ? 'spirit/app/script.js' : NODE_FAMILIES.indexOf(n) !== -1 ? (newShape(path.join(RUN, 'spirit', n)) ? 'spirit/' + n + '/script.js' : 'spirit/' + n + '/api.js') : S.slashedPath(n) + '/api.js'; });
const F = {};

// data-families: the store, spirit.client since goal/G49.23: every family at spirit.client.<name>, through spirit/client/script.js (goal/G43.7)
// the box: "we rename it spirit/client/script.js"
test.run('the file spirit/client/script.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'client', 'script.js')) ? true : false;
}, test.limit.quick);

// Each family's own data.js, made with the one helper under its folder's name, is judged on each branch folder by
// spirit/testicle/general/any/branchRules/script.js; that no code says the old names (spirit.<name>Data, the old cache manager, the old
// module) is its rule of every file too (goal/G47.1). The fixed list of eighteen is left to the page below.

// ── ON A PAGE ───────────────────────────────────────────────────────────────────
const ask = async function (js) { try { return JSON.parse(await F.page.evaluate(js)); } catch (e) { return { threw: true }; } };
test.run('a scratch node\'s page in Chrome answers what spirit.client holds', 0.2, async function () {
  const chrome = H.findChrome();
  F.node = await H.scratchNode();
  F.page = chrome && F.node.up ? await H.chromePage(chrome) : null;
  if (!F.page || F.page.error) return false;
  await F.page.send('Page.navigate', { url: F.node.base + '/' });
  await H.until(function () { return F.page.evaluate('!!(window.spirit && window.spirit.readyPromise)').then(Boolean); }, H.WAIT);
  await F.page.evaluate('window.spirit.readyPromise.then(function () { return true; })').catch(function () { return false; });
  await H.sleep(2500);
  const got = await ask('(function () { var S = window.spirit; var names = ' + JSON.stringify(FAMILIES) + '; var paths = ' + JSON.stringify(API_PATHS) + ';' +
    ' return Promise.all(paths.map(function (p) { return Promise.resolve(S.requireScript(p)).then(null, function () { return null; }); })).then(function () {' +
    ' var D = S.client || {}; var out = { first: Object.keys(S), keys: {}, families: {}, reads: [] };' +
    ' Object.keys(D).forEach(function (k) { out.keys[k] = typeof D[k]; });' +
    ' names.forEach(function (n) { var f = D[n]; out.families[n] = { data: f && typeof f.data, cache: f && typeof f.cache }; });' +
    // The spirit branch's own reads, as the store made them (goal/G49.23, box v22 Part 2: spirit/client/script.js is the spirit
    // branch's client, its reads put out on it): its family's reads, by the store's own makeFamily, which hands an existing family back.
    ' try { var R = typeof D.makeFamily === "function" ? D.makeFamily("spirit").data : null; out.reads = R ? Object.getOwnPropertyNames(R) : []; } catch (e) { out.reads = []; }' +
    ' return JSON.stringify(out); }); })()');
  if (got.threw) return false;
  F.got = got;
  return true;
}, test.limit.slow);
test.after(function () {
  if (F.page && F.page.kid) F.page.kid.kill();
  if (F.node && F.node.child) F.node.child.kill();
  try { if (F.page && F.page.profile) fs.rmSync(F.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (F.node && F.node.root) S.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(F.node); } catch (e) { /* left */ }
});

// the box: "de-clutter": the first level of spirit holds no <name>Data
test.run('the first level of spirit holds no name ending in Data', 0.2, function () {
  if (!F.got) return false;
  const left = F.got.first.filter(function (k) { return /Data$/.test(k); });
  return !left.length ? true : false;
}, test.limit.quick);

// the box: "this object has only helper functions and object <name> for every application"
test.run('spirit.client has its helper functions', 0.2, function () {
  if (!F.got) return false;
  return Object.keys(F.got.keys).some(function (k) { return F.got.keys[k] === 'function'; }) ? true : false;
}, test.limit.quick);
// SINCE goal/G49.23 (box v22 Part 1: "the store hands no family out by name"; Part 2: "spirit/client/script.js is the spirit branch's
// client: the spirit branch's own rows on the spirit branch"): no branch stands on it by name, and beside its helpers it holds the
// spirit branch's own reads, which the store made for the spirit family (out.reads, above), and nothing else.
const spiritReads = function () { return (F.got && Array.isArray(F.got.reads)) ? F.got.reads : []; };
test.run('spirit.client holds nothing but its helper functions and the spirit branch\'s own reads', 0.2, function () {
  if (!F.got || !spiritReads().length) return false;
  const stray = Object.keys(F.got.keys).filter(function (k) { return F.got.keys[k] !== 'function' && spiritReads().indexOf(k) === -1; });
  return !stray.length ? true : false;
}, test.limit.quick);
test.run('no branch stands on spirit.client by name', 0.2, function () {
  if (!F.got) return false;
  return !Object.keys(F.got.keys).some(function (k) { return FAMILIES.indexOf(k) !== -1 || /^spirit\./.test(k); }) || false;
}, test.limit.quick);
// Andy: "all the helperFunctions in objects like spirit.data should potential "words" the should have a capital in it like
// spirit.required.spirit.data.helper**F**unction()", and on Q10: "it belongs to "Fix 'data'", THIS item." A word is a to z, so no family can land on one.
// The spirit branch's reads are no helpers (as Andy's Q4 on the spirit object, goal/G49.23: "verbs are not helpers. only helpers are
// camelCase"): they are left out, by the store's own list of them.
test.run('every helper has a capital, so none is a word', 0.2, function () {
  if (!F.got || !spiritReads().length) return false;
  const asWords = Object.keys(F.got.keys).filter(function (k) { return F.got.keys[k] === 'function' && spiritReads().indexOf(k) === -1 && !/[A-Z]/.test(k); });
  return !asWords.length ? true : false;
}, test.limit.quick);

// spirit.app's own rules (no createApp; no helper a word) are the app branch's, in spirit/app/client/test/script.js (goal/G47.1).

// Q5, "Does spirit.data.<name>.cache hold a level per node, as the tree does today?", Andy: "yes."
// The app branch's rows read through the store's own readers, at the whole path the app branch's client names (its branch), the
// client as spirit.requireScript hands it back (goal/G49.23: no family by name on the store; the family is spirit.app, its path).
const APP_ROWS = '(function () { return Promise.resolve(window.spirit.requireScript("spirit/app/client/script.js")).then(function (A) { var D = window.spirit.client || {}; var home = typeof D.homeNode === "function" ? D.homeNode() : ""; var whole = A && A.branch ? String(A.branch) : ""; ';
test.run('the app rows stand under this page\'s node', 0.2, async function () {
  if (!F.got) return false;
  await H.until(function () { return F.page.evaluate(APP_ROWS + 'return !!home && whole.indexOf(home + "/") === 0 && Object.keys(D.branchAt(whole)).length > 0; }); })()').then(Boolean); }, 8000).catch(function () { return false; });
  F.cached = await ask(APP_ROWS + 'var r = { home: !!home, underHome: !!home && whole.indexOf(home + "/") === 0, apps: whole ? Object.keys(D.branchAt(whole)).length : 0 };' +
    ' var rel = whole.split("/").slice(2).join("/");' +
    ' try { D.viewAt("othernode", "spirit.app").set(rel + "/onlythere", { key: "onlythere" }); } catch (e) { r.threw = true; }' +
    ' r.there = !!rel && !!D.getPath(D.nodeId("othernode") + "/spirit.app/" + rel + "/onlythere"); r.notHome = !!whole && !D.branchAt(whole).onlythere;' +
    ' return JSON.stringify(r); }); })()');
  return F.cached.home && F.cached.underHome && F.cached.apps > 0 ? true : false;
}, test.limit.quick);
test.run('a row of another node stands under that node', 0.2, function () {
  const cached = F.cached || {};
  return cached.there === true ? true : false;
}, test.limit.quick);
test.run('a row of another node does not stand under this page\'s node', 0.2, function () {
  const cached = F.cached || {};
  return cached.notHome === true ? true : false;
}, test.limit.quick);

// the reads moved with it: a branch's client answers what spirit.<name>Data did, as spirit.requireScript hands it back (goal/G49.23,
// box v22 Part 1: "they stand at <branch path>.client, where the loader puts the branch's client/script.js by its path")
test.run('the app branch\'s client reads the app rows', 0.2, async function () {
  if (!F.got) return false;
  F.reads = await ask('(function () { var S = window.spirit; return Promise.all([S.requireScript("spirit/app/client/script.js"), S.requireScript("spirit/fs/client/script.js")]).then(function (got) { var a = got[0] || {}; var f = got[1] || {}; return JSON.stringify({ rows: typeof a.rows, watch: typeof a.watch, count: typeof a.rows === "function" ? Object.keys(a.rows()).length : 0, fsWatch: typeof f.watch }); }); })()');
  const reads = F.reads;
  return reads.rows === 'function' && reads.watch === 'function' && reads.count > 0 ? true : false;
}, test.limit.quick);
test.run('the files branch\'s client has a watch, which word.js follows', 0.2, function () {
  const reads = F.reads || {};
  return reads.fsWatch === 'function' ? true : false;
}, test.limit.quick);
