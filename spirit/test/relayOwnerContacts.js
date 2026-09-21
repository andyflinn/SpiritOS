'use strict';

// spirit/test/relayOwnerContacts.js
// A relay owner's new members become contacts, and no contact knows about
// seats.
//
//   Andy: "when someone binds to a peer i own, it's because i want them in
//   my network, so i want a contact auto-generated."
//
// ── WHAT THIS SUITE ASSERTED UNTIL 2026-09-19 ────────────────────────
//
// A roster sweep (hub.reconcileMembers, reconcileOrphans, syncMembers):
// everybody on an owned relay's census roster became a contact carrying
// `memberOf`, everybody on no roster lost it, a key on no census was marked
// `missingSince`, and Forget refused while `memberOf` named a relay. The
// census went on 2026-09-18 and a roster may never be returned again — a
// member list, which 0012 widened forbids, and one that breaks PAYLOAD_MAX.
// The sweep then read [] for ever and pruned every member contact on every
// probe, until it was found and deleted.
//
// Andy's rules for what replaced it:
//
//   "Relays only provide one way to find nodes or relays: SEARCH. What is
//   not found cannot influence decisions. We design to do the best with
//   what we find; we won't be bothered with what we can't find or know."
//   "Email addresses change, contacts go stale. Deal with it."
//   "Nodes have two sources of knowledge: search (active) and broadcasts
//   (passive)."
//
// So a new member is adopted from the claim event itself (a broadcast the
// owner's node receives), and Forget acts rather than asks — see
// contactsDetails.js for the screen that removes the key from every owned
// relay first.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const contactBook = require('../run/js/contacts');

const MINE = 'https://mine.example';
const THEIRS = 'https://theirs.example';

function tmpHome(name) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-owner-'));
  auth.saveIdentity(home, auth.generateIdentity(name || 'owner'));
  return home;
}

function hubFor(home) {
  return require('../run/js/hub').createHub(home);
}

function fakeRes() {
  const out = { status: 0, text: '', finished: false };
  out.writeHead = function (status) { out.status = status; };
  out.end = function (text) {
    out.text = String(text == null ? '' : text);
    out.finished = true;
    if (out.done) out.done(out);
  };
  out.wait = function () {
    return new Promise(function (resolve) {
      if (out.finished) { resolve(out); return; }
      out.done = resolve;
    });
  };
  out.body = function () {
    try { return JSON.parse(out.text); } catch (e) { return null; }
  };
  return out;
}

// handlePeer reads its body through the readJsonBody it is handed, so the
// request itself can be anything.
function readBody(body) {
  return function () { return Promise.resolve(body); };
}

test.startTest('A relay owner’s new members are contacts; no contact knows about seats');

// ── 1. ADOPTED FROM THE CLAIM EVENT ──────────────────────────────────

function aClaimAdopts() {
  test.subHeading('A claim on a relay I own makes the claimer a contact');

  const home = tmpHome();
  const me = auth.loadIdentity(home).publicKey;
  const hub = hubFor(home);

  // What presenceNode hands onOwnerEvent: the relay's row, with the relay
  // it arrived from stamped on.
  const row = hub.adoptClaim({ kind: 'claim', key: 'K-CRUELLA', label: 'Cruella',
    invite: 'cruella', owner: false, relay: MINE });
  const held = contactBook.byPublicKey(home, 'K-CRUELLA');
  if (row && held && contactBook.acquiredVia(held) === contactBook.MEMBER) {
    test.check('the claimer is a contact, acquired as a member — how they came, recorded');
  } else {
    test.fail('adopted: ' + JSON.stringify(held));
  }
  if (held && held.publicLabel === 'Cruella' && (held.relays || []).indexOf(MINE) !== -1) {
    test.check('with the label they chose and the relay it happened on');
  } else {
    test.fail('row: ' + JSON.stringify(held));
  }
  if (contactBook.listens(held)) {
    test.check('and this node listens to them — they can write to me');
  } else {
    test.fail('not listened to: ' + JSON.stringify(held));
  }

  // Never this node's own claim, and never anything but a claim.
  hub.adoptClaim({ kind: 'claim', key: me, label: 'owner', owner: true, relay: MINE });
  hub.adoptClaim({ kind: 'claim', key: me, label: 'owner', owner: false, relay: MINE });
  hub.adoptClaim({ kind: 'claim-refused', key: 'K-EVE', label: 'eve', relay: MINE });
  hub.adoptClaim({ kind: 'mint', key: 'K-MALLORY', relay: MINE });
  if (!contactBook.byPublicKey(home, me) && !contactBook.byPublicKey(home, 'K-EVE') &&
      !contactBook.byPublicKey(home, 'K-MALLORY')) {
    test.check('never this node itself, a refused claim, or any other event');
  } else {
    test.fail('adopted what it should not have');
  }

  // Andy: "membership can only expire, not be demoted." `member` is the
  // top of the ladder (contacts.js ACQUIRED_RANK), so a member acquired
  // again at a lower rank — found by handle, say — stays a member.
  contactBook.acquire(home, { publicKey: 'K-CRUELLA', publicLabel: 'Cruella', relay: THEIRS }, 'handle');
  if (contactBook.acquiredVia(contactBook.byPublicKey(home, 'K-CRUELLA')) === contactBook.MEMBER) {
    test.check('and a member acquired again at a lower rank stays a member — ranks never fall');
  } else {
    test.fail('rank fell: ' + JSON.stringify(contactBook.byPublicKey(home, 'K-CRUELLA')));
  }

  // Tolerant: node.db may still be open (0021 marks the memory on every
  // book write), and testSupport reclaims whatever is left at exit.
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* reclaimed at exit */ }
}

// ── 2. FORGET DOES NOT ASK ABOUT SEATS ───────────────────────────────

async function forgetDoesNotAsk() {
  test.subHeading('Forget forgets — it asks about no seat');

  const home = tmpHome();
  const hub = hubFor(home);

  hub.adoptClaim({ kind: 'claim', key: 'K-CRUELLA', label: 'Cruella', owner: false, relay: MINE });
  // A book written by older code, still carrying the sweep's fields.
  const rows = JSON.parse(fs.readFileSync(path.join(home, 'relay-state', 'contacts.json'), 'utf8'));
  rows.forEach(function (r) {
    if (r.publicKey === 'K-CRUELLA') { r.memberOf = [MINE]; r.missingSince = '2026-09-17T01:00:00.000Z'; }
  });
  fs.writeFileSync(path.join(home, 'relay-state', 'contacts.json'), JSON.stringify(rows));

  const res = fakeRes();
  hub.handlePeer({}, res, readBody({ publicKey: 'K-CRUELLA' }), 'forget');
  await res.wait();
  if (res.status === 200 && !contactBook.byPublicKey(home, 'K-CRUELLA')) {
    test.check('a member is forgotten like anybody — a stale memberOf decides nothing');
  } else {
    test.fail('forget answered ' + res.status + ': ' + res.text);
  }

  // Tolerant: node.db may still be open (0021 marks the memory on every
  // book write), and testSupport reclaims whatever is left at exit.
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* reclaimed at exit */ }
}

// ── 3. THE OLD FIELDS FALL AWAY ──────────────────────────────────────

function staleFieldsFallAway() {
  test.subHeading('A row older code wrote loses memberOf and missingSince on its next write');

  const home = tmpHome();
  contactBook.acquire(home, { publicKey: 'K-JAZZ', publicLabel: 'jazz', relay: MINE }, 'handle');
  const file = path.join(home, 'relay-state', 'contacts.json');
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  rows[0].memberOf = [MINE];
  rows[0].missingSince = '2026-09-17T01:00:00.000Z';
  fs.writeFileSync(file, JSON.stringify(rows));

  // Any write through the book — here, a label of my own.
  contactBook.setMyLabel(home, 'K-JAZZ', 'Jazzmin');
  contactBook.acquire(home, { publicKey: 'K-JAZZ', publicLabel: 'jazz', relay: MINE }, 'handle');
  const after = JSON.parse(fs.readFileSync(file, 'utf8'))[0];
  if (after && after.memberOf === undefined && after.missingSince === undefined) {
    test.check('the next write through the book drops both — nothing reads them');
  } else {
    test.fail('still carried: ' + JSON.stringify(after));
  }

  // Tolerant: node.db may still be open (0021 marks the memory on every
  // book write), and testSupport reclaims whatever is left at exit.
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* reclaimed at exit */ }
}

// ── 4. AND THE SWEEP IS GONE, NOT DORMANT ────────────────────────────

function theSweepIsGone() {
  test.subHeading('The roster sweep is gone, not dormant');

  const hub = hubFor(tmpHome());
  const gone = ['reconcileMembers', 'reconcileOrphans', 'syncMembers'].filter(function (n) {
    return typeof hub[n] !== 'undefined';
  });
  const bookGone = ['memberOf', 'isMember', 'setMemberOf', 'missingSince', 'setMissing'].filter(function (n) {
    return typeof contactBook[n] !== 'undefined';
  });
  if (!gone.length && !bookGone.length) {
    test.check('no sweep in the hub and no seat fields in the book — nothing waits for a roster');
  } else {
    test.fail('still exported: ' + gone.concat(bookGone).join(', '));
  }
}

aClaimAdopts();
forgetDoesNotAsk()
  .then(function () { staleFieldsFallAway(); theSweepIsGone(); })
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () { test.reportSuccessFailureCount(); });
