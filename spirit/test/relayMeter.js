'use strict';

// spirit/test/relayMeter.js
// THE FIRST LIMIT ON THE THING THAT MOVES BYTES, AND THE METER BESIDE IT.
//
//   Grok: "put a dumb rateOk on routePost before partner delivery."
//   Andy: "we already have packet delivery, that should be the bootstrap
//   for rate-management, there we get first measurements."
//
// ── A FLOW LIMIT BESIDE THE STOCK LIMIT ──────────────────────────────
//
// `routePost` counts posts per minute per sender (relay.js rateOk,
// MEMBER_PER_MIN), and refuses past it with a 429 that names the cap.
// That is the FLOW limit. The STOCK limit is router.js's: `routes.open`
// caps a member's OUTSTANDING posts at DEFAULT_PER_MEMBER = 1 (0016, "one
// in flight per member as requester") and the box at DEFAULT_MAX = 256 —
// the RAM half of CAPACITY.md. An unanswered post is the member's whole
// stock, so every post below is answered, and only the rate limit can
// stop the flood.
//
// ── AND THE METER MATTERS MORE THAN THE GATE ─────────────────────────
//
// The limit here is deliberately dumb — CAPACITY.md's governor divides
// measured headroom and publishes the result. What the ring buys is that
// the governor gets built against observation instead of against a guess,
// starting from ordinary member traffic.
//
// The assertion that matters most is the last one: the ring is AGGREGATE.
// A per-member version would be a record of who talks how much and when —
// what this system refuses to hold — arriving as a performance feature in
// a file nobody thinks of as a ledger.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth');
const { createRelay } = require('../run/spirit/relay');

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
  fs.mkdirSync(path.join(home, 'spirit', 'state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('owner');
  auth.writeOwner(home, owner.publicKey);

  const box = createRelay(home);
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);

  const people = {};
  ['ann', 'bob'].forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner', name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, null, minted.invite.token, name);
    people[name] = id;
    box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey, box.relayPublicKey())), sinkFor([]));
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

// AND IT IS ANSWERED: a member holds one route at a time (0016), so an
// open route to bob would refuse the first post of the flood below and
// read as the rate limit missing.
if (first.ok) {
  R.box.routeReply(R.people.bob.publicKey, first.hash, 'ok',
    auth.sign(R.people.bob.privateKey, auth.receiptMessage(first.hash, 'ok')));
}

// ── A FLOOD THAT IS NOT ALSO A PILE-UP ───────────────────────────────
//
// THE STOCK LIMIT FIRES FIRST IF YOU LET IT: `routes.open` refuses a
// requester with too many posts OUTSTANDING — `too many in flight`, 429,
// at `DEFAULT_PER_REQUESTER` — so a loop that never lets anybody answer is
// stopped by a cap that has nothing to do with rate. So the target answers
// each one, the route closes, and the in-flight count stays at zero —
// which is what a real conversation looks like and what leaves the rate
// limit as the only thing that can stop this.
function answered(n) {
  const r = post(R.box, R.people.ann, R.people.bob, { n: n });
  if (!r.ok) return r;
  R.box.routeReply(R.people.bob.publicKey, r.hash, 'ok',
    auth.sign(R.people.bob.privateKey, auth.receiptMessage(r.hash, 'ok')));
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
// A budget keyed on a string the sender picks would reset when they pick
// another. bob
// has spent nothing and must be unaffected by ann's flood.
const bobsTurn = post(R.box, R.people.bob, R.people.ann, { hello: 1 });
// ANN ANSWERS IT, which releases bob's route: a member has one request in
// flight (0016, router.js DEFAULT_PER_MEMBER), and bob asks the
// relay a verb further down. Left unanswered, this post would still be his.
if (bobsTurn.ok) {
  R.box.routeReply(R.people.ann.publicKey, bobsTurn.hash, 'ok',
    auth.sign(R.people.ann.privateKey, auth.receiptMessage(bobsTurn.hash, 'ok')));
}
if (bobsTurn.ok) {
  test.check('and it is per sender — one member flooding does not spend another’s budget');
} else {
  test.fail('bob was refused for ann’s traffic: ' + JSON.stringify(bobsTurn));
}

// ── 2. THE METER ─────────────────────────────────────────────────────

test.subHeading('And the relay can say what it moved, not only what it holds');

const report = (function () {
  const bag = [];
  R.box.streamOpen(R.owner.publicKey, auth.sign(R.owner.privateKey, auth.streamMessage(R.owner.publicKey, R.box.relayPublicKey())), sinkFor(bag));
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
// The precedent is the route-usage note in design/relay/PARTNERS.md: "in memory is the
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
const src = fs.readFileSync(path.join(__dirname, '..', 'run', 'spirit', 'relay.js'), 'utf8');
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
// The gate sits above the `postedToSelf` branch, so a verb addressed to
// the relay is counted and capped like a post to a member.
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
  R.box.streamOpen(R.owner.publicKey, auth.sign(R.owner.privateKey, auth.streamMessage(R.owner.publicKey, R.box.relayPublicKey())), sinkFor(bag));
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

// ── 5. ONE BUDGET (goal/G22.6) ───────────────────────────────────────
//
// "the partner roll and the partner budget are removed" (Andy's decision,
// goal/G22.6): a stranger is held by the relay's address table, so the
// posts a member sends are the one budget.

test.subHeading('One budget, the members\'; the partner pool is gone');

if (/var memberHits = Object\.create\(null\);/.test(src) && /MEMBER_PER_MIN/.test(src) &&
    !/partnerHits|PARTNER_FLOOR_PER_MIN|partnerPerMin|partnerFraction/.test(src)) {
  test.check('one bucket and one cap — no partner pool, floor or fraction left in relay.js');
} else {
  test.fail('relay.js still keeps a partner budget');
}

const fresh = (function () {
  const bag = [];
  R.box.streamOpen(R.owner.publicKey, auth.sign(R.owner.privateKey, auth.streamMessage(R.owner.publicKey, R.box.relayPublicKey())), sinkFor(bag));
  const said = bag.filter(function (m) { return m.event === 'relay-status'; });
  return said.length ? said[said.length - 1].data : null;
})();

if (fresh && fresh.meter && typeof fresh.meter.posts === 'number' && !('partnerFraction' in fresh.meter) &&
    !('partnerPosts' in fresh.meter)) {
  test.check('the report\'s meter counts posts, and no longer a partner share');
} else {
  test.fail('meter: ' + JSON.stringify(fresh && fresh.meter));
}

// ── AND THE CAP IS PUBLISHED, NOT SILENT ─────────────────────────────
//
//   Grok: "starting cap is published (and named on 429), not a silent
//   backstop."
//
// To the owner, in the relay-status report.
if (fresh && fresh.caps && fresh.caps.memberPerMin > 0 && !('partnerPerMin' in fresh.caps)) {
  test.check('the cap travels with the report: member ' + fresh.caps.memberPerMin);
} else {
  test.fail('caps are not published as one: ' + JSON.stringify(fresh && fresh.caps));
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
// SLOTS COUNT ROWS, NOT BYTES, so a full set of slots can still overflow
// the envelope.
//
// The ranker (peerRank) keeps its slots; the relay's composeSearch
// measures the ranked rows against MATCH_BUDGET, the one number it knows
// (what fits in the envelope it is about to send), and cuts from the
// bottom.

test.subHeading('A search answer is cut to what the wire holds');

// THE RANKING IS peerRank's (goal/G29.17), on the probability modules. The ranker decides which rows and in what
// order; the relay alone knows the envelope, and cuts from the bottom of that order.
const peerRank = require('../run/spirit/peerRank.js');
const relaySrc = fs.readFileSync(path.join(__dirname, '..', 'run', 'spirit', 'relay.js'), 'utf8');

const budget = R.box.matchBudget();

if (typeof budget === 'number' && budget > 0 && budget < 16384) {
  test.check('the relay publishes the envelope it can fill: ' + budget + ' bytes');
} else {
  test.fail('no match budget: ' + JSON.stringify(budget));
}

const wide = [];
for (let i = 0; i < 40; i += 1) {
  wide.push({ publicKey: 'MCowBQYDK2VwAyEA' + String(i).padStart(4, '0') + 'x'.repeat(28) + '=', publicLabel: 'wide' + String(i).padStart(2, '0'), claimedAt: '2026-09-17T08:08:18.051Z' });
}
const ranked = peerRank.rank(wide, 'wide', peerRank.SLOTS);
if (ranked.rows.length === peerRank.SLOTS && ranked.more === true) test.check('peerRank keeps its ' + peerRank.SLOTS + ' slots of 40 matching rows and says more');
else test.fail('peerRank answered ' + ranked.rows.length + ' rows, more ' + ranked.more);
// The cut from the bottom: composeSearch measures the ranked rows one by one against MATCH_BUDGET and says when it cut.
if (/JSON\.stringify\(tryRow\)\.length > MATCH_BUDGET\) \{ localCut = true; break; \}/.test(relaySrc)) test.check('and the relay cuts the ranked rows from the bottom at its envelope, saying so');
else test.fail('the relay no longer cuts its answer at MATCH_BUDGET');

test.reportSuccessFailureCount();
