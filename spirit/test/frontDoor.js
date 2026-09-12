'use strict';

// spirit/test/frontDoor.js
// Who a node will hear from, on the path packets actually arrive on.
//
// THE GAP THIS CLOSES, and it is the second of its kind. `listenSet`
// ("everyone it has actually acquired, plus itself") existed, with a
// considered policy for strangers behind it — and it was wired to the
// `inbox` read and nowhere else. peerPost.onRequest checked that a
// signature matched the sender it claimed and that the packet was
// addressed here. That proves possession of a key. It proves nothing
// about whether this node has ever heard of the holder.
//
// Andy: "no node, by protocol, should accept requests from unknown."
//
// The first of its kind was the enrolment rate limit, which died with
// deviceHandshake.js. Twice now a gate has lived on a transport being
// retired and not been carried to the one replacing it — invisible both
// times, because nothing fails when a check is merely absent.
//
// Two things are tested here and they are not the same thing:
//
//   the PREFERENCE  — silent / hold / acquire, the operator's to set
//   the FLOOR       — what a stranger may spend, nobody's to set
//
// A user can consent to hearing from strangers. Nobody is asked to
// consent to unbounded strangers, so the floor is in code.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const peerPost = require('../run/js/peerPost');
const relayKeys = require('../run/js/relayKeys');
const whoBook = require('../run/js/whoBook');
const hub = require('../run/js/hub');
const world = require('./world');

test.startTest('The front door — a signature is not an introduction');

const RELAY = 'http://relay.example';

// A request as it arrives off the stream: signed by the sender, over the
// bytes, addressed to this node.
function arriving(sender, to, text) {
  return {
    from: sender.publicKey,
    to: to,
    text: text,
    sig: auth.sign(sender.privateKey, auth.postMessage(sender.publicKey, to, text)),
  };
}

// A node with a router, an address book, and a door that can be told who
// is welcome. `traffic` is captured rather than written so the log can be
// read back without a file.
function nodeWith(opts) {
  opts = opts || {};
  const home = opts.home || world.tmpHome('frontdoor');
  const me = opts.me || auth.generateIdentity('andy');
  if (!opts.home) auth.saveIdentity(home, me);
  const logged = [];
  const arrived = [];
  const replies = [];
  const router = peerPost.createPeerPost({
    rootDir: home,
    request: function (url, method, pathname, body) {
      if (/\/api\/relay\/reply$/.test(pathname)) replies.push(body);
      return Promise.resolve({ status: 200, text: '{}' });
    },
    traffic: { note: function (e) { logged.push(e); } },
    onArrival: function (item) { arrived.push(item); },
    answer: opts.answer || null,
    admit: opts.noDoor ? null : function (from) { return hub.frontDoor(home, from); },
    remember: function (from, verdict) { return hub.remember(home, from, verdict); },
  });
  return { home: home, me: me, router: router, logged: logged, arrived: arrived, replies: replies };
}

async function theDefaultIsUnchanged() {
  test.subHeading('A router built without a door admits everybody');

  // EVERY EXISTING CALLER GETS THIS, which is why the harness stayed
  // green when the door was added: `admit` is optional, and its absence
  // is what this file did unconditionally until 2026-09-12. Stated as a
  // check rather than assumed, because "the tests still pass" is exactly
  // what an unwired gate looks like.
  const N = nodeWith({ noDoor: true });
  const stranger = auth.generateIdentity('nobody');
  await N.router.onRequest(RELAY, arriving(stranger, N.me.publicKey, 'hello'));

  if (N.arrived.length === 1) {
    test.check('with no door given, a stranger is delivered — the old behaviour, on purpose');
  } else {
    test.fail('default door: ' + N.arrived.length + ' arrivals');
  }
}

async function knownAndStranger() {
  test.subHeading('Acquired is heard; a stranger is not');

  const friend = auth.generateIdentity('bella');
  const stranger = auth.generateIdentity('nobody');

  const N = nodeWith({});
  // 'message' rather than a bare acquire: whoBook's ACQUIRED_LISTENING is
  // ['message', 'invite', 'handle'], so a census row is somebody merely
  // SEEN and is deliberately not somebody this node hears. Having noticed
  // a stranger exists is not an introduction, and a first draft of this
  // suite failed for exactly that reason.
  whoBook.acquire(N.home, {
    publicKey: friend.publicKey, publicLabel: 'bella', relays: [RELAY],
  }, 'message');

  await N.router.onRequest(RELAY, arriving(friend, N.me.publicKey, 'from a friend'));
  if (N.arrived.length === 1 && N.arrived[0].text === 'from a friend') {
    test.check('somebody in the book reaches the apps');
  } else {
    test.fail('friend: ' + JSON.stringify(N.arrived.map(function (i) { return i.text; })));
  }

  // THE CHECK THIS FILE EXISTS FOR. A perfectly valid signature from a
  // key this node has never heard of.
  await N.router.onRequest(RELAY, arriving(stranger, N.me.publicKey, 'from nobody'));
  if (N.arrived.length === 1) {
    test.check('and a stranger with a perfect signature reaches no app at all');
  } else {
    test.fail('stranger reached an app: ' + JSON.stringify(N.arrived.map(function (i) { return i.text; })));
  }

  // Still receipted. The bytes did arrive, and a sender being ignored is
  // not owed the difference between "ignored" and "unreachable".
  if (N.replies.length === 2) {
    test.check('but is still receipted — silence is not a different answer from refusal');
  } else {
    test.fail('replies: ' + N.replies.length);
  }

  // And the drop is written down, WITHOUT the line. That something was
  // ignored is this node's own business to know; keeping the text of a
  // line the operator asked not to keep would be the log contradicting
  // the setting.
  const ignored = N.logged.filter(function (e) { return e.outcome === 'ignored'; });
  if (ignored.length === 1 && ignored[0].payload === undefined &&
      ignored[0].peer === stranger.publicKey) {
    test.check('and logged as ignored, with no payload — the record is honest and cheap');
  } else {
    test.fail('ignored entries: ' + JSON.stringify(ignored));
  }
}

async function theRelayIsKnownIfAccepted() {
  test.subHeading('A relay this node accepted is known; one it did not is not');

  // THE EXCEPTION THE INBOX PATH NEVER NEEDED. listenSet's own comment
  // says "the mailbox needs no exception here" — true of a path relay
  // traffic never arrived on. A relay posts HERE in its own name to
  // carry a device enrolment, and a relay is not a contact.
  const relayId = auth.generateIdentity('relay');
  const impostor = auth.generateIdentity('not-a-relay');

  const N = nodeWith({});
  relayKeys.accept(N.home, RELAY, relayId.publicKey);

  await N.router.onRequest(RELAY, arriving(relayId, N.me.publicKey, '{"relay":"device-offer"}'));
  if (N.arrived.length === 1) {
    test.check('an accepted relay is heard, so an enrolment it carries is not refused at the door');
  } else {
    test.fail('relay refused: ' + N.arrived.length);
  }

  // And only one that was accepted. Without relayKeys, "is this a relay?"
  // could only be answered by asking the thing that wants in.
  await N.router.onRequest(RELAY, arriving(impostor, N.me.publicKey, '{"relay":"device-offer"}'));
  if (N.arrived.length === 1) {
    test.check('and a key claiming to be a relay, which this node never accepted, is not');
  } else {
    test.fail('impostor admitted');
  }
}

async function thePreference() {
  test.subHeading('The preference decides who you talk to');

  const stranger = auth.generateIdentity('nobody');

  // `acquire` — writing is enough. The row is written BEFORE the packet
  // is delivered, which is what keeps "apps see admitted senders only"
  // true rather than nearly true.
  const A = nodeWith({});
  fs.writeFileSync(path.join(A.home, 'preferences.json'),
    JSON.stringify({ unknownSenders: 'acquire' }));
  await A.router.onRequest(RELAY, arriving(stranger, A.me.publicKey, 'hello'));
  const row = whoBook.byPublicKey(A.home, stranger.publicKey);
  if (A.arrived.length === 1 && row) {
    test.check('under `acquire` a stranger gets a row and is delivered');
  } else {
    test.fail('acquire: arrived=' + A.arrived.length + ' row=' + !!row);
  }

  // `hold` — a waiting row, and NO app delivery. The line is filed so a
  // human can decide; an app is not handed it and asked afterwards.
  const H = nodeWith({});
  fs.writeFileSync(path.join(H.home, 'preferences.json'),
    JSON.stringify({ unknownSenders: 'hold' }));
  await H.router.onRequest(RELAY, arriving(stranger, H.me.publicKey, 'hello'));
  const held = whoBook.byPublicKey(H.home, stranger.publicKey);
  if (held && H.arrived.length === 0) {
    test.check('under `hold` they get a waiting row and reach no app');
  } else {
    test.fail('hold: row=' + !!held + ' arrived=' + H.arrived.length);
  }

  // The packet is still filed under hold, with its payload: the operator
  // asked to be told there is somebody there, which means keeping what
  // they sent until the decision is made.
  const kept = H.logged.filter(function (e) { return e.outcome === 'delivered'; });
  if (kept.length === 1 && kept[0].payload === 'hello') {
    test.check('and what they sent is kept, because a decision is still to be made about it');
  } else {
    test.fail('hold log: ' + JSON.stringify(H.logged));
  }

  // A broken preferences.json is not an open door. The safe answer is
  // also the default.
  const B = nodeWith({});
  fs.writeFileSync(path.join(B.home, 'preferences.json'), '{ not json');
  await B.router.onRequest(RELAY, arriving(stranger, B.me.publicKey, 'hello'));
  if (B.arrived.length === 0) {
    test.check('and a broken preferences.json reads as silent, never as acquire');
  } else {
    test.fail('broken prefs admitted a stranger');
  }
}

async function theFloor() {
  test.subHeading('The floor decides what a stranger can spend');

  // NOBODY'S TO SET. Under `acquire` the operator has said "let
  // strangers reach me" — which is a social choice, and not a choice to
  // let unbounded strangers write to this node's disk at line speed.
  // What is bounded is the cost, never the contact.
  const N = nodeWith({});
  fs.writeFileSync(path.join(N.home, 'preferences.json'),
    JSON.stringify({ unknownSenders: 'acquire' }));

  // A fresh key each time, so the per-sender bucket is not what bites —
  // this is the aggregate byte budget, which is the one an attacker with
  // many keys would otherwise walk around.
  const big = 'x'.repeat(9000);
  let refusedAt = 0;
  for (let n = 1; n <= 12; n += 1) {
    const who = auth.generateIdentity('flood-' + n);
    /* eslint-disable no-await-in-loop */
    const got = await N.router.onRequest(RELAY, arriving(who, N.me.publicKey, big));
    if (got === null && !refusedAt) refusedAt = n;
  }
  if (refusedAt > 1 && refusedAt <= 9) {
    test.check('a stranger flood is cut off by the byte budget — at request ' + refusedAt +
      ' of 9KB each, under `acquire`');
  } else {
    test.fail('byte budget did not bite: first refusal at ' + refusedAt);
  }

  // Over the floor, NOTHING is filed and nothing is receipted. A receipt
  // means "this arrived and is filed", and saying so about a packet that
  // was dropped would be the one lie this path must not tell.
  const over = N.logged.filter(function (e) { return e.outcome === 'refused'; });
  if (over.length && over.every(function (e) { return e.payload === undefined; })) {
    test.check('and refused before the log, so a stranger cannot make this node store their bytes');
  } else {
    test.fail('refused entries: ' + JSON.stringify(over.slice(0, 2)));
  }

  // PER SENDER TOO, so one key cannot spend a budget in small pieces and
  // stay under the byte cap.
  //
  // Tested under `silent`, and the reason is a property worth naming: a
  // sender only stays a stranger while the policy leaves them one. Under
  // `acquire` the first message makes them a contact, so they have
  // exactly ONE rationed request in them and the per-minute bucket can
  // never bite — which is correct, because rationing a contact is not
  // what the floor is for. A first draft of this check used `acquire`
  // and found nothing, for that reason.
  const M = nodeWith({});
  fs.writeFileSync(path.join(M.home, 'preferences.json'),
    JSON.stringify({ unknownSenders: 'silent' }));
  const one = auth.generateIdentity('persistent');
  let stopped = 0;
  for (let n = 1; n <= 10; n += 1) {
    /* eslint-disable no-await-in-loop */
    const got = await M.router.onRequest(RELAY, arriving(one, M.me.publicKey, 'tiny'));
    if (got === null && !stopped) stopped = n;
  }
  if (stopped === 7) {
    test.check('one key that stays a stranger gets six a minute, whatever the size');
  } else {
    test.fail('per-sender bucket stopped at ' + stopped + ', expected 7');
  }

  // AND THE OTHER HALF OF THAT PROPERTY, said out loud so it is a
  // decision rather than a side effect: under `acquire`, one key is
  // rationed exactly once and is a contact from then on.
  const K = nodeWith({});
  fs.writeFileSync(path.join(K.home, 'preferences.json'),
    JSON.stringify({ unknownSenders: 'acquire' }));
  const newcomer = auth.generateIdentity('newcomer');
  for (let n = 0; n < 10; n += 1) {
    /* eslint-disable no-await-in-loop */
    await K.router.onRequest(RELAY, arriving(newcomer, K.me.publicKey, 'hello'));
  }
  if (K.arrived.length === 10 && whoBook.listens(whoBook.byPublicKey(K.home, newcomer.publicKey))) {
    test.check('while under `acquire` one message makes them a contact, and a contact is not rationed');
  } else {
    test.fail('acquire newcomer: arrived=' + K.arrived.length);
  }

  // THE FLOOR DOES NOT BIND A FRIEND. It is about strangers, and a
  // contact who talks a lot is not a stranger.
  const F = nodeWith({});
  const friend = auth.generateIdentity('bella');
  whoBook.acquire(F.home, { publicKey: friend.publicKey, publicLabel: 'bella', relays: [] }, 'message');
  for (let n = 0; n < 20; n += 1) {
    /* eslint-disable no-await-in-loop */
    await F.router.onRequest(RELAY, arriving(friend, F.me.publicKey, 'x'.repeat(9000)));
  }
  if (F.arrived.length === 20) {
    test.check('while somebody in the book is not rationed at all — the floor is about strangers');
  } else {
    test.fail('a friend was rationed: ' + F.arrived.length + ' of 20');
  }
}

async function theAnswerIsGatedToo() {
  test.subHeading('And the one verb that ACTS on a request is gated with the rest');

  // `answer` is what decides a device enrolment. Composing an answer for
  // a sender this node would not hear from would put the front door's
  // judgement behind the only verb that does anything.
  const asked = [];
  const stranger = auth.generateIdentity('nobody');
  const N = nodeWith({ answer: function (item) { asked.push(item.from); return 'x'; } });

  await N.router.onRequest(RELAY, arriving(stranger, N.me.publicKey, '{"relay":"device-offer"}'));
  if (asked.length === 0) {
    test.check('a stranger never reaches the answerer, so cannot drive an enrolment');
  } else {
    test.fail('answerer was asked about a stranger');
  }

  const friend = auth.generateIdentity('bella');
  whoBook.acquire(N.home, { publicKey: friend.publicKey, publicLabel: 'bella', relays: [] }, 'message');
  await N.router.onRequest(RELAY, arriving(friend, N.me.publicKey, 'hi'));
  if (asked.length === 1 && asked[0] === friend.publicKey) {
    test.check('and somebody admitted does');
  } else {
    test.fail('asked: ' + JSON.stringify(asked.map(function (k) { return k.slice(-8); })));
  }
}

async function run() {
  await theDefaultIsUnchanged();
  await knownAndStranger();
  await theRelayIsKnownIfAccepted();
  await thePreference();
  await theFloor();
  await theAnswerIsGatedToo();
  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
