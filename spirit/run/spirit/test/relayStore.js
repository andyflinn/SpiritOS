'use strict';

// spirit/run/spirit/test/relayStore.js
// THE RELAY STORE TAKES NO OLD ROLL, INVITE OR OWNER COLUMN IN (goal/G43.23, item 7; spec: ./relayStore.md). The box:
// "old-data rescue still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json,
// the cycle-3 relay.db owner column." This file holds the relay store's part: this tree's relayStore.js opened in-process on
// scratch roots under /tmp, routingTable.json and invites.json planted on one, a relay.db made as cycle 3 made it on the other.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readText(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
const { DatabaseSync } = require('node:sqlite');
const relayStore = require(path.join(RUN, 'spirit', 'relayStore.js'));

const W = { a: null, b: null, store: null, s2: null, dbFile: null };

// The box: "routingTable.json, invites.json"
const KEY = 'rescue-member-key-' + process.pid;
const TOKEN = 'rescue-invite-token-' + process.pid;
const rollText = JSON.stringify({ peers: { [KEY]: { publicKey: KEY, name: 'old member', claimedAt: '2026-01-01T00:00:00.000Z' } } });
const invText = JSON.stringify([{ token: TOKEN, label: 'old invite', expiresAt: '2099-01-01T00:00:00.000Z', invitedBy: '' }]);
const roll = function () { return path.join(W.a, 'spirit', 'state', 'routingTable.json'); };
const inv = function () { return path.join(W.a, 'spirit', 'state', 'invites.json'); };
const NO_STORE = 'the relay store did not open: the world failed';
test.run('the world: the relay store opens on a scratch root holding routingTable.json and invites.json', 0.2, function () {
  W.a = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-relay-'));
  put(roll(), rollText);
  put(inv(), invText);
  try { W.store = relayStore.open(W.a); } catch (e) { return 'the relay store did not open: ' + String(e && e.message || e) + '; nothing judged'; }
  return !!W.store || 'the relay store did not open: ; nothing judged';
}, 1000);
test.run('the world: a member put on this scratch store is read back', 0.2, function () {
  if (!W.store) return NO_STORE;
  const M = 'world-member-key-' + process.pid;
  W.store.members.put({ publicKey: M, publicLabel: 'world', claimedAt: '' });
  return !!W.store.members.get(M) || 'a member put on this scratch store is not read back: nothing judged';
}, 1000);
test.run('routingTable.json\'s member is not taken into the roll', 0.2, function () {
  if (!W.store) return NO_STORE;
  return !W.store.members.get(KEY) || 'the store took routingTable.json\'s member ' + KEY + ' into the roll';
}, 1000);
test.run('invites.json\'s invite is not taken in', 0.2, function () {
  if (!W.store) return NO_STORE;
  return !W.store.invites.get(TOKEN) || 'the store took invites.json\'s invite ' + TOKEN + ' in';
}, 1000);
test.run('routingTable.json and invites.json are left as they were, neither renamed .imported', 0.2, function () {
  if (!W.store) return NO_STORE;
  const r = roll(); const i = inv();
  return (readText(r) === rollText && readText(i) === invText && !fs.existsSync(r + '.imported') && !fs.existsSync(i + '.imported')) ||
    'the store moved the old files: ' + short({ routingTable: fs.existsSync(r), invites: fs.existsSync(i), rollImported: fs.existsSync(r + '.imported'), invImported: fs.existsSync(i + '.imported') });
}, 1000);

// The box: "the cycle-3 relay.db owner column"
const OWNER = 'cycle3-owner-' + process.pid;
const MEMBER = 'cycle3-member-' + process.pid;
test.run('the world: a relay.db made as cycle 3 made it, its members table with an owner column', 0.2, function () {
  W.b = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-owner-'));
  W.dbFile = path.join(W.b, 'spirit', 'state', 'relay.db');
  fs.mkdirSync(path.dirname(W.dbFile), { recursive: true });
  const db = new DatabaseSync(W.dbFile);
  db.exec('PRAGMA journal_mode = DELETE');
  db.exec("CREATE TABLE members (publicKey TEXT PRIMARY KEY, publicLabel TEXT NOT NULL DEFAULT '', labelNorm TEXT NOT NULL DEFAULT '', claimedAt TEXT NOT NULL DEFAULT '', owner TEXT NOT NULL DEFAULT '', card TEXT NOT NULL DEFAULT '', faceName TEXT NOT NULL DEFAULT '', faceEmail TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', emailVerified INTEGER NOT NULL DEFAULT 0, faceLogins TEXT NOT NULL DEFAULT '[]')");
  db.prepare('INSERT INTO members (publicKey, publicLabel, owner) VALUES (?, ?, ?)').run(MEMBER, 'cycle-3 member', OWNER);
  const had = db.prepare('PRAGMA table_info(members)').all().some(function (c) { return c.name === 'owner'; });
  db.close();
  return had || 'the planted relay.db has no owner column: nothing judged';
}, 1000);
test.run('the world: the relay store opens that relay.db and reads its member', 0.2, function () {
  if (!W.b) return 'no planted relay.db: the world failed';
  let err = '';
  try { W.s2 = relayStore.open(W.b); } catch (e) { err = String(e && e.message || e); }
  const read = !!W.s2 && !!W.s2.members.get(MEMBER);
  try { if (W.s2) W.s2.close(); } catch (e) { /* closed */ }
  return read || 'the relay store did not open that relay.db or read its member: ' + err + '; nothing judged';
}, 1000);
test.run('the owner column is left as it was, its value kept', 0.2, function () {
  if (!W.dbFile) return 'no planted relay.db: the world failed';
  let still = false;
  let ownerOf = '';
  try {
    const db = new DatabaseSync(W.dbFile, { readOnly: true });
    still = db.prepare('PRAGMA table_info(members)').all().some(function (c) { return c.name === 'owner'; });
    if (still) { const r = db.prepare('SELECT owner FROM members WHERE publicKey = ?').get(MEMBER); ownerOf = r ? String(r.owner) : ''; }
    db.close();
  } catch (e) { still = false; }
  return (still && ownerOf === OWNER) || 'opening the store dropped the cycle-3 owner column from members';
}, 1000);

test.after(function () {
  try { relayStore.closeAll(); } catch (e) { /* closed */ }
  for (const d of [W.a, W.b]) { if (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* scratch */ } } }
});
