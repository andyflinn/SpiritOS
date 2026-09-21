'use strict';

// spirit/run/js/postQueue.js
// WHICH REQUEST GOES NEXT, and nothing else. No sockets, no timers, no
// promises — a decision structure peerPost drives.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
//
//   Andy: "the node must not only queue, it also must have a hook for
//   not-available responses, requeing with node-local timeout, and
//   processing the queue while waiting for a retry... a fairly complex
//   mechanism, but doable."
//
// Decision 0016 caps a relay at one request in flight per member. A node
// that meets that cap with nothing to do about it loses the request; a
// node that queues turns a refusal into latency, which is `reach over
// speed` — the judgement the whole budget design turns on.
//
// ── THE RULES, EACH ONE ANDY'S AND EACH ONE LOAD-BEARING ─────────────
//
// ORDERED BY ORIGINAL REQUEST TIME, ASCENDING.
//
//   Andy: "the requed request should be sorted by request-time,
//   ascending"
//
// A requeued request keeps the sequence it was FIRST given, so it sorts
// ahead of everything that arrived while it was being refused. That is
// the anti-starvation rule: with a fresh number on requeue, a node
// generating new work would starve its own retries for ever, and the
// busier the node the worse it would get.
//
// A SEQUENCE, NOT A CLOCK. `contactsAskEveryone` fires a member's whole
// contact list in one synchronous loop, so every entry takes the same
// millisecond and Date.now() supplies no order at all — the queue would
// sort differently on every run. A monotonic counter is the request time
// in the only sense this needs: it never collides and never goes
// backwards, where wall-clock does both (NTP steps, DST, suspend).
//
// OLDEST ELIGIBLE FIRST, WHICH IS NOT THE SAME AS OLDEST FIRST.
// 0016 names head-of-line blocking as a hazard: a plain FIFO stalls
// behind one busy target while other targets sit idle. So the sort is by
// age and the SELECTION is filtered — walk in order, take the first entry
// whose target is not backed off and whose relay has a free slot. Age
// orders; eligibility selects; a FIFO that stalls on its head is the
// thing that fails.
//
// TWO CLASSES, DELIBERATE BEFORE BACKGROUND.
// Age ordering is fair, and fairness is not priority. Fifty card probes
// enqueue at T0; a person types a message and sends it at T1; by age
// alone their deliberate act sorts behind all fifty, and at a ceiling of
// one that is seconds of waiting caused by a screen decorating itself.
// So class outranks age, and age orders within a class. Same population
// argument that split the relay's requester budgets: a person acting and
// a screen decorating are not one queue.
//
// A TIMEOUT AND A REFUSAL BACK OFF DIFFERENTLY, and getting this
// backwards is the subtle one. A timeout is evidence about the TARGET —
// they did not answer, so wait longer each time. A refusal (`busy`) is
// evidence about CONTENTION — the target is fine and somebody else is
// asking — so honour the relay's own `retryAfterMs` and do not grow. A
// node that treated contention as target trouble would back off a popular
// peer as though they were broken, which is exactly backwards.

// How many requests one relay may be holding for this node at a time.
// ONE, matching the relay's own per-member cap (0016). A node on three
// relays therefore has three in flight, one each — its concurrency is
// relays x cap, by construction, and not a number anybody chose.
var IN_FLIGHT_PER_RELAY = 1;

// A target that timed out is not asked again immediately. Doubling, since
// patience measured in days cannot retry every fifteen seconds — that is
// 17,280 attempts at one peer. Capped so a long-running node does not
// arrive at an interval longer than anybody's patience.
var BACKOFF_START_MS = 2000;
var BACKOFF_MAX_MS = 300000;

// ── HOW MUCH WORK MAY BE WAITING ─────────────────────────────────────
//
//   Andy: "the node wants to avoid accumulating a backlog in the
//   post-scheduler, at this point it has at least the option of refusing
//   requests outright until the block is resolved."
//
// REFUSING AT THE DOOR IS THE ONLY SHED THAT KEEPS THE ORDER. Dropping
// from the middle would evict work that had already earned its place,
// which is the anti-starvation rule turned upside down. Refusing what has
// not been accepted yet leaves the queue exactly as it was, and tells the
// caller now rather than promising something that will quietly rot.
//
// It is also the rule the relay already follows, on the other box —
// router.js: "CAPACITY IS A REFUSAL, NEVER A DROP. A box under pressure
// that declines is alive and truthful; one that accepts everything and
// loses the overflow is lying."
//
// BOUNDED IN BYTES, NOT IN ENTRIES, because an entry is not what costs. A
// queued request holds its payload until it is sent, up to
// limits.PAYLOAD_MAX each, so a count of entries bounds a number nobody
// cares about while the bytes behind it vary by three orders of
// magnitude. 4 MB is 256 full-sized packets or a great many small ones,
// and the queue does not have to care which.
//
// DECLARED, NOT MEASURED — like HINTS_PER_POST, and marked so nobody
// reads it as evidence. What must be true of it is that a legitimate
// burst fits (a contact list is tens of small posts, not thousands of
// full ones) and that a stuck node cannot grow without limit.
var QUEUE_BYTES_MAX = 4 * 1024 * 1024;

// BACKGROUND YIELDS FIRST, and at a quarter rather than at the brim. A
// screen decorating itself must not be able to fill the queue a person's
// own actions need — the same population argument that orders the two
// classes, applied to space instead of to turn. One argued number, two
// thresholds derived from it.
var BACKGROUND_SHARE = 0.25;

var DELIBERATE = 'deliberate';
var BACKGROUND = 'background';
var CLASS_RANK = { deliberate: 0, background: 1 };

// A MONOTONIC CLOCK, NOT THE WALL CLOCK, and for the same reason the
// order is a sequence rather than a timestamp.
//
// Everything this file measures is a DURATION — how long until a backoff
// lapses, how much patience is left, how long to sleep. A duration
// measured against `Date.now()` is measured against a number that moves:
// an NTP correction, a suspend and resume, a manual clock change. Any of
// those fires a backoff early, or strands one for the length of the jump,
// and expires patience on evidence that never happened.
//
// `performance.now()` only ever goes forward and only ever at one rate,
// which is all a duration needs. It counts from process start, so it is
// useless for anything that must survive a restart — and nothing here
// does. A persisted queue (a patience of days, Andy's case) would have to
// convert on the way out and recompute on the way in; that is a note for
// whoever builds it, not a reason to measure elapsed time with a clock
// that jumps.
//
// It is the same rule as `0011`'s hash and as the sequence above: nothing
// in this design depends on two boxes agreeing about the time, and
// nothing depends on one box's clock standing still.
function monotonicNow() {
  return typeof performance !== 'undefined' && performance && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function createQueue(opts) {
  opts = opts || {};
  var nowFn = opts.now || monotonicNow;
  var perRelay = opts.inFlightPerRelay || IN_FLIGHT_PER_RELAY;
  var backoffStart = opts.backoffStartMs || BACKOFF_START_MS;
  var bytesMax = opts.maxBytes || QUEUE_BYTES_MAX;
  var backoffMax = opts.backoffMaxMs || BACKOFF_MAX_MS;

  // seq -> entry. Insertion order is sequence order, so a plain object
  // would do; an array is kept because the walk is ordered and small.
  var items = [];
  var nextSeq = 1;
  var bytesHeld = 0;

  // relayUrl -> how many this node has in flight there.
  var inFlight = Object.create(null);

  // relayUrl + '\u0000' + toKey -> the ms after which this target may be
  // asked again. Keyed by the PAIR, because a target being busy on one
  // relay says nothing about reaching them on another.
  var backedOffUntil = Object.create(null);
  // and how long the last wait was, so a repeated timeout can double it.
  var lastWait = Object.create(null);

  function pairKey(relayUrl, toKey) {
    return String(relayUrl) + '\u0000' + String(toKey);
  }

  // `patienceMs` is the WHOLE INTENT's budget, across every attempt —
  // Andy: "max time spent in request-scheduler before returning failure
  // (could be days for a text message)". Distinct from the per-attempt
  // wait, which is bounded by what the relay will hold.
  // WOULD THIS BE TAKEN? Asked before anything is signed or logged, so a
  // refusal costs the caller nothing but the answer.
  function accepts(kind, bytes) {
    var room = (CLASS_RANK[kind] === CLASS_RANK[BACKGROUND])
      ? bytesMax * BACKGROUND_SHARE
      : bytesMax;
    return (bytesHeld + (bytes || 0)) <= room;
  }

  function add(item) {
    var seq = nextSeq;
    nextSeq += 1;
    var at = nowFn();
    items.push({
      seq: seq,
      relayUrl: String(item.relayUrl || ''),
      toKey: String(item.toKey || ''),
      kind: CLASS_RANK[item.kind] === undefined ? DELIBERATE : item.kind,
      at: at,
      // 0 means "one attempt and no retrying", which is what every
      // existing caller gets: identical to the behaviour before a queue
      // existed.
      until: item.patienceMs > 0 ? at + item.patienceMs : at,
      attempts: 0,
      sending: false,
      bytes: item.bytes || 0,
      payload: item.payload,
    });
    bytesHeld += item.bytes || 0;
    return seq;
  }

  // ── TAKING AN ENTRY BACK AFTER A RESTART (cycle R16) ─────────────
  //
  //   Andy: patience "could be days for a text message" — and days means
  //   restarts.
  //
  // THIS FILE STILL DOES NO I/O. It hands back what it would need and
  // takes it back again; where that lives is peerPost's business and the
  // store's. `at` and `until` arrive already in THIS queue's clock — the
  // caller converts from wall time, because only the caller knows how long
  // the process was down.
  //
  // A NEW SEQUENCE, IN THE ORDER GIVEN. The old numbers mean nothing to a
  // new process; the ORDER is what the anti-starvation rule depends on,
  // and the caller supplies entries oldest first.
  //
  // NOT SENDING, whatever it was. An attempt that was on the wire when the
  // process died is not on the wire now. Its `attempts` count stands, so
  // an entry that already had its one try is judged on that.
  function restoreItem(item) {
    var seq = nextSeq;
    nextSeq += 1;
    items.push({
      seq: seq,
      relayUrl: String(item.relayUrl || ''),
      toKey: String(item.toKey || ''),
      kind: CLASS_RANK[item.kind] === undefined ? DELIBERATE : item.kind,
      at: Number(item.at),
      until: Number(item.until),
      attempts: Number(item.attempts) || 0,
      sending: false,
      bytes: item.bytes || 0,
      payload: item.payload,
    });
    bytesHeld += item.bytes || 0;
    return seq;
  }

  // A backoff a peer had earned survives the restart too — otherwise a
  // node that crashed would hammer every target it had been told to leave
  // alone, which is the opposite of what the backoff was for.
  function restorePair(relayUrl, toKey, until, wait) {
    var k = pairKey(relayUrl, toKey);
    if (until) backedOffUntil[k] = Number(until);
    if (wait) lastWait[k] = Number(wait);
  }

  function pairState(relayUrl, toKey) {
    var k = pairKey(relayUrl, toKey);
    return { until: backedOffUntil[k] || 0, lastWait: lastWait[k] || 0 };
  }

  function find(seq) {
    for (var i = 0; i < items.length; i += 1) if (items[i].seq === seq) return items[i];
    return null;
  }

  function drop(seq) {
    for (var i = 0; i < items.length; i += 1) {
      if (items[i].seq === seq) {
        bytesHeld -= items[i].bytes || 0;
        if (bytesHeld < 0) bytesHeld = 0;
        items.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  // CLASS FIRST, THEN AGE. Both halves matter and they answer different
  // questions: class says whose turn it is, age says which of theirs.
  function order(a, b) {
    var ra = CLASS_RANK[a.kind] === undefined ? 0 : CLASS_RANK[a.kind];
    var rb = CLASS_RANK[b.kind] === undefined ? 0 : CLASS_RANK[b.kind];
    if (ra !== rb) return ra - rb;
    return a.seq - b.seq;
  }

  // The next entry that may actually go, or null. Walks in order and
  // SKIPS what cannot move, which is the head-of-line fix: a backed-off
  // target does not hold up a reachable one behind it.
  function eligible() {
    var now = nowFn();
    var ready = items.slice().sort(order);
    for (var i = 0; i < ready.length; i += 1) {
      var it = ready[i];
      if (it.sending) continue;
      if ((inFlight[it.relayUrl] || 0) >= perRelay) continue;
      var until = backedOffUntil[pairKey(it.relayUrl, it.toKey)] || 0;
      if (until > now) continue;
      return it;
    }
    return null;
  }

  function started(seq) {
    var it = find(seq);
    if (!it || it.sending) return false;
    it.sending = true;
    it.attempts += 1;
    inFlight[it.relayUrl] = (inFlight[it.relayUrl] || 0) + 1;
    return true;
  }

  // The attempt is over, whatever it was. Releases the relay slot; the
  // entry itself lives or dies by what the caller does next.
  function stopped(seq) {
    var it = find(seq);
    if (!it || !it.sending) return false;
    it.sending = false;
    var n = (inFlight[it.relayUrl] || 1) - 1;
    if (n > 0) inFlight[it.relayUrl] = n; else delete inFlight[it.relayUrl];
    return true;
  }

  function done(seq) {
    stopped(seq);
    return drop(seq);
  }

  // A TARGET WAS BUSY. The relay said so and said for how long, so this
  // does NOT grow: contention is not evidence about the peer, and the
  // relay's own `retryAfterMs` is exact — the route expires at a known
  // time whatever happens.
  function busy(seq, retryAfterMs) {
    var it = find(seq);
    if (!it) return false;
    stopped(seq);
    var wait = retryAfterMs > 0 ? retryAfterMs : backoffStart;
    backedOffUntil[pairKey(it.relayUrl, it.toKey)] = nowFn() + wait;
    // Deliberately NOT recorded in lastWait: a busy refusal must not
    // lengthen the wait a later timeout starts from.
    return true;
  }

  // A TARGET DID NOT ANSWER. Evidence about the peer, so this doubles.
  function silent(seq) {
    var it = find(seq);
    if (!it) return false;
    stopped(seq);
    var k = pairKey(it.relayUrl, it.toKey);
    var prev = lastWait[k] || 0;
    var wait = prev ? Math.min(prev * 2, backoffMax) : backoffStart;
    lastWait[k] = wait;
    backedOffUntil[k] = nowFn() + wait;
    return true;
  }

  // A target that answered is not backed off any more, and its next
  // timeout starts from the bottom again.
  function reached(relayUrl, toKey) {
    var k = pairKey(relayUrl, toKey);
    delete backedOffUntil[k];
    delete lastWait[k];
  }

  // Entries whose whole patience is spent. Returned rather than resolved,
  // because what to tell the caller is peerPost's business and not this
  // file's.
  //
  // TWO THINGS ARE NEVER EXPIRED, and both were bugs on the way here.
  //
  // An entry ON THE WIRE: its attempt has to finish before the intent can
  // be called over, or the answer arrives for something already failed.
  //
  // An entry that has NEVER BEEN TRIED. The default patience is zero —
  // one attempt, which is exactly what every caller had before a queue
  // existed — and with a busy relay such an entry is queued and instantly
  // past its budget. Expiring it there would fail a post that the old
  // code would simply have sent, so patience bounds RETRYING and never
  // the first attempt.
  function expired() {
    var now = nowFn();
    return items.filter(function (it) {
      return !it.sending && it.attempts > 0 && it.until <= now;
    });
  }

  // Is there budget left for ANOTHER attempt? The first attempt never
  // asks — see expired() — so this is only ever about retrying.
  function mayRetry(seq) {
    var it = find(seq);
    return !!it && it.until > nowFn();
  }

  // When the earliest useful moment is, so a caller sleeps exactly that
  // long instead of polling. **null when nothing is waiting on time at
  // all**, and that null is the whole point of this function.
  //
  // ONLY TWO THINGS ARE WAITING ON A CLOCK: a target that is backed off
  // until some moment, and an entry whose patience runs out at some
  // moment. Everything else in this queue is waiting on an EVENT — a slot
  // freeing — and every path that frees a slot pumps (settle, and the end
  // of an attempt), so a timer for those is not merely unnecessary, it is
  // a busy loop.
  //
  // IT WAS ONE. The first version returned 0 whenever anything was queued
  // behind a busy relay, because a zero-patience entry has `until` in the
  // past and that was read as "wake immediately". The caller then woke
  // every millisecond, found nothing eligible, and slept for another
  // millisecond, for as long as the in-flight attempt lasted — up to
  // eight thousand wake-ups for the simple case of posting twice to one
  // relay. Nothing failed and nothing was slow; a node just burned a core
  // for eight seconds at a time.
  function nextWakeMs() {
    var now = nowFn();
    var soonest = null;
    function consider(when) {
      if (when <= now) return;
      if (soonest === null || when < soonest) soonest = when;
    }
    items.forEach(function (it) {
      if (it.sending) return;
      consider(backedOffUntil[pairKey(it.relayUrl, it.toKey)] || 0);
      // Patience only ever expires an entry that has been tried, and one
      // already past its budget is swept synchronously rather than slept
      // on — see expired().
      if (it.attempts > 0) consider(it.until);
    });
    if (soonest === null) return null;
    return Math.max(1, soonest - now);
  }

  function size() { return items.length; }
  function bytes() { return bytesHeld; }
  function inFlightFor(relayUrl) { return inFlight[relayUrl] || 0; }
  function backoffFor(relayUrl, toKey) {
    return Math.max(0, (backedOffUntil[pairKey(relayUrl, toKey)] || 0) - nowFn());
  }

  return {
    add: add,
    restoreItem: restoreItem,
    restorePair: restorePair,
    pairState: pairState,
    // The queue's own clock, so a caller converting to and from wall time
    // uses the same one the queue measures with.
    now: function () { return nowFn(); },
    eligible: eligible,
    started: started,
    stopped: stopped,
    done: done,
    busy: busy,
    silent: silent,
    reached: reached,
    expired: expired,
    mayRetry: mayRetry,
    nextWakeMs: nextWakeMs,
    accepts: accepts,
    size: size,
    bytes: bytes,
    inFlightFor: inFlightFor,
    backoffFor: backoffFor,
    find: find,
    perRelay: perRelay,
  };
}

module.exports = {
  createQueue: createQueue,
  IN_FLIGHT_PER_RELAY: IN_FLIGHT_PER_RELAY,
  BACKOFF_START_MS: BACKOFF_START_MS,
  BACKOFF_MAX_MS: BACKOFF_MAX_MS,
  DELIBERATE: DELIBERATE,
  BACKGROUND: BACKGROUND,
  QUEUE_BYTES_MAX: QUEUE_BYTES_MAX,
  BACKGROUND_SHARE: BACKGROUND_SHARE,
};
