'use strict';

// spirit/test/peerPost.js
// The node's half of the router: post to a peer, answer a peer.
//
// Two nodes driven in the same process, with a fake relay between them
// that does exactly what the real one does — routes by hash, refuses a
// reply from anyone but the target — so the two halves are tested
// against each other rather than each against a mock of the other.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const peerPost = require('../run/js/peerPost');
const trafficLog = require('../run/js/trafficLog');
const routerTable = require('../run/js/router');

// THE ANSWERER'S LOG IS ON ITS OWN TIMELINE.
//
// `await post(...)` resolves when the ANSWER ARRIVES. It does not mean the
// far node has finished writing down what it said: answerCard logs its
// outbound reply AFTER the reply POST resolves, which is the right order
// (a reply that never left must not be recorded as sent) and is a
// different node's business besides — in the real world, a different
// machine.
//
// These two assertions used to pass on an accident: post() returned a
// chained promise ending in `return answered`, so the asker woke one
// microtask later than it does now that a queue returns `answered`
// directly. That slack was never designed, and a test resting on
// interleaving between two simulated nodes would have broken eventually
// on a slower machine — presenceWire's lesson, applied here before it
// cost an afternoon.
async function settledRow(traffic, pick) {
  for (let n = 0; n < 50; n += 1) {
    const row = traffic.read().filter(pick)[0];
    if (row) return row;
    await new Promise(function (r) { setTimeout(r, 2); });
  }
  return null;
}

function tmpHome(name) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-peerpost-'));
  auth.saveIdentity(home, auth.generateIdentity(name));
  return home;
}

// A relay in twenty lines: the pending table the real one uses, and the
// two routes wired to it. Anything this gets wrong, the real one would
// get wrong too — it is the same module.
function fakeRelay() {
  const routes = routerTable.createRouter({});
  const streams = Object.create(null);
  const R = {
    routes: routes,
    listen: function (key, onEvent) { streams[key] = onEvent; },
    hangUp: function (key) { delete streams[key]; },
    request: function (url, method, pathname, body) {
      if (/\/api\/relay\/post$/.test(pathname)) {
        const verified = auth.postSignatureFor(
          body.from, body.from, body.to, body.text, body.sig
        );
        if (!verified) return Promise.resolve({ status: 403, text: '{"error":"bad sig"}' });
        if (!streams[body.to]) {
          return Promise.resolve({ status: 503, text: '{"error":"peer not reachable"}' });
        }
        const hash = auth.requestHash(verified);
        const opened = routes.open(hash, body.from, body.to, function () {
          streams[body.to]('request', {
            from: body.from, to: body.to, text: body.text, sig: body.sig,
          });
          return true;
        });
        if (!opened.ok) {
          return Promise.resolve({
            status: opened.status,
            text: JSON.stringify({ error: opened.error, inFlight: !!opened.inFlight }),
          });
        }
        return Promise.resolve({ status: 202, text: JSON.stringify({ ok: true, hash: hash }) });
      }
      if (/\/api\/relay\/reply$/.test(pathname)) {
        const matched = routes.answer(body.hash, body.from);
        if (!matched.ok) {
          return Promise.resolve({ status: matched.status, text: JSON.stringify(matched) });
        }
        if (streams[matched.requester]) {
          streams[matched.requester]('reply', {
            hash: body.hash, from: body.from, text: body.text, sig: body.sig,
          });
        }
        return Promise.resolve({ status: 200, text: '{"ok":true}' });
      }
      return Promise.resolve({ status: 404, text: '{}' });
    },
  };
  return R;
}

// `more` carries the seams a particular test needs — a front door
// (`admit`), an app to deliver to (`onArrival`). Left off, a node admits
// everybody and hands packets to nobody, which is what every test here
// wanted before the card arrived.
function nodeFor(name, relay, answer, more) {
  const home = tmpHome(name);
  const id = auth.loadIdentity(home);
  // A REAL traffic log, not a stub. The module has its own suite; what
  // this one is for is the wiring — that the four things worth writing
  // down are actually written down by the code that does the crossing,
  // rather than by a test that calls note() itself.
  const traffic = trafficLog.createTrafficLog({ rootDir: home });
  const P = peerPost.createPeerPost({
    rootDir: home, request: relay.request, waitMs: 800, traffic: traffic,
    answer: answer || null,
    admit: (more && more.admit) || null,
    onArrival: (more && more.onArrival) || null,
    remember: (more && more.remember) || null,
  });
  relay.listen(id.publicKey, function (event, body) {
    if (event === 'request') P.onRequest('http://relay', body);
    else if (event === 'reply') P.onReply(body);
  });
  return { name: name, home: home, id: id, P: P, traffic: traffic };
}

// WHAT CROSSED, WRITTEN DOWN. Decision 0006 ends with a relay that
// remembers nothing, and this is what is left — a refusal nobody recorded
// is indistinguishable from nothing having been tried.
//
// Checked HERE, through a real exchange, because trafficLog's own suite
// can only prove the module keeps what it is handed. Only this one can
// prove the crossings hand it anything.
async function whatCrossedIsWrittenDown() {
  test.subHeading('And every crossing leaves a record');

  const relay = fakeRelay();
  const bert = nodeFor('bert-log', relay);
  const john = nodeFor('john-log', relay);

  // A string no other part of this suite produces, so finding it in a
  // log means it travelled rather than coincided.
  const SECRET = 'quince-lantern-41b7';
  const sent = JSON.stringify({ app: 'relay-chat', v: 1, body: SECRET });

  const answer = await bert.P.post('http://relay', john.id.publicKey, sent);
  if (!answer.ok) { test.fail('the exchange itself failed: ' + JSON.stringify(answer)); return; }

  const out = bert.traffic.read();
  const posted = out.filter(function (r) { return r.dir === 'out' && r.outcome === 'sent'; })[0];
  const closed = out.filter(function (r) { return r.outcome === 'receipted'; })[0];

  if (posted && posted.payload === sent) {
    test.check('the sender kept the packet it sent, byte for byte');
  } else {
    test.fail('outbound payload: ' + JSON.stringify(posted));
  }

  // THE PAIR. post() returns before the answer exists, so the exchange is
  // two entries and the hash is what joins them — which is what a hash is
  // for.
  if (closed && posted && closed.hash === posted.hash && posted.hash) {
    test.check('and the outcome is a second entry joined to it by hash');
  } else {
    test.fail('pair not joined: ' + JSON.stringify({ posted: posted, closed: closed }));
  }

  // A receipt CAME BACK — it crossed the WAN inward, and saying it was
  // outbound would be a small lie repeated forever.
  if (closed && closed.dir === 'in' && closed.kind === 'reply') {
    test.check('and a receipt is recorded as having arrived, not as having left');
  } else {
    test.fail('receipt direction: ' + JSON.stringify(closed));
  }

  // The other end of the same exchange.
  const inbound = john.traffic.read()
    .filter(function (r) { return r.dir === 'in' && r.kind === 'request'; })[0];
  if (inbound && inbound.payload === sent && inbound.peer === bert.id.publicKey) {
    test.check('the receiver kept what arrived, and who it was from');
  } else {
    test.fail('inbound entry: ' + JSON.stringify(inbound));
  }

  if (inbound && inbound.relay === 'http://relay' && posted.relay === 'http://relay') {
    test.check('and both ends recorded which relay carried it');
  } else {
    test.fail('relay missing: ' + JSON.stringify({ out: posted.relay, in: inbound && inbound.relay }));
  }

  // NOTHING OPENED THE ENVELOPE. The payload above names its app; that is
  // the shell's to read, and a log that did it would be the middle layer
  // doing the top layer's work.
  const everyField = [].concat(out, john.traffic.read()).reduce(function (all, row) {
    return all.concat(Object.keys(row));
  }, []);
  if (everyField.indexOf('app') === -1) {
    test.check('and no entry anywhere grew an `app` field');
  } else {
    test.fail('something read the envelope: ' + everyField.join(','));
  }

  // A REFUSAL IS THE ENTRY THAT MATTERS MOST. It is the whole reason this
  // log exists: once a relay stores nothing, this is the only evidence
  // that a thing was tried and did not land.
  const stranger = auth.generateIdentity('nobody');
  const refused = await bert.P.post('http://relay', stranger.publicKey, '{"ping":1}');
  if (refused.ok) { test.fail('a post to nobody succeeded'); return; }

  const failure = bert.traffic.read().filter(function (r) {
    return r.outcome === 'refused' || r.outcome === 'no-answer';
  })[0];
  if (failure && failure.peer === stranger.publicKey) {
    test.check('a post that went nowhere is on the record, with who it was for');
  } else {
    test.fail('no refusal logged: ' + JSON.stringify(bert.traffic.read().map(function (r) {
      return r.outcome;
    })));
  }
}

// A NODE THAT ANSWERS, rather than only acknowledging.
//
// Until now `onRequest` sent an empty receipt and could send nothing
// else: "a receipt is not a reply ... whether an app is home to compose
// an answer is a different question", and this file answered it by never
// asking. The reply's `text` has been on the wire from the start and has
// always been ''.
//
// This is the first real use of it, and it is not about devices — an
// answer is what a request is FOR. Devices are simply the first thing
// that needs one.
async function aNodeCanAnswer() {
  test.subHeading('A request can be answered, not merely acknowledged');

  const relay = fakeRelay();
  const asked = [];
  const bert = nodeFor('bert-ans', relay);
  const john = nodeFor('john-ans', relay, function (item) {
    asked.push(item);
    return JSON.stringify({ pong: JSON.parse(item.text).ping });
  });

  const answer = await bert.P.post('http://relay', john.id.publicKey, '{"ping":7}');

  if (answer.ok && answer.text === '{"pong":7}') {
    test.check('the answer comes back to the asker, in the reply the receipt always had room for');
  } else {
    test.fail('answer: ' + JSON.stringify(answer));
  }

  // The answerer is handed the item it is answering, hash and all, so it
  // can tell one request from another.
  if (asked.length === 1 && asked[0].from === bert.id.publicKey && asked[0].hash === answer.hash) {
    test.check('and the answerer was handed the request it is answering');
  } else {
    test.fail('asked: ' + JSON.stringify(asked));
  }

  // STILL SIGNED AS A RECEIPT. The signature is over the hash and
  // nothing else, so an answer cannot be moved onto a different request
  // — the thing that made the receipt trustworthy is untouched by its
  // having gained a body.
  if (answer.receipt === true && answer.from === john.id.publicKey) {
    test.check('and it is still the answerer signing over the hash, body or no body');
  } else {
    test.fail('receipt shape: ' + JSON.stringify(answer));
  }

  test.subHeading('And an answerer that fails cannot cost the receipt');

  // The receipt is the load-bearing half: it says the bytes arrived. An
  // answerer that throws, or returns something that is not a string,
  // must not be able to turn that into silence — the asker would read it
  // as "never got there", which is the one thing that must stay true.
  const thrower = nodeFor('thrower', relay, function () { throw new Error('no'); });
  const toThrower = await bert.P.post('http://relay', thrower.id.publicKey, '{"ping":1}');
  if (toThrower.ok && toThrower.text === '') {
    test.check('an answerer that throws still leaves the plain receipt behind');
  } else {
    test.fail('after a throw: ' + JSON.stringify(toThrower));
  }

  const nonsense = nodeFor('nonsense', relay, function () { return { not: 'a string' }; });
  const toNonsense = await bert.P.post('http://relay', nonsense.id.publicKey, '{"ping":1}');
  if (toNonsense.ok && toNonsense.text === '') {
    test.check('and so does one that answers with something that is not text');
  } else {
    test.fail('after nonsense: ' + JSON.stringify(toNonsense));
  }

  // An answer may take a moment — installing something, asking a file.
  const slow = nodeFor('slow', relay, function () {
    return new Promise(function (r) { setTimeout(function () { r('later'); }, 40); });
  });
  const toSlow = await bert.P.post('http://relay', slow.id.publicKey, '{"ping":1}');
  if (toSlow.ok && toSlow.text === 'later') {
    test.check('and an answer that takes a moment is waited for, not dropped');
  } else {
    test.fail('after a slow answer: ' + JSON.stringify(toSlow));
  }

  // WHAT WENT OUT IS ON THE RECORD. An answer is bytes crossing the WAN
  // like any other, and the log keeps it whole.
  const said = await settledRow(slow.traffic, function (r) {
    return r.dir === 'out' && r.kind === 'reply';
  });
  if (said && said.payload === 'later') {
    test.check('and the answerer wrote down what it said');
  } else {
    test.fail('no outbound reply logged: ' + JSON.stringify(slow.traffic.read()));
  }
}

test.startTest('Peer post — a node asks a node');

// ── THE CARD ────────────────────────────────────────────────────────
//
//   Andy: "the node should have a verb that is always answered like name
//   or description, that'll be the first two relay peerPost to test, the
//   description is what I want to replace the ugly end-of-key stuff with
//   in the UI."
//   Andy: "this should be answered by the node straight away, before
//   optionally streaming the packet to shell."
//
// Two things are being proven and they pull in opposite directions, which
// is why they are one test: the card is answered to somebody this node
// would not hear a word from, AND that same packet reaches no app. A
// version that got the first right and the second wrong would be a hole:
// a stranger the front door dropped, delivered to an app anyway.
async function aCardIsAnsweredToAnybody() {
  test.subHeading('A node answers for itself, to anybody, and tells no app');

  const relay = fakeRelay();
  const stranger = nodeFor('stranger-card', relay);

  const delivered = [];
  const answered = [];
  const remembered = [];
  const sonny = nodeFor('sonny-card', relay, function (item) {
    answered.push(item);
    return JSON.stringify({ ok: true, from: 'the app' });
  }, {
    // THE WELCOMING DOOR, and that is the point of choosing it. Under
    // `admit` a stranger's packet is filed, counted, remembered and handed
    // to the app — every one of the things a card must not do. A node set
    // to `drop` would do none of them anyway, so testing there would prove
    // the setting rather than the change.
    admit: function () { return 'admit'; },
    onArrival: function (item) { delivered.push(item); },
    remember: function (from) { remembered.push(from); },
  });

  const SAID = 'jazz, a synth in the corner, and no small talk';
  auth.setDescription(sonny.home, SAID);

  const card = await stranger.P.post('http://relay', sonny.id.publicKey,
    JSON.stringify({ v: 1, body: { describe: true } }));

  let said = null;
  try { said = JSON.parse(card.text).body; } catch (e) { said = null; }

  if (card.ok && said && said.description === SAID) {
    test.check('a stranger asks what this node is, and is told');
  } else {
    test.fail('card: ' + JSON.stringify(card));
  }

  if (said && said.name === 'sonny-card') {
    test.check('and gets the name with it, which is often all a fresh node has');
  } else {
    test.fail('name: ' + JSON.stringify(said));
  }

  // STILL A RECEIPT, signed over the hash by the node that answered. The
  // card rides the ordinary reply and is not a second protocol, so the
  // thing that makes any answer trustworthy has to be on this one too.
  if (card.receipt === true && card.from === sonny.id.publicKey) {
    test.check('signed by the node it describes, over the hash it was asked on');
  } else {
    test.fail('receipt shape: ' + JSON.stringify(card));
  }

  // ── AND IT WENT NO FURTHER ─────────────────────────────────────────
  if (delivered.length === 0) {
    test.check('and no app was handed the packet');
  } else {
    test.fail('streamed to the shell anyway: ' + JSON.stringify(delivered));
  }

  if (answered.length === 0) {
    test.check('nor did the node\'s own answerer ever see it');
  } else {
    test.fail('the answer hook ran: ' + JSON.stringify(answered));
  }

  if (remembered.length === 0) {
    test.check('and asking somebody\'s name did not write the asker into the book');
  } else {
    test.fail('remembered a stranger who only asked: ' + JSON.stringify(remembered));
  }

  if (sonny.P.arrived().length === 0) {
    test.check('and nothing is left waiting, because nothing is waiting for an answer it got');
  } else {
    test.fail('filed: ' + JSON.stringify(sonny.P.arrived()));
  }

  // ── BUT IT IS WRITTEN DOWN ─────────────────────────────────────────
  //
  // Answered is not invisible. Somebody looking at this node's traffic
  // must be able to see that a stranger asked and what went back — and
  // the inbound row must carry no payload, because the floor that stops a
  // stranger writing bytes to this disk is the one guard this path jumps.
  const reply = await settledRow(sonny.traffic, function (r) {
    return r.dir === 'out' && r.kind === 'reply';
  });
  const rows = sonny.traffic.read();
  const inbound = rows.filter(function (r) { return r.dir === 'in'; });

  if (inbound.length === 1 && inbound[0].outcome === 'answered' && !inbound[0].payload) {
    test.check('the log says a stranger asked, and keeps none of their bytes');
  } else {
    test.fail('inbound rows: ' + JSON.stringify(inbound));
  }

  if (inbound.length === 1 && !inbound[0].admitted) {
    test.check('and does not call it admitted, because no app was admitted to it');
  } else {
    test.fail('admitted: ' + JSON.stringify(inbound));
  }

  if (reply && reply.payload && reply.payload.indexOf(SAID) !== -1) {
    test.check('and keeps what this node said about itself, which is its own to keep');
  } else {
    test.fail('reply row: ' + JSON.stringify(reply));
  }

  // ── AND EVERY OTHER PACKET STILL MEETS THE DOOR ────────────────────
  //
  // The one risk in answering in front of the gate is answering too much.
  // An ordinary packet to the same dropping node gets the plain receipt
  // and nothing else, exactly as before.
  // A packet that is not a card goes the long way, through the same
  // welcoming door — so the checks above are about the CARD and not about
  // a node that stopped delivering.
  const ordinary = await stranger.P.post('http://relay', sonny.id.publicKey,
    JSON.stringify({ app: 'relay-chat', v: 1, body: 'hello?' }));
  if (ordinary.ok && delivered.length === 1 && answered.length === 1) {
    test.check('while an ordinary packet from the same stranger IS filed and handed up');
  } else {
    test.fail('ordinary: ' + JSON.stringify(ordinary) +
      ' delivered ' + delivered.length + ' answered ' + answered.length);
  }

  // ── AND THROUGH THE TIGHTEST DOOR THERE IS ─────────────────────────
  //
  // "Always answered" has to mean a node that hears nobody. `drop` keeps
  // no row, tells no app and never even remembers the sender — and the
  // card still goes back, because whoever is asking is usually a stranger
  // deciding whether to add you, and that is the whole reason for it.
  const shut = nodeFor('shut-card', relay, null, {
    admit: function () { return 'drop'; },
  });
  auth.setDescription(shut.home, 'not hearing from anybody, thanks');

  const throughShut = await stranger.P.post('http://relay', shut.id.publicKey,
    JSON.stringify({ v: 1, body: { describe: true } }));
  let shutSaid = null;
  try { shutSaid = JSON.parse(throughShut.text).body; } catch (e) { shutSaid = null; }

  if (throughShut.ok && shutSaid && shutSaid.description === 'not hearing from anybody, thanks') {
    test.check('a node that hears nobody still says what it is');
  } else {
    test.fail('through a shut door: ' + JSON.stringify(throughShut));
  }
}

async function run() {
  const relay = fakeRelay();
  const bert = nodeFor('bert', relay);
  const john = nodeFor('john', relay);

  test.subHeading('Ask, and be answered');

  const answer = await bert.P.post('http://relay', john.id.publicKey, '{"ping":1}');
  if (answer.ok && answer.from === john.id.publicKey) {
    test.check('a post to a peer comes back answered, by that peer');
  } else {
    test.fail('post: ' + JSON.stringify(answer));
  }

  // The caller gets the hash even on the fast path, so a late answer is
  // still matchable if the wait ever expires first.
  const expected = auth.requestHash(
    auth.postMessage(bert.id.publicKey, john.id.publicKey, '{"ping":1}')
  );
  if (answer.hash === expected) {
    test.check('and names the hash the caller could have computed itself');
  } else {
    test.fail('hash: ' + answer.hash + ' expected ' + expected);
  }

  // Signed by the recipient, so the relay in the middle could not have
  // manufactured it. This is what a receipt is worth.
  // NO FALLBACK. This check first read `... || answer.receipt === true`,
  // which is this module's own say-so — exactly the kind of assertion
  // that looks like proof and is not. The signature has to be present,
  // and it has to verify against the target's key.
  if (answer.sig && auth.receiptSignatureOk(john.id.publicKey, answer.hash, answer.sig)) {
    test.check('the answer carries the target\'s own signature, not the relay\'s word');
  } else {
    test.fail('receipt not verifiable by the caller: ' + JSON.stringify(answer));
  }

  // And it is THEIRS. A signature that verified against anybody's key
  // would say nothing about who answered.
  if (!auth.receiptSignatureOk(bert.id.publicKey, answer.hash, answer.sig)) {
    test.check('and against nobody else, so it names who answered');
  } else {
    test.fail('the receipt verified against the wrong key');
  }

  test.subHeading('What the far side did with it');

  const landed = john.P.arrived();
  if (landed.length === 1 && landed[0].from === bert.id.publicKey) {
    test.check('the target filed it, from a key rather than a label');
  } else {
    test.fail('inbox: ' + JSON.stringify(landed));
  }

  // FILED FIRST, ANSWERED SECOND. A receipt must not be able to say
  // "this arrived" about something that was then dropped.
  if (landed[0].item && landed[0].hash === expected) {
    test.check('and gave it an item id, under the same hash the receipt names');
  } else {
    test.fail('item: ' + JSON.stringify(landed[0]));
  }

  test.subHeading('Nobody there');

  const ghost = auth.generateIdentity('ghost');
  const nowhere = await bert.P.post('http://relay', ghost.publicKey, '{"ping":1}');
  if (nowhere.ok === false && nowhere.status === 503) {
    test.check('a peer with no open stream is an immediate refusal, not a wait');
  } else {
    test.fail('ghost: ' + JSON.stringify(nowhere));
  }

  // And the waiter is gone, rather than left to time out for a reason
  // already known.
  if (bert.P.outstanding().length === 0) {
    test.check('and the caller stops waiting the moment the relay says no');
  } else {
    test.fail('left waiting: ' + JSON.stringify(bert.P.outstanding()));
  }

  test.subHeading('A silent peer times the caller out, and nothing more');

  // A node that holds a stream but never answers — the case the wait
  // exists for. Crucially this is a failure to WAIT, not a failure of
  // the request: it is still open at the relay, and its hash still
  // matches if the answer turns up.
  const mute = auth.generateIdentity('mute');
  relay.listen(mute.publicKey, function () { /* hears everything, says nothing */ });
  const timedOut = await bert.P.post('http://relay', mute.publicKey, '{"ping":1}');
  if (timedOut.ok === false && timedOut.status === 504 && timedOut.stillOpen === true) {
    test.check('the caller gives up, and is told the request has not');
  } else {
    test.fail('mute: ' + JSON.stringify(timedOut));
  }
  if (timedOut.hash) {
    test.check('and still gets the hash, so a late answer can be matched');
  } else {
    test.fail('no hash on timeout');
  }

  test.subHeading('Who may answer');

  // The signature is what permits an answer, never the hash — anybody
  // who saw the bytes could compute that.
  const stolen = john.P.onReply({
    hash: expected,
    from: bert.id.publicKey,
    text: '',
    sig: auth.sign(bert.id.privateKey, auth.receiptMessage(expected)),
  });
  if (stolen === false) {
    test.check('an answer to a request this node is not waiting on is dropped');
  } else {
    test.fail('a stray reply was accepted');
  }

  const forged = await (async function () {
    const sent = bert.P.post('http://relay', john.id.publicKey, '{"ping":2}');
    const h = auth.requestHash(
      auth.postMessage(bert.id.publicKey, john.id.publicKey, '{"ping":2}')
    );
    // Somebody else's signature over the right hash.
    const bad = bert.P.onReply({
      hash: h, from: john.id.publicKey, text: '',
      sig: auth.sign(auth.generateIdentity('x').privateKey, auth.receiptMessage(h)),
    });
    await sent;
    return bad;
  })();
  if (forged === false) {
    test.check('and a signature that is not the answerer\'s is refused');
  } else {
    test.fail('a forged receipt was believed');
  }

  await aNodeCanAnswer();
  await aCardIsAnsweredToAnybody();
  await whatCrossedIsWrittenDown();

  // ── A REFUSAL RETRYING CANNOT FIX ───────────────────────────────────
//
//   Andy: "if a request relayer (who is required to shorten the budget)
//   shortens the budget by defined formula and it reaches below a
//   threshold, it returns an error without consulting relayers down the
//   chain, or the target of the request — is this correct?"
//
// It is, and asking it precisely found a bug one hop further on. "Not
// enough time to try" arrives as a 503, like "peer not reachable" and
// like "target is busy" — and those two ARE worth retrying, because
// waiting changes a busy target and may change an absent one.
//
// A budget is not like that. This node declares the same number on every
// attempt, so a retry is identical to the attempt that just failed: a
// loop that cannot succeed, spending a member's only slot on an answer
// already known. It belongs with 400 and 413 — refused for what the
// request IS.
async function tooLittleTimeIsNotWorthRepeating() {
  test.subHeading('A budget refusal stops; a busy one waits');

  const relay = fakeRelay();
  const home = tmpHome('budget-retry');
  const id = auth.generateIdentity('me');
  auth.saveIdentity(home, id);

  let attempts = 0;
  const P = peerPost.createPeerPost({
    rootDir: home,
    request: function (url, method, pathname, body) {
      attempts += 1;
      return Promise.resolve({
        status: 503,
        text: JSON.stringify({ error: 'not enough time to try', tooLittleTime: true }),
      });
    },
  });

  const target = auth.generateIdentity('them');
  // PATIENCE OF SECONDS, so anything retryable would be retried several
  // times before this returns. One attempt is the whole assertion.
  const said = await P.post('http://relay', target.publicKey, '{"ping":1}',
    null, { patienceMs: 3000 });

  if (attempts === 1) {
    test.check('a "not enough time" refusal is attempted once and not repeated');
  } else {
    test.fail('it was attempted ' + attempts + ' times — retrying cannot change a budget');
  }
  if (said && said.ok === false && said.tooLittleTime === true) {
    test.check('and the caller is told which refusal it was, not a bare 503');
  } else {
    test.fail('what the caller got: ' + JSON.stringify(said));
  }

  // THE CONTRAST, so this is a distinction and not a blanket rule: a busy
  // refusal IS retried, because waiting changes it.
  //
  // HELD AWAKE BY HAND, because the scheduler's retry timer is `unref`ed
  // on purpose — a node must not be kept running by its own backoff. In
  // a server the loop is alive anyway; in a suite with nothing else
  // pending, node exits mid-wait and the run ends with no report at all.
  // That is the timer behaving correctly and the test having to say so.
  const awake = setInterval(function () {}, 20);
  let busyTries = 0;
  const Q = peerPost.createPeerPost({
    rootDir: home,
    request: function () {
      busyTries += 1;
      return Promise.resolve({
        status: 503,
        text: JSON.stringify({ error: 'target is busy', busy: true, retryAfterMs: 20 }),
      });
    },
  });
  await Q.post('http://relay', target.publicKey, '{"ping":1}', null, { patienceMs: 300 });
  await new Promise(function (r) { setTimeout(r, 400); });

  clearInterval(awake);

  if (busyTries > 1) {
    test.check('while a "busy" refusal is tried again — ' + busyTries + ' times before the patience ran out');
  } else {
    test.fail('a busy refusal was not retried (' + busyTries + ' attempt)');
  }

  relay.hangUp(target.publicKey);
}

  await tooLittleTimeIsNotWorthRepeating();

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
