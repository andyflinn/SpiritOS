'use strict';

// spirit/run/spirit/test/authTableInterface.js
// The tests of spirit/authTableInterface.js, and of no other module (spec: ./authTableInterface.md; goal/G41.4). Andy:
// "node's auth modules will have a file authTableInterface.js, (configured by dataBase.db file name and authTableName)";
// the grant table of agent.db is "structured exactly like the auth table in node". The shape, named by the red:
// open(dbFile, table, keyColumn) -> { has, paths, grant, revoke, all, knownPath }, the names node's auth uses today (cw), a table of
// (keyColumn, path), one row per grant, as node's grants are (peer_id, path; spirit/nodeStore.js:502).

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/authTableInterface/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/authTableInterface'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const FILE = path.join(__dirname, '..', 'authTableInterface.js');

// What the tests share: the module, its scratch folder and the table opened on it.
const W = {};

test.run('it exports open, taking a database file, a table and a key column', 0.2, function () {
  try { W.A = require(FILE); } catch (e) { W.A = null; }
  const A = W.A;
  if (!(!!A && typeof A.open === 'function')) return false;
  W.dir = ownTemp('authTable-');
  W.file = path.join(W.dir, 'agent.db');
  return true;
}, test.limit.quick);
test.run('open answers has, paths, grant, revoke, all and knownPath', 0.2, function () {
  if (!W.file) return false;
  const t = W.A.open(W.file, 'grant', 'job_id');
  if (!(!!t && ['has', 'paths', 'grant', 'revoke', 'all', 'knownPath'].every(function (k) { return typeof t[k] === 'function'; }))) return false;
  W.t = t;
  return true;
}, test.limit.quick);
test.run('it makes the table in that file, keyed by the key column and the path as node\'s grants are', 0.2, function () {
  if (!W.t) return false;
  const db = new DatabaseSync(W.file, { readOnly: true });
  const cols = db.prepare('PRAGMA table_info("grant")').all();
  db.close();
  const pk = cols.filter(function (c) { return c.pk > 0; }).sort(function (a, b) { return a.pk - b.pk; }).map(function (c) { return c.name; });
  return JSON.stringify(pk) === '["job_id","path"]' || false;
}, test.limit.quick);
test.run('has answers true for a grant given, false for any other', 0.8, function () {
  if (!W.t) return false;
  const t = W.t;
  t.grant('JOB-1', 'desk.chat.add');
  t.grant('JOB-1', 'desk.item.get');
  t.grant('JOB-1', 'desk.chat.add');
  t.grant('JOB-2', 'desk.item.get');
  return (t.has('JOB-1', 'desk.chat.add') === true && t.has('JOB-1', 'desk.box.write') === false && t.has('JOB-3', 'desk.chat.add') === false) || false;
}, test.limit.quick);
test.run('paths answers a key\'s paths, each once', 0.2, function () {
  if (!W.t) return false;
  return JSON.stringify((W.t.paths('JOB-1') || []).slice().sort()) === '["desk.chat.add","desk.item.get"]' || false;
}, test.limit.quick);
test.run('revoke removes that grant alone', 0.8, function () {
  if (!W.t) return false;
  const t = W.t;
  t.revoke('JOB-1', 'desk.chat.add');
  return (t.has('JOB-1', 'desk.chat.add') === false && t.has('JOB-1', 'desk.item.get') === true && t.has('JOB-2', 'desk.item.get') === true) || false;
}, test.limit.quick);
test.run('knownPath answers whether any key holds the path', 0.2, function () {
  if (!W.t) return false;
  return (W.t.knownPath('desk.item.get') === true && W.t.knownPath('desk.box.write') === false) || false;
}, test.limit.quick);
test.run('all answers every grant there is', 0.2, function () {
  if (!W.t) return false;
  const every = W.t.all() || [];
  return (every.length === 2 && every.every(function (r) { return r && r.path; })) || false;
}, test.limit.quick);
test.run('opened again on the same file, the grants are there', 0.2, function () {
  if (!W.t) return false;
  const again = W.A.open(W.file, 'grant', 'job_id');
  return again.has('JOB-1', 'desk.item.get') === true || false;
}, test.limit.quick);
test.run('configured as node\'s grants table keyed by peer_id, it is node\'s shape exactly', 0.2, function () {
  if (!W.dir) return false;
  const other = W.A.open(path.join(W.dir, 'node.db'), 'grants', 'peer_id');
  other.grant('MCowPEER', 'desk');
  const ndb = new DatabaseSync(path.join(W.dir, 'node.db'), { readOnly: true });
  const nk = ndb.prepare('PRAGMA table_info("grants")').all().filter(function (c) { return c.pk > 0; }).sort(function (a, b) { return a.pk - b.pk; }).map(function (c) { return c.name; });
  ndb.close();
  return (JSON.stringify(nk) === '["peer_id","path"]' && other.has('MCowPEER', 'desk') === true) || false;
}, test.limit.quick);
