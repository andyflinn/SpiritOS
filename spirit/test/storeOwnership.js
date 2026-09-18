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
// It was written after `arrivals.js` grew its own
// `relay-state/pendingArrivals.json` beside the traffic log — two copies
// of "what is still waiting", able to drift, and a commit message that
// claimed the fold had already happened when it had not. A claim in prose
// is not a check.
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

const RUN_JS = path.join(__dirname, '..', 'run', 'js');

test.startTest('Store ownership — one module per store, and no way round it');

// Every persistent store this node or a relay keeps, and the single
// module that is allowed to know where it lives. The browser half of an
// isomorphic module counts as the same owner.
const STORES = [
  { file: 'traffic.jsonl', owner: 'trafficLog.js', what: "this node's WAN traffic, permanent, read back as a table" },
  { file: 'traffic.json', owner: 'trafficLog.js', what: 'the whole-file shape it used to have, read once on the way in' },
  { file: 'routingTable.json', owner: 'relay.js', what: 'a relay\'s peer rows' },
  { file: 'invites.json', owner: 'invites.js', what: 'live invite tokens' },
  { file: 'relayKeys.json', owner: 'relayKeys.js', what: 'pinned relay keys' },
  { file: 'contacts.json', owner: 'whoBook.js', what: 'the address book' },
  // The name it wore until 2026-09-18, renamed on first load. Listed so a
  // node upgrading in place is a case somebody decided rather than a file
  // that quietly stops being read — `who` was the census's word, and this
  // book exists precisely to not be the census.
  { file: 'who.json', owner: 'whoBook.js', what: 'the address book, under its old name' },
  { file: 'device.json', owner: 'deviceAuth.js', what: 'the door password and device slot' },
];

// A store nobody should have any more. Named so its return would be a
// failure with a reason rather than a silent second copy.
const RETIRED = [
  {
    file: 'pendingArrivals.json',
    why: 'the backlog folded into traffic.json — a row that is admitted and not yet takenAt IS the backlog',
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
      if (e.name === 'node_modules') return;
      filesIn(path.join(dir, e.name), out);
      return;
    }
    if (/\.js$/.test(e.name)) out.push(path.join(dir, e.name));
  });
  return out;
}

const files = filesIn(RUN_JS, []);

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
  const named = files.filter(function (full) {
    return codeOf(fs.readFileSync(full, 'utf8')).indexOf(gone.file) !== -1;
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
