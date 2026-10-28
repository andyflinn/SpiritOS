'use strict';

// spirit/run/spirit/authTableInterface.js
// ONE INTERFACE TO AN AUTH TABLE (goal/G41.4). Andy: "node's auth modules will have a file authTableInterface.js,
// (configured by dataBase.db file name and authTableName)", and the agent app's grant table is "structured exactly like
// the auth table in node". Node's grants are (peer_id, path), one row per grant (spirit/nodeStore.js, apiAuth/G1.3); the
// agent's are (job_id, path), keyed by the job (Andy, box v22: "the jobs have their api requirements on the node"). So
// the key column is named too, and nothing else about the table differs. Its contract and its test:
// ./test/authTableInterface.md and ./test/authTableInterface.js.
//
//   open(dbFile, table, keyColumn) -> { has, paths, grant, revoke, all, knownPath }
//     has(key, path)      true when that key holds that path
//     paths(key)          that key's paths, each once, in order
//     grant(key, path)    gives it; a grant given twice is one row
//     revoke(key, path)   takes that one grant away; true when there was one
//     all()               every grant, [{ key, path }], by key then path
//     knownPath(path)     true when any key holds the path
//
// The names are the ones node's auth uses today (nodeStore's store.auth). Node's label and relabel are not here: they
// read node's shadow roll, which an auth table does not hold.
const { DatabaseSync } = require('node:sqlite');

// A table or a column name goes into the SQL as it is, so only a plain name is taken.
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function open(dbFile, table, keyColumn) {
  if (!dbFile || typeof dbFile !== 'string') throw new Error('authTableInterface: open needs the database file');
  if (!NAME.test(String(table))) throw new Error('authTableInterface: "' + table + '" is not a table name');
  if (!NAME.test(String(keyColumn))) throw new Error('authTableInterface: "' + keyColumn + '" is not a column name');
  const db = new DatabaseSync(dbFile);
  const t = '"' + table + '"';
  const k = '"' + keyColumn + '"';
  db.exec('CREATE TABLE IF NOT EXISTS ' + t + ' (' + k + ' TEXT NOT NULL, path TEXT NOT NULL, PRIMARY KEY (' + k + ', path))');
  const q = {
    has: db.prepare('SELECT 1 FROM ' + t + ' WHERE ' + k + ' = ? AND path = ?'),
    paths: db.prepare('SELECT path FROM ' + t + ' WHERE ' + k + ' = ? ORDER BY path'),
    put: db.prepare('INSERT OR IGNORE INTO ' + t + ' (' + k + ', path) VALUES (?, ?)'),
    del: db.prepare('DELETE FROM ' + t + ' WHERE ' + k + ' = ? AND path = ?'),
    all: db.prepare('SELECT ' + k + ' AS key, path FROM ' + t + ' ORDER BY ' + k + ', path'),
    known: db.prepare('SELECT 1 FROM ' + t + ' WHERE path = ? LIMIT 1'),
  };
  return {
    has: function (key, p) { return !!q.has.get(String(key), String(p)); },
    paths: function (key) { return q.paths.all(String(key)).map(function (r) { return r.path; }); },
    grant: function (key, p) { q.put.run(String(key), String(p)); },
    revoke: function (key, p) { return q.del.run(String(key), String(p)).changes > 0; },
    all: function () { return q.all.all().map(function (r) { return { key: r.key, path: r.path }; }); },
    knownPath: function (p) { return !!q.known.get(String(p)); },
  };
}

module.exports = { open: open };
