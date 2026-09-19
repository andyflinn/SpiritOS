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
if (k1 && k1.publicLabel === 'andy' && k1.owner === true) {
  test.check('a row goes in and comes back by key, owner flag and all');
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
if (again !== s && again.members.count() === 3 && again.members.get('K1').owner === true) {
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

const byLabel = dump(['label', 'andy']);
if (byLabel.code === 0 && /owner\s+andy\s+K1/.test(byLabel.text)) {
  test.check('a label lookup shows who holds it');
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

relayStore.closeAll();
try { fs.rmSync(H, { recursive: true, force: true }); } catch (e) { /* windows */ }
try { fs.rmSync(empty, { recursive: true, force: true }); } catch (e) { /* windows */ }

test.reportSuccessFailureCount();
