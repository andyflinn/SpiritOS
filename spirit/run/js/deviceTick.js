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
// installEverywhere() STOOD HERE — one pass over every relay this
// identity had a row on, installing the device key.
//
// A DEVICE BELONGS TO THE IDENTITY, AND THE IDENTITY IS THIS NODE. The
// original note under that heading was about the enrolling relay not
// being the only one told; the answer turned out to be that no relay
// needs telling. The binding is this node's file, and a relay that held a
// copy was holding a credential it never read.
//
// What that deleted, and none of it needed fixing first:
//
//   `missedOn` — a relay unreachable during enrolment kept the OLD device
//     key, for ever, because nothing retried. There is no copy to strand.
//   the per-relay re-signing — setDeviceMessage carried no recipient, so
//     one signature straddling a minute boundary failed on the last
//     mailbox. No signature, no window, no failure.
//   the red button's hardest part — revoking is one local write now, not
//     a reconcile across every relay that might be down.
//
// See deviceAuth.js.

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
// It answers with a DECISION rather than a wire format. Turning that into
// bytes belongs to whoever is speaking, which is the caller.
//
// It used to take the relay list, a poster and the enrolling relay's url,
// because it installed the key everywhere. It installs it nowhere but
// here now, so none of the three is an argument any more.
async function answerOffer(rootDir, offer) {
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

  // WRITTEN DOWN HERE AND NOWHERE ELSE. The password matched, so this
  // browser is this node's device — and that sentence is entirely about
  // the two of them. No relay is told, because no relay keeps one.
  //
  // The old shape recorded locally only "if somewhere took it", on the
  // reasoning that a node remembering a device no relay knew about would
  // show one attached that could read nothing. That is now backwards: the
  // node's record IS the attachment.
  deviceAuth.setDevicePublicKey(rootDir, offer.devicePublicKey);
  return {
    accepted: true,
    devicePublicKey: offer.devicePublicKey,
  };
}
module.exports = { answerOffer: answerOffer };
