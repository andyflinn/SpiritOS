'use strict';

// spirit/run/js/peerPost.js
// The personal node's half of the router: post to a peer, answer a peer.
//
// An app asks its own node to reach somebody and gets an answer back. It
// never signs anything, never learns what a relay is, and never sees a
// hash unless it asks — the node holds the key, which also means an app
// cannot forge a sender (design/relay/ROUTER.md).
//
// HOLD WHERE IT IS FREE, NEVER WHERE IT IS NOT. The relay never holds a
// connection; that was the whole 66-versus-60 lesson. But a browser
// talking to its own node is loopback — no proxy, no TLS, nothing to
// time it out — so the node CAN wait a moment for the round trip and
// hand back a real answer, which is what lets an app `await` this like
// any other call.
//
// Two clocks, and confusing them would be the bug. The wait below is how
// long we will make it LOOK synchronous. The relay's pending entry is how
// long the request actually lives. If the wait expires first nothing is
// lost — the answer arrives on the stream and is matched by hash — which
// is why the hash comes back even on the fast path.

const auth = require('./relayAuth');
// The hint bound and the tunnel predicate (cycle 2) — one file for the
// relay, the node and the page, so all three agree what fits.
const limits = require('./limits.js');
// The address book, for one question only: may this key be COUNTED.
// Admission is the front door's answer and arrives as `verdict`; whether
// a sender's numbers move is a fact about the book — see the rules at the
// stats call below, which came from the ring's countInbound.
const contactBook = require('./contacts');
const nodeCard = require('./nodeCard');
// The one sealing implementation (cycle 10, R4). oneDoor.js asserts it is
// the only one in the tree — two seal functions differing in one detail
// is how associated data gets dropped on one path.
const seal = require('./seal');
// WHICH REQUEST GOES NEXT. A relay holds one route per member (0016), so
// a node that fires freely is refused; one that queues turns a refusal
// into latency, which is `reach over speed`. The rules live next door
// because they are decidable without a socket and therefore testable
// without one — see postQueue.js and spirit/test/postQueue.js.
const postQueue = require('./postQueue');
const spiritErrors = require('./spiritErrors');

// A UX number, not a protocol constant tuned against another machine's
// tick. It only decides how long a caller stares at a spinner.
var DEFAULT_WAIT_MS = 8000;

// ── THE FLOOR ────────────────────────────────────────────────────────
//
// What a sender this node has never heard of may spend. Constants, in
// code, with no way to configure them — and that is the point rather
// than an omission.
//
// Andy asked whether a node should safeguard itself against unknown keys
// REGARDLESS of the user's wishes. It should, and the reason is a
// distinction between two questions that a single setting was answering
// at once:
//
//   "let strangers reach me"        — a preference, and the user's
//   "let strangers spend anything"  — not a question anybody was asked
//
// So the PREFERENCE decides who you talk to (hub.js, unknownPolicy:
// silent / hold / acquire) and the FLOOR decides what a stranger can
// spend. `acquire` still acquires. What is bounded is the cost, never the
// contact.
//
// It lives here rather than in a file because a floor in a file is a
// floor somebody can lower. AGENT.md: the server is the only jail —
// decision 0003 shows the shape an invariant has, reading `intrinsic`
// from disk and never from the content being written.
var UNKNOWN_PER_MIN = 6;
// A stranger's whole budget of payload for a minute, across every
// stranger. Sized as "enough for a first hello, nothing like enough to
// fill a disk".
//
// THE ARITHMETIC UNDER IT WAS STALE (corrected 2026-09-17). It read "the
// traffic log keeps 24 hours, so this is what an unknown sender may add
// to it" — and the window is gone. Andy: "the log should be permanent.
// period." trafficLog.js: "nothing is pruned on the way out any more,
// because nothing is pruned at all."
//
// So the bound is NOT "100 MB a day, recycled". It is **100 MB a day,
// kept**, which is the number this constant actually governs: at 64 KB a
// minute an adversary spending every byte for a year adds ~34 GB to the
// owner's disk, for ever.
//
// That does not make the number wrong — it makes it load-bearing in a
// different way. The floor is no longer a cap on how much of a rolling
// window a stranger may occupy; it is a cap on **how fast a stranger can
// grow a file that never shrinks**. Anybody retuning it should be pricing
// permanent bytes, not transient ones.
var UNKNOWN_BYTES_PER_MIN = 65536;
var UNKNOWN_WINDOW_MS = 60000;

function createPeerPost(opts) {
  opts = opts || {};
  var rootDir = opts.rootDir;
  var request = opts.request;
  var waitMs = opts.waitMs || DEFAULT_WAIT_MS;
  // THE TUNNEL CHECK AT COMPOSE (cycle 2). A NODE cannot know whether a
  // packet will be carried across a partnership, so it refuses up front
  // one that would not fit once wrapped (limits.fitsWrapped) — on every
  // route, because a signed packet cannot be trimmed at the far hop. Off
  // for a relay's own peerPost: what a relay sends a partner IS the
  // wrapper, addressed to the partner itself, and is never tunnelled again.
  var checkTunnel = !!opts.checkTunnel;
  var setT = opts.setTimeoutImpl || setTimeout;
  var clearT = opts.clearTimeoutImpl || clearTimeout;

  // WHAT CROSSED THE WAN, written down. This node's own record of what it
  // sent and what it received — the evidence that survives a relay which
  // delivers or refuses and stores nothing (decision 0006).
  //
  // Passed in rather than constructed here so the caller owns the
  // `relayMode` gate: that file is correct on a personal node and is the
  // worst thing in the system on a relay. A peerPost built without one
  // simply writes nothing, which is what every test that does not care
  // about the log gets.
  // WHERE A PEER WAS LAST SEEN, told to the node's own cache. Injected
  // like `admit` and `remember`, for the same reason: the answer needs
  // the node's relay keys and none of that belongs in the file that moves
  // packets. Given nothing, nothing is remembered — which is every suite
  // that does not care.
  var noteSeen = opts.noteSeen || null;
  var traffic = opts.traffic || null;
  // NODE-ONLY, AND SO IT IS INJECTED (cycle 10, R3). What to do with a
  // card that verified: on a node, write it to the contact book; on a
  // relay, nothing, because a relay keeps no book. See keepCard below.
  var cardKeeper = typeof opts.keepCard === 'function' ? opts.keepCard : null;
  // WHAT A PEER'S POSTS ARE SEALED TO (cycle 10, R5), by key. Injected
  // for the same reason as everything else node-only here: on a node it
  // reads the contact card or the pinned relay key, on a relay it reads a
  // partner's published key, and neither belongs in the file that moves
  // packets. Given nothing, every post but a card is refused — which is
  // the strict direction, and the right one to fail towards.
  var sealKeyFor = typeof opts.sealKeyFor === 'function' ? opts.sealKeyFor : null;
  // ── AND AN OPT-OUT THAT HAS TO BE ASKED FOR ────────────────────────
  //
  // Default ON, so a caller that forgets `sealKeyFor` gets refusals
  // rather than plaintext — fail closed, which is the whole shape of
  // this cycle. The one caller that turns it off is a RELAY's partner
  // router, and it says so in a named field rather than by omission, so
  // "no key wired up" and "this traffic is deliberately not sealed yet"
  // cannot be confused for each other.
  //
  // What that opt-out covers is argued in relay.js at `fromPartnerBox`:
  // everything a partner CARRIES is sealed to its recipient; the wrapper
  // around it is not, and cannot be until the partnership handshake
  // carries a key.
  var sealsPosts = opts.sealsPosts !== false;
  function note(entry) {
    if (!traffic) return;
    try { traffic.note(entry); } catch (e) { /* a witness, never a participant */ }
  }

  // hash -> { resolve, timer, relayUrl, at, seq }
  var waiting = Object.create(null);

  // THE SCHEDULER. One request in flight per relay, so a node on three
  // relays has three — its concurrency is relays x cap, by construction.
  //
  // DEFAULT PATIENCE IS ZERO, and that is what keeps this change additive:
  // an entry gets one attempt and then whatever answer it got, which is
  // exactly the behaviour every caller had before a queue existed.
  // Retrying across attempts is opt-in per post, because a patience
  // measured in days (Andy's case for a text message) needs a store this
  // node does not have yet.
  var queue = postQueue.createQueue({
    inFlightPerRelay: opts.inFlightPerRelay,
    backoffStartMs: opts.backoffStartMs,
    backoffMaxMs: opts.backoffMaxMs,
  });

  // ── A QUEUE THAT OUTLIVES THE PROCESS, WHEN THERE IS SOMEWHERE TO KEEP IT ──
  //
  //   Andy: patience "could be days for a text message" — and days means
  //   restarts (cycle R16).
  //
  // Given a store, every entry is written through as it changes and read
  // back when the node starts. Given none — a RELAY's own peerPost, which
  // has no node.db, and every suite that does not care — it behaves
  // exactly as before. That is not a second implementation: it is the
  // same queue with or without a place to write it down.
  var store = opts.store || null;

  // THE QUEUE MEASURES ON A CLOCK THAT CANNOT JUMP (R18), AND THAT CLOCK
  // MEANS NOTHING TO THE NEXT PROCESS — performance.now() starts again
  // near zero. So a deadline goes to disc as wall time and comes back as
  // monotonic, and the time the node spent down is counted against it.
  function toWall(mono) { return Date.now() + (mono - queue.now()); }
  function toMono(wall) { return queue.now() + (wall - Date.now()); }

  function persistOut(hash) {
    if (!store) return;
    try { store.queue.del(hash); } catch (e) { /* the send settled; the row is a detail */ }
  }
  function persistPair(relayUrl, toKey) {
    if (!store) return;
    try {
      var st = queue.pairState(relayUrl, toKey);
      if (st.until) store.backoff.put(relayUrl, toKey, toWall(st.until), st.lastWait);
      else store.backoff.del(relayUrl, toKey);
    } catch (e) { /* a backoff that was not written costs one early retry */ }
  }
  var wakeTimer = null;
  // What arrived for us, in order, with an id an app can ask for again.
  // Called "mailbox" until 2026-09-15, after the ring R8 deleted. Andy:
  // "what is mailbox doing in this?!?"
  var arrived = [];
  var nextItem = 1;
  var onArrival = opts.onArrival || null;
  // Injected rather than required, so a suite can watch it without a
  // home on disk — and so this file states its dependency instead of
  // reaching for one.
  var stats = opts.stats || null;

  // WHO THIS NODE WILL HEAR, asked rather than decided here.
  //
  // Handed in for the same reason `traffic` is: the answer needs the
  // node's own address book, its relays and its preference, and none of
  // that belongs in the file that moves packets. Given nothing, every
  // sender is admitted — which is what every existing test gets, and
  // what this file did unconditionally until 2026-09-12.
  //
  // It answers 'known' | 'admit' | 'hold' | 'drop'. A hook that throws is
  // treated as 'drop': a front door whose judgement failed must not fall
  // open.
  //
  // 'known' and 'admit' both end in delivery; only 'known' escapes the
  // floor. That distinction is the whole reason there are four words and
  // not three — a stranger the policy welcomes is still a stranger, and
  // "let strangers reach me" was never consent to unbounded strangers.
  var VERDICTS = ['known', 'admit', 'hold', 'drop'];
  var admit = typeof opts.admit === 'function' ? opts.admit : null;
  function judge(from) {
    if (!admit) return 'known';
    try {
      var said = admit(from);
      return VERDICTS.indexOf(said) === -1 ? 'drop' : said;
    } catch (e) {
      return 'drop';
    }
  }

  // What to write down about a stranger who got through the budget.
  // Called only after the floor allowed them, so a flood leaves no rows
  // behind — a row is a record of somebody worth knowing about.
  var remember = typeof opts.remember === 'function' ? opts.remember : null;

  // The floor's books: requests per unknown sender, and bytes across all
  // of them. Both in RAM and both per-minute — a stranger's budget is not
  // a thing to persist, and a restart resetting it costs nothing that
  // matters.
  var unknownHits = Object.create(null);
  var unknownBytes = [];
  function withinFloor(from, bytes) {
    var now = Date.now();
    var cutoff = now - UNKNOWN_WINDOW_MS;

    // Swept on the way past rather than on a timer: the only thing that
    // grows this map is a stranger arriving, so the only moment it needs
    // tidying is when one does.
    Object.keys(unknownHits).forEach(function (k) {
      unknownHits[k] = unknownHits[k].filter(function (t) { return t > cutoff; });
      if (!unknownHits[k].length) delete unknownHits[k];
    });
    unknownBytes = unknownBytes.filter(function (e) { return e.at > cutoff; });

    var mine = unknownHits[from] || [];
    if (mine.length >= UNKNOWN_PER_MIN) return false;

    var spent = unknownBytes.reduce(function (n, e) { return n + e.n; }, 0);
    if (spent + bytes > UNKNOWN_BYTES_PER_MIN) return false;

    mine.push(now);
    unknownHits[from] = mine;
    unknownBytes.push({ at: now, n: bytes });
    return true;
  }
  // WHO COMPOSES AN ANSWER. Optional: with nobody home the reply is the
  // empty receipt this file has always sent, which is why every existing
  // caller is unaffected by its arrival.
  var answer = opts.answer || null;

  function me() {
    return auth.loadIdentity(rootDir);
  }

  // HOW AN EXCHANGE ENDED. post() returns before the answer exists, so
  // the outbound side writes twice and the hash is what joins the pair —
  // which is exactly what a hash is for.
  //
  // The second entry is not always outbound, and saying it was would be
  // a small lie repeated forever: a receipt that came back CROSSED THE
  // WAN INWARD. A refusal did not — nothing arrived, our request simply
  // failed. So the direction follows what actually happened.
  function noteOutcome(hash, slot, answer) {
    var arrived = !!(answer && answer.ok);
    note({
      dir: arrived ? 'in' : 'out',
      kind: arrived ? 'reply' : 'request',
      peer: arrived ? (answer.from || slot.toKey) : slot.toKey,
      relay: slot.relayUrl,
      hash: hash,
      outcome: arrived ? 'receipted'
        : (answer && answer.stillOpen) ? 'no-answer' : 'refused',
      status: answer && answer.status,
      // WHY, and not only that it failed (R36, retrofitted here). The log
      // is permanent and is read by a person; "refused, 504" tells them
      // nothing, "gave-up" or "peer-unreachable" tells them what happened.
      // The same catalogue the presence write uses, so the log and the
      // screen can never disagree about what an error meant.
      code: arrived ? undefined : ((spiritErrors.classifyAnswer(answer) || {}).code),
      ms: Date.now() - slot.at,
      // A receipt usually carries nothing, but an app that answers with
      // something has sent bytes across the WAN and they are logged like
      // any other.
      payload: (answer && typeof answer.text === 'string') ? answer.text : undefined,
    });
  }

  // A MATCH, NOT A DEFENCE — decision 0011.
  //
  // This reads like a guard against a forged hash and is not. The hash on
  // an arriving reply cannot be produced without reconstructing the signed
  // request, so an unmatched one is not dangerous-and-handled, it is
  // UNPRODUCIBLE. Nothing is being kept out; this is the lookup that turns
  // a reply into an answer to a specific post.
  //
  // `waiting` is keyed by a hash this node computed and never sent, which
  // is what makes correlation and proof the same number.
  // ALSO THE SUCCESS PATH FROM THE STREAM, which is why the queue is
  // released here rather than only where an attempt fails. `onReply`
  // calls this when an answer lands, and that answer is the thing the
  // scheduler was holding a slot open for — so the slot frees, the
  // target's backoff is forgiven, and whatever was waiting behind it
  // goes.
  function settle(hash, answer) {
    var slot = waiting[hash];
    if (!slot) return false;
    delete waiting[hash];
    if (slot.timer) clearT(slot.timer);
    if (slot.seq) {
      if (answer && answer.ok) {
        queue.reached(slot.relayUrl, slot.toKey);
        persistPair(slot.relayUrl, slot.toKey);
      }
      queue.done(slot.seq);
    }
    // ── THE ANSWER IS OPENED BEFORE ANYBODY SEES IT (cycle 10, R5) ────
    //
    // Replies are sealed too, so the asker opens one here — after the
    // receipt signature was checked in onReply, never before (cycle 10's R11). A
    // reply that will not open is handed up as the empty answer it
    // effectively is, rather than as ciphertext for a caller to puzzle
    // over.
    //
    // A CARD ANSWER IS NOT SEALED, and a refusal is not either, so both
    // pass through untouched. `isSealed` is the one question asked, which
    // is why it is structural and cheap.
    if (answer && answer.ok && typeof answer.text === 'string' && seal.isSealed(answer.text)) {
      var mine = me();
      var got = mine && seal.open(mine.sealPrivateKey, slot.toKey, mine.publicKey, answer.text);
      answer.sealed = true;
      answer.text = got ? got.text : '';
      if (got) answer.sentAt = got.at;
    }
    persistOut(hash);
    noteOutcome(hash, slot, answer);
    if (slot.askedCard) keepCard(slot, answer);
    slot.resolve(answer);
    pump();
    return true;
  }

  // ── A CARD IS VERIFIED HERE, BECAUSE A PAGE CANNOT (cycle 10, R3) ────
  //
  // `shell.js` says it plainly where the client half of a peerPost is
  // built: *"A page holds no key, cannot verify a signature, and must
  // never be built as though it could."* Until this cycle Contacts read
  // `name` and `description` straight off the reply and drew them, which
  // meant anything that could answer could choose what a stranger was
  // called on somebody's screen.
  //
  // So it is checked at the one point every answer converges — whether it
  // came down the held stream or on the POST itself — and the caller is
  // handed `answer.card`: the VERIFIED fields, or a refusal with a
  // reason. Never the raw blob to interpret for itself.
  //
  // THE KEY WE ASKED IS THE KEY THAT MUST HAVE SIGNED. A card verifies
  // against whoever signed it, which proves whose it is and nothing about
  // whose it was meant to be. `slot.toKey` is the question; the signature
  // is the answer; this is where the two are made to agree.
  //
  // ── AND KEEPING IT IS SOMEBODY ELSE'S JOB, ON PURPOSE ────────────────
  //
  // `oneDoor.js` caught the first draft of this, which wrote the contact
  // book from here: *"contactBook is inbound-only, so a relay may
  // construct one."* A RELAY builds a peerPost too, for partner traffic,
  // and a relay has no contact book — so a write on the outbound path
  // would have made this module node-only and grown a second transport
  // for partners to need.
  //
  // Verifying is pure: keys and bytes, no node-only state, correct in a
  // relay as in a node. Storing is the node's business, so it arrives the
  // way everything else node-only does — injected (`opts.keepCard`,
  // beside `opts.store` and `opts.admit`). A relay passes none and simply
  // gets the verdict.
  function keepCard(slot, answer) {
    if (!answer || !answer.ok || typeof answer.text !== 'string') return;
    var fields = nodeCard.verify(answer.text);
    if (!fields) { answer.card = { ok: false, why: 'not a card' }; return; }
    if (fields.publicKey !== slot.toKey) {
      // The one moment a node can notice a carrier swapping keys under
      // it. Logged here, not by the keeper, because a refusal that
      // depends on somebody having wired a keeper up is a refusal that
      // goes missing in the configuration that needs it most.
      note({
        dir: 'in', kind: 'reply', peer: slot.toKey, relay: slot.relayUrl,
        hash: answer.hash, outcome: 'refused', code: 'card-wrong-key',
      });
      answer.card = { ok: false, why: 'wrong key', signedBy: fields.publicKey };
      if (cardKeeper) cardKeeper(slot.toKey, answer.text);
      return;
    }
    var stored = cardKeeper ? cardKeeper(slot.toKey, answer.text) : null;
    answer.card = {
      ok: true,
      name: fields.name,
      description: fields.description,
      sealKey: fields.sealKey,
      at: fields.at,
      // Whether it was WRITTEN, which is not the same as whether it was
      // good: Contacts asks strangers for a card before adding them — the
      // whole point of a card — and a question must not write somebody
      // into the book. The screen shows what was checked, not what was
      // kept.
      stored: !!(stored && stored.ok),
      why: (stored && !stored.ok) ? stored.why : undefined,
    };
  }

  // ── WHAT MAY BE TRIED AGAIN ──────────────────────────────────────────
  //
  // Three of these are about the world being busy and one is about this
  // packet being wrong, and only the first three are worth repeating.
  //
  // `busy` is the relay saying the TARGET is occupied — the peer is fine
  // and somebody else is asking. `stillOpen` is this node's own wait
  // elapsing, which says nothing except that no answer came yet. Status 0
  // is the transport failing. And 503 covers a peer that is not connected
  // right now, which is precisely the case a patience of days exists for:
  // Andy — "could be days for a text message".
  //
  // A 400, 413 or 403 is refused for what the packet IS, so it will be
  // refused identically for ever. Retrying those would spend a member's
  // only slot on an answer already known.
  function retryable(answer) {
    if (!answer) return false;
    if (answer.busy) return true;
    if (answer.stillOpen) return true;
    if (answer.status === 0) return true;
    // NOT ENOUGH TIME IS A FACT ABOUT THE REQUEST, NOT ABOUT THE WORLD,
    // and it arrives as a 503 like the two retryable ones. Waiting
    // changes a busy target and may change an absent one; it does not
    // change a budget, because the budget is declared by this node on
    // every attempt and is the same number each time. Retrying it is a
    // loop that cannot succeed — it would spend a member's only slot,
    // repeatedly, on an answer already known.
    //
    // So it belongs with 400 and 413: refused for what the request IS.
    if (answer.tooLittleTime) return false;
    if (answer.status === 503) return true;
    if (answer.status === 409) return true;   // already in flight: a duplicate, so wait
    return false;
  }

  // An attempt is over. Either the intent survives to be tried again, or
  // this is the answer and the caller gets it.
  function afterAttempt(seq, hash, answer) {
    var slot = waiting[hash];
    if (slot && slot.timer) { clearT(slot.timer); slot.timer = null; }

    if (slot && retryable(answer) && queue.mayRetry(seq)) {
      // BUSY AND SILENT ARE DIFFERENT EVIDENCE and back off differently:
      // contention says nothing about the peer, so it honours the relay's
      // own retryAfterMs; silence is about the peer, so it doubles.
      if (answer.busy) queue.busy(seq, answer.retryAfterMs);
      else queue.silent(seq);
      var backed = queue.find(seq);
      if (backed) persistPair(backed.relayUrl, backed.toKey);
      pump();
      return;
    }
    queue.done(seq);
    settle(hash, answer);
    pump();
  }

  // One attempt on the wire. The per-attempt timer starts HERE and not
  // when the post was made: time spent queued is not time the far end had
  // to answer in, and charging it would make a busy relay look like an
  // unresponsive peer.
  function sendAttempt(it) {
    var hash = it.payload.hash;
    var slot = waiting[hash];
    if (!slot) { queue.done(it.seq); persistOut(hash); return; }

    slot.timer = setT(function () {
      slot.timer = null;
      // Not a failure of the request — a failure to wait for it. The
      // request may still be alive at the relay, and its answer will
      // still arrive and still be matched; the caller simply stopped
      // holding the line.
      afterAttempt(it.seq, hash, {
        ok: false, status: 504, hash: hash,
        error: 'no answer yet', stillOpen: true,
      });
    }, waitMs);

    Promise.resolve()
      .then(function () {
        return request(it.relayUrl, 'POST', '/api/relay/post', it.payload.body);
      })
      .then(function (res) {
        var body = {};
        try { body = JSON.parse(res.text); } catch (e) { body = {}; }
        // ACCEPTED IS NOT ANSWERED. A 202 means the relay took it and the
        // reply is coming down the stream, so the slot stays held and the
        // timer keeps running — that wait is the whole reason a slot
        // exists.
        //
        // BUT IT KEEPS RUNNING FOR AS LONG AS THE RELAY GRANTED, not for
        // as long as this node asked. The relay answers with `grantedMs`
        // = min(what we asked, its own ceiling), so asking 8 s of a relay
        // that allows 5 s means the route is gone at 5 s and the reply can
        // no longer arrive. Waiting the remaining three seconds holds this
        // member's only slot for nothing — the asker blocking itself,
        // which looks exactly like the relay blocking it.
        if (res.status >= 200 && res.status < 300) {
          // ANSWERED ON THE POST ITSELF (R13). A relay posting to a partner
          // holds no stream there any more, so the partner keeps the post
          // open and its reply IS the answer — the same signed packet a
          // stream would have carried. It settles through onReply, so the
          // receipt is verified exactly as a streamed one is; nothing about
          // what counts as an answer changes, only which door it came in by.
          if (body && body.hash && body.from && body.sig && typeof body.text === 'string') {
            onReply({ hash: body.hash, from: body.from, text: body.text, sig: body.sig });
            return;
          }
          var granted = body && typeof body.grantedMs === 'number' ? body.grantedMs : 0;
          var slotNow = waiting[hash];
          if (granted > 0 && granted < waitMs && slotNow && slotNow.timer) {
            clearT(slotNow.timer);
            slotNow.timer = setT(function () {
              slotNow.timer = null;
              afterAttempt(it.seq, hash, {
                ok: false, status: 504, hash: hash,
                error: 'no answer within the ' + granted + 'ms the relay granted',
                stillOpen: true, grantedMs: granted,
              });
            }, granted);
          }
          return;
        }
        afterAttempt(it.seq, hash, {
          ok: false, status: res.status, hash: hash,
          error: (body && body.error) || 'refused',
          inFlight: !!(body && body.inFlight),
          // BUSY IS NOT THE SAME NO AS UNREACHABLE, and both arrive as
          // 503: one says do not expect an answer, the other says the
          // peer is fine and somebody else is asking (0016).
          busy: !!(body && body.busy),
          retryAfterMs: (body && typeof body.retryAfterMs === 'number') ? body.retryAfterMs : 0,
          // Carried for the same reason `busy` is: a refusal nobody can
          // tell apart is a refusal that cannot be acted on. This one
          // means stop, where the others mean wait.
          tooLittleTime: !!(body && body.tooLittleTime),
          // The relay's own word for what the refusal means (R36 phase B),
          // when it sends one. An older relay sends none, and the sentence
          // is classified as before.
          code: (body && typeof body.code === 'string') ? body.code : undefined,
        });
      })
      .catch(function (e) {
        afterAttempt(it.seq, hash, {
          ok: false, status: 0, hash: hash,
          error: String((e && e.message) || e),
        });
      });
  }

  // Dispatch everything that may go, then sleep exactly as long as the
  // queue says is useful. Re-entrant by design: settle() pumps, and a
  // pump that dispatched nothing is a cheap walk of a short list.
  function pump() {
    // ── EXPIRE FIRST, THEN SEND (found by R16's suite) ───────────────
    //
    // This dispatched everything eligible and swept the spent entries
    // AFTER — so an entry past its patience, but not blocked, went out one
    // last time before anything noticed. `eligible()` asks about slots and
    // backoff, never about the deadline; `expired()` is the only thing
    // that does.
    //
    // NOT ONLY A RESTART'S PROBLEM, which is how it was found. A busy
    // target whose `retryAfterMs` outlasts the remaining patience produced
    // the same thing: when the backoff lifted the entry was eligible AND
    // spent, and was sent anyway. Patience bounds retrying (the first
    // attempt is never expired), and an attempt after the bound is a
    // retry the owner did not grant.
    sweepSpent();
    var it = queue.eligible();
    while (it) {
      queue.started(it.seq);
      if (store && it.payload && it.payload.hash) {
        try { store.queue.attempts(it.payload.hash, it.attempts); }
        catch (e) { /* an attempt count not written costs one extra try after a restart */ }
      }
      sendAttempt(it);
      it = queue.eligible();
    }
    wake();
  }

  // Intents whose whole patience is gone. The first attempt is never
  // expired — patience bounds retrying, not trying.
  function sweepSpent() {
    queue.expired().forEach(function (it) {
      var hash = it.payload && it.payload.hash;
      queue.done(it.seq);
      if (!hash) return;
      settle(hash, {
        ok: false, status: 504, hash: hash,
        error: 'gave up after ' + it.attempts + ' attempt(s)',
        gaveUp: true,
      });
    });
  }

  function wake() {
    if (wakeTimer) { clearT(wakeTimer); wakeTimer = null; }
    var ms = queue.nextWakeMs();
    if (ms === null) return;
    wakeTimer = setT(function () { wakeTimer = null; pump(); }, Math.max(ms, 1));
    // A node must not be held awake by its own retry timer.
    if (wakeTimer && typeof wakeTimer.unref === 'function') wakeTimer.unref();
  }

  // REGISTER BEFORE YOU FORWARD. The same rule the relay's table enforces
  // by shape, applied one hop earlier: nothing leaves this node until the
  // thing that will match its answer exists. A reply that arrives before
  // the waiter does is a reply with nowhere to go, and the symptom is
  // silence rather than an error.
  //
  // `hints` (cycle 2): the relays the recipient is enrolled at, by key,
  // from the contact row — sent beside the packet and signed on their own
  // (relayAuth.hintMessage), so the first relay can act on them and drop
  // them. Absent for a recipient on a relay this node holds.
  function post(relayUrl, toKey, text, hints, how) {
    var id = me();
    if (!id || !id.privateKey) {
      return Promise.resolve({ ok: false, status: 500, error: 'this node has no identity' });
    }
    if (!toKey) return Promise.resolve({ ok: false, status: 400, error: 'to required' });
    if (typeof text !== 'string' || !text) {
      return Promise.resolve({ ok: false, status: 400, error: 'text required' });
    }

    // ── IS THERE ROOM TO PROMISE THIS? ──────────────────────────────
    //
    //   Andy: "the node wants to avoid accumulating a backlog in the
    //   post-scheduler, at this point it has at least the option of
    //   refusing requests outright until the block is resolved."
    //
    // ASKED FIRST, before signing and before the log, so a refusal costs
    // nothing but the answer — and so the traffic log does not fill with
    // attempts that never happened.
    //
    // Refusing at the door is the only shed that keeps the order: dropping
    // from the middle would evict work that had already earned its place,
    // which is the anti-starvation rule upside down. And a background
    // sweep is refused at a quarter of the room, so a screen decorating
    // itself cannot fill the queue a person's own actions need.
    var wantKind = (how && how.kind) || postQueue.DELIBERATE;
    if (!queue.accepts(wantKind, text.length)) {
      return Promise.resolve({
        ok: false, status: 503,
        error: 'this node has too much waiting to send',
        queueFull: true, kind: wantKind,
      });
    }

    // ── SEALED BEFORE IT IS SIGNED (cycle 10, R4, R5 and R11) ───────
    //
    //   Andy: "and card is the only possible un-cyphered peerPost,
    //   shouldn't it be?" — "yes. VERY strict about that!"
    //
    // THE ORDER IS THE POINT. The relay verifies a post's signature
    // before it routes it and will never hold the plaintext, so a
    // signature over plaintext would be a signature nobody on the path
    // could check — the relay would be forwarding unauthenticated bytes.
    // Sealed first, signed second, hashed outermost: every layer outside
    // the seal works on bytes it cannot read, which is what lets a relay
    // do its whole job without ever holding a word.
    //
    // ONE EXCEPTION, AND IT IS COUNTABLE. The card request and the card
    // answer travel plain, because the card is how you learn the key to
    // seal to. That is a guard you can enforce by asking one question;
    // "everything except the card and posts to the relay" would need a
    // judgement about every destination, which is why posts to a relay
    // are sealed too (cycle 10's R9).
    //
    // NO CARD, NO POST — Andy: "if you can't get the card, you can't post
    // anyways." Refused here rather than sent plain, because a plaintext
    // fallback hands everything to an attacker who can simply withhold a
    // card.
    // THE KEY MAY HAVE TO BE FETCHED, so this step is allowed to be
    // asynchronous: a node reads it off a contact row and answers at
    // once, while a RELAY may have to ask a partner for its published
    // key. Resolved here, before anything is registered or queued, so
    // the ordering everything below depends on — register, then forward
    // — is exactly as it was.
    return Promise.resolve(nodeCard.asks(text) ? '' : (sealKeyFor ? sealKeyFor(toKey) : ''))
      .catch(function () { return ''; })
      .then(function (sealKey) { return sealAndSend(sealKey); });

    function sealAndSend(sealKey) {
    var sending = text;
    if (!nodeCard.asks(text) && sealsPosts) {
      var wrapped = sealKey ? seal.seal(sealKey, id.publicKey, toKey, text) : null;
      if (!wrapped) {
        // ON THE RECORD, like every other refusal. Nothing crossed, so
        // there is no hash to join it to — but this is the exact symptom
        // of the flag day ("old nodes MUST update to stay in the game")
        // and of a peer whose card was never fetched, and a person
        // staring at a message that will not send needs to find the
        // reason somewhere. The payload is kept because it is the
        // owner's own words, not a stranger's.
        note({
          dir: 'out', kind: 'request', peer: toKey, relay: relayUrl,
          outcome: 'refused', code: 'no-cipher-key', payload: text,
        });
        return Promise.resolve({
          ok: false, status: 428, noSealKey: true,
          error: sealKey
            ? 'that peer\'s cipher key cannot be used'
            : 'no cipher key for that peer — ask for their card first',
        });
      }
      sending = JSON.stringify(wrapped);
    }

    var message = auth.postMessage(id.publicKey, toKey, sending);
    var sig = auth.sign(id.privateKey, message);
    var hash = auth.requestHash(message);

    // MEASURED ON WHAT TRAVELS, which is the sealed bytes: base64 grows
    // a payload by about a third, and checking the plaintext would let a
    // packet through here and have it refused on the wire.
    if (checkTunnel && !limits.fitsWrapped(sending, id.publicKey, toKey, sig)) {
      return Promise.resolve({
        ok: false, status: 413, hash: hash,
        error: 'too big to tunnel — this packet would not fit if carried to a partner',
      });
    }

    var hintList = Array.isArray(hints)
      ? hints.filter(function (k) { return typeof k === 'string' && k; }).slice(0, limits.HINTS_PER_POST)
      : [];

    var body = { from: id.publicKey, to: toKey, text: sending, sig: sig };

    // ── HOW LONG THIS ASKER WILL WAIT, SAID OUT LOUD ────────────────
    //
    //   Andy: "N1 sets a limit on its patience, which gets reduced down
    //   the chain" — "part of the request's sidecar/envelope."
    //
    // A remaining DURATION, never a deadline: a timestamp would need this
    // node and the relay to agree about the clock, and nothing in this
    // design depends on two boxes agreeing about the time.
    //
    // Defaults to this node's own per-attempt wait, which is the honest
    // number — it is exactly how long the caller will be held. The relay
    // grants min(this, its own ceiling), so declaring 8 s where a relay
    // allows 5 s buys 5 s and a guarantee: the relay gives up first, and
    // this node never abandons a route the relay still holds.
    //
    // A relay forwarding to a partner passes what is LEFT (relay.js,
    // HOP_MARGIN_MS), which is what makes the chain tighten inward.
    var budget = (how && typeof how.budgetMs === 'number' && isFinite(how.budgetMs))
      ? Math.max(0, how.budgetMs)
      : waitMs;
    body.budgetMs = budget;

    if (hintList.length) {
      body.hints = hintList;
      body.hintSig = auth.sign(id.privateKey, auth.hintMessage(sig, hintList));
    }

    // REGISTERED BEFORE IT IS QUEUED, let alone sent. A reply that arrives
    // before the waiter does is a reply with nowhere to go, and the
    // symptom is silence rather than an error — so the thing that matches
    // the answer exists before anything can produce one.
    //
    // NO TIMER HERE ANY MORE. The per-attempt wait starts when the
    // attempt does (sendAttempt), because time spent queued is not time
    // the far end had to answer in. Charging it would make a busy relay
    // look like an unresponsive peer, which is the one confusion this
    // whole design is built to avoid.
    var answered = new Promise(function (resolve) {
      waiting[hash] = {
        resolve: resolve,
        relayUrl: relayUrl,
        // Kept for the log: the resolving entry has to name who this was
        // with, and by then the caller's arguments are long gone.
        toKey: toKey,
        // Whether this exchange was a card request, decided from the
        // outgoing text by the same predicate the answering side uses
        // (cycle 10, R3). Recorded here rather than re-derived at settle,
        // where the request is gone.
        askedCard: nodeCard.asks(text),
        at: Date.now(),
        timer: null,
        seq: 0,
      };
    });

    // THE BYTES LEAVING. Written before the transport is touched, so an
    // attempt that never got out of the building is still on the record —
    // settle() then writes how it ended. Two entries, one hash.
    note({
      dir: 'out', kind: 'request', peer: toKey, relay: relayUrl,
      hash: hash, outcome: 'sent', payload: text,
    });

    // `how` is the caller saying what KIND of request this is and how long
    // it is worth trying for. Absent — which is every caller today — it is
    // a deliberate request with one attempt, exactly as before.
    //
    //   { kind: 'background' }  a screen decorating itself; yields to a
    //                           person's own action however much older it is
    //   { patienceMs: n }       keep trying for n ms across attempts
    waiting[hash].seq = queue.add({
      relayUrl: relayUrl,
      toKey: toKey,
      kind: how && how.kind,
      patienceMs: how && how.patienceMs,
      // What this entry costs while it waits: its payload, which is the
      // whole reason the queue is bounded in bytes rather than in rows.
      bytes: text.length,
      payload: { hash: hash, body: body },
    });

    // WRITTEN DOWN BEFORE IT IS TRIED, for the same reason the waiter is
    // registered first: a process that dies between queueing and sending
    // must not lose the one thing it had promised to do.
    if (store) {
      var queued = queue.find(waiting[hash].seq);
      try {
        store.queue.put({
          hash: hash, relayUrl: relayUrl, toKey: toKey,
          kind: queued ? queued.kind : '', body: JSON.stringify(body),
          bytes: text.length, attempts: 0, atWall: Date.now(),
          untilWall: queued ? toWall(queued.until) : Date.now(),
        });
      } catch (e) { /* a message that could not be written down is still sent now */ }
    }

    // Synchronous when a slot is free, which is the common case and makes
    // this identical to the behaviour before a queue existed.
    pump();
    return answered;
    }
  }

  // SOMEBODY ASKED US SOMETHING.
  //
  // The hash is derived here, from the bytes that actually arrived —
  // never taken from the wire. That is the whole proof: had the relay
  // supplied it and this echoed it back, the echo would say nothing. A
  // hash computed from bytes we hold, matching the one the sender
  // computed, IS the evidence that nothing was changed in between.
  // THE CARD, ANSWERED AND FORGOTTEN. Not on the returned object and not
  // reachable from outside this factory: it is one branch of onRequest and
  // nobody else's to call. (AGENT.md, Comms — an interface is opaque.)
  //
  // The reply goes out the same door every other reply does — the held
  // stream, addressed by hash — so a card is not a second protocol. It is
  // the ordinary reply, composed by the node itself rather than by an app.
  //
  // LOGGED BOTH WAYS, for the reason the main path logs before it answers:
  // the record of what arrived must not depend on whether the answer got
  // out. The inbound row carries NO payload — the question is a fixed
  // shape and keeping a stranger's bytes is what the floor above exists to
  // prevent — and is not `admitted`, because nothing was handed to an app.
  function answerCard(relayUrl, id, body, hash) {
    note({
      dir: 'in', kind: 'request', peer: body.from, relay: relayUrl,
      hash: hash, outcome: 'answered',
    });

    var text = nodeCard.describe(rootDir);
    var receipt = auth.sign(id.privateKey, auth.receiptMessage(hash));
    return request(relayUrl, 'POST', '/api/relay/reply', {
      from: id.publicKey, hash: hash, text: text, sig: receipt,
    }).then(function () {
      note({
        dir: 'out', kind: 'reply', peer: body.from, relay: relayUrl,
        hash: hash, outcome: 'answered', payload: text,
      });
      // NOTHING COMES BACK. onRequest's value is the filed item, and this
      // filed none — saying otherwise would hand a caller a row that is in
      // no list.
      return null;
    }).catch(function () { return null; });
  }

  // ── A REFUSAL THAT IS HEARD (cycle 10, R5) ──────────────────────────
  //
  // Sent as an ordinary signed reply, in the card's shape and by the same
  // door, so a refusal is not a second protocol either. It travels PLAIN,
  // and that is deliberate and narrow: the whole content of it is "this
  // node would not take what you sent", which the refuser is willing to
  // say to anybody and which leaks nothing a sealed post was protecting.
  // Sealing it would be impossible in the case that matters anyway —
  // a sender whose cipher key we do not hold is exactly who gets refused.
  function refuse(relayUrl, id, body, hash, status, why) {
    var text = JSON.stringify({ v: 1, body: { ok: false, status: status, error: why } });
    var receipt = auth.sign(id.privateKey, auth.receiptMessage(hash));
    return request(relayUrl, 'POST', '/api/relay/reply', {
      from: id.publicKey, hash: hash, text: text, sig: receipt,
    }).then(function () { return null; }).catch(function () { return null; });
  }

  function onRequest(relayUrl, body) {
    var id = me();
    if (!id || !id.privateKey || !body || !body.from || !body.sig) return null;

    // The message that VERIFIED, so the minute never had to travel.
    var verified = auth.postSignatureFor(
      body.from, body.from, body.to, body.text, body.sig
    );
    if (!verified) return null;
    if (body.to !== id.publicKey) return null;

    var hash = auth.requestHash(verified);

    // ── THE CARD IS ANSWERED HERE, AND TRAVELS NO FURTHER ────────────
    //
    //   Andy: "this should be answered by the node straight away, before
    //   optionally streaming the packet to shell."
    //
    // Everything below this line is the machinery of DELIVERY: a verdict,
    // a filed item, a count against a peer, and a hand-off to whatever
    // app is listening. A question about this node is not addressed to
    // any of that — it is addressed to the node — so it is answered and
    // dropped, and none of that machinery runs.
    //
    // Which is not only tidiness. Each of those steps would be wrong here:
    //
    //   NOT FILED. `arrived` is what was waiting while nobody was home.
    //   A card that was answered is not waiting for anybody.
    //   NOT ACQUIRED. `remember` writes a stranger into the book under
    //   the `acquire` policy. Asking somebody's name is not a greeting,
    //   and a node whose book fills up with everyone who ever looked at
    //   it has a worse book.
    //   NOT COUNTED. The hourglass in Contacts is consideration — lines a
    //   person had to weigh. This one cost them nothing.
    //   NOT STREAMED. No app is handed it, which is the ask.
    //
    // AND THE FLOOR IS SKIPPED, which is worth saying out loud because it
    // is the one guard this jumps. The floor counts a stranger's BYTES,
    // because the thing it was built to stop is somebody making this node
    // write their words to its own disk. This path writes none of them —
    // the log row below carries no payload, and the reply is bounded by
    // the description cap. What bounds the rate is the relay, which limits
    // posts before they ever arrive here.
    if (nodeCard.asks(body.text)) return answerCard(relayUrl, id, body, hash);

    // ── AND EVERYTHING ELSE ARRIVES SEALED, OR NOT AT ALL ────────────
    //
    //   Andy: "and card is the only possible un-cyphered peerPost,
    //   shouldn't it be?" — "yes. VERY strict about that!"
    //
    // THIS HALF IS NOT BELT AND BRACES, IT IS THE RULE. The sender's
    // refusal above lives in this same file and is bypassed by the
    // simplest means there is: not being the sender. Anybody can compose
    // a plaintext post by hand. So the receiver refuses one, and the two
    // checks together are what makes "sealed" a property of the protocol
    // rather than a habit of one implementation.
    //
    // REFUSED BEFORE THE FRONT DOOR, deliberately. Whether this node
    // would talk to them is a later question than whether this is a
    // well-formed packet at all, and an unsealed post is not one.
    //
    // AND IT SAYS WHY. A silent drop reads exactly like an unreachable
    // node, and on a flag day — "old nodes MUST update to stay in the
    // game" — the one thing a person needs to be told is that the box at
    // the other end is old, not broken.
    if (sealsPosts && !seal.isSealed(body.text)) {
      note({
        dir: 'in', kind: 'request', peer: body.from, relay: relayUrl,
        hash: hash, outcome: 'refused', code: 'unsealed',
      });
      return refuse(relayUrl, id, body, hash, 400,
        'unsealed posts are refused — seal to this node\'s cipher key (cycle 10)');
    }

    // NEVER OPENED BEFORE IT IS AUTHENTICATED (cycle 10's R11). The hash was
    // derived and the signature verified above; only now is anything
    // decrypted. Opening first would mean doing cryptography on bytes
    // nobody has vouched for.
    //
    // The AAD binds sender and recipient, so this also settles what a
    // signature alone cannot: that the blob was sealed FOR this node BY
    // that sender, rather than lifted off another exchange and
    // re-addressed.
    var opened = seal.isSealed(body.text)
      ? seal.open(id.sealPrivateKey, body.from, body.to, body.text)
      : { text: body.text, at: '' };
    if (!opened) {
      note({
        dir: 'in', kind: 'request', peer: body.from, relay: relayUrl,
        hash: hash, outcome: 'refused', code: 'will-not-open',
      });
      return refuse(relayUrl, id, body, hash, 400, 'this did not open for me');
    }
    // FROM HERE DOWN THE NODE WORKS ON THE PLAINTEXT, and the log writes
    // it (cycle 10's R14: the endpoints keep the words, the relay keeps the
    // envelope). `sealedText` is kept only for the hash the wire already
    // committed to, which is over what travelled.
    var sealedText = body.text;
    body = Object.assign({}, body, { text: opened.text, sealedText: sealedText, sentAt: opened.at });

    // ── THE REPLAY INDEX (cycle 10's R17 and C2) ─────────────────────
    //
    // HERE, and not earlier, because the deciding number lives INSIDE the
    // seal: `opened.at` is the sender's timestamp, stamped by `seal()`
    // rather than by a caller, and unavailable until this point. In the
    // envelope it would leak and be forgeable.
    //
    // WHY THE RELAY CANNOT DO THIS. A relay refuses a hash it has already
    // registered — but a blob replayed through a DIFFERENT relay meets a
    // guard that has never seen it, because cycle 10's R4 deliberately
    // leaves the relay out of the associated data: binding a message to a
    // road would turn store-and-forward into a routing promise. The
    // recipient is the only party who sees every road.
    //
    // BEFORE AN APP SEES IT. Everything below this delivers, logs and
    // answers; a duplicate that reached an app would have been acted on,
    // and wsl-claude's condition on cycle 10's R4 is exactly that — repeating a note
    // is a duplicate line in a log, repeating something that consumes,
    // mints, spends or toggles is a bug with a credential in it.
    //
    // AGE IS REFUSED BY THE SAME CALL, because the window and the memory
    // are one number (C2). A message older than the index's retention is
    // refused not because it is suspicious but because THE INDEX CANNOT
    // VOUCH EITHER WAY — its hash may already have been swept — and
    // accepting it would be the silent hole the condition exists to
    // close.
    //
    // A NODE WITH NO STORE SKIPS THIS. A relay constructs a peerPost
    // without one (see `opts.store`), and it has no app to protect.
    // ONLY A SEALED POST CAN BE JUDGED. An unsealed one carries no
    // timestamp — `opened.at` is '' — and the index would read that as
    // 1970 and refuse it as older than this node remembers.
    //
    // ── THIS CANNOT FIRE TODAY, AND IS KEPT ANYWAY ──────────────────
    //
    // Said plainly because the first version of this comment claimed the
    // guard had been CAUGHT by queueUnderLoad.js failing. It had not.
    // That suite was red for an unrelated reason — a relay leaked by an
    // interrupted run was holding its port — and the guard was added on
    // a wrong diagnosis. The sentence was invented to explain a change
    // that needed no explaining, which is worse than the change.
    //
    // Reachability, measured: the only `sealsPosts: false` in the tree is
    // relayServer's partner router, and a relay passes no `store`. So
    // wherever a store exists, sealing is required and an unsealed post
    // is refused above, before anything is opened. The third condition
    // never changes the outcome.
    //
    // It stays because the pairing it protects — a store present AND
    // sealing off — is one line of configuration away, and the failure it
    // would produce is silent and total: every post refused as older than
    // this node remembers, on a node whose operator turned sealing off
    // for some other reason entirely.
    if (store && store.replay && seal.isSealed(sealedText)) {
      var verdict = store.replay.seen(hash, opened.at);
      if (verdict !== 'new') {
        note({
          dir: 'in', kind: 'request', peer: body.from, relay: relayUrl,
          hash: hash, outcome: 'refused', code: 'replayed',
        });
        return refuse(relayUrl, id, body, hash, 409,
          verdict === 'again' ? 'this message has already been delivered here'
            : verdict === 'ahead' ? 'this message is dated further ahead than a clock can explain'
              : 'this message is older than this node remembers, and cannot be told from a replay');
      }
      // REMEMBERED BEFORE IT IS DELIVERED, not after. A crash between
      // delivery and remembering would let the same message through twice
      // on restart; a crash between remembering and delivery loses one
      // message and refuses its retry, which is the failure worth having
      // when the alternative is acting on something twice.
      store.replay.remember(hash, opened.at);
    }

    // ── THE FRONT DOOR ───────────────────────────────────────────────
    //
    // A signature proves the sender holds the key they claim. It proves
    // NOTHING about whether this node has ever heard of them, and until
    // 2026-09-12 nothing here asked.
    //
    // The rule existed and was on the wrong transport: hub.js's
    // `listenSet` — "everyone it has actually acquired, plus itself" —
    // was wired to the `inbox` path and nowhere else. Its own comment
    // said "the mailbox needs no exception here", which was true of a
    // path relay traffic never arrived on. This is not that path: a relay
    // posts here in its own name for a device enrolment, so the exception
    // the inbox did not need is one this door does.
    //
    // Andy: "no node, by protocol, should accept requests from unknown."
    // ── LEARNED BEFORE IT IS JUDGED ──────────────────────────────────
    //
    //   Andy: "the node is informed of a new peer, and has a policy that
    //   decides about acquisition. this should not govern the node's
    //   global-cache-updates."
    //
    // The packet is verified by this point, so `body.from` really did
    // send it and it really did arrive through `relayUrl`. That is a
    // route, and it is true whatever this node decides about the person.
    //
    // It used to be learned only when somebody was ADDED — `remember` runs
    // for admit and hold and not for drop — so a node that declined to
    // talk to somebody also forgot where they were. Policy belongs to the
    // address book; the cache is a record of what this node was told.
    if (noteSeen) {
      try { noteSeen(body.from, relayUrl); }
      catch (e) { /* a cache that will not take a row changes nothing here */ }
    }

    var verdict = judge(body.from);

    // THE FLOOR, and it binds before the preference is honoured. An
    // unknown sender over budget is refused outright — including under
    // `acquire`, because what the user consented to was hearing from
    // strangers, not to unbounded strangers.
    //
    // Refused BEFORE the log, and logged without the payload: the record
    // still says truthfully that something arrived and was refused, and a
    // stranger cannot make this node write their bytes to its own disk by
    // sending enough of them.
    if (verdict !== 'known') {
      var bytes = typeof body.text === 'string' ? body.text.length : 0;
      if (!withinFloor(body.from, bytes)) {
        note({
          dir: 'in', kind: 'request', peer: body.from, relay: relayUrl,
          hash: hash, outcome: 'refused',
        });
        // No receipt. A receipt means "this arrived and is filed", and
        // over the floor nothing is filed — saying otherwise would be the
        // one lie this file must not tell.
        return null;
      }
      // WITHIN BUDGET, so now the node may write them down. After the
      // floor and never before: an over-budget stranger leaves no trace
      // but a refusal in the log.
      //
      // WHICH RELAY IT CAME DOWN goes with it. contactBook's `relays` is
      // "mailboxes where you have seen this key", which is the only
      // routing fact this node holds about a stranger — and it was the
      // ring that recorded it until R8 (hub.acquireFromInbox). This path
      // already knew the road; it is on the traffic-log row three lines
      // up. It simply was not passing it on, which nothing caught while
      // both transports were acquiring in parallel.
      // AND FOR A DROP TOO (0021): "ignoring means only: mark this row as
      // ignored". A stranger turned away under Ignore is remembered as
      // turned away — within budget only, like every other mark.
      if (remember) {
        try { remember(body.from, verdict, relayUrl); }
        catch (e) { /* the verdict stands */ }
      }
    }

    // FILED FIRST, ANSWERED SECOND. A receipt says "this arrived", and
    // it must not be able to say so about something that was then
    // dropped on the floor.
    var item = {
      item: 'in_' + (nextItem++),
      hash: hash,
      from: body.from,
      text: body.text,
      at: new Date().toISOString(),
      relay: relayUrl,
    };
    // A DROP KEEPS NOTHING. `silent` is the tightest setting and means
    // what it says: no row, no line kept, and nothing for an app to be
    // handed. The receipt still goes out, below — the bytes did arrive,
    // and a sender who is being ignored is not owed the distinction
    // between "ignored" and "unreachable".
    if (verdict !== 'drop') arrived.push(item);

    // SOMEBODY ELSE'S PACKET, ARRIVING. Logged after it is filed and
    // before the receipt goes out, for the same reason the receipt waits:
    // the record of what arrived must not depend on whether the answer
    // got out. The payload is kept whole and is not looked into.
    //
    // A dropped packet is still logged, and WITHOUT its payload: that
    // something was ignored is this node's own business to know, and
    // keeping the text of a line the operator asked not to keep would be
    // the log contradicting the setting.
    // `admitted` is the field that separates "arrived and filed" from
    // "may be handed to an app". A HELD sender's packet is logged with
    // its payload and is deliberately not admitted: the person is a row
    // waiting to be accepted or blocked, and that is a decision a human
    // makes rather than an app being given the line first and asked
    // after. Without this the log cannot be read back safely, because
    // both look identical as `delivered`.
    var admitted = verdict === 'known' || verdict === 'admit';
    note(verdict === 'drop'
      ? {
        dir: 'in', kind: 'request', peer: body.from, relay: relayUrl,
        hash: hash, outcome: 'ignored',
      }
      : {
        dir: 'in', kind: 'request', peer: body.from, relay: relayUrl,
        hash: hash, outcome: 'delivered', payload: body.text,
        // THE SENDER'S SEALED TIMESTAMP, so the replay index can be
        // REBUILT from this log (cycle 10's C2). Without it a rebuild has
        // the hash and not the window it belongs to, and would either
        // keep rows past their retention or drop them early — which is
        // the silent weakening the condition names. No new disclosure:
        // the log already holds the plaintext (cycle 10's R14).
        sentAt: body.sentAt,
        admitted: admitted,
      });

    // AND THE PEER'S OWN NUMBERS MOVE, on this transport as on the other.
    //
    // countInbound did this on the `inbox` path and nothing did it here,
    // so a node moved onto the router would have stopped counting and
    // said nothing — the figures Contacts shows would FREEZE rather than
    // go to zero, and a stale number looks like the truth while a zero
    // looks like a bug.
    //
    // Keyed by the request HASH rather than by a relay's message id. The
    // id existed because a non-destructive poll could hand the same line
    // twice; nothing re-delivers here, and the hash is over the exact
    // bytes rather than being a number somebody else assigned.
    //
    // Per peer, never per app: the node keys on public keys, and a count
    // of "chess packets from bert" would be this file doing the shell's
    // reading.
    //
    // ── WHO MAY BE COUNTED, and it is not the same as who is ADMITTED ──
    //
    // These are Grok's rules, and they came from the ring's countInbound.
    // R8 deleted that function on 2026-09-15 and `admitted` alone is the
    // wrong predicate to inherit, in both directions:
    //
    //   A HELD SENDER IS COUNTED, and is not admitted. The hourglass is
    //   consideration: a line you dropped unread was still a demand on
    //   your attention, and the count is the only trace `hold` is allowed
    //   to keep. The body is never written anywhere. Counting is not
    //   delivering, and `admitted` is about delivering.
    //
    //   A BLOCKED KEY IS NOT COUNTED, and can be admitted — a blocked row
    //   is not in listenSet, so under the `acquire` policy the front door
    //   says `admit`. Its numbers FREEZE where they stood rather than
    //   falling, and the sidecar stays, because bytesHeld is still
    //   telling the truth about disk really in use.
    //
    //   A STRANGER WITH NO ROW IS NOT COUNTED. A file for somebody the
    //   book does not list would be a hidden second book, which is the
    //   exact thing `silent` is chosen to avoid.
    //
    // ASKED OF THE BOOK AND NOT OF THE VERDICT, which is the part that is
    // easy to get wrong and was got wrong once here already. Gating this
    // on the verdict looks tidier and is a different rule: a person this
    // node is HOLDING, on a node set to `silent`, gets verdict `drop` —
    // the setting is about strangers, and somebody already on the
    // hourglass is not a stranger. Their numbers must keep moving while a
    // human decides, or the row a person is looking at in order to decide
    // says nothing is happening.
    //
    // The floor is the one thing that must skip this, and it does so by
    // returning above: an over-budget stranger leaves no trace but a
    // refusal in the log.
    if (stats) {
      var seen = null;
      try { seen = contactBook.byPublicKey(rootDir, body.from); }
      catch (e) { seen = null; }
      if (seen && !contactBook.isBlocked(seen)) {
        try { stats.noteIn(rootDir, body.from, hash); }
        catch (e) { /* a counter must not break a delivery */ }
      }
    }

    // APPS SEE ADMITTED SENDERS ONLY, and the order is the whole of it.
    // onArrival is app delivery — code running on somebody else's input —
    // so a stranger reaches it only once this node has decided to hear
    // them. `hold` files the packet and tells no app: the person is a
    // waiting row to accept or block, which is a decision a human makes
    // rather than an app being handed the line first and asked after.
    if ((verdict === 'known' || verdict === 'admit') && onArrival) {
      try { onArrival(item); } catch (e) { /* not ours */ }
    }

    // A RECEIPT IS NOT A REPLY, and until now it could only ever be one.
    // This node is always up and can always say "received"; whether
    // anything is home to compose an ANSWER was a different question,
    // and this file answered it by never asking.
    //
    // `answer` is where that question now gets asked. It is handed the
    // item and may give back a string, which travels as the reply's text
    // — the wire has always carried one, and it has always been ''.
    // Anything else, including a throw, leaves the receipt exactly as it
    // was: empty, and meaning only that the bytes arrived.
    //
    // AWAITED, and that is a real cost to have chosen on purpose. A
    // receipt sent at once says "this arrived" as early as it can be
    // said; waiting for an answer delays it. That is right only because
    // the far end is a held connection that wants the ANSWER — being
    // told its request arrived, and then nothing, is not what it is
    // waiting for. An answerer that hangs is holding somebody's browser
    // open, which is the reason this hook belongs to the node's own code
    // and not to anything an app can register freely.
    var receipt = auth.sign(id.privateKey, auth.receiptMessage(hash));
    return Promise.resolve()
      .then(function () {
        // NOT ANSWERED UNLESS ADMITTED. `answer` is what decides a device
        // enrolment, and composing an answer for a sender this node would
        // not hear from would put the front door's judgement behind the
        // one verb that acts on a request.
        if (!answer || (verdict !== 'known' && verdict !== 'admit')) return '';
        return answer(item);
      })
      .catch(function () { return ''; })
      .then(function (said) {
        var text = typeof said === 'string' ? said : '';
        // THE TUNNEL CHECK, ON THE WAY BACK (cycle 2). This node cannot
        // tell whether the request crossed a partnership — it arrives the
        // same either way — so an answer that would not survive being
        // wrapped for the return is not sent. The receipt still goes, with
        // no text: "it arrived, no answer travelled", which is the honest
        // reading of an empty reply. The log records why.
        if (checkTunnel && text && !limits.fitsWrappedReply(text, id.publicKey, receipt)) {
          note({
            dir: 'out', kind: 'reply', peer: body.from, relay: relayUrl,
            hash: hash, outcome: 'reply too big to tunnel',
          });
          text = '';
        }
        // ── AND THE ANSWER IS SEALED TOO (cycle 10, R5) ─────────────
        //
        // Both directions, or the rule is half a rule: an app's answer
        // is as much a person's words as the question was, and a relay
        // that could read every reply would learn most conversations
        // from one side. Sealed back to whoever asked, with the parties
        // in the associated data the other way round.
        //
        // The receipt is signed over the HASH, not the text, so nothing
        // about the receipt changes — which is exactly why the layering
        // puts hashing outside the seal (cycle 10's R11).
        //
        // THE LOG KEEPS THE WORDS (cycle 10's R14). Written from `text` before it
        // is sealed, because the endpoints keep the plaintext and the
        // relay keeps the envelope; a log holding ciphertext would be a
        // record its own owner cannot read.
        var plain = text;
        if (text) {
          var back = sealKeyFor ? sealKeyFor(body.from) : '';
          var wrapped = back ? seal.seal(back, id.publicKey, body.from, text) : null;
          if (!wrapped) {
            // No key for the asker means no answer — never a plaintext
            // one. They reached us, so they hold our card; we may simply
            // not hold theirs yet. The receipt still goes: "it arrived,
            // no answer travelled."
            note({
              dir: 'out', kind: 'reply', peer: body.from, relay: relayUrl,
              hash: hash, outcome: 'refused', code: 'no-cipher-key',
            });
            text = '';
            plain = '';
          } else {
            text = JSON.stringify(wrapped);
          }
        }
        return request(relayUrl, 'POST', '/api/relay/reply', {
          from: id.publicKey, hash: hash, text: text, sig: receipt,
        }).then(function () {
          if (plain) {
            note({
              dir: 'out', kind: 'reply', peer: body.from, relay: relayUrl,
              hash: hash, outcome: 'answered', payload: plain,
            });
          }
          return item;
        });
      })
      .then(function () { return item; })
      .catch(function () { return item; });
  }

  // AN ANSWER CAME BACK. Verified against the key of whoever signed it,
  // which the caller already has from the relay's public roll — so the
  // relay cannot manufacture a receipt for a request nobody answered.
  function onReply(body) {
    if (!body || !body.hash || !body.from || !body.sig) return false;
    if (!auth.receiptSignatureOk(body.from, body.hash, body.sig)) return false;
    // SIGNED BY SOMEBODY OTHER THAN THE TARGET: the relay speaking (cycle
    // 2). A relay that could not deliver, or whose partner refused, tells
    // the asker down the chain with a reply for the same hash signed by
    // itself (relay.relayErrorToAsker). It is never the target's answer
    // and must not read as one: settled as a failure, with the relay's
    // reason, and marked `relayed` so an app can tell who said it.
    // ── AN ANSWER THAT CAME BACK AFTER WE STOPPED WAITING ───────────
    //
    //   Andy: "if a 200 or error arrives late, and the pending label has
    //   vanished, it simply disposes of this reply packet, regardless of
    //   200 or error" — "it needs logging, because in all likelihood relay
    //   A still would block subsequent request."
    //
    // Disposed of, yes. But silently disposed of is how this tree learns
    // nothing: a reply arriving after the wait expired is direct evidence
    // that the budget was too tight, or that a relay is still holding a
    // route this node has given up on and is therefore refusing its next
    // request. That is the one thing the ordering built above cannot
    // prove about itself — only the wire can say whether it holds.
    //
    // SAFE TO LOG because the receipt signature was verified above,
    // before this lookup. A stranger cannot write a row here.
    //
    // HOW LATE IS NOT RECORDED and does not need to be: the outbound row
    // for this hash is already in the log with its own timestamp, so the
    // interval is a subtraction rather than a second clock.
    if (!waiting[body.hash]) {
      note({
        dir: 'in', kind: 'reply', peer: body.from, relay: '',
        hash: body.hash, outcome: 'too-late',
        payload: typeof body.text === 'string' ? body.text : undefined,
      });
      return false;
    }

    var slot = waiting[body.hash];
    if (slot && slot.toKey && body.from !== slot.toKey) {
      var said = null;
      try { said = JSON.parse(body.text || '').body; } catch (e) { said = null; }
      return settle(body.hash, {
        ok: false,
        status: (said && said.status) || 502,
        hash: body.hash,
        error: (said && said.error) || 'the relay could not deliver',
        from: body.from,
        relayed: true,
      });
    }
    // The signature travels up to the caller as well as being checked
    // here. Not because anybody must check it twice, but because a
    // caller that CAN is a caller that does not have to take this
    // module's word for it either — and a test that cannot reach the
    // signature ends up asserting something weaker than it looks.
    return settle(body.hash, {
      ok: true, status: 200, hash: body.hash,
      from: body.from,
      text: typeof body.text === 'string' ? body.text : '',
      sig: body.sig,
      receipt: true,
    });
  }

  // ── WHAT THIS NODE HAD PROMISED BEFORE IT STOPPED (cycle R16) ────────
  //
  // Every entry comes back in its old order, its deadline shifted by the
  // time the node spent down, its attempt count intact. A backoff a peer
  // had earned comes back too.
  //
  // NOBODY IS WAITING ON THEM. The caller that made each post was a
  // request that died with the old process, so each restored entry gets a
  // waiter that goes nowhere — and its outcome still lands where it always
  // did: in the traffic log, which is where a person reads what happened.
  //
  // AND THAT CLOSES A GAP THAT HAD NO NAME. Before this, a node that died
  // mid-send left a "sent" entry in the permanent log with no outcome, for
  // ever. Now every message the log says was sent eventually says how it
  // ended — answered, refused, or "gave up after 1 attempt(s)" when its
  // patience had already run out.
  if (store) {
    try {
      var now = Date.now();
      store.backoff.all(now).forEach(function (b) {
        queue.restorePair(b.relayUrl, b.toKey, toMono(b.untilWall), b.lastWait);
      });
      store.queue.all().forEach(function (row) {
        var body = null;
        try { body = JSON.parse(row.body); } catch (e) { body = null; }
        if (!body) { store.queue.del(row.hash); return; }
        var seq = queue.restoreItem({
          relayUrl: row.relayUrl, toKey: row.toKey, kind: row.kind || undefined,
          at: toMono(row.atWall), until: toMono(row.untilWall),
          attempts: row.attempts, bytes: row.bytes,
          payload: { hash: row.hash, body: body },
        });
        waiting[row.hash] = {
          resolve: function () { /* the caller died with the old process */ },
          relayUrl: row.relayUrl,
          toKey: row.toKey,
          at: row.atWall,
          timer: null,
          seq: seq,
          restored: true,
        };
      });
    } catch (e) { /* a queue that cannot be read back starts empty, as it always did */ }
    // After the factory has returned, so whoever built this has wired it
    // up (a stream to receive the replies on) before the first send.
    setT(function () { pump(); }, 0);
  }

  return {
    post: post,
    onRequest: onRequest,
    onReply: onReply,
    // What arrived while nobody was home, and what is still outstanding.
    arrived: function () { return arrived.slice(); },
    outstanding: function () { return Object.keys(waiting); },
  };
}

module.exports = {
  // DEFAULT_WAIT_MS went with it, for the same reason: exported, and
  // read by nothing in run/ or test/.
  createPeerPost: createPeerPost,
};
