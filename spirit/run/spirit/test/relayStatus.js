'use strict';

// spirit/run/spirit/test/relayStatus.js
// The tests of spirit/relayStatus.js, and of no other module (spec: ./relayStatus.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// What a relay tells its owner about itself: a pure function from facts to a report, every fact (the clock included)
// handed in, so each check plants its own.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const S = require(path.join(RUN, 'spirit', 'relayStatus.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const NOW = Date.parse('2026-11-13T09:00:00.000Z');
const INVITES = [
  { token: 'tok-live', label: 'ann', expiresAt: '2026-11-20T00:00:00.000Z', invitedBy: 'owner' },
  { token: 'tok-used', label: 'bob', expiresAt: '2026-11-20T00:00:00.000Z', invitedBy: 'owner', consumedAt: '2026-11-12T00:00:00.000Z' },
  { token: 'tok-gone', label: 'cid', expiresAt: '2026-11-01T00:00:00.000Z', invitedBy: 'owner' },
  { token: 'tok-nolabel', label: '', expiresAt: '2026-11-20T00:00:00.000Z' },
  null,
];
const R = S.report({
  now: NOW,
  snapshot: { owner: 'andy', mode: 'public', relayPublicKey: 'relay-key', peers: 7, messages: 3 },
  proc: { rss: 5000, heapUsed: 2000, heapTotal: 3000, uptime: 61.9 },
  present: ['a', 'b'],
  routes: 4,
  version: 'v9',
  meter: { bytes: 10 },
  caps: { members: 3 },
  ramLimitMB: 256,
  discLimitMB: 64,
  discUsedMB: 1,
  binding: 'disc',
  seats: { held: 1, outstanding: 2, allowance: 9, free: 6 },
  capacity: { freeMB: 100 },
  at: '2026-11-13T08:59:00.000Z',
  invites: INVITES,
});

// ── liveInvites ──
test.run('liveInvites: a token is live if it is unused and unexpired, and has a label', 0.2, function () {
  const live = S.liveInvites(INVITES, NOW).map(function (r) { return r.token; });
  return short(live) === short(['tok-live']) || 'live ' + short(live);
}, test.limit.quick);
test.run('liveInvites: no array is no invite', 0.2, function () {
  const got = [S.liveInvites(null, NOW), S.liveInvites({}, NOW)];
  return (got[0].length === 0 && got[1].length === 0) || short(got);
}, test.limit.quick);

// ── report ──
test.run('report: who and what the relay is: owner, mode, key, version', 0.2, function () {
  return (R.owner === 'andy' && R.mode === 'public' && R.key === 'relay-key' && R.version === 'v9') || short(R);
}, test.limit.quick);
test.run('report: presence travels beside the roster, both numbers (7 connected out of 3 is a thing to see)', 0.2, function () {
  const arr = S.report({ snapshot: { peers: ['x', 'y', 'z'] }, present: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
  return (R.peers === 7 && R.present === 2 && arr.peers === 3 && arr.present === 7) || short({ peers: R.peers, present: R.present, arr: [arr.peers, arr.present] });
}, test.limit.quick);
test.run('report: routes in flight', 0.2, function () {
  return R.routes === 4 || 'routes ' + short(R.routes);
}, test.limit.quick);
test.run('report: invites are labels, expiry and inviter, never the token itself (a token is a credential)', 0.2, function () {
  const text = JSON.stringify(R);
  return (R.invites.length === 1 && R.invites[0].label === 'ann' && R.invites[0].expiresAt === '2026-11-20T00:00:00.000Z' && R.invites[0].invitedBy === 'owner' &&
    text.indexOf('tok-') === -1 && !('token' in R.invites[0])) || 'invites ' + short(R.invites);
}, test.limit.quick);
test.run('report: memory as rss, heapUsed and heapTotal, and uptime in whole seconds, from the process figures handed in', 0.2, function () {
  return (R.memory.rss === 5000 && R.memory.heapUsed === 2000 && R.memory.heapTotal === 3000 && R.uptimeSec === 61) || short({ memory: R.memory, up: R.uptimeSec });
}, test.limit.quick);
test.run('report: the bounds, the binding one, the seats and the capacity pass through whole', 0.2, function () {
  return (R.ramLimitMB === 256 && R.discLimitMB === 64 && R.discUsedMB === 1 && R.binding === 'disc' &&
    short(R.seats) === short({ held: 1, outstanding: 2, allowance: 9, free: 6 }) && R.capacity.freeMB === 100 &&
    R.meter.bytes === 10 && R.caps.members === 3) || short(R);
}, test.limit.quick);
test.run('report: the capture time is the one passed through, not a clock read here', 0.2, function () {
  return R.at === '2026-11-13T08:59:00.000Z' || 'at ' + short(R.at);
}, test.limit.quick);
test.run('report: what the relay did not report is absent, not zeroed ("not told yet" is not "nothing to tell")', 0.2, function () {
  const bare = S.report({ now: NOW });
  const absent = ['meter', 'caps', 'ramLimitMB', 'discLimitMB', 'discUsedMB', 'binding', 'seats', 'capacity', 'levers'].filter(function (k) { return bare[k] !== undefined; });
  return absent.length === 0 || 'present on a bare report: ' + short(absent.map(function (k) { return [k, bare[k]]; }));
}, test.limit.quick);
test.run('report: with nothing handed in, the counts are zero and the lists empty, nothing throws', 0.2, function () {
  const bare = S.report();
  return (bare.peers === 0 && bare.present === 0 && bare.routes === 0 && bare.invites.length === 0 && bare.memory.rss === 0 && bare.uptimeSec === 0) || short(bare);
}, test.limit.quick);
test.run('report: the invites are judged by the clock handed in, not the machine\'s', 0.2, function () {
  const later = S.report({ now: Date.parse('2026-12-01T00:00:00.000Z'), invites: INVITES });
  const earlier = S.report({ now: Date.parse('2026-10-01T00:00:00.000Z'), invites: INVITES });
  return (later.invites.length === 0 && earlier.invites.length === 2) || short({ later: later.invites, earlier: earlier.invites });
}, test.limit.quick);
