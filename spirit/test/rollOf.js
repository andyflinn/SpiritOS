'use strict';

// spirit/test/rollOf.js
// WHO IS ON A RELAY'S ROLL, READ OFF ITS DISC — for suites only.
//
// The relay serves no member list to anybody (0012: no member list served,
// by request or by broadcast), and a test-only read would leave that
// forbidden read standing in the product. So a suite reads the relay's disc
// directly: the members table in <home>/spirit/state/relay.db, through
// relayStore.open(home).
//
// Rows of { publicLabel, publicKey, claimedAt }, sorted by label.

const path = require('path');

function rollOf(box) {
  const home = typeof box.rootDir === 'function' ? box.rootDir() : box;
  // The store module beside the relay that wrote it (a suite may run a
  // relay out of a copied tree), else this checkout's.
  let relayStore;
  try { relayStore = require(path.join(home, 'spirit', 'relayStore.js')); }
  catch (e) { relayStore = require('../run/spirit/relayStore'); }
  const rows = [];
  relayStore.open(home).members.each(function (p) {
    rows.push({ publicLabel: p.publicLabel, publicKey: p.publicKey, claimedAt: p.claimedAt });
  });
  return rows.sort(function (a, b) { return String(a.publicLabel).localeCompare(String(b.publicLabel)); });
}

module.exports = rollOf;
