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

function nodeFor(name, relay, answer) {
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
  const said = slow.traffic.read().filter(function (r) {
    return r.dir === 'out' && r.kind === 'reply';
  })[0];
  if (said && said.payload === 'later') {
    test.check('and the answerer wrote down what it said');
  } else {
    test.fail('no outbound reply logged: ' + JSON.stringify(slow.traffic.read()));
  }
}

test.startTest('Peer post — a node asks a node');

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

  const landed = john.P.inbox();
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
  await whatCrossedIsWrittenDown();

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
