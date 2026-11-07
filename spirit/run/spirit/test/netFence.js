'use strict';

// spirit/run/spirit/test/netFence.js
// The tests of spirit/netFence.js, and of no other module (spec: ./netFence.md). net.fetch never reaches this machine
// (goal/G29.20; Andy, 2026-10-18: "fetch will not be able to reach ports on this machine, and agents may use it."). The
// node asks isThisMachine of the hostname new URL gives it (spirit/server.js:585), so every case here is asked in that
// form: a URL parsed the way the node parses it, its hostname handed over as it comes.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const fence = require(path.join(RUN, 'spirit', 'netFence.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

// What the node hands isThisMachine: the target's hostname, lower-cased (server.js:581).
function hostOf(url) { return new URL(url).hostname.toLowerCase(); }

test.startTest('netFence.js: net.fetch never reaches this machine');

test.subHeading('this machine, however its address is written, is refused');
[
  ['http://127.0.0.1:1/', 'loopback'],
  ['http://127.9.9.9:1/', 'any 127.x address'],
  ['http://0.0.0.0:1/', 'the any address'],
  ['http://localhost:1/', 'localhost'],
  ['http://a.localhost:1/', 'a name under .localhost'],
  ['http://[::1]:1/', 'IPv6 loopback'],
  ['http://[0:0:0:0:0:0:0:1]:1/', 'IPv6 loopback written in full'],
  ['http://[::]:1/', 'the IPv6 any address'],
  // The reported failure (goal/G41.30, Andy, 2026-11-02: "isThisMachine('::ffff:7f00:1') is false, and new URL rewrites
  // [::ffff:127.0.0.1] to that form, so an IPv4-mapped literal passes the gate").
  ['http://[::ffff:127.0.0.1]:1/', 'IPv4-mapped loopback, which new URL writes as ::ffff:7f00:1'],
  ['http://[0:0:0:0:0:ffff:127.0.0.1]:1/', 'IPv4-mapped loopback written in full'],
  ['http://[::ffff:7f00:1]:1/', 'IPv4-mapped loopback in hex'],
  ['http://[::127.0.0.1]:1/', 'IPv4-compatible loopback, which new URL writes as ::7f00:1'],
  ['http://[::ffff:0.0.0.0]:1/', 'IPv4-mapped any address'],
].forEach(function (c) {
  const h = hostOf(c[0]);
  let said = null;
  try { said = fence.isThisMachine(h); } catch (e) { said = 'threw ' + (e && e.message); }
  ok(said === true, 'refused: ' + c[0] + ' (' + c[1] + ')', c[0] + ' (' + c[1] + ') reaches isThisMachine as ' + h + ' and is let through: ' + String(said));
});

test.subHeading('another machine stays reachable');
[
  ['http://93.184.216.34:1/', 'an address on the internet'],
  ['http://example.com:1/', 'a name, checked at connect by netFence.lookup'],
  ['http://[2606:2800:220:1:248:1893:25c8:1946]:1/', 'an IPv6 address on the internet'],
  ['http://[::ffff:93.184.216.34]:1/', 'an IPv4-mapped address of another machine'],
].forEach(function (c) {
  const h = hostOf(c[0]);
  let said = null;
  try { said = fence.isThisMachine(h); } catch (e) { said = 'threw ' + (e && e.message); }
  ok(said === false, 'let through: ' + c[0] + ' (' + c[1] + ')', c[0] + ' (' + c[1] + ') is refused: ' + String(said));
});

test.reportSuccessFailureCount();
