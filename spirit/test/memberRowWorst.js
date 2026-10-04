'use strict';

// spirit/test/memberRowWorst.js
// THE MOST A RELAY'S MEMBER ROW CAN COST ON DISC, computed from the rule — goal/G4.19, issue 7.
//
//   Andy, 2026-10-04, the box of goal/G4.19: "wouldn't we fix what really needs fixing, the capacity measurement, so
//   it takes text field limits from fieldRules.js ?", then "fix it properly then." DECIDED there: "a member row's
//   worst size is computed from fieldRules.js (label 64, description 128) plus its fixed parts, so the capacity
//   figure follows the rule and never goes stale".
//
// WHAT A ROW HOLDS (relayStore.js, members; nodeCard.js, cardFrom): the name three times as typed (publicLabel,
// labelNorm, and labelNorm again in the members_label index) and once inside the card's JSON; the description once,
// inside the card. Inside JSON a byte can cost two: `"` and `\` are allowed by the rule and escape to two bytes, and
// nothing the rule lets through costs more (control characters are refused; a lone surrogate is three bytes typed
// and six escaped, two again). So a name byte costs at most 5 and a description byte at most 2.
//
// THE FIXED PARTS are the key, the time, the card's other fields and signature, and SQLite's own row overhead:
// FIXED_BYTES is a row with a one-byte name and no description, measured at 479 bytes (2000 rows into a real
// relayStore, WSL Ubuntu, 2026-10-04), rounded up. PAGE_SLACK: SQLite keeps whole rows on a 4 KB page, so rows near
// 1 KB leave a page partly empty; at the rule's maxima, every byte a `"`, a row measured 1165 bytes against 1056
// summed, 1.10 — 1.25 keeps the worst a worst. Re-measure both if the row's schema changes; the field limits are
// read from fieldRules each call and need nothing.

const rules = require('../run/js/fieldRules.js');

const FIXED_BYTES = 480;
const PER_NAME_BYTE = 5;
const PER_DESCRIPTION_BYTE = 2;
const PAGE_SLACK = 1.25;

function worstBytes() {
  return Math.ceil((FIXED_BYTES + PER_NAME_BYTE * rules.MAX_BYTES + PER_DESCRIPTION_BYTE * rules.DESCRIPTION_MAX_BYTES) * PAGE_SLACK);
}

module.exports = { worstBytes: worstBytes, FIXED_BYTES: FIXED_BYTES, PAGE_SLACK: PAGE_SLACK };
