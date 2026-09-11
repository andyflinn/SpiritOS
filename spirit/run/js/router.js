'use strict';

// spirit/run/js/router.js
// The relay's pending-request table: hash -> who asked, who was asked.
//
// No bodies. A body is held only for the instant it takes to hand it to
// an open socket, and never by this. What survives a call is a routing
// entry of four small fields, in RAM, gone whether the request succeeds,
// fails or expires (design/relay/ROUTER.md).
//
// REGISTER BEFORE YOU FORWARD, and it is enforced by shape rather than by
// discipline. Andy's rule: "every point in the reply chain is responsible
// for not forwarding a request, the reply to which it wouldn't know how
// to match."
//
// So `open()` takes the delivery itself and performs it — a caller cannot
// forward first and file afterwards, because it never holds the two
// separately. The wrong order is not a thing that can be written here.
//
// What that forbids is the worst-shaped failure available: a request that
// can be ANSWERED but not DELIVERED. The target does the work, the reply
// comes back, nothing here matches it, and the requester waits. Nobody
// errors and nothing is logged — the only symptom is silence, for the
// length of somebody's patience.

var DEFAULT_MAX = 256;
var DEFAULT_PER_REQUESTER = 16;
// How long a caller will wait, which is a UX number rather than a
// protocol constant tuned against another machine's clock. Nothing is
// held open, so this is the only timeout in the design.
var DEFAULT_TTL_MS = 20000;

function createRouter(opts) {
  opts = opts || {};
  var nowFn = opts.now || Date.now;
  var max = opts.max || DEFAULT_MAX;
  var perRequester = opts.maxPerRequester || DEFAULT_PER_REQUESTER;
  var ttlMs = opts.ttlMs || DEFAULT_TTL_MS;

  // hash -> { requester, target, at }
  var pending = Object.create(null);

  function sweep() {
    var t = nowFn();
    Object.keys(pending).forEach(function (h) {
      if (t - pending[h].at >= ttlMs) delete pending[h];
    });
  }

  function countFor(requester) {
    return Object.keys(pending).filter(function (h) {
      return pending[h].requester === requester;
    }).length;
  }

  // deliver() is called ONLY after the entry is filed, and its return
  // value decides whether the entry stays. A delivery that failed must
  // not leave a hash occupied: the requester would be told "already in
  // flight" on every retry of a request that never arrived.
  function open(hash, requester, target, deliver) {
    if (!hash || !requester || !target) {
      return { ok: false, status: 400, error: 'hash, requester and target required' };
    }
    if (typeof deliver !== 'function') {
      // The whole point of this signature. Refusing here rather than
      // defaulting to "file it and let the caller send" is what keeps
      // the ordering unexpressible.
      return { ok: false, status: 500, error: 'open() requires the delivery' };
    }

    sweep();

    // ALREADY IN FLIGHT is not a rejection, and callers must be able to
    // tell. A receipt is signed over the hash and nothing else, so two
    // live requests sharing one would make a single receipt valid for
    // both — and routing it to the wrong requester would verify
    // perfectly. That is the one false positive this design could have
    // had (ROUTER.md §4).
    //
    // It is also what a retry looks like from here, and the right answer
    // to a retry is "wait", not "no".
    if (pending[hash]) {
      return { ok: false, status: 409, error: 'already in flight', inFlight: true };
    }

    // CAPACITY IS A REFUSAL, NEVER A DROP. A box under pressure that
    // declines is alive and truthful; one that accepts everything and
    // loses the overflow is lying, in the direction this whole design
    // exists to prevent.
    if (Object.keys(pending).length >= max) {
      return { ok: false, status: 503, error: 'router full' };
    }
    // And per requester, so one peer cannot spend the table on everyone
    // else's behalf — the same fairness B1 established for device slots.
    if (countFor(requester) >= perRequester) {
      return { ok: false, status: 429, error: 'too many in flight' };
    }

    pending[hash] = { requester: requester, target: target, at: nowFn() };

    var delivered = false;
    try { delivered = deliver() !== false; }
    catch (e) { delivered = false; }

    if (!delivered) {
      delete pending[hash];
      return { ok: false, status: 502, error: 'target could not be reached' };
    }
    return { ok: true, status: 202, hash: hash };
  }

  // Who may answer. The hash finds the request; being its target is the
  // permission. Anyone who saw the bytes can compute the hash, so the
  // two are never the same check.
  function answer(hash, poster) {
    sweep();
    var entry = pending[hash];
    if (!entry) return { ok: false, status: 404, error: 'no such request' };
    if (entry.target !== poster) {
      return { ok: false, status: 403, error: 'not the target of that request' };
    }
    delete pending[hash];
    return { ok: true, status: 200, requester: entry.requester, target: entry.target };
  }

  // For a caller that has to give up early — a target that went away
  // between the check and the push.
  function cancel(hash, requester) {
    var entry = pending[hash];
    if (!entry || entry.requester !== requester) return false;
    delete pending[hash];
    return true;
  }

  // AGE-CHECKED, because the alternative is two answers to one question.
  // `size()` and `open()` both sweep, so an entry past its ttl is already
  // gone to them — a `has` that still said yes would have this table
  // disagreeing with itself, and a caller believing whichever it asked.
  // Checked in place rather than by sweeping, so a lookup stays a lookup.
  function has(hash) {
    var entry = pending[hash];
    if (!entry) return false;
    if (nowFn() - entry.at >= ttlMs) {
      delete pending[hash];
      return false;
    }
    return true;
  }
  function size() { sweep(); return Object.keys(pending).length; }
  function reset() { pending = Object.create(null); }

  return {
    open: open,
    answer: answer,
    cancel: cancel,
    has: has,
    size: size,
    reset: reset,
    max: max,
    maxPerRequester: perRequester,
    ttlMs: ttlMs,
  };
}

module.exports = {
  createRouter: createRouter,
  DEFAULT_MAX: DEFAULT_MAX,
  DEFAULT_PER_REQUESTER: DEFAULT_PER_REQUESTER,
  DEFAULT_TTL_MS: DEFAULT_TTL_MS,
};
