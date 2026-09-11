'use strict';

// spirit/test/removePeer.js
// A relay can forget somebody.
//
// Until this existed a relay could only accumulate. mailbox.json never
// shrank, so an invitation was irreversible and the only remedy for any
// mistake — a wrong guest, a lost key, a name that should never have been
// given — was an SSH session on the box.
//
// Which is Andy's own rule wearing a different costume: "no routine
// failure should require being physically at home" was built into the
// device arc for the owner and left standing for the relay's own
// governance. A thing alone in the jungle that cannot forget cannot
// correct itself.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const world = require('./world');
const { createRelay } = require('../run/js/relay');

// A scenario, in the vocabulary the visual builder reads. The suite then
// explores it — every refusal, every signature that should not work —
// which is the part looking at one world cannot do.
const SCENARIO = {
  title: 'An owner and two members',
  peers: ['bert', 'john'],
};

function labels(box) {
  return box.who().map(function (p) { return p.publicLabel || p.name; }).sort().join(',');
}

function removalSig(id, key) {
  return auth.sign(id.privateKey, auth.removePeerMessage(key));
}

test.startTest('A relay can forget somebody');

function run() {
  const L = world.build(SCENARIO);
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); return; }

  const bert = L.peer('bert');
  const john = L.peer('john');

  test.subHeading('Its own verb, because removal is the one that destroys');

  // A census signature is the owner's most abundant credential. It must
  // not be spendable as "delete this person".
  const asStatus = L.box.removePeer('andy', bert.publicKey,
    auth.sign(L.owner.privateKey, auth.statusMessage
      ? auth.statusMessage('andy')
      : auth.claimMessage('andy')));
  if (asStatus && asStatus.ok === false && asStatus.status === 403) {
    test.check('a signature made for another verb does not remove anyone');
  } else {
    test.fail('wrong verb accepted: ' + JSON.stringify(asStatus));
  }

  const stale = L.box.removePeer('andy', bert.publicKey,
    auth.sign(L.owner.privateKey, auth.removePeerMessage(bert.publicKey, Date.now() - 120000)));
  if (stale && stale.ok === false) test.check('and a signature two minutes old does not either');
  else test.fail('stale accepted: ' + JSON.stringify(stale));

  // The KEY, not the label. A signature naming a duplicated label would
  // be an instruction to remove whichever john the relay found first.
  const byLabel = L.box.removePeer('andy', 'bert',
    auth.sign(L.owner.privateKey, auth.removePeerMessage('bert')));
  if (byLabel && byLabel.ok === false && byLabel.status === 404) {
    test.check('and a label is not a peer — removal is by key');
  } else {
    test.fail('label removed somebody: ' + JSON.stringify(byLabel));
  }

  test.subHeading('Who may forget whom');

  const stranger = auth.generateIdentity('nobody');
  const byStranger = L.box.removePeer('andy', bert.publicKey,
    removalSig(stranger, bert.publicKey));
  if (byStranger && byStranger.ok === false) {
    test.check('a stranger removes nobody');
  } else {
    test.fail('stranger removed a peer: ' + JSON.stringify(byStranger));
  }

  const byPeer = L.box.removePeer('andy', bert.publicKey, removalSig(john, bert.publicKey));
  if (byPeer && byPeer.ok === false) {
    test.check('and one member cannot remove another');
  } else {
    test.fail('peer removed a peer: ' + JSON.stringify(byPeer));
  }

  // The owner's own row. ownerName() reads it, allow.json holds only it,
  // and a relay that forgot its owner would hand itself to whoever
  // claimed next.
  const selfDestruct = L.box.removePeer('andy', L.owner.publicKey,
    removalSig(L.owner, L.owner.publicKey));
  if (selfDestruct && selfDestruct.ok === false && selfDestruct.status === 403) {
    test.check('and the owner cannot remove themselves, which would orphan the box');
  } else {
    test.fail('the owner removed themselves: ' + JSON.stringify(selfDestruct));
  }

  test.subHeading('Leaving is not a favour you have to ask for');

  const left = L.box.removePeer('john', john.publicKey, removalSig(john, john.publicKey));
  if (left && left.ok && labels(L.box).indexOf('john') === -1) {
    test.check('a member can remove themselves, signed with their own key');
  } else {
    test.fail('self-removal: ' + JSON.stringify(left) + ' roster=' + labels(L.box));
  }

  test.subHeading('What goes with them');

  // Mail first, so there is something to forget.
  const sent = L.box.send('andy', 'bert', 'are you there',
    auth.sign(L.owner.privateKey, auth.sendMessage('andy', 'bert', 'are you there')));
  if (!sent.ok) test.fail('send: ' + JSON.stringify(sent));

  // A live invite for the same label. Without revoking it, "un-invite"
  // is a lie: they walk straight back in with the token they hold.
  const spare = L.box.mint('andy', 'bert', 7,
    auth.sign(L.owner.privateKey, invites.mintMessage('bert', 7)));
  const spareToken = spare.ok && spare.invite.token;

  const gone = L.box.removePeer('andy', bert.publicKey, removalSig(L.owner, bert.publicKey));
  if (gone && gone.ok && labels(L.box) === 'andy') {
    test.check('the owner removes a member, and the roster is one shorter');
  } else {
    test.fail('remove: ' + JSON.stringify(gone) + ' roster=' + labels(L.box));
  }

  if (gone.messagesDropped >= 1) {
    test.check('their mail goes with them — ' + gone.messagesDropped + ' dropped');
  } else {
    test.fail('mail left behind: ' + JSON.stringify(gone));
  }

  if (gone.invitesRevoked >= 1) {
    test.check('and their live invite is revoked, or un-inviting is a lie');
  } else {
    test.fail('invite survived: ' + JSON.stringify(gone));
  }

  // Proved by USE, not by a count: the token they are holding must stop
  // working.
  const backAgain = L.box.claim('bert',
    auth.sign(bert.privateKey, auth.claimMessage('bert')),
    bert.publicKey, '10.0.0.1', spareToken);
  if (backAgain && backAgain.ok === false) {
    test.check('so the token they still hold no longer lets them back in');
  } else {
    test.fail('a removed peer walked back in: ' + JSON.stringify(backAgain));
  }

  test.subHeading('It survives the relay being restarted');

  // The whole point is that it is written down. A removal that only held
  // in RAM would come back on the next boot, which is the failure it
  // exists to end.
  const reopened = createRelay(L.home);
  if (labels(reopened) === 'andy') {
    test.check('a reopened mailbox has not remembered them again');
  } else {
    test.fail('removal did not persist: ' + labels(reopened));
  }

  test.subHeading('And the box stops accumulating expired invites');

  const old = world.tmpHome();
  invites.add(old, { label: 'ghost', days: 1, expiresAt: new Date(Date.now() - 86400000).toISOString() });
  invites.add(old, { label: 'live', days: 7 });
  const swept = invites.sweepExpired(old);
  const leftRows = invites.load(old).map(function (r) { return r.label; }).join(',');
  if (swept === 1 && leftRows === 'live') {
    test.check('an expired invite is swept, a live one is kept');
  } else {
    test.fail('swept=' + swept + ' left=' + leftRows);
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
