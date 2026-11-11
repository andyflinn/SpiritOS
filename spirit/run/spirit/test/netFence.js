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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

// What the node hands isThisMachine: the target's hostname, lower-cased (server.js:584).
function hostOf(url) { return new URL(url).hostname.toLowerCase(); }

test.startTest('netFence.js: net.fetch never reaches this machine');

test.subHeading('this machine, however its address is written, is refused');
// What isThisMachine says of a URL, as the node asks it.
function said(url) {
  const h = hostOf(url);
  let s = null;
  try { s = fence.isThisMachine(h); } catch (e) { s = 'threw ' + (e && e.message); }
  return { said: s, host: h };
}
let c;
c = said('http://127.0.0.1:1/'); ok(c.said === true, 'refused: loopback', 'http://127.0.0.1:1/ (loopback) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://127.9.9.9:1/'); ok(c.said === true, 'refused: any 127.x address', 'http://127.9.9.9:1/ (any 127.x address) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://0.0.0.0:1/'); ok(c.said === true, 'refused: the any address', 'http://0.0.0.0:1/ (the any address) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://localhost:1/'); ok(c.said === true, 'refused: localhost', 'http://localhost:1/ (localhost) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://a.localhost:1/'); ok(c.said === true, 'refused: a name under .localhost', 'http://a.localhost:1/ (a name under .localhost) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://[::1]:1/'); ok(c.said === true, 'refused: IPv6 loopback', 'http://[::1]:1/ (IPv6 loopback) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://[0:0:0:0:0:0:0:1]:1/'); ok(c.said === true, 'refused: IPv6 loopback written in full', 'http://[0:0:0:0:0:0:0:1]:1/ (IPv6 loopback written in full) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://[::]:1/'); ok(c.said === true, 'refused: the IPv6 any address', 'http://[::]:1/ (the IPv6 any address) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
// The reported failure (goal/G41.30, Andy, 2026-11-02: "isThisMachine('::ffff:7f00:1') is false, and new URL rewrites
// [::ffff:127.0.0.1] to that form, so an IPv4-mapped literal passes the gate").
c = said('http://[::ffff:127.0.0.1]:1/'); ok(c.said === true, 'refused: IPv4-mapped loopback, which new URL writes as ::ffff:7f00:1', 'http://[::ffff:127.0.0.1]:1/ (IPv4-mapped loopback, which new URL writes as ::ffff:7f00:1) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://[0:0:0:0:0:ffff:127.0.0.1]:1/'); ok(c.said === true, 'refused: IPv4-mapped loopback written in full', 'http://[0:0:0:0:0:ffff:127.0.0.1]:1/ (IPv4-mapped loopback written in full) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://[::ffff:7f00:1]:1/'); ok(c.said === true, 'refused: IPv4-mapped loopback in hex', 'http://[::ffff:7f00:1]:1/ (IPv4-mapped loopback in hex) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://[::127.0.0.1]:1/'); ok(c.said === true, 'refused: IPv4-compatible loopback, which new URL writes as ::7f00:1', 'http://[::127.0.0.1]:1/ (IPv4-compatible loopback, which new URL writes as ::7f00:1) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));
c = said('http://[::ffff:0.0.0.0]:1/'); ok(c.said === true, 'refused: IPv4-mapped any address', 'http://[::ffff:0.0.0.0]:1/ (IPv4-mapped any address) reaches isThisMachine as ' + c.host + ' and is let through: ' + String(c.said));

test.subHeading('another machine stays reachable');
c = said('http://93.184.216.34:1/'); ok(c.said === false, 'let through: an address on the internet', 'http://93.184.216.34:1/ (an address on the internet) is refused: ' + String(c.said));
c = said('http://example.com:1/'); ok(c.said === false, 'let through: a name, checked at connect by netFence.lookup', 'http://example.com:1/ (a name, checked at connect by netFence.lookup) is refused: ' + String(c.said));
c = said('http://[2606:2800:220:1:248:1893:25c8:1946]:1/'); ok(c.said === false, 'let through: an IPv6 address on the internet', 'http://[2606:2800:220:1:248:1893:25c8:1946]:1/ (an IPv6 address on the internet) is refused: ' + String(c.said));
c = said('http://[::ffff:93.184.216.34]:1/'); ok(c.said === false, 'let through: an IPv4-mapped address of another machine', 'http://[::ffff:93.184.216.34]:1/ (an IPv4-mapped address of another machine) is refused: ' + String(c.said));

test.reportSuccessFailureCount();
