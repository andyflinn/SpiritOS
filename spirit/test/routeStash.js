'use strict';

// spirit/test/routeStash.js
// A ROUTE IS THE MACHINE'S. IT DOES NOT GO IN THE ADDRESS BOOK.
//
//   Andy: "I think that streamed routes should be exempt from the log,
//   they just miraculously get stashed on the correct contact-row."
//   Andy, later: "the hints are removed from the users contacts. (let's
//   admit it: they [are] not human-readable, in reality)"
//
// ── WHAT THIS SUITE USED TO BE, AND WHY IT CHANGED ───────────────────
//
// It was called "a relay may improve a contact row, it may never create
// one", and it tested `contactBook.learnRoute`: a relay announced a route
// it had proven, and every member holding a row for that key wrote it
// down. A route for a stranger was DROPPED, because a relay that could
// create rows could put people in somebody's address book.
//
// Two decisions took that apart, and both are Andy's:
//
//   R25  the node must learn a route at EVERY opportunity — so a
//        stranger's route is kept, in a place that is not the book
//   0018 the route cache belongs to the machine, not the human — so
//        routes leave the contact row entirely
//
// **The old safety is now structural rather than enforced.** A relay
// cannot write into the book because there is nowhere in the book for a
// route to go; `learnRoute` is deleted. That is the same shift 0012 gave
// the one-hop rule — a rule that cannot be broken needs nobody to police
// it — and it is what this file asserts now.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const contactBook = require('../run/js/contacts');
const hub = require('../run/js/hub');
const seenPeers = require('../run/js/seenPeers');

function freshRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-routestash-'));
}

const KNOWN = 'MCowBQYDK2VwAyEA' + 'k'.repeat(27) + '=';
const STRANGER = 'MCowBQYDK2VwAyEA' + 's'.repeat(27) + '=';
// A RELAY KEY, not a URL (cycle 2): the relay announces `at` as the far
// relay's key, and a route is made of keys.
const AT = 'MCowBQYDK2VwAyEA' + 'r'.repeat(27) + '=';
const AT2 = 'MCowBQYDK2VwAyEA' + 'q'.repeat(27) + '=';
const MINE = 'MCowBQYDK2VwAyEA' + 'm'.repeat(27) + '=';

test.startTest('A route is the machine\'s, and the book never holds one');

test.subHeading('The book has nowhere to put a route, which is the safety');

{
  const root = freshRoot();
  contactBook.acquire(root, { publicKey: KNOWN, publicLabel: 'kim' }, 'handle');

  // `learnRoute` IS GONE. Asserted rather than assumed, because the whole
  // claim of this file is that the hazard was REMOVED rather than
  // guarded: a relay cannot write a route into the book if the verb does
  // not exist and the field is not written.
  if (typeof contactBook.learnRoute === 'undefined') {
    test.check('there is no verb that writes a route onto a contact row');
  } else {
    test.fail('learnRoute still exists');
  }

  const row = contactBook.byPublicKey(root, KNOWN);
  if (row && !('routes' in row)) {
    test.check('and a row written today carries no routes field at all');
  } else {
    test.fail('a fresh row still has routes: ' + JSON.stringify(row));
  }
}

test.subHeading('A route goes to the shadow — for a contact and a stranger alike');

{
  const root = freshRoot();
  const shadow = hub.shadow(root);
  contactBook.acquire(root, { publicKey: KNOWN, publicLabel: 'kim' }, 'handle');

  shadow.note(KNOWN, { at: AT, via: MINE, rank: seenPeers.PROVED });
  const kept = shadow.get(KNOWN);
  if (kept && kept.at === AT && kept.via === MINE) {
    test.check('a proven route for a contact is kept, with the door that proved it');
  } else {
    test.fail('contact route: ' + JSON.stringify(kept));
  }

  // THE REVERSAL, AND IT IS THE POINT OF R25. This used to be dropped:
  // "a route for a key nobody here knows costs one lookup and is thrown
  // away". Andy: "the node must implicitly learn routes at EVERY
  // opportunity" — so it is kept, and kept OUTSIDE the book.
  shadow.note(STRANGER, { at: AT2, via: MINE, rank: seenPeers.PROVED });
  if (shadow.get(STRANGER) && shadow.get(STRANGER).at === AT2) {
    test.check('and a route about a STRANGER is kept now, where it used to be dropped');
  } else {
    test.fail('a stranger route was lost');
  }

  // AND THE BOOK IS UNTOUCHED BY EITHER. The old rule's purpose survives
  // its mechanism: a relay still cannot put anybody in the address book.
  if (contactBook.byPublicKey(root, STRANGER) === null) {
    test.check('while the address book gains nobody — a relay still cannot write into it');
  } else {
    test.fail('a stranger reached the book');
  }
}

test.subHeading('Hearing the same route again costs nothing, and a better one wins');

{
  const root = freshRoot();
  const shadow = hub.shadow(root);

  shadow.note(KNOWN, { at: AT, via: MINE, rank: seenPeers.ARRIVED });
  shadow.note(KNOWN, { at: AT, via: MINE, rank: seenPeers.ARRIVED });
  if (shadow.routes(KNOWN).length === 1) {
    test.check('the same route twice is one row, not two');
  } else {
    test.fail('duplicated: ' + JSON.stringify(shadow.routes(KNOWN)));
  }

  // A SECOND DOOR TO THE SAME RELAY IS A SECOND ROUTE, because a route is
  // through MY relay to THEIRS and the two doors do not behave alike.
  shadow.note(KNOWN, { at: AT, via: AT2, rank: seenPeers.HEARSAY });
  if (shadow.routes(KNOWN).length === 2) {
    test.check('while another of my doors to the same relay is a second route');
  } else {
    test.fail('via was not part of the key: ' + JSON.stringify(shadow.routes(KNOWN)));
  }

  // AND RANK DECIDES WHICH IS OFFERED FIRST.
  shadow.note(KNOWN, { at: AT2, via: MINE, rank: seenPeers.HOST });
  if (shadow.get(KNOWN).at === AT2) {
    test.check('and the best-sourced route is the one a caller is handed');
  } else {
    test.fail('head of the list: ' + JSON.stringify(shadow.routes(KNOWN)));
  }
}

test.subHeading('Deleting a contact does not reach into the shadow');

{
  //   Andy: "a shadow route must not be dropped when a contact is
  //   deleted."
  //
  // `contactBook.forget` says the same of itself: it forgets YOUR side of
  // a relationship, and a relay's census is not yours to edit. Deleting a
  // row is a statement about an address book, not about what this node
  // was told — so re-adding somebody gets their route back without a
  // search, which is what makes pruning safe (R32).
  const root = freshRoot();
  const shadow = hub.shadow(root);

  contactBook.acquire(root, { publicKey: KNOWN, publicLabel: 'kim' }, 'handle');
  shadow.note(KNOWN, { at: AT, via: MINE, rank: seenPeers.PROVED });
  contactBook.forget(root, KNOWN);

  if (contactBook.byPublicKey(root, KNOWN) === null && shadow.get(KNOWN).at === AT) {
    test.check('the book was emptied and the memory was not');
  } else {
    test.fail('the shadow went with the contact: ' + JSON.stringify(shadow.get(KNOWN)));
  }
}

test.subHeading('A node that already had routes in its book keeps them (R1 migration)');

{
  // A node that ran before today has `routes` sitting in contacts.json.
  // Dropping them silently would throw away the only routes such a node
  // holds for its foreign contacts — which is exactly what 0018 said to
  // wait for the store to avoid. server.js moves them once at boot; this
  // asserts the reader that makes that possible.
  const root = freshRoot();
  contactBook.acquire(root, { publicKey: KNOWN, publicLabel: 'kim' }, 'handle');

  // The old shape, written by hand: a row from before the field went.
  const file = path.join(root, 'relay-state', 'contacts.json');
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  rows[0].routes = [AT, AT2];
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));

  const held = contactBook.everyRouteHeld(root);
  if (held.length === 2 && held[0].at === AT && held[0].publicKey === KNOWN) {
    test.check('every route an old book still holds can be read back out of it');
  } else {
    test.fail('found: ' + JSON.stringify(held));
  }

  // AND THEY FALL AWAY ON THE NEXT WRITE, because `upsert` stopped
  // carrying the field. No sweep, no flag, no migration to remember.
  contactBook.acquire(root, { publicKey: KNOWN, publicLabel: 'kim, renamed' }, 'handle');
  if (!('routes' in contactBook.byPublicKey(root, KNOWN))) {
    test.check('and the field falls away on the next write, with nothing to remember');
  } else {
    test.fail('routes survived an upsert');
  }
}

test.reportSuccessFailureCount();
