'use strict';

// spirit/test/removePeer.js
// A relay can forget somebody.
//
// Until this existed a relay could only accumulate. The routing table never
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

// Asking a relay to forget somebody. The only way to ask, since decision
// 0010 emptied the register: a post, gated per verb by who signed it.
function askRemove(box, who, key) {
  return world.ask(box, who, { removePeer: { key: key } });
}

test.startTest('A relay can forget somebody');

function run() {
  const L = world.build(SCENARIO);
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); return; }

  const bert = L.peer('bert');
  const john = L.peer('john');

  test.subHeading('Removal is a post, and it is still the one that destroys');

  // ── WHAT THESE CHECKS BECAME ────────────────────────────────────────
  //
  // Three stood here about removePeerMessage: that a census signature
  // could not be spent as a removal, that a two-minute-old one was dead,
  // and that it named a KEY because labels duplicate.
  //
  // The format is gone (decision 0010) and all three properties came with
  // the post rather than being re-argued: postMessage binds sender,
  // recipient and the exact text, carries a minute, and the removal names
  // a key because the packet field says `key`. What is asked here now is
  // that they still hold on the new path.
  const boxKey = L.box.mailboxPublicKey();
  const wanted = JSON.stringify({
    app: 'relay', v: 1, body: { removePeer: { key: bert.publicKey } },
  });

  // A census signature is the owner's most abundant credential. It must
  // not be spendable as "delete this person" — and now it cannot even be
  // presented as one, because it is not a post signature at all.
  const asStatus = L.box.routePost(L.owner.publicKey, boxKey, wanted,
    auth.sign(L.owner.privateKey, auth.statusMessage('andy')));
  if (asStatus && asStatus.ok === false && asStatus.status === 403) {
    test.check('a signature made for another verb does not remove anyone');
  } else {
    test.fail('wrong verb accepted: ' + JSON.stringify(asStatus));
  }

  const stale = L.box.routePost(L.owner.publicKey, boxKey, wanted,
    auth.sign(L.owner.privateKey,
      auth.postMessage(L.owner.publicKey, boxKey, wanted, Date.now() - 120000)));
  if (stale && stale.ok === false) test.check('and a signature two minutes old does not either');
  else test.fail('stale accepted: ' + JSON.stringify(stale));

  // The KEY, not the label. A label names whichever john this box found
  // first, so the packet field is a key and a label finds nobody.
  const byLabel = askRemove(L.box, L.owner, 'bert');
  if (byLabel.answer && byLabel.answer.ok === false && byLabel.answer.status === 404) {
    test.check('and a label is not a peer — removal is by key');
  } else {
    test.fail('label removed somebody: ' + JSON.stringify(byLabel.answer));
  }

  test.subHeading('Who may forget whom');

  // A stranger has no row, so the post never reaches a verb at all.
  const stranger = auth.generateIdentity('nobody');
  const byStranger = askRemove(L.box, stranger, bert.publicKey);
  if (byStranger.sent && byStranger.sent.ok === false && labels(L.box).indexOf('bert') !== -1) {
    test.check('a stranger removes nobody — no row, so no post');
  } else {
    test.fail('stranger removed a peer: ' + JSON.stringify(byStranger.sent));
  }

  // A MEMBER MAY ADDRESS THE RELAY — that door opened so leaving could be
  // a post — and naming SOMEBODY ELSE is the owner's verb. The refusal is
  // `no such peer`: the same answer a verb nobody has heard of gets, so a
  // peer cannot enumerate what this box would do for someone else.
  const byPeer = askRemove(L.box, john, bert.publicKey);
  if (byPeer.sent && byPeer.sent.ok && byPeer.answer &&
      byPeer.answer.ok === false && byPeer.answer.error === 'no such peer' &&
      labels(L.box).indexOf('bert') !== -1) {
    test.check('and one member cannot remove another — the verb refuses, and says nothing');
  } else {
    test.fail('peer removed a peer: ' + JSON.stringify(byPeer));
  }

  // The owner's own row. ownerName() reads it, allow.json holds only it,
  // and a relay that forgot its owner would hand itself to whoever
  // claimed next. That guard lives with the ACT (forgetPeer) rather than
  // with either gate, so no way in can reach past it.
  const selfDestruct = askRemove(L.box, L.owner, L.owner.publicKey);
  if (selfDestruct.answer && selfDestruct.answer.ok === false &&
      selfDestruct.answer.status === 403) {
    test.check('and the owner cannot remove themselves, which would orphan the box');
  } else {
    test.fail('the owner removed themselves: ' + JSON.stringify(selfDestruct.answer));
  }

  test.subHeading('Leaving is not a favour you have to ask for');

  // AND THIS IS WHAT OPENED THE DOOR. Leaving is a verb about your OWN
  // row, so it needs no house key and no route of its own — which is
  // exactly the argument that removed the last two cheats from 0010's
  // register. The post's signature proves the row; there is no field to
  // name somebody else's.
  //
  // The ANSWER is lost, and that is correct: forgetPeer drops this
  // caller's stream, so the reply has nowhere to go. The stream closing
  // IS the receipt. False negative, never false positive (ROUTER.md §4).
  const left = askRemove(L.box, john, john.publicKey);
  if (left.sent && left.sent.ok && labels(L.box).indexOf('john') === -1) {
    test.check('a member can remove themselves, proved by the post and nothing else');
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
  const spare = L.box.mint('andy', 'bert', 7);
  const spareToken = spare.ok && spare.invite.token;

  const removed = askRemove(L.box, L.owner, bert.publicKey);
  const gone = removed.answer;
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
    test.check('a reopened relay has not remembered them again');
  } else {
    test.fail('removal did not persist: ' + labels(reopened));
  }

  test.subHeading('And it still reads a relay that predates the rename');

  // THE ROSTER IS THE THING AT RISK. mailbox.json became routingTable.json
  // because a relay is not a mailbox and that file is a routing table —
  // but spirit-3 has a live mailbox.json with everybody's rows in it, and
  // a rename that could not read it would drop the whole roster on the
  // next update. Every peer silently off the relay, and nothing on the
  // outside saying so.
  //
  // Built by hand rather than through world.build: the case IS a home
  // that only the old code has ever written.
  const legacyHome = world.tmpHome();
  fs.mkdirSync(path.join(legacyHome, 'relay-state'), { recursive: true });
  const carried = {
    nextId: 7,
    peers: {},
    messages: [{ id: '1', from: 'bert', to: 'andy', text: 'still here' }],
  };
  carried.peers[L.owner.publicKey] = {
    name: 'andy', publicLabel: 'andy', publicKey: L.owner.publicKey,
    claimedAt: new Date().toISOString(), owner: true,
  };
  fs.writeFileSync(
    path.join(legacyHome, 'relay-state', 'mailbox.json'),
    JSON.stringify(carried)
  );
  // The owner record is its own file and always was — allow.json is what
  // answers "who owns this box", and the rename does not touch it. A
  // relay with a routing table and no allow list is not a state any real
  // box has been in.
  auth.writeAllowKeys(legacyHome, [{ name: 'andy', publicKey: L.owner.publicKey }]);

  const migrated = createRelay(legacyHome);
  if (labels(migrated) === 'andy') {
    test.check('a relay whose only state is the old filename opens with its roster');
  } else {
    test.fail('the roster was dropped: ' + labels(migrated));
  }

  // Read, not adopted silently. The next write goes to the new name.
  const minted = migrated.mint('andy', 'saint', 7);
  if (!minted.ok) test.fail('mint on a migrated relay: ' + JSON.stringify(minted));

  const after = migrated.send('andy', 'andy', 'written after the rename',
    auth.sign(L.owner.privateKey, auth.sendMessage('andy', 'andy', 'written after the rename')));
  if (!after.ok) test.fail('send on a migrated relay: ' + JSON.stringify(after));

  const newFile = path.join(legacyHome, 'relay-state', 'routingTable.json');
  if (fs.existsSync(newFile) &&
      fs.readFileSync(newFile, 'utf8').indexOf('written after the rename') !== -1) {
    test.check('and the next write lands in routingTable.json');
  } else {
    test.fail('nothing was written to the new name');
  }

  // LEFT WHERE IT IS, not deleted. A rollback to older code then finds
  // the state it expects, and deleting somebody's only copy of a roster
  // to tidy up is not a trade worth making.
  const legacyRaw = fs.readFileSync(path.join(legacyHome, 'relay-state', 'mailbox.json'), 'utf8');
  if (legacyRaw === JSON.stringify(carried)) {
    test.check('while the old file is left untouched, so a rollback still works');
  } else {
    test.fail('the legacy file was written to or removed');
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

  test.subHeading('Both ways in are posts, and neither has a door');

  //   Andy: "api/hub/remove-peer must be the interface"
  //   Andy: "anything that can be done by protocol MUST be done by protocol"
  //
  // The first sentence built the node-side interface this verb never had.
  // The second took the route away underneath it.
  //
  // /api/relay/remove-peer and removePeerMessage are both gone. The owner
  // naming anybody and a peer naming themselves are the same post, gated
  // per verb by who signed it — which is the whole of what the route's
  // `byOwner || bySelf` used to decide, done once and in one place.
  const P = world.build(SCENARIO);
  if (!P.ok) { test.fail(P.error); test.reportSuccessFailureCount(); return; }
  const anna = P.peer('bert');
  const leaver = P.peer('john');

  const posted = askRemove(P.box, P.owner, anna.publicKey);
  if (posted.ok && posted.answer.removed &&
      posted.answer.removed.key === anna.publicKey &&
      labels(P.box).indexOf('bert') === -1) {
    test.check('the owner removes by posting — no signed verb, no route');
  } else {
    test.fail('owner post: ' + JSON.stringify(posted));
  }

  // THE HALF THAT COULD NOT MOVE UNTIL THE DESTINATION OPENED. A peer
  // could not address the relay at all, so leaving had to keep a public
  // door. It does not any more.
  const walkedOut = askRemove(P.box, leaver, leaver.publicKey);
  if (walkedOut.sent && walkedOut.sent.ok && labels(P.box).indexOf('john') === -1) {
    test.check('and leaving is the same post, proved by the row that is leaving');
  } else {
    test.fail('self-removal: ' + JSON.stringify(walkedOut) + ' labels: ' + labels(P.box));
  }

  // AND THE ANSWER TO IT IS LOST, on purpose. forgetPeer drops the
  // caller's stream, so there is nowhere to deliver the reply — a peer
  // that has been forgotten cannot be told anything, and a relay that
  // could still reach them would not have forgotten them.
  if (!walkedOut.answer) {
    test.check("the leaver hears nothing back — the stream closing IS the receipt");
  } else {
    test.fail('a removed peer was still answered: ' + JSON.stringify(walkedOut.answer));
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
