'use strict';

// spirit/test/answerRelay.js
// What a node knows about the relays it talks to: each relay's own key,
// fetched from its signed door, pinned on first use (relayKeys.js), and
// refused when a later answer names a different key.
//
// This suite once tested the node answering the relay's device-offer
// request; that went with the device enrolment, removed by goal/G16.2
// (Andy: "device WILL be KILLED. that's a decision."). The pinning it
// rested on stays, and is what is asserted here.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const relayKeys = require('../run/js/relayKeys');
const answerRelay = require('../run/js/answerRelay');
const world = require('./world');

const RELAY_URL = 'http://relay.example';

// ── THE FAKE SIGNS AS ITSELF, OR IT PROVES NOTHING (cycle 10's R9) ───
//
// `GET /api/relay/key` is signed, so this fake has to hold the private
// half of whatever key it serves. A key with no registered signer is
// served unsigned on purpose: a box we hold no key for.
const signers = Object.create(null);
function remember(id) { signers[id.publicKey] = id; return id; }

function keyAnswer(key) {
  const id = signers[key];
  if (!id) return { relayPublicKey: key };
  return {
    relayPublicKey: id.publicKey,
    relaySealKey: id.sealPublicKey,
    keySig: auth.sign(id.privateKey, auth.relayKeyMessage(id.publicKey, id.sealPublicKey, '')),
    relayLabel: '',
  };
}

// IT ANSWERS { status, text }, which is what hub.relayRequest actually
// gives — NOT parsed JSON. A fake that picks the convenient convention
// tests the wrong contract.
function fakeRelay(opts) {
  opts = opts || {};
  const calls = [];
  return {
    calls: calls,
    request: function (url, method, pathname, body) {
      calls.push({ url: url, method: method, pathname: pathname, body: body });
      if (method === 'GET' && /\/api\/relay\/key$/.test(pathname)) {
        if (opts.rollFails) return Promise.reject(new Error('down'));
        return Promise.resolve({ status: 200, text: JSON.stringify(keyAnswer(opts.mailboxKey)) });
      }
      // THE ROLL IS NOT SERVED HERE AT ALL. If answerRelay ever reaches
      // for it again, that fails loudly.
      if (method === 'GET' && /\/api\/relay\/who$/.test(pathname)) {
        test.fail('answerRelay read the roll: ' + pathname);
      }
      return Promise.resolve({ status: 200, text: JSON.stringify({ ok: false }) });
    },
  };
}

function nodeHome() {
  const home = world.tmpHome('answer');
  auth.saveIdentity(home, auth.generateIdentity('andy'));
  return home;
}

test.startTest('A relay\'s own key — fetched, pinned, and held to');

async function run() {
  const relayId = remember(auth.generateIdentity('relay'));

  test.subHeading('First contact');

  {
    const home = nodeHome();
    const relay = fakeRelay({ mailboxKey: relayId.publicKey });
    const A = answerRelay.createAnswerer({ rootDir: home, request: relay.request });

    if (typeof A.answer === 'undefined') {
      test.check('the answerer answers no request any more: the device-offer reply is gone (goal/G16.2)');
    } else {
      test.fail('answerRelay still exports answer()');
    }

    const key = await A.relayKey(RELAY_URL);
    if (key === relayId.publicKey && relayKeys.pinned(home, RELAY_URL) === relayId.publicKey) {
      test.check('the relay\'s signed key is accepted and pinned — trust on FIRST use');
    } else {
      test.fail('key: ' + key + ' pinned: ' + relayKeys.pinned(home, RELAY_URL));
    }

    if (A.relaySealKey(RELAY_URL) === relayId.sealPublicKey &&
        A.relaySealKeyByKey(relayId.publicKey) === relayId.sealPublicKey) {
      test.check('and the seal key comes from the same signed answer, by url and by key');
    } else {
      test.fail('seal key: ' + A.relaySealKey(RELAY_URL));
    }

    // ASKED ONCE. A relay's key does not change while it is the same
    // relay, so a lookup per use would be a round trip spent on a constant.
    await A.relayKey(RELAY_URL);
    const asked = relay.calls.filter(function (c) { return /key$/.test(c.pathname); });
    if (asked.length === 1) {
      test.check('and the relay\'s key is asked for once per process');
    } else {
      test.fail(asked.length + ' key lookups for two asks');
    }
  }

  test.subHeading('What is refused');

  {
    // A KEY THAT CANNOT BE READ FAILS CLOSED.
    const home = nodeHome();
    const relay = fakeRelay({ mailboxKey: relayId.publicKey, rollFails: true });
    const A = answerRelay.createAnswerer({ rootDir: home, request: relay.request });
    const key = await A.relayKey(RELAY_URL);
    if (key === '' && !relayKeys.pinned(home, RELAY_URL)) {
      test.check('a relay whose key cannot be read yields no key and no pin');
    } else {
      test.fail('answered without knowing the key: ' + key);
    }
  }

  {
    // AN UNSIGNED ANSWER YIELDS NO KEY AT ALL (cycle 10's R9).
    const home = nodeHome();
    const unsigned = auth.generateIdentity('unsigned-relay');
    const relay = fakeRelay({ mailboxKey: unsigned.publicKey });
    const A = answerRelay.createAnswerer({ rootDir: home, request: relay.request });
    const key = await A.relayKey(RELAY_URL);
    if (key === '' && !relayKeys.pinned(home, RELAY_URL)) {
      test.check('an unsigned key answer is refused and nothing is pinned');
    } else {
      test.fail('unsigned key accepted: ' + key);
    }
  }

  test.subHeading('A relay that answers with a different key than last time');

  // Two answerers over ONE home is how a restart is written down — same
  // node, same disk, new process — which is the moment a substitution
  // used to become invisible.
  {
    const home = nodeHome();
    const impostor = remember(auth.generateIdentity('impostor-relay'));

    const first = answerRelay.createAnswerer({
      rootDir: home, request: fakeRelay({ mailboxKey: relayId.publicKey }).request,
    });
    const pinned = await first.relayKey(RELAY_URL);
    if (pinned === relayId.publicKey) test.check('first contact is pinned');
    else test.fail('honest relay refused: ' + pinned);

    const changes = [];
    const second = answerRelay.createAnswerer({
      rootDir: home, request: fakeRelay({ mailboxKey: impostor.publicKey }).request,
      onKeyChanged: function (url, had, got) { changes.push({ url: url, had: had, got: got }); },
    });
    const after = await second.relayKey(RELAY_URL);
    if (after === '') {
      test.check('a substituted relay is refused after a restart, though it signs its own answer');
    } else {
      test.fail('the impostor was accepted: ' + after);
    }

    if (changes.length === 1 && changes[0].had === relayId.publicKey &&
        changes[0].got === impostor.publicKey) {
      test.check('and it is reported rather than merely failing — a refusal is not a relay being down');
    } else {
      test.fail('onKeyChanged: ' + JSON.stringify(changes));
    }

    if (relayKeys.pinned(home, RELAY_URL) === relayId.publicKey) {
      test.check('and the pin still names the relay that was accepted');
    } else {
      test.fail('the pin moved: ' + String(relayKeys.pinned(home, RELAY_URL)).slice(-12));
    }

    const third = answerRelay.createAnswerer({
      rootDir: home, request: fakeRelay({ mailboxKey: relayId.publicKey }).request,
    });
    if (await third.relayKey(RELAY_URL) === relayId.publicKey) {
      test.check('while the relay that was accepted is still trusted after a restart');
    } else {
      test.fail('the honest relay stopped working');
    }
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
