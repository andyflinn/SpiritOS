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
const contactBook = require('../run/js/contacts');

function freshRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-routestash-'));
}

const KNOWN = 'MCowBQYDK2VwAyEA' + 'k'.repeat(27) + '=';
const STRANGER = 'MCowBQYDK2VwAyEA' + 's'.repeat(27) + '=';
// A RELAY KEY, not a URL (cycle 2): the relay announces `at` as the
// partner's key, and it lands in `routes`, which holds keys only.
const AT = 'MCowBQYDK2VwAyEA' + 'r'.repeat(27) + '=';
const AT2 = 'MCowBQYDK2VwAyEA' + 'q'.repeat(27) + '=';

test.startTest('A proven route lands on a row that already exists');

// ── 1. SOMEBODY IN THE BOOK ──────────────────────────────────────────

test.subHeading('A route for a contact is written on their row');

const root = freshRoot();
contactBook.acquire(root, { publicKey: KNOWN, publicLabel: 'known' }, 'handle');
const before = contactBook.load(root).length;

const updated = contactBook.learnRoute(root, KNOWN, AT);

if (updated && (updated.routes || []).indexOf(AT) !== -1) {
  test.check('the route lands on the row, beside any already there');
} else {
  test.fail('not stashed: ' + JSON.stringify(updated));
}

// AND NOT IN `relays`, which holds URLs. It used to land there, mixing
// keys and URLs in one list so neither could be relied on (cycle 2).
if (updated && (updated.relays || []).indexOf(AT) === -1) {
  test.check('and not in `relays` — keys and URLs are kept apart');
} else {
  test.fail('the route key was written into relays[]');
}

// IT SURVIVES A RELOAD, because the point of learning a route is not
// having to learn it again — and because a relay that reboots is
// re-primed by its members, which only works if the members kept it.
const reloaded = contactBook.byPublicKey(root, KNOWN);
if (reloaded && (reloaded.routes || []).indexOf(AT) !== -1) {
  test.check('and it is on disk, which is what re-primes a relay that restarted');
} else {
  test.fail('the route did not persist');
}

// ── 2. SOMEBODY WHO IS NOT ───────────────────────────────────────────

test.subHeading('And a route for a stranger is dropped, never added');

const ignored = contactBook.learnRoute(root, STRANGER, AT);

if (ignored === null) {
  test.check('an announcement about somebody unknown changes nothing');
} else {
  test.fail('a stranger was written into the book: ' + JSON.stringify(ignored));
}

if (contactBook.load(root).length === before) {
  test.check('and the book is exactly as long as it was — a relay cannot fill it');
} else {
  test.fail('the book grew from ' + before + ' to ' + contactBook.load(root).length);
}

// AND NOT AS A CENSUS ROW EITHER. `handshake` exists to write a bare row
// from a census this node read for itself; an announcement must not take
// that path, because reading a census is this node's own act and hearing
// an announcement is somebody else's.
if (!contactBook.byPublicKey(root, STRANGER)) {
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

contactBook.learnRoute(root, KNOWN, AT);
contactBook.learnRoute(root, KNOWN, AT);

const row = contactBook.byPublicKey(root, KNOWN);
const times = (row.routes || []).filter(function (u) { return u === AT; }).length;

if (times === 1) {
  test.check('the route is recorded once however often it is announced');
} else {
  test.fail('recorded ' + times + ' times');
}

// A SECOND, DIFFERENT ROUTE IS KEPT, because a peer on two relays is the
// ordinary case for anybody who owns one — and the second route is the
// one that works when the first is down.
contactBook.learnRoute(root, KNOWN, AT2);
const both = contactBook.byPublicKey(root, KNOWN).routes || [];

if (both.length === 2 && both[0] === AT2 && both[1] === AT) {
  test.check('and a different one is added in front of it, newest first: ' + both.length + ' routes held');
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
// server.js must reach contactBook and must not reach trafficLog.

test.subHeading('And an announcement never reaches the traffic log');

const wiring = fs.readFileSync(
  path.join(__dirname, '..', 'run', 'js', 'server.js'), 'utf8');
const hook = wiring.slice(wiring.indexOf('onRoute: function'), wiring.indexOf('onOwnerEvent: function'));

if (hook && /contactBook\.learnRoute/.test(hook)) {
  test.check('the handler stashes it');
} else {
  test.fail('the route handler does not reach the book');
}

if (hook && !/trafficLog/.test(hook)) {
  test.check('and writes nothing to the log, exactly as presence does not');
} else {
  test.fail('a route is being logged as traffic');
}

test.subHeading('A stranger who writes is added WITH the road they came in on');

{
  //   Andy: "the node must implicitly learn routes at EVERY opportunity."
  //
  // `remember` is the auto-add: somebody this node does not hold writes
  // to it, the front door says admit or hold, and a row appears. It had
  // the road all along — the relay the packet arrived through — and kept
  // only the URL, in `relays`. `routes` holds relay KEYS and is what a
  // post sends as hints, so the first reply to a new correspondent went
  // out with nothing to route by.
  const hub = require('../run/js/hub');
  const relayKeys = require('../run/js/relayKeys');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-remember-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });

  const ROAD = 'https://relay.example';
  const ROAD_KEY = 'RELAY-KEY-PINNED';
  relayKeys.accept(home, ROAD, ROAD_KEY);

  const WRITER = 'KEY-SOMEBODY-NEW';
  hub.remember(home, WRITER, 'admit', ROAD);

  const row = contactBook.byPublicKey(home, WRITER);
  if (row && Array.isArray(row.routes) && row.routes.indexOf(ROAD_KEY) !== -1) {
    test.check('the relay they arrived through is on their row as a route, not only as a url');
  } else {
    test.fail('no route for a new correspondent: ' + JSON.stringify(row));
  }

  // AND WHAT A SEARCH SAID BEATS THE ROAD, because it is about the PERSON
  // rather than about one packet: a search answer says where they live,
  // while the road says only which relay carried this one.
  const OTHER = 'KEY-SEARCHED';
  hub.seenPeers.note(OTHER, { at: 'RELAY-WHERE-THEY-LIVE', url: 'https://elsewhere.example' });
  hub.remember(home, OTHER, 'admit', ROAD);
  const searched = contactBook.byPublicKey(home, OTHER);
  if (searched && (searched.routes || []).indexOf('RELAY-WHERE-THEY-LIVE') !== -1) {
    test.check('and a route a search already found is preferred over the road one packet took');
  } else {
    test.fail('the cache was not consulted: ' + JSON.stringify(searched));
  }
}

test.subHeading('Every way in leaves a route, which is the whole claim');

{
  //   Andy: "Any peer a node could possibly connect to, the route to it
  //   can be known to the node."
  //
  // The paths a node learns of somebody: a search (cached), a packet
  // arriving (cached at arrival, whatever the door decides), a route
  // announcement (cached), a relay of its own naming them (presence
  // reaches them, and the first exchange announces the route) — and an
  // INVITE OR A PASTED KEY, which had none of those and was the one that
  // broke the claim. The caller names a relay to acquire from, and this
  // node pinned that relay's key when it accepted it.
  const hub = require('../run/js/hub');
  const relayKeys = require('../run/js/relayKeys');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-invite-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });

  const URL = 'https://named.example';
  const KEY = 'RELAY-NAMED-KEY';
  relayKeys.accept(home, URL, KEY);

  // No cache entry at all — nobody searched for this person, nobody wrote
  // in. Only a key and the relay it was offered from.
  const PASTED = 'KEY-PASTED-BY-HAND';
  hub.seenPeers.forget(PASTED);
  contactBook.acquire(home, { publicKey: PASTED, publicLabel: '', relay: URL }, 'handle');
  const at = relayKeys.pinned(home, URL);
  if (at) contactBook.learnRoute(home, PASTED, at);

  const row = contactBook.byPublicKey(home, PASTED);
  if (row && (row.routes || []).indexOf(KEY) !== -1) {
    test.check('a key pasted with a relay leaves a route, from the key this node pinned for it');
  } else {
    test.fail('a pasted key produced a contact nobody can route to: ' + JSON.stringify(row));
  }
}

test.reportSuccessFailureCount();
