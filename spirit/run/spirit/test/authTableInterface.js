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
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'authTableInterface.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('authTableInterface.js: one interface to an auth table, by file, table and key column');

let A = null;
try { A = require(FILE); } catch (e) { A = null; }
ok(!!A && typeof A.open === 'function', 'it exports open(dbFile, table, keyColumn)', 'spirit/authTableInterface.js: ' + (fs.existsSync(FILE) ? short(A && Object.keys(A)) : 'not there'));
if (A && typeof A.open === 'function') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authTable-'));
  const file = path.join(dir, 'agent.db');
  const t = A.open(file, 'grant', 'job_id');
  ok(!!t && ['has', 'paths', 'grant', 'revoke', 'all', 'knownPath'].every(function (k) { return typeof t[k] === 'function'; }), 'open answers { has, paths, grant, revoke, all, knownPath }', 'opened: ' + short(t && Object.keys(t)));
  const db = new DatabaseSync(file, { readOnly: true });
  const cols = db.prepare('PRAGMA table_info("grant")').all();
  const pk = cols.filter(function (c) { return c.pk > 0; }).sort(function (a, b) { return a.pk - b.pk; }).map(function (c) { return c.name; });
  ok(JSON.stringify(pk) === '["job_id","path"]', 'it makes the table in that file, keyed (keyColumn, path) as node\'s grants are', 'primary key ' + short(pk) + ', columns ' + short(cols.map(function (c) { return c.name; })));
  db.close();
  t.grant('JOB-1', 'desk.chat.add');
  t.grant('JOB-1', 'desk.item.get');
  t.grant('JOB-1', 'desk.chat.add');
  t.grant('JOB-2', 'desk.item.get');
  ok(t.has('JOB-1', 'desk.chat.add') === true && t.has('JOB-1', 'desk.box.write') === false && t.has('JOB-3', 'desk.chat.add') === false, 'has answers true for a grant given, false for any other', short([t.has('JOB-1', 'desk.chat.add'), t.has('JOB-1', 'desk.box.write'), t.has('JOB-3', 'desk.chat.add')]));
  ok(JSON.stringify((t.paths('JOB-1') || []).slice().sort()) === '["desk.chat.add","desk.item.get"]', 'paths(key) answers that key\'s paths, each once', 'paths: ' + short(t.paths('JOB-1')));
  t.revoke('JOB-1', 'desk.chat.add');
  ok(t.has('JOB-1', 'desk.chat.add') === false && t.has('JOB-1', 'desk.item.get') === true && t.has('JOB-2', 'desk.item.get') === true, 'revoke removes that grant alone', short([t.has('JOB-1', 'desk.chat.add'), t.has('JOB-1', 'desk.item.get'), t.has('JOB-2', 'desk.item.get')]));
  ok(t.knownPath('desk.item.get') === true && t.knownPath('desk.box.write') === false, 'knownPath answers whether any key holds the path', short([t.knownPath('desk.item.get'), t.knownPath('desk.box.write')]));
  const every = t.all() || [];
  ok(every.length === 2 && every.every(function (r) { return r && r.path; }), 'all answers every grant there is', 'all: ' + short(every));
  const again = A.open(file, 'grant', 'job_id');
  ok(again.has('JOB-1', 'desk.item.get') === true, 'opened again on the same file, the grants are there', 'has after reopen: ' + short(again.has('JOB-1', 'desk.item.get')));
  const other = A.open(path.join(dir, 'node.db'), 'grants', 'peer_id');
  other.grant('MCowPEER', 'desk');
  const ndb = new DatabaseSync(path.join(dir, 'node.db'), { readOnly: true });
  const nk = ndb.prepare('PRAGMA table_info("grants")').all().filter(function (c) { return c.pk > 0; }).sort(function (a, b) { return a.pk - b.pk; }).map(function (c) { return c.name; });
  ndb.close();
  ok(JSON.stringify(nk) === '["peer_id","path"]' && other.has('MCowPEER', 'desk') === true, 'configured as node\'s (grants, peer_id) it is node\'s shape exactly', 'primary key ' + short(nk));
}
test.reportSuccessFailureCount();
