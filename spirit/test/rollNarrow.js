'use strict';

// spirit/test/rollNarrow.js
// THE ROLL IS GONE, AND NOTHING REACHES FOR IT.
//
//   Andy: "the roll mechanism is a cheat." — "when a cheat is
//   identified, it must be eradicated." — "the eradication must be done to
//   eliminate temptation."
//
// `GET /api/relay/who` was a public, unsigned, unbounded read of every
// member of a relay: 151 bytes a row, ~147 KB at a thousand, answerable by
// anyone as often as they liked. Named a cheat in decision 0010 on
// 2026-09-17 and deleted on 2026-09-18.
//
// ── WHY THIS FILE STILL HAS THIS NAME ────────────────────────────────
//
// It was written for the INTERMEDIATE strategy — narrowing the roll with
// `?key=` so callers could ask about somebody specific. That worked, moved
// five callers, and was not what finished the job:
//
//   Andy: "callers of the roll have two choices: use other interfaces
//   or die."
//
// Narrowing is how a cheat survives. 0012 says it plainly — *a narrower
// cheat is a defended one* — so the parameter went with the route, and
// this suite became the guard instead of the demonstration. The name is
// kept so the history is findable; what it checks is the opposite of what
// it checked.
//
// ── WHAT IT GUARDS ───────────────────────────────────────────────────
//
// Source-level, and deliberately: a relapse looks exactly like a caller
// that never moved, and the harness has caught every one of them this way.
// Eight readers went between 2026-09-17 and 2026-09-18 and NOT ONE needed
// a replacement — the thing to defend is that nobody quietly adds a ninth.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');

// Comments are stripped before matching. Several files carry a tombstone
// NAMING the route they no longer call — that is the record working, and a
// check that cannot tell prose from code would read it as a relapse.
// A FILE THAT VANISHED BETWEEN THE WALK AND THE READ IS SKIPPED, not
// fatal. The suites run six at a time over ONE working tree, and
// buildStamp.js writes `spirit/run/zz-copy-probe.js`, checks that it is
// named as uncopied, and unlinks it in a finally (buildStamp.js:118-130).
// Land the walk before that write and the read after that unlink, and
// this threw ENOENT and took the whole suite with it — eight checks lost
// to a file that was never anybody's code.
//
// Skipping cannot hide an offender: a file that no longer exists is not
// calling anything. (Reported from the WSL checkout, 2026-09-21, where it
// showed up once in three runs.)
//
// THIRD TIME THIS SHAPE HAS APPEARED IN ONE CYCLE — labMaster's
// copyTrackedSpirit reads an index that lists deleted files, plantRun.js
// copies a listing that can go stale mid-copy, and now this. Anything
// that walks and then reads has to tolerate the walk being out of date.
function codeOf(file) {
  try {
    return fs.readFileSync(path.join(RUN, file), 'utf8').replace(/\/\/.*/g, '');
  } catch (e) {
    if (e && e.code === 'ENOENT') return '';
    throw e;
  }
}

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // node_modules is nobody's code here, and process/ holds spawned
      // scripts that never speak to a relay.
      if (entry.name === 'node_modules' || entry.name === 'process') return;
      walk(full, out);
      return;
    }
    if (/\.(js|html)$/.test(entry.name)) out.push(path.relative(RUN, full));
  });
  return out;
}

test.startTest('The roll is gone, and nothing reaches for it');

// ── 1. NO CALLER, ANYWHERE UNDER run/ ────────────────────────────────

test.subHeading('No file under run/ asks for it');

const offenders = walk(RUN, []).filter(function (rel) {
  return /api\/relay\/who/.test(codeOf(rel));
});

if (offenders.length === 0) {
  test.check('no code under run/ names /api/relay/who — ' +
    walk(RUN, []).length + ' files checked');
} else {
  test.fail('still reaching for the roll: ' + offenders.join(', '));
}

// ── 2. AND THE DOOR ITSELF IS SHUT ───────────────────────────────────
//
// A caller can be removed and the route left standing, which is the exact
// shape 0010 calls temptation: "a door that answers is an invitation."

test.subHeading('And the relay does not serve it');

// BOTH STARTUP MODULES. The relay's routes moved to relayServer.js with
// cycle 0 (node and relay as separate startup modules); a roll door
// would have to be in one of the two.
const server = codeOf(path.join('js', 'server.js')) + '\n' + codeOf(path.join('js', 'relayServer.js'));

if (!/['"]\/api\/relay\/who['"]/.test(server)) {
  test.check('neither server.js nor relayServer.js has a route for it, or an entry in the public-path list');
} else {
  test.fail('the route is still served');
}

// THE HANDLER AND ITS HELPER WENT TOO. A dead function is the next
// person's starting point.
if (!/handleRelayWho|expandKeys/.test(server)) {
  test.check('handleRelayWho and expandKeys are gone with it');
} else {
  test.fail('the handler or its key-expander is still there');
}

// ── 3. WHAT ANSWERS INSTEAD ──────────────────────────────────────────
//
// Named here so a reader of this file learns where the questions went,
// rather than only that they stopped being asked.

test.subHeading('And the questions it used to answer have homes');

if (/['"]\/api\/relay\/key['"]/.test(server)) {
  test.check('who a box is and who runs it — GET /api/relay/key, fixed cost');
} else {
  test.fail('the key door is missing');
}

const badge = codeOf(path.join('js', 'ownerBadge.js'));

if (/relayKeys\.seatedUrls/.test(badge)) {
  test.check('where this node holds a seat — its own record, written at claim');
} else {
  test.fail('ownerBadge no longer reads the seat record');
}

const hub = codeOf(path.join('js', 'hub.js'));

if (/relayKeys\.seat\(/.test(hub)) {
  test.check('and the claim writes that record, which is what made the rest possible');
} else {
  test.fail('nothing records a seat when a claim succeeds');
}

// ── 4. THE RULE, NOT JUST THIS ROUTE ─────────────────────────────────
//
// 0012, widened 2026-09-18: no party may ASK for an entire enrolment list
// — not a stranger, not a member, not the owner — and no bounded,
// paginated or owner-only version of one. A broadcast is a different
// thing: what is refused is an unbounded PULL, not disclosure to members.
//
// Asserted on the decision rather than on code, because the next roll
// will not be called `who`.

test.subHeading('And the rule that keeps a second one from appearing');

const twelve = fs.readFileSync(
  path.join(__dirname, '..', '..', 'design', 'decisions',
    '0012-a-relay-never-asks-for-a-member-list.md'), 'utf8');

if (/No party may ASK for an entire enrolment list/.test(twelve)) {
  test.check('0012 covers every direction, not only relay-to-relay');
} else {
  test.fail('0012 no longer states the widened rule');
}

if (/a broadcast is not a list/i.test(twelve)) {
  test.check('and says why a broadcast is not one — cost shape, not disclosure');
} else {
  test.fail('0012 lost the broadcast correction');
}

test.reportSuccessFailureCount();
