'use strict';

// spirit/run/spirit/test/router.js
// The tests of spirit/router.js, and of no other module (spec: ./router.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v71, 9: router was red in the garbage rule because it had none).
//
// createRouter(opts): the relay's pending-request table, hash -> who asked, who was asked. Each test makes a router of
// its own on a planted clock, so a route's age is set, not waited for.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const R = require(path.join(RUN, 'spirit', 'router.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A router on a clock the test moves: r.clock.t is now.
function router(opts) {
  const clock = { t: 1000000 };
  const r = R.createRouter(Object.assign({ now: function () { return clock.t; } }, opts || {}));
  r.clock = clock;
  return r;
}
const sent = function () { return true; };

// ── open: register, then deliver ──
test.run('open files the route, then delivers: 202 with the hash and the time granted', 0.2, function () {
  const r = router();
  let filedAtDelivery = null;
  const a = r.open('h1', 'alice', 'bob', function () { filedAtDelivery = r.has('h1'); return true; });
  return (a.ok === true && a.status === 202 && a.hash === 'h1' && a.grantedMs === R.DEFAULT_TTL_MS && filedAtDelivery === true && r.size() === 1) || 'open: ' + short(a) + ', filed at delivery ' + filedAtDelivery;
}, test.limit.quick);
test.run('open with no delivery is refused, 500, and files nothing', 0.2, function () {
  const r = router();
  const a = r.open('h1', 'alice', 'bob');
  return (a.ok === false && a.status === 500 && /requires the delivery/.test(a.error) && r.size() === 0) || 'open: ' + short(a);
}, test.limit.quick);
test.run('open with no hash, requester or target is refused, 400', 0.2, function () {
  const r = router();
  const got = [r.open('', 'a', 'b', sent), r.open('h', '', 'b', sent), r.open('h', 'a', '', sent)].map(function (x) { return x.status; });
  return JSON.stringify(got) === '[400,400,400]' || 'statuses ' + short(got);
}, test.limit.quick);
test.run('an unknown requester class is refused, 500, never taken as a member', 0.2, function () {
  const r = router();
  const a = r.open('h1', 'alice', 'bob', sent, null, 'relay');
  return (a.ok === false && a.status === 500 && /unknown requester class/.test(a.error) && r.size() === 0) || 'open: ' + short(a);
}, test.limit.quick);
test.run('a delivery that fails, by false or by throwing, leaves no route: 502', 0.2, function () {
  const r = router();
  const a = r.open('h1', 'alice', 'bob', function () { return false; });
  const b = r.open('h2', 'alice', 'bob', function () { throw new Error('socket gone'); });
  return (a.status === 502 && b.status === 502 && r.size() === 0 && r.has('h1') === false) || 'open: ' + short([a, b]) + ', size ' + r.size();
}, test.limit.quick);
test.run('a hash already in flight answers 409, inFlight, and delivers nothing', 0.2, function () {
  const r = router({ maxPerRequester: 5, maxPerTarget: 5 });
  r.open('h1', 'alice', 'bob', sent);
  let called = false;
  const a = r.open('h1', 'carol', 'dave', function () { called = true; return true; });
  return (a.status === 409 && a.inFlight === true && called === false) || 'open: ' + short(a) + ', delivered ' + called;
}, test.limit.quick);

// ── the caps ──
test.run('one in flight per requester by default: a second is 429, too many in flight', 0.2, function () {
  const r = router();
  r.open('h1', 'alice', 'bob', sent);
  const a = r.open('h2', 'alice', 'carol', sent);
  return (R.DEFAULT_PER_MEMBER === 1 && a.status === 429 && a.kind === R.MEMBER) || 'open: ' + short(a);
}, test.limit.quick);
test.run('the target slot is per sender: a sender\'s second post to one member is busy, another sender\'s is not', 0.2, function () {
  const r = router({ maxPerRequester: 5 });
  r.clock.t = 1000000;
  r.open('h1', 'alice', 'bob', sent);
  r.clock.t += 1000;
  const busy = r.open('h2', 'alice', 'bob', sent);
  const other = r.open('h3', 'carol', 'bob', sent);
  return (busy.status === 503 && busy.busy === true && busy.retryAfterMs === R.DEFAULT_TTL_MS - 1000 && other.ok === true) || 'alice again ' + short(busy) + ', carol ' + short(other);
}, test.limit.quick);
test.run('a route to the relay\'s own key counts against no target slot', 0.2, function () {
  const r = router({ maxPerRequester: 5, selfKey: 'relay-key' });
  const a = r.open('h1', 'alice', 'relay-key', sent);
  const b = r.open('h2', 'alice', 'relay-key', sent);
  return (a.ok === true && b.ok === true) || 'open: ' + short([a, b]);
}, test.limit.quick);
test.run('when both caps are over, the requester\'s own is said first', 0.2, function () {
  const r = router();
  r.open('h1', 'alice', 'bob', sent);
  const a = r.open('h2', 'alice', 'bob', sent);
  return a.status === 429 || 'open: ' + short(a);
}, test.limit.quick);
test.run('a full table refuses, 503 router full, never drops', 0.2, function () {
  const r = router({ max: 2, maxPerRequester: 9, maxPerTarget: 9 });
  r.open('h1', 'a', 'b', sent); r.open('h2', 'a', 'b', sent);
  const c = r.open('h3', 'a', 'b', sent);
  return (c.status === 503 && c.error === 'router full' && r.has('h1') && r.has('h2') && r.size() === 2) || 'open: ' + short(c);
}, test.limit.quick);
test.run('a number for maxPerRequester sets every class; an object sets them apart', 0.2, function () {
  const a = router({ maxPerRequester: 3 }), b = router({ maxPerRequester: { member: 2 } });
  return (a.caps.member === 3 && a.maxPerRequester === 3 && b.caps.member === 2) || 'caps ' + short([a.caps, b.caps]);
}, test.limit.quick);

// ── time: granted, not taken ──
test.run('a requester asking less than the ceiling gets what it asked; asking more gets the ceiling', 0.2, function () {
  const r = router({ maxPerRequester: 5, maxPerTarget: 5 });
  const less = r.open('h1', 'a', 'b', sent, null, { kind: R.MEMBER, ttlMs: 1200 });
  const more = r.open('h2', 'a', 'b', sent, null, { kind: R.MEMBER, ttlMs: 60000 });
  return (less.grantedMs === 1200 && more.grantedMs === R.DEFAULT_TTL_MS) || 'granted ' + short([less.grantedMs, more.grantedMs]);
}, test.limit.quick);
test.run('no time left is refused, tooLittleTime; a null time is the default', 0.2, function () {
  const r = router({ maxPerRequester: 5, maxPerTarget: 5 });
  const zero = r.open('h1', 'a', 'b', sent, null, { kind: R.MEMBER, ttlMs: 0 });
  const none = r.open('h2', 'a', 'b', sent, null, { kind: R.MEMBER, ttlMs: null });
  return (zero.status === 503 && zero.tooLittleTime === true && none.grantedMs === R.DEFAULT_TTL_MS) || 'open: ' + short([zero, none]);
}, test.limit.quick);
test.run('a route expires at its own granted time: gone to has, size and the caps', 0.2, function () {
  const r = router();
  r.open('h1', 'alice', 'bob', sent, null, { kind: R.MEMBER, ttlMs: 1000 });
  r.clock.t += 999;
  const still = r.has('h1');
  r.clock.t += 1;
  const again = r.open('h2', 'alice', 'bob', sent);
  return (still === true && r.has('h1') === false && again.ok === true && r.size() === 1) || 'at 999 ms ' + still + ', after: ' + short(again);
}, test.limit.quick);

// ── answer, cancel, release ──
test.run('the target answers: 200, the requester, the target and what was carried; the route is gone', 0.2, function () {
  const r = router();
  const carry = function () {};
  r.open('h1', 'alice', 'bob', sent, carry);
  const a = r.answer('h1', 'bob');
  return (a.ok === true && a.status === 200 && a.requester === 'alice' && a.target === 'bob' && a.carry === carry && r.has('h1') === false) || 'answer: ' + short(a);
}, test.limit.quick);
test.run('anyone but the target answering is 403, and the route stays', 0.2, function () {
  const r = router();
  r.open('h1', 'alice', 'bob', sent);
  const a = r.answer('h1', 'mallory');
  return (a.status === 403 && r.has('h1') === true) || 'answer: ' + short(a);
}, test.limit.quick);
test.run('an answer to no route, or to one expired, is 404', 0.2, function () {
  const r = router();
  r.open('h1', 'alice', 'bob', sent);
  r.clock.t += R.DEFAULT_TTL_MS;
  return (r.answer('h1', 'bob').status === 404 && r.answer('zz', 'bob').status === 404) || 'answers ' + short([r.answer('h1', 'bob'), r.answer('zz', 'bob')]);
}, test.limit.quick);
test.run('cancel takes back the requester\'s own route only', 0.2, function () {
  const r = router();
  r.open('h1', 'alice', 'bob', sent);
  const other = r.cancel('h1', 'carol');
  const own = r.cancel('h1', 'alice');
  return (other === false && own === true && r.has('h1') === false) || 'cancel by carol ' + other + ', by alice ' + own;
}, test.limit.quick);
test.run('release hands back every route naming one identity, each with the side it was on', 0.2, function () {
  const r = router({ maxPerRequester: 5, maxPerTarget: 5 });
  r.open('h1', 'alice', 'bob', sent); r.open('h2', 'bob', 'carol', sent); r.open('h3', 'carol', 'dave', sent);
  const out = r.release('bob').sort(function (x, y) { return x.hash < y.hash ? -1 : 1; });
  const sides = out.map(function (e) { return e.hash + ':' + e.as; });
  return (JSON.stringify(sides) === '["h1:target","h2:requester"]' && r.has('h3') && r.size() === 1) || 'released ' + short(sides) + ', size ' + r.size();
}, test.limit.quick);
