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
// And it is a PARTIAL, LAGGED COPY OF RELAY MEMBERSHIP, assembled from
// what this node happened to be told and never asked for. Saying so is
// the point, because it decides what may be done with it:
//
//   it may GUESS   — a hint that is wrong costs one failed attempt
//   it may not ASSERT — "is X on relay R" is the relay's answer, not this
//
// NOT CANONICAL, and nothing may treat it as though it were: not a
// roster, not a count, not a membership check, not an answer to anybody.
//
// AND IT STAYS INSIDE THIS NODE. The rules against duplicating a roll
// (0012, PARTNERS.md's "a relay NEVER persists a partner's members") are
// about a RELAY holding another relay's people, which this is not — a
// node keeping what it was told is a different party. But the distance
// is one accessor wide: give this a verb, an app surface or a route and
// it becomes a way to harvest membership sideways, from a box that was
// never asked and cannot refuse. There is no reader here but the node's
// own acquisition path, and that is a boundary rather than an omission.

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
