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
function takePath(name) {
  return '/api/relay/device-pending?name=' + encodeURIComponent(name);
}

async function tick(rootDir, ownedUrls, requestFn) {
  var doc = deviceAuth.load(rootDir);
  if (!doc.listening) return { ok: true, did: 'quiet' };
  if (!doc.password) return { ok: true, did: 'quiet' };
  var id = relayAuth.loadIdentity(rootDir);
  if (!id || !id.privateKey || !id.name) return { ok: false, error: 'no identity' };
  var urls = Array.isArray(ownedUrls) ? ownedUrls : [];
  var sig = relayAuth.sign(id.privateKey, deviceAuth.deviceTakeMessage(id.name));
  var refused = false;
  var unreachable = false;
  var i;
  for (i = 0; i < urls.length; i++) {
    var url = urls[i];
    var held = await requestFn(url, 'GET', takePath(id.name), null, { 'X-Spirit-Sig': sig });
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
    if (accept) {
      var setSig = relayAuth.sign(
        id.privateKey,
        deviceAuth.setDeviceMessage(held.devicePublicKey)
      );
      await requestFn(url, 'POST', '/api/relay/set-device', {
        name: id.name,
        devicePublicKey: held.devicePublicKey,
        sig: setSig
      });
      deviceAuth.setDevicePublicKey(rootDir, held.devicePublicKey);
    }
    await requestFn(url, 'POST', '/api/relay/device-answer', {
      name: id.name,
      accepted: accept,
      sig: relayAuth.sign(id.privateKey, deviceAuth.deviceTakeMessage(id.name))
    });
    return { ok: true, did: accept ? 'installed' : 'rejected' };
  }
  // Three different silences, told apart: nobody was enrolling, the
  // mailbox would not have us, or it never answered.
  return { ok: true, did: unreachable ? 'unreachable' : refused ? 'refused' : 'empty' };
}

module.exports = { tick: tick };
