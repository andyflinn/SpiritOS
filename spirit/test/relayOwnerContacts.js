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
// everybody on an owned relay's roll roster became a contact carrying
// `memberOf`, everybody on no roster lost it, a key on no roll was marked
// `missingSince`, and Forget refused while `memberOf` named a relay. The
// roll went on 2026-09-18 and a roster may never be returned again — a
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
const auth = require('../run/spirit/relayAuth');
const contactBook = require('../run/spirit/contacts');
const relayKeys = require('../run/spirit/relayKeys');
const nodeStore = require('../run/spirit/nodeStore');

const MINE = 'https://mine.example';
const THEIRS = 'https://theirs.example';

function tmpHome(name) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-owner-'));
  auth.saveIdentity(home, auth.generateIdentity(name || 'owner'));
  return home;
}

function hubFor(home) {
  return require('../run/spirit/hub').createHub(home);
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
  // The relay I own, pinned, so the relay a claim happened on can be a route to the claimer (goal/G40.11).
  relayKeys.accept(home, MINE, 'K-RELAY-MINE');

  // What presenceNode hands onOwnerEvent: the relay's row, with the relay
  // it arrived from stamped on.
  const row = hub.adoptClaim({ kind: 'claim', key: 'K-CRUELLA', label: 'Cruella',
    invite: 'cruella', owner: false, relay: MINE });
  const held = contactBook.byPublicKey(home, 'K-CRUELLA');
  // KEPT (goal/G40.11): the row's keep flag. How they came (acquiredVia 'member') went with the box.
  if (row && held && held.keep === true) {
    test.check('the claimer is a contact: their row is kept');
  } else {
    test.fail('adopted: ' + JSON.stringify(held));
  }
  const routes = nodeStore.open(home).seen.routes('K-CRUELLA');
  if (held && held.publicLabel === 'Cruella' && routes.some(function (r) { return r.url === MINE && r.at === 'K-RELAY-MINE'; })) {
    test.check('with the label they chose, and the relay it happened on as a route to them');
  } else {
    test.fail('row: ' + JSON.stringify({ row: held, routes: routes }));
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

  // Andy: "membership can only expire, not be demoted." The ladder of ranks is gone (goal/G40.11); kept is kept, and
  // acquiring a kept row again, found somewhere else, leaves it kept.
  contactBook.acquire(home, { publicKey: 'K-CRUELLA', publicLabel: 'Cruella', relay: THEIRS });
  const again = contactBook.byPublicKey(home, 'K-CRUELLA');
  if (again && again.keep === true && contactBook.listens(again) && typeof contactBook.acquiredVia === 'undefined') {
    test.check('and a member acquired again stays kept, with no ladder of ranks left to fall down');
  } else {
    test.fail('after a second acquire: ' + JSON.stringify(again));
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

  // FORGOTTEN, NOT ERASED (goal/G40.11): the row stays in the table, its routes with it, and is no contact any more.
  const res = fakeRes();
  hub.handlePeer({}, res, readBody({ publicKey: 'K-CRUELLA' }), 'forget');
  await res.wait();
  const left = contactBook.byPublicKey(home, 'K-CRUELLA');
  if (res.status === 200 && left && !left.keep && !contactBook.listens(left)) {
    test.check('a member is forgotten like anybody — no seat is asked about, and the row is no contact any more');
  } else {
    test.fail('forget answered ' + res.status + ': ' + res.text);
  }

  // Tolerant: node.db may still be open (0021 marks the memory on every
  // book write), and testSupport reclaims whatever is left at exit.
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* reclaimed at exit */ }
}

// ── 3. NO BOOK FILE TO CARRY OLD FIELDS ──────────────────────────────
//
// memberOf and missingSince fell away on a row's next write to contacts.json. That file is gone (goal/G40.11): the
// book is rows of node.db's one table, which has no column for either.

function staleFieldsFallAway() {
  test.subHeading('The book writes no contacts.json, and the table has no seat fields');

  const home = tmpHome();
  contactBook.acquire(home, { publicKey: 'K-JAZZ', publicLabel: 'jazz', relay: MINE });
  contactBook.setMyLabel(home, 'K-JAZZ', 'Jazzmin');
  const row = contactBook.byPublicKey(home, 'K-JAZZ');
  if (!fs.existsSync(path.join(home, 'relay-state', 'contacts.json')) && row && row.myLabel === 'Jazzmin' &&
      !('memberOf' in row) && !('missingSince' in row)) {
    test.check('writes through the book land in the table, with no memberOf or missingSince to carry');
  } else {
    test.fail('the book: ' + JSON.stringify({ file: fs.existsSync(path.join(home, 'relay-state', 'contacts.json')), row: row }));
  }

  // Tolerant: node.db may still be open, and testSupport reclaims whatever is left at exit.
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
