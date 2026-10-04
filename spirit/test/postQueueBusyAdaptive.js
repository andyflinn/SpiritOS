'use strict';

// goal/G4.30: a sender told "busy" retries soon, not after the other request's whole route lifetime. Red on today's
// tree; wsl-claude wrote it, claude-windows builds it.
//   Found under goal/G4.30 (wsl-claude, 2026-10-04): a desk ask that met Andy's node busy with another agent's
//   request waited ~5 s, because the relay's retryAfterMs is the time until that other route would EXPIRE
//   (router.js 225-235, msUntilFreeFor: up to the 5 s ceiling), while it is answered in 0.2-0.5 s; postQueue.busy()
//   sleeps the whole of it (postQueue.js 332-340). Trace: 1c8bb7 queued 20:10:41.934 behind a request answered at
//   42.045, delivered to Andy's node at 47.297.
//   Andy, 2026-10-04: to "what wait-time do you suggest? adaptive?" — first retry after 250 ms, then 500, 1000, 2000,
//   never longer than the relay's own quote — "agreed."; "put up the red grant request." (G1, core grant:
//   js/postQueue.js, granted); his Go on goal/G4.30 stands. The relay is unchanged: it still does not queue.
//
// THE SHAPES (Andy's agreed numbers; the rest wsl-claude's picks, the builder may argue them in Desk first):
//   1  Busy waits grow per pair (relay, target): 250, 500, 1000, 2000 ms, then stay at 2000.
//   2  Never longer than the relay's retryAfterMs when it quotes one smaller than the step.
//   3  A pair that was reached (reached()) starts again at 250.
//
// FOUND IN THE DRY RUN: postQueue.js's own suite asserts the old rule ("busy honours the relay's retryAfterMs and
//   does not grow", 400 then 400); under this item it reads 250 then 400. That assertion is the builder's to move.
// LEFT OPEN, not asserted: busy with no quote (retryAfterMs 0), today backoffStart (2000 ms).

const test = require('./testSupport.js');
const pq = require('../run/js/postQueue.js');

const OWED = 'OWED by goal/G4.30: ';

function clock() {
  let t = 1000000;
  return { now: function () { return t; }, tick: function (ms) { t += ms; } };
}

test.startTest('goal/G4.30: a busy target is retried soon, adaptively, never past the relay\'s quote');

test.subHeading('1. the wait grows 250, 500, 1000, 2000 and stays');
{
  const c = clock();
  const q = pq.createQueue({ now: c.now });
  const b = q.add({ relayUrl: 'relay-a', toKey: 'andy', patienceMs: 999999 });
  const waits = [];
  for (let i = 0; i < 6; i += 1) {
    const it = q.eligible();
    if (!it) { waits.push('none eligible'); break; }
    q.started(it.seq);
    q.busy(b, 5000);
    const w = q.backoffFor('relay-a', 'andy');
    waits.push(w);
    c.tick(w);
  }
  if (JSON.stringify(waits) === JSON.stringify([250, 500, 1000, 2000, 2000, 2000])) test.check('busy waits grow 250, 500, 1000, 2000, then stay at 2000');
  else test.fail(OWED + 'busy waits with the relay quoting 5000 ms were ' + JSON.stringify(waits));
}

test.subHeading('2. never longer than the relay\'s own quote');
{
  const c = clock();
  const q = pq.createQueue({ now: c.now });
  const b = q.add({ relayUrl: 'relay-a', toKey: 'andy', patienceMs: 999999 });
  q.started(b); q.busy(b, 100);
  const first = q.backoffFor('relay-a', 'andy');
  c.tick(first);
  q.started(q.eligible().seq); q.busy(b, 5000);
  c.tick(q.backoffFor('relay-a', 'andy'));
  q.started(q.eligible().seq); q.busy(b, 5000);
  c.tick(q.backoffFor('relay-a', 'andy'));
  q.started(q.eligible().seq); q.busy(b, 1200);
  const capped = q.backoffFor('relay-a', 'andy');
  if (first === 100) test.check('a quote of 100 ms is honoured over the first step of 250');
  else test.fail(OWED + 'with a quote of 100 ms the first wait was ' + first);
  if (capped === 1200) test.check('where the step would be 2000 ms and the relay quotes 1200, the wait is 1200');
  else test.fail(OWED + 'with the step at 2000 and a quote of 1200 the wait was ' + capped);
}

test.subHeading('3. a reached pair starts again at 250');
{
  const c = clock();
  const q = pq.createQueue({ now: c.now });
  const b = q.add({ relayUrl: 'relay-a', toKey: 'andy', patienceMs: 999999 });
  q.started(b); q.busy(b, 5000);
  c.tick(q.backoffFor('relay-a', 'andy'));
  q.started(q.eligible().seq); q.busy(b, 5000);
  c.tick(q.backoffFor('relay-a', 'andy'));
  q.reached('relay-a', 'andy');
  q.started(q.eligible().seq); q.busy(b, 5000);
  const again = q.backoffFor('relay-a', 'andy');
  if (again === 250) test.check('after reached(), the next busy wait is 250 again');
  else test.fail(OWED + 'after reached() the next busy wait was ' + again);
}

test.reportSuccessFailureCount();
