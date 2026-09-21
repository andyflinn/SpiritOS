'use strict';

// spirit/run/js/seenPeers.js
// WHERE THIS NODE HAS BEEN TOLD PEOPLE LIVE.
//
//   Andy: "the node MUST be greedy about route acquisition and updates,
//   the (updated) public labels must be part of it."
//   "Any peer a node could possibly connect to, the route to it can be
//   known to the node."
//
// IT STARTED AS "what a search learned", which is what the title said
// until 2026-09-21, and it is fed from four places now: a search answer,
// a packet arriving (whatever the door then decides about the sender), a
// relay's route announcement, and a relay named at acquisition. The
// narrower name described the first of those and hid the rule.
//
// Each of those held a route and threw it away. A search knew where every
// row lived and kept only a URL; an arrival knew the road it came in on;
// an announcement about a stranger was dropped; an invite named a relay
// whose key this node had pinned. A contact could arrive with an address
// in `relays` and NOTHING in `routes`.
//
// ── WHY NOT IN THE CONTACT BOOK ──────────────────────────────────────
//
// Because a search result is not a contact, and the book says so in the
// one rule that keeps it honest: a relay may improve what this node knows
// about its own contacts and may never add to them. (`learnRoute` enforced
// that until 2026-09-21; routes left the book entirely with 0018, so it is
// structural now — there is nowhere in a row for a route to go.) Writing forty
// strangers into the book because somebody typed three letters would make
// a search a way to fill another person's address book.
//
// So this is a different thing with a different lifetime: not who you
// know, but who you have lately been told about.
//
// ── BOUNDED BY BOTH, FOR THE REASON 0016 GIVES ───────────────────────
//
// A space bound alone leaves a cache frozen when there is room, and an
// age bound alone leaves it unbounded when there is not. Neither
// substitutes for the other, which is the same argument that put two
// bounds on a relay's rolls.
//
// DECLARED, NOT MEASURED, and marked so nobody reads them as evidence.
//
// AND THE AGE IS UNDER DISPUTE BY THE RULE ABOVE. This said "nothing a
// person saw an hour ago is still worth acting on without asking again",
// which fits a search somebody is still looking at and contradicts
// Andy's "the user may forget all search results, the node must not". An
// hour is what the cache can afford while it lives in RAM and loses
// everything at a restart anyway; it is not what the rule wants. The
// number is open with the store (gap cycle R26) and should be read as a
// consequence of having no store rather than as a decision about
// forgetting.

// ── WHAT THIS IS, SAID PLAINLY ───────────────────────────────────────
//
//   Andy: "key the global cache by peer ID (it becomes a
//   shadow-contact-list)" — "and implicitly a duplicate of the relays
//   member-roll" — "(time-lagged, of course)" — "it is simply not
//   canonical."
//
// Keyed by peer, so a peer seen a thousand times is one row: growth is
// bounded by distinct people, not by traffic.
//
// NOT A DUPLICATE OF ANYTHING, and the distinction is the whole licence
// for it to exist:
//
//   Andy: "it's not duplication, it's like a browser's cache. it's just a
//   shadow and by definition not a duplicate, because it tracks the
//   node's traffic with the contacts IT knows."
//
// (He first called it "implicitly a duplicate of the relay's member-roll,
// time-lagged" and then sharpened it, which is the framing that holds. A
// duplicate is derived FROM the roll and aims at completeness. This is
// derived from this node's OWN TRAFFIC: it can only ever hold people this
// node searched for, was written to by, or exchanged with. Any overlap
// with a membership list is incidental, the way a browser's cache
// overlaps with a website without being a copy of it.)
//
// IT MAY GUESS AND MAY NEVER ASSERT. A wrong hint costs one failed
// attempt; "is X on relay R" is the relay's answer and not this one. Not
// canonical, not a roster, not a count, not a membership check.
//
// AND IT STAYS INSIDE THIS NODE — for a better reason than the roll
// rules give. 0012 and PARTNERS.md's "a relay NEVER persists a partner's
// members" are about a RELAY holding another relay's people, which this
// is not. What exposing this would leak is not a relay's membership: it
// is WHOSE BUSINESS THIS NODE HAS BEEN DOING. Give it a verb, an app
// surface or a route and the node's own dealings become readable by
// whoever asks. There is no reader here but the node's own acquisition
// path, and that is a boundary rather than an omission.

// ── THE SPACE BOUND IS BYTES, BECAUSE THAT IS WHAT AN OWNER SPENDS ──
//
//   Andy: "why is the max for nodeStore not in Megabytes: it's say 20
//   MBytes = 10 jpeg images from a modern cell phone?"
//
// It was `MAX_ENTRIES = 500`, a row count — a unit nobody thinks in, and
// one that says nothing about the thing being spent. **Measured at 225
// bytes a row** on a real file with its index, five hundred rows is
// **110 KB**: about a five-hundredth of what a person would call
// reasonable, and no way to tell that from the number.
//
// TWENTY MEGABYTES IS ANDY'S ANCHOR AND HIS UNIT: *"say 20 MBytes = 10
// jpeg images from a modern cell phone"*. At the measured size that holds
// roughly **93,000 people** — and his own frame for it is the one to keep:
//
//   Andy: "we can easily default to a small city...."
//
// Which is the honest way to read this bound. It is not meant to be
// reached — it exists so the failure mode is chosen rather than
// discovered (0016), and so an owner on a small box can make it smaller.
// A node that has met a small city has other problems.
//
// STILL THE OWNER'S TO SET (cycle R31). This is the default and the
// enforcement; the setting and the screen that shows it are the rest of
// that requirement.
var MAX_BYTES = 20 * 1024 * 1024;

// How entitled a source is to be believed. Lower wins, and the names are
// what the callers pass rather than numbers nobody can read at the call
// site.
var HOST = 1;      // the relay that holds them said so
var PROVED = 2;    // a signature this node checked
var ARRIVED = 3;   // a packet came from there
var HEARSAY = 4;   // carried by a partner, or unstated

// ── AN HOUR WAS WHAT NO STORE COULD AFFORD; THIRTY DAYS IS A CHOICE ──
//
// This was 60 * 60 * 1000, and the comment above already said that was a
// consequence rather than a decision: an hour is what a cache can afford
// while it lives in RAM and loses everything at a restart anyway.
//
//   Andy: "the user may forget all search results, the node must not."
//
// With a store (0018, cycle R26) a long memory costs disc rather than
// nothing, so the number becomes answerable. Thirty days is proposed on
// three grounds and none of them is measurement:
//
//   1. It outlives the thing it exists for. "Any peer a node could
//      possibly connect to" is not a question about this week.
//   2. It is not the bound that does the work. R4 has TWO evictions and
//      the SPACE one is the real limit — the owner's cap (R31). Age is
//      the backstop for a row nothing has touched, not the ceiling.
//   3. A route nobody has reconfirmed in a month is worth one failed
//      attempt, which is all a wrong hint ever costs (seenPeers may guess
//      and may never assert).
//
// DECLARED, NOT MEASURED, and marked so nobody reads it as evidence.
var MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// ── THE ROWS LIVE ON DISC NOW (cycle R26) ────────────────────
//
// This file keeps the RULES — what is worth writing down, what greedy
// means, when a row goes — and `nodeStore.js` keeps the rows, the way
// relay.js keeps the rules and relayStore.js keeps the roll.
//
// A CALLER WITH NO STORE GETS NO MEMORY, and that is deliberate rather
// than a fallback: a second in-memory implementation would be a code path
// the product never runs and every suite would silently test instead. The
// suites open a store in a temp home, which is the same path the node
// takes.
function createSeenPeers(opts) {
  opts = opts || {};
  var nowFn = opts.now || Date.now;
  var maxBytes = opts.maxBytes || MAX_BYTES;
  var maxAgeMs = opts.maxAgeMs || MAX_AGE_MS;
  var store = opts.store || (opts.rootDir ? require('./nodeStore').open(opts.rootDir) : null);
  if (!store) throw new Error('seenPeers needs a store: pass rootDir or store');
  var rows = store.seen;

  // BOTH EVICTIONS, AS QUERIES. They were two passes over every key in
  // memory; they are an index seek and an ordered delete now, which is
  // what 0018 licensed a store to make possible.
  function sweep() {
    rows.sweepOlderThan(nowFn() - maxAgeMs);
    // OLDEST FIRST WHEN THERE IS NO ROOM, because the newest answer is
    // the one somebody is looking at.
    rows.sweepToBytes(maxBytes);
  }

  // `at` is the far relay's KEY, which is what a route is made of. A row
  // with neither key nor url teaches nothing and is not kept: an entry
  // that cannot answer the question it exists for is a row that will be
  // consulted and found wanting.
  // ── GREEDY, WHICH MEANS NEVER BLANKING WHAT IT KNOWS ─────────────────
  //
  //   Andy: "the node MUST be greedy about route acquisition and updates,
  //   the (updated) public labels must be part of it."
  //
  // A field is updated when the caller HAS one and left alone when it does
  // not. This wrote every field on every call, and the callers do not all
  // know the same things: a search knows the label, an arriving packet
  // knows only the road it came in on. So a label learned from a search
  // was destroyed the moment that person sent anything — greedy about
  // forgetting, which is the opposite of the rule.
  //
  // `seen` is always refreshed, because the entry WAS seen. That is the
  // one field every caller knows by virtue of calling.
  //
  // ── RANK FIRST, RECENCY SECOND (cycle R29) ───────────────────
  //
  // Every caller now says how entitled it is to be believed. Greed alone
  // could not refuse a DOWNGRADE: a second-hand name carried by a partner
  // would overwrite a rename from the relay the person is actually on,
  // simply by arriving later.
  //
  //   HOST     1  the relay that holds them said so — label and route
  //   PROVED   2  a signature this node checked      — route
  //   ARRIVED  3  a packet came from there           — route
  //   HEARSAY  4  carried by a partner               — both, weakly
  //
  // The default is HEARSAY, which is the safe end: a caller that forgets
  // to say loses an argument it might have won, rather than winning one
  // it should have lost.
  function note(publicKey, what) {
    var key = String(publicKey || '').trim();
    var at = String((what && what.at) || '').trim();
    var url = String((what && what.url) || '').trim();
    var label = String((what && what.label) || '');
    var rank = (what && what.rank) || HEARSAY;
    var via = String((what && what.via) || '').trim();
    var present = (what && what.present);
    var hasPresence = present === true || present === false;
    if (!key || (!at && !url && !label && !hasPresence)) return false;

    // The merge lives in the statement (nodeStore's `put`): a blank field
    // leaves what is there, a worse-ranked one is refused, and `seen` is
    // always written. Doing it in SQL rather than by reading first keeps
    // it one round trip and makes both rules properties of the write
    // instead of disciplines each caller has to remember.
    var now = nowFn();
    rows.put(key, {
      label: label, labelRank: rank, labelAt: now,
      present: hasPresence ? present : undefined, seen: now,
    });
    // A ROUTE IS A SEPARATE ROW, because it is a separate thing: through
    // MY door `via`, to THEIR relay `at`. A caller with a url and no `at`
    // has told us an address and not a route, and the peer row above has
    // already taken what that was worth.
    if (at) rows.putRoute(key, { via: via, at: at, url: url, rank: rank, told: now });
    sweep();
    return true;
  }

  // Null rather than an empty shape, so a caller cannot act on a miss by
  // accident.
  // The row, with its BEST route flattened onto it. Every caller wanted
  // one route and the shape said so; the list is there for the caller
  // that wants to try a second door, through `routes()`.
  function get(publicKey) {
    var key = String(publicKey || '').trim();
    var row = rows.get(key);
    if (!row) return null;
    if (nowFn() - row.seen >= maxAgeMs) { rows.forget(key); return null; }
    var best = rows.routes(key)[0] || null;
    return {
      at: (best && best.at) || '',
      url: (best && best.url) || '',
      via: (best && best.via) || '',
      label: row.label,
      present: row.present,
      seen: row.seen,
    };
  }

  // Every way this node knows to reach somebody, best-ranked first.
  function routes(publicKey) { return rows.routes(String(publicKey || '').trim()); }

  function size() { sweep(); return rows.size(); }

  // ── DELETING A CONTACT MUST NOT REACH IN HERE ────────────────────────
  //
  //   Andy: "a shadow route must not be dropped when a contact is
  //   deleted."
  //
  // `contactBook.forget` says the same thing about itself: it "forgets
  // YOUR side of a relationship, and a relay's census is not yours to
  // edit". Deleting a row is a statement about an address book, not about
  // what this node was told — so the shadow survives, and re-adding
  // somebody gets their route back without a search.
  //
  // THE OBJECTION, and why it does not land: it can look as though delete
  // should mean erase. It cannot mean that here, because the traffic log
  // already keeps more than this does and keeps it for good ("the log
  // should be permanent. period." — Andy). A cache that expires on its
  // own schedule holds strictly less than the record beside it.
  //
  // `forget` exists for a caller that has finished with a row, not for
  // the contact book. Nothing in run/ calls it.
  function forget(publicKey) { rows.forget(String(publicKey || '').trim()); }
  function reset() { rows.clear(); }

  return {
    note: note,
    get: get,
    routes: routes,
    size: size,
    forget: forget,
    reset: reset,
    maxBytes: maxBytes,
    maxAgeMs: maxAgeMs,
    bytes: function () { return rows.bytes(); },
  };
}

module.exports = {
  createSeenPeers: createSeenPeers,
  HOST: HOST,
  PROVED: PROVED,
  ARRIVED: ARRIVED,
  HEARSAY: HEARSAY,
  MAX_BYTES: MAX_BYTES,
  MAX_AGE_MS: MAX_AGE_MS,
};
