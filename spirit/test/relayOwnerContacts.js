'use strict';

// spirit/test/relayOwnerContacts.js
// A relay owner's members are contacts, and cannot be dropped by halves.
//
//   Andy: "when someone binds to a peer i own, it's because i want them in
//   my network, so i want a contact auto-generated, and undeletable until
//   i agree to also remove their relay slots."
//
//   "then i have to rummage two different peer lists for everything i want
//   to do, including messaging all my relay clients about a short
//   outage/restart at 02h UTC... and simply because as user it becomes
//   very confusing to understand my relationship with this peer (ID)."
//
// Two lists were one subject. A relay owner's census and their address
// book overlap completely at the owner's end and were kept apart anyway —
// so on Andy's own relay, Cruella and Jazzmin Thut held seats and were
// not people he could write to without going to a second screen.
//
// ── THE BOUNDARY IS ONE FIELD ────────────────────────────────────────
//
// `memberOf` is the list of relays THIS NODE OWNS where that key holds a
// seat (Andy: "i may acquire the same contact through multiple relays i
// own"). Non-empty means auto-created and sticky; empty means an ordinary
// contact.
//
// Which carries the third rule for free —
//
//   Andy: "a peer who connects with me through a partner node behaves
//   independently as contact, same as non-relay-owners experience all
//   their contacts."
//
// — because a partner's member is not a member of anything this node
// owns, so the list is empty and nothing here applies. A node that owns
// no relay never has a non-empty one.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const whoBook = require('../run/js/whoBook');

const MINE = 'https://mine.example';
const ALSO_MINE = 'https://also-mine.example';
const THEIRS = 'https://theirs.example';

function tmpHome(name) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-owner-'));
  auth.saveIdentity(home, auth.generateIdentity(name || 'owner'));
  return home;
}

function hubFor(home) {
  return require('../run/js/hub').createHub(home);
}

// What ownerBadge.probe answers, in the shape reconcileMembers reads: one
// row per configured relay, `owned` where this key holds the box, and the
// census roster alongside it. The real probe already carries all of this
// — see ownerBadge.censusFacts, which parses the roster to decide the
// badge and used to throw it away.
function roster(keys) {
  return keys.map(function (k) {
    return { publicKey: k, publicLabel: String(k).toLowerCase(), claimedAt: '2026-03-02T00:00:00.000Z' };
  });
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

test.startTest('A relay owner’s members are contacts');

// ── 1. THE SWEEP ─────────────────────────────────────────────────────

function theSweepAdopts() {
  test.subHeading('Everybody with a seat on a relay I own becomes a contact');

  const home = tmpHome();
  const me = auth.loadIdentity(home).publicKey;
  const hub = hubFor(home);

  const summary = {
    rows: [
      { url: MINE, owned: true, claimed: true, status: 200,
        census: { roster: roster([me, 'K-CRUELLA', 'K-JAZZ']) } },
      // Somebody else's box. Its members are not this node's to adopt.
      { url: THEIRS, owned: false, claimed: true, status: 200,
        census: { roster: roster(['K-STRANGER']) } },
    ],
  };

  const first = hub.reconcileMembers(summary);
  if (first.adopted === 2) {
    test.check('two members, two contacts, with nobody having pressed Add');
  } else {
    test.fail('adopted: ' + JSON.stringify(first));
  }

  const cruella = whoBook.byPublicKey(home, 'K-CRUELLA');
  if (whoBook.isMember(cruella) && whoBook.memberOf(cruella)[0] === MINE) {
    test.check('and each row names the relay of mine the seat is on');
  } else {
    test.fail('cruella: ' + JSON.stringify(cruella));
  }

  // THE RANK IS NOT DECORATION. ACQUIRED_LISTENING decides whether this
  // node accepts somebody's mail at all, and a member added as `census`
  // would be a contact it refuses to hear from — the opposite of the
  // point, since the owner let them onto the box.
  if (whoBook.acquiredVia(cruella) === whoBook.MEMBER && whoBook.listens(cruella)) {
    test.check('and this node will hear from them, which is what the rank is for');
  } else {
    test.fail('rank: ' + whoBook.acquiredVia(cruella) + ' listens: ' + whoBook.listens(cruella));
  }

  // ── AND NOBODY ELSE ────────────────────────────────────────────────
  if (!whoBook.byPublicKey(home, 'K-STRANGER')) {
    test.check('a member of somebody else’s relay is not adopted');
  } else {
    test.fail('adopted a stranger from a relay this node does not own');
  }

  if (!whoBook.byPublicKey(home, me)) {
    test.check('and this node does not become its own contact');
  } else {
    test.fail('the owner is in its own book');
  }

  // ── TWO OF MY RELAYS, ONE PERSON ───────────────────────────────────
  //
  //   Andy: "i may acquire the same contact through multiple relays i
  //   own. the contact record must hold a LIST."
  summary.rows.push({
    url: ALSO_MINE, owned: true, claimed: true, status: 200,
    census: { roster: roster([me, 'K-CRUELLA']) },
  });
  hub.reconcileMembers(summary);
  const both = whoBook.memberOf(whoBook.byPublicKey(home, 'K-CRUELLA'));
  if (both.length === 2 && both.indexOf(MINE) !== -1 && both.indexOf(ALSO_MINE) !== -1) {
    test.check('somebody seated on two of my relays lists both');
  } else {
    test.fail('memberOf: ' + JSON.stringify(both));
  }

  fs.rmSync(home, { recursive: true, force: true });
}

// ── 2. AND IT PRUNES, WHICH IS WHAT MAKES THE LOCK RELEASE ───────────

function theSweepPrunes() {
  test.subHeading('And a seat that is given up releases the row');

  const home = tmpHome();
  const me = auth.loadIdentity(home).publicKey;
  const hub = hubFor(home);

  const withJazz = {
    rows: [{ url: MINE, owned: true, claimed: true, status: 200,
      census: { roster: roster([me, 'K-CRUELLA', 'K-JAZZ']) } }],
  };
  hub.reconcileMembers(withJazz);

  const withoutJazz = {
    rows: [{ url: MINE, owned: true, claimed: true, status: 200,
      census: { roster: roster([me, 'K-CRUELLA']) } }],
  };
  const pruned = hub.reconcileMembers(withoutJazz);

  const jazz = whoBook.byPublicKey(home, 'K-JAZZ');
  if (pruned.pruned === 1 && jazz && !whoBook.isMember(jazz)) {
    test.check('somebody evicted is no longer a member');
  } else {
    test.fail('after prune: ' + JSON.stringify(pruned) + ' ' + JSON.stringify(jazz));
  }

  // THE ROW SURVIVES, and so does the rank. Ranks never fall, and this is
  // the right answer: you did let them onto your relay once, so their
  // mail is still welcome. What changed is that the row is now yours to
  // delete.
  if (jazz && whoBook.listens(jazz)) {
    test.check('but they are still somebody this node hears — ranks never fall');
  } else {
    test.fail('the rank fell: ' + JSON.stringify(jazz));
  }

  // ── A SILENT RELAY CONCLUDES NOTHING ───────────────────────────────
  //
  // The rule natterCheckBinding already follows, and the one that makes
  // this safe to run on every probe: an owned relay that did not answer
  // carries no roster, and treating that as "nobody is enrolled" would
  // empty every memberOf on this node and make a whole address book
  // deletable because a box was rebooting.
  hub.reconcileMembers({ rows: [{ url: MINE, owned: false, status: 0 }] });
  if (whoBook.isMember(whoBook.byPublicKey(home, 'K-CRUELLA'))) {
    test.check('and a relay that did not answer takes nobody’s seat away');
  } else {
    test.fail('an unreachable relay emptied the book');
  }

  fs.rmSync(home, { recursive: true, force: true });
}

// ── 3. FORGET, AND WHAT IT REFUSES ───────────────────────────────────

async function forgetRefusesAMember() {
  test.subHeading('Forget refuses while they hold a seat, and says which');

  const home = tmpHome();
  const me = auth.loadIdentity(home).publicKey;
  const hub = hubFor(home);

  hub.reconcileMembers({
    rows: [{ url: MINE, owned: true, claimed: true, status: 200,
      census: { roster: roster([me, 'K-CRUELLA']) } }],
  });
  // An ordinary contact beside them, acquired the way anybody is.
  whoBook.acquire(home, { publicKey: 'K-SONNY', publicLabel: 'sonny', relay: THEIRS }, 'handle');

  const refused = fakeRes();
  hub.handlePeer({}, refused, readBody({ publicKey: 'K-CRUELLA' }), 'forget');
  await refused.wait();

  if (refused.status === 409) {
    test.check('a member cannot simply be forgotten');
  } else {
    test.fail('forget answered ' + refused.status + ': ' + refused.text);
  }

  // NAMED, because the caller cannot offer "remove their seat as well"
  // without knowing which seats. A refusal that only says no leaves the
  // person stuck with a row they cannot act on.
  const said = refused.body() || {};
  if ((said.memberOf || [])[0] === MINE) {
    test.check('and the refusal names the relay, so the offer can be made');
  } else {
    test.fail('refusal: ' + refused.text);
  }

  if (whoBook.byPublicKey(home, 'K-CRUELLA')) {
    test.check('and nothing was deleted');
  } else {
    test.fail('the row went anyway');
  }

  // ── AN ORDINARY CONTACT IS UNAFFECTED ──────────────────────────────
  //
  //   Andy: "a peer who connects with me through a partner node behaves
  //   independently as contact, same as non-relay-owners experience all
  //   their contacts."
  const ok = fakeRes();
  hub.handlePeer({}, ok, readBody({ publicKey: 'K-SONNY' }), 'forget');
  await ok.wait();

  if (ok.status === 200 && !whoBook.byPublicKey(home, 'K-SONNY')) {
    test.check('while somebody who holds no seat of mine is forgotten as ever');
  } else {
    test.fail('ordinary forget: ' + ok.status + ' ' + ok.text);
  }

  // ── AND THE LOCK RELEASES WITH THE SEAT ────────────────────────────
  //
  // No special case: the sweep prunes the url and the ordinary refusal
  // stops matching. That is why the guard reads a list rather than a flag.
  hub.reconcileMembers({
    rows: [{ url: MINE, owned: true, claimed: true, status: 200,
      census: { roster: roster([me]) } }],
  });
  const after = fakeRes();
  hub.handlePeer({}, after, readBody({ publicKey: 'K-CRUELLA' }), 'forget');
  await after.wait();

  if (after.status === 200 && !whoBook.byPublicKey(home, 'K-CRUELLA')) {
    test.check('and once the seat is gone, so is the refusal');
  } else {
    test.fail('after eviction: ' + after.status + ' ' + after.text);
  }

  fs.rmSync(home, { recursive: true, force: true });
}

// ── 4. A NODE THAT OWNS NOTHING ──────────────────────────────────────

function ownersOnly() {
  test.subHeading('And none of this exists for somebody who owns no relay');

  const home = tmpHome();
  const hub = hubFor(home);

  // Bound to two relays, owner of neither — which is every ordinary node.
  const said = hub.reconcileMembers({
    rows: [
      { url: THEIRS, owned: false, claimed: true, status: 200,
        census: { roster: roster(['K-A', 'K-B']) } },
      { url: MINE, owned: false, claimed: true, status: 200,
        census: { roster: roster(['K-C']) } },
    ],
  });

  if (said.adopted === 0 && whoBook.load(home).length === 0) {
    test.check('nobody is adopted, and the book is untouched');
  } else {
    test.fail('a non-owner adopted somebody: ' + JSON.stringify(said));
  }

  fs.rmSync(home, { recursive: true, force: true });
}

// ── 5. AND WHO IS ON NO CENSUS AT ALL ────────────────────────────────
//
//   Andy: "show a warning bubble at the top of contact details if the
//   contact is an obvious dud... the bubble will show the reason."
//
// The same probe answers both questions, so this rides the same sweep.
// Andy's book has three today: bella and carlos, whose only relay was a
// loopback lab box that no longer exists, and rock, whose seat he removed
// by hand.
function theSweepMarksOrphans() {
  test.subHeading('A key on no census is marked, and the mark keeps its date');

  const home = tmpHome();
  const hub = hubFor(home);

  whoBook.acquire(home, { publicKey: 'K-LIVE', publicLabel: 'jim', relay: THEIRS }, 'handle');
  whoBook.acquire(home, { publicKey: 'K-DUD', publicLabel: 'bella', relay: 'http://127.0.0.1:65425' }, 'handle');

  // A relay this node is on but does NOT own — orphan-hunting is about
  // every relay you are bound to, not only the ones you keep.
  const up = { rows: [{ url: THEIRS, owned: false, claimed: true, status: 200,
    census: { roster: roster(['K-LIVE']) } }] };

  const first = hub.reconcileOrphans(up, new Date('2026-09-17T01:00:00.000Z'));
  if (first.marked === 1 && whoBook.missingSince(whoBook.byPublicKey(home, 'K-DUD'))) {
    test.check('somebody no relay lists is marked');
  } else {
    test.fail('mark: ' + JSON.stringify(first));
  }

  if (!whoBook.missingSince(whoBook.byPublicKey(home, 'K-LIVE'))) {
    test.check('and somebody a relay does list is not');
  } else {
    test.fail('marked a live contact');
  }

  // THE DATE IS THE USEFUL PART, so it must not move. A stamp rewritten
  // on every probe would make a contact missing since March look like it
  // vanished a minute ago — which is the one thing the date is for.
  hub.reconcileOrphans(up, new Date('2026-09-30T01:00:00.000Z'));
  if (whoBook.missingSince(whoBook.byPublicKey(home, 'K-DUD')).indexOf('2026-09-17') === 0) {
    test.check('and a second sweep leaves the original date alone');
  } else {
    test.fail('the date moved: ' + whoBook.missingSince(whoBook.byPublicKey(home, 'K-DUD')));
  }

  // ── A RELAY THAT DID NOT ANSWER SAYS NOTHING ABOUT ANYBODY ─────────
  //
  // natterCheckBinding's rule, and the reason this is safe to run on
  // every probe: without it a node whose relay was rebooting would paint
  // a warning onto every row in its book.
  const home2 = tmpHome();
  const hub2 = hubFor(home2);
  whoBook.acquire(home2, { publicKey: 'K-X', publicLabel: 'x', relay: THEIRS }, 'handle');
  const silent = hub2.reconcileOrphans({ rows: [{ url: THEIRS, claimed: true, status: 0 }] });
  if (silent.marked === 0 && !whoBook.missingSince(whoBook.byPublicKey(home2, 'K-X'))) {
    test.check('a relay that did not answer marks nobody');
  } else {
    test.fail('an unreachable relay condemned the book: ' + JSON.stringify(silent));
  }

  // AND NEITHER DOES ONE THAT ANSWERED WITHOUT A ROSTER. An older relay
  // replies to the census without one, and reading that as "lists
  // nobody" would mark every contact on it.
  const old = hub2.reconcileOrphans({
    rows: [{ url: THEIRS, claimed: true, status: 200, census: { peers: 3 } }],
  });
  if (old.marked === 0 && !whoBook.missingSince(whoBook.byPublicKey(home2, 'K-X'))) {
    test.check('nor one running older code that answered without a roster');
  } else {
    test.fail('a rosterless answer condemned the book: ' + JSON.stringify(old));
  }

  // ── AND A KEY THAT COMES BACK LOSES THE MARK ──────────────────────
  const back = { rows: [{ url: THEIRS, owned: false, claimed: true, status: 200,
    census: { roster: roster(['K-LIVE', 'K-DUD']) } }] };
  const cleared = hub.reconcileOrphans(back);
  if (cleared.cleared === 1 && !whoBook.missingSince(whoBook.byPublicKey(home, 'K-DUD'))) {
    test.check('and somebody who turns up again stops being warned about');
  } else {
    test.fail('the mark stuck: ' + JSON.stringify(cleared));
  }

  // NOTHING WAS DELETED, at any point. Absence is not death, and the row
  // holds a name its owner typed which is on no relay to be recovered
  // from — so the sweep marks and the human decides.
  if (whoBook.byPublicKey(home, 'K-DUD')) {
    test.check('and nothing was ever deleted — the sweep marks, a person decides');
  } else {
    test.fail('the sweep deleted a row');
  }

  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(home2, { recursive: true, force: true });
}

theSweepAdopts();
theSweepPrunes();
forgetRefusesAMember()
  .then(function () { ownersOnly(); theSweepMarksOrphans(); })
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () { test.reportSuccessFailureCount(); });
