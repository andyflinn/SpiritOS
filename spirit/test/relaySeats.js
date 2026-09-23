'use strict';

// spirit/test/relaySeats.js
// A MEMBER IS ADMITTED ONLY IF THIS RELAY CAN SERVE THEM.
//
//   Andy, 2026-09-23: "why admit a member when we cannot guarantee service
//   for that member? that'd be horrible" — and, ruling what bounds it: "a
//   relay could hold a few million CARDs on disk, members are strictly
//   limited by RAM allotment."
//
// ── WHAT WAS MISSING, AND WHAT WAS NOT ───────────────────────────────
//
// The disc bound (cycle 9) was correct and is untouched: it says how many
// rows may EXIST. What did not exist was a bound on how many people may be
// SERVED. So a relay configured at 256 MB admitted members up to its
// ~111,000-row disc ceiling while only 4,096 could ever hold a stream.
// Member 4,097 got a row, got a card, and then a 503 for ever.
//
// AND MINT HAD NO CAPACITY CHECK OF ANY KIND — an owner could hand out a
// thousand tokens against three free seats, every one of them reading as
// valid until the moment somebody tried to use it.
//
// ── WHY THE INVITE HALF IS NOT AN EXTRA ──────────────────────────────
//
// A relay does not queue. A member who cannot connect does not collect
// messages to read later; they receive nothing. So over-admission is not
// a delay, it is an exclusion dressed as a membership — and an invite
// minted past capacity is that same exclusion promised in writing, days
// before anybody finds out.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const relayStore = require('../run/js/relayStore');
const { createRelay } = require('../run/js/relay');

test.startTest('A relay admits only the members it can serve');

const homes = [];

// A relay with a REAL configuration, because the seat bound comes from
// `ramLimitMB` and a relay built without one has no allowance at all —
// which is every other in-process suite, and is why they are unaffected.
function relayWith(ramLimitMB) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-seats-'));
  homes.push(home);
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('andy');
  auth.writeAllowKeys(home, [{ name: 'andy', publicKey: owner.publicKey }]);

  const box = createRelay(home, {
    config: { ramLimitMB: ramLimitMB, discLimitMB: 64 },
  });
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey);
  return { home: home, box: box, owner: owner };
}

// ── WHY A QUARTER OF A MEGABYTE ──────────────────────────────────────
//
// STREAMS_PER_MB is 16, so 1 MB buys 16 seats — and filling those by hand
// runs straight into `CLAIM_PER_MIN = 10`, the claim rate governor, which
// refuses the eleventh claim with 429 before the seat bound is ever
// reached. A first draft did exactly that and reported a seat failure
// that was really a rate failure.
//
// So the fixture buys FOUR seats instead. The figure is derived rather
// than typed, so this suite still asserts the real rule if STREAMS_PER_MB
// ever changes.
//
// THE GOVERNOR IS NOT A NUISANCE HERE, it is a second and independent
// protection: even without a seat bound a relay could not be filled
// faster than ten members a minute. It is why over-admission was a slow
// leak rather than an outage, and it is why nobody noticed.
const RAM_MB = 0.25;
const SEATS = Math.max(1, Math.floor(RAM_MB * 16));

test.subHeading('The boundary: the seat after the last one is refused');

{
  const w = relayWith(RAM_MB);

  // The owner already holds a seat, so the roll fills at SEATS.
  let admitted = 1;
  let refusal = null;
  for (let i = 0; i < SEATS + 4; i += 1) {
    const id = auth.generateIdentity('m' + i);
    const minted = w.box.mint('andy', 'm' + i, 7, '');
    if (!minted.ok) { refusal = { where: 'mint', said: minted }; break; }
    const got = w.box.claim('m' + i, auth.sign(id.privateKey, auth.claimMessage('m' + i)),
      id.publicKey, null, minted.invite.token, 'm' + i);
    if (!got.ok) { refusal = { where: 'claim', said: got }; break; }
    admitted += 1;
  }

  if (refusal && admitted === SEATS) {
    test.check('the relay stops admitting at exactly the seats its RAM allotment buys (' +
      SEATS + ')');
  } else {
    test.fail('expected a refusal at ' + SEATS + ' members, admitted ' + admitted +
      ', refusal ' + JSON.stringify(refusal));
  }

  // THE SENTENCE NAMES THE LEVER. An owner told "full" without being told
  // which figure to raise has been informed and not helped.
  if (refusal && /ramLimitMB/.test(String(refusal.said.error || ''))) {
    test.check('and the refusal names ramLimitMB — the figure the owner would actually change');
  } else {
    test.fail('the refusal does not name the lever: ' + JSON.stringify(refusal));
  }

  // NOBODY IS EVICTED. design/principles/LIMITED-RESOURCES.md, Andy: "it's
  // like member slots, you must evict before adding new ones."
  if (relayStore.open(w.home).members.count() === SEATS) {
    test.check('and the roll is untouched by the refusal — full never means a row is dropped');
  } else {
    test.fail('the roll changed when a claim was refused');
  }
}

test.subHeading('An outstanding invite holds a seat, so minting cannot oversell');

{
  const w = relayWith(RAM_MB);

  // Fill every remaining seat with UNCLAIMED invites. Nobody has joined;
  // the roll still reads 1. A relay counting only members would call this
  // empty and keep minting.
  let minted = 0;
  let said = null;
  for (let i = 0; i < SEATS + 4; i += 1) {
    const out = w.box.mint('andy', 'inv' + i, 7, '');
    if (!out.ok) { said = out; break; }
    minted += 1;
  }

  const roll = relayStore.open(w.home).members.count();
  if (said && minted === SEATS - 1 && roll === 1) {
    test.check('minting stops when members plus live invites reach the allowance — ' +
      'with a roll of 1 and ' + minted + ' promises outstanding');
  } else {
    test.fail('minted ' + minted + ' against ' + (SEATS - 1) + ' expected, roll ' +
      roll + ', said ' + JSON.stringify(said));
  }

  if (said && /outstanding/.test(String(said.error || '')) &&
      /promise a seat that does not exist/.test(String(said.error || ''))) {
    test.check('and the refusal says WHY — a token nobody can redeem is a broken promise in writing');
  } else {
    test.fail('mint refusal is not explicit: ' + JSON.stringify(said));
  }
}

test.subHeading('An expired invite gives its seat back');

{
  const w = relayWith(RAM_MB);
  for (let i = 0; i < SEATS - 1; i += 1) w.box.mint('andy', 'e' + i, 7, '');

  const blocked = w.box.mint('andy', 'one-too-many', 7, '');

  // Age every invite past its expiry without touching the relay — which
  // is what the clock does. IN THE STORE, not in a file: invites moved
  // into relay.db in cycle 3, and a first draft of this suite rewrote
  // `relay-state/invites.json`, a path nothing has read since. The relay
  // went on reporting fifteen live invites and the assertion caught it.
  const before = invites.load(w.home).length;
  relayStore.closeAll();
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(w.home, 'relay-state', 'relay.db'));
  db.prepare('UPDATE invites SET expiresAt = ?')
    .run(new Date(Date.now() - 60000).toISOString());
  db.close();
  if (before !== SEATS - 1) test.fail('expected ' + (SEATS - 1) + ' invites to age, saw ' + before);

  const after = w.box.mint('andy', 'after-expiry', 7, '');

  if (!blocked.ok && after.ok) {
    test.check('a seat held by an invite returns when the invite expires — ' +
      'unclaimed invites are not a permanent tax on capacity');
  } else {
    test.fail('before ' + JSON.stringify(blocked.ok) + ', after expiry ' + JSON.stringify(after));
  }
}

test.subHeading('THE MONITORING HALF: an owner sees it coming');

{
  // Andy: "our alpha shape needs to monitor member count so, that RAM
  // capacity can guarantee service." A refusal at the boundary is the
  // guarantee; this is what stops it arriving as a surprise.
  const w = relayWith(RAM_MB);
  w.box.mint('andy', 'pending', 7, '');

  const report = w.box.snapshot();
  const s = report && report.seats;

  if (s && s.allowance === SEATS && s.held === 1 && s.outstanding === 1 &&
      s.free === SEATS - 2) {
    test.check('the report carries held, outstanding, allowance and free — all four, ' +
      'because two of them cannot be derived from the others');
  } else {
    test.fail('seats missing or wrong in the report: ' + JSON.stringify(s));
  }
}

test.subHeading('A relay with no configuration has no seat bound');

{
  // Every other in-process suite builds a relay this way. A gate that
  // refused here would refuse the whole harness rather than the thing it
  // is aimed at.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-seats-none-'));
  homes.push(home);
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('andy');
  auth.writeAllowKeys(home, [{ name: 'andy', publicKey: owner.publicKey }]);
  const box = createRelay(home);
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey);

  let ok = true;
  for (let i = 0; i < SEATS + 8; i += 1) {
    if (!box.mint('andy', 'u' + i, 7, '').ok) { ok = false; break; }
  }
  const report = box.snapshot();

  if (ok && report && report.seats === undefined) {
    test.check('unconfigured: minting is unbounded and the report is SILENT rather than zeroed');
  } else {
    test.fail('an unconfigured relay grew a seat bound: ' + JSON.stringify(report && report.seats));
  }
}

try { relayStore.closeAll(); } catch (e) { /* leave it */ }
homes.forEach(function (h) {
  try { fs.rmSync(h, { recursive: true, force: true }); } catch (e) { /* sweeper */ }
});

test.reportSuccessFailureCount();
