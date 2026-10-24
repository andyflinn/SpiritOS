'use strict';

// spirit/test/relayForwardedAddress.js
// A STRANGER IS COUNTED BY ITS REAL ADDRESS BEHIND CADDY (goal/G22.7).
//
// Decided by Andy, 2026-10-14 (goal/G22.7's box): before the flag-day tag of goal/G22.6, a relay behind Caddy counts
// a stranger by the address Caddy forwards (X-Forwarded-For), not by 127.0.0.1, so the address table holds one entry
// per real address. The forwarded address may only be trusted when the request came from the local Caddy: anyone who
// reaches the relay directly could write the header themselves.
//
// The relay's one reader of a requester's address is serveCommon.clientKeyFor (relayServer.js hands it to the address
// table). Asserted here with stand-in requests, so no relay is started.

const test = require('./testSupport.js');
const common = require('../run/spirit/serveCommon.js');

function req(remote, xff) {
  const headers = {};
  if (xff !== undefined) headers['x-forwarded-for'] = xff;
  return { socket: { remoteAddress: remote }, headers: headers };
}

test.startTest('goal/G22.7: a stranger behind Caddy is counted by the address Caddy forwards');

const cases = [
  ['from the local Caddy, the forwarded address is the key', req('127.0.0.1', '203.0.113.7'), '203.0.113.7'],
  ['from the local Caddy over IPv6 loopback, the same', req('::1', '2001:db8::5'), '2001:db8::5'],
  ['from the local Caddy as an IPv4-mapped loopback, the same', req('::ffff:127.0.0.1', '198.51.100.9'), '198.51.100.9'],
  ['a chain: the last entry is the one Caddy itself saw, earlier ones are the sender\'s own words', req('127.0.0.1', '10.0.0.1, 203.0.113.7'), '203.0.113.7'],
  ['from the local Caddy with no header, the socket address stands', req('127.0.0.1'), '127.0.0.1'],
  ['a direct caller writing the header is not believed: its socket address is the key', req('198.51.100.20', '203.0.113.7'), '198.51.100.20'],
  ['a direct caller with no header: its socket address', req('198.51.100.20'), '198.51.100.20'],
  ['an empty header from the local Caddy falls back to the socket address', req('127.0.0.1', '  '), '127.0.0.1'],
];
cases.forEach(function (c) {
  const got = common.clientKeyFor(c[1]);
  if (got === c[2]) test.check(c[0]);
  else test.fail('OWED by goal/G22.7: ' + c[0] + ': got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(c[2]));
});

test.reportSuccessFailureCount();
