'use strict';
const rollOf = require('./rollOf');

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const { createRelay } = require('../run/js/relay');
// A relay nobody has claimed, which is the only world in which the act of
// claiming can be watched happening. The claims themselves stay written
// out below: they are the subject of this file, and a helper that made
// them would be a helper that hid them.
const UNCLAIMED = require('./scenario').UNCLAIMED;
const world = require('./world');

// ── FIRST INVITED CLAIM IS OWNER (cycle 3, Part B) ────────────────────
//
// 0003 amended. Until cycle 3 the first signed claim on an empty relay
// became its owner — anybody's, and the startup warning said so — and
// install-public-relay.js could reserve the first claim for a NAME
// (pending-owner.json), which anybody who guessed the name could take.
//
// Now an unclaimed relay takes exactly one thing: a signed claim
// presenting the owner invite. install.js mints it over SSH; a suite
// mints it in process, as here.

test.startTest('First invited claim is owner');

{
  const made = world.build(UNCLAIMED);
  const home = made.home;
  const box = made.box;
  const id = auth.generateIdentity('andy');
  const sig = auth.sign(id.privateKey, auth.claimMessage('andy'));

  test.subHeading('An unclaimed relay takes the owner invite and nothing else');

  const bare = box.claim('andy', sig, id.publicKey);
  if (!bare.ok && bare.status === 403 && bare.error === 'owner invite required') {
    test.check('a signed first claim with no invite is refused — the box is not the first comer\'s');
  } else {
    test.fail('bare first claim: ' + JSON.stringify(bare));
  }

  // An ORDINARY invite cannot make an owner, even on an empty relay. This
  // is the case the installer's mark exists for: allow.json lost while an
  // owner-minted invite is still live.
  const ordinary = invites.add(home, { label: 'andy', invitedBy: 'someone' });
  const notOwner = box.claim('andy', sig, id.publicKey, '10.0.0.1', ordinary.token, 'andy');
  if (!notOwner.ok && notOwner.error === 'owner invite required') {
    test.check('an ordinary invite does not make an owner — only the installer\'s does');
  } else {
    test.fail('ordinary invite as owner: ' + JSON.stringify(notOwner));
  }

  const ownerInvite = invites.mintOwner(home, 'andy', 1);
  const wrongLabel = box.claim('andy', sig, id.publicKey, '10.0.0.1', ownerInvite.token, 'eve');
  if (!wrongLabel.ok && wrongLabel.status === 403) {
    test.check('the owner token under the wrong name is refused — both halves are the proof');
  } else {
    test.fail('owner token, wrong label: ' + JSON.stringify(wrongLabel));
  }

  const first = box.claim('andy', sig, id.publicKey, '10.0.0.1', ownerInvite.token, 'andy');
  if (first.ok && first.status === 201 && first.owner === true) {
    test.check('the claim presenting the owner invite becomes owner');
  } else {
    test.fail('first claim: ' + JSON.stringify(first));
  }

  const allow = auth.loadAllow(home);
  if (allow.mode === 'keys' && allow.byName.andy === id.publicKey) {
    test.check('allow.json written as keys for andy');
  } else {
    test.fail('allow after first claim: ' + JSON.stringify(allow));
  }

  if (!invites.load(home).some(function (r) { return r.token === ownerInvite.token; })) {
    test.check('and the owner token is spent — it made one owner, once');
  } else {
    test.fail('the owner token survived its claim');
  }

  // ── `relay` IS AN ORDINARY LABEL NOW (2026-09-15) ────────────────
  //
  //   Andy: "relay is just a public-key-type. node is another one, none
  //   other exist yet, but will."
  //
  // The label is refused for an ORDINARY reason: `sig` signs
  // `claim\nandy`, so a claim for a different label fails the signature
  // check like any other mismatch would.
  const notSpecial = box.claim('relay', sig, id.publicKey);
  if (!notSpecial.ok && notSpecial.error !== 'name reserved') {
    test.check('"relay" is refused as an ordinary label, not as a reserved word');
  } else {
    test.fail('claim of "relay": ' + JSON.stringify(notSpecial));
  }

  test.subHeading('After the owner, every claim needs the owner\'s invite');

  const stranger = auth.generateIdentity('groq');
  const uninvited = box.claim(
    'groq',
    auth.sign(stranger.privateKey, auth.claimMessage('groq')),
    stranger.publicKey
  );
  if (!uninvited.ok && uninvited.status === 403 && uninvited.error === 'invite required') {
    test.check('second key without an invite is refused');
  } else {
    test.fail('uninvited claim: ' + JSON.stringify(uninvited));
  }

  // A LEFTOVER OWNER INVITE MAKES A MEMBER OF NOBODY. install.js run again
  // on a claimed relay refuses; this is the relay's own half of that rule.
  const leftover = invites.mintOwner(home, 'groq', 1);
  const sneak = box.claim(
    'groq',
    auth.sign(stranger.privateKey, auth.claimMessage('groq')),
    stranger.publicKey, '10.0.0.7', leftover.token, 'groq'
  );
  if (!sneak.ok && sneak.error === 'this relay already has an owner') {
    test.check('an owner invite on a claimed relay is refused, not turned into a membership');
  } else {
    test.fail('leftover owner invite: ' + JSON.stringify(sneak));
  }

  const groqInvite = box.mint('andy', 'groq', 7);
  const invited = box.claim(
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
    test.check('after the first claim the box knows its owner, and is in keys mode');
  } else {
    test.fail('snapshot: ' + JSON.stringify(snap));
  }

  // THE ROLL DOES NOT SAY SO, AND MUST NOT (2026-09-19). This asserted
  // "the roll marks that key as owner". Andy: "only one thing determines
  // ownership of a relay. First claim. No fleeting roll with automatic
  // memory loss can mark a row as 'owner'." The one key is allow.json's,
  // and ownerPublic() — what /api/relay/key serves — names it.
  const rows = rollOf(box2);
  const named = box2.ownerPublic();
  const own = rows.filter(function (p) { return p.publicKey === id.publicKey; })[0];
  if (named.ownerKey === id.publicKey && own && rows.every(function (p) { return !('owner' in p); })) {
    test.check('the relay names that key as owner, and its row carries no mark');
  } else {
    test.fail('ownerPublic ' + JSON.stringify(named) + ' rows ' + JSON.stringify(rows));
  }

  test.subHeading('Members but no owner is broken, not unclaimed');

  // allow.json lost. relayServer.js refuses to START on this (exit 78);
  // a relay built in process refuses the claim for the same reason, so
  // the next owner invite cannot take a box with people on it. Recovery
  // is SSH (Andy).
  fs.unlinkSync(path.join(home, 'relay-state', 'allow.json'));
  const box3 = createRelay(home);
  const thief = auth.generateIdentity('thief');
  const stolen = invites.mintOwner(home, 'thief', 1);
  const grab = box3.claim('thief',
    auth.sign(thief.privateKey, auth.claimMessage('thief')),
    thief.publicKey, '10.0.0.9', stolen.token, 'thief');
  if (!grab.ok && grab.status === 503 && /restore allow\.json/.test(grab.error)) {
    test.check('a relay with members and no allow.json refuses even the owner invite: ' + grab.error);
  } else {
    test.fail('members-no-owner claim: ' + JSON.stringify(grab));
  }
}

{
  const made = world.build(UNCLAIMED);
  const box = made.box;
  const unsigned = box.claim('andy', null, null);
  if (!unsigned.ok && unsigned.status === 400) {
    test.check('an unclaimed relay rejects an unsigned first claim');
  } else {
    test.fail('unsigned first: ' + JSON.stringify(unsigned));
  }
}

// THE PENDING-OWNER BLOCK STOOD HERE: install-public-relay.js's name
// reservation, asserted to block a stranger's name and to clear after the
// first claim. Both the reservation and the file went in cycle 3 (Part B):
// a name with no secret behind it is not a lock. The owner invite above is
// what replaced it.

test.reportSuccessFailureCount();
