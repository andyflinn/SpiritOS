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
// it — and it is what this file asserts now. Since goal/G40.11 the book is the one table's kept rows: a route is a
// row of seen_routes, never a field of a contact, and a stranger a relay names has a row that is not kept.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const contactBook = require('../run/spirit/contacts');
const hub = require('../run/spirit/hub');
const seenPeers = require('../run/spirit/seenPeers');

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
  contactBook.acquire(root, { publicKey: KNOWN, publicLabel: 'kim' });

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
  contactBook.acquire(root, { publicKey: KNOWN, publicLabel: 'kim' });

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
  // its mechanism: a relay still cannot put anybody in the address book — its row is not kept.
  const strangerRow = contactBook.byPublicKey(root, STRANGER);
  if (strangerRow && !strangerRow.keep && !contactBook.listens(strangerRow)) {
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
  // a relationship, and a relay's roll is not yours to edit. Deleting a
  // row is a statement about an address book, not about what this node
  // was told — so re-adding somebody gets their route back without a
  // search, which is what makes pruning safe (R32).
  const root = freshRoot();
  const shadow = hub.shadow(root);

  contactBook.acquire(root, { publicKey: KNOWN, publicLabel: 'kim' });
  shadow.note(KNOWN, { at: AT, via: MINE, rank: seenPeers.PROVED });
  contactBook.forget(root, KNOWN);

  const gone = contactBook.byPublicKey(root, KNOWN);
  if (gone && !gone.keep && shadow.get(KNOWN).at === AT) {
    test.check('the book was emptied and the memory was not');
  } else {
    test.fail('the shadow went with the contact: ' + JSON.stringify(shadow.get(KNOWN)));
  }
}

test.subHeading('An old contacts.json moves into the table, and no route goes on a row (goal/G40.11)');

{
  // everyRouteHeld and the boot import STOOD HERE (R1): a book's `routes` field read out at hearsay at every boot since
  // 2026-09-21, so any node that ran since holds them in the shadow. Since goal/G40.11 contacts.json itself moves into
  // the table on the first start and is deleted; its `routes` field moves nowhere, and no contact row has one.
  const root = freshRoot();
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  const file = path.join(root, 'relay-state', 'contacts.json');
  fs.writeFileSync(file, JSON.stringify([{ publicKey: KNOWN, publicLabel: 'kim', myLabel: 'kim', acquiredVia: 'handle', routes: [AT, AT2] }], null, 2));
  const row = contactBook.byPublicKey(root, KNOWN);
  if (row && row.keep === true && row.myLabel === 'kim' && !fs.existsSync(file)) {
    test.check('a row of an old book is a kept row of the table, and the file is gone');
  } else {
    test.fail('after the move: ' + JSON.stringify(row) + ', file ' + fs.existsSync(file));
  }
  if (row && !('routes' in row) && typeof contactBook.everyRouteHeld === 'undefined') {
    test.check('and a contact row has no routes field, nor a reader for one');
  } else {
    test.fail('routes still on the row or read: ' + JSON.stringify(row));
  }
}

test.reportSuccessFailureCount();
