'use strict';

// spirit/run/spirit/test/postQueue.js
// The tests of spirit/postQueue.js, and of no other module (spec: ./postQueue.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// createQueue(opts): which request goes next, and nothing else; a decision structure peerPost drives. No sockets, no
// timers: each test makes a queue on a planted clock and moves the clock by hand.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const Q = require(path.join(RUN, 'spirit', 'postQueue.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A queue on a planted clock: clock.t is now.
function planted(extra) {
  const clock = { t: 1000 };
  const q = Q.createQueue(Object.assign({ now: function () { return clock.t; } }, extra || {}));
  return { q: q, clock: clock };
}
const R1 = 'https://relay-one.example';
const R2 = 'https://relay-two.example';

// ── the numbers decided ──
test.run('one request in flight per relay, the relay\'s own per-member cap (decision 0016)', 0.2, function () {
  return (Q.IN_FLIGHT_PER_RELAY === 1 && planted().q.perRelay === 1) || 'IN_FLIGHT_PER_RELAY ' + short(Q.IN_FLIGHT_PER_RELAY);
}, test.limit.quick);
test.run('the queue holds 4 MB, background yielding at a quarter of it', 0.2, function () {
  return (Q.QUEUE_BYTES_MAX === 4 * 1024 * 1024 && Q.BACKGROUND_SHARE === 0.25) || short([Q.QUEUE_BYTES_MAX, Q.BACKGROUND_SHARE]);
}, test.limit.quick);
test.run('a timeout backs off from 2 s, never beyond 5 minutes', 0.2, function () {
  return (Q.BACKOFF_START_MS === 2000 && Q.BACKOFF_MAX_MS === 300000) || short([Q.BACKOFF_START_MS, Q.BACKOFF_MAX_MS]);
}, test.limit.quick);

// ── order: class, then age; eligibility selects ──
test.run('add answers a sequence that grows, even in one millisecond (a sequence, not a clock)', 0.2, function () {
  const { q } = planted();
  const s = [q.add({ relayUrl: R1, toKey: 'a' }), q.add({ relayUrl: R1, toKey: 'b' }), q.add({ relayUrl: R1, toKey: 'c' })];
  return (s[0] < s[1] && s[1] < s[2] && q.size() === 3) || 'sequences ' + short(s) + ', size ' + q.size();
}, test.limit.quick);
test.run('the oldest goes first within a class', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a' }); q.add({ relayUrl: R1, toKey: 'b' });
  const e = q.eligible();
  return (!!e && e.seq === a) || 'eligible ' + short(e);
}, test.limit.quick);
test.run('a deliberate request goes before older background work (class outranks age)', 0.2, function () {
  const { q } = planted();
  q.add({ relayUrl: R1, toKey: 'probe1', kind: Q.BACKGROUND }); q.add({ relayUrl: R1, toKey: 'probe2', kind: Q.BACKGROUND });
  const typed = q.add({ relayUrl: R1, toKey: 'person', kind: Q.DELIBERATE });
  const e = q.eligible();
  return (!!e && e.seq === typed) || 'eligible ' + short(e);
}, test.limit.quick);
test.run('an unknown class is taken as deliberate', 0.2, function () {
  const { q } = planted();
  const s = q.add({ relayUrl: R1, toKey: 'a', kind: 'urgent!!' });
  return q.find(s).kind === Q.DELIBERATE || 'kind ' + short(q.find(s).kind);
}, test.limit.quick);
test.run('a backed-off target does not hold up a reachable one behind it (no head-of-line block)', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'busyPeer' }); const b = q.add({ relayUrl: R1, toKey: 'freePeer' });
  q.started(a); q.silent(a);
  const e = q.eligible();
  return (!!e && e.seq === b) || 'eligible ' + short(e);
}, test.limit.quick);
test.run('a relay with its one slot taken gives nothing more; another relay still does', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a' }); q.add({ relayUrl: R1, toKey: 'b' }); const c = q.add({ relayUrl: R2, toKey: 'c' });
  const ok = q.started(a);
  const e = q.eligible();
  return (ok && q.inFlightFor(R1) === 1 && !!e && e.seq === c) || 'started ' + ok + ', in flight ' + q.inFlightFor(R1) + ', eligible ' + short(e);
}, test.limit.quick);
test.run('started counts an attempt and refuses a second start; stopped frees the slot', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a' });
  const got = [q.started(a), q.started(a), q.find(a).attempts, q.stopped(a), q.inFlightFor(R1), q.stopped(a)];
  return short(got) === short([true, false, 1, true, 0, false]) || 'started, started, attempts, stopped, in flight, stopped: ' + short(got);
}, test.limit.quick);
test.run('done drops the entry, its bytes and its slot', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a', bytes: 100 });
  q.started(a);
  const ok = q.done(a);
  return (ok && q.size() === 0 && q.bytes() === 0 && q.inFlightFor(R1) === 0 && q.find(a) === null) || 'done ' + ok + ', size ' + q.size() + ', bytes ' + q.bytes();
}, test.limit.quick);

// ── a timeout and a refusal back off differently ──
test.run('a timeout doubles the wait per pair, 2 s, 4 s, 8 s', 0.2, function () {
  const { q, clock } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a', patienceMs: 1e9 });
  const waits = [];
  for (let i = 0; i < 3; i += 1) { q.started(a); q.silent(a); waits.push(q.backoffFor(R1, 'a')); clock.t += waits[i]; }
  return short(waits) === short([2000, 4000, 8000]) || 'waits ' + short(waits);
}, test.limit.quick);
test.run('a timeout\'s wait never passes the cap', 0.2, function () {
  const { q } = planted({ backoffMaxMs: 5000 });
  const a = q.add({ relayUrl: R1, toKey: 'a' });
  const waits = [];
  for (let i = 0; i < 4; i += 1) { q.started(a); q.silent(a); waits.push(q.backoffFor(R1, 'a')); }
  return short(waits) === short([2000, 4000, 5000, 5000]) || 'waits ' + short(waits);
}, test.limit.quick);
test.run('busy grows 250, 500, 1000, 2000 ms and no further (goal/G4.30, Andy: "agreed.")', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a' });
  const waits = [];
  for (let i = 0; i < 5; i += 1) { q.started(a); q.busy(a, 5000); waits.push(q.backoffFor(R1, 'a')); }
  return short(waits) === short([250, 500, 1000, 2000, 2000]) || 'waits ' + short(waits);
}, test.limit.quick);
test.run('busy never waits longer than the relay\'s own quote', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a' });
  q.started(a); q.busy(a, 100);
  return q.backoffFor(R1, 'a') === 100 || 'wait ' + q.backoffFor(R1, 'a');
}, test.limit.quick);
test.run('a refusal does not lengthen the wait a later timeout starts from', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a' });
  q.started(a); q.busy(a, 5000); q.started(a); q.busy(a, 5000);
  q.started(a); q.silent(a);
  return (q.backoffFor(R1, 'a') === 2000 && q.pairState(R1, 'a').lastWait === 2000) || 'after two busy, a timeout waits ' + q.backoffFor(R1, 'a');
}, test.limit.quick);
test.run('a backoff is the pair\'s: the same target on another relay is not held', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'peer' }); const b = q.add({ relayUrl: R2, toKey: 'peer' });
  q.started(a); q.silent(a);
  const e = q.eligible();
  return (q.backoffFor(R2, 'peer') === 0 && !!e && e.seq === b) || 'R2 backoff ' + q.backoffFor(R2, 'peer') + ', eligible ' + short(e);
}, test.limit.quick);
test.run('reached clears the backoff, and the next timeout and busy start from the bottom again', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a' });
  q.started(a); q.silent(a); q.started(a); q.silent(a); q.started(a); q.busy(a, 5000); q.started(a); q.busy(a, 5000);
  q.reached(R1, 'a');
  const cleared = q.backoffFor(R1, 'a');
  q.started(a); q.silent(a); const t = q.backoffFor(R1, 'a');
  q.reached(R1, 'a'); q.started(a); q.busy(a, 5000); const b = q.backoffFor(R1, 'a');
  return (cleared === 0 && t === 2000 && b === 250) || 'cleared ' + cleared + ', timeout ' + t + ', busy ' + b;
}, test.limit.quick);
test.run('busy and silent on an unknown entry answer false', 0.2, function () {
  const { q } = planted();
  return (q.busy(99, 100) === false && q.silent(99) === false) || 'answered true for nothing';
}, test.limit.quick);
test.run('a backed-off target is eligible again once its wait lapses', 0.2, function () {
  const { q, clock } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a' });
  q.started(a); q.silent(a);
  const held = q.eligible();
  clock.t += 2000;
  const e = q.eligible();
  return (held === null && !!e && e.seq === a) || 'before ' + short(held) + ', after ' + short(e);
}, test.limit.quick);

// ── patience ──
test.run('patience bounds retrying, never the first attempt: an untried entry never expires', 0.2, function () {
  const { q, clock } = planted();
  q.add({ relayUrl: R1, toKey: 'a' });
  clock.t += 1e6;
  return q.expired().length === 0 || 'expired ' + short(q.expired());
}, test.limit.quick);
test.run('an entry on the wire never expires', 0.2, function () {
  const { q, clock } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a', patienceMs: 10 });
  q.started(a); clock.t += 1000;
  return q.expired().length === 0 || 'expired ' + short(q.expired());
}, test.limit.quick);
test.run('a tried entry past its patience is expired; within it, it may retry', 0.2, function () {
  const { q, clock } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a', patienceMs: 500 });
  q.started(a); q.stopped(a);
  const within = [q.expired().length, q.mayRetry(a)];
  clock.t += 500;
  const past = [q.expired().map(function (x) { return x.seq; }), q.mayRetry(a)];
  return (within[0] === 0 && within[1] === true && short(past[0]) === short([a]) && past[1] === false) || 'within ' + short(within) + ', past ' + short(past);
}, test.limit.quick);
test.run('no patience means one attempt and no retry', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a' });
  return q.mayRetry(a) === false || 'a zero-patience entry may retry';
}, test.limit.quick);

// ── when to wake ──
test.run('nextWakeMs is null when nothing waits on a clock, even behind a busy relay (the busy loop that was)', 0.2, function () {
  const { q } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a' }); q.add({ relayUrl: R1, toKey: 'b' });
  q.started(a);
  const empty = planted().q.nextWakeMs();
  return (q.nextWakeMs() === null && empty === null) || 'nextWakeMs ' + short([q.nextWakeMs(), empty]);
}, test.limit.quick);
test.run('nextWakeMs is the soonest backoff or patience still ahead', 0.2, function () {
  const { q, clock } = planted();
  const a = q.add({ relayUrl: R1, toKey: 'a', patienceMs: 10000 });
  q.started(a); q.silent(a);
  const first = q.nextWakeMs();
  clock.t += 2000;
  const second = q.nextWakeMs();
  return (first === 2000 && second === 8000) || 'wakes ' + short([first, second]);
}, test.limit.quick);

// ── refusing at the door ──
test.run('accepts refuses what would pass the bytes held, and takes what fits', 0.2, function () {
  const { q } = planted({ maxBytes: 1000 });
  q.add({ relayUrl: R1, toKey: 'a', bytes: 600 });
  const got = [q.accepts(Q.DELIBERATE, 400), q.accepts(Q.DELIBERATE, 401), q.bytes()];
  return short(got) === short([true, false, 600]) || 'accepts 400, 401, bytes: ' + short(got);
}, test.limit.quick);
test.run('background is refused once the queue holds a quarter, while deliberate still fits', 0.2, function () {
  const { q } = planted({ maxBytes: 1000 });
  q.add({ relayUrl: R1, toKey: 'a', bytes: 200 });
  const got = [q.accepts(Q.BACKGROUND, 50), q.accepts(Q.BACKGROUND, 51), q.accepts(Q.DELIBERATE, 51)];
  return short(got) === short([true, false, true]) || 'background 50, 51, deliberate 51: ' + short(got);
}, test.limit.quick);
test.run('a refusal at the door leaves the queue as it was (no drop from the middle)', 0.2, function () {
  const { q } = planted({ maxBytes: 1000 });
  q.add({ relayUrl: R1, toKey: 'a', bytes: 900 });
  q.accepts(Q.DELIBERATE, 500);
  return (q.size() === 1 && q.bytes() === 900) || 'size ' + q.size() + ', bytes ' + q.bytes();
}, test.limit.quick);

// ── a restart ──
test.run('restoreItem keeps the order given, its clock, its attempts, and is never sending', 0.2, function () {
  const { q } = planted();
  const a = q.restoreItem({ relayUrl: R1, toKey: 'old', at: 5, until: 9999, attempts: 2, bytes: 10, sending: true });
  const b = q.restoreItem({ relayUrl: R1, toKey: 'newer', at: 6, until: 9999 });
  const it = q.find(a);
  const e = q.eligible();
  return (a < b && it.at === 5 && it.until === 9999 && it.attempts === 2 && it.sending === false && q.bytes() === 10 && !!e && e.seq === a) || 'restored ' + short(it) + ', eligible ' + short(e);
}, test.limit.quick);
test.run('restorePair brings a backoff back, and pairState reads it', 0.2, function () {
  const { q } = planted();
  q.restorePair(R1, 'a', 4000, 2000);
  q.add({ relayUrl: R1, toKey: 'a' });
  const s = q.pairState(R1, 'a');
  return (s.until === 4000 && s.lastWait === 2000 && q.backoffFor(R1, 'a') === 3000 && q.eligible() === null) || 'pair ' + short(s) + ', backoff ' + q.backoffFor(R1, 'a');
}, test.limit.quick);
test.run('now is the queue\'s own clock', 0.2, function () {
  const { q, clock } = planted();
  clock.t = 4242;
  return q.now() === 4242 || 'now ' + q.now();
}, test.limit.quick);
test.run('with no clock given it measures on a monotonic one', 0.2, function () {
  const q = Q.createQueue();
  const t = q.now();
  return (typeof t === 'number' && Math.abs(t - performance.now()) < 1000) || 'now ' + t + ', performance.now ' + performance.now();
}, test.limit.quick);
