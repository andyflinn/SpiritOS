'use strict';

// spirit/run/spirit/test/authTableInterface.js
// The tests of spirit/authTableInterface.js, and of no other module (spec: ./authTableInterface.md; goal/G41.4). Andy:
// "node's auth modules will have a file authTableInterface.js, (configured by dataBase.db file name and authTableName)";
// the grant table of agent.db is "structured exactly like the auth table in node". The shape, named by the red:
// open(dbFile, table, keyColumn) -> { has, paths, grant, revoke, all, knownPath }, the names node's auth uses today (cw), a table of
// (keyColumn, path), one row per grant, as node's grants are (peer_id, path; spirit/nodeStore.js:502).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'authTableInterface.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// What the tests share: the module, its scratch folder and the table opened on it.
const W = {};
function opened() { return W.t ? null : 'no table opened: the test before it failed'; }

test.run('it exports open(dbFile, table, keyColumn)', 0.2, function () {
  try { W.A = require(FILE); } catch (e) { W.A = null; }
  const A = W.A;
  if (!(!!A && typeof A.open === 'function')) return 'spirit/authTableInterface.js: ' + (fs.existsSync(FILE) ? short(A && Object.keys(A)) : 'not there');
  W.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authTable-'));
  W.file = path.join(W.dir, 'agent.db');
  return true;
}, 1000);
test.run('open answers { has, paths, grant, revoke, all, knownPath }', 0.2, function () {
  if (!W.file) return 'no module to open: the test before it failed';
  const t = W.A.open(W.file, 'grant', 'job_id');
  if (!(!!t && ['has', 'paths', 'grant', 'revoke', 'all', 'knownPath'].every(function (k) { return typeof t[k] === 'function'; }))) return 'opened: ' + short(t && Object.keys(t));
  W.t = t;
  return true;
}, 1000);
test.run('it makes the table in that file, keyed (keyColumn, path) as node\'s grants are', 0.2, function () {
  if (opened()) return opened();
  const db = new DatabaseSync(W.file, { readOnly: true });
  const cols = db.prepare('PRAGMA table_info("grant")').all();
  db.close();
  const pk = cols.filter(function (c) { return c.pk > 0; }).sort(function (a, b) { return a.pk - b.pk; }).map(function (c) { return c.name; });
  return JSON.stringify(pk) === '["job_id","path"]' || 'primary key ' + short(pk) + ', columns ' + short(cols.map(function (c) { return c.name; }));
}, 1000);
test.run('has answers true for a grant given, false for any other', 0.8, function () {
  if (opened()) return opened();
  const t = W.t;
  t.grant('JOB-1', 'desk.chat.add');
  t.grant('JOB-1', 'desk.item.get');
  t.grant('JOB-1', 'desk.chat.add');
  t.grant('JOB-2', 'desk.item.get');
  return (t.has('JOB-1', 'desk.chat.add') === true && t.has('JOB-1', 'desk.box.write') === false && t.has('JOB-3', 'desk.chat.add') === false) || short([t.has('JOB-1', 'desk.chat.add'), t.has('JOB-1', 'desk.box.write'), t.has('JOB-3', 'desk.chat.add')]);
}, 1000);
test.run('paths(key) answers that key\'s paths, each once', 0.2, function () {
  if (opened()) return opened();
  return JSON.stringify((W.t.paths('JOB-1') || []).slice().sort()) === '["desk.chat.add","desk.item.get"]' || 'paths: ' + short(W.t.paths('JOB-1'));
}, 1000);
test.run('revoke removes that grant alone', 0.8, function () {
  if (opened()) return opened();
  const t = W.t;
  t.revoke('JOB-1', 'desk.chat.add');
  return (t.has('JOB-1', 'desk.chat.add') === false && t.has('JOB-1', 'desk.item.get') === true && t.has('JOB-2', 'desk.item.get') === true) || short([t.has('JOB-1', 'desk.chat.add'), t.has('JOB-1', 'desk.item.get'), t.has('JOB-2', 'desk.item.get')]);
}, 1000);
test.run('knownPath answers whether any key holds the path', 0.2, function () {
  if (opened()) return opened();
  return (W.t.knownPath('desk.item.get') === true && W.t.knownPath('desk.box.write') === false) || short([W.t.knownPath('desk.item.get'), W.t.knownPath('desk.box.write')]);
}, 1000);
test.run('all answers every grant there is', 0.2, function () {
  if (opened()) return opened();
  const every = W.t.all() || [];
  return (every.length === 2 && every.every(function (r) { return r && r.path; })) || 'all: ' + short(every);
}, 1000);
test.run('opened again on the same file, the grants are there', 0.2, function () {
  if (opened()) return opened();
  const again = W.A.open(W.file, 'grant', 'job_id');
  return again.has('JOB-1', 'desk.item.get') === true || 'has after reopen: ' + short(again.has('JOB-1', 'desk.item.get'));
}, 1000);
test.run('configured as node\'s (grants, peer_id) it is node\'s shape exactly', 0.2, function () {
  if (!W.dir) return 'no module to open: the first test failed';
  const other = W.A.open(path.join(W.dir, 'node.db'), 'grants', 'peer_id');
  other.grant('MCowPEER', 'desk');
  const ndb = new DatabaseSync(path.join(W.dir, 'node.db'), { readOnly: true });
  const nk = ndb.prepare('PRAGMA table_info("grants")').all().filter(function (c) { return c.pk > 0; }).sort(function (a, b) { return a.pk - b.pk; }).map(function (c) { return c.name; });
  ndb.close();
  return (JSON.stringify(nk) === '["peer_id","path"]' && other.has('MCowPEER', 'desk') === true) || 'primary key ' + short(nk);
}, 1000);
