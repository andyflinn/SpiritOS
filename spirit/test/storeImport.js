'use strict';

// spirit/test/storeImport.js
// A RELAY FROM BEFORE CYCLE 3 KEEPS ITS MEMBERS — once.
//
// DEPRECATED(D8, expires: alpha) — this suite goes with the import it
// asserts (design/DEPRECATIONS.md, decision 0014). At the alpha release the
// import is risk-assessed and eliminated or kept; so is this.
//
// spirit-3 holds routingTable.json and invites.json. On the first open
// relayStore reads them into relay.db in one transaction and renames them
// *.imported: kept, never deleted, never read again.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const relayStore = require('../run/js/relayStore');

test.startTest('The one-time import — JSON to relay.db, and never again');

const H = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-import-'));
const state = path.join(H, 'relay-state');
fs.mkdirSync(state, { recursive: true });

// The shape spirit-3 wrote, including what the old readers tolerated: a
// row still carrying `name`, the ring's leftovers, a keyless row, a
// partnership riding a member row.
fs.writeFileSync(path.join(state, 'routingTable.json'), JSON.stringify({
  peers: {
    OWNER: { publicKey: 'OWNER', publicLabel: 'andy', claimedAt: '2026-09-01', owner: true },
    OLD: { publicKey: 'OLD', name: 'legacy', claimedAt: '2026-08-01', messages: [1, 2], nextId: 3 },
    FRIEND: {
      publicKey: 'FRIEND', publicLabel: 'grok', claimedAt: '2026-09-02',
      partner: { relayKey: 'RELAYB', url: 'https://b.example', since: '2026-09-03' },
    },
    nokey: { name: 'ghost' },
  },
}));
fs.writeFileSync(path.join(state, 'invites.json'), JSON.stringify([
  { token: 'LIVE', label: 'zoe', expiresAt: '2099-01-01T00:00:00Z', invitedBy: 'andy' },
  { token: 'SPENT', label: 'yan', expiresAt: '2099-01-01T00:00:00Z', consumedAt: '2026-09-04' },
]));

const s = relayStore.open(H);

test.subHeading('What comes across');

if (s.members.count() === 3) test.check('three keyed rows imported, the keyless one left behind');
else test.fail('members: ' + s.members.count());

const owner = s.members.get('OWNER');
// The old file's `owner: true` is not carried: a row does not know who owns
// the relay (relayStore.js, 2026-09-19) — allow.json does.
if (owner && !('owner' in owner) && owner.publicLabel === 'andy') {
  test.check('the owner’s row is imported, without the mark a row may not carry');
} else {
  test.fail('owner: ' + JSON.stringify(owner));
}

if (s.members.get('OLD') && s.members.get('OLD').publicLabel === 'legacy') {
  test.check('a row that still said `name` arrives with it as its publicLabel (absorbs D1)');
} else {
  test.fail('legacy row: ' + JSON.stringify(s.members.get('OLD')));
}

const p = s.partners.get('RELAYB');
if (p && p.status === 'partnered' && p.ownerKey === 'FRIEND' && p.url === 'https://b.example') {
  test.check('a partner flag on a member row becomes a `partnered` row on the partner roll');
} else {
  test.fail('partner: ' + JSON.stringify(p));
}

if (s.invites.get('LIVE') && s.invites.get('SPENT') === null) {
  test.check('a live invite comes across; one stamped consumedAt was spent and does not (absorbs D4)');
} else {
  test.fail('invites: ' + JSON.stringify(s.invites.all()));
}

test.subHeading('Kept, and never read again');

const names = fs.readdirSync(state).sort();
if (names.indexOf('routingTable.json.imported') !== -1 && names.indexOf('invites.json.imported') !== -1 &&
    names.indexOf('routingTable.json') === -1 && names.indexOf('invites.json') === -1) {
  test.check('both files renamed *.imported — nothing deleted, nothing left to import');
} else {
  test.fail('relay-state holds: ' + names.join(', '));
}

relayStore.closeAll();
const again = relayStore.open(H);
if (again.members.count() === 3 && again.invites.all().length === 1 && again.partners.all().length === 1) {
  test.check('reopened, the counts are the same — the import ran once');
} else {
  test.fail('after reopen: ' + again.members.count() + ' members');
}

test.subHeading('A torn file stops the relay rather than emptying it');

// Read as empty, a truncated routingTable.json would open a relay that has
// quietly forgotten everyone. It refuses instead, and leaves the file
// where the owner will look for it (relayServer.js refuses to start).
relayStore.closeAll();
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-import-torn-'));
fs.mkdirSync(path.join(T, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(T, 'relay-state', 'routingTable.json'), '{"peers": {"half');
let refusal = null;
try { relayStore.open(T); } catch (e) { refusal = e.message; }
if (refusal && /routingTable\.json cannot be read/.test(refusal)) {
  test.check('an unreadable routingTable.json refuses to open, saying which file');
} else {
  test.fail('torn import opened: ' + refusal);
}
if (fs.existsSync(path.join(T, 'relay-state', 'routingTable.json')) &&
    !fs.existsSync(path.join(T, 'relay-state', 'routingTable.json.imported'))) {
  test.check('and the file is left exactly where it was');
} else {
  test.fail('the torn file was moved');
}

relayStore.closeAll();
try { fs.rmSync(H, { recursive: true, force: true }); } catch (e) { /* windows */ }
try { fs.rmSync(T, { recursive: true, force: true }); } catch (e) { /* windows */ }

test.reportSuccessFailureCount();
