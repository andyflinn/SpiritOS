// ---------------------------------------------------------------------------
//  ownerCommand.js — the switch, where a remote packet becomes local authority.
//
//    Andy, 2026-09-26: "a puppet always routes requests through its owner ...
//    the puppet is uable to sign any request with the owners signature. and
//    that signature must exist before the puppet routes the request to
//    loopback." — "the second half counts." — "so we must make sure in code,
//    that the signature is verified in the pupped, else request is refused."
//
//  THE ATTACK THIS EXISTS FOR, found by wsl-claude before anything was built:
//  server.js:1335 hands every mounted puppet a post() whose text is RAW and
//  passes it straight to peerRouter.post, and peerPost.js:756 signs every
//  outgoing post with the node's own identity key. So a puppet composes any
//  envelope it likes and it travels signed by that key — which, to a SIBLING
//  puppet under the same owner, IS the owner's key. The forger never signs
//  anything; the router signs for it.
//
//  So the sender check is necessary and nowhere near sufficient, and every
//  assertion below is about what survives an attacker who is holding a
//  genuine owner-key signature.
// ---------------------------------------------------------------------------

'use strict';

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const packet = require('../run/js/client/packet');
const nodeApps = require('../run/js/nodeApps');

test.startTest('A puppet takes commands from its owner and from nobody else');

const owner = auth.generateIdentity('owner');
const puppet = auth.generateIdentity('puppet');
const sibling = auth.generateIdentity('sibling');

// Built the way peerOwnerPost builds one: the id is minted FIRST because it is
// inside the signed bytes, and `cmd` travels verbatim beside its signature.
function commandFor(toKey, verb, body, signAs, opts) {
  const o = opts || {};
  const id = o.id || packet.randomId();
  const cmd = JSON.stringify({ verb: verb, body: body || {} });
  const signer = signAs || owner;
  const at = o.atMs;
  const sig = o.sig !== undefined ? o.sig
    : auth.sign(signer.privateKey,
      auth.commandMessage(o.signedFrom || owner.publicKey, o.signedTo || toKey, id, cmd, at));
  const made = packet.encode('', { cmd: cmd, sig: sig }, { id: id });
  return { text: made.text, id: id, cmd: cmd, sig: sig };
}

const switchIn = (arrival, ownerKey, selfKey) => nodeApps.ownerCommandIn(arrival, {
  ownerKey: ownerKey,
  selfKey: selfKey,
  decode: packet.decode,
  isEnvelope: packet.isEnvelope,
  auth: auth,
});

test.subHeading('The control: a genuine command from the owner is accepted');

{
  const made = commandFor(puppet.publicKey, 'contact.list', { of: 'all' });
  const got = switchIn({ from: owner.publicKey, text: made.text },
    owner.publicKey, puppet.publicKey);
  if (got.ok && got.verb === 'contact.list' && got.body && got.body.of === 'all') {
    test.check('the owner\'s command is accepted and its verb and body come back intact');
  } else {
    test.fail('a genuine owner command was refused: ' + JSON.stringify(got));
  }
}

test.subHeading('Andy\'s mode gate: a node with no owner takes no commands at all');

{
  // THE STRONGEST REFUSAL HERE, and it is not a check on the packet. Andy:
  // "the owner is never in puppet-mode, to that gate closes automatically."
  // A forged command arriving at an OWNER is not a command that fails a test —
  // it is not a command, because that node takes none. Puppet -> owner is
  // closed by construction, and this asserts the construction.
  const made = commandFor(puppet.publicKey, 'contact.list', {});
  const got = switchIn({ from: owner.publicKey, text: made.text }, '', puppet.publicKey);
  if (!got.ok && got.status === 403 && /not a puppet/.test(got.error)) {
    test.check('a node with no owner established refuses a perfectly valid command — '
      + 'absent means nobody, and that is what closes puppet to owner');
  } else {
    test.fail('a node with no owner accepted a command: ' + JSON.stringify(got));
  }
}

test.subHeading('The sibling case: holding the owner\'s key is not holding the owner\'s signature');

{
  // (1) NO INNER SIGNATURE. This is the sibling's real position: it posts
  // through the shared node, so the arrival genuinely comes FROM the owner key
  // — it simply cannot produce the command signature.
  const made = packet.encode('', { cmd: JSON.stringify({ verb: 'contact.forget' }) });
  const got = switchIn({ from: owner.publicKey, text: made.text },
    owner.publicKey, puppet.publicKey);
  if (!got.ok && got.status === 403 && /bad command signature/.test(got.error)) {
    test.check('a command with NO signature is refused although it arrives from the '
      + 'owner key — which is exactly the sibling puppet\'s position');
  } else {
    test.fail('an unsigned command was accepted from the owner key: ' + JSON.stringify(got));
  }

  // (2) A LIFTED TRANSPORT SIGNATURE. The one thing a sibling DOES have: the
  // router signed its post. It fails as an inner signature because it signs
  // bytes beginning 'post', not 'command' — by construction, not by a check.
  const cmd = JSON.stringify({ verb: 'contact.forget', body: {} });
  const transport = auth.sign(owner.privateKey,
    auth.postMessage(owner.publicKey, puppet.publicKey, cmd));
  const lifted = commandFor(puppet.publicKey, 'contact.forget', {}, owner, { sig: transport });
  const got2 = switchIn({ from: owner.publicKey, text: lifted.text },
    owner.publicKey, puppet.publicKey);
  if (!got2.ok && /bad command signature/.test(got2.error)) {
    test.check('a transport signature lifted and presented as the inner one is refused — '
      + 'the tag makes it a signature over different bytes');
  } else {
    test.fail('a lifted transport signature passed as an inner one: ' + JSON.stringify(got2));
  }

  // (3) A SIBLING SIGNING WITH ITS OWN KEY.
  const mine = commandFor(puppet.publicKey, 'contact.forget', {}, sibling,
    { signedFrom: sibling.publicKey });
  const got3 = switchIn({ from: owner.publicKey, text: mine.text },
    owner.publicKey, puppet.publicKey);
  if (!got3.ok && /bad command signature/.test(got3.error)) {
    test.check('a command the sibling signed with its OWN key is refused');
  } else {
    test.fail('a sibling-signed command was accepted: ' + JSON.stringify(got3));
  }
}

test.subHeading('Replay: a command is bound to one recipient and one envelope');

{
  // (4) ADDRESSED TO B, RE-POSTED TO C. The owner really did sign these bytes,
  // so nothing about the signature is wrong — it is bound to a recipient that
  // is not this one. Cheap now, expensive to retrofit once commands are in
  // flight, which is why it is in the first cut.
  const forPuppet = commandFor(puppet.publicKey, 'contact.forget', {});
  const atSibling = switchIn({ from: owner.publicKey, text: forPuppet.text },
    owner.publicKey, sibling.publicKey);
  if (!atSibling.ok && /bad command signature/.test(atSibling.error)) {
    test.check('a command the owner signed for one puppet is refused when re-posted to '
      + 'a sibling — the recipient key is inside the signed bytes');
  } else {
    test.fail('a command was replayed to a sibling: ' + JSON.stringify(atSibling));
  }

  // (5) THE SAME SIGNATURE ON A DIFFERENT ENVELOPE. The id is minted before
  // signing for this reason: a signature cannot be moved onto another packet.
  const other = packet.encode('', { cmd: forPuppet.cmd, sig: forPuppet.sig });
  const moved = switchIn({ from: owner.publicKey, text: other.text },
    owner.publicKey, puppet.publicKey);
  if (!moved.ok && /bad command signature/.test(moved.error)) {
    test.check('the same signature carried on a different envelope is refused');
  } else {
    test.fail('a signature was moved onto another envelope: ' + JSON.stringify(moved));
  }

  // (6) OUTSIDE THE MINUTE WINDOW. The minute never travels — it is recovered
  // by trying one either side, the convention relayAuth already uses for
  // streams, posts and receipts.
  const old = commandFor(puppet.publicKey, 'contact.forget', {}, owner,
    { atMs: Date.now() - 5 * 60000 });
  const stale = switchIn({ from: owner.publicKey, text: old.text },
    owner.publicKey, puppet.publicKey);
  if (!stale.ok && /bad command signature/.test(stale.error)) {
    test.check('a command signed five minutes ago is refused — the window is one minute '
      + 'either side, as it is for every other signed format here');
  } else {
    test.fail('a stale command was accepted: ' + JSON.stringify(stale));
  }
}

test.subHeading('Plain chat is not a command, which is a hole that was caught before it shipped');

{
  // An ordinary chat line decodes with no app, exactly as a system packet does.
  // The envelope test is therefore separate from the app test — wsl-claude
  // found this in the receiver rule before it was built, and it stays found.
  const chat = switchIn({ from: owner.publicKey, text: 'hello there' },
    owner.publicKey, puppet.publicKey);
  if (!chat.ok && /not a command/.test(chat.error)) {
    test.check('a plain chat line from the owner is not dispatched as a verb');
  } else {
    test.fail('plain chat was taken as a command: ' + JSON.stringify(chat));
  }

  const app = packet.encode('natter', { say: 'hello' });
  const toApp = switchIn({ from: owner.publicKey, text: app.text },
    owner.publicKey, puppet.publicKey);
  if (!toApp.ok && /not a command/.test(toApp.error)) {
    test.check('and a packet addressed to an app is not a command either');
  } else {
    test.fail('an app packet was taken as a command: ' + JSON.stringify(toApp));
  }
}

test.reportSuccessFailureCount();
