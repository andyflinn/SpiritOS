'use strict';

// spirit/test/answerRelay.js
// The node's half of an enrolment, and the check Andy asked for.
//
// Almost everything arriving on a node's stream is a peer's request,
// signed end to end, and the relay is a road rather than a party. A
// device enrolment is the one exception and has to be: the thing asking
// is a browser with no identity yet — that being what it is enrolling —
// so there is no end-to-end signature to carry, and the relay's own is
// the only attestation there can be.
//
// Which makes one check load-bearing above all others here:
//
//   Andy: "the personal node didn't know to verify the origin of the
//   request with the public key of the relay."
//
// Everything else in this file is about that sentence.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const answerRelay = require('../run/js/answerRelay');
const world = require('./world');

const RELAY_URL = 'http://relay.example';
const OTHER_URL = 'http://other.example';

// A relay that answers a census and takes a set-device, and records what
// it was asked. Small on purpose: what is under test is the node's
// decision, not a relay.
//
// IT ANSWERS { status, text }, which is what hub.relayRequest actually
// gives — NOT parsed JSON. An earlier version of this fake returned
// objects, because objects are what the code wanted, and that is how it
// passed while the real thing refused every enrolment: two conventions
// wear the same five-argument signature, and a fake that picks the
// convenient one tests the wrong contract. The first live run answered
// "not now" in 126ms — the round trip perfect, the answer wrong.
function fakeRelay(opts) {
  opts = opts || {};
  const calls = [];
  function said(obj) {
    return Promise.resolve({ status: 200, text: JSON.stringify(obj) });
  }
  return {
    calls: calls,
    request: function (url, method, pathname, body) {
      calls.push({ url: url, method: method, pathname: pathname, body: body });
      if (method === 'GET' && /\/api\/relay\/who$/.test(pathname)) {
        if (opts.censusFails) return Promise.reject(new Error('down'));
        return said({
          peers: [],
          mailboxPublicKey: url === OTHER_URL ? opts.otherKey : opts.mailboxKey,
        });
      }
      if (method === 'POST' && /set-device$/.test(pathname)) {
        return said(opts.installFails ? { ok: false } : { ok: true });
      }
      return said({ ok: false });
    },
  };
}

// A node with an identity and a password of its own, which is all there
// is to be ready now. There was a `listening` flag in front of the
// password and it is gone: a node that has a password can be enrolled
// to, always.
function nodeWithPassword() {
  const home = world.tmpHome('answer');
  auth.saveIdentity(home, auth.generateIdentity('andy'));
  deviceAuth.ensurePassword(home);
  return { home: home, password: deviceAuth.load(home).password };
}

function offer(password, deviceKey) {
  return JSON.stringify({
    relay: 'device-offer',
    password: password,
    devicePublicKey: deviceKey,
  });
}

function arriving(from, text, url) {
  return { from: from, relay: url || RELAY_URL, text: text, hash: 'h1' };
}

test.startTest('Answering the relay — and checking it IS the relay');

async function run() {
  const relayId = auth.generateIdentity('relay');
  const phone = auth.generateIdentity('phone');

  test.subHeading('A real offer, from the relay it arrived on');

  {
    const node = nodeWithPassword();
    const relay = fakeRelay({ mailboxKey: relayId.publicKey });
    const A = answerRelay.createAnswerer({
      rootDir: node.home,
      request: relay.request,
      urls: function () { return [RELAY_URL]; },
    });

    const said = await A.answer(arriving(relayId.publicKey, offer(node.password, phone.publicKey)));
    let parsed = null;
    try { parsed = JSON.parse(said); } catch (e) { parsed = null; }

    if (parsed && parsed.relay === 'device-answer' && parsed.accepted === true) {
      test.check('the node agrees, and says so in the relay\'s own shape');
    } else {
      test.fail('answer: ' + said);
    }

    // The decision is only half of it — the key has to be installed, or
    // the browser is told yes about a device no relay will honour.
    const installed = relay.calls.filter(function (c) { return /set-device$/.test(c.pathname); });
    if (installed.length === 1 && installed[0].body.devicePublicKey === phone.publicKey) {
      test.check('and installs the key on the relay that asked');
    } else {
      test.fail('set-device calls: ' + JSON.stringify(installed.map(function (c) { return c.body; })));
    }

    if (deviceAuth.load(node.home).devicePublicKey === phone.publicKey) {
      test.check('and writes it down locally, now that somewhere took it');
    } else {
      test.fail('node did not record the device');
    }

    // NOT AN APP PACKET, either way. The envelope lives inside `text` so
    // that no relay ever learns it, and this traffic is between a node
    // and its relay.
    if (parsed && parsed.app === undefined) {
      test.check('and the answer is not an app envelope, which a relay may not be taught to read');
    } else {
      test.fail('the answer wore an app field: ' + said);
    }
  }

  test.subHeading('THE CHECK: from must be the key of the relay it came on');

  {
    const node = nodeWithPassword();
    const relay = fakeRelay({ mailboxKey: relayId.publicKey });
    const A = answerRelay.createAnswerer({
      rootDir: node.home,
      request: relay.request,
      urls: function () { return [RELAY_URL]; },
    });

    // A peer with a perfectly good identity, posting a perfectly good
    // offer, with the RIGHT password. Everything about it is valid
    // except that it is not the relay.
    const impostor = auth.generateIdentity('impostor');
    const said = await A.answer(arriving(impostor.publicKey, offer(node.password, phone.publicKey)));

    if (said === '') {
      test.check('a peer posting a device offer is not answered, even with the right password');
    } else {
      test.fail('a stranger was answered: ' + said);
    }

    const installed = relay.calls.filter(function (c) { return /set-device$/.test(c.pathname); });
    if (!installed.length && !deviceAuth.load(node.home).devicePublicKey) {
      test.check('and nothing was installed, and nothing was written down');
    } else {
      test.fail('a stranger drove an enrolment: ' + JSON.stringify(installed));
    }
  }

  {
    // THE SUBTLE ONE. The key is right, but it belongs to a DIFFERENT
    // relay — so a node on two relays cannot have one of them enrol
    // devices in the other's name.
    const node = nodeWithPassword();
    const relay = fakeRelay({ mailboxKey: relayId.publicKey, otherKey: relayId.publicKey });
    const A = answerRelay.createAnswerer({
      rootDir: node.home,
      request: relay.request,
      urls: function () { return [RELAY_URL, OTHER_URL]; },
    });

    const elsewhere = auth.generateIdentity('elsewhere');
    // Arriving on OTHER_URL, whose census says its key is relayId — so
    // `elsewhere` is nobody's relay key.
    const said = await A.answer(arriving(elsewhere.publicKey, offer(node.password, phone.publicKey), OTHER_URL));
    if (said === '') {
      test.check('and the key is checked against the relay it ARRIVED on, not any relay');
    } else {
      test.fail('cross-relay offer answered: ' + said);
    }
  }

  test.subHeading('What is refused, and what a refusal costs');

  {
    const node = nodeWithPassword();
    const relay = fakeRelay({ mailboxKey: relayId.publicKey });
    const A = answerRelay.createAnswerer({
      rootDir: node.home, request: relay.request,
      urls: function () { return [RELAY_URL]; },
    });

    const wrong = await A.answer(arriving(relayId.publicKey, offer('not-the-password', phone.publicKey)));
    const parsed = JSON.parse(wrong);
    if (parsed.relay === 'device-answer' && parsed.accepted === false) {
      test.check('a wrong password is answered with a no, not with silence');
    } else {
      test.fail('wrong password: ' + wrong);
    }

    // A no is not a leak. The answer says no and nothing else — a node
    // that reported WHY would be telling whoever is guessing how close
    // they are.
    if (wrong.indexOf(node.password) === -1 && !/why|wrong|password/i.test(wrong)) {
      test.check('and the no says nothing about the password it compared');
    } else {
      test.fail('the refusal leaked something: ' + wrong);
    }
  }

  {
    // A NODE WITH NO PASSWORD DECLINES, and it is the last state that
    // still declines before comparing anything. The window used to be
    // that state; what is left is the honest version of it — there is
    // nothing to compare an offer against, so there is no way to say yes.
    const home = world.tmpHome('answer-nopw');
    auth.saveIdentity(home, auth.generateIdentity('andy'));
    const relay = fakeRelay({ mailboxKey: relayId.publicKey });
    const A = answerRelay.createAnswerer({
      rootDir: home, request: relay.request,
      urls: function () { return [RELAY_URL]; },
    });
    const said = JSON.parse(await A.answer(
      arriving(relayId.publicKey, offer('a'.repeat(deviceAuth.PASSWORD_HEX_LEN), phone.publicKey))
    ));
    if (said.accepted === false) {
      test.check('a node with no password of its own declines, however it was asked');
    } else {
      test.fail('a passwordless node enrolled: ' + JSON.stringify(said));
    }
  }

  {
    // A RELAY THAT TAKES NOTHING IS NOT A YES. If the install fails
    // everywhere, the browser must not be told it has a device.
    const node = nodeWithPassword();
    const relay = fakeRelay({ mailboxKey: relayId.publicKey, installFails: true });
    const A = answerRelay.createAnswerer({
      rootDir: node.home, request: relay.request,
      urls: function () { return [RELAY_URL]; },
    });
    const said = JSON.parse(await A.answer(
      arriving(relayId.publicKey, offer(node.password, phone.publicKey))
    ));
    if (said.accepted === false && !deviceAuth.load(node.home).devicePublicKey) {
      test.check('and an install that landed nowhere is a no, with nothing written down');
    } else {
      test.fail('accepted with no install: ' + JSON.stringify(said));
    }
  }

  test.subHeading('Everything else on the wire is somebody else\'s');

  {
    const node = nodeWithPassword();
    const relay = fakeRelay({ mailboxKey: relayId.publicKey });
    const A = answerRelay.createAnswerer({
      rootDir: node.home, request: relay.request,
      urls: function () { return [RELAY_URL]; },
    });

    // An ordinary app packet, from the relay's own key. Still not ours:
    // this file answers one question and is not a general reader.
    const packetish = await A.answer(arriving(
      relayId.publicKey, JSON.stringify({ app: 'relay-chat', v: 1, body: 'hello' })
    ));
    // Text that is not JSON at all.
    const rubbish = await A.answer(arriving(relayId.publicKey, 'not json {{{'));

    if (packetish === '' && rubbish === '') {
      test.check('an app packet and an unparseable one both leave the plain receipt');
    } else {
      test.fail('answered something not ours: ' + JSON.stringify([packetish, rubbish]));
    }
  }

  {
    // A CENSUS THAT CANNOT BE REACHED FAILS CLOSED. An unknown relay key
    // matches nothing, so the request is treated as a stranger's rather
    // than acted on — the safe direction for a lookup that can fail.
    const node = nodeWithPassword();
    const relay = fakeRelay({ mailboxKey: relayId.publicKey, censusFails: true });
    const A = answerRelay.createAnswerer({
      rootDir: node.home, request: relay.request,
      urls: function () { return [RELAY_URL]; },
    });
    const said = await A.answer(arriving(relayId.publicKey, offer(node.password, phone.publicKey)));
    if (said === '') {
      test.check('and a relay whose key cannot be read is not trusted by default');
    } else {
      test.fail('answered without knowing the key: ' + said);
    }
  }

  {
    // ASKED ONCE. A relay's key is made on its first --relay boot and
    // does not change while it is the same relay, so a census per
    // enrolment would be a round trip spent on a constant.
    const node = nodeWithPassword();
    const relay = fakeRelay({ mailboxKey: relayId.publicKey });
    const A = answerRelay.createAnswerer({
      rootDir: node.home, request: relay.request,
      urls: function () { return [RELAY_URL]; },
    });
    await A.answer(arriving(relayId.publicKey, offer('wrong', phone.publicKey)));
    await A.answer(arriving(relayId.publicKey, offer('wrong', phone.publicKey)));
    const censuses = relay.calls.filter(function (c) { return /who$/.test(c.pathname); });
    if (censuses.length === 1) {
      test.check('and the relay\'s key is asked for once, not once per enrolment');
    } else {
      test.fail(censuses.length + ' census calls for two offers');
    }
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
