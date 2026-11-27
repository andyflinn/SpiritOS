'use strict';

// spirit/run/spirit/app/agent/test/data.js
// The tests of spirit/app/agent/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of the agent server's tables (goal/G41.28): job, model, persona and provider, each its own branch,
// id -> the row, under the node that served it; the rows the server publishes merged in (goal/G41.16), and the reads the
// tables' lists and editors ask. It runs as a page runs it: in a window of its own beside the real store, spirit.client
// (spirit/client/script.js), which it writes into; the rows are handed in as the stream hands them, jobs of module spirit.app.agent.
// In node it comes with the family's api.js, spirit.requireScript('spirit/app/agent/api.js'). One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'client', 'script.js');

// The sender's public key, base64 with a + and a / in it, as a node's key is; and another node's.
const HOME_KEY = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const OTHER_KEY = 'Zz+y/XwV9876543210zyxwvutsrqponmlkjihgfedcba=';
const TABLES = ['job', 'model', 'persona', 'provider'];

const W = {};
let n = 0;
// A row as the stream hands it: a job of module spirit.app.agent whose app is the agent server's publish (rowTable.js).
const job = function (app, module, from) { W.D.takeJob({ id: 'j' + (++n), module: module || 'spirit.app.agent', data: {}, app: app }, from || HOME_KEY); };
// The family is the app's id (goal/G49.19): the store's ['spirit.app.agent'], its rows at <node>/spirit.app.agent/<table>.
const at = function (table, id, from) { return W.D.getPath(W.D.nodeId(from || HOME_KEY) + '/spirit.app.agent/' + table + '/' + id); };

test.run('loaded in a window beside the real data set, the agent branch\'s cache stands at the store\'s [\'spirit.app.agent\'].data', 0.2, function () {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  // A page's window: the data set knows it is on a page, so its home is the page's node, whatever node a row came from.
  win.spirit = { isBrowser: function () { return true; } };
  try {
    vm.createContext(win);
    // THE STORE AS THE PAGE'S LOADER HANDS IT BACK (goal/G49.23: no spirit.required): run as the page runs it, and handed
    // as spirit.requireScript's answer, at once, to the data.js that asks for it.
    W.D = PAGE_LOAD.runAsPage(SPIRIT_DATA, win);
    PAGE_LOAD.pageSpirit(win.spirit, { 'spirit/client/script.js': W.D });
    W.D.homeNode(HOME_KEY);
    PAGE_LOAD.runAsPage(FILE, win);
  } catch (e) { return false; }
  W.A = ((W.D || {})['spirit.app.agent'] || {}).data;
  return !!W.A || false;
}, test.limit.quick);
test.run('its tables are job, model, persona and provider', 0.2, function () {
  if (!W.A) return false;
  return JSON.stringify(W.A.tables) === JSON.stringify(TABLES) || false;
}, test.limit.quick);

// ── the translator: the rows the server publishes (goal/G41.16) ──
test.run('a row published with its table is merged into its table\'s branch under the node that served it', 0.2, function () {
  if (!W.A) return false;
  job({ agent: { table: 'provider', row: { id: 'P1', label: 'Unsloth', url: 'http://x' } } });
  const r = at('provider', 'P1');
  return (!!r && r.label === 'Unsloth' && r.url === 'http://x') || false;
}, test.limit.quick);
test.run('a row published again is merged, not replaced, and keeps the fields it did not carry', 0.2, function () {
  if (!W.A) return false;
  job({ agent: { table: 'provider', row: { id: 'P1', label: 'Unsloth Studio' } } });
  const r = at('provider', 'P1');
  return (!!r && r.label === 'Unsloth Studio' && r.url === 'http://x') || false;
}, test.limit.quick);
test.run('each of the four tables has its branch: a job, a model and a persona are kept the same way', 0.2, function () {
  if (!W.A) return false;
  job({ agent: { table: 'job', row: { id: 'J1', label: 'nightly' } } });
  job({ agent: { table: 'model', row: { id: 'M1', label: 'qwen' } } });
  job({ agent: { table: 'persona', row: { id: 'R1', label: 'critic' } } });
  return (at('job', 'J1') && at('model', 'M1') && at('persona', 'R1')) ? true : false;
}, test.limit.quick);
test.run('a row published as removed, by its table and id, is taken out of its branch', 0.2, function () {
  if (!W.A) return false;
  job({ agent: { table: 'persona', id: 'R1', removed: true } });
  return at('persona', 'R1') === undefined || false;
}, test.limit.quick);
test.run('another table\'s rows write nothing', 0.2, function () {
  if (!W.A) return false;
  job({ agent: { table: 'bundle', row: { id: 'B1' } } });
  return Object.keys(W.D.branchAt(W.D.nodeId(HOME_KEY) + '/spirit.app.agent/bundle')).length === 0 || false;
}, test.limit.quick);
test.run('another module\'s rows write nothing', 0.2, function () {
  if (!W.A) return false;
  job({ agent: { table: 'job', row: { id: 'J9' } } }, 'spirit.app.desk');
  return at('job', 'J9') === undefined || false;
}, test.limit.quick);
test.run('a row with no id writes nothing', 0.2, function () {
  if (!W.A) return false;
  const before = JSON.stringify(W.D.branchAt(W.D.nodeId(HOME_KEY) + '/spirit.app.agent/model'));
  job({ agent: { table: 'model', row: { label: 'nameless' } } });
  return JSON.stringify(W.D.branchAt(W.D.nodeId(HOME_KEY) + '/spirit.app.agent/model')) === before || false;
}, test.limit.quick);
test.run('a row from another node is kept under that node, not the page\'s', 0.2, function () {
  if (!W.A) return false;
  job({ agent: { table: 'provider', row: { id: 'PX', label: 'far' } } }, null, OTHER_KEY);
  const r = at('provider', 'PX', OTHER_KEY);
  return (!!r && r.label === 'far' && at('provider', 'PX') === undefined) || false;
}, test.limit.quick);

// ── the reads ──
test.run('the branch of a table is the table\'s whole path, <node>/spirit.app.agent/<table>', 0.2, function () {
  if (!W.A) return false;
  const wrong = TABLES.filter(function (t) { return W.A.branch(t) !== W.D.nodeId(HOME_KEY) + '/spirit.app.agent/' + t; });
  return wrong.length === 0 || false;
}, test.limit.quick);
test.run('the branch of a table the agent server does not have is the empty string', 0.2, function () {
  if (!W.A) return false;
  return W.A.branch('bundle') === '' || false;
}, test.limit.quick);
test.run('row, given a table and an id, answers the row', 0.2, function () {
  if (!W.A) return false;
  const r = W.A.row('provider', 'P1');
  return (!!r && r.label === 'Unsloth Studio') || false;
}, test.limit.quick);
test.run('row answers null for a row not kept, for no id, and for a table it does not have', 0.2, function () {
  if (!W.A) return false;
  return (W.A.row('provider', 'NOPE') === null && W.A.row('provider', '') === null && W.A.row('bundle', 'P1') === null) || false;
}, test.limit.quick);
// Andy, goal/G43.32: "that's a decision: a BRANCHE's what is called \"watch\"", "the branch is already implied in it's containing object."
test.run('each table is its own object with a watch, the branch implied by the object it is on', 0.2, function () {
  if (!W.A) return false;
  const bad = TABLES.filter(function (t) { return !W.A[t] || typeof W.A[t].watch !== 'function'; });
  return bad.length === 0 || false;
}, test.limit.quick);
test.run('a table\'s watch with a function is told the id and the row on every change of that table, and of no other', 0.2, function () {
  if (!W.A || !W.A.model) return false;
  const heard = [];
  const release = W.A.model.watch(function (id, row) { heard.push([id, row && row.label]); });
  job({ agent: { table: 'model', row: { id: 'M2', label: 'llama' } } });
  job({ agent: { table: 'job', row: { id: 'J2', label: 'other table' } } });
  W.releaseAll = release; W.heardAll = heard;
  return (heard.length === 1 && heard[0][0] === 'M2' && heard[0][1] === 'llama') || false;
}, test.limit.quick);
test.run('a table\'s watch answers its release, and once released it is told nothing more', 0.2, function () {
  if (typeof W.releaseAll !== 'function') return false;
  W.releaseAll();
  job({ agent: { table: 'model', row: { id: 'M3', label: 'after' } } });
  return W.heardAll.length === 1 || false;
}, test.limit.quick);
test.run('a table\'s watch with an id and a function is told the row each time that row is written, and undefined once it is gone', 0.2, function () {
  if (!W.A || !W.A.provider) return false;
  const heard = [];
  W.releaseOne = W.A.provider.watch('P1', function (row) { heard.push(row === undefined ? 'gone' : row.label); });
  W.heardOne = heard;
  job({ agent: { table: 'provider', row: { id: 'P2', label: 'another row' } } });
  job({ agent: { table: 'provider', row: { id: 'P1', label: 'renamed' } } });
  job({ agent: { table: 'provider', id: 'P1', removed: true } });
  return JSON.stringify(heard) === JSON.stringify(['renamed', 'gone']) || false;
}, test.limit.quick);
test.run('a row\'s watch answers its release too', 0.2, function () {
  if (typeof W.releaseOne !== 'function') return false;
  W.releaseOne();
  job({ agent: { table: 'provider', row: { id: 'P1', label: 'back' } } });
  return W.heardOne.length === 2 || false;
}, test.limit.quick);
test.run('a table\'s watch with no id and no function watches nothing and answers a release that throws nothing', 0.2, function () {
  if (!W.A || !W.A.job) return false;
  const r = W.A.job.watch('');
  try { r(); } catch (e) { return false; }
  return typeof r === 'function' || false;
}, test.limit.quick);

// ── in node, brought by its api.js (goal/G47.1: "every api.js requires it's companion data.js") ──
test.run('in node, requiring the agent interface brings its data.js, at the store\'s [\'spirit.app.agent\'].data with row and branch', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'script.js'));
  const s = globalThis.spirit;
  try { await Promise.resolve(s.requireScript('spirit/app/agent/api.js')); } catch (e) { return false; }
  // The store as spirit.requireScript hands it back (goal/G49.23: no spirit.required).
  let D = null;
  try { D = await Promise.resolve(s.requireScript('spirit/client/script.js')); } catch (e) { return false; }
  const A = D && D['spirit.app.agent'] && D['spirit.app.agent'].data;
  return (!!A && typeof A.row === 'function' && typeof A.branch === 'function') || false;
}, test.limit.quick);
