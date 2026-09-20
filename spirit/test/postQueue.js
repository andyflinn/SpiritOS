'use strict';

// spirit/test/postQueue.js
// THE NODE'S SCHEDULER, PROVED WITHOUT A SOCKET.
//
// Every rule here is Andy's, and each was argued from a failure it
// prevents rather than from taste. What this suite asserts is that the
// rules hold TOGETHER — most of them are individually obvious and the
// interesting failures are where two of them meet.

const test = require('./testSupport.js');
const pq = require('../run/js/postQueue');

// A clock the suite moves by hand. Every rule in this file is about time,
// and a test that sleeps is a test that will one day be flaky on a slower
// machine (presenceWire learned that for the whole tree).
function clock(start) {
  let t = start || 1000;
  return { now: function () { return t; }, tick: function (ms) { t += ms; return t; } };
}

test.startTest('The post queue — which request goes next');

test.subHeading('One in flight per relay, and per relay is the point');

{
  const c = clock();
  const q = pq.createQueue({ now: c.now });

  const a = q.add({ relayUrl: 'R1', toKey: 'bella' });
  q.add({ relayUrl: 'R1', toKey: 'carlos' });
  const onR2 = q.add({ relayUrl: 'R2', toKey: 'dina' });

  const first = q.eligible();
  q.started(first.seq);

  if (first.seq === a) {
    test.check('the first added goes first');
  } else {
    test.fail('picked seq ' + first.seq + ', wanted ' + a);
  }

  // R1 is spent; R2 is not. A node on three relays has three in flight,
  // one each — its concurrency is relays x cap, by construction.
  const next = q.eligible();
  if (next && next.seq === onR2) {
    test.check('R1 is full, so the next eligible is the one on R2 — not the queue stalling');
  } else {
    test.fail('after R1 busy, eligible was ' + JSON.stringify(next && next.seq));
  }

  q.started(next.seq);
  if (q.eligible() === null) {
    test.check('and with both relays busy, nothing is eligible at all');
  } else {
    test.fail('a third went out with both relays occupied');
  }
}

test.subHeading('A requeue keeps its original place — the anti-starvation rule');

{
  const c = clock();
  const q = pq.createQueue({ now: c.now });

  const old = q.add({ relayUrl: 'R1', toKey: 'bella', patienceMs: 60000 });
  q.started(old);
  q.busy(old, 50);                       // refused, backed off 50ms

  const fresh = q.add({ relayUrl: 'R1', toKey: 'carlos', patienceMs: 60000 });

  // While bella is backed off, carlos goes — head-of-line skipped.
  const during = q.eligible();
  if (during && during.seq === fresh) {
    test.check('while the refused target waits, a later request for another target goes');
  } else {
    test.fail('head-of-line: eligible was ' + JSON.stringify(during && during.seq));
  }
  q.started(during.seq);
  q.done(during.seq);

  // Once the backoff lapses, the OLD one is ahead of anything newer.
  c.tick(60);
  const newer = q.add({ relayUrl: 'R1', toKey: 'dina', patienceMs: 60000 });
  const after = q.eligible();
  if (after && after.seq === old && old < newer) {
    test.check('and when it comes back it is ahead of newer work — it kept its sequence');
  } else {
    test.fail('after backoff, eligible was ' + JSON.stringify(after && after.seq) +
      ' — a requeue took a fresh number and starved itself');
  }
}

test.subHeading('A burst is all ties, which is why the order is a sequence');

{
  // contactsAskEveryone fires a whole contact list in one synchronous
  // loop. The clock does not move, so wall-clock time gives no order at
  // all and the queue would sort differently on every run.
  const c = clock();
  const q = pq.createQueue({ now: c.now });

  const seqs = [];
  for (let n = 0; n < 50; n += 1) {
    seqs.push(q.add({ relayUrl: 'R1', toKey: 'peer' + n }));
  }

  const seen = [];
  for (let n = 0; n < 50; n += 1) {
    const it = q.eligible();
    if (!it) break;
    seen.push(it.seq);
    q.started(it.seq);
    q.done(it.seq);
  }

  const inOrder = seen.length === 50 && seen.every(function (s, i) { return s === seqs[i]; });
  if (inOrder) {
    test.check('fifty posted in the same millisecond come out in the order they were fired');
  } else {
    test.fail('burst order was not fire order: ' + seen.slice(0, 8).join(','));
  }
}

test.subHeading('Class outranks age, because fairness is not priority');

{
  const c = clock();
  const q = pq.createQueue({ now: c.now });

  // The sweep goes first in time...
  const sweep = [];
  for (let n = 0; n < 5; n += 1) {
    sweep.push(q.add({ relayUrl: 'R1', toKey: 'p' + n, kind: pq.BACKGROUND }));
  }
  // ...and then a person actually does something.
  const typed = q.add({ relayUrl: 'R1', toKey: 'bella', kind: pq.DELIBERATE });

  const first = q.eligible();
  if (first && first.seq === typed) {
    test.check('a person’s message goes before five probes that were queued first');
  } else {
    test.fail('priority: eligible was ' + JSON.stringify(first && first.seq) +
      ', wanted the deliberate one (' + typed + ')');
  }

  q.started(first.seq); q.done(first.seq);

  // And within the background class, age still rules.
  const nextUp = q.eligible();
  if (nextUp && nextUp.seq === sweep[0]) {
    test.check('and within the background class, oldest still goes first');
  } else {
    test.fail('background order: ' + JSON.stringify(nextUp && nextUp.seq));
  }
}

test.subHeading('A refusal and a silence are different evidence');

{
  const c = clock();
  const q = pq.createQueue({ now: c.now, backoffStartMs: 1000 });

  // BUSY: the relay said the target is occupied and said for how long.
  // Contention is not evidence about the peer, so this honours the number
  // and does not grow.
  const b = q.add({ relayUrl: 'R1', toKey: 'popular', patienceMs: 999999 });
  q.started(b); q.busy(b, 400);
  const firstWait = q.backoffFor('R1', 'popular');

  c.tick(400);
  q.started(q.eligible().seq); q.busy(b, 400);
  const secondWait = q.backoffFor('R1', 'popular');

  if (firstWait === 400 && secondWait === 400) {
    test.check('busy honours the relay’s retryAfterMs and does not grow — contention is not a fault');
  } else {
    test.fail('busy waits: ' + firstWait + ' then ' + secondWait);
  }

  // SILENT: nobody answered. That IS evidence about the peer, so it
  // doubles — patience measured in days cannot retry every 15 seconds.
  const s = q.add({ relayUrl: 'R1', toKey: 'asleep', patienceMs: 999999 });
  c.tick(500);
  q.started(s); q.silent(s);
  const w1 = q.backoffFor('R1', 'asleep');
  c.tick(w1);
  q.started(s); q.silent(s);
  const w2 = q.backoffFor('R1', 'asleep');

  if (w1 === 1000 && w2 === 2000) {
    test.check('and a silent target doubles: ' + w1 + 'ms then ' + w2 + 'ms');
  } else {
    test.fail('silent waits: ' + w1 + ' then ' + w2);
  }

  // A peer that answers is forgiven entirely — the next silence starts
  // from the bottom rather than from where the last one left off.
  q.reached('R1', 'asleep');
  c.tick(5000);
  q.started(s); q.silent(s);
  if (q.backoffFor('R1', 'asleep') === 1000) {
    test.check('and answering once resets it, so a peer is not punished for an old outage');
  } else {
    test.fail('reached() did not reset the doubling');
  }
}

test.subHeading('Backoff is per pair, because a busy target is busy THERE');

{
  const c = clock();
  const q = pq.createQueue({ now: c.now });
  const one = q.add({ relayUrl: 'R1', toKey: 'bella', patienceMs: 99999 });
  q.add({ relayUrl: 'R2', toKey: 'bella', patienceMs: 99999 });
  q.started(one); q.busy(one, 5000);

  const other = q.eligible();
  if (other && other.relayUrl === 'R2') {
    test.check('bella refused on R1 is still reachable on R2 — the backoff is the pair’s');
  } else {
    test.fail('pair backoff leaked across relays: ' + JSON.stringify(other));
  }
}

test.subHeading('Patience bounds the whole intent, not one attempt');

{
  const c = clock();
  const q = pq.createQueue({ now: c.now });

  // NO PATIENCE IS THE DEFAULT, and it is exactly the behaviour every
  // caller had before a queue existed: one attempt, then the answer,
  // whatever it was. Retrying is opt-in.
  //
  // BUT PATIENCE BOUNDS RETRYING AND NEVER THE FIRST ATTEMPT, which was a
  // bug on the way here: with a busy relay a zero-patience entry is
  // queued and instantly past its budget, so expiring it there would fail
  // a post the old code would simply have sent.
  const once = q.add({ relayUrl: 'R1', toKey: 'bella' });
  if (q.expired().length === 0) {
    test.check('an entry that has never been tried does not expire, whatever its patience');
  } else {
    test.fail('expired before its first attempt: ' +
      JSON.stringify(q.expired().map(function (e) { return e.seq; })));
  }
  if (!q.mayRetry(once)) {
    test.check('and with no patience it may not be RETRIED — one attempt, as before');
  } else {
    test.fail('a zero-patience entry offered a retry');
  }

  q.started(once); q.stopped(once);
  if (q.expired().length === 1 && q.expired()[0].seq === once) {
    test.check('once it has had its attempt, it is spent');
  } else {
    test.fail('a tried, zero-patience entry did not expire');
  }
  q.done(once);

  const patient = q.add({ relayUrl: 'R2', toKey: 'carlos', patienceMs: 10000 });
  q.started(patient); q.stopped(patient);
  if (!q.expired().some(function (e) { return e.seq === patient; })) {
    test.check('and one with patience is not');
  } else {
    test.fail('a patient entry expired immediately');
  }

  if (q.mayRetry(patient)) {
    test.check('and one with patience may try again');
  } else {
    test.fail('a patient entry refused a retry');
  }

  // An attempt in flight is never called over: the intent cannot be
  // failed while its own answer may still arrive.
  q.started(patient);
  c.tick(20000);
  if (!q.expired().some(function (e) { return e.seq === patient; })) {
    test.check('and an entry on the wire is not expired out from under its own answer');
  } else {
    test.fail('expired an entry that was still in flight');
  }

  q.stopped(patient);
  if (q.expired().some(function (e) { return e.seq === patient; })) {
    test.check('but once the attempt is over and the patience is spent, it is done trying');
  } else {
    test.fail('a spent entry did not expire after its attempt ended');
  }
}

test.subHeading('Waiting on an event is not waiting on a clock');

// THE DEFECT THIS PINS was shipped and found an hour later. A zero-patience
// entry has `until` in the past, which the first nextWakeMs read as "wake
// immediately" — so anything queued behind a busy relay made the caller
// wake every millisecond, find nothing eligible, and sleep another
// millisecond, for as long as the in-flight attempt lasted. Posting twice
// to one relay burned a core for eight seconds. Nothing failed and nothing
// was slow, which is exactly why a test says so now.
{
  const c = clock();
  const q = pq.createQueue({ now: c.now });

  const held = q.add({ relayUrl: 'R1', toKey: 'bella' });
  q.add({ relayUrl: 'R1', toKey: 'carlos' });
  q.started(held);

  if (q.nextWakeMs() === null) {
    test.check('an entry blocked only by a busy slot asks for no timer — the slot freeing pumps');
  } else {
    test.fail('busy-slot wake: ' + q.nextWakeMs() + ' — that is a spin loop, not a wait');
  }

  // A backed-off target IS waiting on a clock, and says exactly how long.
  const off = q.add({ relayUrl: 'R2', toKey: 'dina', patienceMs: 50000 });
  q.started(off);
  q.silent(off);
  if (q.nextWakeMs() === pq.BACKOFF_START_MS) {
    test.check('and one waiting on a backoff asks for exactly that long');
  } else {
    test.fail('backoff wake: ' + q.nextWakeMs());
  }

  // Nothing queued at all is nothing to wake for.
  const empty = pq.createQueue({ now: c.now });
  if (empty.nextWakeMs() === null) {
    test.check('and an empty queue keeps no timer alive at all');
  } else {
    test.fail('empty queue wanted a wake: ' + empty.nextWakeMs());
  }
}

test.reportSuccessFailureCount();
