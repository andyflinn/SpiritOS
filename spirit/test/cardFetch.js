'use strict';

// spirit/test/cardFetch.js
// A NODE THAT HOLDS NO CARD MUST GET ONE, BEFORE A POST NEEDS IT.
//
//   Without a card the post is refused: "no cipher key for that peer —
//   ask for their card first."
//
// ── ASK, ANSWER AND KEEP ────────────────────────────────────────────
//
//   peerPost.js fetchCard   posts the card ask when sealKeyFor comes back
//                           empty, one in flight per peer, again on busy
//   peerPost.js askedCard   marks the slot of an ask; keepCard(slot, answer)
//                           stores the reply
//   peerPost.js answerCard  we answer everybody ELSE's ask
//   server.js keepCard      the keeper: setCard on that key's row of the one table (goal/G40.11)
//
// ── THE FIXTURE IS THE POINT ────────────────────────────────────────
//
// Other peerPost fixtures here seed the recipient's seal key before the
// first post, so only the happy path is reachable through them.
//
// This one (cardWorld.js) builds the FIELD state: `keepCard` and
// `sealKeyFor` are wired to the REAL contacts book, as server.js wires
// them, and the book starts with no row for the peer at all. Nothing is
// planted. If a seal key is ever held here, the code under test obtained
// it — and it had to survive contacts.setCard's own verification to get
// there, which is the check that makes the whole exchange worth anything.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth');
const peerPost = require('../run/spirit/peerPost');
const trafficLog = require('../run/spirit/trafficLog');
const routerTable = require('../run/spirit/router');
const nodeCard = require('../run/spirit/nodeCard');
const contacts = require('../run/spirit/contacts');

test.startTest('A node with no card asks for one before it posts');

// The fixture lives in cardWorld.js, shared with cardRotation.js.
const { fakeRelay, nodeFor, plantCardOf } = require('./cardWorld.js');

(async function () {
  const relay = fakeRelay();
  const asker = nodeFor('asker', relay);
  const target = nodeFor('target', relay);
  const SAID = 'a message that must not travel in clear';

  // ── THE FIXTURE ITSELF, ASSERTED ────────────────────────────────────
  // Everything below is worthless if the book started full.
  if (!asker.sealKeyHeldFor(target.id.publicKey)) {
    test.check('the asker holds NO seal key for the target before anything happens — the field '
      + 'state, which no other fixture in this directory can produce');
  } else {
    test.fail('the fixture planted a key, so every assertion below would pass on a tree where '
      + 'the bug is untouched');
  }

  // ── C0: THE DETECTOR CAN SEE, SO A ZERO BELOW IS A REAL ZERO ───────
  //
  // C3 and C4 count asks and expect none. If `asksSent` could never see
  // an ask, both would pass on any tree at all — the exact vacuity this
  // suite exists to end. Two halves, neither needing the card fetch:
  {
    const shaped = JSON.stringify({ v: 1, id: 'x', body: { card: 'please' } });
    if (nodeCard.asks(shaped)) {
      test.check('the recogniser fires on an unsealed card ask, so an ask that went out would '
        + 'be recognised');
    } else {
      test.fail('nodeCard.asks does not recognise a card ask, so the counts below mean nothing');
    }

    const detector = nodeFor('known-detector', relay);
    plantCardOf(detector, target);
    // Deliberately the SAME words the asker will try to send: this post
    // really is sealed and really does reach the transport, so if these
    // words turn up on the wire in clear, sealing is broken and C7 says so.
    await detector.P.post('http://relay', target.id.publicKey, SAID);
    if (detector.wireFrom().length > 0) {
      test.check('and the wire records what a node sends, attributed to it — so the two halves '
        + 'together mean a zero ask count below is a zero, not a blind spot');
    } else {
      test.fail('nothing was recorded on the wire even after a successful post, so the ask '
        + 'counts below cannot tell absent from invisible');
    }
  }

  // ── C1 / C2 / C4: THE FETCH ITSELF ─────────────────────────────────
  //
  // Branched on the OUTCOME rather than on whether some function exists:
  // a seal key the fixture never planted can only be held by a card that
  // was actually asked for, answered, and verified. The awaiting branch
  // is the old declaration from before peerPost.js fetchCard existed; it
  // is reached only if the fetch stops working.
  const answer = await asker.P.post('http://relay', target.id.publicKey, SAID);
  const fetched = !!asker.sealKeyHeldFor(target.id.publicKey);

  if (fetched) {
    test.check('after posting to a peer it had no card for, the asker HOLDS its seal key — '
      + 'fetched, verified by contacts.setCard, and kept');

    if (answer && answer.ok) {
      test.check('and the post itself succeeded — a missing card is a thing to fix on the way, '
        + 'not a thing to refuse forever');
    } else {
      test.fail('the card was fetched but the post was still refused (' + (answer && answer.status)
        + ': ' + (answer && answer.error) + '). Fetching a key and then not using it is the '
        + 'round trip without the delivery');
    }

    // ONE ASK PER MISSING CARD, NOT ONE PER POST.
    const afterFirst = asker.asksSent().length;
    await asker.P.post('http://relay', target.id.publicKey, 'a second message');
    const afterSecond = asker.asksSent().length;
    if (afterFirst === 1 && afterSecond === 1) {
      test.check('exactly one card ask for that peer, and the second post sent none — an ask per '
        + 'POST rather than per MISSING CARD would put a round trip on every message forever');
    } else {
      test.fail('ask count on the wire went ' + afterFirst + ' then ' + afterSecond
        + '; wanted exactly one, once');
    }
  } else {
    const why = (answer && answer.error) || JSON.stringify(answer);
    const est = { there: 66, cost: 'one caller on the send path. Two of the three halves are '
      + 'built: peerPost.js:823 already records `askedCard` on the slot and :411 already keeps '
      + 'a verified answer. Missing: the decision to ask when sealKeyFor comes back empty' };
    test.awaiting('cycle-10/R5', 'the card ask — the caller that notices a missing key',
      false, 'a node posting to a peer whose card it lacks ends up holding that card. Today: '
      + asker.asksSent().length + ' asks on the wire and the post refused with "' + why + '"', est);
    test.awaiting('cycle-10/R5', 'a post that survives a missing card',
      false, 'the post itself succeeds after the fetch, because a missing card is a thing to '
      + 'fix on the way rather than refuse forever. THIS IS WHAT IS BROKEN IN THE FIELD: '
      + '11,628 posts refused since 2026-09-23, every agent report lost', est);
    test.awaiting('cycle-10/R5', 'one ask per missing card, not one per post',
      false, 'the second post to the same peer sends no further ask — otherwise the fix costs '
      + 'a round trip on every message forever', est);
  }

  // ── C8: A BURST TO ONE UNCARDED PEER LOSES NOTHING ─────────────────
  //
  // peerPost.js fetchCard remembers the in-flight ask's PROMISE
  // (`asking[toKey]`), so concurrent posts to an uncarded peer await that
  // one ask instead of skipping it and refusing 428. A throttle that only
  // remembered a timestamp passes every other check in this file and
  // fails this one.
  {
    const relay2 = fakeRelay();
    const many = nodeFor('burst', relay2);
    const peer = nodeFor('burst-peer', relay2);
    const posts = [];
    for (let i = 1; i <= 10; i += 1) {
      posts.push(many.P.post('http://relay', peer.id.publicKey, 'report ' + i));
    }
    const answers = await Promise.all(posts);
    const ok = answers.filter(function (a) { return a && a.ok; }).length;
    const asks = relay2.wire.filter(function (w) {
      return w.from === many.id.publicKey && nodeCard.asks(w.text);
    }).length;
    if (ok === 10 && asks === 1) {
      test.check('ten posts fired at once to a peer with no card all arrive, on ONE shared ask '
        + '— the nine that lose the race wait for the ask in flight instead of skipping it '
        + 'and refusing');
    } else {
      test.fail(ok + ' of 10 concurrent posts arrived on ' + asks + ' ask(s). A throttle that '
        + 'remembers WHEN it asked rather than the ask ITSELF lets the losers past with no '
        + 'card and refuses them');
    }
  }

  // ── C3: THE CONTROL — A NODE THAT ALREADY KNOWS ASKS NOTHING ───────
  {
    const known = nodeFor('known', relay);
    plantCardOf(known, target);
    await known.P.post('http://relay', target.id.publicKey, 'no ask should precede this');
    if (known.asksSent().length === 0) {
      test.check('a node that already holds a card sends NO ask — without this the fix could '
        + 'cost every post a round trip and C1 could not tell the difference');
    } else {
      test.fail('a node that already had the card asked anyway');
    }
  }

  // ── C6: A CARD FOR SOMEBODY ELSE IS REFUSED ────────────────────────
  //
  //   "everything else is a missing feature; that one is a hole."
  //
  // A relay that answers our ask with its OWN card gets everything we
  // ever send sealed to it. Both layers refuse independently —
  // peerPost.js codes it `card-wrong-key`, contacts.setCard refuses it and keeps nothing of it (goal/G40.11:
  // "any other is refused and nothing of it kept") — and the fetch must not
  // route around either. Checked at the keeper, which is the layer the
  // fetch hands its answer to.
  {
    const victim = nodeFor('victim', relay);
    const impostor = nodeFor('impostor', relay);
    const verdict = contacts.setCard(asker.home, victim.id.publicKey,
      nodeCard.cardFrom(Object.assign({ name: impostor.name }, impostor.id)));
    const row = contacts.byPublicKey(asker.home, victim.id.publicKey);
    if (verdict && !verdict.ok && verdict.why === 'wrong key' && verdict.signedBy === impostor.id.publicKey
        && !contacts.sealKeyOf(row) && !(row && row.card)) {
      test.check('a card signed by somebody else is refused as `wrong key`, naming who signed it, and nothing of '
        + 'it is kept: no card, no seal key on the row');
    } else {
      test.fail('a wrong-key card was not refused cleanly: ' + JSON.stringify(verdict)
        + ' sealKey=' + JSON.stringify(contacts.sealKeyOf(row)));
    }
  }

  // ── C7: THE ASK IS THE ONLY UNSEALED THING ON THE WIRE ─────────────
  //
  // The card ask is deliberately plaintext — it cannot be sealed, since
  // it exists to obtain the key. It is the one hole in cycle 10's R5, and
  // it must stay exactly one hole: nothing the caller says may ride out
  // beside it, and no ordinary post may be sent in clear as a fallback
  // when the ask fails.
  {
    const leaked = relay.wire.filter(function (w) { return w.text.indexOf(SAID) !== -1; });
    const unsealedNotAsk = asker.wireFrom().filter(function (w) {
      return !nodeCard.asks(w.text) && /^\s*\{/.test(w.text) && w.text.indexOf('"body"') !== -1;
    });
    if (leaked.length === 0 && unsealedNotAsk.length === 0) {
      test.check('nothing on the wire carries the message in clear, and the only unsealed thing '
        + 'the asker sent is the card ask — which cannot be sealed, because it exists to '
        + 'obtain the key');
    } else if (leaked.length) {
      test.fail(leaked.length + ' payload(s) reached the transport carrying the plaintext. A '
        + 'card fetch that falls back to sending unsealed is worse than the refusal it replaced');
    } else {
      test.fail(unsealedNotAsk.length + ' unsealed non-ask packet(s) on the wire — the ask is '
        + "meant to be the only hole in cycle 10's R5, not the first of several");
    }
  }

  // ── C5: A PEER THAT NEVER ANSWERS ──────────────────────────────────
  //
  // The ask goes out, nothing comes back, and the caller must get a
  // status rather than a hang or a silent drop.
  {
    const ghost = auth.generateIdentity('ghost');
    const r = await asker.P.post('http://relay', ghost.publicKey, 'into the void');
    if (r && !r.ok && r.status) {
      test.check('a peer that never answers the ask refuses with a status (' + r.status
        + ') rather than waiting forever or dropping it quietly');
    } else {
      test.fail('posting to an unreachable peer did not refuse cleanly: ' + JSON.stringify(r));
    }
  }

  // ── C9: A BUSY TARGET IS A WAIT, NOT A REFUSAL ─────────────────────
  //
  // A card ask the relay turns away 503 target-busy (the target is already
  // taking a request) is asked again after the relay's retryAfterMs, for
  // at most CARD_ASK_PATIENCE_MS (peerPost.js fetchCard, askOnce), so the
  // message behind it is not refused no-cipher-key. An ordinary post
  // re-queues on busy too (peerPost.js, queue.busy).
  {
    const relay2 = fakeRelay({ busyAsks: 1 });
    const sender = nodeFor('busy-asker', relay2);
    const peer = nodeFor('busy-peer', relay2);
    const r = await sender.P.post('http://relay', peer.id.publicKey, 'arrives after the target frees up');
    const asks = relay2.wire.filter(function (w) {
      return w.from === sender.id.publicKey && nodeCard.asks(w.text);
    }).length;
    if (r && r.ok && sender.sealKeyHeldFor(peer.id.publicKey)) {
      test.check('a card ask turned away as BUSY is asked again after the relay\'s retryAfterMs, and '
        + 'the message arrives — ' + asks + ' asks on the wire');
    } else {
      test.fail('a busy target made the card fetch give up: ' + (r && r.status) + ' ' + (r && r.error)
        + ' after ' + asks + ' ask(s). Busy means wait (0016), and an ordinary post already '
        + 're-queues on it; the card ask does not, so a message to a peer who is merely busy fails');
    }
  }

  test.reportSuccessFailureCount();
}());
