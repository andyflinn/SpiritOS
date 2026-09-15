'use strict';

const fs = require('fs');
const os = require('os');
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

test.startTest('First claim is owner; chat to reserved name relay');

{
  const made = world.build(UNCLAIMED);
  const home = made.home;
  const box = made.box;
  const id = auth.generateIdentity('andy');
  const sig = auth.sign(id.privateKey, auth.claimMessage('andy'));

  const first = box.claim('andy', sig, id.publicKey);
  if (first.ok && first.status === 201 && first.owner === true) {
    test.check('first signed claim becomes owner');
  } else {
    test.fail('first claim: ' + JSON.stringify(first));
  }

  const allow = auth.loadAllow(home);
  if (allow.mode === 'keys' && allow.byName.andy === id.publicKey) {
    test.check('allow.json written as keys for andy');
  } else {
    test.fail('allow after first claim: ' + JSON.stringify(allow));
  }

  // ── `relay` IS AN ORDINARY LABEL NOW (2026-09-15) ────────────────
  //
  //   Andy: "relay is just a public-key-type. node is another one, none
  //   other exist yet, but will."
  //
  // This asserted `status === 400, name reserved`. The reservation is
  // gone: it never guarded routing — postedToSelf compares against the
  // relay's own KEY — so it only guarded what a list could display, and
  // it could not even do that, since the match was exact and `Relay`
  // was always claimable.
  //
  // What is asserted instead is the point of the removal: the label is
  // refused for an ORDINARY reason. `sig` here signs `claim\nandy`, so
  // a claim for a different label fails the signature check like any
  // other mismatch would. Nothing about the word `relay` is special.
  const notSpecial = box.claim('relay', sig, id.publicKey);
  if (!notSpecial.ok && notSpecial.error !== 'name reserved') {
    test.check('"relay" is refused as an ordinary label, not as a reserved word');
  } else {
    test.fail('claim of "relay": ' + JSON.stringify(notSpecial));
  }

  // A second signed key is still how peer-by-key works, but since cycle 4
  // it needs an invite the owner minted for that label. Signed but
  // uninvited is refused.
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

  const groqInvite = box.mint(
    'andy',
    'groq',
    7);
  const bad = box.claim(
    'groq',
    auth.sign(stranger.privateKey, auth.claimMessage('groq')),
    stranger.publicKey,
    '10.0.0.7',
    groqInvite.ok && groqInvite.invite.token
  ,
    'groq');
  if (bad.ok && bad.status === 201) {
    test.check('second signed key with an invite claims after owner (peer-by-key)');
  } else {
    test.fail('invited claim: ' + JSON.stringify({ mint: groqInvite, claim: bad }));
  }

  // THE RESERVED NAME ANSWERS NOTHING, and that is the whole of what
  // is left to check here.
  //
  // Chatting to the relay was a console (CYCLE-RELAY-CONSOLE) until
  // 2026-09-13. Three checks stood here: that the owner could send to
  // `relay`, that the census came back on the send response, and that a
  // non-owner got nothing. All three described a feature that is gone.
  //
  // They were replaced by one check — that a line to `relay` was REFUSED
  // rather than quietly filed as a ring entry nobody could ever read
  // back — and R8 has now deleted that too, along with `send` itself.
  //
  // NOTHING REPLACES IT, and that is the right outcome rather than a
  // hole. The refusal existed to stop a junk sink that looked like a
  // delivery; there is no sink, because there is no store. A post
  // addressed to the relay's own key is a different thing entirely and
  // has its own door (answerSelf), asserted in relayMonitor.js and
  // inviteMint.js.
  const box2 = createRelay(home);

  // The name is still RESERVED, which is a different rule and outlived
  // both the console and the ring: nobody may claim it.
  const grab = box2.claim(
    'relay',
    auth.sign(stranger.privateKey, auth.claimMessage('relay')),
    stranger.publicKey
  );
  if (!grab.ok) {
    test.check('and the name itself is still unclaimable, which was never about the console');
  } else {
    test.fail('the reserved name was claimed: ' + JSON.stringify(grab));
  }

  // AN OWNER-ONLY STATUS REPORT STOOD HERE, pulled with a signature over
  // a name, and beside it a check that an unsigned pull was refused. R3
  // deleted the verb and its route on 2026-09-15.
  //
  // WHAT THE TWO CHECKS WERE REALLY ABOUT survives, and this file is
  // where it belongs: after a first claim, the box knows who its owner
  // is. Asserted off `snapshot()` directly — which is what the report was
  // reading anyway — with no signature, because no question is being
  // asked across a wire.
  const snap = box2.snapshot();
  if (snap.owner === 'andy' && snap.mode === 'keys') {
    test.check('after the first claim the box knows its owner, and is in keys mode');
  } else {
    test.fail('snapshot: ' + JSON.stringify(snap));
  }

  // AND THE PUBLIC CENSUS SAYS SO TOO, which is what the owner badge
  // reads since R3. The flag on the row and the name in allow.json are
  // written by the same claim and must agree — a badge read off a census
  // that disagreed with `ownerName` would be a second authority.
  const ownerRow = box2.who().filter(function (p) { return p.owner; });
  if (ownerRow.length === 1 && ownerRow[0].publicKey === id.publicKey) {
    test.check('and the census marks that key as owner, with no credential asked');
  } else {
    test.fail('census owner rows: ' + JSON.stringify(ownerRow));
  }
}

{
  const made = world.build(UNCLAIMED);
  const home = made.home;
  const box = made.box;
  const unsigned = box.claim('andy', null, null);
  if (!unsigned.ok && unsigned.status === 400) {
    test.check('open mailbox rejects unsigned first claim');
  } else {
    test.fail('unsigned first: ' + JSON.stringify(unsigned));
  }
}

{
  const home = world.tmpHome();
  auth.writePendingOwner(home, 'andy');
  const box = createRelay(home);
  const other = auth.generateIdentity('eve');
  const eve = box.claim(
    'eve',
    auth.sign(other.privateKey, auth.claimMessage('eve')),
    other.publicKey
  );
  if (!eve.ok && eve.status === 403) {
    test.check('pending owner name blocks a stranger name');
  } else {
    test.fail('eve vs pending andy: ' + JSON.stringify(eve));
  }
  const id = auth.generateIdentity('andy');
  const ok = box.claim(
    'andy',
    auth.sign(id.privateKey, auth.claimMessage('andy')),
    id.publicKey
  );
  if (ok.ok && ok.owner) {
    test.check('pending name andy + laptop key becomes owner');
  } else {
    test.fail('pending andy claim: ' + JSON.stringify(ok));
  }
  if (auth.loadPendingOwner(home) === null) {
    test.check('pending-owner.json cleared after first claim');
  } else {
    test.fail('pending owner still on disk');
  }
}

test.reportSuccessFailureCount();

