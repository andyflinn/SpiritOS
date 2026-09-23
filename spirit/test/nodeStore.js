'use strict';

// spirit/test/nodeStore.js
// THE NODE'S MACHINE STATE, ON DISC — the store itself.
//
//   Andy: "the route cache belongs to the machine, not the human."
//   Andy: "we need no peer review for allowing a database to be used for
//   the shadow roll. That's a decision."
//
// Decision 0018, cycle R26. The shadow roll lives in
// relay-state/node.db through node:sqlite, and RAM is its client. This
// suite asserts the store's contract directly — what seenPeers.js builds
// on — the way relayStore.js's suite does for the relay.
//
// ── THE ONE CLAIM THE WHOLE REQUIREMENT EXISTS FOR ───────────────────
//
// A row survives the process. Everything else here is detail: before this
// cycle the shadow was an object in memory that lost everything at a
// restart, which is why its age bound was an hour — "what a cache can
// afford while it lives in RAM and loses everything at a restart anyway".
// So the first check closes and reopens, and nothing else in this file
// matters if that one fails.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const nodeStore = require('../run/js/nodeStore');

function home() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-nodestore-'));
}

const A = 'KEY-AAA';
const B = 'KEY-BBB';

test.startTest('nodeStore — the node\'s machine state, on disc');

test.subHeading('A row survives the process, which is the whole point');

{
  const H = home();
  const s = nodeStore.open(H);
  s.seen.put(A, { label: 'ann', labelRank: 1, seen: 1000 });
  s.seen.putRoute(A, { via: 'MINE', at: 'RELAY-1', url: 'https://one.example', rank: 1, told: 1000 });
  s.close();

  // A SECOND OPEN IS A SECOND PROCESS, as far as this claim goes: the
  // connection is gone, the cache entry with it, and what answers now can
  // only have come off the disc.
  const again = nodeStore.open(H);
  const got = again.seen.get(A);
  const route = again.seen.routes(A)[0];
  if (got && got.label === 'ann' && got.seen === 1000 &&
      route && route.at === 'RELAY-1' && route.via === 'MINE') {
    test.check('what was written before the store closed is there when it opens again');
  } else {
    test.fail('after reopen: ' + JSON.stringify(got) + ' route ' + JSON.stringify(route));
  }

  if (fs.existsSync(path.join(H, 'relay-state', 'node.db'))) {
    test.check('and it is node.db under relay-state — the node\'s own file, not the relay\'s');
  } else {
    test.fail('no node.db at ' + nodeStore.dbPath(H));
  }

  // NOT relay.db. A node and a relay are never the same process —
  // server.js hands off on --relay and loads no node code — so sharing a
  // file would be two schemas somewhere nothing can open both.
  if (!fs.existsSync(path.join(H, 'relay-state', 'relay.db'))) {
    test.check('and opening a node store creates no relay store beside it');
  } else {
    test.fail('a relay.db appeared');
  }
  again.close();
}

test.subHeading('Greedy is a property of the write, not a discipline of the caller');

{
  const s = nodeStore.open(home());

  //   Andy: "the node MUST be greedy about route acquisition and updates,
  //   the (updated) public labels must be part of it."
  //
  // The callers do not all know the same things: a search knows the
  // label, an arriving packet knows only the road it came in on. Writing
  // every field every time meant a label learned from a search was
  // destroyed the moment that person sent anything.
  //
  // It is done in the statement now rather than by reading first, so it
  // is one round trip and cannot be forgotten by a new caller.
  s.seen.put(A, { label: 'ann', labelRank: 1, seen: 1000 });
  s.seen.putRoute(A, { via: 'MINE', at: 'RELAY-1', rank: 1, told: 1000 });
  s.seen.put(A, { label: '', seen: 2000 });

  const kept = s.seen.get(A);
  if (kept && kept.label === 'ann' && kept.seen === 2000) {
    test.check('a blank field leaves what is there, and the sighting still moves');
  } else {
    test.fail('after a blank write: ' + JSON.stringify(kept));
  }

  // AND AN UPDATE IS AN UPDATE. The rule is "do not blank", never "do not
  // change" — a person who renames themselves has renamed themselves, and
  // the relay they are on is entitled to say so.
  s.seen.put(A, { label: 'ann, renamed', labelRank: 1, seen: 3000 });
  const renamed = s.seen.get(A);
  if (renamed && renamed.label === 'ann, renamed' && s.seen.routes(A)[0].at === 'RELAY-1') {
    test.check('while a value that is there replaces the old one, and the route is untouched');
  } else {
    test.fail('after a rename: ' + JSON.stringify(renamed));
  }

  if (s.seen.get('KEY-NOBODY') === null) {
    test.check('and somebody never seen is null, not an empty row');
  } else {
    test.fail('a miss returned a row');
  }
  s.close();
}

test.subHeading('One eviction, and it is space (0021, superseding R4\'s age half)');

{
  //   Andy: "I don't see why the node should throw away memories when the
  //   20 Megabyte cap is not exhausted yet....."
  //
  // R4 had two evictions, age and space. The age one forgot while there
  // was room, and is gone: no store function sweeps by age any more.
  const s = nodeStore.open(home());
  s.seen.put(A, { label: 'a', seen: 1000 });
  s.seen.put(B, { label: 'b', seen: 5000 });

  if (typeof s.seen.sweepOlderThan === 'undefined' && s.seen.get(A) && s.seen.get(B)) {
    test.check('there is no age sweep, and a row seen long ago is still remembered');
  } else {
    test.fail('an age sweep survived, or A went: ' + JSON.stringify(s.seen.get(A)));
  }

  // ── AND THE SPACE BOUND IS BYTES ─────────────────────────────────
  //
  //   Andy: "why is the max for nodeStore not in Megabytes: it's say 20
  //   MBytes = 10 jpeg images from a modern cell phone?"
  //
  // MEASURED, NOT ESTIMATED: `page_count × page_size` is the file itself,
  // which matters because a label is free-form and a row is not a fixed
  // size. Enough rows to pass a small cap, then the file is asked.
  for (let n = 0; n < 400; n += 1) {
    s.seen.put('K' + String(n).padStart(4, '0'),
      { label: 'person-' + n, seen: 10000 + n });
  }
  const shed = s.seen.sweepToBytes(40 * 1024);
  if (shed > 0 && s.seen.bytes() <= 40 * 1024 && s.seen.size() > 0) {
    test.check('the space bound holds the CACHE under its cap — ' +
      s.seen.size() + ' rows in ' + Math.round(s.seen.bytes() / 1024) + ' KB');
  } else {
    test.fail('after sweep: shed ' + shed + ', ' + s.seen.bytes() + ' bytes');
  }

  // OLDEST FIRST, because the newest answer is the one somebody is
  // looking at.
  if (s.seen.get('K0000') === null && s.seen.get('K0399')) {
    test.check('and it takes the oldest, not whatever the page order reached first');
  } else {
    test.fail('order: first=' + JSON.stringify(s.seen.get('K0000')));
  }

  // THE FILE ACTUALLY SHRANK. Without `auto_vacuum` SQLite keeps a deleted
  // row's pages on a free list and the size never comes back down — so a
  // byte cap would evict for ever after one busy week, reading a number
  // that cannot fall.
  // THE FILE, NOT THE CACHE. `bytes()` now measures the cache's own
  // tables (R16), which fall on any delete whether or not the file gives
  // its pages back — so asserting on it here would pass with the vacuum
  // removed, which is a check that cannot fail. `fileBytes()` is what the
  // disc actually holds.
  const held = s.seen.fileBytes();
  s.seen.clear();
  if (s.seen.fileBytes() < held) {
    test.check('and the file gives the pages back, or a byte cap could never be met twice');
  } else {
    test.fail('the file did not shrink: ' + held + ' -> ' + s.seen.fileBytes());
  }

  // A SWEEP WITH ROOM TO SPARE IS NOT A SWEEP.
  s.seen.put(A, { label: 'a', seen: 1 });
  if (s.seen.sweepToBytes(20 * 1024 * 1024) === 0 && s.seen.size() === 1) {
    test.check('while a store inside its bound is left entirely alone');
  } else {
    test.fail('a sweep with room to spare removed something');
  }

  // AND A CAP NOTHING CAN SATISFY EMPTIES RATHER THAN SPINS. An empty
  // database still has a page, so "one byte" is a cap no store can meet;
  // the guard is what stops that being a loop.
  s.seen.sweepToBytes(1);
  if (s.seen.size() === 0) {
    test.check('and a cap no file could meet empties the store rather than spinning on it');
  } else {
    test.fail('an impossible cap left ' + s.seen.size() + ' rows');
  }
  s.close();
}

test.subHeading('One store per home, so two callers cannot disagree');

{
  // The shadow reads it, and the post queue and the owner's cap will
  // (R16, R31). Two connections to one file would be two answers to the
  // same question, and the second one wrong.
  const H = home();
  const one = nodeStore.open(H);
  const two = nodeStore.open(H);
  if (one === two) {
    test.check('opening the same home twice hands back the same store');
  } else {
    test.fail('two stores for one home');
  }

  one.seen.put(A, { label: 'a', seen: 1 });
  if (two.seen.size() === 1) {
    test.check('and a write through one is a read through the other');
  } else {
    test.fail('the two did not share');
  }

  // AND A DIFFERENT HOME IS A DIFFERENT STORE, which is what lets a suite
  // hold two nodes at once without their evictions becoming each other's
  // business.
  const other = nodeStore.open(home());
  if (other !== one && other.seen.size() === 0) {
    test.check('while another home is another store, with nothing in it');
  } else {
    test.fail('two homes shared a store');
  }
  one.close();
  other.close();
}

test.subHeading('Forgetting, and emptying');

{
  const s = nodeStore.open(home());
  s.seen.put(A, { label: 'a', seen: 1 });

  if (s.seen.forget(A) === true && s.seen.get(A) === null) {
    test.check('a row forgotten is gone, and says it went');
  } else {
    test.fail('forget did not remove the row');
  }

  // FALSE RATHER THAN A THROW for a key that was not there: a caller
  // tidying up should not have to ask first.
  if (s.seen.forget('KEY-NEVER-THERE') === false) {
    test.check('and forgetting somebody who was never here is false, not an error');
  } else {
    test.fail('forgetting a stranger claimed to remove something');
  }

  s.seen.put(A, { label: 'a', seen: 1 });
  s.seen.put(B, { label: 'b', seen: 2 });
  if (s.seen.clear() === 2 && s.seen.size() === 0) {
    test.check('and clearing empties it and says how much it took');
  } else {
    test.fail('clear left ' + s.seen.size());
  }
  s.close();
}

test.subHeading('Rank first, recency second — a cheap claim cannot displace a proven one (R29)');

{
  const s = nodeStore.open(home());

  // THE THING GREED ALONE COULD NOT DO: refuse a downgrade. Before this,
  // a second-hand name carried by a partner overwrote a rename from the
  // relay the person is actually on, simply by arriving later.
  s.seen.put(A, { label: 'hearsay', labelRank: 4, seen: 100 });
  s.seen.put(A, { label: 'the host says', labelRank: 1, seen: 200 });
  s.seen.put(A, { label: 'a partner says', labelRank: 4, seen: 300 });

  const held = s.seen.get(A);
  if (held.label === 'the host says' && held.labelRank === 1 && held.seen === 300) {
    test.check('a worse-sourced name cannot overwrite a better one, however late it arrives');
  } else {
    test.fail('after a downgrade attempt: ' + JSON.stringify(held));
  }

  // AND RECENCY STILL DECIDES INSIDE A RANK. "Rank first" is not "rank
  // only": two callers equally entitled to be believed are separated by
  // which of them spoke last.
  s.seen.put(A, { label: 'the host, again', labelRank: 1, seen: 400 });
  if (s.seen.get(A).label === 'the host, again') {
    test.check('while an equally entitled source that spoke later does win');
  } else {
    test.fail('equal rank did not update: ' + JSON.stringify(s.seen.get(A)));
  }
  s.close();
}

test.subHeading('A route is a pair of doors, not an address (R1)');

{
  //   Andy: "peer-key / A-key / B-key — that the key?"
  //
  // A route is not "this peer lives at B". It is through MY relay A to
  // THEIR relay B — and if this node is a member of A and C, where A
  // partners with B and C does not, then one of those routes works and
  // the other does not. Keyed by destination alone they would be one row.
  const s = nodeStore.open(home());
  s.seen.put(A, { label: 'bella', seen: 1 });
  s.seen.putRoute(A, { via: 'MY-RELAY-A', at: 'THEIR-RELAY-B', rank: 2, told: 10 });
  s.seen.putRoute(A, { via: 'MY-RELAY-C', at: 'THEIR-RELAY-B', rank: 4, told: 20 });

  const both = s.seen.routes(A);
  if (both.length === 2 && both[0].via === 'MY-RELAY-A' && both[1].via === 'MY-RELAY-C') {
    test.check('two of my doors to one of theirs are two routes, best-ranked first');
  } else {
    test.fail('routes: ' + JSON.stringify(both));
  }

  // AND THE BEST ONE LEADS, however old it is — rank before recency here
  // as everywhere else.
  s.seen.putRoute(A, { via: '', at: 'THEIR-RELAY-D', rank: 1, told: 5 });
  if (s.seen.routes(A)[0].at === 'THEIR-RELAY-D') {
    test.check('and a better-ranked route goes to the head, however old it is');
  } else {
    test.fail('head: ' + JSON.stringify(s.seen.routes(A)[0]));
  }

  // A ROUTE WITH NO DESTINATION TEACHES NOTHING.
  if (s.seen.putRoute(A, { via: 'MINE', at: '' }) === false) {
    test.check('while a route naming no relay is refused rather than stored');
  } else {
    test.fail('a route with no destination was kept');
  }

  // CAPPED, WORST FIRST — the opposite order from the peer table, and
  // deliberately: rows there are bounded by how many people exist, rows
  // here by how many ways there are to reach ONE person, and the fourth
  // best way has never been the one that worked.
  for (let n = 0; n < 6; n += 1) {
    s.seen.putRoute(A, { via: 'V' + n, at: 'FAR-' + n, rank: 4, told: 100 + n });
  }
  const capped = s.seen.routes(A);
  if (capped.length === nodeStore.MAX_ROUTES && capped[0].rank === 1) {
    test.check('and the list is capped at ' + nodeStore.MAX_ROUTES +
      ', shedding the worst rather than the oldest');
  } else {
    test.fail('after overflow: ' + JSON.stringify(capped.map(function (r) { return r.rank; })));
  }

  // FORGETTING SOMEBODY TAKES THEIR ROUTES: a route row for a peer with
  // no peer row is unreachable by every reader here.
  s.seen.forget(A);
  if (s.seen.routes(A).length === 0) {
    test.check('and forgetting a peer takes every way of reaching them with it');
  } else {
    test.fail('routes outlived the peer: ' + JSON.stringify(s.seen.routes(A)));
  }
  s.close();
}

test.subHeading('Presence is three states, because "unseen" is not "away"');

{
  // contacts.js has had three marks all along — "WHITE is NOT a dimmer
  // red. A contact we share no relay with is not offline, they are
  // UNSEEN" — and a two-state column could not hold it. Found by a bug:
  // a "no opinion" sentinel survived a first INSERT and read as true, so
  // a node that had merely been told where somebody lives reported them
  // present.
  const s = nodeStore.open(home());
  s.seen.put(A, { label: 'x', seen: 1 });
  if (s.seen.get(A).present === null) {
    test.check('somebody nobody has spoken about is null — not absent');
  } else {
    test.fail('unseen read as ' + JSON.stringify(s.seen.get(A).present));
  }

  s.seen.put(A, { present: true, seen: 2 });
  s.seen.put(A, { label: 'y', labelRank: 1, seen: 3 });
  if (s.seen.get(A).present === true) {
    test.check('and a caller with nothing to say about presence does not erase it');
  } else {
    test.fail('a silent caller changed presence');
  }

  s.seen.put(A, { present: false, seen: 4 });
  if (s.seen.get(A).present === false) {
    test.check('while a caller that says absent is believed');
  } else {
    test.fail('absent was not recorded');
  }
  s.close();
}

test.subHeading('A node.db from this morning still opens (R29 migration)');

{
  // The schema shipped a few hours before this one, with `at` and `url`
  // on the peer row: one route, no via, no rank. Any node that has run
  // since has one, so this is a real migration and not a hypothetical.
  const oldHome = home();
  fs.mkdirSync(path.join(oldHome, 'relay-state'), { recursive: true });
  const { DatabaseSync } = require('node:sqlite');
  const raw = new DatabaseSync(path.join(oldHome, 'relay-state', 'node.db'));
  raw.exec('CREATE TABLE seen (' +
    'publicKey TEXT PRIMARY KEY,' +
    "at TEXT NOT NULL DEFAULT ''," +
    "url TEXT NOT NULL DEFAULT ''," +
    "label TEXT NOT NULL DEFAULT ''," +
    'seen INTEGER NOT NULL DEFAULT 0)');
  raw.exec("INSERT INTO seen VALUES ('OLD-PEER','OLD-RELAY','https://old.example','ollie',777)");
  raw.exec("INSERT INTO seen VALUES ('NO-ROUTE','','','nora',888)");
  raw.close();

  const migrated = nodeStore.open(oldHome);
  const peer = migrated.seen.get('OLD-PEER');
  const moved = migrated.seen.routes('OLD-PEER')[0];

  if (peer && peer.label === 'ollie' && peer.seen === 777) {
    test.check('the peer row survives, with its name and its date');
  } else {
    test.fail('peer after migration: ' + JSON.stringify(peer));
  }

  // THE OLD ROUTE BECOMES A ROW AT RANK 4 WITH NO `via`, because nothing
  // recorded which door proved it and claiming otherwise would be
  // inventing provenance.
  if (moved && moved.at === 'OLD-RELAY' && moved.url === 'https://old.example' &&
      moved.via === '' && moved.rank === 4 && moved.told === 777) {
    test.check('and its one route moves across, unranked and with no door claimed');
  } else {
    test.fail('migrated route: ' + JSON.stringify(moved));
  }

  if (migrated.seen.get('NO-ROUTE') && migrated.seen.routes('NO-ROUTE').length === 0) {
    test.check('while a row that never had a route gains no invented one');
  } else {
    test.fail('a routeless row grew a route');
  }

  // AND THE OLD COLUMNS ARE GONE, so nothing can read the stale copy —
  // which is the whole complaint 0018 made about the contact row.
  if (!('at' in peer) && !('url' in peer)) {
    test.check('and the old columns are dropped — no second copy to disagree with the first');
  } else {
    test.fail('old columns survived: ' + JSON.stringify(peer));
  }
  migrated.close();
}

// ── DECLARED, NOT BUILT (cycle 10, R17) ──────────────────────────────
//
// The recipient keeps a replay index, because the relay is deliberately
// not in the sealed packet associated data — so the same sealed blob
// carried by a DIFFERENT relay meets a registered-hash guard that has
// never seen it. The index belongs to the node, in node.db, checked
// before an app sees a message, and rebuildable from the traffic log.
//
// Asked as availability: there is no `replay` surface on the store yet.
test.awaiting('cycle-10/R17', 'nodeStore.replay',
  !!(nodeStore.open(home()).replay),
  'a node refuses a sealed post whose hash it has already admitted',
  { there: 20, cost: 'a sitting — a table, a check before delivery, and a rebuild from the log' });

test.reportSuccessFailureCount();
