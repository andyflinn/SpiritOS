'use strict';

// spirit/test/routeStash.js
// A RELAY MAY IMPROVE A CONTACT ROW. IT MAY NEVER CREATE ONE.
//
//   Andy: "I think that streamed routes should be exempt from the log,
//   they just miraculously get stashed on the correct contact-row."
//
// A relay announces a route it has PROVEN — it carried a packet to that
// key through that partner and a reply came back signed by it — and every
// member holding a row for that key writes it down. One member paid for
// the discovery; everybody gets it, which is the whole argument for
// broadcasting rather than caching (0013: spend bandwidth, protect RAM).
//
// ── THE BOUNDARY IS THE WHOLE OF THE SAFETY ──────────────────────────
//
// An announcement lands on a row that already exists, or nowhere. If it
// could create one, a relay could put people in somebody's address book —
// and "my book is mine" would stop being true in the one file where it
// matters most. A route for a key nobody here knows is dropped where it
// lands, which is also what makes receiving announcements cheap: most are
// about people you do not know and cost one lookup.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const whoBook = require('../run/js/whoBook');

function freshRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-routestash-'));
}

const KNOWN = 'MCowBQYDK2VwAyEA' + 'k'.repeat(27) + '=';
const STRANGER = 'MCowBQYDK2VwAyEA' + 's'.repeat(27) + '=';
const AT = 'https://lab.example';

test.startTest('A proven route lands on a row that already exists');

// ── 1. SOMEBODY IN THE BOOK ──────────────────────────────────────────

test.subHeading('A route for a contact is written on their row');

const root = freshRoot();
whoBook.acquire(root, { publicKey: KNOWN, publicLabel: 'known' }, 'handle');
const before = whoBook.load(root).length;

const updated = whoBook.learnRoute(root, KNOWN, AT);

if (updated && (updated.relays || []).indexOf(AT) !== -1) {
  test.check('the route lands on the row, beside any already there');
} else {
  test.fail('not stashed: ' + JSON.stringify(updated));
}

// IT SURVIVES A RELOAD, because the point of learning a route is not
// having to learn it again — and because a relay that reboots is
// re-primed by its members, which only works if the members kept it.
const reloaded = whoBook.byPublicKey(root, KNOWN);
if (reloaded && (reloaded.relays || []).indexOf(AT) !== -1) {
  test.check('and it is on disk, which is what re-primes a relay that restarted');
} else {
  test.fail('the route did not persist');
}

// ── 2. SOMEBODY WHO IS NOT ───────────────────────────────────────────

test.subHeading('And a route for a stranger is dropped, never added');

const ignored = whoBook.learnRoute(root, STRANGER, AT);

if (ignored === null) {
  test.check('an announcement about somebody unknown changes nothing');
} else {
  test.fail('a stranger was written into the book: ' + JSON.stringify(ignored));
}

if (whoBook.load(root).length === before) {
  test.check('and the book is exactly as long as it was — a relay cannot fill it');
} else {
  test.fail('the book grew from ' + before + ' to ' + whoBook.load(root).length);
}

// AND NOT AS A CENSUS ROW EITHER. `handshake` exists to write a bare row
// from a census this node read for itself; an announcement must not take
// that path, because reading a census is this node's own act and hearing
// an announcement is somebody else's.
if (!whoBook.byPublicKey(root, STRANGER)) {
  test.check('not even as a bare row — hearing about somebody is not meeting them');
} else {
  test.fail('the stranger got a row by the side door');
}

// ── 3. REPEATS ARE FREE ──────────────────────────────────────────────
//
// Announcements repeat: every proven forward makes another, and a busy
// mesh proves the same route many times a day. A row that collected a
// duplicate each time would grow without bound for a fact that never
// changed.

test.subHeading('And hearing the same route again costs nothing');

whoBook.learnRoute(root, KNOWN, AT);
whoBook.learnRoute(root, KNOWN, AT);

const row = whoBook.byPublicKey(root, KNOWN);
const times = (row.relays || []).filter(function (u) { return u === AT; }).length;

if (times === 1) {
  test.check('the route is recorded once however often it is announced');
} else {
  test.fail('recorded ' + times + ' times');
}

// A SECOND, DIFFERENT ROUTE IS KEPT, because a peer on two relays is the
// ordinary case for anybody who owns one — and the second route is the
// one that works when the first is down.
whoBook.learnRoute(root, KNOWN, 'https://spirit.example');
const both = whoBook.byPublicKey(root, KNOWN).relays || [];

if (both.length === 2 && both.indexOf('https://spirit.example') !== -1) {
  test.check('and a different one is added beside it: ' + both.length + ' routes held');
} else {
  test.fail('the second route was lost: ' + JSON.stringify(both));
}

// ── 4. AND NOTHING ABOUT IT IS TRAFFIC ───────────────────────────────
//
//   Andy: "the log is mainly for request/reply." / "the log is forever."
//
// An announcement is not correspondence — nobody addressed it to this
// node — and the traffic log is permanent, so route chatter would grow a
// file that never shrinks and leave, on every member's disk, a lasting
// record of what a relay's members have been looking up.
//
// Asserted on the wiring rather than by driving a stream: the handler in
// server.js must reach whoBook and must not reach trafficLog.

test.subHeading('And an announcement never reaches the traffic log');

const wiring = fs.readFileSync(
  path.join(__dirname, '..', 'run', 'js', 'server.js'), 'utf8');
const hook = wiring.slice(wiring.indexOf('onRoute: function'), wiring.indexOf('onOwnerEvent: function'));

if (hook && /whoBook\.learnRoute/.test(hook)) {
  test.check('the handler stashes it');
} else {
  test.fail('the route handler does not reach the book');
}

if (hook && !/trafficLog/.test(hook)) {
  test.check('and writes nothing to the log, exactly as presence does not');
} else {
  test.fail('a route is being logged as traffic');
}

test.reportSuccessFailureCount();
