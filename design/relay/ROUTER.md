# The relay as a router — a peer drops a packet on a peer and gets a receipt

**Status: BUILT, and carrying every direction of traffic in the system.
Verified against `d087375` (2026-09-12).**

> What it turned out to be, once the device arc joined it — the
> measurements, the four directions it carries, and what has NOT been
> shown — is in [TRANSPORT.md](TRANSPORT.md). This document stays the
> design: why it is shaped this way.

Andy: *"it would be AWESOME if peers can drop packets on peers, and simply
get a receipt that it arrived."*

An app addresses another peer as though it were an HTTP server. The relay
carries the request to that peer's node and the answer back, holding
nothing, storing nothing, and — the part that matters — **unable to forge
or alter either one**.

This is [decision 0006](../decisions/0006-fast-and-true-not-guaranteed.md)
implemented, plus a receipt. It is the message stage of
[EVENT-STREAM.md](EVENT-STREAM.md), and it depends on
[PRESENCE.md](PRESENCE.md) being built, which it now is.

---

## 1. The shape

Nothing is held open. Every POST returns at once; every payload rides an
SSE that is already there.

| | |
|---|---|
| **1** | Requester POSTs `{to, body}`, signed. Returns immediately. |
| **2** | Relay verifies the sender, checks the target is **present**, computes `H` over the **exact bytes it is about to forward**, files `H → {requester, target, at}`, and pushes those bytes down the target's stream. **No hash is sent.** |
| **3** | Target computes `H` from what arrived and posts back a signature over it. |
| **4** | Relay looks up `H`, checks **the poster is that request's target**, and pushes the answer down the requester's stream. |
| **5** | Requester computes `H` from what it sent, matches, and verifies the signature against the target's key from `/who`. |

The relay's entire state per request is `hash → {requester, target,
expiry}`. No bodies. Nothing on disk.

## 2. Why the hash is not sent, and why that is the whole proof

The target derives `H` from bytes it actually holds. Had the relay
supplied it and the target echoed it back, the echo would prove nothing.

That gives **end-to-end integrity across the hop**: if the relay altered
the request in flight, the target's hash cannot match the one the
requester computes, and the mismatch is visible to both ends. A public
router you do not have to trust.

**But a hash authenticates nobody.** SHA-256 is a public function and the
relay holds the bytes too, so a bare hash proves only that *somebody with
the bytes* says so — and the relay qualifies.

> **The hash correlates. The signature authorises. They are never the same
> check.**

Which is why the hash goes **inside the signed message** rather than
beside it — attached alongside a signature over something else, the relay
could swap it:

```
receipt\n<requestHash>\n<unix-minute>
reply\n<requestHash>\n<replyHash>\n<unix-minute>
```

The same string-recipe discipline every other verb here uses. No
canonical JSON, ever: **hash the exact bytes on the wire**, and there is
nothing left to agree about.

## 3. A receipt is not a reply

The distinction decides what can honestly be promised.

**A node is always up. An app is not.** A peer's node holds its socket
around the clock; the app that would *compose* an answer is a browser tab
that may be closed.

- The node can **always** sign *"received, filed as item X"* — synchronous,
  and always available.
- The node **cannot** answer *"here is the result of your call"* unless
  something is there to compute it.

So: **HTTP-shaped request, two-stage response.** A signed receipt from the
recipient's *node*, and — if an app has something to say — a reply later,
as its own packet, correlated by the same hash. A receipt is simply the
degenerate reply a node sends when nobody is home.

## 4. The guarantee, stated so it can be relied on

> **The failure is always a false negative, never a false positive.** You
> may be told it failed when it arrived. You can never be told it arrived
> when it did not.

Because the receipt is signed by the recipient, nothing in the middle can
manufacture one. The one genuine inconsistency — the target acks after the
requester has gone, so the sender sees failure while the recipient holds
the packet — fails in that safe direction.

**And the honest limit: the relay still reads everything.** Untamperable
is not confidential. Encryption is a separate arc and must not be implied
by any of this.

### The one way a false positive could have happened

Andy: *"the relay can instantly refuse a request when it already has a
request with the same hash pending. This also prevents false success."*

It does, and the hole it closes is not duplicate work — it is the single
case where the guarantee above could have been broken.

A receipt is signed over `H` **and nothing else**. So if two live requests
ever shared an `H`, one receipt would be a *valid signature* for both. The
relay routing it to the wrong requester would not be caught by anybody:
the signature verifies, the hash matches, and the sender is told its
request arrived when what arrived was somebody else's. A false success,
undetectable at every hop.

Three things stop it, and they cover different windows:

**1. The requester is inside the hashed bytes.** `H` is taken over the
whole forwarded request, which names who is asking — the target needs that
anyway. So two *different* senders cannot produce the same `H` at all, and
the dangerous case is reduced to one sender repeating itself.

**2. A duplicate `H` while the first is pending is refused at once.** The
table is keyed by `H`; a second entry would either overwrite the first —
silently losing a request in flight — or make the routing ambiguous. So it
is refused, and refused *distinguishably*: **"already in flight"** is not
a rejection, and a caller that hears it should wait rather than resend.

**3. Outside that window, the signed minute expires.** A request carries
a minute like every other verb here and is checked ±1, so a captured
request replayed later fails verification before it reaches the table at
all. Without this, a replay after expiry would open a fresh entry pointing
at the replayer — who would then receive the *reply*, not merely a
receipt.

Inside the window, the duplicate check. Outside it, the clock. Across
senders, the hash itself. There is no gap between them.

**A retry is the same case, seen kindly.** A requester that resends
identical bytes while the original is still pending is told "already in
flight" rather than being given a second entry, which is exactly right —
the first one is still going to be answered. After it expires, a resend is
a new request and behaves like one.

## 4b. Register before you forward

Andy: *"every point in the reply chain is responsible for not forwarding a
request, the reply to which it wouldn't know how to match."*

An ordering rule, and the same shape as presence's *authenticate, then
toss*: the safety is in which line comes first.

> **The ability to route the answer is a precondition for accepting the
> question.** A hop registers what it will need to match the reply, and
> only then passes the request on. Never the other way round.

It binds at every hop, and each one has a different way of getting it
wrong:

| hop | must hold before forwarding |
|---|---|
| shell | the app's callback, against this hash |
| personal node | the outstanding hash, and which app is waiting |
| relay | `H -> {requester, target}` filed, before the push |
| target node | nothing to forward — it is the end of the chain |

**Forwarding optimistically is the failure this forbids**, and it is the
worst-shaped one available: a request that can be *answered* but not
*delivered*. The target does the work, the reply comes back, the hop has
nothing to match it to, and the requester simply waits. Nobody errors,
nothing is logged, and the only symptom is silence for the length of
somebody's patience.

**So capacity becomes a refusal reason, not a drop.** A hop whose pending
table is full must say so *immediately* — which turns the cap into honest
backpressure. A box under pressure that refuses is alive and truthful; one
that accepts everything and quietly loses the overflow is lying, and it is
lying in the direction this design spends all its effort preventing.

It also keeps §4's guarantee true hop by hop rather than only at the
relay. A hop that cannot match a reply must never guess which request it
belongs to — guessing is precisely how a false positive would be
manufactured somewhere the relay's signature checks cannot see.

**Worth promoting later.** This is not really a router rule. It applies to
the event stream, to anything with a reply chain, and it is the natural
generalisation of decision 0006 — *deliver or refuse* becomes *accept only
what you can complete*. Left here until a second subsystem needs it, at
which point it belongs in `design/decisions/`.

## 5. Decided

- **Nothing is held open.** No rendezvous, so the 66-versus-60 class of
  bug has nowhere to live. The only clock left is how long a pending entry
  survives — which is *how long the caller will wait*, a UX number rather
  than a protocol constant tuned against another machine's tick.
- **Hash the wire bytes**, not the object.
- **The hash is inside the signed message.**
- **The relay's gate is the pair:** this hash is pending **and** the poster
  is that request's target. Anyone who saw the bytes can compute the hash;
  only the addressee may answer.
- **Peer id is the public key**, never the label (B2).
- **The relay verifies `H` against the bytes it forwards.** Cheap, and it
  stops a junk hash occupying a pending slot — but a convenience only. The
  requester's own check is the authority, or we are trusting the router
  again.
- **A body held in RAM during a round trip is not storage.** Bounded by a
  timeout and a size cap, never written to disk, gone whether it succeeds
  or fails. Said explicitly because it is exactly the sentence somebody
  later mistakes for permission to buffer.
- **A duplicate `H` while one is pending is refused, and that is a safety
  property rather than hygiene** — see §4. It is refused *distinguishably*
  ("already in flight"), because the right answer to it is to wait.
- **Duplicate suppression comes free** at the other end. A request that
  reaches the target twice has the same `H`; the target recognises it and
  re-sends the same receipt rather than doing the work twice. HTTP
  idempotency as a side effect.
- **The forwarded bytes name the requester**, so no two senders can ever
  produce the same `H`.
- **A request carries a signed minute**, checked ±1 like every other verb,
  so a captured request cannot be replayed once its pending entry is
  gone.

## 6. Stages

None of this needs the shell. The whole arc is node-to-node and testable
in `labWorld` (Andy).

### Stage 1 — the nonce

`packet.js` already mints an `id` unique per send, inside the envelope,
inside `text`, inside the signed message — so **the field this design
needs already exists and is already in the right place.** It is only the
source that is wrong: `Math.random`, 64 bits.

Under the router that stops being harmless. The hash becomes a routing
key, so a predictable id is a predictable hash; it becomes a nonce in a
security construction; and a predictable sequence lets an observer count
and correlate traffic.

CSPRNG, 128 bits, isomorphic. **No wire change** — the field is already
there — so it ships alone and cannot break anything.

*Done when:* ids come from `crypto.randomBytes` / `getRandomValues`, two
thousand of them are distinct, none repeats across a process boundary, and
`opts.id`/`opts.random` stay injectable so exact-string tests are
untouched.

### Stage 2 — the relay routes

`POST /api/relay/post` and `POST /api/relay/reply`, the pending table, the
gate of §5. Capped, expired, rate-limited per sender.

**This deliberately opens the fence** `PRESENCE.md` §6 put around the
wire, and `presenceStream.js` asserts that fence — *"only roster and
presence events were ever written."* That test must be changed as a
conscious act with a line here, never quietly. It is doing the job it was
written for.

*Done when:* two lab peers exchange a request and a receipt; a reply from
anyone but the target is refused; an altered forward is caught by the
requester; an absent target is an immediate error, not a wait.

### Stage 3 — the node speaks it

The node's side: post a request, keep outstanding hashes, verify receipts
against `/who`, file what arrives with a mailbox-item id, and answer with
a receipt when no app is home.

### Stage 4 — an app uses it, with no browser in sight

A `labWorld` suite: peer1 posts to peer2, peer2's node receipts, peer1
verifies. Real processes, real relay, real sockets, no shell.

## 7. Out of scope

- **Confidentiality.** The relay reads everything; this changes only
  whether it can lie about what it read.
- **Replacing `send`.** The stored-message path stays until this one is
  proved.
- **The shell/app API.** Stage 4 proves the mechanism without it.

## 8. Open

- **How long does a pending entry live?** A UX number. Needs one answer
  and a way for a caller to say "less".
- **What is the size cap on a routed body?** `packet.js` caps its envelope
  at 1024 bytes, which is a chat message, not an API call. If this is to
  feel like HTTP, that number has to be revisited — and it is the number
  that decides the relay's memory exposure.
- **What does a node do with a request nobody is home to answer?** It
  receipts and files it. Whether an app later answers a request it was not
  awake for — and whether the requester is still interested — is Stage 3's
  question and is not answered here.
