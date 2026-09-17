'use strict';

// spirit/test/relayMeter.js
// THE FIRST LIMIT ON THE THING THAT MOVES BYTES, AND THE METER BESIDE IT.
//
//   Grok: "put a dumb rateOk on routePost before partner delivery."
//   Andy: "we already have packet delivery, that should be the bootstrap
//   for rate-management, there we get first measurements."
//
// ── WHAT WAS FOUND ───────────────────────────────────────────────────
//
// `rateOk` had exactly two call sites — `claim` and device enrolment.
// `routePost` had none, so nothing counted posts per minute: a member
// could post as fast as they could open sockets, and the node at the far
// end was not covering for it — its floor bounds only senders it has NEVER
// HEARD OF, so between two acquainted peers there was no RATE limit
// anywhere in the system.
//
// NOT THE SAME AS UNBOUNDED, and this suite is what established the
// difference. `routes.open` already caps a requester's OUTSTANDING posts
// — `too many in flight`, 429, at DEFAULT_PER_REQUESTER = 16 — and the
// table caps the box at DEFAULT_MAX = 256. That is the RAM half of
// CAPACITY.md, built and fair, and it is why a naive flood loop here was
// stopped at sixteen by something that has nothing to do with rate.
//
// So the gap is one half, not the whole: a STOCK limit existed and a FLOW
// limit did not.
//
// It read as covered, which is why it lasted: a comment two hundred lines
// above `routePost` describes a 30-per-minute send limit in the present
// tense, and it is about `send`, the ring route R8 deleted.
//
// ── AND THE METER MATTERS MORE THAN THE GATE ─────────────────────────
//
// The limit here is deliberately dumb and temporary — CAPACITY.md's
// governor divides measured headroom and publishes the result, and this
// holds the door until there is something in the ring to divide. What the
// ring buys is that the governor gets built against observation instead of
// against a guess, starting from ordinary member traffic today.
//
// The assertion that matters most is the last one: the ring is AGGREGATE.
// A per-member version would be a record of who talks how much and when —
// what this system refuses to hold — arriving as a performance feature in
// a file nobody thinks of as a ledger.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { createRelay } = require('../run/js/relay');

function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev) return true;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed });
      return true;
    },
    close: function () {},
  };
}

// A relay with an owner and two members, both connected — the ordinary
// arrangement a post travels through.
function relayWithTwo() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-meter-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('owner');
  auth.writeAllowKeys(home, [{ name: 'owner', publicKey: owner.publicKey }]);

  const box = createRelay(home);
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);

  const people = {};
  ['ann', 'bob'].forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner', name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, null, minted.invite.token, name);
    people[name] = id;
    box.streamOpen(id.publicKey,
      auth.sign(id.privateKey, auth.streamMessage(id.publicKey)), sinkFor([]));
  });

  return { home: home, box: box, owner: owner, people: people };
}

function post(box, from, to, body) {
  const text = JSON.stringify({ v: 1, body: body });
  return box.routePost(from.publicKey, to.publicKey, text,
    auth.sign(from.privateKey, auth.postMessage(from.publicKey, to.publicKey, text)));
}

test.startTest('Posting has a limit, and the relay measures what it moved');

const R = relayWithTwo();

// ── 1. THE GATE ──────────────────────────────────────────────────────

test.subHeading('A post is rate limited, and the refusal says by how much');

const first = post(R.box, R.people.ann, R.people.bob, { hello: 1 });
if (first.ok && first.status === 202) {
  test.check('an ordinary post goes through — 202 with a hash');
} else {
  test.fail('the first post was refused: ' + JSON.stringify(first));
}

// ── A FLOOD THAT IS NOT ALSO A PILE-UP ───────────────────────────────
//
// THE STOCK LIMIT FIRES FIRST IF YOU LET IT, and finding that out is what
// this suite was worth writing for. `routes.open` already refuses a
// requester with too many posts OUTSTANDING — `too many in flight`, 429,
// per requester, at `DEFAULT_PER_REQUESTER` — so a loop that never lets
// anybody answer is stopped at sixteen by a cap that has nothing to do
// with rate.
//
// That is the RAM half of CAPACITY.md, already built and already fair.
// What is missing is the FLOW half: nothing counts posts per minute. So
// the target answers each one, the route closes, and the in-flight count
// stays at zero — which is what a real conversation looks like and what
// leaves the rate limit as the only thing that can stop this.
function answered(n) {
  const r = post(R.box, R.people.ann, R.people.bob, { n: n });
  if (!r.ok) return r;
  R.box.routeReply(R.people.bob.publicKey, r.hash, 'ok',
    auth.sign(R.people.bob.privateKey, auth.receiptMessage(r.hash)));
  return r;
}

let refused = null;
let sent = 1;
for (let i = 0; i < 2000 && !refused; i += 1) {
  const r = answered(i);
  if (r.ok) { sent += 1; continue; }
  if (r.status === 429 && typeof r.perMin === 'number') refused = r;
  else { test.fail('refused at ' + i + ' by something else: ' + JSON.stringify(r)); break; }
}

if (refused) {
  test.check('a flood is stopped, after ' + sent + ' in the window');
} else {
  test.fail('2000 posts and never a 429 — routePost is unlimited');
}

// NAMED, WHICH IS THE ONE THING THIS ROUTE SAYS PRECISELY. Everything
// else it refuses gets a word that tells an attacker nothing; a rate
// limit is temporary, and a client that knows the cap waits rather than
// gives up or hammers.
if (refused && /\d/.test(String(refused.error)) && typeof refused.perMin === 'number') {
  test.check('and the refusal names the cap: "' + refused.error + '"');
} else {
  test.fail('the 429 does not name a number: ' + JSON.stringify(refused));
}

// ── AND IT IS KEYED ON THE SENDER, NOT ON THE SENDER'S CHOICE ────────
//
// The old per-name limit was worthless for exactly this reason: a budget
// keyed on a string the sender picks resets when they pick another. bob
// has spent nothing and must be unaffected by ann's flood.
const bobsTurn = post(R.box, R.people.bob, R.people.ann, { hello: 1 });
if (bobsTurn.ok) {
  test.check('and it is per sender — one member flooding does not spend another’s budget');
} else {
  test.fail('bob was refused for ann’s traffic: ' + JSON.stringify(bobsTurn));
}

// ── 2. THE METER ─────────────────────────────────────────────────────

test.subHeading('And the relay can say what it moved, not only what it holds');

const report = (function () {
  const bag = [];
  R.box.streamOpen(R.owner.publicKey,
    auth.sign(R.owner.privateKey, auth.streamMessage(R.owner.publicKey)), sinkFor(bag));
  const said = bag.filter(function (m) { return m.event === 'relay-status'; });
  return said.length ? said[said.length - 1].data : null;
})();

if (report && report.meter) {
  test.check('the owner’s report carries a meter beside routes and memory');
} else {
  test.fail('no meter in the report: ' + JSON.stringify(report && Object.keys(report)));
}

// BYTES AND POSTS, which is the flow — `routes` and `memory` are both
// stocks and neither says anything about throughput.
if (report && report.meter && report.meter.posts >= sent && report.meter.bytes > 0) {
  test.check('and it counted the traffic: ' + report.meter.posts + ' posts, ' +
    report.meter.bytes + ' bytes');
} else {
  test.fail('meter did not count: ' + JSON.stringify(report && report.meter));
}

// THE RAM METER BESIDE THE BANDWIDTH ONE. Andy: "one governor, multiple
// meters" — so the report carries more than one reading and the governor
// takes an open bag rather than a fixed pair.
if (report && report.meter && typeof report.meter.peakRoutes === 'number' &&
    typeof report.meter.bytesPerSec === 'number') {
  test.check('with a second reading beside it — peak routes, and bytes a second');
} else {
  test.fail('only one meter: ' + JSON.stringify(report && report.meter));
}

// ── 3. AGGREGATE, AND THIS IS THE ONE THAT MATTERS ───────────────────
//
// The precedent is the route-usage note in PARTNERS.md: "in memory is the
// whole point: it resets on restart, it is never served, and it describes
// the relay's own work rather than anybody's traffic. A counter that
// survived a reboot would be a record of who talks to whom, which is
// precisely what this system does not keep."
//
// So: no key of any member may appear anywhere in the meter. Asserted
// against the actual keys rather than against a field name, because the
// way this rule gets broken is somebody adding `byPeer` for a dashboard.

test.subHeading('And it is aggregate — never a record of who talks how much');

const printed = JSON.stringify(report && report.meter);
const leaked = ['ann', 'bob'].filter(function (name) {
  return printed.indexOf(R.people[name].publicKey) !== -1;
});

if (!leaked.length) {
  test.check('no member key is anywhere in the meter');
} else {
  test.fail('the meter names ' + leaked.join(', '));
}

// AND THE RING IS BOUNDED, because the resource it reports on is the one
// it spends. A ring that grew under load would be the instrument
// consuming what it was built to measure.
const src = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'relay.js'), 'utf8');
if (/METER_SLOTS\s*=\s*\d+/.test(src) && /slots\.length > METER_SLOTS/.test(src)) {
  test.check('and the ring is a fixed size, overwriting rather than growing');
} else {
  test.fail('the meter ring has no bound');
}

// ── 4. AND A POST TO THE BOX IS A POST ───────────────────────────────
//
//   Andy: "the relay-to-relay hop is just normal protocol-compliant
//   traffic, like all other traffic... measurable, throttleable."
//
// THIS IS THE SPECIAL CASE THAT ARRIVED BY ACCIDENT. The gate sat below
// the `postedToSelf` branch for an hour, so a partner's search and a
// member's verb both took the early return and were neither counted nor
// capped — a relay metering packets to its members but not packets to
// itself, which is measuring the half of its work that is easiest to see.
//
// Asserted through the front door rather than by reading the source: a
// verb addressed to the relay's own key must move both numbers.

test.subHeading('A post addressed to the relay counts like any other');

const beforeSelf = report.meter.posts;

const relayKey = R.box.relayPublicKey();
const selfText = JSON.stringify({ v: 1, body: { search: { q: 'a' } } });
const asked = R.box.routePost(R.people.bob.publicKey, relayKey, selfText,
  auth.sign(R.people.bob.privateKey,
    auth.postMessage(R.people.bob.publicKey, relayKey, selfText)));

if (asked && asked.ok) {
  test.check('a member may ask the relay a verb — that still works');
} else {
  test.fail('the verb was refused: ' + JSON.stringify(asked));
}

const after = (function () {
  const bag = [];
  R.box.streamOpen(R.owner.publicKey,
    auth.sign(R.owner.privateKey, auth.streamMessage(R.owner.publicKey)), sinkFor(bag));
  const said = bag.filter(function (m) { return m.event === 'relay-status'; });
  return said.length ? said[said.length - 1].data : null;
})();

if (after && after.meter && after.meter.posts > beforeSelf) {
  test.check('and it is in the meter, like a post to a member');
} else {
  test.fail('a post to the box was not counted: ' +
    beforeSelf + ' -> ' + JSON.stringify(after && after.meter));
}

// AND CAPPED BY THE SAME BUCKET. ann spent her minute on the flood above,
// so her verb to the relay must be refused by the rate limit rather than
// waved through on the grounds that the relay is not a member.
const annAsks = R.box.routePost(R.people.ann.publicKey, relayKey, selfText,
  auth.sign(R.people.ann.privateKey,
    auth.postMessage(R.people.ann.publicKey, relayKey, selfText)));

if (annAsks && annAsks.status === 429) {
  test.check('and a sender out of budget cannot address the box either');
} else {
  test.fail('the relay let a spent sender in by the side door: ' + JSON.stringify(annAsks));
}

// ── 5. TWO BUDGETS ───────────────────────────────────────────────────
//
//   Andy: "the budget for posts from partners must be a different POST
//   budget from members… I need to tax the members to keep my partners
//   operational."
//   Grok: "split the rate-meter bucket into the two budgets before merge."
//
// A forward from a partner is one of THIS box's members being reached, so
// the partner pool is infrastructure for member reach rather than an
// allowance to a stranger. Kept separate so that a partner having a bad
// day degrades reach without starving the members who paid for it — and
// so that this box never has to ask WHO at the far end sent anything.
// **The pool is the isolation.** That is what replaced Grok's per-member
// buckets, which he withdrew.

test.subHeading('A partner spends a different budget from a member');

// Two buckets and two numbers, not one of each. Asserted on the source
// because the alternative is driving a partner to exhaustion through a
// fixture, and what matters is that the pools cannot be the same object.
if (/var memberHits = Object\.create\(null\);/.test(src) &&
    /var partnerHits = Object\.create\(null\);/.test(src) &&
    /MEMBER_PER_MIN/.test(src) && /PARTNER_FLOOR_PER_MIN/.test(src)) {
  test.check('two buckets and two caps — a partner cannot spend a member’s budget');
} else {
  test.fail('the pools are not separate');
}

// AND THE REFUSAL SAYS WHICH POOL. An owner reading a 429 has to be able
// to tell "my members are busy" from "a partner is hammering me", because
// the two have different answers.
if (/pool: fromPartner \? 'partner' : 'member'/.test(src)) {
  test.check('and a refusal names the pool it came from');
} else {
  test.fail('the 429 does not say which budget was spent');
}

// ── IDLE MEANS FLOOR, NEVER ZERO ─────────────────────────────────────
//
//   Grok: "idle -> floor, not zero."
//
// A pool of zero is a bootstrap deadlock: an unused partnership could
// never carry the first packet that would make it used, so the observed
// fraction could never rise, so the pool would stay zero for ever. The
// floor is what lets a cold partnership warm up.
if (/PARTNER_FLOOR_PER_MIN = (\d+)/.test(src) &&
    Number(/PARTNER_FLOOR_PER_MIN = (\d+)/.exec(src)[1]) > 0) {
  test.check('and an idle partner pool is its floor, never zero — or nothing could ever start');
} else {
  test.fail('the partner floor is zero or missing');
}

// ── 6. THE FRACTION IS MEASURED, AS A COUNT ──────────────────────────
//
//   Grok: "floor in work, then observedPartnerFraction × total."
//
// The formula needs an observation this box did not previously make. It
// is two integers per slot — posts, and how many of them crossed a
// partnership — so the share is knowable without holding anything about
// who did it. Measuring is this file's job; dividing by it is the
// governor's, and the pool answers its floor until then.

test.subHeading('And the relay measures the share of its work that crossed a partnership');

const fresh = (function () {
  const bag = [];
  R.box.streamOpen(R.owner.publicKey,
    auth.sign(R.owner.privateKey, auth.streamMessage(R.owner.publicKey)), sinkFor(bag));
  const said = bag.filter(function (m) { return m.event === 'relay-status'; });
  return said.length ? said[said.length - 1].data : null;
})();

if (fresh && fresh.meter && typeof fresh.meter.partnerFraction === 'number') {
  test.check('the report carries the partner fraction the formula is waiting for');
} else {
  test.fail('no partnerFraction: ' + JSON.stringify(fresh && fresh.meter));
}

// ZERO HERE, and that is the answer rather than a gap: this fixture has
// no partners, so none of its work crossed one. A relay with no partners
// is the common case and is exactly when the floor matters.
if (fresh && fresh.meter && fresh.meter.partnerFraction === 0 &&
    fresh.meter.partnerPosts === 0) {
  test.check('and it is zero on a box with no partners — which is why the pool has a floor');
} else {
  test.fail('fraction should be zero here: ' + JSON.stringify(fresh && fresh.meter));
}

// ── AND THE CAPS ARE PUBLISHED, NOT SILENT ───────────────────────────
//
//   Grok: "starting cap is published (and named on 429), not a silent
//   backstop."
//
// To the owner here, which is the party with a channel for it today.
// Members get the governor's announcement, capped at two minutes and not
// built; partners are told on the reply and need no announcement at all.
if (fresh && fresh.caps && fresh.caps.memberPerMin > 0 && fresh.caps.partnerPerMin > 0) {
  test.check('both caps travel with the report: member ' + fresh.caps.memberPerMin +
    ', partner ' + fresh.caps.partnerPerMin);
} else {
  test.fail('caps are not published: ' + JSON.stringify(fresh && fresh.caps));
}

// ── 7. THE RING HAS A FLOOR, IN BOTH DIRECTIONS ──────────────────────
//
//   Grok: "measurement ring has a floor in slots and in time span; never
//   slower than 5s samples."
//
// The governor shrinks its own instrumentation under memory pressure,
// which degrades measurement exactly when decisions are hardest. Both
// bounds are needed and neither implies the other: ten slots of sixty
// seconds is ten minutes of mush; ten slots of one second is ten seconds
// of detail. Neither is usable.

test.subHeading('And the ring cannot be shrunk into uselessness');

const floor = R.box.meterFloor ? R.box.meterFloor(1, 3600) : null;

if (floor) {
  test.check('the relay exposes one place to ask what the ring may shrink to');
} else {
  test.fail('meterFloor is not reachable — the governor would have three constants to respect');
}

if (floor && floor.sampleS <= 5) {
  test.check('a sample is never coarser than 5s — past that a burst is invisible');
} else {
  test.fail('sample floor: ' + JSON.stringify(floor));
}

// THE SPAN FLOOR CAN FORCE SLOTS BACK. Asking for one slot at a coarse
// sample must still cover the minimum window, which is what stops
// "smaller and slower" becoming "blind".
if (floor && floor.slots * floor.sampleS >= 120) {
  test.check('and the span floor holds even when the slot count was asked to be tiny: ' +
    floor.slots + ' × ' + floor.sampleS + 's');
} else {
  test.fail('span floor not enforced: ' + JSON.stringify(floor));
}

// -- 8. SLOTS BOUND ROWS; BYTES ARE BOUNDED AT SERIALISATION ----------
//
//   Andy: "the relay-side search function should still collect the same
//   amount of slots, but measure and truncate before returning results."
//   Andy: "bucket.serialize should take a byte maximum."
//
// SLOTS COUNT THE WRONG THING, and used to get away with it: a search row
// was a fixed handful of short fields, so 32 of them always fitted on the
// wire. `vias` ended that -- a peer bound to nineteen partners carries
// nineteen relay keys, and 32 such rows is ~26 KB against a PAYLOAD_MAX
// of 16384.
//
// AND THE CUT IS NOT THE RELAY'S. It lives with the ordering, because
// deciding how far down a ranked list to read is a question about the
// ranking -- and because a row's size is only known after `merge` has
// finished adding sources to it. The relay supplies the one number it
// knows: what fits in the envelope it is about to send.

test.subHeading('A search answer is cut to what the wire holds');

const peerSearch = require('../run/js/peerSearch.js');

// Twenty peers on each of two partners, all matching, each therefore
// carrying a long `vias` list -- the shape a busy mesh produces and the
// one that overflows.
const wideSources = [0, 1].map(function (src) {
  const rows = [];
  for (let i = 0; i < 20; i += 1) {
    rows.push({
      publicKey: 'MCowBQYDK2VwAyEA' + String(i).padStart(4, '0') + 'x'.repeat(28) + '=',
      publicLabel: 'wide' + String(i).padStart(2, '0'),
      claimedAt: '2026-09-17T08:08:18.051Z',
      owner: false,
      present: true,
    });
  }
  return { via: 'MCowBQYDK2VwAyEA' + String(src).padStart(4, '0') + 'y'.repeat(28) + '=', rows: rows };
});

const budget = R.box.matchBudget();

if (typeof budget === 'number' && budget > 0 && budget < 16384) {
  test.check('the relay publishes the envelope it can fill: ' + budget + ' bytes');
} else {
  test.fail('no match budget: ' + JSON.stringify(budget));
}

// UNCAPPED FIRST, to prove the shape really does overflow. A fixture that
// fits proves nothing about a cut.
const loose = peerSearch.merge(wideSources, 'wide', 40);
const looseBytes = JSON.stringify(loose.matches).length;

const capped = peerSearch.merge(wideSources, 'wide', 40, 900);
const cappedBytes = JSON.stringify(capped.matches).length;

if (looseBytes > 900) {
  test.check('the shape overflows a small ceiling: ' + looseBytes + ' bytes for ' +
    loose.matches.length + ' rows');
} else {
  test.fail('the fixture does not overflow, so it proves nothing: ' + looseBytes);
}

if (cappedBytes <= 900 && capped.matches.length < loose.matches.length) {
  test.check('and the ceiling cuts it: ' + capped.matches.length + ' rows, ' +
    cappedBytes + ' bytes');
} else {
  test.fail('the ceiling did not bind: ' + cappedBytes + ' bytes, ' +
    capped.matches.length + ' rows');
}

// TRUNCATION IS SAID OUT LOUD. A caller that does not know it was cut
// believes it has seen everything, which is the failure `more` exists to
// prevent.
if (capped.more === true) {
  test.check('and `more` says so, so a caller asks a narrower question');
} else {
  test.fail('the answer was cut silently');
}

// AND THE ONES THAT GO ARE THE ONES RANKED LOWEST. The rank decided the
// order; the ceiling only decides where to stop reading it.
if (capped.matches[0] && loose.matches[0] &&
    capped.matches[0].publicKey === loose.matches[0].publicKey) {
  test.check('and the best-ranked row is still first -- the cut takes from the bottom');
} else {
  test.fail('truncation disturbed the order');
}

// THE ROUTES SURVIVE THE CUT. Every one of these peers was offered by both
// sources, so each surviving row must still name both -- the ceiling
// removes rows, never the routing information on the rows it keeps.
const both = capped.matches.filter(function (r) { return r.vias && r.vias.length === 2; });

if (both.length === capped.matches.length) {
  test.check('and every surviving row still names both relays that hold it');
} else {
  test.fail(both.length + ' of ' + capped.matches.length + ' kept their routes');
}

test.reportSuccessFailureCount();
