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

function nodeFor(name, relay) {
  const home = tmpHome(name);
  const id = auth.loadIdentity(home);
  const P = peerPost.createPeerPost({ rootDir: home, request: relay.request, waitMs: 800 });
  relay.listen(id.publicKey, function (event, body) {
    if (event === 'request') P.onRequest('http://relay', body);
    else if (event === 'reply') P.onReply(body);
  });
  return { name: name, home: home, id: id, P: P };
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

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
