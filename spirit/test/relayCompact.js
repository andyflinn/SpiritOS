'use strict';

// spirit/test/relayCompact.js
// A RELAY'S FILE SHRINKS WHEN ITS ROLL DOES — cycle 9, after the fact.
//
//   Andy, 2026-09-22: "since disc space is such a cheap resource compared
//   to the expected needs, compacting at restart sound like a good
//   stop-gap-measure."
//
// The hole it fills: a deleted row frees a page and does not shorten the
// file, and cycle 9 bounds the roll by `bytes()`. So an owner who removed
// members to make room would be refused the shrink he had just made room
// for — "evict before shrinkage" defeated at the moment somebody follows
// it (design/principles/LIMITED-RESOURCES.md).
//
// Measured while writing this: 20,000 members is 3.5 MB; removing 15,000
// leaves the file at 3.5 MB; a VACUUM takes 20 ms and leaves 0.9 MB.

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const test = require('./testSupport.js');
const relayStore = require('../run/js/relayStore');

test.startTest('A relay compacts its store, and refuses when the disc cannot afford it');

function home() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-compact-'));
}

function fill(store, n) {
  store.transaction(function () {
    for (let i = 0; i < n; i += 1) {
      store.members.put({
        publicKey: 'K' + crypto.randomBytes(32).toString('base64'),
        publicLabel: 'member' + i,
        claimedAt: new Date().toISOString(),
      });
    }
  });
}

function run() {
  const dir = home();
  const store = relayStore.open(dir);
  fill(store, 4000);
  const full = store.bytes();

  const keys = [];
  store.members.each(function (m) { keys.push(m.publicKey); });
  store.transaction(function () {
    keys.slice(0, 3000).forEach(function (k) { store.members.remove(k); });
  });
  const afterRemoval = relayStore.open(dir).bytes();

  test.subHeading('Removing members frees pages and does NOT shorten the file');
  if (afterRemoval >= full * 0.95 && relayStore.open(dir).members.count() === 1000) {
    test.check('1,000 of 4,000 left, and the file is still ' + (afterRemoval / 1048576).toFixed(2) +
      ' MB — which is why the disc bound needed this');
  } else {
    test.fail('the file changed by itself: ' + full + ' → ' + afterRemoval);
  }

  test.subHeading('Compacting shortens it, and says by how much');
  const squeezed = relayStore.compact(dir, 10240);
  if (squeezed.ok && squeezed.after < squeezed.before && typeof squeezed.ms === 'number') {
    test.check('down to ' + (squeezed.after / 1048576).toFixed(2) + ' MB in ' + squeezed.ms + ' ms');
  } else {
    test.fail('the compaction did nothing: ' + JSON.stringify(squeezed));
  }
  if (relayStore.open(dir).bytes() === squeezed.after && relayStore.open(dir).members.count() === 1000) {
    test.check('and the roll is intact afterwards — this moves pages, never rows');
  } else {
    test.fail('the roll changed across a compaction');
  }

  test.subHeading('…and the bound now sees the space that was freed');
  // The point of the whole thing: a figure that would have been refused
  // against the stale size fits against the real one.
  if (squeezed.after < full) {
    test.check('the disc figure an owner could set after evicting is smaller than before');
  } else {
    test.fail('nothing was reclaimed for the owner to use');
  }

  test.subHeading('A disc that cannot afford the copy is told, not tried');
  // A VACUUM writes a fresh copy before freeing anything, so it needs
  // about twice the file — it cannot run on the disc that is full, which
  // is the day somebody wants it most.
  const refused = relayStore.compact(dir, 0.1);
  if (!refused.ok && /twice the file/.test(refused.why)) {
    test.check('refused with the arithmetic in the sentence: ' + refused.why.slice(0, 80));
  } else {
    test.fail('a compaction was attempted on a full disc: ' + JSON.stringify(refused));
  }

  test.subHeading('A relay with no database yet says so rather than failing');
  const empty = relayStore.compact(home(), 10240);
  if (!empty.ok && /no database yet/.test(empty.why)) {
    test.check('nothing to compact is not an error');
  } else {
    test.fail('an empty home gave: ' + JSON.stringify(empty));
  }

  relayStore.closeAll();
  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
