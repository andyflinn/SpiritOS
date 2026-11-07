'use strict';
const rollOf = require('./rollOf');

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth');
const invites = require('../run/spirit/invites');
const { createRelay } = require('../run/spirit/relay');
// A relay nobody has claimed, which is the only world in which the act of
// claiming can be watched happening. The claims themselves stay written
// out below: they are the subject of this file, and a helper that made
// them would be a helper that hid them.
const UNCLAIMED = require('./scenario').UNCLAIMED;
const world = require('./world');

// ── THE OWNER IS WRITTEN AT INSTALL, NOT CLAIMED (goal/G16.8) ─────────
//
// No claim makes an owner, with an invite or without. Andy: "the invite
// path to ownership MUST be gone. it is a security gap, from the time of
// install until the time of first claim." bash/install-units writes
// spirit/state/owner.json from the OWNER_KEY it is given, and a relay with
// no owner file takes no claim at all.

test.startTest('The owner is written at install; no claim makes an owner');

{
  const made = world.build(UNCLAIMED);
  const home = made.home;
  const box = made.box;
  const id = auth.generateIdentity('andy');
  const sig = auth.sign(id.privateKey, auth.claimMessage('andy'));

  test.subHeading('A relay with no owner file takes no claim, with an invite or without');

  const bare = box.claim('andy', sig, id.publicKey);
  if (!bare.ok && bare.status === 503 && /^relay has no owner/.test(bare.error)) {
    test.check('a signed first claim with no invite is refused — the box is not the first comer\'s');
  } else {
    test.fail('bare first claim: ' + JSON.stringify(bare));
  }

  const ordinary = invites.add(home, { label: 'andy', invitedBy: 'someone' });
  const notOwner = box.claim('andy', sig, id.publicKey, '10.0.0.1', ordinary.token, 'andy');
  if (!notOwner.ok && notOwner.status === 503) {
    test.check('an invite does not make an owner either — nothing over the wire does');
  } else {
    test.fail('invite as owner: ' + JSON.stringify(notOwner));
  }

  if (auth.loadOwner(home) === '' && invites.load(home).some(function (r) { return r.token === ordinary.token; })) {
    test.check('and neither wrote owner.json nor spent the invite');
  } else {
    test.fail('after the refused claims: owner ' + JSON.stringify(auth.loadOwner(home)));
  }

  test.subHeading('The install names the owner, and he claims with no invite');

  // What bash/install-units does, before the relay serves. A relay reads its
  // owner when it is created, so the box is built again on the same home.
  auth.writeOwner(home, id.publicKey);
  const installed = createRelay(home);
  const first = installed.claim('andy', sig, id.publicKey, '10.0.0.1');
  if (first.ok && first.status === 201 && first.owner === true) {
    test.check('the key named in owner.json claims with no invite, and the answer says owner');
  } else {
    test.fail('owner claim: ' + JSON.stringify(first));
  }

  if (auth.loadOwner(home) === id.publicKey) {
    test.check('owner.json still names andy\'s key — the claim did not touch it');
  } else {
    test.fail('owner after the claim: ' + JSON.stringify(auth.loadOwner(home)));
  }

  // ── `relay` IS AN ORDINARY LABEL ─────────────────────────────────
  //
  //   Andy: "relay is just a public-key-type. node is another one, none
  //   other exist yet, but will."
  //
  // The label is refused for an ORDINARY reason: `sig` signs
  // `claim\nandy`, so a claim for a different label fails the signature
  // check like any other mismatch would.
  const notSpecial = installed.claim('relay', sig, id.publicKey);
  if (!notSpecial.ok && notSpecial.error !== 'name reserved') {
    test.check('"relay" is refused as an ordinary label, not as a reserved word');
  } else {
    test.fail('claim of "relay": ' + JSON.stringify(notSpecial));
  }

  test.subHeading('After the owner, every claim needs the owner\'s invite');

  const stranger = auth.generateIdentity('groq');
  const uninvited = installed.claim(
    'groq',
    auth.sign(stranger.privateKey, auth.claimMessage('groq')),
    stranger.publicKey
  );
  if (!uninvited.ok && uninvited.status === 403 && uninvited.error === 'invite required') {
    test.check('second key without an invite is refused');
  } else {
    test.fail('uninvited claim: ' + JSON.stringify(uninvited));
  }

  const groqInvite = installed.mint('andy', 'groq', 7);
  const invited = installed.claim(
    'groq',
    auth.sign(stranger.privateKey, auth.claimMessage('groq')),
    stranger.publicKey,
    '10.0.0.7',
    groqInvite.ok && groqInvite.invite.token,
    'groq');
  if (invited.ok && invited.status === 201 && !invited.owner) {
    test.check('second signed key with the owner\'s invite claims, and is not owner');
  } else {
    test.fail('invited claim: ' + JSON.stringify({ mint: groqInvite, claim: invited }));
  }

  // The box, read again from disc by a fresh relay object.
  const box2 = createRelay(home);
  const snap = box2.snapshot();
  if (snap.owner === 'andy' && snap.mode === 'keys') {
    test.check('after the owner\'s claim the box knows its owner, and is in keys mode');
  } else {
    test.fail('snapshot: ' + JSON.stringify(snap));
  }

  // THE ROLL DOES NOT SAY SO, AND MUST NOT: no row of the roll is marked
  // owner. One thing determines ownership, the install (goal/G16.8): the
  // one key is owner.json's, and ownerPublic() — what the relay's card
  // (relay.js relayCard) carries — names it.
  const rows = rollOf(box2);
  const named = box2.ownerPublic();
  const own = rows.filter(function (p) { return p.publicKey === id.publicKey; })[0];
  if (named.ownerKey === id.publicKey && own && rows.every(function (p) { return !('owner' in p); })) {
    test.check('the relay names that key as owner, and its row carries no mark');
  } else {
    test.fail('ownerPublic ' + JSON.stringify(named) + ' rows ' + JSON.stringify(rows));
  }

  test.subHeading('Members but no owner is broken, not unclaimed');

  // owner.json lost. relayServer.js refuses to START on this (exit 78);
  // a relay built in process refuses every claim, and says why, so the
  // operator is pointed at SSH (Andy) — and an invite still live on the
  // box cannot take it.
  fs.unlinkSync(path.join(home, 'spirit', 'state', 'owner.json'));
  const box3 = createRelay(home);
  const thief = auth.generateIdentity('thief');
  const stolen = invites.add(home, { label: 'thief', invitedBy: 'andy', days: 1 });
  const grab = box3.claim('thief',
    auth.sign(thief.privateKey, auth.claimMessage('thief')),
    thief.publicKey, '10.0.0.9', stolen.token, 'thief');
  if (!grab.ok && grab.status === 503 && /restore owner\.json/.test(grab.error)) {
    test.check('a relay with members and no owner.json refuses even a live invite: ' + grab.error);
  } else {
    test.fail('members-no-owner claim: ' + JSON.stringify(grab));
  }
}

{
  const made = world.build(UNCLAIMED);
  const box = made.box;
  const unsigned = box.claim('andy', null, null);
  if (!unsigned.ok) {
    test.check('an unowned relay rejects an unsigned claim too: ' + unsigned.error);
  } else {
    test.fail('unsigned first: ' + JSON.stringify(unsigned));
  }
}

test.reportSuccessFailureCount();
