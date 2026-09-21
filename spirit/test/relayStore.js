'use strict';

// spirit/test/relayStore.js
// THE RELAY'S DATA ON DISC — the store itself, and the tool that reads it.
//
// Cycle 3 (design/cycles/2026-09-19-disc-and-owner-token-cycle-3.md): the
// roll, the invites and the partner roll live in relay-state/relay.db and
// RAM is their client. This suite asserts the store's contract directly —
// what relay.js and invites.js build on — and relayDump.js, the read-only
// SSH view that replaced `cat routingTable.json`.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const relayStore = require('../run/js/relayStore');
const relayDump = require('../run/js/relayDump');
const auth = require('../run/js/relayAuth');

function home() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-store-'));
}

test.startTest('relayStore — the relay\'s data, on disc');

const H = home();
const s = relayStore.open(H);

test.subHeading('Members, by key');

s.members.put({ publicKey: 'K1', publicLabel: 'andy', claimedAt: '2026-01-01', owner: true });
s.members.put({ publicKey: 'K2', publicLabel: ' bert ', claimedAt: '2026-01-02' });
s.members.put({ publicKey: 'K3', publicLabel: 'bert', claimedAt: '2026-01-03' });

const k1 = s.members.get('K1');
// `owner: true` is offered above, as a caller written before 2026-09-19
// would, and does not stick: a row does not know who owns the relay.
if (k1 && k1.publicLabel === 'andy' && !('owner' in k1)) {
  test.check('a row goes in and comes back by key — and carries no owner flag, offered or not');
} else {
  test.fail('get K1: ' + JSON.stringify(k1));
}

if (s.members.get('nobody') === null && s.members.get('') === null) {
  test.check('an unknown or empty key is null, not an error');
} else {
  test.fail('unknown key answered something');
}

// Labels duplicate by design; the index answers every holder up to a limit.
const berts = s.members.byLabel('bert', 5).map(function (m) { return m.publicKey; }).sort();
if (berts.join(',') === 'K2,K3') {
  test.check('a label answers every holder — labels are not identities');
} else {
  test.fail('byLabel bert: ' + JSON.stringify(berts));
}
if (s.members.byLabel('bert', 1).length === 1) {
  test.check('and the limit is honoured, so a lookup never reads a whole crowd');
} else {
  test.fail('limit ignored');
}

if (s.members.count() === 3) test.check('count is a number from the disc');
else test.fail('count: ' + s.members.count());

// The cursor: handed over one at a time, and it stops when told to.
let seen = 0;
s.members.each(function () { seen += 1; return seen < 2 ? undefined : false; });
if (seen === 2) test.check('each() is a cursor that stops when the caller has enough');
else test.fail('each visited ' + seen);

s.members.put({ publicKey: 'K2', publicLabel: 'bertie', claimedAt: '2026-01-02' });
if (s.members.get('K2').publicLabel === 'bertie' && s.members.count() === 3) {
  test.check('putting the same key again updates the row, it does not add one');
} else {
  test.fail('upsert: ' + JSON.stringify(s.members.get('K2')));
}

test.subHeading('Invites and the partner roll');

s.invites.add({ token: 'T1', label: 'zoe', expiresAt: '2026-01-01T00:00:00Z', invitedBy: 'K1' });
s.invites.add({ token: 'T2', label: 'yan', expiresAt: '2099-01-01T00:00:00Z', invitedBy: 'K1' });
const swept = s.invites.sweepExpired('2026-06-01T00:00:00Z');
if (swept === 1 && s.invites.get('T1') === null && s.invites.get('T2')) {
  test.check('an expired invite is swept and a live one stays');
} else {
  test.fail('sweep=' + swept + ' all=' + JSON.stringify(s.invites.all()));
}

s.partners.put({ relayKey: 'R1', url: 'http://r1', ownerKey: 'K3', status: 'partnered', since: 'x' });
const p = s.partners.get('R1');
if (p && p.status === 'partnered' && s.partners.byOwner('K3').length === 1) {
  test.check('a partner row is by relay key, with a status, findable by the owner who holds it');
} else {
  test.fail('partner: ' + JSON.stringify(p));
}

test.subHeading('When a partnership last worked (R12)');

{
  // `since` says when a partnership BEGAN. Nothing said when it last
  // carried anything, so the only liveness a relay had was the partner
  // STREAM — which R13 removes. This is the column that replaces it, and
  // what orders a search fan-out once it does.
  if (p && p.last === '') {
    test.check('a partnership that has never answered reads as empty, not null');
  } else {
    test.fail('a fresh partner row: ' + JSON.stringify(p));
  }

  const when = '2026-09-21T12:00:00.000Z';
  s.partners.touch('R1', when);
  const touched = s.partners.get('R1');

  // AND IT TOUCHES NOTHING ELSE. `put` is somebody deciding a partnership
  // exists; this is the wire saying it still does. Two events, two
  // authors, and a stamp that rewrote `since` or `url` would let the
  // second quietly undo the first.
  if (touched.last === when && touched.since === 'x' && touched.url === 'http://r1') {
    test.check('a partnership that answered is stamped, and nothing else on the row moves');
  } else {
    test.fail('after touch: ' + JSON.stringify(touched));
  }

  // NEVER CREATES A ROW. A partnership is made deliberately; having
  // answered is not how one comes into being — and a relay that could be
  // written into its own partner roll by anything that replied would have
  // no partner roll at all.
  if (s.partners.touch('NO-SUCH-RELAY') === false && s.partners.get('NO-SUCH-RELAY') === null) {
    test.check('while a stamp for a relay that is not a partner creates nothing');
  } else {
    test.fail('touch created a row: ' + JSON.stringify(s.partners.get('NO-SUCH-RELAY')));
  }
}

test.subHeading('A relay that ran before the column existed (R12)');

{
  // `CREATE TABLE IF NOT EXISTS` does nothing to a table that already
  // exists, so a live relay would never get the new column — and would
  // fail on the first WRITE rather than the first read, which is the worse
  // end to find out.
  //
  // Built by hand rather than by mocking: the old schema, exactly as it
  // shipped, then opened by today's code.
  const oldHome = home();
  fs.mkdirSync(path.join(oldHome, 'relay-state'), { recursive: true });
  const { DatabaseSync } = require('node:sqlite');
  const raw = new DatabaseSync(path.join(oldHome, 'relay-state', 'relay.db'));
  raw.exec(`
    CREATE TABLE partners (
      relayKey TEXT PRIMARY KEY,
      url      TEXT NOT NULL,
      ownerKey TEXT NOT NULL DEFAULT '',
      status   TEXT NOT NULL,
      since    TEXT NOT NULL DEFAULT ''
    );
  `);
  raw.exec("INSERT INTO partners (relayKey, url, ownerKey, status, since) " +
    "VALUES ('OLD-R', 'http://old', 'OLD-K', 'partnered', 'then')");
  raw.close();

  const migrated = relayStore.open(oldHome);
  const row = migrated.partners.get('OLD-R');
  if (row && row.since === 'then' && row.last === '') {
    test.check('an existing partner roll gains the column without losing a row');
  } else {
    test.fail('after opening an old database: ' + JSON.stringify(row));
  }

  // And the write that would have failed now works, which is the half a
  // read-only check would have missed.
  migrated.partners.touch('OLD-R', '2026-09-21T13:00:00.000Z');
  if (migrated.partners.get('OLD-R').last === '2026-09-21T13:00:00.000Z') {
    test.check('and the write that had nowhere to go now has somewhere');
  } else {
    test.fail('touch after migration: ' + JSON.stringify(migrated.partners.get('OLD-R')));
  }
  migrated.close();
}

test.subHeading('All or nothing');

try {
  s.transaction(function () {
    s.members.remove('K3');
    s.partners.removeOwner('K3');
    throw new Error('half way');
  });
} catch (e) { /* expected */ }
if (s.members.get('K3') && s.partners.get('R1')) {
  test.check('a transaction that throws leaves both tables as they were');
} else {
  test.fail('a failed transaction left half its writes');
}

test.subHeading('Deleted means gone from the file');

// secure_delete: a removed row's bytes are zeroed, not left in a free page.
s.members.put({ publicKey: 'K9', publicLabel: '+15550199', claimedAt: '' });
s.members.remove('K9');
const bytes = fs.readFileSync(path.join(H, 'relay-state', 'relay.db')).toString('latin1');
if (bytes.indexOf('+15550199') === -1) {
  test.check('a removed member\'s label is not readable in relay.db');
} else {
  test.fail('the removed label is still on disc');
}

test.subHeading('It survives the process');

if (relayStore.open(H) === s) test.check('one store per home — relay.js and invites.js share it');
else test.fail('open() made a second connection');

relayStore.closeAll();
const again = relayStore.open(H);
if (again !== s && again.members.count() === 3 && again.members.get('K1').publicLabel === 'andy') {
  test.check('closed and reopened, the rows are still there');
} else {
  test.fail('after reopen: count=' + again.members.count());
}

test.subHeading('relayDump — what an owner reads over SSH');

function dump(args) {
  const lines = [];
  const code = relayDump.run(H, args, function (l) { lines.push(String(l)); });
  return { code: code, text: lines.join('\n') };
}

const counts = dump([]);
if (counts.code === 0 && /members\s+3/.test(counts.text) && /partners\s+1/.test(counts.text)) {
  test.check('with no arguments it prints counts');
} else {
  test.fail('counts: ' + JSON.stringify(counts));
}
if (counts.text.indexOf('K1') === -1 && counts.text.indexOf('andy') === -1) {
  test.check('and names nobody — no whole-roll print (0012 widened)');
} else {
  test.fail('the count view named a member: ' + counts.text);
}

const byKey = dump(['key', 'K3']);
if (byKey.code === 0 && byKey.text.indexOf('"bert"') !== -1 && byKey.text.indexOf('http://r1') !== -1) {
  test.check('a key lookup shows the row and any partnership it holds');
} else {
  test.fail('key: ' + JSON.stringify(byKey));
}

// The owner is allow.json's one key, never a mark on the row.
auth.writeAllowKeys(H, [{ name: 'andy', publicKey: 'K1' }]);
const byLabel = dump(['label', 'andy']);
const byBert = dump(['label', 'bert']);
if (byLabel.code === 0 && /owner\s+andy\s+K1/.test(byLabel.text) && /member\s+bert\s+K3/.test(byBert.text)) {
  test.check('a label lookup shows who holds it, the owner named from allow.json');
} else {
  test.fail('label: ' + JSON.stringify(byLabel));
}

const ro = relayStore.openReadOnly(H);
let threw = false;
try { ro.members.put({ publicKey: 'KX', publicLabel: 'x' }); } catch (e) { threw = true; }
ro.close();
if (threw && again.members.get('KX') === null) {
  test.check('the dump\'s connection is read-only — a write throws and nothing lands');
} else {
  test.fail('read-only store accepted a write');
}

const empty = home();
if (relayStore.openReadOnly(empty) === null && !fs.existsSync(path.join(empty, 'relay-state'))) {
  test.check('and dumping a box with no relay.db creates nothing');
} else {
  test.fail('openReadOnly created state on an empty home');
}

test.subHeading('A relay.db from cycle 3 loses the owner column, once');

// Cycle 3 created `members` with an `owner` column copied from allow.json
// at claim time. Andy (2026-09-19): "a row in the roll doesn't know who the
// owner is. Ownership is only determined by one identified key."
{
  const old = home();
  fs.mkdirSync(path.join(old, 'relay-state'), { recursive: true });
  const sqlite = require('node:sqlite');
  const file = path.join(old, 'relay-state', 'relay.db');
  const raw = new sqlite.DatabaseSync(file);
  raw.exec(`CREATE TABLE members (publicKey TEXT PRIMARY KEY, publicLabel TEXT NOT NULL DEFAULT '',
    labelNorm TEXT NOT NULL DEFAULT '', claimedAt TEXT NOT NULL DEFAULT '', owner INTEGER NOT NULL DEFAULT 0)`);
  raw.exec("INSERT INTO members VALUES ('KO', 'andy', 'andy', '2026-09-01', 1), ('KM', 'bert', 'bert', '2026-09-02', 0)");
  raw.close();

  const cols = function () {
    const db = new sqlite.DatabaseSync(file, { readOnly: true });
    const names = db.prepare('PRAGMA table_info(members)').all().map(function (c) { return c.name; });
    db.close();
    return names;
  };
  const st = relayStore.open(old);
  if (cols().indexOf('owner') === -1 && st.members.count() === 2 && st.members.get('KO').publicLabel === 'andy') {
    test.check('the column is gone and every row kept');
  } else {
    test.fail('columns ' + cols().join(',') + ' count ' + st.members.count());
  }
  st.members.put({ publicKey: 'KN', publicLabel: 'carol', claimedAt: '2026-09-03' });
  relayStore.closeAll();
  const back = relayStore.open(old);
  if (back.members.count() === 3 && cols().indexOf('owner') === -1) {
    test.check('and opening it again changes nothing — asked of the table, not assumed');
  } else {
    test.fail('second open: ' + back.members.count());
  }
  relayStore.closeAll();
  try { fs.rmSync(old, { recursive: true, force: true }); } catch (e) { /* windows */ }
}

relayStore.closeAll();
try { fs.rmSync(H, { recursive: true, force: true }); } catch (e) { /* windows */ }
try { fs.rmSync(empty, { recursive: true, force: true }); } catch (e) { /* windows */ }

test.reportSuccessFailureCount();
