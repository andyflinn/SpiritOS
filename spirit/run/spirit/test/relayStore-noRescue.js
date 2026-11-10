'use strict';

// spirit/run/spirit/test/relayStore-noRescue.js
// THE RELAY STORE TAKES NO OLD ROLL, INVITE OR OWNER COLUMN IN (goal/G43.23, item 7; spec: ./relayStore-noRescue.md). The box:
// "old-data rescue still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json,
// the cycle-3 relay.db owner column." This file holds the relay store's part: this tree's relayStore.js opened in-process on
// scratch roots under /tmp, routingTable.json and invites.json planted on one, a relay.db made as cycle 3 made it on the other.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readText(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
const { DatabaseSync } = require('node:sqlite');

test.startTest('relayStore-noRescue.js: on scratch roots, the relay store takes no old roll, invite or owner column in (goal/G43.23, item 7)');

function relayChecks() {
  const relayStore = require(path.join(RUN, 'spirit', 'relayStore.js'));
  const a = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-relay-'));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-owner-'));
  try {
    test.subHeading('The box: "routingTable.json, invites.json"');
    const KEY = 'rescue-member-key-' + process.pid;
    const TOKEN = 'rescue-invite-token-' + process.pid;
    const roll = path.join(a, 'spirit', 'state', 'routingTable.json');
    const inv = path.join(a, 'spirit', 'state', 'invites.json');
    const rollText = JSON.stringify({ peers: { [KEY]: { publicKey: KEY, name: 'old member', claimedAt: '2026-01-01T00:00:00.000Z' } } });
    const invText = JSON.stringify([{ token: TOKEN, label: 'old invite', expiresAt: '2099-01-01T00:00:00.000Z', invitedBy: '' }]);
    put(roll, rollText);
    put(inv, invText);
    let store = null;
    let err = '';
    try { store = relayStore.open(a); } catch (e) { err = String(e && e.message || e); }
    ok(!!store, 'the world: the relay store opens on a scratch root holding routingTable.json and invites.json', 'the relay store did not open: ' + err + '; nothing judged');
    if (store) {
      const W = 'world-member-key-' + process.pid;
      store.members.put({ publicKey: W, publicLabel: 'world', claimedAt: '' });
      ok(!!store.members.get(W), 'the world: a member put on this scratch store is read back', 'a member put on this scratch store is not read back: nothing judged');
      ok(!store.members.get(KEY), 'routingTable.json\'s member is not taken into the roll', 'the store took routingTable.json\'s member ' + KEY + ' into the roll');
      ok(!store.invites.get(TOKEN), 'invites.json\'s invite is not taken in', 'the store took invites.json\'s invite ' + TOKEN + ' in');
      ok(readText(roll) === rollText && readText(inv) === invText && !fs.existsSync(roll + '.imported') && !fs.existsSync(inv + '.imported'),
        'routingTable.json and invites.json are left as they were, neither renamed .imported',
        'the store moved the old files: ' + short({ routingTable: fs.existsSync(roll), invites: fs.existsSync(inv), rollImported: fs.existsSync(roll + '.imported'), invImported: fs.existsSync(inv + '.imported') }));
    }

    test.subHeading('The box: "the cycle-3 relay.db owner column"');
    const dbFile = path.join(b, 'spirit', 'state', 'relay.db');
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    const OWNER = 'cycle3-owner-' + process.pid;
    const MEMBER = 'cycle3-member-' + process.pid;
    let db = new DatabaseSync(dbFile);
    db.exec('PRAGMA journal_mode = DELETE');
    db.exec("CREATE TABLE members (publicKey TEXT PRIMARY KEY, publicLabel TEXT NOT NULL DEFAULT '', labelNorm TEXT NOT NULL DEFAULT '', claimedAt TEXT NOT NULL DEFAULT '', owner TEXT NOT NULL DEFAULT '', card TEXT NOT NULL DEFAULT '', faceName TEXT NOT NULL DEFAULT '', faceEmail TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', emailVerified INTEGER NOT NULL DEFAULT 0, faceLogins TEXT NOT NULL DEFAULT '[]')");
    db.prepare('INSERT INTO members (publicKey, publicLabel, owner) VALUES (?, ?, ?)').run(MEMBER, 'cycle-3 member', OWNER);
    const had = db.prepare('PRAGMA table_info(members)').all().some(function (c) { return c.name === 'owner'; });
    db.close();
    ok(had, 'the world: a relay.db made as cycle 3 made it, its members table with an owner column', 'the planted relay.db has no owner column: nothing judged');
    let s2 = null;
    err = '';
    try { s2 = relayStore.open(b); } catch (e) { err = String(e && e.message || e); }
    ok(!!s2 && !!s2.members.get(MEMBER), 'the world: the relay store opens that relay.db and reads its member', 'the relay store did not open that relay.db or read its member: ' + err + '; nothing judged');
    try { if (s2) s2.close(); } catch (e) { /* closed */ }
    let still = false;
    let ownerOf = '';
    try {
      db = new DatabaseSync(dbFile, { readOnly: true });
      still = db.prepare('PRAGMA table_info(members)').all().some(function (c) { return c.name === 'owner'; });
      if (still) { const r = db.prepare('SELECT owner FROM members WHERE publicKey = ?').get(MEMBER); ownerOf = r ? String(r.owner) : ''; }
      db.close();
    } catch (e) { still = false; }
    ok(still && ownerOf === OWNER, 'the owner column is left as it was, its value kept',
      'opening the store dropped the cycle-3 owner column from members');
  } finally {
    try { relayStore.closeAll(); } catch (e) { /* closed */ }
    try { fs.rmSync(a, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { fs.rmSync(b, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

try { relayChecks(); } catch (e) { test.fail('the test threw ' + (e && e.stack || e)); }
test.reportSuccessFailureCount();
process.exit(0);
