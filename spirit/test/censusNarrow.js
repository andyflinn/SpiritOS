'use strict';

// spirit/test/censusNarrow.js
// THE CENSUS ANSWERS ABOUT KEYS SOMEBODY NAMED.
//
//   Andy: "the most fetched because it bootstrapped concepts quickly, but
//   is not scalable."
//   Andy: "so... are we ready to replace fetchCensus at at least one spot?"
//
// `GET /api/relay/who` is read by nine callers and six of them want one
// row. `peer.acquire` was the sharpest: it pulled the whole census —
// 151 bytes a member, ~147 KB at a thousand — to answer yes or no about
// ONE key.
//
// ── SAME DOOR, NARROWER ANSWER ───────────────────────────────────────
//
// Not a new route, so nothing is added to 0010's register: a parameter
// that filters an existing response is not a new way of speaking. And
// `key` on a query is explicitly allowed there — "it is the identity
// being asked for, not the permission to be it" — which is the
// distinction that keeps signatures off query strings and lets this
// through.
//
// THE OLD FORM IS UNTOUCHED, and has to be: the census is what a node
// reads *before it has anything* (0010), so bootstrap has no key to ask
// about yet. A relay that has not been updated ignores the parameter and
// answers as it always did, and the caller still works — which is the
// only reason one caller can migrate at a time.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { createRelay } = require('../run/js/relay');

function relayOf(names) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-narrow-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('owner');
  auth.writeAllowKeys(home, [{ name: 'owner', publicKey: owner.publicKey }]);

  const box = createRelay(home);
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);

  const people = {};
  names.forEach(function (name, i) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner', name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, 'client-' + i, minted.invite.token, name);
    people[name] = id;
  });
  return { box: box, owner: owner, people: people };
}

test.startTest('The census answers about keys somebody named');

const R = relayOf(['ann', 'bob', 'cat']);

// ── 1. NAMED, AND ONLY THEM ──────────────────────────────────────────

test.subHeading('One key in, one row out');

const one = R.box.who([R.people.bob.publicKey]);

if (one.length === 1 && one[0].publicKey === R.people.bob.publicKey) {
  test.check('asking about bob answers bob, and nobody else');
} else {
  test.fail('got ' + one.length + ' rows: ' + JSON.stringify(one.map(function (p) { return p.publicLabel; })));
}

// THE ROW IS THE SAME ROW. Narrowing changes which rows come back and
// nothing about what a row says, so a caller that already knew how to
// read one does not have to learn anything.
const whole = R.box.who();
const bobWhole = whole.filter(function (p) { return p.publicKey === R.people.bob.publicKey; })[0];

if (JSON.stringify(one[0]) === JSON.stringify(bobWhole)) {
  test.check('and it is byte-identical to the row in the whole census');
} else {
  test.fail('the narrowed row differs: ' + JSON.stringify(one[0]));
}

// ── SEVERAL, BECAUSE ONE CALLER WILL WANT SEVERAL ────────────────────
//
// `about([keys])` in ROUTE-DISCOVERY.md is the same question in bulk, and
// it should not need a second parameter shape when it arrives.
const two = R.box.who([R.people.ann.publicKey, R.people.cat.publicKey]);

if (two.length === 2) {
  test.check('two keys in, two rows out — the bulk form needs no new spelling');
} else {
  test.fail('got ' + two.length + ' rows for two keys');
}

// ── A KEY NOBODY HOLDS ───────────────────────────────────────────────
//
// Which is the answer `peer.acquire` exists to get: "no, that key is not
// here". An empty list, not an error — the relay answered perfectly well.
const none = R.box.who(['MCowBQYDK2VwAyEA' + 'z'.repeat(27) + '=']);

if (Array.isArray(none) && none.length === 0) {
  test.check('and a key nobody holds is an empty answer, not a refusal');
} else {
  test.fail('a stranger key returned: ' + JSON.stringify(none));
}

// ── 2. THE OLD FORM IS UNTOUCHED ─────────────────────────────────────

test.subHeading('And asking for everything still answers everything');

if (whole.length === 4) {
  test.check('no parameter, whole census — owner and three members');
} else {
  test.fail('the unparameterised census changed: ' + whole.length + ' rows');
}

// AN EMPTY LIST IS NOT A FILTER. `?key=` with nothing after it, or a
// caller passing an empty array, must not mean "answer nothing" — it
// means the caller named nobody, which is the bootstrap case.
const empty = R.box.who([]);

if (empty.length === whole.length) {
  test.check('and naming nobody is the whole census, not an empty one');
} else {
  test.fail('an empty key list filtered everything out');
}

// ── 3. WHY THIS MATTERS, IN BYTES ────────────────────────────────────

test.subHeading('Which is the difference between a question and a ledger');

const wholeBytes = JSON.stringify(whole).length;
const oneBytes = JSON.stringify(one).length;

if (oneBytes < wholeBytes) {
  test.check('one row is ' + oneBytes + ' bytes against ' + wholeBytes +
    ' for four members — and the gap is the membership, so it grows');
} else {
  test.fail('narrowing saved nothing: ' + oneBytes + ' vs ' + wholeBytes);
}

// AND THE CALLER THAT MOVED. Asserted on the source, because what matters
// is that the expensive form is no longer reached from there.
const hub = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'hub.js'), 'utf8');
const acquire = hub.slice(hub.indexOf('function handleContact'));
const body = acquire.slice(0, acquire.indexOf('\n  function '));

if (/\/api\/relay\/who\?key=/.test(body)) {
  test.check('and peer.acquire asks about the key it is confirming');
} else {
  test.fail('peer.acquire still reads the whole ledger');
}

// ── THE CALLERS THAT FOLLOWED IT (2026-09-17) ────────────────────────
//
// Asserted on the source, like the one above, because what matters is
// that the expensive form is no longer reached from there. A migrated
// caller that quietly reverts looks exactly like one that never moved.

test.subHeading('And the callers that followed peer.acquire');

// ── AND relay.partnerCheck LEFT ENTIRELY (2026-09-18) ────────────────
//
// It narrowed to `?key=` on 2026-09-17, keeping ONE whole-census read on
// the refusal path so it could still say "that relay is owned by somebody
// else (Jazzmin Thut)". Two assertions stood here for that arrangement.
//
//   Andy: "when a cheat is identified, it must be eradicated."
//
// A `?owner=1` parameter would have answered the refusal too — and would
// have been the wrong move, because it answers by making the cheat
// smaller, and a smaller cheat is a defended one. `GET /api/relay/key`
// carries `ownerKey` and `ownerLabel` instead: two fields already public
// on the row marked `owner`, asked for without asking for the membership
// they were buried in.
//
// So the assertion is the strong one now.
const check = hub.slice(hub.indexOf('function handlePartnerCheck'));
const checkBody = check.slice(0, check.indexOf('\n  function '));

if (!/api\/relay\/who/.test(checkBody.replace(/\/\/.*/g, ''))) {
  test.check('relay.partnerCheck reads no census on any path — it asks who runs the box');
} else {
  test.fail('handlePartnerCheck still reads the census');
}

// AND IT STILL NAMES THE OTHER OWNER. That sentence is the only thing a
// person reads when they get a promotion wrong, and it was the reason the
// refusal path kept a census read at all. Losing it while removing the
// census would have been a silent downgrade dressed as a cleanup.
if (/owned by somebody else/.test(checkBody) && /ownerLabel/.test(checkBody)) {
  test.check('and still names who does own it, from the same fixed-cost answer');
} else {
  test.fail('the refusal no longer names the other owner');
}

// It narrowed to `?key=` for a few hours on 2026-09-17 and then stopped
// asking at all — the only thing it wanted was a label in a sentence,
// and Andy cut the sentence: "the page posts a constant username and a
// pasted secret. That's all."
//
// So the assertion is the stronger one: NO browser reads this route.
// That matters beyond the bytes. The census must answer a party with no
// identity because this page had none — and now nothing does, which
// removes one of the reasons the door has to stay open to anybody.
const devicePage = fs.readFileSync(path.join(__dirname, '..', 'run', 'device.html'), 'utf8');
// Comments stripped: the page keeps a tombstone naming the route it no
// longer calls, and a check that cannot tell prose from code would read
// that as a relapse.
const deviceCode = devicePage.replace(/\/\/.*/g, '');

if (!/\/api\/relay\/who/.test(deviceCode)) {
  test.check('the device page reads no census at all — no browser does');
} else {
  test.fail('device.html still fetches the census');
}

test.reportSuccessFailureCount();
