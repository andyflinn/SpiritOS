'use strict';

// Cycle A2 — the token Andy speaks on the phone.
//
// The whole cycle is one sentence: the spoken token is INSIDE what the
// owner signs. Everything here is a consequence of that.
//
// ── WHAT CHANGED UNDERNEATH IT ───────────────────────────────────────
//
// The sentence is unchanged and the mechanism is gone. A2 built
// `invites.mintMessage(label, days, token)` — a third field appended to
// the signed bytes, with an elaborate rule that an absent, empty or blank
// token had to produce the cycle-2 message byte for byte so that pre-A2
// signatures kept verifying.
//
// Decision 0010's second collapse deleted that format. A mint is a post
// now, and postMessage signs the WHOLE packet — so the token is inside
// what was signed because everything is, and the byte-compatibility rule
// has nothing left to be compatible with. Six checks about the shape of
// those bytes went with them; what they were protecting is the one check
// under "the token is part of the request" below.
//
// What survives is everything about the token itself, which was never
// about signing: the trimming, the character rules, the hex fallback, and
// the friend on the other end of the telephone claiming with the words.
//
// See CYCLE-A2.md. relay.js keeps minting hex when the field is empty.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const world = require('./world');
const scenario = require('./scenario');

// A relay with an owner on it and nobody else, built from the scenario
// every suite shares. It was four lines written out here, and the same
// four written out in five other files — where two of them saved the
// mailbox a key of its own and three forgot, so `mailboxPublicKey` was
// null in some suites and not others for no reason anybody had chosen.
function ownedRelay() {
  const made = world.build(scenario.OWNER_ONLY);
  if (!made.ok) throw new Error(made.error);
  return made;
}

// The token's own rules, asked of mint() directly — they are rules about
// what may be written down, and were never about who was asking.
function mintAs(r, label, days, token) {
  return r.box.mint('andy', label, days, token);
}

// A packet asking for one, which is the only way in from outside.
function invitePacket(label, days, token) {
  return JSON.stringify({
    app: 'relay',
    v: 1,
    body: { invite: { label: label, days: days, token: token || '' } },
  });
}

test.startTest('Invite A2 — a spoken token is signed, or it is not a token');

test.subHeading('The token is part of the request');

{
  const r = ownedRelay();
  const relayKey = r.box.mailboxPublicKey();

  // THE REPLAY THIS CYCLE EXISTS TO REFUSE, and the only check left that
  // is about signing: an owner-signed mint for "saint, 7 days, relay
  // picks the token" must not become "saint, 7 days, and the token is one
  // I chose".
  //
  // A2 bought this with a third field and a compatibility rule. It is now
  // free: the token is in the text, and the signature is over the text.
  const tokenless = invitePacket('saint', 7, '');
  const spoken = invitePacket('saint', 7, 'blue-fish');
  const forTokenless = auth.sign(r.owner.privateKey,
    auth.postMessage(r.owner.publicKey, relayKey, tokenless));

  const smuggled = r.box.routePost(r.owner.publicKey, relayKey, spoken, forTokenless);
  if (!smuggled.ok && smuggled.status === 403) {
    test.check('a tokenless signature cannot mint a spoken token');
  } else {
    test.fail('smuggled: ' + JSON.stringify(smuggled));
  }

  if (invites.load(r.home).length === 0) {
    test.check('and it wrote no row on the way out');
  } else {
    test.fail('rows after refusal: ' + JSON.stringify(invites.load(r.home)));
  }

  // The mirror image: a signature that names a token is not a licence to
  // mint a different one, nor to mint the hex the relay would have picked.
  const forBlue = auth.sign(r.owner.privateKey,
    auth.postMessage(r.owner.publicKey, relayKey, spoken));
  const swapped = r.box.routePost(r.owner.publicKey, relayKey,
    invitePacket('saint', 7, 'red-fish'), forBlue);
  const dropped = r.box.routePost(r.owner.publicKey, relayKey, tokenless, forBlue);
  if (!swapped.ok && swapped.status === 403 && !dropped.ok && dropped.status === 403) {
    test.check("a signature for one token mints neither another nor the relay's hex");
  } else {
    test.fail('swap/drop: ' + JSON.stringify([swapped, dropped]));
  }

  // And the request that WAS signed goes through, so the three refusals
  // above are about the signature and not about the packet being wrong.
  const honest = r.box.routePost(r.owner.publicKey, relayKey, spoken, forBlue);
  const row = invites.load(r.home).find(function (x) { return x.token === 'blue-fish'; });
  if (honest.ok && row && row.label === 'saint') {
    test.check('and the request that was actually signed mints the token it named');
  } else {
    test.fail('honest: ' + JSON.stringify(honest) + ' rows: ' + JSON.stringify(invites.load(r.home)));
  }
}

test.subHeading('The relay stores the token that was spoken');

{
  const r = ownedRelay();
  const minted = mintAs(r, 'saint', 7, 'blue-fish');

  if (minted.ok && minted.status === 201 && minted.invite.token === 'blue-fish') {
    test.check('the minted row carries the spoken token, not hex');
  } else {
    test.fail('spoken mint: ' + JSON.stringify(minted));
  }

  const onDisk = invites.load(r.home).find(function (row) { return row.token === 'blue-fish'; });
  if (onDisk && onDisk.label === 'saint') {
    test.check('it is on disk under that token, waiting to be claimed');
  } else {
    test.fail('on disk: ' + JSON.stringify(invites.load(r.home)));
  }

  // Trimming has to survive the round trip: what was signed, what was
  // stored, and what the friend will type must be one string.
  const padded = mintAs(r, 'anna', 7, '  green-boat  ');
  if (padded.ok && padded.invite.token === 'green-boat') {
    test.check('a token typed with stray spaces is stored trimmed');
  } else {
    test.fail('padded: ' + JSON.stringify(padded));
  }

  // And the point of all of it: the friend claims with the words.
  const saint = auth.generateIdentity('saint');
  const claimed = r.box.claim(
    'saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey,
    '10.0.0.7',
    'blue-fish'
  ,
    'saint');
  if (claimed.ok && claimed.status === 201) {
    test.check('the friend claims with the token that was spoken to them');
  } else {
    test.fail('spoken claim: ' + JSON.stringify(claimed));
  }

  const again = auth.generateIdentity('saint2');
  const reuse = r.box.claim(
    'saint',
    auth.sign(again.privateKey, auth.claimMessage('saint')),
    again.publicKey,
    '10.0.0.8',
    'blue-fish'
  ,
    'saint');
  if (!reuse.ok && reuse.status === 403) {
    test.check('a spoken token still burns on use, like any other');
  } else {
    test.fail('reuse: ' + JSON.stringify(reuse));
  }
}

test.subHeading('What a token may be');

{
  const r = ownedRelay();

  // Same rules as a name: this string is typed by one human, spoken to
  // another, and comes back as a claim. Anything longer or stranger than
  // a name is not something to read down a telephone.
  const bad = ['blue fish', 'blue/fish', '../etc/passwd', 'x'.repeat(33), '<script>'];
  const refused = bad.filter(function (t) {
    const res = mintAs(r, 'saint', 7, t);
    return !res.ok && res.status === 400 && res.error === 'bad token';
  });
  if (refused.length === bad.length) {
    test.check('a token with spaces, slashes, markup or over 32 characters is refused 400');
  } else {
    test.fail('accepted: ' + JSON.stringify(bad.filter(function (t) { return refused.indexOf(t) === -1; })));
  }

  if (invites.load(r.home).length === 0) {
    test.check('a refused token leaves no row behind');
  } else {
    test.fail('rows: ' + JSON.stringify(invites.load(r.home)));
  }

  const longest = mintAs(r, 'saint', 7, 'x'.repeat(32));
  if (longest.ok && longest.invite.token.length === 32) {
    test.check('32 characters is still a token');
  } else {
    test.fail('32 chars: ' + JSON.stringify(longest));
  }

  // AND A BAD TOKEN IS REFUSED THROUGH THE PACKET TOO, which is the path
  // a person's typing actually takes. The rule lives in mint(); this says
  // nothing on the way in quietly widens it.
  const relayKey = r.box.mailboxPublicKey();
  const nasty = invitePacket('saint', 7, '../etc/passwd');
  r.box.routePost(r.owner.publicKey, relayKey, nasty,
    auth.sign(r.owner.privateKey, auth.postMessage(r.owner.publicKey, relayKey, nasty)));
  const slipped = invites.load(r.home).some(function (row) {
    return String(row.token).indexOf('..') !== -1;
  });
  if (!slipped) {
    test.check('and a posted token is held to the same rules — nothing widens on the way in');
  } else {
    test.fail('a posted token got past the rules: ' + JSON.stringify(invites.load(r.home)));
  }
}

test.subHeading('An empty field still means hex');

{
  const r = ownedRelay();
  const auto = mintAs(r, 'saint', 7, '');
  if (auto.ok && /^[0-9a-f]{32}$/.test(auto.invite.token)) {
    test.check('no spoken token, and the relay mints its own hex as before');
  } else {
    test.fail('auto: ' + JSON.stringify(auto));
  }

  // A caller that has never heard of A2 passes no token at all.
  const old = r.box.mint('andy', 'anna', 7);
  if (old.ok && old.status === 201 && old.invite.token) {
    test.check('a caller that names no token mints unchanged');
  } else {
    test.fail('old caller: ' + JSON.stringify(old));
  }
}

test.reportSuccessFailureCount();
