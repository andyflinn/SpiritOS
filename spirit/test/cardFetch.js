'use strict';

// spirit/test/cardFetch.js
// A NODE THAT HOLDS NO CARD MUST GET ONE, BEFORE A POST NEEDS IT.
//
//   The refusal has been naming the cure 11,628 times since 2026-09-23:
//   "no cipher key for that peer — ask for their card first."
//
// Andy, 2026-09-26: "windows will implement the card fetch, and you will
// test it" — under his standing rule that "we do best when we strictly
// divide implementation from testing". So these assertions are written
// BEFORE the caller exists and are red on purpose, to measure an
// implementation against a contract it did not choose.
//
// ── ASK, ANSWER AND KEEP ARE THREE HALVES AND TWO OF THEM EXIST ─────
//
//   peerPost.js:823   records `askedCard` on the slot when one was sent
//   peerPost.js:411   keepCard(slot, answer) stores the reply
//   peerPost.js:980   answerCard — we answer everybody ELSE's ask
//   server.js:1262-5  the keeper: upsert at ROLL, then setCard(...'reply')
//
// Only the DECISION TO ASK is missing. That is why three days of total
// reporting failure passed with a green board.
//
// ── THE FIXTURE IS THE POINT, AND IT DID NOT EXIST ──────────────────
//
// Every other peerPost fixture here seeds the recipient's seal key into a
// plain map before the first post. So EVERY SUITE THAT HAS EVER POSTED
// HAS POSTED TO A PEER WHOSE KEY THE FIXTURE PLANTED, and only the happy
// path was ever reachable.
//
// This one builds the FIELD state: `keepCard` and `sealKeyFor` are wired
// to the REAL contacts book, copied from server.js rather than imitated,
// and the book starts with no row for the peer at all. Nothing is
// planted. If a seal key is ever held here, the code under test obtained
// it — and it had to survive contacts.setCard's own verification to get
// there, which is the check that makes the whole exchange worth anything.
//
// A SIXTH TWO-NODE RELAY FIXTURE, AND SAID OUT LOUD: peerPost.js,
// answerRelay.js, queueRestart.js, appShellGrant.js and monitorWorld.js
// each hold one. This differs in the one way that matters — it plants
// nothing — so sharing would mean giving all five a flag for the state
// they exist to avoid. Extract when a SECOND suite needs the empty book.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const peerPost = require('../run/js/peerPost');
const trafficLog = require('../run/js/trafficLog');
const routerTable = require('../run/js/router');
const nodeCard = require('../run/js/nodeCard');
const contacts = require('../run/js/contacts');

test.startTest('A node with no card asks for one before it posts');

// ── WHAT COUNTS AS "SENT" IS WHAT REACHED THE TRANSPORT ─────────────
//
// An earlier draft of this suite counted asks and hunted plaintext in the
// node's own traffic log, and C7 went red on a payload that HAD NEVER
// BEEN SENT: a post refused for a missing key is still recorded locally,
// in clear, with `outcome: 'refused', code: 'no-cipher-key'` — the log
// keeps payloads deliberately (trafficLog.js:14-17) and it is a record of
// what this node did, not of what left it. Measured rather than assumed:
// with the key absent the transport was called ZERO times.
//
// So the relay records `wire` — every body handed to it — and that is the
// only surface these assertions read. A local log cannot make a suite
// claim something crossed a network.
function fakeRelay() {
  const routes = routerTable.createRouter({});
  const streams = Object.create(null);
  const wire = [];
  return {
    wire: wire,
    listen: function (key, onEvent) { streams[key] = onEvent; },
    request: function (url, method, pathname, body) {
      wire.push({ pathname: pathname, from: (body && body.from) || '', to: (body && body.to) || '',
        text: String((body && body.text) || '') });
      if (/\/api\/relay\/post$/.test(pathname)) {
        const verified = auth.postSignatureFor(body.from, body.from, body.to, body.text, body.sig);
        if (!verified) return Promise.resolve({ status: 403, text: '{"error":"bad sig"}' });
        if (!streams[body.to]) return Promise.resolve({ status: 503, text: '{"error":"peer not reachable"}' });
        const hash = auth.requestHash(verified);
        const opened = routes.open(hash, body.from, body.to, function () {
          streams[body.to]('request', { from: body.from, to: body.to, text: body.text, sig: body.sig });
          return true;
        });
        if (!opened.ok) return Promise.resolve({ status: opened.status, text: JSON.stringify(opened) });
        return Promise.resolve({ status: 202, text: JSON.stringify({ ok: true, hash: hash }) });
      }
      if (/\/api\/relay\/reply$/.test(pathname)) {
        const matched = routes.answer(body.hash, body.from);
        if (!matched.ok) return Promise.resolve({ status: matched.status, text: JSON.stringify(matched) });
        if (streams[matched.requester]) {
          streams[matched.requester]('reply', { hash: body.hash, from: body.from, text: body.text, sig: body.sig });
        }
        return Promise.resolve({ status: 200, text: '{"ok":true}' });
      }
      return Promise.resolve({ status: 404, text: '{}' });
    },
  };
}

// THE KEEPER AND THE LOOKUP ARE server.js's, NOT AN IMITATION OF THEM.
// A fixture that invented its own would prove the ask happened and
// nothing about whether the answer is usable afterwards.
function nodeFor(name, relay) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cardfetch-'));
  const id = auth.generateIdentity(name);
  auth.saveIdentity(home, id);
  nodeCard.setName(home, name);
  nodeCard.setDescription(home, name + ' publishes a card worth asking for');

  const traffic = trafficLog.createTrafficLog({ rootDir: home });
  const P = peerPost.createPeerPost({
    rootDir: home, request: relay.request, waitMs: 800, traffic: traffic,
    sealKeyFor: function (toKey) {                       // server.js:1281-6
      const row = contacts.byPublicKey(home, toKey);
      return (row && contacts.sealKeyOf(row)) || '';
    },
    keepCard: function (toKey, cardText) {               // server.js:1262-5
      if (!contacts.byPublicKey(home, toKey)) {
        contacts.upsert(home, { publicKey: toKey, acquiredVia: contacts.ROLL });
      }
      return contacts.setCard(home, toKey, cardText, 'reply');
    },
  });
  relay.listen(id.publicKey, function (event, body) {
    if (event === 'request') P.onRequest('http://relay', body);
    else if (event === 'reply') P.onReply(body);
  });
  return {
    name: name, home: home, id: id, P: P, traffic: traffic,
    sealKeyHeldFor: function (toKey) {
      const row = contacts.byPublicKey(home, toKey);
      return (row && contacts.sealKeyOf(row)) || '';
    },
    // Everything THIS node put on the transport, and the subset of it
    // that is a card ask.
    wireFrom: function () {
      return relay.wire.filter(function (w) { return w.from === id.publicKey; });
    },
    asksSent: function () {
      return relay.wire.filter(function (w) {
        return w.from === id.publicKey && nodeCard.asks(w.text);
      });
    },
  };
}

// Plant a card the honest way — through the same keeper the code uses —
// for the CONTROL nodes only, and never for the node under test.
function plantCardOf(holder, subject) {
  if (!contacts.byPublicKey(holder.home, subject.id.publicKey)) {
    contacts.upsert(holder.home, { publicKey: subject.id.publicKey, acquiredVia: contacts.ROLL });
  }
  return contacts.setCard(holder.home, subject.id.publicKey,
    nodeCard.cardFrom(Object.assign({ name: subject.name }, subject.id)), 'reply');
}

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
  // suite exists to end. Two halves, neither needing the missing feature:
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
    // Deliberately the SAME words the asker will try to send. It makes
    // C7 bite TODAY rather than only after the fix: this post really is
    // sealed and really does reach the transport, so if these words turn
    // up on the wire in clear, sealing is broken and C7 says so now.
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
  // DECLARED AS AWAITING RATHER THAN LEFT RED, and branched on the
  // OUTCOME rather than on whether some function exists. Two reasons:
  //
  //   A red board costs every other agent their signal, and this suite is
  //   written days before the code it measures. `awaiting` is what this
  //   harness has for a unit that is not there yet.
  //
  //   ARRIVAL, NOT RESEMBLANCE. Probing for a named function would pass
  //   the moment somebody writes one called the right thing. Probing for
  //   a seal key the fixture never planted can only be satisfied by a
  //   card that was actually asked for, answered, and verified — so the
  //   real assertions below fire the DAY the caller lands, with no edit
  //   from me, and nothing can be green by resembling the fix.
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
  // MEASURED AS A DEFECT FIRST, THEN ASSERTED. On 780426a the throttle
  // remembered a TIMESTAMP, so ten concurrent posts to an uncarded peer
  // gave one ask and ONE delivery: the first caller set `askedFor`, the
  // other nine skipped the ask, found the key still absent, and refused
  // 428. It was reported rather than asserted, because the only bursting
  // caller — the agents outbox — flushes serially and could not reach it.
  //
  // spiritos-f6 fixed it at 742c5c1 by remembering the PROMISE instead of
  // the timestamp, so the losers await the in-flight ask. Now that there
  // is behaviour to protect, it is pinned: a timestamp throttle passes
  // every other check in this file and fails this one.
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
  // ever send sealed to it. Both layers already refuse independently —
  // peerPost.js:415 codes it `card-wrong-key`, contacts.js:472 files it
  // under `cardDisputed` and stores nothing — and the fetch must not
  // route around either. Checked at the keeper, which is the layer the
  // new caller will hand its answer to.
  {
    const victim = nodeFor('victim', relay);
    const impostor = nodeFor('impostor', relay);
    contacts.upsert(asker.home, { publicKey: victim.id.publicKey, acquiredVia: contacts.ROLL });
    const verdict = contacts.setCard(asker.home, victim.id.publicKey,
      nodeCard.cardFrom(Object.assign({ name: impostor.name }, impostor.id)), 'reply');
    const row = contacts.byPublicKey(asker.home, victim.id.publicKey);
    if (verdict && !verdict.ok && verdict.why === 'wrong key'
        && !contacts.sealKeyOf(row) && row.cardDisputed && row.cardDisputed.length === 1) {
      test.check('a card signed by somebody else is refused as `wrong key`, leaves NO seal key '
        + 'on the row, and is kept as a dispute rather than dropped — the swap a node gets '
        + 'exactly one chance to notice');
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
  // GREEN TODAY FOR THE WRONG REASON, and said so rather than counted as
  // cover: the missing key is noticed before reachability is, so this
  // refuses 428 before any ask is attempted. It is here because AFTER the
  // fix it is the real assertion — the ask goes out, nothing comes back,
  // and the caller must get a status rather than a hang or a silent drop.
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

  test.reportSuccessFailureCount();
}());
