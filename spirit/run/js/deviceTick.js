'use strict';

// spirit/run/js/deviceTick.js
// Personal node. One pass over owned mailbox URLs while listening.
// requestFn(url, method, path, body) must return a Promise of parsed JSON
// or { ok:false }. No sockets in this file.

const deviceAuth = require('./deviceAuth');
const relayAuth = require('./relayAuth');

function takePath(name, sig) {
  return '/api/relay/device-pending?name=' +
    encodeURIComponent(name) +
    '&sig=' + encodeURIComponent(sig);
}

async function tick(rootDir, ownedUrls, requestFn) {
  var doc = deviceAuth.load(rootDir);
  if (!doc.listening) return { ok: true, did: 'quiet' };
  if (!doc.password) return { ok: true, did: 'quiet' };
  var id = relayAuth.loadIdentity(rootDir);
  if (!id || !id.privateKey || !id.name) return { ok: false, error: 'no identity' };
  var urls = Array.isArray(ownedUrls) ? ownedUrls : [];
  var sig = relayAuth.sign(id.privateKey, deviceAuth.deviceTakeMessage(id.name));
  var i;
  for (i = 0; i < urls.length; i++) {
    var url = urls[i];
    var held = await requestFn(url, 'GET', takePath(id.name, sig), null);
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
  return { ok: true, did: 'empty' };
}

module.exports = { tick: tick };
