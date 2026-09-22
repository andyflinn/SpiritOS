'use strict';

// spirit/test/discFull.js
// A DISC THAT WILL NOT TAKE A WRITE — cycle 9, after the cycle record.
//
//   Andy, 2026-09-22: "does the harness test disc overflow?"
//
// It tested a relay over its CONFIGURED figure (discBound.js) and not a
// disc that has actually run out, which is a different failure with a
// worse ending. Measured the same hour: `node:sqlite` throws "attempt to
// write a readonly database" straight out of `mint`, and relayServer's
// claim route calls into the relay inside a `.then()` — so the throw was
// an unhandled rejection, and on this Node that ends the PROCESS.
//
// A full disc therefore did not refuse a member. It killed the relay, and
// every connected member with it.
//
// WHAT IS ASSERTED HERE: the writes refuse, with a sentence naming the
// disc; nothing throws; and the things that do NOT touch the store —
// forwarding a post, holding a stream — keep working, because a relay
// that cannot take new members is still worth having up.
//
// HOW THE DISC IS "FULLED": the database file is made read-only, which is
// what SQLite reports for both a full disc and a read-only mount, and is
// the only one of the three a suite can arrange without a filesystem of
// its own. Skipped where the platform will not enforce the mode.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const relayStore = require('../run/js/relayStore');
const { createRelay } = require('../run/js/relay');
const { claimOwner } = require('./ownerClaim');

test.startTest('A relay whose disc will not take a write refuses, and keeps serving');

function build() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-discfull-'));
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const box = createRelay(home, { config: { ramLimitMB: 64, discLimitMB: 64, source: 'test' } });
  const owner = auth.generateIdentity('owner');
  claimOwner(box, owner, 'owner', 'df-owner');
  return { home: home, box: box, owner: owner };
}

// A member who joined while the disc still worked, so the "keeps serving"
// half is about somebody real.
function member(R, name) {
  const id = auth.generateIdentity(name);
  const minted = R.box.mint('owner', name, 7, '');
  R.box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)), id.publicKey, 'df-' + name, minted.invite.token, name);
  return id;
}

function sealDisc(R) {
  relayStore.closeAll();
  const db = path.join(R.home, 'relay-state', 'relay.db');
  fs.chmodSync(db, 0o444);
  // Proof the mode took: on a filesystem that ignores it, this suite has
  // nothing to say and says so rather than passing vacuously.
  try {
    fs.appendFileSync(db, '');
    return false;
  } catch (e) {
    return true;
  }
}

function run() {
  // ── THE CASE chmod CANNOT STAGE, AND THE ONE THAT MATTERS ────────
  //
  // wsl-claude, 2026-09-22, having filled a real 1 MB tmpfs in an
  // unprivileged user namespace: a genuinely full disc says **"database
  // or disk is full"**, errcode 13 (SQLITE_FULL) — and the first guard,
  // which matched on the message, missed it. `SQLITE_FULL` and `ENOSPC`
  // are the NAME of the code, never the text. So the relay still died on
  // exactly the case Andy asked about.
  //
  // A read-only file (below) only ever produces errcode 8, so that half
  // of this suite proves the half that already worked. This section is
  // the other half, driven by the codes themselves — which is also what
  // the guard now reads, so a Node or SQLite upgrade that rewords a
  // message cannot quietly reopen the hole.
  test.subHeading('The failures a full disc really produces are recognised by their CODE');
  [
    [13, 'database or disk is full', 'SQLITE_FULL — a genuinely full filesystem'],
    [8, 'attempt to write a readonly database', 'SQLITE_READONLY — the file'],
    [1544, 'attempt to write a readonly database', 'READONLY_DIRECTORY — no room for the journal'],
    [10, 'disk I/O error', 'SQLITE_IOERR — the write failed underneath'],
    [3850, 'disk I/O error', 'an extended IOERR, read as its low byte'],
    [14, 'unable to open database file', 'SQLITE_CANTOPEN — no handle at all'],
  ].forEach(function (c) {
    const e = new Error(c[1]);
    e.errcode = c[0];
    if (relayStore.isDiscFailure(e)) {
      test.check(c[2]);
    } else {
      test.fail('errcode ' + c[0] + ' (' + c[1] + ') was not read as a disc failure');
    }
  });

  test.subHeading('…and a bug is still a bug');
  const bug = new TypeError('cannot read properties of undefined');
  const sqlBug = new Error('no such column: publicKeyy');
  sqlBug.errcode = 1;
  if (!relayStore.isDiscFailure(bug) && !relayStore.isDiscFailure(sqlBug)) {
    test.check('a type error and a bad query are re-thrown — a bug that becomes a polite refusal is never found');
  } else {
    test.fail('a bug was swallowed as a disc failure');
  }

  const R = build();
  const bob = member(R, 'bob');

  if (!sealDisc(R)) {
    test.check('SKIPPED: this filesystem does not enforce a read-only file, so a full disc cannot be staged');
    test.reportSuccessFailureCount();
    return;
  }

  test.subHeading('Minting an invite refuses instead of throwing');
  let threw = null;
  let minted = null;
  try { minted = R.box.mint('owner', 'carol', 7, ''); }
  catch (e) { threw = e; }
  if (!threw && minted && minted.ok === false && minted.status === 507 &&
      /cannot write its own state/.test(minted.error) && /disc/.test(minted.error)) {
    test.check('507 with a sentence naming the disc — not an exception through the route that asked');
  } else {
    test.fail(threw ? ('mint threw: ' + threw.message) : ('mint answered: ' + JSON.stringify(minted)));
  }

  test.subHeading('A claim refuses the same way');
  const dave = auth.generateIdentity('dave');
  let claimThrew = null;
  let claimed = null;
  try {
    claimed = R.box.claim('dave', auth.sign(dave.privateKey, auth.claimMessage('dave')),
      dave.publicKey, 'df-dave', 'sometoken', 'dave');
  } catch (e) { claimThrew = e; }
  if (!claimThrew && claimed && claimed.ok === false) {
    test.check('a claim on a relay that cannot write is refused, not thrown');
  } else {
    test.fail(claimThrew ? ('claim threw: ' + claimThrew.message) : ('claim answered: ' + JSON.stringify(claimed)));
  }

  test.subHeading('An owner verb answers rather than ending the relay');
  const relayKey = R.box.relayPublicKey();
  const packet = JSON.stringify({ app: 'relay', v: 1, body: { invite: { label: 'erin', days: 7 } } });
  let verbThrew = null;
  let verbOut = null;
  try {
    verbOut = R.box.routePost(R.owner.publicKey, relayKey, packet,
      auth.sign(R.owner.privateKey, auth.postMessage(R.owner.publicKey, relayKey, packet)));
  } catch (e) { verbThrew = e; }
  if (!verbThrew && verbOut) {
    test.check('the owner\'s verb comes back as an answer — the process is still here to give one');
  } else {
    test.fail(verbThrew ? ('the owner verb threw: ' + verbThrew.message) : 'the owner verb answered nothing');
  }

  test.subHeading('…and what does not touch the store carries on');
  // Reading the roll is a query, not a write, so a member who is already
  // here is still known — which is what makes "keeps forwarding" true.
  // Asked of the store directly: SQLite opens a read-only file happily
  // and serves every SELECT from it; it is the first write that fails.
  let known = null;
  try { known = relayStore.open(R.home).members.get(bob.publicKey); } catch (e) { known = null; }
  if (known && known.publicKey === bob.publicKey) {
    test.check('a member who joined before the disc filled is still on the roll, and still routable');
  } else {
    test.fail('a read failed on a relay that only cannot WRITE: ' + JSON.stringify(known));
  }

  let held = null;
  try {
    held = R.box.streamOpen(bob.publicKey, auth.sign(bob.privateKey, auth.streamMessage(bob.publicKey)),
      { write: function () {}, close: function () {} });
  } catch (e) { held = null; }
  if (held) {
    test.check('and a member can still open a stream — a relay that cannot take newcomers is still worth having up');
  } else {
    test.fail('a stream could not be opened on a relay that only cannot write');
  }

  // Put the mode back so the temp home can be swept with the others.
  try { fs.chmodSync(path.join(R.home, 'relay-state', 'relay.db'), 0o644); } catch (e) { /* best effort */ }
  relayStore.closeAll();

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
