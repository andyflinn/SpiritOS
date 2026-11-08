'use strict';

// spirit/test/storeOwnership.js
// EVERY STORE HAS ONE OWNER, AND PRODUCTION CODE GOES THROUGH IT.
//
//   Andy: "tests can read what they need to read, production code MUST
//   read through the API. I'm sure there's local-disc databases that can
//   boost performance down the road…"
//
// That last clause is the whole reason this suite exists. A file is an
// implementation, not an architecture: `traffic.json` should be able to
// become SQLite without anything above it noticing. That is only true
// while exactly one module knows the filename — the moment a second file
// opens it directly, the file format is the interface and swapping it is
// a rewrite rather than a substitution.
//
// The rule is for `spirit/run/` only. A suite reading a store's file to
// see what really landed is doing its job; that is the difference between
// checking a claim and depending on a shape.
//
// ── WHAT THIS CAUGHT ─────────────────────────────────────────────────
//
// A module that grows its own store beside another's (arrivals.js's
// `spirit/state/pendingArrivals.json` beside the traffic log once) makes two
// copies of one fact, able to drift. A claim in prose is not a check.
//
// ── FALSE NEGATIVES ONLY ─────────────────────────────────────────────
//
// It matches literal filenames in quotes. A name built at runtime is
// invisible here, deliberately: a scanner that guessed at concatenation
// would invent violations out of string fragments, and one false
// accusation costs more than several missed ones.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const VENDORED_FOLDERS = require('../run/spirit/fileSystem.js').VENDORED_FOLDERS;

const RUN_JS = path.join(__dirname, '..', 'run', 'spirit');

test.startTest('Store ownership — one module per store, and no way round it');

// Every persistent store this node or a relay keeps, and the single
// module that is allowed to know where it lives. The browser half of an
// isomorphic module counts as the same owner.
const STORES = [
  { file: 'traffic.jsonl', owner: 'trafficLog.js', what: "this node's WAN traffic, permanent, read back as a table" },
  // THE RELAY'S DATA IS ONE DATABASE — members and invites (the partner
  // roll went with goal/G22.6) — and exactly one module opens it. This is the
  // substitution Andy anticipated at the top of this file: the format
  // changed and nothing above relayStore.js had to notice.
  { file: 'relay.db', owner: 'relayStore.js', what: 'a relay\'s members, invites and partner roll' },
  // THE BOOK IS ROWS OF node.db'S ONE TABLE (goal/G40.11), and nodeStore.js moves no old contacts.json in (goal/G41.30).
  // THIS ENTRY PASSES FOR THE WRONG REASON: no product file names contacts.json; the one file found is the suite
  // spirit/run/spirit/test/nodeStore.js, whose basename is the owner's, and files are compared by basename.
  { file: 'contacts.json', owner: 'nodeStore.js', what: 'the address book before goal/G40.11, moved into the one table once' },
];

// A store nobody should have any more. Named so its return would be a
// failure with a reason rather than a silent second copy.
const RETIRED = [
  {
    file: 'device.json',
    why: 'the door password and device slot, owned by deviceAuth.js; the device enrolment was removed by goal/G16.2',
  },
  {
    file: 'pendingArrivals.json',
    why: 'the backlog folded into the traffic log — a row that is delivered and not yet takenAt IS the backlog',
  },
  // THE OLD STORES NOTHING READS ANY MORE (goal/G43.23, the box's item 7; Andy, goal/G41.30: "let's get rid of those
  // "rescue operations""). A file of these names left on a node or a relay lies there unread.
  {
    file: 'traffic.json',
    why: 'the traffic log\'s whole-file shape before traffic.jsonl; trafficLog.js no longer reads it',
  },
  {
    file: 'routingTable.json',
    why: 'a relay\'s peer rows before cycle 3; relayStore.js no longer imports it into relay.db (D8, eliminated)',
  },
  {
    file: 'invites.json',
    why: 'a relay\'s invite tokens before cycle 3; relayStore.js no longer imports it into relay.db (D8, eliminated)',
  },
  {
    file: 'relayKeys.json',
    why: 'pinned relay keys before goal/G19.15; relayKeys.js no longer moves it into node.db',
  },
  {
    file: 'relays.json',
    why: 'the relay list before goal/G19.15; relayKeys.js no longer moves it into node.db',
  },
  {
    file: 'mailbox.json',
    why: 'the name routingTable.json replaced. The fallback that read it was a READ and never a migration, ' +
      'so it could only go once a live relay had written the new name — spirit-3 did on 2026-09-13. ' +
      'A stale copy may still sit on an old box; nothing reads it, and servableAssets.js still asserts it unservable',
  },
];

function filesIn(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    if (e.isDirectory()) {
      if (VENDORED_FOLDERS.holds(path.join(dir, e.name))) return;
      filesIn(path.join(dir, e.name), out);
      return;
    }
    if (/\.js$/.test(e.name)) out.push(path.join(dir, e.name));
  });
  return out;
}

// shellMove's suite lays out an old node: it names the stores as its fixture, and opens none (goal/G43.8). noRescue's
// suite plants the old stores to assert nothing reads them (goal/G43.23): fixtures too.
const SUITES_WITH_FIXTURES = ['shellMove.js', 'noRescue.js'];
const files = filesIn(RUN_JS, []).filter(function (f) {
  return SUITES_WITH_FIXTURES.indexOf(path.basename(f)) === -1 || path.basename(path.dirname(f)) !== 'test';
});

// Comments may name a store — several explain why a rule exists by
// pointing at the file it protects. Only code counts.
function codeOf(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

test.subHeading(files.length + ' file(s) under spirit/run/js');

STORES.forEach(function (store) {
  const named = files.filter(function (full) {
    const code = codeOf(fs.readFileSync(full, 'utf8'));
    return code.indexOf("'" + store.file + "'") !== -1 ||
      code.indexOf('"' + store.file + '"') !== -1;
  }).map(function (full) { return path.basename(full); });

  if (named.length === 1 && named[0] === store.owner) {
    test.check(store.file + ' is known only to ' + store.owner + ' — ' + store.what);
  } else if (!named.length) {
    // Not a pass and not a failure worth stopping for: the store may
    // have been renamed, and this list would then be describing a world
    // that has moved.
    test.fail(store.file + ' is named by nothing — has it been renamed? update this list with it');
  } else {
    test.fail(store.file + ' is opened by ' + named.join(', ') +
      ' — production code must reach it through ' + store.owner);
  }
});

RETIRED.forEach(function (gone) {
  // The whole name, not a prefix of a longer one: traffic.json is retired, traffic.jsonl is live.
  const whole = new RegExp(gone.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])');
  const named = files.filter(function (full) {
    return whole.test(codeOf(fs.readFileSync(full, 'utf8')));
  }).map(function (full) { return path.basename(full); });

  if (!named.length) {
    test.check(gone.file + ' is gone and stays gone — ' + gone.why);
  } else {
    test.fail(gone.file + ' is back, in ' + named.join(', ') + ' — ' + gone.why);
  }
});

// AND THE SCANNER IS NOT ASLEEP. Every check above passes against one
// that reads nothing: an empty file list, a comment-stripper that ate
// everything, a match that never fires.
(function itCanActuallyFail() {
  const owner = files.filter(function (f) { return path.basename(f) === 'trafficLog.js'; })[0];
  const code = owner ? codeOf(fs.readFileSync(owner, 'utf8')) : '';
  if (files.length > 20 && code.indexOf("'traffic.jsonl'") !== -1) {
    test.check('and it is reading real code — ' + files.length + " files, and trafficLog.js really does name its own store");
  } else {
    test.fail('the scan proves nothing: files=' + files.length + ' ownerFound=' + !!owner);
  }
})();

test.reportSuccessFailureCount();
