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

// ── HOW MANY REQUESTS MAY BE AIMED AT ONE MEMBER ─────────────────────
//
//   Andy: "cap the requests for a specific target at one, respond with
//   (not available), if this causes the calling node to keep the request
//   queued, nothing is lost."
//
// The cap that needs no cooperation from anybody (0016). A per-requester
// cap is spent by whoever is asking, so a Sybil farm defeats it by being
// many requesters — but it cannot be many TARGETS, because the target is
// the person being bothered and there is only one of them.
//
// DEFAULTS TO `max`, WHICH IS NO TIGHTER THAN THE TABLE ITSELF, and that
// is deliberate rather than timid. 0016 sequences the ceiling of 1 LAST,
// after a node can queue: a node that cannot queue meets a refusal with
// nothing to do about it, so turning the number down before the
// scheduler exists would break the product to prove a point it has
// already conceded. The mechanism lands now; the number is one
// deliberate commit later, and the suites set it to 1 to prove the
// refusal works today.
var DEFAULT_PER_TARGET = DEFAULT_MAX;

// ── WHO THE CEILING COUNTS AGAINST ───────────────────────────────────
//
//   Andy: "we always know that relay side request for relays must be
//   subject to a separate budget."
//
// Decision 0016: member traffic, this relay posting as itself, and
// traffic forwarded in by a partner are THREE budgets, not one. They are
// three populations and they answer to three arguments — a member is one
// person, this relay acts for all of its members at once, and a partner
// is another box whose behaviour we do not control.
//
// WHY THIS HAD TO COME FIRST. The count is kept per requester KEY, and
// the relay uses its own key for every post it makes on somebody's
// behalf — a device offer and a partner forward both open under
// `mineKey()`. So at a ceiling of 1 the relay's second concurrent
// self-post is refused by its own cap, and `devicePeers` (two
// deviceOffer calls to two members) proves it rather than predicting it.
// Lumping the classes makes the ceiling unswitchable; separating them is
// what lets it be TRIED.
//
// The classes, and nothing else may be passed:
var MEMBER = 'member';    // a member of this relay, posting for itself
var RELAY = 'relay';      // this relay, acting for a member (device offers)
var PARTNER = 'partner';  // forwarded in from a partner relay
var KINDS = [MEMBER, RELAY, PARTNER];

// A NUMBER STILL MEANS WHAT IT MEANT. `maxPerRequester: 2` sets every
// class to 2, which is exactly the old behaviour, so nothing that passed
// a number has changed underneath it. An object sets them apart.
function capsFrom(given) {
  var caps = {};
  var flat = typeof given === 'number' ? given : null;
  KINDS.forEach(function (k) {
    var v = flat !== null ? flat
      : (given && typeof given[k] === 'number' ? given[k] : DEFAULT_PER_REQUESTER);
    caps[k] = v;
  });
  return caps;
}
// How long a caller will wait, which is a UX number rather than a
// protocol constant tuned against another machine's clock.
//
// ── TWO CLAIMS HERE ARE WRONG, MARKED 2026-09-21 ─────────────────────
//
// THIS SAID "the only timeout in the design". There are four, and they
// are not in step: a node waits 8 s (`peerPost.js` DEFAULT_WAIT_MS), this
// table holds 20 s, a relay's own post waits 15 s (`relay.js`
// ROUTE_WAIT_MS), and a relay's hop to a partner waits 8 s again. The
// inner hop outliving the outer waiter is what orphans a member's only
// slot for twelve seconds once the ceiling is 1.
//
// AND THE NUMBER ITSELF IS SUPERSEDED. Andy, 2026-09-21: "the relay has
// no business waiting for 15 seconds, if it doesn't have a reply or an
// error in 5 seconds it's wasted time" — and "the willing to wait time in
// a request is informational". So the ttl becomes PER ENTRY, granted as
// min(what the requester asked, this box's 5 s ceiling), and this
// constant becomes that ceiling rather than the answer.
//
// ── SETTLED 2026-09-21: A CEILING, NOT AN ANSWER ────────────────────
//
//   Andy: "the relay has no business waiting for 15 seconds, if it
//   doesn't have a reply or an error in 5 seconds it's wasted time."
//   "the willing to wait time in a request is informational, and the next
//   station down the chain better hurry."
//
// So this is no longer how long a route lives. It is the LONGEST a route
// may live on this box, and each entry lives for
//
//     min( what its requester asked for , this ceiling )
//
// which is what makes the chain diminish inward: a hop can only ever ask
// for less than the hop before it had, so every waiter outlives the thing
// it waits on. The inversion that orphaned a member's only slot is not
// fixed by choosing matching numbers — it becomes unexpressible.
//
// FIVE SECONDS, and it replaced 20000, which nobody had argued. A relay
// holding a note for four times longer than anybody is waiting is holding
// state for somebody who has gone.
var DEFAULT_TTL_MS = 5000;

// ENOUGH TIME TO BE WORTH A NETWORK HOP, and that is all this now means.
//
//   Andy: "the actual target may as well just answer the request. since a
//   packet has to travel all the way back, it may as well carry good
//   information. it is the request-originator who has to mark the
//   incoming reply as too-late."
//
// CORRECTED 2026-09-21. This first refused any request whose granted time
// was below it, wherever the target was — and that is wrong for a target
// on this relay's own roll. The reply travels back either way, so a
// refusal costs exactly what an answer costs and carries less; a member
// asked over a socket already open may well answer in single-digit
// milliseconds, and refusing on their behalf is pessimism, not
// protection.
//
// Refusing only pays when it SAVES something, and the only thing it can
// save is a trip that has not been made yet. So the floor lives at the
// decision to FORWARD (relay.js, carryToPartner), and a delivery this box
// can make itself is simply made.
//
// What survives here is the degenerate case: no time at all is not a
// short deadline, it is an expired one.
var MIN_USEFUL_MS = 250;

function createRouter(opts) {
  opts = opts || {};
  var nowFn = opts.now || Date.now;
  var max = opts.max || DEFAULT_MAX;
  var caps = capsFrom(opts.maxPerRequester);
  // The member cap under its old name, for callers that read it back.
  var perRequester = caps[MEMBER];
  var perTarget = opts.maxPerTarget || DEFAULT_PER_TARGET;
  var ttlMs = opts.ttlMs || DEFAULT_TTL_MS;

  // hash -> { requester, target, at, carry, kind }
  var pending = Object.create(null);

  // EACH ENTRY BY ITS OWN CLOCK. The table no longer has one lifetime;
  // it has a ceiling, and every entry carries what it was granted.
  function ageOut(entry) { return entry.ttlMs || ttlMs; }

  function sweep() {
    var t = nowFn();
    Object.keys(pending).forEach(function (h) {
      if (t - pending[h].at >= ageOut(pending[h])) delete pending[h];
    });
  }

  // WITH NO `kind`, THIS COUNTS EVERY CLASS, and that is deliberate
  // rather than a default falling out. Its other caller asks "is this
  // identity busy?" to spare a live stream from eviction
  // (relay.js:3413) — a question about the peer, not about a budget. An
  // identity busy on relay-class work is just as busy.
  function countFor(requester, kind) {
    // Expired posts leave first: a reply that never came back must stop
    // counting as in flight (NODE-AND-RELAY §9b, "expiry must decrement
    // too"). Idempotent, and bounded by the table's own cap.
    sweep();
    return Object.keys(pending).filter(function (h) {
      if (pending[h].requester !== requester) return false;
      return !kind || pending[h].kind === kind;
    }).length;
  }

  // How many requests are aimed at this member right now, whoever asked.
  function countForTarget(target) {
    sweep();
    return Object.keys(pending).filter(function (h) {
      return pending[h].target === target;
    }).length;
  }

  // WHEN THE TARGET'S OLDEST SLOT FREES, IN MILLISECONDS. A refusal that
  // says only "busy" makes a scheduler guess, and every guess is either a
  // wasted retry or a needless wait. This is not a guess: the entry
  // expires at `at + ttlMs` whatever happens, so the worst case is exact
  // and an early reply only makes it sooner.
  function msUntilFreeFor(target) {
    sweep();
    var oldest = null;
    Object.keys(pending).forEach(function (h) {
      if (pending[h].target !== target) return;
      if (oldest === null || pending[h].at < oldest.at) oldest = pending[h];
    });
    if (oldest === null) return 0;
    var left = ageOut(oldest) - (nowFn() - oldest.at);
    return left > 0 ? left : 0;
  }

  // deliver() is called ONLY after the entry is filed, and its return
  // value decides whether the entry stays. A delivery that failed must
  // not leave a hash occupied: the requester would be told "already in
  // flight" on every retry of a request that never arrived.
  //
  // `carry` is what the caller must hold until the answer comes — for a
  // forward, the partner's answer and the route back. It lives IN the
  // entry, so it expires with it: one table, one cap, one ttl, and nothing
  // beside it that the sweep cannot see. (Cycle 3: a side map in relay.js
  // outlived its entry for good when a member never answered.) The ttl is
  // a Governor lever to come (NODE-AND-RELAY §10); this is what makes it
  // bound everything a request holds.
  function open(hash, requester, target, deliver, carry, kind) {
    if (!hash || !requester || !target) {
      return { ok: false, status: 400, error: 'hash, requester and target required' };
    }
    // `kind` IS A CLASS NAME OR { kind, ttlMs }, and both are accepted so
    // that adding a per-entry lifetime did not become a signature change
    // at every call site. A bare string is the class with this box's
    // default lifetime.
    var wantTtl = null;
    if (kind && typeof kind === 'object') {
      // NULL IS ABSENT AND 0 IS A DECLARATION. A caller that names no
      // budget is asking for this box's default; one that names zero has
      // run out, and must be refused rather than quietly restarted at the
      // ceiling. Conflating them would let an exhausted chain renew
      // itself at every hop, which is the opposite of diminishing.
      wantTtl = (typeof kind.ttlMs === 'number' && isFinite(kind.ttlMs)) ? kind.ttlMs : null;
      kind = kind.kind;
    }

    // AN UNKNOWN CLASS IS A PROGRAMMING ERROR, NOT A DEFAULT. Silently
    // treating a typo as `member` would put relay traffic on a member's
    // budget, which is the exact confusion this split exists to end —
    // and it would do it quietly, with every suite green.
    var cls = kind === undefined ? MEMBER : kind;
    if (KINDS.indexOf(cls) === -1) {
      return { ok: false, status: 500, error: 'unknown requester class: ' + String(kind) };
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
    //
    // COUNTED WITHIN THE CLASS (0016). This relay's own posts do not
    // spend a member's budget and a member's do not spend this relay's,
    // because the two are not the same population: a member is one
    // person, and this relay acts for all of them at once.
    if (countFor(requester, cls) >= caps[cls]) {
      return { ok: false, status: 429, error: 'too many in flight', kind: cls };
    }

    // ── AND PER TARGET, WHICH IS A DIFFERENT KIND OF NO ──────────────
    //
    // The three refusals above are all about the ASKER or about this box:
    // you are asking too often, or there is no room here. This one is
    // about neither. The target is present, willing and reachable — it
    // is simply busy with somebody else's question, and it will not be
    // in a moment.
    //
    // So it must be TOLD APART on the wire, and `busy: true` is what a
    // scheduler keys on rather than an error string somebody will
    // reword. It matters because the node's response is opposite: a
    // timeout is evidence about the target and should back it off; this
    // is evidence about CONTENTION and must not, or a popular member
    // ends up looking broken to everybody who wanted them.
    //
    // `retryAfterMs` says when, so the queue neither spins nor sleeps
    // too long. Ordered after the requester's own cap on purpose: when
    // both are over, the caller's own fault is the more useful thing to
    // hear first.
    if (countForTarget(target) >= perTarget) {
      return {
        ok: false, status: 503, error: 'target is busy',
        busy: true, retryAfterMs: msUntilFreeFor(target),
      };
    }

    // GRANTED, NOT TAKEN. A requester may ask for less than this box's
    // ceiling and get it; asking for more gets the ceiling. That is the
    // whole of "informational": the number travels, and no hop is bound
    // by what an outer hop wished for.
    var live = wantTtl === null ? ttlMs : Math.min(wantTtl, ttlMs);
    // NOTHING LEFT IS NOT A SHORT DEADLINE, IT IS AN EXPIRED ONE. A
    // positive budget, however small, is delivered: the target may answer
    // inside it, and if it does not, the note costs exactly that long.
    // Only the originator knows when a reply became too late, because only
    // the originator knows what it is still waiting for.
    if (live <= 0) {
      return {
        ok: false, status: 503, error: 'no time left',
        tooLittleTime: true, wouldHave: live,
      };
    }

    pending[hash] = {
      requester: requester, target: target, at: nowFn(),
      carry: carry || null, kind: cls, ttlMs: live,
    };

    var delivered = false;
    try { delivered = deliver() !== false; }
    catch (e) { delivered = false; }

    if (!delivered) {
      delete pending[hash];
      return { ok: false, status: 502, error: 'target could not be reached' };
    }
    // WHAT WAS ACTUALLY GRANTED, told to the asker. Without it the asker
    // knows only what it ASKED for, and goes on holding its own slot long
    // after this box let go — which is the asker blocking itself, and
    // indistinguishable from the relay blocking it.
    return { ok: true, status: 202, hash: hash, grantedMs: live };
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
    return { ok: true, status: 200, requester: entry.requester, target: entry.target, carry: entry.carry };
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
    if (nowFn() - entry.at >= ageOut(entry)) {
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
    // Posts in flight for one requester — the per-member count (cycle 1).
    // The Governor reads it to spare a busy stream from eviction.
    countFor: countFor,
    // How many are aimed at one member, and when the next slot frees.
    countForTarget: countForTarget,
    msUntilFreeFor: msUntilFreeFor,
    size: size,
    reset: reset,
    max: max,
    // The member cap under its old name. `caps` is the whole picture.
    maxPerRequester: perRequester,
    caps: caps,
    maxPerTarget: perTarget,
    ttlMs: ttlMs,
  };
}

module.exports = {
  createRouter: createRouter,
  DEFAULT_MAX: DEFAULT_MAX,
  DEFAULT_PER_REQUESTER: DEFAULT_PER_REQUESTER,
  DEFAULT_PER_TARGET: DEFAULT_PER_TARGET,
  DEFAULT_TTL_MS: DEFAULT_TTL_MS,
  MIN_USEFUL_MS: MIN_USEFUL_MS,
  MEMBER: MEMBER,
  RELAY: RELAY,
  PARTNER: PARTNER,
  KINDS: KINDS,
};
