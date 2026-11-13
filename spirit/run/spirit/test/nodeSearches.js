'use strict';

// spirit/run/spirit/test/nodeSearches.js
// The tests of spirit/nodeSearches.js, and of no other module (spec: ./nodeSearches.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// The node's jobs and files, searched rather than listed (puppets/G2): job.search, job.get and fs.search. The jobs
// table is planted (listJobs, getJob, fsTreeEntries), and the files a contents search reads are in a scratch folder.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
require(path.join(RUN, 'spirit', 'spirit.js'));
const { createNodeSearches } = require(path.join(RUN, 'spirit', 'nodeSearches.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function keys(r) { return ((r && r.items) || []).map(function (i) { return i.key; }); }
const MIME = { '.txt': 'text/plain', '.js': 'application/javascript', '.png': 'image/png' };
const JOBS = [
  { id: 'spirit.fs', status: 'running', data: { roots: 1 }, _timer: 'internal' },
  { id: 'natter.relay', status: 'idle', data: { note: 'zanzibar' } },
  { id: 'desk.loop', status: 'running' },
];
// A scratch run folder, and the tree entries the watcher would hold for it.
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-nodesearches-'));
function put(rel, text) { fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true }); fs.writeFileSync(path.join(ROOT, rel), text); }
put('app/notes.txt', 'nothing here\nthe quokka sleeps\nanother quokka line\n');
put('app/quokka.txt', 'no such animal in this file\n');
put('app/code.js', 'var a = 1;\n// quokka\n');
put('app/picture.png', 'quokka quokka quokka\n');
put('app/big.txt', 'quokka\n' + 'x'.repeat(1024 * 1024 + 10));
const TREE = [
  { name: 'app', relativePath: 'app', kind: 'folder' },
  { name: 'big.txt', relativePath: 'app/big.txt', kind: 'file' },
  { name: 'code.js', relativePath: 'app/code.js', kind: 'file' },
  { name: 'notes.txt', relativePath: 'app/notes.txt', kind: 'file' },
  { name: 'picture.png', relativePath: 'app/picture.png', kind: 'file' },
  { name: 'quokka.txt', relativePath: 'app/quokka.txt', kind: 'file' },
];
function searches(jobs, tree) {
  return createNodeSearches({
    rootDir: ROOT, mimeTypes: MIME,
    jobs: { listJobs: function () { return jobs; }, getJob: function (k) { return jobs.filter(function (j) { return j.id === k; })[0] || null; }, fsTreeEntries: function () { return tree; } },
  });
}
const N = searches(JOBS, TREE);

// ── job.search ──
test.run('job.search with no words, or *, is every job in the listing\'s order, key and label', 0.2, function () {
  const a = N.jobsSearch({ q: '' }), b = N.jobsSearch({ q: '*' });
  const want = [{ key: 'spirit.fs', label: 'spirit.fs (running)' }, { key: 'natter.relay', label: 'natter.relay (idle)' }, { key: 'desk.loop', label: 'desk.loop (running)' }];
  return (a.ok && short(a.items) === short(want) && short(b.items) === short(want) && a.more === false) || 'answers: ' + short([a, b]);
}, test.limit.quick);
test.run('job.search ranks the words over the whole job as it is served (goal/G41.28): the match first', 0.2, function () {
  const got = keys(N.jobsSearch({ q: 'zanzibar' }));
  return got[0] === 'natter.relay' || 'zanzibar: ' + short(got);
}, test.limit.quick);
test.run('job.search is cut by bytes, never by rows: what does not fit says more', 0.2, function () {
  const many = [];
  for (let i = 0; i < 2000; i += 1) many.push({ id: 'job.' + i, status: 'idle' });
  const r = searches(many, []).jobsSearch({ q: '' });
  const bytes = Buffer.byteLength(JSON.stringify({ ok: true, items: r.items, more: r.more }), 'utf8');
  return (r.more === true && r.items.length > 0 && r.items.length < 2000 && bytes <= limits.PLAINTEXT_MAX) || 'items ' + r.items.length + ', more ' + r.more + ', bytes ' + bytes;
}, test.limit.quick);

// ── job.get ──
test.run('job.get answers one job, without its internals (a leading _)', 0.2, function () {
  const r = N.jobsGet({ key: 'natter.relay' }), fsJob = N.jobsGet({ key: 'spirit.fs' });
  return (r.ok && r.key === 'natter.relay' && r.job.data.note === 'zanzibar' && fsJob.ok && !('_timer' in fsJob.job)) || 'answers: ' + short([r, fsJob]);
}, test.limit.quick);
test.run('the file watcher carries no file list, but says how many entries it watches', 0.2, function () {
  const j = N.jobsGet({ key: 'spirit.fs' }).job || {};
  return (j.data && j.data.fileCount === TREE.length && j.data.roots === 1 && !('files' in j.data)) || 'watcher: ' + short(j);
}, test.limit.quick);
test.run('job.get: no key is 400 key required, an unknown one 404 job not found', 0.2, function () {
  const a = N.jobsGet({}), b = N.jobsGet({ key: 'no.such' });
  return (a.status === 400 && a.error === 'key required' && b.status === 404 && b.error === 'job not found') || 'answers: ' + short([a, b]);
}, test.limit.quick);
test.run('job.get of a job too big for a packet is refused, never cut', 0.2, function () {
  const r = searches([{ id: 'huge', status: 'idle', data: { blob: 'x'.repeat(limits.PLAINTEXT_MAX + 10) } }], []).jobsGet({ key: 'huge' });
  return (r.ok === false && r.status === 413) || 'answer: ' + short(r);
}, test.limit.quick);

// ── fs.search by name and path ──
test.run('fs.search with no words is the whole tree in path order, a folder with its trailing slash', 0.2, function () {
  const got = keys(N.fsSearch({ q: '' }));
  return short(got) === short(['app/', 'app/big.txt', 'app/code.js', 'app/notes.txt', 'app/picture.png', 'app/quokka.txt']) || 'tree: ' + short(got);
}, test.limit.quick);
test.run('fs.search by words ranks the entries, best first, and leaves out an entry that does not match', 0.2, function () {
  const r = N.fsSearch({ q: 'quokka' });
  const tree = [{ name: 'zz', relativePath: 'zz', kind: 'file' }, { name: 'quokka.txt', relativePath: 'app/quokka.txt', kind: 'file' }];
  const two = keys(searches(JOBS, tree).fsSearch({ q: 'quokka.txt' }));
  return (keys(r)[0] === 'app/quokka.txt' && short(two) === short(['app/quokka.txt'])) || 'answers: ' + short([keys(r), two]);
}, test.limit.quick);
test.run('fs.search\'s words are a person\'s, not a pattern: * and ? match nothing special (goal/G29.8)', 0.2, function () {
  const got = keys(N.fsSearch({ q: '*.png' }));
  return got[0] === 'app/picture.png' || 'a pattern answered: ' + short(got);
}, test.limit.quick);
test.run('fs.search is cut by bytes: a tree too big for one answer says more', 0.2, function () {
  const tree = [];
  for (let i = 0; i < 2000; i += 1) tree.push({ name: 'f' + i, relativePath: 'app/f' + i, kind: 'file' });
  const r = searches(JOBS, tree).fsSearch({ q: '' });
  return (r.more === true && r.items.length > 0 && r.items.length < 2000) || 'items ' + r.items.length + ', more ' + r.more;
}, test.limit.quick);

// ── fs.search inside the text files (goal/G29.11) ──
const C = N.fsSearch({ q: 'quokka', contents: 'yes' });
test.run('with contents: yes, files are ranked by their contents alone, never by their names', 0.2, function () {
  const got = keys(C);
  return (got.indexOf('app/notes.txt') !== -1 && got.indexOf('app/quokka.txt') === -1) || 'contents: ' + short(got);
}, test.limit.quick);
test.run('only text files are read: a png is not, javascript is', 0.2, function () {
  const got = keys(C);
  return (got.indexOf('app/picture.png') === -1 && got.indexOf('app/code.js') !== -1) || 'contents: ' + short(got);
}, test.limit.quick);
test.run('a file above 1 MB is never read (found by name only)', 0.2, function () {
  return keys(C).indexOf('app/big.txt') === -1 || 'the big file was read: ' + short(keys(C));
}, test.limit.quick);
test.run('each file answers its path, its score and its first matched line', 0.2, function () {
  const row = (C.items || []).filter(function (i) { return i.key === 'app/notes.txt'; })[0];
  let l = null;
  try { l = JSON.parse(row.label); } catch (e) { l = null; }
  return (!!l && l.path === 'app/notes.txt' && l.line === 2 && l.score > 0 && l.score < 1) || 'label: ' + short(row);
}, test.limit.quick);
test.run('more matched lines score higher: m / (m + 10), never the file\'s length', 0.2, function () {
  const sc = {};
  (C.items || []).forEach(function (i) { sc[i.key] = JSON.parse(i.label).score; });
  return (sc['app/notes.txt'] > sc['app/code.js'] && keys(C)[0] === 'app/notes.txt') || 'scores: ' + short(sc);
}, test.limit.quick);
test.run('contents: yes with no words is the tree by name, never every file read', 0.2, function () {
  return keys(N.fsSearch({ q: '', contents: 'yes' })).length === TREE.length || 'answer: ' + short(N.fsSearch({ q: '', contents: 'yes' }));
}, test.limit.quick);
