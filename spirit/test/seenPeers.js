'use strict';

// spirit/test/seenPeers.js
// WHAT A SEARCH LEARNED, KEPT UNTIL SOMEBODY ACTS ON IT.
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

const test = require('./testSupport.js');
const seen = require('../run/js/seenPeers');

function clock(start) {
  let t = start || 1000;
  return { now: function () { return t; }, tick: function (ms) { t += ms; } };
}

test.startTest('Seen peers — what a search learned, until it is wanted');

test.subHeading('It keeps where somebody lives, and hands it back');

{
  const c = clock();
  const S = seen.createSeenPeers({ now: c.now });

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

  // A ROW THAT TEACHES NOTHING IS NOT KEPT. An entry with neither key nor
  // address cannot answer the question it exists for, so storing it only
  // means being consulted and found wanting.
  if (!S.note('KEY-EMPTY', { label: 'just a name' }) && S.get('KEY-EMPTY') === null) {
    test.check('a row with no relay key and no url is refused rather than stored');
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
  const S = seen.createSeenPeers({ now: c.now, maxAgeMs: 1000, maxEntries: 100 });

  S.note('KEY-OLD', { at: 'R1' });
  c.tick(1100);
  if (S.get('KEY-OLD') === null) {
    test.check('what was learned an age ago is not offered as though it were fresh');
  } else {
    test.fail('a stale row survived: ' + JSON.stringify(S.get('KEY-OLD')));
  }

  const T = seen.createSeenPeers({ now: c.now, maxEntries: 3, maxAgeMs: 99999 });
  ['a', 'b', 'c'].forEach(function (k, i) { c.tick(10); T.note(k, { at: 'R' + i }); });
  c.tick(10);
  T.note('d', { at: 'R3' });

  if (T.size() === 3 && T.get('a') === null && T.get('d')) {
    test.check('and with no room the oldest goes — the newest answer is the one somebody is looking at');
  } else {
    test.fail('after overflow: size ' + T.size() + ' a=' + JSON.stringify(T.get('a')));
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
  const S = seen.createSeenPeers({ now: c.now });
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

test.reportSuccessFailureCount();
