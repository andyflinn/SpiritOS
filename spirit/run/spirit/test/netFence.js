'use strict';

// spirit/run/spirit/test/netFence.js
// The tests of spirit/netFence.js, and of no other module (spec: ./netFence.md). net.fetch never reaches this machine
// (goal/G29.20; Andy, 2026-10-18: "fetch will not be able to reach ports on this machine, and agents may use it."). The
// node asks isThisMachine of the hostname new URL gives it (spirit/server.js:588), so every case here is asked in that
// form: a URL parsed the way the node parses it, its hostname handed over as it comes.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const fence = require(path.join(RUN, 'spirit', 'netFence.js'));

// What the node hands isThisMachine: the target's hostname, lower-cased (server.js:584).
function hostOf(url) { return new URL(url).hostname.toLowerCase(); }

// This machine, however its address is written, is refused.
// What isThisMachine says of a URL, as the node asks it.
function said(url) {
  const h = hostOf(url);
  let s = null;
  try { s = fence.isThisMachine(h); } catch (e) { s = 'threw ' + (e && e.message); }
  return { said: s, host: h };
}
test.run('refused: loopback', 0.8, function () { const c = said('http://127.0.0.1:1/'); return c.said === true || 'http://127.0.0.1:1/ (loopback) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: any 127.x address', 0.8, function () { const c = said('http://127.9.9.9:1/'); return c.said === true || 'http://127.9.9.9:1/ (any 127.x address) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: the any address', 0.8, function () { const c = said('http://0.0.0.0:1/'); return c.said === true || 'http://0.0.0.0:1/ (the any address) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: localhost', 0.8, function () { const c = said('http://localhost:1/'); return c.said === true || 'http://localhost:1/ (localhost) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: a name under .localhost', 0.8, function () { const c = said('http://a.localhost:1/'); return c.said === true || 'http://a.localhost:1/ (a name under .localhost) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: IPv6 loopback', 0.8, function () { const c = said('http://[::1]:1/'); return c.said === true || 'http://[::1]:1/ (IPv6 loopback) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: IPv6 loopback written in full', 0.8, function () { const c = said('http://[0:0:0:0:0:0:0:1]:1/'); return c.said === true || 'http://[0:0:0:0:0:0:0:1]:1/ (IPv6 loopback written in full) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: the IPv6 any address', 0.8, function () { const c = said('http://[::]:1/'); return c.said === true || 'http://[::]:1/ (the IPv6 any address) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
// The reported failure (goal/G41.30, Andy, 2026-11-02: "isThisMachine('::ffff:7f00:1') is false, and new URL rewrites
// [::ffff:127.0.0.1] to that form, so an IPv4-mapped literal passes the gate").
test.run('refused: IPv4-mapped loopback, which new URL writes as ::ffff:7f00:1', 0.8, function () { const c = said('http://[::ffff:127.0.0.1]:1/'); return c.said === true || 'http://[::ffff:127.0.0.1]:1/ (IPv4-mapped loopback, which new URL writes as ::ffff:7f00:1) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: IPv4-mapped loopback written in full', 0.8, function () { const c = said('http://[0:0:0:0:0:ffff:127.0.0.1]:1/'); return c.said === true || 'http://[0:0:0:0:0:ffff:127.0.0.1]:1/ (IPv4-mapped loopback written in full) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: IPv4-mapped loopback in hex', 0.8, function () { const c = said('http://[::ffff:7f00:1]:1/'); return c.said === true || 'http://[::ffff:7f00:1]:1/ (IPv4-mapped loopback in hex) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: IPv4-compatible loopback, which new URL writes as ::7f00:1', 0.8, function () { const c = said('http://[::127.0.0.1]:1/'); return c.said === true || 'http://[::127.0.0.1]:1/ (IPv4-compatible loopback, which new URL writes as ::7f00:1) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);
test.run('refused: IPv4-mapped any address', 0.8, function () { const c = said('http://[::ffff:0.0.0.0]:1/'); return c.said === true || 'http://[::ffff:0.0.0.0]:1/ (IPv4-mapped any address) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said); }, test.limit.quick);

// Another machine stays reachable.
test.run('let through: an address on the internet', 0.2, function () { const c = said('http://93.184.216.34:1/'); return c.said === false || 'http://93.184.216.34:1/ (an address on the internet) is refused: ' + String(c.said); }, test.limit.quick);
test.run('let through: a name, checked at connect by netFence.lookup', 0.2, function () { const c = said('http://example.com:1/'); return c.said === false || 'http://example.com:1/ (a name, checked at connect by netFence.lookup) is refused: ' + String(c.said); }, test.limit.quick);
test.run('let through: an IPv6 address on the internet', 0.2, function () { const c = said('http://[2606:2800:220:1:248:1893:25c8:1946]:1/'); return c.said === false || 'http://[2606:2800:220:1:248:1893:25c8:1946]:1/ (an IPv6 address on the internet) is refused: ' + String(c.said); }, test.limit.quick);
test.run('let through: an IPv4-mapped address of another machine', 0.2, function () { const c = said('http://[::ffff:93.184.216.34]:1/'); return c.said === false || 'http://[::ffff:93.184.216.34]:1/ (an IPv4-mapped address of another machine) is refused: ' + String(c.said); }, test.limit.quick);
