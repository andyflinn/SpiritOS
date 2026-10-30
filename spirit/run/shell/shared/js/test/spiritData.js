'use strict';

// spirit/run/shell/shared/js/test/spiritData.js
// The tests of shell/shared/js/spiritData.js, and of no other module (spec: ./spiritData.md). The faceless layer runs in node:
// required, it answers its api and ranks with the spirit's own probability files.

const path = require('path');
const test = require(path.join(path.resolve(__dirname, '../../../..'), 'test', 'testReport.js'));

const D = require(path.join(__dirname, '..', 'spiritData.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function heard(p) { const calls = []; const off = D.watch(p, function (at, v) { calls.push([at, v]); }); return { calls: calls, off: off }; }

test.startTest('spiritData.js: the faceless layer');

test.subHeading('set and get: one write, by path');
const byPath = heard('files/a/b.txt');
const byType = heard('files');
const other = heard('contacts');
D.set('files/a/b.txt', { size: 3 });
ok(D.get('files/a/b.txt').size === 3 && D.data.files['a/b.txt'].size === 3, 'a key may hold slashes: everything after the first / is the key',
  'stored: ' + JSON.stringify(D.data.files));
ok(byPath.calls.length === 1 && byPath.calls[0][0] === 'files/a/b.txt' && byPath.calls[0][1].size === 3,
  'the path\'s watcher is told (path, value)', 'path watcher: ' + JSON.stringify(byPath.calls));
ok(byType.calls.length === 1 && byType.calls[0][0] === 'files/a/b.txt', 'the type\'s watcher is told of any key of it',
  'type watcher: ' + JSON.stringify(byType.calls));
ok(other.calls.length === 0, 'another type\'s watcher hears nothing', 'contacts heard: ' + JSON.stringify(other.calls));
ok(D.get('files') === D.data.files, 'a bare type gets the branch', 'get(type) is not the branch');
D.set('files', 1); D.set('files/', 2); D.set('', 3); D.set(null, 4);
ok(byType.calls.length === 1 && !('' in D.data.files) && !('' in D.data), 'a path without a key writes nothing and tells nobody',
  'keyless set: ' + JSON.stringify({ calls: byType.calls.length, files: Object.keys(D.data.files), data: Object.keys(D.data) }));
ok(D.get('nosuch/key') === undefined && D.branch('fresh') === D.data.fresh, 'a missing key reads undefined; branch makes the branch',
  'missing: ' + JSON.stringify(D.get('nosuch/key')));

test.subHeading('merge: new fields over the old');
D.set('contacts/K1', { name: 'ann', present: true });
D.merge('contacts/K1', { name: 'anna' });
ok(D.get('contacts/K1').name === 'anna' && D.get('contacts/K1').present === true, 'merge keeps the fields it does not name',
  'merged: ' + JSON.stringify(D.get('contacts/K1')));
D.merge('contacts/K2', { name: 'bo' });
ok(JSON.stringify(D.get('contacts/K2')) === '{"name":"bo"}', 'merge on a missing key starts from {}', 'K2: ' + JSON.stringify(D.get('contacts/K2')));
const before = D.get('contacts/K1');
D.merge('contacts/K1', { x: 1 });
ok(before.x === undefined && D.get('contacts/K1') !== before, 'merge writes a new value, the old object untouched', 'old object written: ' + JSON.stringify(before));
ok(other.calls.length === 4, 'every merge tells the watchers once', 'contacts heard ' + other.calls.length);

test.subHeading('del: the other write');
D.del('contacts/K2');
ok(!('K2' in D.data.contacts), 'del removes the key', 'K2 still there');
const last = other.calls[other.calls.length - 1];
ok(other.calls.length === 5 && last[0] === 'contacts/K2' && last[1] === undefined && last.length === 2, 'del tells the watchers with undefined',
  'del heard: ' + JSON.stringify(other.calls.slice(4)));
D.del('contacts/K2'); D.del('contacts/never'); D.del('neverType/x');
ok(other.calls.length === 5, 'a delete of a key not there tells nobody', 'heard ' + (other.calls.length - 5) + ' more');

test.subHeading('watch: until unwatched, one reader\'s fault its own');
byPath.off();
D.set('files/a/b.txt', { size: 4 });
ok(byPath.calls.length === 1 && byType.calls.length === 2, 'an unwatched reader hears no more; the others still do',
  'after off: ' + [byPath.calls.length, byType.calls.length]);
let afterThrow = 0;
const offBad = D.watch('prefs', function () { throw new Error('reader fault'); });
const offGood = D.watch('prefs', function () { afterThrow += 1; });
let threw = null;
try { D.set('prefs/theme', 'dark'); } catch (e) { threw = e; }
ok(!threw && afterThrow === 1, 'a watcher that throws costs the next one nothing', 'thrown: ' + threw + ', next heard ' + afterThrow);
offBad(); offGood();
let second = 0;
let offFirst = null;
offFirst = D.watch('prefs', function () { offFirst(); });
const offSecond = D.watch('prefs', function () { second += 1; });
D.set('prefs/a', 1);
D.set('prefs/b', 1);
ok(second === 2, 'a watcher unwatching itself mid-tell does not cost the next one its call', 'second heard ' + second);
offSecond();
const noop = D.watch('prefs', 'not a function');
ok(typeof noop === 'function' && (noop(), true), 'a non-function watch answers a harmless unwatch', 'watch(non-fn) answered ' + typeof noop);

test.subHeading('rows: the branch as a list');
const rs = D.rows('contacts');
ok(rs.length === 1 && rs[0].key === 'K1' && rs[0].name === 'anna', 'one row per key, the key added', 'rows: ' + JSON.stringify(rs));
rs[0].name = 'scribbled';
ok(D.get('contacts/K1').name === 'anna', 'a row is a copy: writing it leaves the tree alone', 'tree written through rows');
ok(Array.isArray(D.rows('empty')) && D.rows('empty').length === 0, 'an empty or unknown branch gives []', 'rows(empty): ' + JSON.stringify(D.rows('empty')));

test.subHeading('seat: a search answer into the tree');
D.seat('people', [{ key: 'P1', label: JSON.stringify({ name: 'pia' }) }, null, { label: '{"name":"nokey"}' },
  { key: 'P2', label: 'not json' }, { key: 'P3', label: '"a string"' }, { key: 'P4', label: 'null' }, { key: 0, label: '{"n":0}' }]);
ok(D.get('people/P1').name === 'pia', 'an item with a JSON object label is seated by its key', 'P1: ' + JSON.stringify(D.get('people/P1')));
ok(Object.keys(D.data.people).sort().join() === '0,P1', 'null, keyless, not-JSON and non-object labels are skipped; a key of 0 is a key',
  'people: ' + Object.keys(D.data.people));
D.seat('people', [{ key: 'P1', label: JSON.stringify({ age: 9 }) }]);
ok(D.get('people/P1').name === 'pia' && D.get('people/P1').age === 9, 'a seat merges over what is there', 'P1: ' + JSON.stringify(D.get('people/P1')));
threw = null;
try { D.seat('people'); D.seat('people', null); } catch (e) { threw = e; }
ok(!threw, 'seat with no items is ignored', 'seat() threw ' + threw);

test.subHeading('translate: the types\' own translators');
const jobs = []; const renames = [];
D.translate({ onJob: function () { throw new Error('a type\'s fault'); } });
D.translate({ onJob: function (job, api) { jobs.push([job, api]); }, onRename: function (d, api) { renames.push([d, api]); } });
D.translate(null); D.translate('text');
threw = null;
try {
  D.take({ type: 'x', data: { a: 1 } });
  D.take({ type: 'nodata' }); D.take(null);
  D.rename({ key: 'K1', caption: 'c' });
  D.rename({ caption: 'nokey' }); D.rename(null);
} catch (e) { threw = e; }
ok(!threw, 'take and rename survive a throwing translator and a non-object registration', 'threw ' + threw);
ok(jobs.length === 1 && jobs[0][0].type === 'x' && jobs[0][1] === D, 'take calls onJob(job, api), only for a job carrying data',
  'jobs: ' + jobs.length);
ok(renames.length === 1 && renames[0][0].key === 'K1' && renames[0][1] === D, 'rename calls onRename(d, api), only when d.key is set',
  'renames: ' + renames.length);

test.subHeading('quietly and ready: a branch filled without telling');
const tree = heard('tree');
const treeKey = heard('tree/x');
const others = heard('contacts');
D.quietly('tree', true);
D.set('tree/x', 1); D.merge('tree/y', { a: 1 }); D.del('tree/x');
D.set('contacts/K9', { name: 'z' });
ok(tree.calls.length === 0 && treeKey.calls.length === 0 && D.get('tree/y').a === 1 && !('x' in D.data.tree),
  'while quiet the writes land and nobody hears', 'quiet heard: ' + JSON.stringify(tree.calls));
ok(others.calls.length === 1, 'another type still tells while one is quiet', 'contacts heard ' + others.calls.length);
ok(D.ready('tree') === false, 'a branch is not ready until said', 'ready before: ' + D.ready('tree'));
D.ready('tree', true);
ok(D.ready('tree') === true, 'ready(type, true) sets the flag', 'ready after: ' + D.ready('tree'));
ok(tree.calls.length === 1 && tree.calls[0][0] === 'tree' && tree.calls[0][1] === undefined && treeKey.calls.length === 0,
  'ready tells the type\'s watchers once, with (type, undefined)', 'ready heard: ' + JSON.stringify(tree.calls));
D.set('tree/z', 2);
ok(tree.calls.length === 2 && tree.calls[1][0] === 'tree/z', 'ready ends the quiet: the next write tells', 'after ready: ' + JSON.stringify(tree.calls));
tree.off(); treeKey.off(); others.off(); byType.off(); other.off();

test.subHeading('search: every branch held, ranked, bounded');
for (const t of Object.keys(D.data)) delete D.data[t];
D.set('contacts/a', { name: 'anna' });
D.set('contacts/b', { name: 'bert' });
D.set('files/x/anna.txt', { size: 1 });
D.set('prefs/theme', 'dark');
const told = heard('contacts');
const snapshot = JSON.stringify(D.data);
const r = D.search({ text: 'anna' });
ok(r.items.length === 4 && r.more === false, 'every row of every branch comes back when there is room', 'items: ' + JSON.stringify(r));
ok(r.items[0].key === 'contacts/a' && r.items[0].probability > r.items[1].probability, 'the best match ranks first',
  'order: ' + r.items.map(function (i) { return i.key + '=' + i.probability; }));
ok(r.items.some(function (i) { return i.key === 'files/x/anna.txt' && i.probability > 0; }), 'a row\'s key is weighed too: a path naming the words scores',
  'file: ' + JSON.stringify(r.items));
const miss = r.items.filter(function (i) { return i.key === 'contacts/b'; })[0];
ok(miss && miss.probability === 0, 'a row the words miss still comes back, at 0', 'bert: ' + JSON.stringify(miss));
ok(r.items.every(function (i, n) { return n === 0 || r.items[n - 1].probability >= i.probability; }), 'the items stand best first',
  'probabilities: ' + r.items.map(function (i) { return i.probability; }));
ok(r.items[0].label === '{"name":"anna"}' && r.items.filter(function (i) { return i.key === 'prefs/theme'; })[0].label === '"dark"',
  'the label is the row as JSON, the key <type>/<key>', 'labels: ' + JSON.stringify(r.items));
ok(JSON.stringify(D.data) === snapshot && told.calls.length === 0, 'search writes nothing and tells nobody', 'heard ' + told.calls.length);
const blank = D.search({});
ok(blank.items.length === 4 && blank.items.every(function (i) { return i.probability === 0; }), 'with no text every row comes back at 0',
  'blank: ' + JSON.stringify(blank.items.map(function (i) { return i.probability; })));
const only = D.search({ text: 'anna', branches: ['files'] });
ok(only.items.length === 1 && only.items[0].key === 'files/x/anna.txt', 'branches limits the search to the branches named',
  'only: ' + JSON.stringify(only.items));
ok(D.search({ text: 'anna', branches: [] }).items.length === 0, 'an empty branches list searches nothing', 'branches [] found rows');
const env = Buffer.byteLength(JSON.stringify({ items: [], more: false }));
const one = Buffer.byteLength(JSON.stringify([r.items[0]]));
const tight = D.search({ text: 'anna', room: env + one + 5 });
ok(tight.items.length === 1 && tight.items[0].key === 'contacts/a' && tight.more === true, 'a small room keeps the best that fit and says more',
  'tight: ' + JSON.stringify(tight));
ok(Buffer.byteLength(JSON.stringify(tight)) <= env + one + 5, 'the whole answer fits the room, in bytes', 'tight is ' + Buffer.byteLength(JSON.stringify(tight)));
const tiny = D.search({ text: 'anna', room: 30 });
ok(tiny.items.length === 0 && tiny.more === true, 'a row too big for the room alone is left out and said by more', 'tiny: ' + JSON.stringify(tiny));
D.set('notes/big', { body: 'é'.repeat(9000) });
const big = D.search({ text: 'anna' });
ok(big.more === true && !big.items.some(function (i) { return i.key === 'notes/big'; }) && big.items.length === 4,
  'by default a row over the answer limit is left out, in bytes, the rest kept', 'big: ' + big.items.length + ' more ' + big.more);
told.off();

// ── THE CACHE'S LIFE (goal/G41.3, Q2) ────────────────────────────────────────────────────────────────────────────
// A page's copy: the same file in a vm of its own, a browser by spirit.isBrowser, its stream a recorder of handlers.
function pageCopy() {
  const vm = require('vm');
  const h = {};
  const win = { spirit: { isBrowser: function () { return true; }, events: { subscribe: function (x) { Object.assign(h, x); return function () {}; } } } };
  win.window = win;
  vm.runInNewContext(require('fs').readFileSync(path.join(__dirname, '..', 'spiritData.js'), 'utf8'), win, { filename: 'spiritData.js' });
  return { P: win.spirit.data, stream: h };
}
// A translator writing each job it is handed to jobs/<id>, and recording what it got.
function recorder() {
  const got = { jobs: [], renames: [] };
  return { got: got, t: { onJob: function (job, d) { got.jobs.push(job); d.set('jobs/' + job.id, job.data); }, onRename: function (r) { got.renames.push(r); } } };
}

test.subHeading('forget: everything kept goes, and each type is told once');
D.set('files/x', { size: 1 }); D.set('contacts/y', { name: 'y' }); D.ready('files', true);
const forgot = heard('files');
ok(typeof D.forget === 'function', 'forget is part of the api', 'there is no forget');
if (typeof D.forget === 'function') {
  D.forget();
  ok(Object.keys(D.data).every(function (t) { return !Object.keys(D.data[t]).length; }) && D.ready('files') === false,
    'every branch is empty and no type is ready', 'after forget: ' + JSON.stringify({ data: D.data, ready: D.ready('files') }));
  ok(forgot.calls.length === 1 && forgot.calls[0][0] === 'files' && forgot.calls[0][1] === undefined, 'a type\'s watcher is told once, (type, undefined)',
    'files watcher heard: ' + JSON.stringify(forgot.calls));
}
forgot.off();

test.subHeading('on a page a snapshot is a connect: the cache forgets, and takes the partner\'s whole push');
{
  const { P, stream } = pageCopy();
  const r = recorder();
  P.translate(r.t);
  stream.onSnapshot([{ id: 'a', data: { n: 1 } }, { id: 'b', data: { n: 1 } }]);
  P.seat('contacts', [{ key: 'K', label: JSON.stringify({ name: 'k' }) }]);
  stream.onSnapshot([{ id: 'a', data: { n: 2 } }]);
  ok(P.get('jobs/a') && P.get('jobs/a').n === 2 && P.get('jobs/b') === undefined && P.get('contacts/K') === undefined,
    'what the first connect brought or a search seated is gone, what the second pushed is there',
    'after a second snapshot: ' + JSON.stringify(P.data));
}

test.subHeading('on a page a type loaded late is handed its data whole');
{
  const { P, stream } = pageCopy();
  stream.onSnapshot([{ id: 'a', data: { n: 1 } }]);
  stream.onUpdate({ id: 'a', data: { n: 2 } });
  stream.onUpdate({ id: 'c', data: { n: 1 } });
  stream.onContactRename({ key: 'K', label: 'kay' });
  const r = recorder();
  P.translate(r.t);
  const ids = r.got.jobs.map(function (j) { return j.id + ':' + j.data.n; }).sort().join(',');
  ok(ids === 'a:2,c:1', 'its translator is handed every job as it now stands, each once', 'the late translator got ' + ids);
  ok(r.got.renames.length === 1 && r.got.renames[0].label === 'kay', 'and the renames heard', 'renames: ' + JSON.stringify(r.got.renames));
  ok((P.get('jobs/a') || {}).n === 2 && (P.get('jobs/c') || {}).n === 1, 'so its branch is whole at once', 'jobs: ' + JSON.stringify(P.data.jobs));
}

test.subHeading('in a process the cache sheds oldest first past a byte cap; a page keeps everything');
ok(typeof D.cap === 'function' && D.cap() > 0 && isFinite(D.cap()), 'in a process the cache has a cap, in bytes', 'the process cap is ' + (typeof D.cap === 'function' ? D.cap() : 'missing'));
if (typeof D.cap === 'function') {
  const was = D.cap();
  D.forget();
  D.cap(300);
  const shed = heard('big');
  for (let i = 1; i <= 10; i++) D.set('big/' + i, { body: 'x'.repeat(40) });
  const kept = Object.keys(D.data.big || {});
  const bytes = kept.reduce(function (n, k) { return n + Buffer.byteLength(k) + Buffer.byteLength(JSON.stringify(D.data.big[k])); }, 0);
  ok(kept.length > 0 && kept.length < 10 && kept.indexOf('10') !== -1 && kept.indexOf('1') === -1 && bytes <= 300,
    'past the cap the oldest writes go first, the newest stay, within the cap (' + kept.length + ' kept, ' + bytes + ' bytes)', 'kept: ' + kept.join(',') + ', ' + bytes + ' bytes');
  ok(shed.calls.some(function (c) { return c[0] === 'big/1' && c[1] === undefined; }), 'a row shed is told as a delete', 'heard: ' + JSON.stringify(shed.calls.slice(0, 3)));
  const oldest = kept[0];
  D.set('big/' + oldest, { body: 'y' });
  D.set('big/11', { body: 'x'.repeat(40) });
  ok(D.get('big/' + oldest) && D.get('big/' + oldest).body === 'y', 'a row written again is newest again', 'big/' + oldest + ' is ' + JSON.stringify(D.get('big/' + oldest)));
  shed.off();
  D.cap(was);
  const { P } = pageCopy();
  ok(typeof P.cap === 'function' && P.cap() === Infinity, 'on a page there is no cap (box v17)', 'the page cap is ' + (typeof P.cap === 'function' ? P.cap() : 'missing'));
}

test.reportSuccessFailureCount();
