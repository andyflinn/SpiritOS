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

test.reportSuccessFailureCount();
