'use strict';

// spirit/run/js/deviceTick.js
// Personal node. Deciding a device offer, and installing the key.
//
// It was the poll — one pass over every relay, once a minute, asking
// whether anybody was enrolling — and the name is all that is left of
// that. An offer arrives on the stream now (answerRelay.js) and this is
// what decides it.
//
// requestFn(url, method, path, body, headers) must return a Promise of
// parsed JSON or { ok:false }. No sockets in this file.

const deviceAuth = require('./deviceAuth');
const relayAuth = require('./relayAuth');
// A DEVICE BELONGS TO THE IDENTITY, NOT TO THE MAILBOX THAT ENROLLED IT.
//
// The handshake happens on one relay — whichever one served the page the
// password was typed into — and the slot used to be installed only
// there. So "add this device" produced a browser that could read one
// mailbox and was a stranger to every other mailbox the same person
// held, which is not what the words say and not what anybody expects
// after enrolling once.
//
// Signed PER RELAY rather than once: setDeviceMessage carries a minute,
// and a fan-out across a loopback box and one on the far side of the
// internet can straddle a minute boundary. One signature reused would
// then be accepted by the first relay and stale at the last — a failure
// that appears only sometimes, only on slow links, and only for the
// mailbox listed last.
//
// Every relay is TOLD; none is asked twice. A relay that refuses or
// cannot be reached is reported, never retried here: the tick comes
// round again, and a device slot is not worth a retry loop inside a
// function that already runs on a timer.
async function installEverywhere(requestFn, id, urls, deviceKey) {
  const on = [];
  const missed = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let answer = null;
    try {
      answer = await requestFn(url, 'POST', '/api/relay/set-device', {
        name: id.name,
        devicePublicKey: deviceKey,
        sig: relayAuth.sign(id.privateKey, deviceAuth.setDeviceMessage(deviceKey)),
      });
    } catch (e) {
      answer = null;
    }
    if (answer && answer.ok) on.push(url);
    else missed.push(url);
  }
  return { on: on, missed: missed };
}

// AN OFFER THAT ARRIVED, rather than one this node went and fetched.
//
// Everything below the first line of `tick` is the same work: compare
// the password against the one only this node holds, install the key
// everywhere this identity has a row, write it down. What differs is how
// the offer got here — polled for, or handed over by a relay that posted
// it. So the work lives here once and both roads call it.
//
// It answers with a decision rather than a wire format. Turning that
// into bytes belongs to whoever is speaking, which is the caller.
async function answerOffer(rootDir, urls, offer, requestFn, fromUrl) {
  var doc = deviceAuth.load(rootDir);
  // THE PASSWORD IS THE WHOLE GATE NOW. There was a `listening` flag in
  // front of it and it is gone (Andy: "the ability to setup
  // one-device-for-all-peers just IS"). A node with no password cannot
  // be enrolled to, because there is nothing to compare against — which
  // is the only state left that declines before comparing.
  if (!doc.password) return { accepted: false, why: 'no password' };

  var id = relayAuth.loadIdentity(rootDir);
  if (!id || !id.privateKey || !id.name) return { accepted: false, why: 'no identity' };
  if (!offer || !offer.password || !offer.devicePublicKey) {
    return { accepted: false, why: 'nothing offered' };
  }

  // THE ONE COMPARISON THAT MATTERS, and it happens here and nowhere
  // else. A relay that could check the password could install a device
  // without knowing one (DEVICE-CYCLE2.md).
  if (!deviceAuth.passwordsEqual(doc.password, offer.password)) {
    return { accepted: false, why: 'wrong password' };
  }

  // The enrolling relay first, so the one the person is standing in
  // front of holds the slot by the time they are told yes.
  var list = Array.isArray(urls) ? urls : [];
  var others = list.filter(function (u) { return u !== fromUrl; });
  var spread = await installEverywhere(
    requestFn, id, (fromUrl ? [fromUrl] : []).concat(others), offer.devicePublicKey
  );

  // Recorded locally only if somewhere took it. A node that remembered a
  // device no relay knows about would show one attached that could read
  // nothing anywhere.
  if (!spread.on.length) return { accepted: false, why: 'no relay took it' };
  deviceAuth.setDevicePublicKey(rootDir, offer.devicePublicKey);
  return {
    accepted: true,
    devicePublicKey: offer.devicePublicKey,
    installedOn: spread.on,
    missedOn: spread.missed,
  };
}
module.exports = { answerOffer: answerOffer };
