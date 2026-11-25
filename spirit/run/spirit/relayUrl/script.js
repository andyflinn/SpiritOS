'use strict';
require('../script.js');

// spirit/run/spirit/relayUrl/script.js
// WHICH ADDRESS A RELAY MAY BE REACHED AT. It sends nothing.
//
// Andy's decision (goal/G22.4): the relay address check moves out of
// relayRequest.js into a module of its own, since it sends nothing; the
// relay library then means only traffic on the wire. So a caller that only
// checks an address (the hub, before it hands a claim to peerPost) requires
// this and never the library that opens sockets.
//
// THE RULE, unchanged by the move: https, or http to loopback. A public
// relay reached over plain http is a signature read by every hop in
// between, and the loopback exception exists for lab relays on one machine
// where there are no hops.

function isLoopbackHost(hostname) {
  // An IPv6 address keeps its brackets in a URL's hostname (new URL('http://[::1]/').hostname is '[::1]'): they are read off.
  var h = String(hostname || '').toLowerCase().replace(/^\[(.*)\]$/, '$1');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function assertRelayUrl(relayUrl) {
  var target;
  try { target = new URL(relayUrl); }
  catch (e) { throw new Error('bad relay url'); }
  if (target.protocol === 'https:') return target;
  if (target.protocol === 'http:' && isLoopbackHost(target.hostname)) return target;
  throw new Error('relay url must be https (loopback http is allowed for lab relays)');
}

module.exports = {
  assertRelayUrl: assertRelayUrl,
  isLoopbackHost: isLoopbackHost,
};
