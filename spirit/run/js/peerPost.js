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
// The address book, for one question only: may this key be COUNTED.
// Admission is the front door's answer and arrives as `verdict`; whether
// a sender's numbers move is a fact about the book — see the rules at the
// stats call below, which came from the ring's countInbound.
const whoBook = require('./whoBook');
const nodeCard = require('./nodeCard');

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
// fill a disk": the traffic log keeps 24 hours, so this is what an
// unknown sender may add to it, and 64KB a minute is under 100MB a day
// in the pathological case of somebody spending all of it forever.
var UNKNOWN_BYTES_PER_MIN = 65536;
var UNKNOWN_WINDOW_MS = 60000;

function createPeerPost(opts) {
  opts = opts || {};
  var rootDir = opts.rootDir;
  var request = opts.request;
  var waitMs = opts.waitMs || DEFAULT_WAIT_MS;
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
  var traffic = opts.traffic || null;
  function note(entry) {
    if (!traffic) return;
    try { traffic.note(entry); } catch (e) { /* a witness, never a participant */ }
  }

  // hash -> { resolve, timer, relayUrl, at }
  var waiting = Object.create(null);
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
  function settle(hash, answer) {
    var slot = waiting[hash];
    if (!slot) return false;
    delete waiting[hash];
    if (slot.timer) clearT(slot.timer);
    noteOutcome(hash, slot, answer);
    slot.resolve(answer);
    return true;
  }

  // REGISTER BEFORE YOU FORWARD. The same rule the relay's table enforces
  // by shape, applied one hop earlier: nothing leaves this node until the
  // thing that will match its answer exists. A reply that arrives before
  // the waiter does is a reply with nowhere to go, and the symptom is
  // silence rather than an error.
  function post(relayUrl, toKey, text) {
    var id = me();
    if (!id || !id.privateKey) {
      return Promise.resolve({ ok: false, status: 500, error: 'this node has no identity' });
    }
    if (!toKey) return Promise.resolve({ ok: false, status: 400, error: 'to required' });
    if (typeof text !== 'string' || !text) {
      return Promise.resolve({ ok: false, status: 400, error: 'text required' });
    }

    var message = auth.postMessage(id.publicKey, toKey, text);
    var sig = auth.sign(id.privateKey, message);
    var hash = auth.requestHash(message);

    var answered = new Promise(function (resolve) {
      waiting[hash] = {
        resolve: resolve,
        relayUrl: relayUrl,
        // Kept for the log: the resolving entry has to name who this was
        // with, and by then the caller's arguments are long gone.
        toKey: toKey,
        at: Date.now(),
        timer: setT(function () {
          // Not a failure of the request — a failure to wait for it. The
          // request may still be alive at the relay, and its answer will
          // still arrive and still be matched; the caller simply stopped
          // holding the line.
          settle(hash, {
            ok: false, status: 504, hash: hash,
            error: 'no answer yet', stillOpen: true,
          });
        }, waitMs),
      };
    });

    // THE BYTES LEAVING. Written before the transport is touched, so an
    // attempt that never got out of the building is still on the record —
    // settle() then writes how it ended. Two entries, one hash.
    note({
      dir: 'out', kind: 'request', peer: toKey, relay: relayUrl,
      hash: hash, outcome: 'sent', payload: text,
    });

    return Promise.resolve()
      .then(function () {
        return request(relayUrl, 'POST', '/api/relay/post', {
          from: id.publicKey, to: toKey, text: text, sig: sig,
        });
      })
      .then(function (res) {
        var body = {};
        try { body = JSON.parse(res.text); } catch (e) { body = {}; }
        if (res.status >= 200 && res.status < 300) return answered;
        // The relay refused, so nothing is coming. Stop waiting rather
        // than leaving the caller to time out for a reason already known.
        settle(hash, {
          ok: false, status: res.status, hash: hash,
          error: (body && body.error) || 'refused',
          inFlight: !!(body && body.inFlight),
        });
        return answered;
      })
      .catch(function (e) {
        settle(hash, {
          ok: false, status: 0, hash: hash,
          error: String((e && e.message) || e),
        });
        return answered;
      });
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
      // WHICH RELAY IT CAME DOWN goes with it. whoBook's `relays` is
      // "mailboxes where you have seen this key", which is the only
      // routing fact this node holds about a stranger — and it was the
      // ring that recorded it until R8 (hub.acquireFromInbox). This path
      // already knew the road; it is on the traffic-log row three lines
      // up. It simply was not passing it on, which nothing caught while
      // both transports were acquiring in parallel.
      if (remember && verdict !== 'drop') {
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
      try { seen = whoBook.byPublicKey(rootDir, body.from); }
      catch (e) { seen = null; }
      if (seen && !whoBook.isBlocked(seen)) {
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
        return request(relayUrl, 'POST', '/api/relay/reply', {
          from: id.publicKey, hash: hash, text: text, sig: receipt,
        }).then(function () {
          if (text) {
            note({
              dir: 'out', kind: 'reply', peer: body.from, relay: relayUrl,
              hash: hash, outcome: 'answered', payload: text,
            });
          }
          return item;
        });
      })
      .then(function () { return item; })
      .catch(function () { return item; });
  }

  // AN ANSWER CAME BACK. Verified against the key of whoever signed it,
  // which the caller already has from the relay's public census — so the
  // relay cannot manufacture a receipt for a request nobody answered.
  function onReply(body) {
    if (!body || !body.hash || !body.from || !body.sig) return false;
    if (!auth.receiptSignatureOk(body.from, body.hash, body.sig)) return false;
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
