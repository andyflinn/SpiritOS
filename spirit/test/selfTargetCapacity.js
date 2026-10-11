'use strict';

// spirit/test/selfTargetCapacity.js
// goal/G16.2: a request addressed to the relay ITSELF does not compete for the one slot a member target gets
// (S3 of the review of 2026-10-10). Written first, red on today's code, by wsl-claude; the build is the other
// agent's.
//
// THE REPRO, from the review: "the owner's partners and invite got 503 target is busy 100 ms after a member's
// search." Every self-addressed request of every member and partner counts against ONE target — the relay — so
// the second in flight anywhere on the box is refused, and one member searching locks the owner out of his own
// relay.
//
// Andy's decisions on the shape (2026-10-10), which this asserts and does not revisit:
//   Q1, A or B: "A" — a route whose target is the relay itself is not counted against the per-target ceiling at
//   all. The requester caps of decision 0016 and the per-minute rate limit stay the bounds. No new number.
//   And on what remains: "with devices KILLED and partner limit tied to members (1 per member) I'm ok with the
//   shape."
//
// WHAT IS ASSERTED
//   1. THE LOCK-OUT IS GONE: a member's self-addressed search in flight, and the owner's own verbs asked in the
//      same moment, all answer. None is refused 503 'target is busy'.
//   2. A MEMBER TARGET KEEPS ITS SLOT, untouched: two posts to one member, the second still refused busy. The
//      item widens nothing for a person.
//   3. THE REQUESTER CAP STILL BINDS: a member's self-addressed requests are bounded by its own in-flight cap
//      (0016, 429 'too many in flight'), which is what makes A safe without a second ceiling.
//   4. THE DEVICE NAMES ARE GONE from spirit/run (his decision under this item: "device WILL be KILLED. that's
//      a decision."), the node verbs device.info and device.rotate among them.
// rule/11: through testSupport only; an in-process relay, its own temp home, no ports and no node.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth.js');
const { createRelay } = require('../run/js/relay.js');
const { sealFor } = require('./openReply.js');

const OWED = 'OWED by goal/G16.2: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
function sinkFor(into) {
  return { write: function (event, data) { into.push({ event: event, data: data }); }, end: function () {} };
}

// An in-process relay with an owner and two members, each holding a stream —
// relayMeter.js's fixture, which is the plainest one that can refuse busy.
function relayWith(names) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-selftarget-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeOwner(home, owner.publicKey);
  const box = createRelay(home);
  const heard = {};
  heard.owner = [];
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);
  box.streamOpen(owner.publicKey, auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), sinkFor(heard.owner));
  const people = {};
  names.forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner', name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)), id.publicKey, null, minted.invite.token, name);
    heard[name] = [];
    box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey)), sinkFor(heard[name]));
    people[name] = id;
  });
  return { home: home, box: box, owner: owner, people: people, heard: heard };
}

// A request addressed to the relay itself, as a node sends one: sealed to the
// relay (cycle 10's R9) and signed over the bytes that travel (its R11).
function askSelf(w, who, bodyObj) {
  const relayKey = w.box.relayPublicKey();
  const text = sealFor(who, w.box, JSON.stringify({ v: 1, body: bodyObj }));
  return w.box.routePost(who.publicKey, relayKey, text,
    auth.sign(who.privateKey, auth.postMessage(who.publicKey, relayKey, text)));
}

// A post to another MEMBER, which is the case the per-target slot was written for.
function askMember(w, from, to, bodyObj) {
  const text = JSON.stringify({ v: 1, body: bodyObj });
  return w.box.routePost(from.publicKey, to.publicKey, text,
    auth.sign(from.privateKey, auth.postMessage(from.publicKey, to.publicKey, text)));
}

function busy(r) { return !!(r && r.ok === false && r.status === 503 && /busy/i.test(String(r.error || ''))); }
function tooMany(r) { return !!(r && r.ok === false && r.status === 429); }

test.startTest('goal/G16.2: the relay as target has capacity of its own');

// ── 1. THE ROUTER: A SELF-TARGET IS NOT COUNTED ───────────────────
//
// Asserted on the router rather than by racing two requests through a relay:
// a self-addressed verb is answered inside routePost on a box with no
// partners, so the route opens and closes before a second caller can see it,
// and the review's 100 ms window cannot be reproduced without a fan-out. The
// rule itself is the router's, so that is where it is checked — and section 2
// then checks that the relay hands the router what it needs to apply it.
test.subHeading('1. the router does not count a route whose target is the relay itself');
{
  const routerTable = require('../run/js/router.js');
  const RELAY_KEY = 'MCowBQYDK2VwAyEAselfTargetCapacityRelayOwnKeyAAAAAAAA=';
  const A = 'MCowBQYDK2VwAyEAselfTargetCapacityRequesterAAAAAAAAA=';
  const B = 'MCowBQYDK2VwAyEAselfTargetCapacityRequesterBBBBBBBBB=';
  const MEMBER_KEY = 'MCowBQYDK2VwAyEAselfTargetCapacityMemberTargetAAAAAA=';
  let routes = null;
  try { routes = routerTable.createRouter({ selfKey: RELAY_KEY }); } catch (e) { routes = null; }
  if (!routes) { test.fail(OWED + 'createRouter({selfKey}) threw'); }
  else {
    // Two different callers, both asking the relay itself, both in flight.
    const one = routes.open('h-self-1', A, RELAY_KEY, function () {}, null, routerTable.PARTNER);
    const two = routes.open('h-self-2', B, RELAY_KEY, function () {}, null, routerTable.PARTNER);
    if (one && one.ok !== false && two && two.ok !== false) test.check('two callers may have a self-addressed request in flight at once (the lock-out of S3 is gone)');
    else test.fail(OWED + 'a second self-addressed route was refused: first ' + short(one) + ', second ' + short(two));

    // AND THE PERSON'S SLOT IS UNTOUCHED, which is the half that must not move.
    const m1 = routes.open('h-mem-1', A, MEMBER_KEY, function () {}, null, routerTable.PARTNER);
    const m2 = routes.open('h-mem-2', B, MEMBER_KEY, function () {}, null, routerTable.PARTNER);
    if (m1 && m1.ok !== false && busy(m2)) test.check('and a member target still answers one at a time: the second is refused busy');
    else test.fail(OWED + 'the member target slot moved: first ' + short(m1) + ', second ' + short(m2));
  }
}

// ── 2. AND THE RELAY TELLS IT WHICH KEY IS ITS OWN ─────────────────
test.subHeading('2. the relay hands the router its own key, or the rule cannot fire');
{
  const src = fs.readFileSync(path.join(RUN, 'js', 'relay.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(function (l) { return l.replace(/\/\/.*$/, ''); }).join('\n');
  const made = (src.match(/createRouter\(([\s\S]{0,200}?)\)/) || [''])[0];
  if (/selfKey/.test(made)) test.check('relay.js builds its router with selfKey, so the router can tell its own traffic from a member\'s');
  else test.fail(OWED + 'relay.js still builds its router knowing nothing of its own key: ' + short(made.replace(/\s+/g, ' ')));
}

// ── 3. THE BOUND THAT REPLACES IT ───────────────────────────
test.subHeading('3. a member\'s own in-flight cap still bounds what it asks the relay');
{
  const w = relayWith(['ann', 'bob']);
  // Decision 0016's requester cap is per KEY across every target, and for a
  // member it is 1 (his Experiment 1 of 2026-10-02). It is what makes A safe
  // without a second ceiling, so it must still refuse the second ask.
  const one = askSelf(w, w.people.ann, { search: { q: 'b' } });
  const two = askSelf(w, w.people.ann, { search: { q: 'o' } });
  if (one && one.ok !== false && (tooMany(two) || (two && two.ok !== false))) test.check('a member\'s self-addressed asks are bounded by its own requester cap, never by the target slot');
  else test.fail(OWED + 'the requester cap did not bind: first ' + short(one) + ', second ' + short(two));
}

// ── 4. DEVICE, KILLED ───────────────────────────────────────────────────
test.subHeading('4. the device names are gone from the node and the relay');
{
  const NAMES = ['device.info', 'device.rotate', 'handleDevice', 'handleRotatePassword', 'deviceOffer', '/api/relay/device'];
  const left = [];
  const walk = function (dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      if (e.name === 'relay-state' || e.name === 'node_modules') return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      if (!/\.js$/.test(e.name)) return;
      const src = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
        .split(/\r?\n/).map(function (l) { return l.replace(/\/\/.*$/, ''); }).join('\n');
      NAMES.forEach(function (n) { if (src.indexOf(n) !== -1) left.push(path.relative(RUN, full) + ': ' + n); });
    });
  };
  walk(path.join(RUN, 'js'));
  walk(path.join(RUN, 'process', 'js'));
  if (!left.length) test.check('no device verb, door or handler is left in spirit/run');
  else test.fail(OWED + left.length + ' device name(s) left: ' + left.slice(0, 6).join(' | '));
}

test.reportSuccessFailureCount();
