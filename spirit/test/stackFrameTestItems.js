'use strict';

// spirit/test/stackFrameTestItems.js
// THE DOORS WANTED OF THE STACK-FRAME TEST, ONE TEST PER ITEM (goal/G22).
//
// Decided by Andy, 2026-10-13 (goal/G22.2's box): an item whose purpose is
// to add a row to the stack-frame test (oneDoorStacks.js, through
// tools/wirePaths.js) puts its red here. Each test asserts that its item's
// row exists: red until the item adds it, green after. What the new row
// then finds failing is the stack-frame test's verdict, not this suite's,
// and is fixed in an item of its own.
//
// So every door enters the design as a red deskVerify counts, and this
// file is the list of doors asked for.

const test = require('./testSupport.js');
const wirePaths = require('./tools/wirePaths.js');

const PEER_POST = 'spirit/run/js/peerPost.js';

function watches(row, mod, fn) {
  return Array.isArray(row.watch) && row.watch.some(function (w) { return w.mod === mod && w.fn === fn; });
}

// One entry per item: the item, what its row asserts, and how the row is recognised in BOTTOMS.
const ITEMS = [
  {
    item: 'goal/G22.2',
    title: 'nobody but peerPost talks to a relay',
    // The wire (http and https requests) with peerPost as its door, counting only requests addressed to a relay
    // (a process asking its own node over loopback is not relay traffic), and suites that drive it.
    is: function (row) {
      return row.door === PEER_POST && watches(row, 'http', 'request') && watches(row, 'https', 'request') &&
        row.relayOnly === true && Array.isArray(row.suites) && row.suites.length > 0;
    },
  },
];

test.startTest('goal/G22: the doors wanted of the stack-frame test, one per item');

ITEMS.forEach(function (want) {
  const names = Object.keys(wirePaths.BOTTOMS).filter(function (k) { return want.is(wirePaths.BOTTOMS[k]); });
  const title = want.item + ': the stack-frame test has the row "' + want.title + '"';
  if (names.length === 1) test.check(title, 'row ' + names[0]);
  else if (!names.length) test.fail(title, 'OWED by ' + want.item + ': no row in tools/wirePaths.js BOTTOMS asserts it');
  else test.fail(title, 'more than one row asserts it: ' + names.join(', '));
});

test.reportSuccessFailureCount();
