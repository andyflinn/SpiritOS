'use strict';

// spirit/run/js/seenPeers.js
// WHAT A SEARCH LEARNED, KEPT UNTIL IT BECOMES USEFUL.
//
//   Andy: "in a search request, it is the node who already knows the via
//   field at request time." — "so all search returns could be cached
//   outside of contacts, and wait until they become applicable."
//
// A search answer says where each person lives: the row carries `via`
// when it came from a partner, and otherwise the peer is a member of the
// relay that answered, whose key this node has pinned. Both halves are in
// hand at the moment of the answer — and both were thrown away. A contact
// acquired from a search arrived with an address in `relays` and NOTHING
// in `routes`.
//
// ── WHY NOT IN THE CONTACT BOOK ──────────────────────────────────────
//
// Because a search result is not a contact, and the book says so in the
// one rule that keeps it honest: `learnRoute` matches an existing row and
// never creates one — "a relay may improve what this node knows about its
// own contacts and may never add to them" (server.js). Writing forty
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
// What has to be true of them: a search's worth of rows fits several
// times over, and nothing a person saw an hour ago is still worth acting
// on without asking again.

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

var MAX_ENTRIES = 500;
var MAX_AGE_MS = 60 * 60 * 1000;

function createSeenPeers(opts) {
  opts = opts || {};
  var nowFn = opts.now || Date.now;
  var maxEntries = opts.maxEntries || MAX_ENTRIES;
  var maxAgeMs = opts.maxAgeMs || MAX_AGE_MS;

  // publicKey -> { at, url, label, seen }
  var rows = Object.create(null);

  function sweep() {
    var now = nowFn();
    var keys = Object.keys(rows);
    keys.forEach(function (k) {
      if (now - rows[k].seen >= maxAgeMs) delete rows[k];
    });
    // OLDEST FIRST WHEN THERE IS NO ROOM, because the newest answer is
    // the one somebody is looking at.
    keys = Object.keys(rows);
    if (keys.length <= maxEntries) return;
    keys.sort(function (a, b) { return rows[a].seen - rows[b].seen; });
    keys.slice(0, keys.length - maxEntries).forEach(function (k) { delete rows[k]; });
  }

  // `at` is the far relay's KEY, which is what a route is made of. A row
  // with neither key nor url teaches nothing and is not kept: an entry
  // that cannot answer the question it exists for is a row that will be
  // consulted and found wanting.
  function note(publicKey, what) {
    var key = String(publicKey || '').trim();
    var at = String((what && what.at) || '').trim();
    var url = String((what && what.url) || '').trim();
    if (!key || (!at && !url)) return false;
    rows[key] = {
      at: at,
      url: url,
      label: String((what && what.label) || ''),
      seen: nowFn(),
    };
    sweep();
    return true;
  }

  // Null rather than an empty shape, so a caller cannot act on a miss by
  // accident.
  function get(publicKey) {
    var key = String(publicKey || '').trim();
    var row = rows[key];
    if (!row) return null;
    if (nowFn() - row.seen >= maxAgeMs) { delete rows[key]; return null; }
    return { at: row.at, url: row.url, label: row.label, seen: row.seen };
  }

  function size() { sweep(); return Object.keys(rows).length; }

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
  function forget(publicKey) { delete rows[String(publicKey || '').trim()]; }
  function reset() { rows = Object.create(null); }

  return {
    note: note,
    get: get,
    size: size,
    forget: forget,
    reset: reset,
    maxEntries: maxEntries,
    maxAgeMs: maxAgeMs,
  };
}

module.exports = {
  createSeenPeers: createSeenPeers,
  MAX_ENTRIES: MAX_ENTRIES,
  MAX_AGE_MS: MAX_AGE_MS,
};
