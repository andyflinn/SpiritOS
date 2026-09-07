'use strict';

// relay.mint() — the owner, and only the owner, makes invite tokens.
//
// The gate is deliberately NOT auth.checkOwner: that verifies
// statusMessage(name), which names no label and no duration, so a
// signature captured from a status request would mint anything. mint
// verifies invites.mintMessage(label, days) instead, which is why a
// signature for one label is useless for another.
//
// Cycle 2 mints; cycle 1 consumes. They meet in different modes on
// purpose — see the last block.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-invite-mint-'));
}

function ownedRelay() {
  const home = tmpHome();
  const box = createRelay(home);
  const owner = auth.generateIdentity('andy');
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey);
  return { home: home, box: box, owner: owner };
}

function daysBetween(iso) {
  return Math.round((Date.parse(iso) - Date.now()) / 86400000);
}

test.startTest('Invite mint — owner-signed, label and duration bound');

{
  const r = ownedRelay();
  const sig = auth.sign(r.owner.privateKey, invites.mintMessage('saint', 7));
  const minted = r.box.mint('andy', 'saint', 7, sig);

  if (minted.ok && minted.status === 201 && minted.invite && minted.invite.token) {
    test.check('owner mints an invite');
  } else {
    test.fail('mint: ' + JSON.stringify(minted));
  }

  if (minted.invite.label === 'saint' && minted.invite.invitedBy === 'andy') {
    test.check('minted row carries label and invitedBy provenance');
  } else {
    test.fail('invite shape: ' + JSON.stringify(minted.invite));
  }

  const onDisk = invites.load(r.home).find(function (row) {
    return row.token === minted.invite.token;
  });
  if (onDisk && onDisk.consumedAt === null) {
    test.check('minted row is on disk, unconsumed');
  } else {
    test.fail('on disk: ' + JSON.stringify(invites.load(r.home)));
  }

  // The whole point of signing the label: a token for one name must not
  // be mintable with a signature made for another.
  const wrongLabel = r.box.mint('andy', 'eve', 7, sig);
  if (!wrongLabel.ok && wrongLabel.status === 403) {
    test.check("a signature for 'saint' does not mint 'eve'");
  } else {
    test.fail('wrong label: ' + JSON.stringify(wrongLabel));
  }

  // Same for duration — 7 days signed is not 15 days minted.
  const wrongDays = r.box.mint('andy', 'saint', 15, sig);
  if (!wrongDays.ok && wrongDays.status === 403) {
    test.check('a signature for 7 days does not mint 15 days');
  } else {
    test.fail('wrong days: ' + JSON.stringify(wrongDays));
  }

  // A status signature is the replay this gate exists to refuse.
  const statusSig = auth.sign(r.owner.privateKey, auth.statusMessage('andy'));
  const replay = r.box.mint('andy', 'saint', 7, statusSig);
  if (!replay.ok && replay.status === 403) {
    test.check('a status signature cannot be replayed into a mint');
  } else {
    test.fail('status replay: ' + JSON.stringify(replay));
  }
}

test.subHeading('Who may mint');

{
  const r = ownedRelay();
  const mallory = auth.generateIdentity('mallory');

  const forged = r.box.mint('andy', 'saint', 7, auth.sign(mallory.privateKey, invites.mintMessage('saint', 7)));
  if (!forged.ok && forged.status === 403) {
    test.check("a stranger's signature over andy's name is refused");
  } else {
    test.fail('forged: ' + JSON.stringify(forged));
  }

  // mallory may hold a properly invited, properly claimed key on this box
  // — that is still not the owner key in allow.json. Since cycle 4 she
  // needs an invite to get on at all, so mint her one: without it she
  // would never become a peer and this check would pass for the wrong
  // reason.
  const mInvite = r.box.mint('andy', 'mallory', 7, auth.sign(r.owner.privateKey, invites.mintMessage('mallory', 7)));
  const mClaim = r.box.claim(
    'mallory',
    auth.sign(mallory.privateKey, auth.claimMessage('mallory')),
    mallory.publicKey,
    '10.0.0.6',
    mInvite.ok && mInvite.invite.token
  );
  if (mClaim.ok) {
    test.check('an invited stranger becomes a peer');
  } else {
    test.fail('mallory claim: ' + JSON.stringify({ mint: mInvite, claim: mClaim }));
  }

  const claimedStranger = r.box.mint('mallory', 'saint', 7, auth.sign(mallory.privateKey, invites.mintMessage('saint', 7)));
  if (!claimedStranger.ok && claimedStranger.status === 403) {
    test.check('a claimed non-owner peer still cannot mint');
  } else {
    test.fail('claimed stranger: ' + JSON.stringify(claimedStranger));
  }

  const unsigned = r.box.mint('andy', 'saint', 7, '');
  if (!unsigned.ok && unsigned.status === 403) {
    test.check('mint without a signature is refused');
  } else {
    test.fail('unsigned: ' + JSON.stringify(unsigned));
  }

  const reserved = r.box.mint('andy', 'relay', 7, auth.sign(r.owner.privateKey, invites.mintMessage('relay', 7)));
  if (!reserved.ok && reserved.status === 400) {
    test.check('the reserved name cannot be invited');
  } else {
    test.fail('reserved: ' + JSON.stringify(reserved));
  }
}

test.subHeading('Duration is clamped, and clamped identically on both sides');

{
  const r = ownedRelay();

  // 99 is signed and stored as 15. If mintMessage and add() clamped
  // differently this would fail as a bad signature instead.
  const long = r.box.mint('andy', 'far', 99, auth.sign(r.owner.privateKey, invites.mintMessage('far', 99)));
  if (long.ok && daysBetween(long.invite.expiresAt) === 15) {
    test.check('99 days is clamped to 15, and still verifies');
  } else {
    test.fail('long: ' + JSON.stringify(long));
  }

  const zero = r.box.mint('andy', 'soon', 0, auth.sign(r.owner.privateKey, invites.mintMessage('soon', 0)));
  if (zero.ok && daysBetween(zero.invite.expiresAt) === 7) {
    test.check('0 days falls back to the 7 day default');
  } else {
    test.fail('zero: ' + JSON.stringify(zero));
  }

  const missing = r.box.mint('andy', 'nodays', undefined, auth.sign(r.owner.privateKey, invites.mintMessage('nodays', undefined)));
  if (missing.ok && daysBetween(missing.invite.expiresAt) === 7) {
    test.check('a missing duration defaults to 7 days');
  } else {
    test.fail('missing: ' + JSON.stringify(missing));
  }
}

test.subHeading('A mailbox with no owner key cannot mint');

{
  const home = tmpHome();
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(
    path.join(home, 'relay-state', 'allow.json'),
    JSON.stringify({ names: ['andy'] })
  );
  const box = createRelay(home);
  const andy = auth.generateIdentity('andy');
  const r = box.mint('andy', 'saint', 7, auth.sign(andy.privateKey, invites.mintMessage('saint', 7)));
  if (!r.ok && r.status === 403 && r.error === 'no owner key on this relay') {
    test.check('names-mode mailbox refuses to mint');
  } else {
    test.fail('names mint: ' + JSON.stringify(r));
  }

  // Worth stating plainly, because it is the shape cycle 4 closes: this
  // names-mode box is exactly where an invite would be CONSUMED, and it
  // is the one place that cannot mint one. A keys-mode box can mint, and
  // ignores invites on claim. Neither half is broken; they just do not
  // meet until keys-mode requires an invite.
  const token = invites.add(home, { label: 'saint', invitedBy: 'andy', days: 7 }).token;
  const saint = auth.generateIdentity('saint');
  const used = box.claim('saint', auth.sign(saint.privateKey, auth.claimMessage('saint')), saint.publicKey, '10.0.0.9', token);
  if (used.ok && used.status === 201) {
    test.check('a hand-written row still gets saint in, as in cycle 1');
  } else {
    test.fail('names claim with invite: ' + JSON.stringify(used));
  }
}

test.reportSuccessFailureCount();
