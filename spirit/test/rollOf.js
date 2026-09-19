'use strict';

// spirit/test/rollOf.js
// WHO IS ON A RELAY'S ROLL, READ OFF ITS DISC — for suites only.
//
// Until cycle 3 a suite asked `box.who()` for the whole roll. The relay no
// longer answers that to anybody (0012 widened: no member list served, by
// request or by broadcast), and putting it back for tests would leave the
// forbidden read standing in the product as a temptation. So a suite reads
// the relay's disc directly — the members table in relay-state/relay.db —
// exactly as suites used to read routingTable.json.
//
// Same shape `who()` answered, sorted by label.

const path = require('path');

function rollOf(box) {
  const home = typeof box.rootDir === 'function' ? box.rootDir() : box;
  // The store module beside the relay that wrote it (a suite may run a
  // relay out of a copied tree), else this checkout's.
  let relayStore;
  try { relayStore = require(path.join(home, 'js', 'relayStore.js')); }
  catch (e) { relayStore = require('../run/js/relayStore'); }
  const rows = [];
  relayStore.open(home).members.each(function (p) {
    rows.push({ publicLabel: p.publicLabel, publicKey: p.publicKey, claimedAt: p.claimedAt, owner: !!p.owner });
  });
  return rows.sort(function (a, b) { return String(a.publicLabel).localeCompare(String(b.publicLabel)); });
}

module.exports = rollOf;
