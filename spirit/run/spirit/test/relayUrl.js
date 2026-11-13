'use strict';

// spirit/run/spirit/test/relayUrl.js
// The tests of spirit/relayUrl.js, and of no other module (spec: ./relayUrl.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v71, 10: relayUrl was red in the garbage rule because it
// had none).
//
// Which address a relay may be reached at: https, or http to loopback (goal/G22.4). It sends nothing.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const U = require(path.join(RUN, 'spirit', 'relayUrl.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// What assertRelayUrl answers: the URL's href, or 'throws: <message>'.
function asked(url) { try { return U.assertRelayUrl(url).href; } catch (e) { return 'throws: ' + e.message; } }

test.run('isLoopbackHost: localhost, 127.0.0.1 and ::1, in any case, are loopback', 0.2, function () {
  const got = ['localhost', 'LOCALHOST', '127.0.0.1', '::1'].map(U.isLoopbackHost);
  return got.every(function (x) { return x === true; }) || 'answered ' + short(got);
}, test.limit.quick);
test.run('isLoopbackHost: any other host, an empty one and none are not', 0.2, function () {
  const got = ['spirit.andyflinn.com', '127.0.0.2', '10.0.0.1', 'localhost.example', '', null, undefined].map(U.isLoopbackHost);
  return got.every(function (x) { return x === false; }) || 'answered ' + short(got);
}, test.limit.quick);
test.run('an https relay url is taken, answered as a URL', 0.2, function () {
  const u = (function () { try { return U.assertRelayUrl('https://noderoutes.net/'); } catch (e) { return e; } })();
  return (u instanceof URL && u.hostname === 'noderoutes.net') || 'answered ' + short(u && (u.message || u));
}, test.limit.quick);
test.run('http to loopback is taken, for lab relays', 0.2, function () {
  const got = ['http://localhost:45420/', 'http://127.0.0.1:45420/', 'http://[::1]:45420/'].map(asked);
  return got.every(function (x) { return x.indexOf('throws') !== 0; }) || 'answered ' + short(got);
}, test.limit.quick);
test.run('http to any other host is refused: a public relay must be https', 0.2, function () {
  const got = ['http://noderoutes.net/', 'http://10.0.0.1:45420/', 'http://localhost.example/'].map(asked);
  return got.every(function (x) { return /^throws: relay url must be https/.test(x); }) || 'answered ' + short(got);
}, test.limit.quick);
test.run('another protocol is refused, even to loopback', 0.2, function () {
  const got = ['ws://localhost:45420/', 'ftp://noderoutes.net/', 'file:///etc/passwd'].map(asked);
  return got.every(function (x) { return /^throws: relay url must be https/.test(x); }) || 'answered ' + short(got);
}, test.limit.quick);
test.run('what is no url at all is refused as a bad relay url', 0.2, function () {
  const got = ['noderoutes.net', '', null, undefined, 'https//x'].map(asked);
  return got.every(function (x) { return x === 'throws: bad relay url'; }) || 'answered ' + short(got);
}, test.limit.quick);
