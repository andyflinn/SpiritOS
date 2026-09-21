'use strict';

// spirit/test/seenPeers.js
// WHERE THIS NODE HAS BEEN TOLD PEOPLE LIVE.
//
// (It was "what a search learned" until 2026-09-21. It is fed from four
// places now — a search, a packet arriving, a route announcement, and a
// relay named at acquisition — and the narrower name hid the rule.)
//
//   Andy: "in a search request, it is the node who already knows the via
//   field at request time." — "so all search returns could be cached
//   outside of contacts, and wait until they become applicable."
//   "I'm trying to go diligently through all instances where knowledge is
//   thrown away blindly, and it costs the relay nothing."
//
// A search answer says where each person lives — `via` when the row came
// from a partner, otherwise the relay that answered — and the node threw
// it away, keeping only a URL. So a contact acquired from a search
// arrived with an address in `relays` and nothing in `routes`, and the
// first post to them carried no hint.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const seen = require('../run/js/seenPeers');

// ── EVERY SHADOW GETS ITS OWN HOME (cycle R26) ───────────────────────
//
// The rows are on disc now (0018, nodeStore.js), so a shadow needs a
// place to be. A fresh home per instance, because several of the checks
// below run two of them at once with different bounds and a shared file
// would make each one's evictions the other's business.
//
// AND THERE IS NO IN-MEMORY MODE TO TEST INSTEAD. That is the point: a
// second implementation would be a path the product never runs, so the
// suite takes the same one the node does.
function shadow(opts) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-shadow-'));
  const o = Object.assign({ rootDir: home }, opts || {});
  return seen.createSeenPeers(o);
}

function clock(start) {
  let t = start || 1000;
  return { now: function () { return t; }, tick: function (ms) { t += ms; } };
}

test.startTest('Seen peers — where this node has been told people live');

test.subHeading('It keeps where somebody lives, and hands it back');

{
  const c = clock();
  const S = shadow({ now: c.now });

  S.note('KEY-BELLA', { at: 'RELAY-B', url: 'https://b.example', label: 'bella' });
  const got = S.get('KEY-BELLA');
  if (got && got.at === 'RELAY-B' && got.url === 'https://b.example') {
    test.check('a row noted is a row returned, with the relay key a route is made of');
  } else {
    test.fail('got: ' + JSON.stringify(got));
  }

  // NULL RATHER THAN AN EMPTY SHAPE, so a miss cannot be acted on by
  // accident — an object with blank fields is the kind of answer that
  // gets passed along and fails somewhere else.
  if (S.get('KEY-NOBODY') === null) {
    test.check('and somebody never seen is null, not an empty row');
  } else {
    test.fail('a miss returned: ' + JSON.stringify(S.get('KEY-NOBODY')));
  }

  // A ROW THAT TEACHES NOTHING IS NOT KEPT — and what counts as nothing
  // narrowed when the rule became greedy (2026-09-21). This asserted that
  // a label with no route was refused, on the reasoning that it could not
  // answer the question the cache exists for. Andy: "the (updated) public
  // labels must be part of it" — a name is something this node was told,
  // and may be all it ever gets about somebody.
  //
  // So nothing means nothing: no route, no address, no name.
  if (!S.note('KEY-EMPTY', {}) && S.get('KEY-EMPTY') === null) {
    test.check('a row carrying no route, no address and no name is refused rather than stored');
  } else {
    test.fail('an empty row was kept');
  }
}

test.subHeading('Bounded by age and by space, because neither does the other’s job');

{
  // 0016's argument, in a smaller place: a space bound leaves a cache
  // frozen while there is room, and an age bound leaves it unbounded
  // while there is not.
  const c = clock();
  const S = shadow({ now: c.now, maxAgeMs: 1000 });

  S.note('KEY-OLD', { at: 'R1' });
  c.tick(1100);
  if (S.get('KEY-OLD') === null) {
    test.check('what was learned an age ago is not offered as though it were fresh');
  } else {
    test.fail('a stale row survived: ' + JSON.stringify(S.get('KEY-OLD')));
  }

  // THE SPACE BOUND IS BYTES NOW, so forcing it means writing enough to
  // fill a file rather than counting to four.
  //
  //   Andy: "why is the max for nodeStore not in Megabytes... we can
  //   easily default to a small city."
  //
  // A row measures 225 bytes on disc, so a 40 KB cap is a couple of
  // hundred people — small enough to fill here, large enough to be past
  // an empty file's own few pages.
  const T = shadow({ now: c.now, maxBytes: 40 * 1024, maxAgeMs: 99999 });
  for (let n = 0; n < 400; n += 1) {
    c.tick(10);
    T.note('K' + String(n).padStart(4, '0'), { at: 'R', url: 'https://relay.example', label: 'p' + n });
  }

  if (T.bytes() <= 40 * 1024 && T.size() > 0) {
    test.check('the store is held under its cap in BYTES, which is the unit the owner spends — ' +
      T.size() + ' rows in ' + Math.round(T.bytes() / 1024) + ' KB');
  } else {
    test.fail('after 400 rows: ' + T.bytes() + ' bytes, ' + T.size() + ' rows');
  }

  // OLDEST FIRST, because the newest answer is the one somebody is
  // looking at. The first key written must be gone and the last must not.
  if (T.get('K0000') === null && T.get('K0399')) {
    test.check('and what went was the oldest, not whatever the index reached first');
  } else {
    test.fail('eviction order: first=' + JSON.stringify(T.get('K0000')) +
      ' last=' + JSON.stringify(T.get('K0399')));
  }
}

test.subHeading('It is not the contact book, and must not become one');

{
  // The book's one rule: learnRoute matches an existing row and never
  // creates one — "a relay may improve what this node knows about its own
  // contacts and may never add to them". Writing forty strangers into it
  // because somebody typed three letters would make a search a way to
  // fill another person's address book.
  //
  // So this holds them instead, and forgets on its own schedule.
  const c = clock();
  const S = shadow({ now: c.now });
  for (let n = 0; n < 40; n += 1) S.note('STRANGER-' + n, { at: 'R' + n });

  if (S.size() === 40) {
    test.check('forty strangers from one search are held here, where they cost a bound and not a book');
  } else {
    test.fail('held ' + S.size());
  }

  // And a caller that has finished with one can say so, which is what
  // acquiring is: the knowledge has moved somewhere permanent.
  S.forget('STRANGER-0');
  if (S.get('STRANGER-0') === null && S.size() === 39) {
    test.check('and one can be forgotten once it has been spent');
  } else {
    test.fail('forget left ' + S.size());
  }
}

test.subHeading('Greedy means never blanking what it already knows');

{
  //   Andy: "the node MUST be greedy about route acquisition and updates,
  //   the (updated) public labels must be part of it."
  //
  // The callers do not all know the same things. A search knows the
  // label; an arriving packet knows only the road it came in on. Writing
  // every field on every call meant a label learned from a search was
  // destroyed the moment that person sent anything — greedy about
  // forgetting, which is the opposite of the rule.
  const c = clock();
  const S = shadow({ now: c.now });

  S.note('KEY-BELLA', { at: 'RELAY-B', url: 'https://b.example', label: 'bella' });
  c.tick(10);
  S.note('KEY-BELLA', { at: 'RELAY-B', url: 'https://b.example' });   // an arrival

  const kept = S.get('KEY-BELLA');
  if (kept && kept.label === 'bella') {
    test.check('a packet arriving does not blank the label a search taught');
  } else {
    test.fail('the label was lost on arrival: ' + JSON.stringify(kept));
  }

  // AND AN UPDATE IS AN UPDATE. A label somebody changed replaces the old
  // one — the rule is "do not blank", not "do not change".
  c.tick(10);
  S.note('KEY-BELLA', { label: 'bella, renamed' });
  const renamed = S.get('KEY-BELLA');
  if (renamed && renamed.label === 'bella, renamed' && renamed.at === 'RELAY-B') {
    test.check('while a new label replaces the old, and the route it knew is untouched');
  } else {
    test.fail('after a rename: ' + JSON.stringify(renamed));
  }

  // A LABEL ALONE IS WORTH KEEPING, since a name with no route is still
  // something this node was told and may be all it gets.
  if (S.note('KEY-NAMED-ONLY', { label: 'somebody' }) && S.get('KEY-NAMED-ONLY')) {
    test.check('and a name with no route at all is still worth writing down');
  } else {
    test.fail('a label-only row was refused');
  }

  // `seen` is refreshed by every call, because the entry WAS seen — the
  // one thing every caller knows by virtue of calling.
  const before = S.get('KEY-BELLA').seen;
  c.tick(50);
  S.note('KEY-BELLA', { at: 'RELAY-B' });
  if (S.get('KEY-BELLA').seen > before) {
    test.check('and every sighting refreshes when it was seen, whatever else it carried');
  } else {
    test.fail('seen did not move');
  }
}

test.subHeading('It survives the process, which is what the store bought (R26)');

{
  // THE CLAIM THE WHOLE REQUIREMENT EXISTS FOR, made at the level that
  // matters rather than only at the store's.
  //
  // Before this cycle the shadow was an object in memory, and its own
  // comment said the age bound was a consequence of that: an hour is
  // "what a cache can afford while it lives in RAM and loses everything
  // at a restart anyway".
  //
  //   Andy: "the user may forget all search results, the node must not."
  //
  // A node that forgot everything on every restart could not keep that
  // promise however long the number was.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-shadow-'));
  const c = clock();

  const first = seen.createSeenPeers({ rootDir: home, now: c.now });
  first.note('KEY-PERSISTS', { at: 'RELAY-P', url: 'https://p.example', label: 'percy' });

  // A SECOND INSTANCE OVER THE SAME HOME. Not the same object, and not
  // the same connection once the first is closed — what answers can only
  // have come off the disc.
  require('../run/js/nodeStore').open(home).close();
  const second = seen.createSeenPeers({ rootDir: home, now: c.now });
  const kept = second.get('KEY-PERSISTS');

  if (kept && kept.at === 'RELAY-P' && kept.label === 'percy') {
    test.check('a route learned before a restart is still there after one');
  } else {
    test.fail('the shadow did not survive: ' + JSON.stringify(kept));
  }

  // AND THE AGE BOUND IS NOW A CHOICE RATHER THAN A CONSEQUENCE. Thirty
  // days is declared, not measured, and is marked as such in the module —
  // what this asserts is only that it is no longer an hour, because an
  // hour was the number a cache with no disc could afford.
  if (seen.MAX_AGE_MS > 24 * 60 * 60 * 1000) {
    test.check('and the age bound outlives a day, which a memory-only cache could not justify');
  } else {
    test.fail('MAX_AGE_MS is still ' + seen.MAX_AGE_MS);
  }
}

test.reportSuccessFailureCount();
