'use strict';

// spirit/test/boundedByTime.js
// DOES THIS RESPONSE GROW WITH MEMBERSHIP?
//
//   Andy: "a relay is fixed-cost per time-unit. simple."
//   Andy: "make the harness identify such a thing... if possible... for
//   constant reminders."
//
// Decision 0013 gives one test for any proposal: **does this make a
// relay's cost a function of anything other than time?** This is that
// test, executable — build the same relay twice, once small and once
// large, ask it the same things, and measure what grew.
//
// ── WHY A CENSUS AND NOT A PASS/FAIL ─────────────────────────────────
//
// Three interfaces fail it today and are known to: the public census, the
// stream roster, and the presence broadcast. A suite that simply went red
// would be red for ever, and a permanent red is noise nobody reads —
// which is the opposite of a reminder.
//
// So this follows oneDoor's model: an ALLOWANCE of what each interface
// currently costs per member, printed on every run, and **a number may
// fall, never rise**. The reminder is the printout; the gate is the
// ratchet. When a caller migrates to a per-key question the number drops
// and the allowance drops with it, and the day one reaches zero the
// interface can be deleted.
//
// A NEW ENTRY IS A FAILURE. Anything measured here that is not in the
// allowance is a new way for a relay's cost to track its membership, and
// it has to be argued for rather than discovered later.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { createRelay } = require('../run/js/relay');

// ── THE ALLOWANCE ────────────────────────────────────────────────────
//
// Bytes (or events) added to one response for each additional member.
// Measured, not guessed: run the suite and it prints what it found.
//
//   census     the public /api/relay/who, fetched by nine callers
//   roster     pushed to every member on every stream open
//   presence   one event per member per presence change (a COUNT, not
//              bytes — the fan-out is the cost, not the payload)
const ALLOWANCE = {
  census: 150,
  roster: 101,
  presence: 1,
};

// What each entry is for, printed beside the number so a reader does not
// have to go and find out what they are looking at.
const WHAT = {
  census: 'the census — eight callers, all gone. GET /api/relay/who deleted 2026-09-18',
  roster: 'the stream roster — one job, the three-state dot',
  presence: 'events per presence change — one per member, per change',
};

function sink(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev) return true;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed, bytes: chunk.length });
      return true;
    },
    close: function () {},
  };
}

// A relay with `n` members, all enrolled the real way.
function relayOf(n) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-bound-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('owner');
  auth.writeAllowKeys(home, [{ name: 'owner', publicKey: owner.publicKey }]);

  const box = createRelay(home);
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);

  const people = [];
  for (let i = 0; i < n; i += 1) {
    const name = 'm' + i;
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner', name, 7, '');
    // A DISTINCT clientKey PER CLAIM, and the first version of this suite
    // passed null for all of them — which is one shared bucket and
    // CLAIM_PER_MIN is ten, so a relay asked for sixty members quietly
    // ended up with ten and every slope measured zero. The suite caught
    // its own fixture, which is the right way round.
    const claimed = box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, 'client-' + i, minted.invite.token, name);
    if (!claimed || !claimed.ok) {
      test.fail('the fixture could not enrol ' + name + ': ' + JSON.stringify(claimed));
      break;
    }
    people.push(id);
  }
  return { home: home, box: box, owner: owner, people: people };
}

// ── WHAT EACH INTERFACE COSTS, MEASURED THE SAME WAY TWICE ───────────
//
// The slope between two sizes, which is the only honest way to ask the
// question: a fixed overhead is fine and a per-member term is not, and
// only two points tell them apart.
function measure(n) {
  const R = relayOf(n);

  const census = JSON.stringify({
    peers: R.box.who(),
    relayPublicKey: R.box.relayPublicKey(),
    relayLabel: R.box.relayLabel(),
  }).length;

  // THE ALTERNATIVE, MEASURED BESIDE IT. Same door, `?key=` supplied: the
  // answer is the row asked for and nothing else, so it must not grow at
  // all. This is the number that has to stay flat as callers migrate off
  // the whole-census form.
  const one = R.people.length
    ? JSON.stringify({
      peers: R.box.who([R.people[0].publicKey]),
      relayPublicKey: R.box.relayPublicKey(),
      relayLabel: R.box.relayLabel(),
    }).length
    : 0;

  const roster = JSON.stringify(R.box.streamRoster()).length;

  // Everybody holds a stream, then one more arrives: how many writes does
  // that one arrival cause?
  const bags = R.people.map(function (id) {
    const bag = [];
    R.box.streamOpen(id.publicKey,
      auth.sign(id.privateKey, auth.streamMessage(id.publicKey)), sink(bag));
    return bag;
  });
  const before = bags.reduce(function (t, b) { return t + b.length; }, 0);
  const extra = auth.generateIdentity('late');
  const minted = R.box.mint('owner', 'late', 7, '');
  R.box.claim('late', auth.sign(extra.privateKey, auth.claimMessage('late')),
    extra.publicKey, null, minted.invite.token, 'late');
  R.box.streamOpen(extra.publicKey,
    auth.sign(extra.privateKey, auth.streamMessage(extra.publicKey)), sink([]));
  const after = bags.reduce(function (t, b) { return t + b.length; }, 0);

  return { census: census, narrowed: one, roster: roster, presence: after - before };
}

test.startTest('A relay is fixed-cost per time-unit (0013), measured');

const SMALL = 10;
const LARGE = 60;

const small = measure(SMALL);
const large = measure(LARGE);
const span = LARGE - SMALL;

const slope = {};
Object.keys(ALLOWANCE).forEach(function (k) {
  slope[k] = Math.round(((large[k] - small[k]) / span) * 100) / 100;
});

// ── 1. THE STANDING REMINDER ─────────────────────────────────────────

test.subHeading('What each interface costs per additional member');

Object.keys(ALLOWANCE).forEach(function (k) {
  const unit = k === 'presence' ? ' events' : ' bytes';
  test.check(k.padEnd(9) + slope[k] + unit + ' per member — ' + WHAT[k]);
});

// A relay of a thousand, in the units an owner would actually feel.
test.check('so at 1000 members: census ' + Math.round(slope.census * 1000 / 1024) +
  ' KB per fetch, roster ' + Math.round(slope.roster * 1000 / 1024) +
  ' KB per connect, presence ' + Math.round(slope.presence * 1000) +
  ' events per change');

// ── THE ALTERNATIVE, AND WHY THE RATCHET CAN EVER MOVE ────────────
//
// A number in the allowance can only fall if there is something for a
// caller to move TO. `?key=` is that something: the same door, answering
// about the keys somebody named.
//
// It must be FLAT — not smaller, flat. A narrowed answer that still grew
// with membership would be the same defect wearing a parameter.

test.subHeading('And the narrowed form does not grow at all');

const narrowSlope = Math.round((((large.narrowed - small.narrowed) / span)) * 100) / 100;

if (narrowSlope === 0) {
  test.check('`?key=` answers ' + small.narrowed + ' bytes at ' + SMALL +
    ' members and ' + large.narrowed + ' at ' + LARGE + ' — 0 per member');
} else {
  test.fail('the narrowed census grows too: ' + narrowSlope + ' bytes per member');
}

// WHAT ONE CALLER SAVED BY MOVING. peer.acquire asked the whole census to
// answer yes or no about one key; it asks about the key now.
test.check('so peer.acquire went from ' + Math.round(slope.census * 1000 / 1024) +
  ' KB to ' + large.narrowed + ' bytes at 1000 members');

// ── 2. THE RATCHET ──────────────────────────────────────────
//
// A number may fall, never rise. The census line stays at 150 until the
// LAST caller stops asking for the whole thing — one migration does not
// move it, which is honest: the interface still has the per-member term,
// and what changed is who pays it.

test.subHeading('And a number may fall, never rise');

const worse = Object.keys(ALLOWANCE).filter(function (k) {
  return slope[k] > ALLOWANCE[k];
});

if (!worse.length) {
  test.check('nothing costs more per member than it did');
} else {
  test.fail(worse.map(function (k) {
    return k + ' grew to ' + slope[k] + ' (allowed ' + ALLOWANCE[k] + ')';
  }).join('; '));
}

const better = Object.keys(ALLOWANCE).filter(function (k) {
  return slope[k] < ALLOWANCE[k] - 1;
});

if (!better.length) {
  test.check('and none has fallen far enough to lower its allowance yet');
} else {
  // NOT A FAILURE, A PROMPT. Somebody made one cheaper and the allowance
  // should come down with it, or the ratchet stops ratcheting.
  test.fail('LOWER THE ALLOWANCE — ' + better.map(function (k) {
    return k + ' is now ' + slope[k] + ', allowance still ' + ALLOWANCE[k];
  }).join('; '));
}

// ── 3. AND A FIXED COST IS STILL FIXED ───────────────────────────────
//
// The test is about the SLOPE, not the size. An interface with a large
// constant overhead and no per-member term passes, and should: that cost
// is a function of time, which is what 0013 permits.

test.subHeading('While anything with no per-member term is fine however big');

const fixed = JSON.stringify({ relayPublicKey: 'x'.repeat(44), relayLabel: 'a relay' }).length;
if (small.census - slope.census * SMALL > 0 && fixed > 0) {
  test.check('a constant overhead is not what this measures — only the slope is');
} else {
  test.fail('the measurement is not isolating the per-member term');
}

test.reportSuccessFailureCount();
