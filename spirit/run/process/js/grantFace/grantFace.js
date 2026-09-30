'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../js/appServer.js');

const argv = process.argv;
const at = argv.indexOf('--state');
const STATE = at !== -1 ? argv[at + 1] : '';
if (!STATE) {
  console.error('grantFace: no --state; the node that starts this names its state folder');
  process.exit(2);
}
fs.mkdirSync(STATE, { recursive: true });

const db = new DatabaseSync(path.join(STATE, 'grants.db'));
db.exec('PRAGMA busy_timeout=5000');
db.exec('PRAGMA journal_mode=WAL');
db.exec('CREATE TABLE IF NOT EXISTS slots (name TEXT PRIMARY KEY, id TEXT NOT NULL, at TEXT NOT NULL)');
const holderOf = db.prepare('SELECT id FROM slots WHERE name = ?');
const put = db.prepare('INSERT INTO slots (name, id, at) VALUES (?, ?, ?)');
const dropName = db.prepare('DELETE FROM slots WHERE name = ?');
const dropId = db.prepare('DELETE FROM slots WHERE id = ?');

const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function refused(code, message) {
  const e = new Error(message);
  e.refusal = code;
  return e;
}
function holder(name) {
  const row = holderOf.get(name);
  return row ? String(row.id) : '';
}

appServer.serve({
  grant: {
    request: { name: '', id: '' }, reply: { name: '', id: '' },
    handler: function (a) {
      if (!NAME_RE.test(a.name)) throw refused('bad-request', 'a name is 1-63 of a-z, 0-9 and -, not starting or ending with -');
      if (!a.id) throw refused('bad-request', 'an id is required');
      const held = holder(a.name);
      if (held && held !== a.id) throw refused('slot-held', 'this name is held by another id');
      if (!held) put.run(a.name, a.id, new Date().toISOString());
      return { name: a.name, id: a.id };
    },
  },
  delete: {
    request: { name: '', id: '' }, reply: { removed: 0 },
    handler: function (a) {
      if (Boolean(a.name) === Boolean(a.id)) throw refused('bad-request', 'name or id, exactly one');
      const r = a.name ? dropName.run(a.name) : dropId.run(a.id);
      return { removed: Number(r.changes) };
    },
  },
  get: {
    request: { name: '' }, reply: { name: '', id: '' },
    handler: function (a) { return { name: a.name, id: holder(a.name) }; },
  },
});
