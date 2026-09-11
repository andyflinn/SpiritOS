'use strict';

// spirit/run/js/deviceTick.js
// Personal node. One pass over owned mailbox URLs while listening.
// requestFn(url, method, path, body, headers) must return a Promise of
// parsed JSON or { ok:false }. No sockets in this file.

const deviceAuth = require('./deviceAuth');
const relayAuth = require('./relayAuth');

// `name` only. The proof rides in X-Spirit-Sig, because this path is
// requested every two seconds while a window is open and a query string
// lands in every access log on the way — where it would sit as a live
// credential for the RAM slot. The relay refuses a query `sig` outright,
// through the same function the inbox route uses.
// The token is this node's PUBLIC KEY, not its label. Labels duplicate
// on purpose — two johns is two keys and two invites — so a label
// identifies nobody on a relay that has both, and the relay answers a
// duplicate with nothing at all. The key is the unique thing (B2).
//
// The signed message still carries the LABEL: deviceTakeMessage has
// always named a name, and the relay verifies it against the label on
// the row it found by key. Nothing is ambiguous there, because the row
// was already chosen.
function takePath(token) {
  return '/api/relay/device-pending?name=' + encodeURIComponent(token);
}

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

async function tick(rootDir, ownedUrls, requestFn) {
  var doc = deviceAuth.load(rootDir);
  if (!doc.listening) return { ok: true, did: 'quiet' };
  if (!doc.password) return { ok: true, did: 'quiet' };
  var id = relayAuth.loadIdentity(rootDir);
  if (!id || !id.privateKey || !id.name) return { ok: false, error: 'no identity' };
  var urls = Array.isArray(ownedUrls) ? ownedUrls : [];
  var sig = relayAuth.sign(id.privateKey, deviceAuth.deviceTakeMessage(id.name));
  var token = id.publicKey || id.name;
  var refused = false;
  var unreachable = false;
  var i;
  for (i = 0; i < urls.length; i++) {
    var url = urls[i];
    var held = await requestFn(url, 'GET', takePath(token), null, { 'X-Spirit-Sig': sig });
    // A refusal is not an empty slot, and they must not report the same.
    // The ROUTE says `not now` to both on purpose — it faces the internet
    // and owes it no detail — but this caller is the owner, and the two
    // mean opposite things: an empty slot is "nobody is enrolling", a
    // refusal is "this mailbox and this node no longer agree", which is
    // what a relay running older code looks like from here.
    //
    // Collapsing them is what made the window silent: every poll came
    // back reassuring while nothing could ever have been taken.
    if (held && held.error === 'unreachable') unreachable = true;
    else if (held && held.error) refused = true;
    if (!held || !held.password || !held.devicePublicKey) continue;
    var accept = deviceAuth.passwordsEqual(doc.password, held.password);
    var spread = { on: [], missed: [] };
    if (accept) {
      // THE ENROLLING RELAY FIRST, and it is not a special case — it is
      // simply first in the list handed to installEverywhere, so the one
      // the person is actually standing in front of is the one that has
      // the slot by the time they are told yes.
      var others = urls.filter(function (u) { return u !== url; });
      spread = await installEverywhere(requestFn, id, [url].concat(others), held.devicePublicKey);
      // Written down locally only if SOMEWHERE took it. A node that
      // recorded a device no relay knows about would show an attached
      // device in its own panel that could read nothing anywhere.
      if (spread.on.length) deviceAuth.setDevicePublicKey(rootDir, held.devicePublicKey);
    }
    // ANSWERED ON THE RELAY THAT ASKED, whatever happened elsewhere. A
    // browser is holding that POST open and it is enrolling HERE; making
    // it wait on a mailbox in another country, or fail because one was
    // down, would be this node's bookkeeping leaking into somebody's
    // enrolment.
    await requestFn(url, 'POST', '/api/relay/device-answer', {
      name: id.name,
      accepted: accept,
      sig: relayAuth.sign(id.privateKey, deviceAuth.deviceTakeMessage(id.name))
    });
    if (!accept) return { ok: true, did: 'rejected' };
    return {
      ok: true,
      did: spread.on.length ? 'installed' : 'rejected',
      // Which mailboxes this device can actually speak to, and which
      // could not be told. The second is the one worth surfacing: a
      // device that works on two relays out of three is a device that
      // will fail somewhere the person has no reason to expect.
      installedOn: spread.on,
      missedOn: spread.missed,
    };
  }
  // Three different silences, told apart: nobody was enrolling, the
  // mailbox would not have us, or it never answered.
  return { ok: true, did: unreachable ? 'unreachable' : refused ? 'refused' : 'empty' };
}

module.exports = { tick: tick };
