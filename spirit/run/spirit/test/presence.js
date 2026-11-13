'use strict';

// spirit/run/spirit/test/presence.js
// The tests of spirit/presence.js, and of no other module (spec: ./presence.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// Who is connected to this relay, right now, in RAM: the connection is the presence. A sink is anything with write and
// close, so each test plants sinks that record what they were told, and a planted clock.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const P = require(path.join(RUN, 'spirit', 'presence.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A sink that records: what was written, whether it was closed.
function sink(opts) {
  const s = { said: [], closed: 0 };
  s.write = function (t) { if (opts && opts.writeThrows) throw new Error('gone'); s.said.push(t); };
  s.close = function () { s.closed += 1; if (opts && opts.closeThrows) throw new Error('gone'); };
  return s;
}
function planted(extra) {
  const clock = { t: 1000000 };
  const r = P.createRegistry(Object.assign({ now: function () { return clock.t; } }, extra || {}));
  return { r: r, clock: clock };
}

// ── the connection is the presence ──
test.run('a connect makes its id present; a disconnect makes it absent', 0.2, function () {
  const { r } = planted();
  const a = sink();
  const c = r.connect('alice', a);
  const was = r.isPresent('alice');
  const d = r.disconnect('alice', a);
  return (c.ok === true && c.status === 200 && was === true && d === true && r.isPresent('alice') === false && short(r.present()) === '[]') || short([c, was, d]);
}, test.limit.quick);
test.run('no id or no sink is refused, 403', 0.2, function () {
  const { r } = planted();
  const got = [r.connect('', sink()), r.connect('alice', null)];
  return got.every(function (g) { return g.ok === false && g.status === 403; }) || short(got);
}, test.limit.quick);
test.run('newest wins: a second connect replaces and closes the first', 0.2, function () {
  const { r } = planted();
  const a = sink(); const b = sink();
  r.connect('alice', a);
  const c = r.connect('alice', b);
  r.send('alice', 'ping', { n: 1 });
  return (c.ok && c.replaced === true && a.closed === 1 && a.said.length === 0 && b.said.length === 1) || short([c, a.closed, a.said, b.said]);
}, test.limit.quick);
test.run('a replaced sink that throws on close does not break the connect', 0.2, function () {
  const { r } = planted();
  r.connect('alice', sink({ closeThrows: true }));
  const c = r.connect('alice', sink());
  return (c.ok === true && r.isPresent('alice')) || short(c);
}, test.limit.quick);
test.run('a late teardown of the old sink does not evict the new connection', 0.2, function () {
  const { r } = planted();
  const a = sink(); const b = sink();
  r.connect('alice', a); r.connect('alice', b);
  const d = r.disconnect('alice', a);
  return (d === false && r.isPresent('alice')) || 'disconnect ' + d + ', present ' + r.isPresent('alice');
}, test.limit.quick);
test.run('disconnect is idempotent: a second answers false', 0.2, function () {
  const { r } = planted();
  const a = sink();
  r.connect('alice', a);
  return short([r.disconnect('alice', a), r.disconnect('alice', a), r.disconnect('', a)]) === short([true, false, false]) || 'not idempotent';
}, test.limit.quick);

// ── the connect rate ──
test.run('six connects a minute per id, the seventh refused 429', 0.2, function () {
  const { r } = planted();
  const got = [];
  for (let i = 0; i < 7; i += 1) got.push(r.connect('alice', sink()).status);
  return (P.DEFAULT_PER_MIN === 6 && r.perMin === 6 && short(got) === short([200, 200, 200, 200, 200, 200, 429])) || 'statuses ' + short(got);
}, test.limit.quick);
test.run('the rate is per id, and a minute later it is open again', 0.2, function () {
  const { r, clock } = planted({ perMin: 2 });
  r.connect('alice', sink()); r.connect('alice', sink());
  const other = r.connect('bob', sink()).status;
  const held = r.connect('alice', sink()).status;
  clock.t += 60000;
  const later = r.connect('alice', sink()).status;
  return short([other, held, later]) === short([200, 429, 200]) || 'bob, alice held, alice later: ' + short([other, held, later]);
}, test.limit.quick);

// ── the allowance: a refusal, never a drop ──
test.run('a full relay turns a newcomer away with 503 and closes nobody already here', 0.2, function () {
  const { r } = planted({ allowed: 1 });
  const a = sink();
  r.connect('alice', a);
  const c = r.connect('bob', sink());
  return (c.ok === false && c.status === 503 && c.full === true && a.closed === 0 && r.isPresent('alice')) || short([c, a.closed]);
}, test.limit.quick);
test.run('a reconnect needs no room, and the owner (always) is admitted whatever the count', 0.2, function () {
  const { r } = planted({ allowed: 1 });
  r.connect('alice', sink());
  const again = r.connect('alice', sink());
  const owner = r.connect('owner', sink(), true);
  return (again.ok && owner.ok && r.present().length === 2) || short([again, owner]);
}, test.limit.quick);
test.run('streams held outside the book count against the same allowance (goal/G30.12)', 0.2, function () {
  const { r } = planted({ allowed: 2, others: function () { return 1; } });
  r.connect('alice', sink());
  const c = r.connect('bob', sink());
  return (c.status === 503 && r.full() === true) || short(c);
}, test.limit.quick);
test.run('setAllowed sets the allowance; anything not a number from zero makes it unlimited', 0.2, function () {
  const { r } = planted();
  const before = r.allowed();
  const got = [r.setAllowed(3), r.allowed(), r.setAllowed(-1), r.setAllowed('x')];
  return (before === Infinity && short(got.slice(0, 2)) === '[3,3]' && got[2] === Infinity && got[3] === Infinity) || short([before, got]);
}, test.limit.quick);

// ── eviction ──
test.run('evictIdlest closes the longest-idle first, sparing whom it is told to, and answers the ids', 0.2, function () {
  const { r, clock } = planted();
  const s = { a: sink(), b: sink(), c: sink(), o: sink() };
  r.connect('a', s.a); clock.t += 10; r.connect('b', s.b); clock.t += 10; r.connect('c', s.c); clock.t += 10; r.connect('owner', s.o);
  // a posted most recently; so b, then c, are the idlest. The owner is spared, though it opened last of all but idle.
  const closed = r.evictIdlest(2, function (id) { return id === 'owner'; }, function (id) { return id === 'a' ? clock.t + 100 : 0; });
  return (short(closed) === short(['b', 'c']) && s.b.closed === 1 && s.c.closed === 1 && s.a.closed === 0 && s.o.closed === 0 && short(r.present().sort()) === short(['a', 'owner'])) || 'closed ' + short(closed) + ', present ' + short(r.present());
}, test.limit.quick);

// ── speaking ──
test.run('send writes one SSE event, its data JSON', 0.2, function () {
  const { r } = planted();
  const a = sink();
  r.connect('alice', a);
  const ok = r.send('alice', 'presence', { key: 'k', present: true });
  return (ok === true && a.said[0] === 'event: presence\ndata: {"key":"k","present":true}\n\n') || short([ok, a.said]);
}, test.limit.quick);
test.run('send to someone absent answers false', 0.2, function () {
  return planted().r.send('nobody', 'x', {}) === false || 'sent to nobody';
}, test.limit.quick);
test.run('broadcast reaches everybody, or those keep() keeps, and drops a sink that will not take a write', 0.2, function () {
  const { r } = planted();
  const a = sink(); const b = sink(); const dead = sink({ writeThrows: true });
  r.connect('a', a); r.connect('b', b); r.connect('dead', dead);
  const all = r.broadcast('presence', { key: 'x' });
  const kept = r.broadcast('presence', { key: 'y' }, function (id) { return id !== 'a'; });
  return (all === 2 && kept === 1 && a.said.length === 1 && b.said.length === 2 && r.isPresent('dead') === false) || short([all, kept, a.said.length, b.said.length, r.present()]);
}, test.limit.quick);

// ── going away ──
test.run('sayGoingAway writes a retry hint to each sink, then closes each, and counts those told', 0.2, function () {
  const order = [];
  const s = { write: function (t) { order.push('write ' + t); }, close: function () { order.push('close'); } };
  const s2 = sink({ writeThrows: true });
  const told = P.sayGoingAway([s, s2, null, {}], 3000);
  return (told === 1 && short(order) === short(['write retry: 3000\n\n', 'close']) && s2.closed === 1) || short([told, order, s2.closed]);
}, test.limit.quick);
test.run('the retry hint is bounded: never below zero, never above an hour', 0.2, function () {
  const said = [];
  const s = { write: function (t) { said.push(t); }, close: function () {} };
  P.sayGoingAway([s], -5); P.sayGoingAway([s], 1e9); P.sayGoingAway([s]);
  return short(said) === short(['retry: 0\n\n', 'retry: 3600000\n\n', 'retry: 0\n\n']) || short(said);
}, test.limit.quick);
test.run('goingAway tells every member and empties the book', 0.2, function () {
  const { r } = planted();
  const a = sink(); const b = sink();
  r.connect('a', a); r.connect('b', b);
  const told = r.goingAway(3000);
  return (told === 2 && a.said[0] === 'retry: 3000\n\n' && a.closed === 1 && b.closed === 1 && r.present().length === 0) || short([told, a.said, r.present()]);
}, test.limit.quick);
test.run('reset closes every sink and forgets the rate', 0.2, function () {
  const { r } = planted({ perMin: 1 });
  const a = sink();
  r.connect('a', a);
  r.reset();
  const again = r.connect('a', sink());
  return (a.closed === 1 && again.ok === true) || short([a.closed, again]);
}, test.limit.quick);
