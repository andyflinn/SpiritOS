'use strict';

// spirit/run/spirit/net/fence/test/script.js
// The tests of spirit/net/fence/script.js, and of no other module (spec: ./script.md). net.fetch never reaches this machine
// (goal/G29.20; Andy, 2026-10-18: "fetch will not be able to reach ports on this machine, and agents may use it."). The
// node asks isThisMachine of the hostname new URL gives it (spirit/server/script.js:588), so every case here is asked in that
// form: a URL parsed the way the node parses it, its hostname handed over as it comes.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/testicle/testReport/script.js');
const fence = S.requireScript('spirit/net/fence/script.js');

// What the node hands isThisMachine: the target's hostname, lower-cased (server.js:584).
function hostOf(url) { return new URL(url).hostname.toLowerCase(); }

// This machine, however its address is written, is refused.
// What isThisMachine says of a URL, as the node asks it.
function said(url) {
  const h = hostOf(url);
  let s = null;
  try { s = fence.isThisMachine(h); } catch (e) { s = null; }
  return { said: s };
}
test.run('the loopback address is refused', 0.8, function () { const c = said('http://127.0.0.1:1/'); return c.said === true || false; }, test.limit.quick);
test.run('any 127.x address is refused', 0.8, function () { const c = said('http://127.9.9.9:1/'); return c.said === true || false; }, test.limit.quick);
test.run('the any address is refused', 0.8, function () { const c = said('http://0.0.0.0:1/'); return c.said === true || false; }, test.limit.quick);
test.run('localhost is refused', 0.8, function () { const c = said('http://localhost:1/'); return c.said === true || false; }, test.limit.quick);
test.run('a name under .localhost is refused', 0.8, function () { const c = said('http://a.localhost:1/'); return c.said === true || false; }, test.limit.quick);
test.run('the IPv6 loopback address is refused', 0.8, function () { const c = said('http://[::1]:1/'); return c.said === true || false; }, test.limit.quick);
test.run('the IPv6 loopback address written in full is refused', 0.8, function () { const c = said('http://[0:0:0:0:0:0:0:1]:1/'); return c.said === true || false; }, test.limit.quick);
test.run('the IPv6 any address is refused', 0.8, function () { const c = said('http://[::]:1/'); return c.said === true || false; }, test.limit.quick);
// The reported failure (goal/G41.30, Andy, 2026-11-02: "isThisMachine('::ffff:7f00:1') is false, and new URL rewrites
// [::ffff:127.0.0.1] to that form, so an IPv4-mapped literal passes the gate").
test.run('an IPv4-mapped loopback address, which new URL writes as ::ffff:7f00:1, is refused', 0.8, function () { const c = said('http://[::ffff:127.0.0.1]:1/'); return c.said === true || false; }, test.limit.quick);
test.run('an IPv4-mapped loopback address written in full is refused', 0.8, function () { const c = said('http://[0:0:0:0:0:ffff:127.0.0.1]:1/'); return c.said === true || false; }, test.limit.quick);
test.run('an IPv4-mapped loopback address written in hex is refused', 0.8, function () { const c = said('http://[::ffff:7f00:1]:1/'); return c.said === true || false; }, test.limit.quick);
test.run('an IPv4-compatible loopback address, which new URL writes as ::7f00:1, is refused', 0.8, function () { const c = said('http://[::127.0.0.1]:1/'); return c.said === true || false; }, test.limit.quick);
test.run('the IPv4-mapped any address is refused', 0.8, function () { const c = said('http://[::ffff:0.0.0.0]:1/'); return c.said === true || false; }, test.limit.quick);

// Another machine stays reachable.
test.run('an address on the internet is let through', 0.2, function () { const c = said('http://93.184.216.34:1/'); return c.said === false || false; }, test.limit.quick);
test.run('a name is let through, to be checked at connect by netFence.lookup', 0.2, function () { const c = said('http://example.com:1/'); return c.said === false || false; }, test.limit.quick);
test.run('an IPv6 address on the internet is let through', 0.2, function () { const c = said('http://[2606:2800:220:1:248:1893:25c8:1946]:1/'); return c.said === false || false; }, test.limit.quick);
test.run('an IPv4-mapped address of another machine is let through', 0.2, function () { const c = said('http://[::ffff:93.184.216.34]:1/'); return c.said === false || false; }, test.limit.quick);
