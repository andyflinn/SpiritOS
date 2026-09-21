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
  s.seen.put(A, { at: 'RELAY-1', url: 'https://one.example', label: 'ann', seen: 1000 });
  s.close();

  // A SECOND OPEN IS A SECOND PROCESS, as far as this claim goes: the
  // connection is gone, the cache entry with it, and what answers now can
  // only have come off the disc.
  const again = nodeStore.open(H);
  const got = again.seen.get(A);
  if (got && got.at === 'RELAY-1' && got.label === 'ann' && got.seen === 1000) {
    test.check('what was written before the store closed is there when it opens again');
  } else {
    test.fail('after reopen: ' + JSON.stringify(got));
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
  s.seen.put(A, { at: 'RELAY-1', url: 'https://one.example', label: 'ann', seen: 1000 });
  s.seen.put(A, { at: 'RELAY-1', url: 'https://one.example', label: '', seen: 2000 });

  const kept = s.seen.get(A);
  if (kept && kept.label === 'ann' && kept.seen === 2000) {
    test.check('a blank field leaves what is there, and the sighting still moves');
  } else {
    test.fail('after a blank write: ' + JSON.stringify(kept));
  }

  // AND AN UPDATE IS AN UPDATE. The rule is "do not blank", never "do not
  // change" — a person who renames themselves has renamed themselves.
  s.seen.put(A, { at: '', url: '', label: 'ann, renamed', seen: 3000 });
  const renamed = s.seen.get(A);
  if (renamed && renamed.label === 'ann, renamed' && renamed.at === 'RELAY-1') {
    test.check('while a value that is there replaces the old one, and the rest is untouched');
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

test.subHeading('Two evictions, and neither does the other\'s job (R4)');

{
  //   Andy: "route expiry has two evictions: cache-limit, and last seen."
  //
  // 0016's argument, one layer down: a space bound alone leaves a cache
  // frozen while there is room, and an age bound alone leaves it
  // unbounded while there is not.
  const s = nodeStore.open(home());
  s.seen.put(A, { at: 'R', seen: 1000 });
  s.seen.put(B, { at: 'R', seen: 5000 });

  const swept = s.seen.sweepOlderThan(2000);
  if (swept === 1 && s.seen.get(A) === null && s.seen.get(B)) {
    test.check('the age bound takes what is older than the cutoff and nothing else');
  } else {
    test.fail('swept ' + swept + ', A=' + JSON.stringify(s.seen.get(A)));
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
      { at: 'RELAY', url: 'https://relay.example', label: 'person-' + n, seen: 10000 + n });
  }
  const shed = s.seen.sweepToBytes(40 * 1024);
  if (shed > 0 && s.seen.bytes() <= 40 * 1024 && s.seen.size() > 0) {
    test.check('the space bound holds the FILE under its cap — ' +
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
  const held = s.seen.bytes();
  s.seen.clear();
  if (s.seen.bytes() < held) {
    test.check('and the file gives the pages back, or a byte cap could never be met twice');
  } else {
    test.fail('the file did not shrink: ' + held + ' -> ' + s.seen.bytes());
  }

  // A SWEEP WITH ROOM TO SPARE IS NOT A SWEEP.
  s.seen.put(A, { at: 'R', seen: 1 });
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

  one.seen.put(A, { at: 'R', seen: 1 });
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
  s.seen.put(A, { at: 'R', seen: 1 });

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

  s.seen.put(A, { at: 'R', seen: 1 });
  s.seen.put(B, { at: 'R', seen: 2 });
  if (s.seen.clear() === 2 && s.seen.size() === 0) {
    test.check('and clearing empties it and says how much it took');
  } else {
    test.fail('clear left ' + s.seen.size());
  }
  s.close();
}

test.reportSuccessFailureCount();
