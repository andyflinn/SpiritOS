'use strict';

// spirit/run/spirit/job/client/test/script.js
// The tests of spirit/job/client/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of a node's jobs (goal/G41.28): every job the stream hands over, and each job's last events (goal/G29.14).
// It runs as it does: in a window of its own beside the real spirit.client (spirit/client/script.js), which it writes into, the
// stream's events handed in as spirit.client hands them (takeJob, takeRename), each from the node that served it. In node
// it is loaded by its api.js (spirit/job/script.js), the one script that requires it. The reads alone are read, never a
// branch.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/job/client/script.js';
const FILE = path.join(RUN, SUBJECT);
const SPIRIT_DATA = path.join(RUN, 'spirit', 'client', 'script.js');

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
// The nodes a family keeps rows for (goal/G49.23: the store hands no family, and so no cache, out by name): read off every
// branch it holds, <node>/<family>/<branch>.
const nodesOf = function (D, fam) { const out = []; D.allBranches().forEach(function (p) { const s = p.split('/'); if (s[1] === fam && out.indexOf(s[0]) < 0) out.push(s[0]); }); return out; };
// Two nodes' public keys, base64 with a + and a / in them, as a node's key is.
const SENDER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const OTHER = 'Zy+x/WvU9876543210zyxwvutsrqponmlkjihgfedcb=';

// The store at its place since goal/G49.23, spirit.client (no spirit.required).
// A window of its own: the real spirit.client, then the file, as a page loads them. Each translator the file adds is kept,
// so an event spirit.client hands no suite (a job gone) can be handed as spirit.client hands it.
function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/client/script.js', SUBJECT] });
  win.spirit.requireScript('spirit/client/script.js');
  const D = win.spirit.client;
  const translators = [];
  const add = D.addTranslator;
  D.addTranslator = function (t) { translators.push(t); return add(t); };
  win.spirit.requireScript(SUBJECT);
  // goal/G49.23: the store hands no family out by name; the reads stand at the client's path, spirit.job.client, and its rows
  // are the store's under the family spirit.job.
  const X = win.spirit.job && win.spirit.job.client;
  return { win: win, D: D, X: X, translators: translators,
    job: function (job, from) { D.takeJob(job, from || SENDER); },
    nodes: function () { return nodesOf(D, 'spirit.job'); } };
}

// The same on a page: spirit.isBrowser() true and the page's node known (spirit.nodeFacts.key, as node.card answered it), so
// a row another node served is filed under the node that served it while the reads stay the page's own node's.
function pageWorld() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = { isBrowser: function () { return true; }, nodeFacts: { key: SENDER } };
  vm.createContext(win);
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/client/script.js', SUBJECT] });
  win.spirit.requireScript('spirit/client/script.js');
  win.spirit.requireScript(SUBJECT);
  const D = win.spirit.client;
  // goal/G49.23: the reads at the client's path, the rows under the family spirit.job.
  const X = win.spirit.job && win.spirit.job.client;
  return { D: D, X: X, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return nodesOf(D, 'spirit.job'); } };
}

// What the tests make, each in order, read by the tests after it.
let w = null;

test.run('in node, loaded by requiring its api.js, spirit/job/script.js, it stands at spirit.job.client', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'script.js'));
  const S = globalThis.spirit;
  let threw = null;
  // By its path, as a client loads it (goal/G49.6): bound from the api.js on this disc, its companion data.js with it.
  try { await S.requireScript('spirit/job/script.js'); } catch (e) { threw = e; }
  // goal/G49.23: a client stands at its path, spirit.job.client; the store hands no family out by name.
  const X = S.job && S.job.client;
  return (!threw && !!X && typeof X === 'object') || false;
}, test.limit.quick);
test.run('run beside spirit.client, it makes its branch there', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return false; }
  return (!!w.X && typeof w.X === 'object') || false;
}, test.limit.quick);

const W = {};
const gone = function (id, from) { w.translators.forEach(function (t) { if (typeof t.onDelete === 'function') t.onDelete({ id: id, fromNode: w.D.nodeId(from || SENDER) }, w.D); }); };

test.run('every job is kept as it came, without the node it came from', 0.2, function () {
  if (!w) return false;
  w.job({ id: 'j1', kind: 'transient', status: 'running', app: { n: 1 } });
  const j = w.X.job('j1');
  return (!!j && j.status === 'running' && j.kind === 'transient' && !('fromNode' in j)) || false;
}, test.limit.quick);
test.run('a job\'s event is its app object, kept once until it differs', 0.2, function () {
  if (!w) return false;
  w.job({ id: 'j1', kind: 'transient', status: 'running', app: { n: 1 }, updatedAt: 2 });
  w.job({ id: 'j1', kind: 'transient', status: 'running', app: { n: 2 }, updatedAt: 3 });
  const e = w.X.events('j1');
  return (e.length === 2 && e[0].json === JSON.stringify({ n: 1 }) && e[1].json === JSON.stringify({ n: 2 }) && e[1].at === 3) || false;
}, test.limit.quick);
// goal/G4.25: for spirit.fs the tree command each change carries
test.run('the fs job\'s event is the tree command its change carries', 0.2, function () {
  if (!w) return false;
  const c = { op: 'createFile', path: 'a.txt' };
  w.job({ id: 'spirit.fs', kind: 'permanent', data: { command: c }, app: { other: 1 } });
  const e = w.X.events('spirit.fs');
  return (e.length === 1 && e[0].json === JSON.stringify(c)) || false;
}, test.limit.quick);
// goal/G43.20: the node's own jobs carry one kind of news per event; the newest of each kind on the one row
test.run('a job of the node\'s own keeps the newest of each kind of news on its one row', 0.2, function () {
  if (!w) return false;
  w.job({ id: 'spirit', kind: 'permanent', data: { stats: { up: 1 } } });
  w.job({ id: 'spirit', kind: 'permanent', data: { join: { step: 2 } } });
  w.job({ id: 'spirit', kind: 'permanent', data: { stats: { up: 3 } } });
  const d = (w.X.job('spirit') || {}).data;
  return same(d, { stats: { up: 3 }, join: { step: 2 } }) || false;
}, test.limit.quick);
test.run('the event of a job of the node\'s own is its data, each time it changes', 0.2, function () {
  if (!w) return false;
  const e = w.X.events('spirit');
  return (e.length === 3 && e[1].json === JSON.stringify({ join: { step: 2 } })) || false;
}, test.limit.quick);
test.run('a job kept again without news of its own kind replaces the row', 0.2, function () {
  if (!w) return false;
  w.job({ id: 'j1', kind: 'transient', status: 'done', app: { n: 2 } });
  return (w.X.job('j1').status === 'done' && w.X.events('j1').length === 2) || false;
}, test.limit.quick);
test.run('the events kept are the last eventWindow, the oldest falling off the top', 0.2, function () {
  if (!w) return false;
  const n = w.X.eventWindow;
  if (!(n > 0)) return false;
  for (let i = 0; i < n + 5; i++) w.job({ id: 'j2', kind: 'transient', app: { i: i } });
  const e = w.X.events('j2');
  return (e.length === n && e[0].json === JSON.stringify({ i: 5 }) && e[n - 1].json === JSON.stringify({ i: n + 4 })) || false;
}, test.limit.quick);
test.run('a job with no id keeps nothing, and job and events asked of no id answer null and none', 0.2, function () {
  if (!w) return false;
  const before = Object.keys(w.X.jobs()).length;
  w.job({ status: 'running', app: { x: 1 } });
  return (Object.keys(w.X.jobs()).length === before && w.X.job('') === null && same(w.X.events(''), []) && same(w.X.events('nope'), [])) || false;
}, test.limit.quick);
test.run('jobs answers every job kept, by its id', 0.2, function () {
  if (!w) return false;
  return same(Object.keys(w.X.jobs()).sort(), ['j1', 'j2', 'spirit', 'spirit.fs']) || false;
}, test.limit.quick);
test.run('find answers the first job its test is true of, or null', 0.2, function () {
  if (!w) return false;
  const f = w.X.find(function (j) { return j.status === 'done'; });
  return (!!f && f.id === 'j1' && w.X.find(function () { return false; }) === null && w.X.find('not a function') === null) || false;
}, test.limit.quick);
test.run('watch, handed a function alone, hears each job by its id, and nothing once released', 0.2, function () {
  if (!w) return false;
  const heard = [];
  const off = w.X.watch(function (id, j) { heard.push([id, j && j.status]); });
  w.job({ id: 'j3', kind: 'transient', status: 'queued' });
  off();
  w.job({ id: 'j3', kind: 'transient', status: 'running' });
  return same(heard, [['j3', 'queued']]) || false;
}, test.limit.quick);
// goal/G43.32, Andy: "that's a decision: a BRANCHE's what is called \"watch\""
test.run('watch, handed an id and a function, hears that one job each time it is written, and nothing once released', 0.2, function () {
  if (!w) return false;
  const heard = [];
  const off = w.X.watch('j3', function (j) { heard.push(j && j.status); });
  w.job({ id: 'j3', kind: 'transient', status: 'done' });
  w.job({ id: 'j1', kind: 'transient', status: 'again' });
  off();
  w.job({ id: 'j3', kind: 'transient', status: 'later' });
  return (same(heard, ['done']) && typeof w.X.watch('', function () {}) === 'function') || false;
}, test.limit.quick);
test.run('a job the stream deletes goes, and its events with it', 0.2, function () {
  if (!w) return false;
  const heard = [];
  const off = w.X.watch('j1', function (j) { heard.push(j); });
  gone('j1');
  off();
  return (w.X.job('j1') === null && same(w.X.events('j1'), []) && same(heard, [undefined]) && !!w.X.job('j2')) || false;
}, test.limit.quick);
test.run('branch is the jobs\' whole path, under the node that served them', 0.2, function () {
  if (!w) return false;
  const pre = w.D.nodeId(SENDER) + '/spirit.job/';   // goal/G49.23: the family is named by its branch's path
  return (typeof w.X.branch === 'string' && w.X.branch.indexOf(pre) === 0 && w.X.branch.length > pre.length) || false;
}, test.limit.quick);
test.run('on a page, a job another node served is filed under that node, never among the page\'s own node\'s jobs', 0.2, function () {
  let p; try { p = pageWorld(); } catch (e) { return false; }
  p.job({ id: 'mine', kind: 'transient' });
  p.job({ id: 'theirs', kind: 'transient' }, OTHER);
  return (same(p.nodes().sort(), [p.D.nodeId(SENDER), p.D.nodeId(OTHER)].sort()) && p.X.job('theirs') === null && !!p.X.job('mine')) || false;
}, test.limit.quick);
test.run('in a process, a job from another node is filed under that node, never among the first node\'s jobs', 0.2, function () {
  if (!w) return false;
  w.job({ id: 'theirs', kind: 'transient' }, OTHER);
  const there = w.X.job('theirs');
  w.job({ id: 'mine', kind: 'transient' });
  return (same(w.nodes().sort(), [w.D.nodeId(SENDER), w.D.nodeId(OTHER)].sort()) && !!there && w.X.job('theirs') === null) || false;
}, test.limit.quick);
