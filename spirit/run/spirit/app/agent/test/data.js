'use strict';

// spirit/run/spirit/app/agent/test/data.js
// The tests of spirit/app/agent/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of the agent server's tables (goal/G41.28): job, model, persona and provider, each its own branch,
// id -> the row, under the node that served it; the rows the server publishes merged in (goal/G41.16), and the reads the
// tables' lists and editors ask. It runs as a page runs it: in a window of its own beside the real spirit.data
// (spirit/data.js), which it writes into; the rows are handed in as the stream hands them, jobs of module spirit.app.agent.
// In node it is asked through spirit.cacheManager. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// The sender's public key, base64 with a + and a / in it, as a node's key is; and another node's.
const HOME_KEY = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const OTHER_KEY = 'Zz+y/XwV9876543210zyxwvutsrqponmlkjihgfedcba=';
const TABLES = ['job', 'model', 'persona', 'provider'];

const W = {};
let n = 0;
// A row as the stream hands it: a job of module spirit.app.agent whose app is the agent server's publish (rowTable.js).
const job = function (app, module, from) { W.D.takeJob({ id: 'j' + (++n), module: module || 'spirit.app.agent', data: {}, app: app }, from || HOME_KEY); };
const at = function (table, id, from) { return W.D.getPath(W.D.nodeId(from || HOME_KEY) + '/agent/' + table + '/' + id); };
const NO_WORLD = 'no spirit.data.agent.data: the world failed';

test.run('the world: in a window, beside the real spirit.data, it stands at spirit.data.agent.data', 0.2, function () {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  // A page's window: the data set knows it is on a page, so its home is the page's node, whatever node a row came from.
  win.spirit = { isBrowser: function () { return true; } };
  try {
    vm.createContext(win);
    vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
    win.spirit.data.homeNode(HOME_KEY);
    vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  } catch (e) { return 'it threw: ' + short(e && e.message); }
  W.D = win.spirit.data;
  W.A = ((W.D || {}).agent || {}).data;
  return !!W.A || 'spirit.data.agent is ' + short(W.D && W.D.agent);
}, test.limit.quick);
test.run('its tables are job, model, persona and provider', 0.2, function () {
  if (!W.A) return NO_WORLD;
  return JSON.stringify(W.A.tables) === JSON.stringify(TABLES) || 'tables ' + short(W.A.tables);
}, test.limit.quick);

// ── the translator: the rows the server publishes (goal/G41.16) ──
test.run('a row published, { agent: { table, row } }, is merged into its table\'s branch under the node that served it', 0.2, function () {
  if (!W.A) return NO_WORLD;
  job({ agent: { table: 'provider', row: { id: 'P1', label: 'Unsloth', url: 'http://x' } } });
  const r = at('provider', 'P1');
  return (!!r && r.label === 'Unsloth' && r.url === 'http://x') || 'kept ' + short(r);
}, test.limit.quick);
test.run('merged, not replaced: a row published again keeps the fields it did not carry', 0.2, function () {
  if (!W.A) return NO_WORLD;
  job({ agent: { table: 'provider', row: { id: 'P1', label: 'Unsloth Studio' } } });
  const r = at('provider', 'P1');
  return (!!r && r.label === 'Unsloth Studio' && r.url === 'http://x') || 'kept ' + short(r);
}, test.limit.quick);
test.run('each of the four tables has its branch: a job, a model and a persona are kept the same way', 0.2, function () {
  if (!W.A) return NO_WORLD;
  job({ agent: { table: 'job', row: { id: 'J1', label: 'nightly' } } });
  job({ agent: { table: 'model', row: { id: 'M1', label: 'qwen' } } });
  job({ agent: { table: 'persona', row: { id: 'R1', label: 'critic' } } });
  return (at('job', 'J1') && at('model', 'M1') && at('persona', 'R1')) ? true : 'kept ' + short({ job: at('job', 'J1'), model: at('model', 'M1'), persona: at('persona', 'R1') });
}, test.limit.quick);
test.run('a row gone, { agent: { table, id, removed } }, is taken out of its branch', 0.2, function () {
  if (!W.A) return NO_WORLD;
  job({ agent: { table: 'persona', id: 'R1', removed: true } });
  return at('persona', 'R1') === undefined || 'still kept ' + short(at('persona', 'R1'));
}, test.limit.quick);
test.run('another table\'s rows write nothing', 0.2, function () {
  if (!W.A) return NO_WORLD;
  job({ agent: { table: 'bundle', row: { id: 'B1' } } });
  return Object.keys(W.D.branchAt(W.D.nodeId(HOME_KEY) + '/agent/bundle')).length === 0 || 'bundle kept';
}, test.limit.quick);
test.run('another module\'s rows write nothing', 0.2, function () {
  if (!W.A) return NO_WORLD;
  job({ agent: { table: 'job', row: { id: 'J9' } } }, 'spirit.app.desk');
  return at('job', 'J9') === undefined || 'kept ' + short(at('job', 'J9'));
}, test.limit.quick);
test.run('a row with no id writes nothing', 0.2, function () {
  if (!W.A) return NO_WORLD;
  const before = JSON.stringify(W.D.branchAt(W.D.nodeId(HOME_KEY) + '/agent/model'));
  job({ agent: { table: 'model', row: { label: 'nameless' } } });
  return JSON.stringify(W.D.branchAt(W.D.nodeId(HOME_KEY) + '/agent/model')) === before || 'the model branch changed';
}, test.limit.quick);
test.run('a row from another node is kept under that node, not the page\'s', 0.2, function () {
  if (!W.A) return NO_WORLD;
  job({ agent: { table: 'provider', row: { id: 'PX', label: 'far' } } }, null, OTHER_KEY);
  const r = at('provider', 'PX', OTHER_KEY);
  return (!!r && r.label === 'far' && at('provider', 'PX') === undefined) || 'under the other node ' + short(r) + ', under home ' + short(at('provider', 'PX'));
}, test.limit.quick);

// ── the reads ──
test.run('branch(table) is the table\'s whole path, <node>/agent/<table>', 0.2, function () {
  if (!W.A) return NO_WORLD;
  const wrong = TABLES.filter(function (t) { return W.A.branch(t) !== W.D.nodeId(HOME_KEY) + '/agent/' + t; });
  return wrong.length === 0 || 'wrong: ' + short(wrong.map(function (t) { return W.A.branch(t); }));
}, test.limit.quick);
test.run('branch of a table the agent server has not is \'\'', 0.2, function () {
  if (!W.A) return NO_WORLD;
  return W.A.branch('bundle') === '' || 'branch(bundle) ' + short(W.A.branch('bundle'));
}, test.limit.quick);
test.run('row(table, id) answers the row', 0.2, function () {
  if (!W.A) return NO_WORLD;
  const r = W.A.row('provider', 'P1');
  return (!!r && r.label === 'Unsloth Studio') || 'row ' + short(r);
}, test.limit.quick);
test.run('and null for a row not kept, no id, or a table it has not', 0.2, function () {
  if (!W.A) return NO_WORLD;
  return (W.A.row('provider', 'NOPE') === null && W.A.row('provider', '') === null && W.A.row('bundle', 'P1') === null) || 'answered ' + short([W.A.row('provider', 'NOPE'), W.A.row('provider', ''), W.A.row('bundle', 'P1')]);
}, test.limit.quick);
// Andy, goal/G43.32: "that's a decision: a BRANCHE's what is called \"watch\"", "the branch is already implied in it's containing object."
test.run('each table is its own object with a watch, the branch implied by the object it is on', 0.2, function () {
  if (!W.A) return NO_WORLD;
  const bad = TABLES.filter(function (t) { return !W.A[t] || typeof W.A[t].watch !== 'function'; });
  return bad.length === 0 || 'no watch on ' + short(bad);
}, test.limit.quick);
test.run('<table>.watch(fn) is told fn(id, row) on every change of that table, and of no other', 0.2, function () {
  if (!W.A || !W.A.model) return NO_WORLD;
  const heard = [];
  const release = W.A.model.watch(function (id, row) { heard.push([id, row && row.label]); });
  job({ agent: { table: 'model', row: { id: 'M2', label: 'llama' } } });
  job({ agent: { table: 'job', row: { id: 'J2', label: 'other table' } } });
  W.releaseAll = release; W.heardAll = heard;
  return (heard.length === 1 && heard[0][0] === 'M2' && heard[0][1] === 'llama') || 'heard ' + short(heard);
}, test.limit.quick);
test.run('and answers its release: released, it is told nothing more', 0.2, function () {
  if (typeof W.releaseAll !== 'function') return 'the table\'s watch answered no release';
  W.releaseAll();
  job({ agent: { table: 'model', row: { id: 'M3', label: 'after' } } });
  return W.heardAll.length === 1 || 'heard after release ' + short(W.heardAll);
}, test.limit.quick);
test.run('<table>.watch(id, fn) is told fn(row) each time that row is written, and undefined once it is gone', 0.2, function () {
  if (!W.A || !W.A.provider) return NO_WORLD;
  const heard = [];
  W.releaseOne = W.A.provider.watch('P1', function (row) { heard.push(row === undefined ? 'gone' : row.label); });
  W.heardOne = heard;
  job({ agent: { table: 'provider', row: { id: 'P2', label: 'another row' } } });
  job({ agent: { table: 'provider', row: { id: 'P1', label: 'renamed' } } });
  job({ agent: { table: 'provider', id: 'P1', removed: true } });
  return JSON.stringify(heard) === JSON.stringify(['renamed', 'gone']) || 'heard ' + short(heard);
}, test.limit.quick);
test.run('a row\'s watch answers its release too', 0.2, function () {
  if (typeof W.releaseOne !== 'function') return 'the row\'s watch answered no release';
  W.releaseOne();
  job({ agent: { table: 'provider', row: { id: 'P1', label: 'back' } } });
  return W.heardOne.length === 2 || 'heard after release ' + short(W.heardOne);
}, test.limit.quick);
test.run('<table>.watch with no id and no fn watches nothing and answers a release that throws nothing', 0.2, function () {
  if (!W.A || !W.A.job) return NO_WORLD;
  const r = W.A.job.watch('');
  try { r(); } catch (e) { return 'its release threw ' + short(e && e.message); }
  return typeof r === 'function' || 'answered ' + short(r);
}, test.limit.quick);

// ── in node, found by the family's name ──
test.run('in node, spirit.cacheManager(\'agent\') loads it, and it stands at spirit.data.agent.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const s = globalThis.spirit;
  try { await s.cacheManager('agent'); } catch (e) { return 'cacheManager(agent) refused: ' + short(e && e.message); }
  const A = s.data && s.data.agent && s.data.agent.data;
  return (!!A && typeof A.row === 'function' && typeof A.branch === 'function') || 'spirit.data.agent is ' + short(s.data && s.data.agent);
}, test.limit.quick);
