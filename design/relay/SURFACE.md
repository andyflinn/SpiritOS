# Everything is a post — reducing the relay's surface to one door

**Status: opened 2026-09-17 against `833d5d4`. Partly built.**

| | |
|---|---|
| **built** | `GET /api/relay/key` (§8) — the census is out of key-learning |
| **built** | three census readers deleted outright: `peer.candidates`, `peer.find`, `relay.roster` |
| **built** | `handlePartnerCheck` narrowed to `?key=`; `device.html` asks the relay nothing |
| **design** | 2a, 2b, 2c, 2d — and 2a is now optional, superseded for its own caller by the key door |

Three census readers remain: `peer.list`, `ownerBadge.probe`, and
`handlePartnerCheck`'s refusal path. All three want lists, so they are the
selector-and-paging job, not a parameter.

This note is about the *shape* of a relay's interface, not what travels on
it. The mechanism is [TRANSPORT.md](TRANSPORT.md); the byte-level packet is
[ROUTER-PACKETS.md](ROUTER-PACKETS.md); the held connection is
[EVENT-STREAM.md](EVENT-STREAM.md) and [PRESENCE.md](PRESENCE.md). Nothing
here repeats them.

It arrives at one sentence, and the whole value is that the sentence has no
*except* in it:

> **GET on a relay is for static files. Everything else is a post.**

Decision [0010](../decisions/0010-fix-the-protocol-or-name-the-cheat.md)
states that rule today with **three granted exceptions**. This note is the
case that all three can go, and what each costs to remove.

### Why it is forced, not merely tidier

> **Andy:** *"the census gets are on our shooting list too — because they
> cannot withstand 1000 entries."*

`PAYLOAD_MAX` is 16384 ([limits.js:70](../../spirit/run/js/limits.js#L70)).
A census row measures 151 bytes
([boundedByTime.js](../../spirit/test/boundedByTime.js)), so a thousand
members is **~147 KB — nine times the ceiling.**

So `GET /api/relay/who` cannot become a post while it answers with
everybody: **its reply does not fit in one.** The narrowing is not a
preference, and it has to land *before* the demotion rather than after. Every
caller must name what it wants — its own row, some keys, or a search with
slots — and the one caller that genuinely wants a list (`handleRoster`) has
to become bounded the way search already is
(`MATCH_BUDGET = PAYLOAD_MAX - 512`, `bucket.serialize(map, maxBytes)`).

This is also what makes §2 urgent rather than elegant: the exceptions are not
merely inherited, they are **load-bearing for a shape that stops working at a
thousand members.**

---

## 1. Where the surface is today

Everything reachable from the internet on a relay, at `833d5d4`
([server.js:920-944](../../spirit/run/js/server.js#L920-L944)):

| | | |
|---|---|---|
| `GET` | the brochure, the key-addressed device page | files |
| `GET /api/relay/key` | who this relay is — 97 bytes, flat | **granted exception** (added 2026-09-18) |
| `GET /api/relay/who` | the public census | granted — **warrant handed to `key`**, three readers left |
| `GET /api/relay/stream` | the held connection | **granted exception** |
| `GET /api/version` | build facts | **granted exception** |
| `POST /api/relay/claim` | enrol | outside by nature — you cannot post to a relay you have no row on |
| `POST /api/relay/device` | a browser with no identity yet | outside by nature |
| `POST /api/relay/post` · `/reply` | the router — signed, addressed by key | the protocol |

The node reached this shape already, on 2026-09-15
([server.js:1379-1420](../../spirit/run/js/server.js#L1379-L1420)):

> **THE LOOPBACK CLIENT API — ONE DOOR, VERBS IN THE BODY.**
> Andy: *"Do we maximally fold as much as possible into one single
> interface (route)?"* … Twelve routes, seventeen verbs, six namespaces,
> and nothing on this node answers a path any more except the stream and
> the version.

**So the relay is one cycle behind its own node.** The four moves below are
that cycle.

The measured route hierarchy for both servers is
[spiritNodeAPI.md](../andy/spiritNodeAPI.md) — illustration, no argument —
and its relay half is what these four moves rewrite. **Andy remeasures it
when the migration lands**, so treat it as the picture of the world before
this note, not as a spec to build against. (Its relay section is unchanged
from `25489ab` and says so; the `isRelayPublicPath` anchor has since moved
from `server.js:680` to `server.js:902`.)

---

## 2. Decided

### 2a. `claim` carries the relay's key

`POST /api/relay/claim` is public, needs no key, and is permanently outside
the post rule by 0010's own reasoning. It answers
`{ ok, status: 201, peer, owner }`
([relay.js:1152](../../spirit/run/js/relay.js#L1152)).

**Add `relayPublicKey` to that response.** The key then arrives with the
row, and the census stops being where a node learns it — which is the *only*
justification `GET /api/relay/who` has ever had:

> *it is where a node learns the relay's KEY. You cannot post to an address
> you are still asking for.* — 0010

A `409 key already claimed` already returns the peer row, so it can carry
the key too: that covers a node whose pin was lost but whose row survives
(restored backup, wiped `relay-state`). The key is public, so this reveals
nothing; it does mean a stranger must make a *valid-looking* claim to read
it, where today they need only `curl`.

### 2b. The route broadcast carries the announcing relay's key

A relay already broadcasts `('route', { key, at })` to its members. `at` is
a relay URL; there is no key for the relay itself, so a node that wants to
reach that box must still bootstrap against it.

**Carry the relay's key beside the peer's.** Then a partner relay's key
arrives:

- over a connection the node has already authenticated
- vouched by a relay the node already trusts

which is strictly better than trust-on-first-use over an unsigned GET, and
is Andy's *"the partnership contract includes mutual vouchery"* doing work
rather than being asserted.

Under [ROUTE-DISCOVERY.md](ROUTE-DISCOVERY.md) this is the path that
matters: today, meeting a stranger relay costs its **entire membership** to
learn 44 bytes of key — the cost of learning a key is a function of the far
relay's population, which is a [0013](../decisions/0013-a-relay-is-fixed-cost-per-time-unit.md)
violation on the reading side.

### 2c. `version` becomes a file

`VERSION`, `BUILD.commit`, `BUILD.dirty`, `BUILD.at`, `BUILD.source`,
`BUILD.untracked` are all fixed at boot
([server.js:1156-1168](../../spirit/run/js/server.js#L1156-L1168)). Only
`startedAt` is process state, and the deploy check it exists for does not
need it.

Write it at boot. It is then a **static file**, in the brochure, and stops
being an API exception at all.

### 2d. The stream becomes a verb pair

The largest move, and the one that removes the last HTTP dependency.

**`stream.initialize()`** — Andy's spelling, and it is the right one,
because a constructor's return value *is* the object. 0010 says *"you cannot
post to open the channel that carries the answer"*; that is a statement
about request/response pairing, and a constructor is not one. The sentence
was never wrong, it just never applied.

- an ordinary peerPost, addressed to the relay's key like `removePeer` and
  `partners` already are ([hub.js:2101](../../spirit/run/js/hub.js#L2101))
- **the body is the constructor's arguments** — the identity token and
  whatever the stream needs to come up. **Not route couplets**: a hint
  answers *"which partner do I tunnel this through?"*, and this post
  terminates at the relay, so there is nothing to route and nothing to hint
  about. See the hints item in §8 — they are siblings of a routed packet,
  always, with no exception here
- **the response is the stream**, not a receipt. One branch in one handler:
  the post that is a constructor takes over its own response

**`stream.close()`** — the destructor, and it is not redundant with socket
teardown. `sinks[id]` is freed only when a socket dies, and a half-open
socket does not die ([sseClient.js:50-57](../../spirit/run/js/sseClient.js#L50-L57));
`presence.js` has no heartbeat and no timeout by design
([presence.js:12-16](../../spirit/run/js/presence.js#L12-L16)).

What the call buys that teardown cannot is **intent versus loss**:

| | |
|---|---|
| clean close | broadcast absence now, free the slot now |
| dropped socket | hold the presence *bit* for a grace period — sseClient retries in 1–8s ([sseClient.js:43](../../spirit/run/js/sseClient.js#L43)) |

Today those are the same fact, so a relay restart flickers every member's
roster. A grace period is only affordable once departure and reconnect can
be told apart.

**The client already makes that distinction and has never shared it.**
`stopped` is set in exactly one place —
[sseClient.js:331](../../spirit/run/js/sseClient.js#L331) — and every other
path goes to `scheduleRetry`. So clinginess is *already* conditional on
intent; the relay has simply never been told. The change:

```
handle.close()
  → POST stream.close()   signed, best-effort
  → stopped = true        already there — no retry fires
  → abort the socket      already there
```

**Post before abort**, or the FIN beats the post and the relay spends a
grace period on a departure. Harmless — `disconnect(id, sink)` is idempotent
and sink-checked ([presence.js:127-137](../../spirit/run/js/presence.js#L127-L137))
— but the grace is the thing this exists to save.

`stream.close()` resolves to the sender's own identity like every post, so
it can only close the caller's own stream.

---

## 3. What comes free

Because the stream is an ordinary post, not a special one:

- **the budgets already cover connections.** The gate resolves the sender
  and charges the member pool or the partner pool ([CAPACITY.md](CAPACITY.md)).
  No per-connection accounting to invent.
- **there is nothing extra to bound at connect time.** The constructor
  carries the identity token and no route table, so the existing payload
  rules apply unchanged (§8, route hints).
- **the partner branch disappears.** `partnerLink.js` dials
  `/api/relay/stream?key=` today ([partnerLink.js:48](../../spirit/run/js/partnerLink.js#L48))
  — a second path to the same thing. A partner opens its stream with the
  identical post a member uses, which is [PARTNERS.md](PARTNERS.md)'s
  one-protocol rule arriving rather than being asserted.
- **`streamSignatureFrom` is deleted** ([relay.js:3399-3405](../../spirit/run/js/relay.js#L3399-L3405)),
  with its export, its call site, and most of what `streamSig.js` guards.
  Not because its rule becomes unenforced — because **there is no second
  signature path left.** One check, peerPost's, for everything a relay is
  ever told.
- **`X-Spirit-Sig` goes with it.** See §5.

---

## 4. Kept loud: the capacity surface

The mechanism is hidden from the register. **It must not be hidden from the
meter.**

A held connection is the most RAM-expensive thing a member can ask for, and
[0013](../decisions/0013-a-relay-is-fixed-cost-per-time-unit.md) ranks RAM
as the expensive resource. The hazard of folding the stream into the
ordinary post vocabulary is that it inherits the ordinary post's treatment:
metered as ~200 bytes once, receipted, forgotten — the governor losing sight
of connections at the moment they become the dominant cost.

So the split is the condition of the change:

- **protocol surface** — one registered verb, no special door
- **capacity surface** — still a connection: counted in the stock limit,
  ranked for shedding, never charged as a single post's bytes

`new` is ordinary syntax and still the thing that allocates.

---

## 5. Why this is worth more than tidiness

> **Andy:** *"we do reduce as much as possible, it makes other transport
> protocols more feasible."*

A peerPost already signs **in the envelope**, not a header
([peerPost.js:289](../../spirit/run/js/peerPost.js#L289)):

```js
{ from: id.publicKey, to: toKey, text: text, sig: sig }
```

**The stream is the only part of the protocol that knows what HTTP is.**
`X-Spirit-Sig` exists solely because a GET cannot carry a body. Fold the
stream and the last transport dependency goes with it.

What remains, and how each survives a carrier change:

| still HTTP-shaped | elsewhere |
|---|---|
| the path `/api/relay/post` | an address — every carrier has one |
| the method `POST` | nothing. With one door there is no method to choose |
| status codes | already decoration — `{ ok, status, error }` in the body is the authority |
| SSE `event:` / `data:` framing | native on WebSocket/QUIC. Frames bytes, not meaning |

Leaving the protocol statable without naming a transport:

> **A signed envelope, addressed by key, carrying `namespace.verb`, answered
> on a channel the first envelope created.**

`stream.initialize()` generalises *better* than a GET door for the same
reason: over WebSocket the constructor and the channel are natively the same
object. The shape adopted here for tidiness is the one other transports
already have.

---

## 6. The test surface becomes the protocol surface

> **Andy:** *"test can do `require('relay')` conceptually and hammer the
> api."*

Half of this is already true. Seventeen suites drive `relay.js` in-process,
and the stream is among them — `presence.js` made the sink an interface on
purpose (*"anything that can be written to and closed, which is a response
object in production and an object with two functions in a test"*), so
[boundedByTime.js:143](../../spirit/test/boundedByTime.js#L143) opens
streams with an array as the socket.

**What the fold adds is that the two stop being different shapes.**

| | |
|---|---|
| in-process today | `box.claim(name, sig, key, clientKey, token, handle)` — positional |
| on the wire today | `POST /api/relay/claim`, a JSON body, parsed and dispatched in server.js |

So a suite hammering `box.claim()` asserts the relay's **internals**, not its
**protocol**, and the handler layer is reached only by the twenty suites that
spawn a real port. That gap is how `deviceAuth.js` rotted: it asserted
functions that existed while the wire had moved, and nothing noticed for four
days ([runAll.js:100-117](../../spirit/test/runAll.js#L100-L117)).

One door with verbs in the body collapses the gap. What a test calls *is*
what the wire carries — same envelope, same verb, same signature — and the
handler becomes an adapter with nothing in it worth asserting. A green
in-process suite would then mean the wire works, which today it does not.

Two consequences worth planning for:

- **it reverses the lab-suite trade.** The harness went from ~25s to ~90s to
  bring the port-spawning suites in
  ([runAll.js:62-88](../../spirit/test/runAll.js#L62-L88)) — *"more pain now,
  cleaner environment later."* Many of those twenty exist only because the
  shapes differ.
- **it isolates the carrier risk.** Everything except the transport becomes
  in-process, so the live test stops being *"does the protocol work"* and
  becomes one question with no protocol in it: **does a POST whose response
  streams survive the proxy?** A stub and a curl, answered once, and reusable
  for every future carrier (§5).

---

## 7. Recommended, not decided

**Namespace the relay's verbs.** The node says `fs.*`, `jobs.*`, `net.*`,
`peer.*`, `contact.*`, `device.*`, `relay.*`. The relay says bare keys in a
body — `{ removePeer }`, `{ relayLabel }`, `{ partners: true }`,
`{ search }`, `{ forward }`. Symmetry here is not invention; it is the relay
adopting the convention its own node already uses. `stream.initialize()` is
already that shape, which is why it reads right.

**Give `protocolSurface` a fifth column.** It compares four registers —
signed formats, relay routes, stream events, owner-event kinds
([protocolSurface.js:237-240](../../spirit/test/protocolSurface.js#L237-L240))
— and **relay verb kinds are not among them.** Adding `stream` as a payload
kind would today be invisible to the harness: exactly the blindness that let
an eighth stream event in unnoticed, because *"the door had not changed."*
A namespaced verb list is something the register can compare against; a bag
of loose keys never was.

These two are one job. Do them before the verb vocabulary becomes the place
everything lives.

---

## 8. Open

- **Caddy and a POST whose response streams.** Intermediaries buffer POST
  responses more eagerly than GET. This cannot be settled by reading — it
  wants a probe against the live boxes, not a fixture. **It is the one thing
  that could sink 2d**, and by §6 it is also the only thing the harness
  cannot answer in-process.
- **Half-open is still unsolved**, and `stream.close()` does not solve it. A
  killed VM never calls close either. That needs write-failure detection or
  a heartbeat, and `presence.js` refuses a heartbeat by design — the refusal
  is good, so the answer is probably the former.
- **The restart re-check is lost.** `answerRelay.relayKey` re-fetches once
  per process and compares to the pin
  ([answerRelay.js:142-144](../../spirit/run/js/answerRelay.js#L142-L144)).
  With no door there is no re-check. Assessed as a small loss: it compared
  against an **unsigned** source, which anyone able to substitute a relay
  can also forge. The real detector is that every signed exchange fails when
  the key has changed — so the work is to *name* that failure to a person
  (which `onKeyChanged` was built for and never wired) rather than swallow
  it as "relay down". Evidence beats a poll, but it has to actually be
  built.
- **Grace-period length** for a dropped socket. Bounded below by sseClient's
  1–8s backoff; nothing yet says what it should be.
- **`ownerBadge.probe` polls boxes this node has no row on**, and its own
  note says that is the point — *"a question asked on a timer against every
  URL in relays.json, including boxes this node has no relationship with"*
  ([ownerBadge.js:428-431](../../spirit/run/js/ownerBadge.js#L428-L431)). A
  signed post needs a row, so that case has no post form.

  **Recommended: it rides the streams instead, and stops being a poll.** The
  node already holds a stream to every relay it has a row on —
  `urls.forEach(openTo)` ([presenceNode.js:313](../../spirit/run/js/presenceNode.js#L313)).

  | | how the badge learns it |
  |---|---|
  | on it | the stream — row, ownership and roster arrive on connect |
  | evicted | `streamOpen` refuses `no such identity` (403), immediately rather than within 30s |
  | never joined | a local fact; no request at all |

  Strictly better than the poll, and it *deletes* a per-relay request rather
  than converting one — a 0013 win in passing. What it changes is what Natter
  shows for a listed-but-unjoined relay, which is a UI call, not a protocol
  one. `natterCheckBinding` depends on the current distinction (*"`status > 0`
  is the test — NOT `!error`, because probe sets `error: 'no row here'` on a
  relay that answered perfectly well"*) and must move with it.
- **Where the envelope sits, and who pays for a protocol field.**

  > **Andy:** *"the MAX_PAYLOAD_SIZE excludes signatures, hashes and
  > route-hints."*

  **This is already the design, and the tree says so** — an earlier draft of
  this note claimed otherwise and was wrong:

  > PAYLOAD_MAX is the PACKET — the encoded envelope, which is what packet.js
  > and MAX_ROUTED_TEXT both measure. **`from`, `to` and `sig` sit OUTSIDE
  > it** and are covered by WIRE_HEADROOM in BODY_MAX, so they must not be
  > subtracted here. **Doing so once reserved room inside the packet for
  > things that are not in it.**
  > — [relay.js:57-64](../../spirit/run/js/relay.js#L57-L64)

  So the sender's packet is 16384, and one signed wrapper is absorbed by
  `BODY_MAX = PAYLOAD_MAX + WIRE_HEADROOM`
  ([limits.js:100](../../spirit/run/js/limits.js#L100)). The word *envelope*
  means the packet in limits.js and the signed wrapper in relay.js, which is
  most of how the earlier reading went wrong.

  **A ceiling change does not fix the tunnel** — see the next item; headroom
  cannot reach across the re-wrap. Route hints are a separate matter and sit
  outside the packet entirely — see below.

  Census rows per packet is ~105 either way, so paging `handleRoster` lands
  in the same place, and the nine-times argument in §1 is unaffected.
- **Tunnelling costs a second envelope, and the budget has not paid for it.**

  > **Andy:** *"because of tunneling we'll lose another 512 bytes or so."* —
  > *"a node client doesn't know if its packets will be tunneled or not, so
  > that loss must be anticipated on any route."*

  The tree confirms the cost: `carryToPartner` nests the inner
  `{from,to,text,sig}` inside `{ v:1, body:{ forward: … } }` and hands that
  to `askPartner`, which signs it in its own right
  ([relay.js:1993-1998](../../spirit/run/js/relay.js#L1993-L1998)). Two full
  envelopes, two overheads, and `MATCH_BUDGET` reserves for one.

  Two things make the reservation unavoidable — though not, as it turns out,
  a constant:

  - **One hop and no further** ([PARTNERS.md](PARTNERS.md)) bounds the
    nesting at two, so exactly one re-wrap has to be paid for. Open-ended
    hops could not be budgeted at all.
  - **Nobody who composes knows whether it will be tunnelled.** The same
    packet goes direct to a local peer and wrapped to a partner's, and the
    same search reply likewise. Reserve for one wrapper and it fails **at the
    far hop, after signing** — a signed payload cannot be truncated to fit,
    so there is no graceful degrade. It presents as: works locally, fails
    only across a partnership, only for large payloads. Precisely the class
    the headroom decision exists to prevent (*"looks like an outage rather
    than a limit"*).

  **Re-wrapping converts overhead into payload**, which is why no ceiling
  change can absorb it.

  `WIRE_HEADROOM` sits *outside* `PAYLOAD_MAX` and covers one wrapper's
  `from`/`to`/`sig`. But the tunnel puts the inner packet's **entire
  serialised form** — headroom bytes included — into the `text` of the outer
  packet: `askPartner(url, relayKey, wrapper)` becomes
  `partnerRouter.post(url, relayKey, text)`
  ([server.js:40-43](../../spirit/run/js/server.js#L40-L43)), and `text` is
  exactly what `MAX_ROUTED_TEXT = limits.PAYLOAD_MAX` bounds
  ([relay.js:53](../../spirit/run/js/relay.js#L53)). Raising `BODY_MAX` only
  lets the socket accept bytes the packet check then refuses: an inner packet
  at 16384 reaches the partner as ~16650 of routed text and 413s there.

  So the reservation belongs on **the sender, on every route** — and it
  cannot be a constant.

  **The cost is proportional, because the inner packet is escaped.** It goes
  into the wrapper as a JSON *string*, so every `"` becomes `\"`. Measured
  at the cap:

  Measured at the cap:

  | inner packet | quotes | growth on re-wrap |
  |---|---|---|
  | one long authenticated message | 22 | **263** |
  | authenticated batch (per-item `from` + `sig`) | 1094 | **1335** |
  | search reply (rows of short fields) | 1970 | **2211** |
  | all-quotes (adversarial) | 7908 | **16049** |

  > **Andy:** *"chat had no authentication to speak of."*

  Which names the driver. Adding auth fields to a *single* long message
  barely moves it — one text field dominates the bytes and the quote count
  stays low. But **authentication is what makes a payload quote-dense**:
  every key, signature and hash is a quoted string, so anything carrying
  *per-item* proof pays per item. That makes the expensive case the normal
  one going forward, not an edge — **route couplets are exactly that shape**,
  quoted key and quoted URL and nothing else, so a hint block re-wraps about
  as badly as a search reply.

  So `PAYLOAD_MAX - 512` covers a long single message only; `- (512*2)` is
  still short for a search reply, short again once couplets land, and
  trivially defeated on purpose.

  **It cannot be dodged by nesting the inner packet as an object** instead of
  a string: the signature covers the exact bytes, and
  [0011](../decisions/0011-the-hash-is-computed-never-carried.md) requires
  the hash to come from bytes at every party. Re-parsing and re-serialising
  breaks the thing the signature was over.

  **Recommended: a predicate, not a constant.** A node cannot know whether it
  will be tunnelled, but it can compute what its packet *would* weigh if it
  were, from fields it already holds:

  ```js
  function fitsWrapped(packet, from, to, sig) {
    return JSON.stringify({ v: 1, body: { forward: { from: from, to: to, text: packet, sig: sig } } })
      .length <= limits.PAYLOAD_MAX;
  }
  ```

  Exact rather than estimated — the same discipline that made
  `WIRE_OVERHEAD = 246` measured — and it charges by actual shape:

  | | under `- (512*2)` | under the predicate |
  |---|---|---|
  | one long message | 15360 | **~16120** — loses 263, not 1024 |
  | authenticated batch | 15360, **413s** | ~15050, and it arrives |
  | search reply | 15360, **413s** | ~14170, and it arrives |
  | quote-stuffed | 15360, **413s** | refused at compose, honestly |

  The constant is wrong in both directions at once: it overcharges the case
  that costs 263 and undercharges every case that carries per-item proof.

  `MAX_ROUTED_TEXT` applies the same check at the relay, so the browser
  pre-check stays true to what the relay enforces
  ([limits.js:110-112](../../spirit/run/js/limits.js#L110-L112)).

  **Then check `MATCH_BUDGET = PAYLOAD_MAX - 512`**
  ([relay.js:2101](../../spirit/run/js/relay.js#L2101)). It subtracts exactly
  what the comment ten lines away says must not be subtracted. Either it
  reserves for the packet's own structure — legitimate, a different thing —
  or it is the residue of the error that comment was written about, in which
  case search has been 512 bytes short all along and the fix is a deletion
  rather than a doubling. Resolve it before either number moves.

  **Not a live bug, and the trigger is exact.** `atRelayKey` is the one
  argument nothing on the wire supplies — *"the public route calls this with
  four arguments"*
  ([relay.js:2607-2617](../../spirit/run/js/relay.js#L2607-L2617)) — so
  `carryToPartner` is unreachable from outside today. The doubled subtraction
  belongs **in the same commit that adds the `atRelayKey` wire field**, which
  is what turns a reserved-for-one budget into a reply that cannot be
  delivered. Landing it earlier would shrink every search result by 512 bytes
  for a path nothing can take.
- **Route hints are siblings of the packet, never contents of it.**

  > **Andy:** *"routing hints in a peerPost() must be stripped before
  > routing, because they're useless on the other side, and would blow the
  > payload budget to smithereens."*

  Stripping is mandatory, and it decides where they live: **a field cannot be
  removed from a signed packet.** The signature covers `from`/`to`/`text` as
  bytes ([relay.js:1983](../../spirit/run/js/relay.js#L1983)), and
  [0011](../decisions/0011-the-hash-is-computed-never-carried.md) requires
  the hash to be derived from those bytes at every party. Anything inside
  `text` is load-bearing for the far end's verification.

  So:

  ```
  { from, to, text, sig, hints, hintSig }
         └── signed as one unit ──┘   └── separate, and droppable ──┘
  ```

  The first relay verifies `hintSig`, consumes the hints, and forwards
  `{from, to, text, sig}` byte-for-byte. The tunnel wrapper carries what it
  carries today; the far peer never sees a hint it has no use for.

  - **Hints never enter the payload budget.** Outside the signed packet and
    dropped at the first hop, so they are never re-wrapped and never escaped.
    Their own bound belongs beside the frame ceiling, not inside
    `PAYLOAD_MAX`. (An earlier draft of this note proposed a third budget
    *inside* the packet; that was wrong.)
  - **This is what "PAYLOAD_MAX excludes signatures, hashes and route-hints"
    was describing** — a structure, not a proposed split. `sig` and `hints`
    are alike in being what a hop *consumes* rather than carries.
  - **`hintSig` is not optional.** The relay acts on hints — fans out on
    them, caches routes from them — so an unsigned hint block is a forgeable
    route claim, which is the harvest vector left open in
    [ROUTE-DISCOVERY.md](ROUTE-DISCOVERY.md). Signed separately, a hint block
    is attributable to whoever offered it.

  **And there is no bulk form.** An earlier draft had the couplets riding in
  `stream.initialize()`, which would have made hints a payload in one place
  and a sibling everywhere else.

  > **Andy:** *"stream.open() will never carry route-hints, because they have
  > no use — it's only one hop to the relay."*

  A hint answers *"which partner do I tunnel this through?"*, so it is
  meaningful only attached to a packet that needs routing. The constructor
  terminates at the relay. One shape, one lifetime, one place they are
  stripped — and four consequences worth having:

  - **nothing to budget at connect time.** No couplet block, no interaction
    with `PAYLOAD_MAX`, no third bound.
  - **the relay caches what it used**, not what it was handed. A contact list
    can be enormous; the routes exercised in a session are few.
  - **freshness is per-use.** A table uploaded at connect is stale by
    definition and has no revalidation story.
  - **0013 holds more cleanly** — the relay's cost tracks traffic rather than
    the size of somebody's address book, which is the *"a function of
    anything other than time"* test exactly.

  What it gives up is pre-warming: the relay cannot cull and verify a batch
  before being asked. That was speculative RAM for routes that might never be
  used, which 0013 disfavours anyway. Verify-and-cull still happens — at the
  moment of the fan-out it prevents, on the one route in question.
- **Ordering.** Narrowing comes first — see "Why it is forced" above; a
  whole-census verb cannot be delivered. 2a and 2c are independent and cheap.
  2b needs the route
  broadcast shape from [ROUTE-DISCOVERY.md](ROUTE-DISCOVERY.md). 2d now needs
  only the Caddy test — dropping the couplets out of the constructor removed
  its other dependency. `GET /api/relay/who` cannot be
  demoted to a post until 2a and 2b have landed and its remaining callers
  have moved — **doing it the other way round breaks bootstrap to fix
  bootstrap.** **Six are left** (eight on the morning of 2026-09-17):

  | fetch | wants | status |
  |---|---|---|
  | ~~`answerRelay.relayKey`~~ | one envelope field | **moved to `GET /api/relay/key`, 2026-09-18** — see below |
  | `handleWho` (`peer.list`) | the address book | paging or search. Two app callers |
  | `handlePartnerCheck` | the owner row | **narrowed 2026-09-17.** Pays one whole census only to name the other owner when it refuses |
  | `ownerBadge.probe` | its own row **and** the roster | **cannot narrow** — see below |
  | ~~`device.html`~~ | a label for one sentence | **stopped asking, 2026-09-17** — see below |

  So four still read the census whole on the happy path.

  ### `GET /api/relay/key` — built 2026-09-18

  > **Andy:** *"the first two are easily replaced with `GET /api/relay/key`
  > or whatever."*

  The two being `frontDoor`'s *"is this sender a relay?"*
  ([hub.js:564](../../spirit/run/js/hub.js#L564)) and `handleSearch`'s
  *"which key do I address this box as"*
  ([hub.js:1929](../../spirit/run/js/hub.js#L1929)). Both need a **pin**, and
  the pin was being derived from the whole census, once per relay per node
  boot.

  ```
  GET /api/relay/key → { "relayPublicKey": "…", "relayLabel": "…" }
  ```

  **97 bytes, and flat** — `relayKeyDoor.js` measures it at 13 members and at
  201 and gets the same number, against 30,349 bytes of census at 201. That
  flatness is what earns the exemption under
  [0013](../decisions/0013-a-relay-is-fixed-cost-per-time-unit.md); the
  census fails the test.

  **This supersedes §2a for this caller.** The plan had `claim` carrying the
  key. Both are trust-on-first-use, so neither is more secure — the door is
  simply simpler, works at *every* moment rather than only at claim, and
  needs no `409` special case for a restored backup. 2a may still be worth
  doing for its own reasons; it is no longer load-bearing here.

  **No fallback to the census, deliberately.** One was written and cut the
  same hour: *"the suite asserts the order — small door first, or else
  fail."* A fallback is a path nobody exercises (four such were deleted the
  day before), and — the reason that settles it — **a fallback is a
  reader**: while anything reaches for `who`, the census has a caller that
  is not a list and cannot be demoted. The cost is a deploy order,
  **relay before node**, and it is visible rather than quiet: an unpinned
  relay is reported `silent` by search.

  **And one thing was overreached and backed out**, recorded because the
  reasoning was wrong in an instructive way. `relayKey()` was also made to
  skip the lookup entirely when a pin exists — zero requests in steady
  state — on the argument that the re-check compares against an unsigned
  source and so catches nothing an attacker could not forge. True of an
  attacker, who can echo the pinned key back. **Not true of a legitimately
  rebuilt relay**, which answers honestly with a new key and which the check
  is the only thing that notices. `answerRelay.js` failed on
  `onKeyChanged: []` and was right to. The saving was always the door, not
  the skipping.

  **No browser reads the census any more**, and that is worth more than the
  bytes it saved.

  > **Andy:** *"the page posts a constant username and a pasted secret.
  > That's all."*

  `device.html` fetched a label for one sentence — *"Adding a device for
  Jazzmin Thut on …"*. It narrowed to `?key=` for a few hours and was then
  cut entirely: the label was chrome, and it could not do the job it looked
  like it was doing, since a name printed by the page comes from whoever
  served the page.

  **This removes one of the reasons the door has to answer a party with no
  identity at all.** That page had none — a browser arriving there has not
  enrolled yet — so it was a standing argument for the census being open to
  anybody. Nothing in a browser reads the route now, which narrows the
  question at 2a to bootstrap alone.

  It also withdrew a mitigation that was taken on purpose: the constant
  account name means several of your own nodes on one relay share a single
  password-manager entry, and the sentence was what told them apart. The
  link you followed is now the only thing that does.

  **`ownerBadge.probe` is not a `?key=` job, though it looks like one.**
  `censusFacts` scans the whole list for the owner's label, the member count
  and the roster
  ([ownerBadge.js:335-353](../../spirit/run/js/ownerBadge.js#L335-L353)), and
  builds it for every relay this node is *claimed* on — which in practice is
  all of them. Narrowing would save nothing and add a round trip. It belongs
  with `handleRoster` in the paging job.

  Three came off the list without being migrated at all, which is worth
  noting as a pattern rather than three accidents — each was a route kept
  after its interface had gone:

  | | why it went |
  |---|---|
  | `answerRelay.relayKey` | superseded by 2a — the key arrives with the claim |
  | `peer.candidates` | deleted 2026-09-17, no caller. The only one with **no narrow form** |
  | `peer.find` | deleted 2026-09-17, no caller. Ranked search absorbed it — *"an exact handle scores 1.0 and comes first out of a million"* |
  | `relay.roster` | deleted 2026-09-17 with the one screen that drew it — "On partner relays" |

  **`relay.roster` is the instructive one.** It was the single caller that
  genuinely wanted a *list*, so it was the one that would have had paging
  designed for it. It wanted a list for a panel whose own note admitted the
  rows were unusable — *"Not reachable: posting needs forwarding, which is
  not built"* — at a cost of one whole census per partner, per visit. Worth
  remembering the next time a caller looks like it needs a bigger answer.

  **Look for the dead ones before designing a narrower question for them.**
  Both deletions were flagged in the tree already — `peer.find`'s caller site
  said in as many words that it was *"a thing to decide rather than a thing
  to leave"* — and a route, an export and a surface assertion were enough
  between them to make each look alive.

---

## 9. Overturned along the way

Kept rather than edited away, because a conclusion whose reasoning is
invisible gets undone by the next reader.

- **`GET /api/relay/key` was proposed and killed.** A small fixed-cost door
  answering `{ relayPublicKey, relayLabel }`, to replace the census fetch in
  `answerRelay.relayKey`. Andy: *"they're not necessary"* — and they are
  not, because the introduction (2a, 2b) already carries the key. **A door
  that was one message from being built.**
- **"The signature can stay in `X-Spirit-Sig`."** Wrong. Under one post
  interface there is no header to stay in, and keeping it would have
  preserved the protocol's only HTTP dependency. See §5.
- **"Open is a call, close is not."** Wrong, and argued from a misread:
  `streamClose`'s *"the socket closing IS the notice"* is a comment about
  idempotency between `close` and `error`, not a claim that teardown is
  reliable. It is not — see 2d.
- **server.js's own reason for exempting `GET /api/events`** — *"a
  different transport shape, not a different verb, and no body can express
  it"* ([server.js:1394-1396](../../spirit/run/js/server.js#L1394-L1396)).
  A body **can** express it; that is the whole of 2d. What actually stops
  `/api/events` folding is the **client**: EventSource can neither POST nor
  set headers, and the node's only listener is a browser. The relay's only
  listeners are node-side ([presenceNode.js:24](../../spirit/run/js/presenceNode.js#L24),
  [partnerLink.js:48](../../spirit/run/js/partnerLink.js#L48)), so it has no
  such constraint. **Same exception on both sides, different reasons, and
  only the node's is permanent.**
- **`GET /api/relay/stream` was never a "public path"**, though it is listed
  as one ([server.js:929](../../spirit/run/js/server.js#L929)). It is the
  most authenticated thing on the box — unknown identities refused before
  any crypto, signature checked against that row's own key, authenticated
  *before* `connect` evicts, or anyone could knock any peer offline by
  connecting badly in someone's name
  ([relay.js:3242-3269](../../spirit/run/js/relay.js#L3242-L3269)). The list
  means "not handled by the generic gate", which is not what it is called.

---

## 10. Eradicating the census — the plan

> **Andy:** *"the census mechanism is a cheat."* — *"when a cheat is
> identified, it must be eradicated."* — *"and eradication of a cheat
> requires a plan. always."*

Required by [0010](../decisions/0010-fix-the-protocol-or-name-the-cheat.md)'s
identify / plan / eradicate. Two earlier drafts of this section were wrong in
opposite directions and both are recorded at the foot, because the shape of
the mistake is the useful part.

### What is actually being removed

**A pull, not a disclosure.** Membership is not secret from members — what is
refused is the bulk question:

| | verdict | why |
|---|---|---|
| `GET /api/relay/who` ([server.js:1271](../../spirit/run/js/server.js#L1271)) | **delete** | O(members) per request, per requester, by anyone including strangers |
| `presence` broadcast ([relay.js:3298](../../spirit/run/js/relay.js#L3298), [3326](../../spirit/run/js/relay.js#L3326), [1785](../../spirit/run/js/relay.js#L1785)) | **keep** | O(1) per event. The design |
| `route` broadcast ([relay.js:2080](../../spirit/run/js/relay.js#L2080)) | **keep** | same, and Andy's own example |
| **member-added broadcast** | **add** | does not exist. It is what auto-contacts wanted |
| `streamRoster`'s member list ([relay.js:3208](../../spirit/run/js/relay.js#L3208)) | **narrow to the relay's own row** | see below |
| `snapshot()`'s `peers: who()` ([relay.js:901](../../spirit/run/js/relay.js#L901)) | **delete the list** | built, then reduced to `peers.length` by its only reader. Discloses nothing; pure waste |

**`streamRoster` needs no catch-up substitute**, which was the last thing
this plan was unsure about:

> **Andy:** *"a newly bound node is most likely to get broadcast items from
> currently active relay members. Just sitting there listening should
> populate its UI with opportunities to connect."*

A roster hands a joining node the whole enrolment, dead beside live, in no
useful order. The stream hands it whoever is active, ranked by being active.
What it keeps is the relay's **own row** (`relay: true`) — necessary,
because that is how a member addresses the box it is attached to.

### The node side

One HTTP reader left: `ownerBadge.probe`
([ownerBadge.js:441](../../spirit/run/js/ownerBadge.js#L441)). `censusFacts`
scans the whole list for six facts, and five are already available:

| fact | replacement |
|---|---|
| `owned` | `/api/relay/key` → `ownerKey === myKey`. A comparison, not a search |
| `owner`, `relayKey`, `relayLabel` | `/api/relay/key` — **already built** |
| `claimed` | the stream opens, or refuses `no such identity` |
| `claimedLabel` | `streamOpen` returns `label` ([relay.js:3306](../../spirit/run/js/relay.js#L3306)) and it is discarded today |
| `peers` (a count) | **delete** — no consumer in `run/` |
| `roster` | gone with the fetch; the member reconcile listens instead |

And one thing to build rather than move: `presenceNode.onRoster` already
receives labels and throws them away
([presenceNode.js:126](../../spirit/run/js/presenceNode.js#L126)). Whatever
the stream carries after the narrowing is read there.

### Intrinsic UI

Nothing fetches; all of it reads `badge.census.*` and moves when the node
changes shape. `natter` (badges), `info` and `contactsDetails`
(`census.relayKey`) all point at `/api/relay/key`. `natterDetails`'
partner picker loses its rosters and is **owed nothing** — its own comment
says *"the fields remain the real path and this is only a shortcut."*

### Order

> **Andy:** *"the eradication must be done to eliminate temptation."*

So the route goes as early as it can, and everything that is merely an
improvement comes after. **Exactly two readers hold it open**, and nothing
else in this plan is a precondition:

```
1  probe off censusFacts        owned/owner/relayKey/relayLabel → /api/relay/key
                                claimed/claimedLabel → what the node already knows
                                peers deleted
2  peer.acquire stops asking    nothing new is built — see below
3  DELETE GET /api/relay/who    the temptation is gone at this point
—————————————————————————————— everything below is improvement, not eradication
4  snapshot() stops building a list it does not use
5  streamRoster narrows to the relay's own row
6  member-added broadcast, and the reconcile listens for it
```

**An earlier draft had the deletion at step 6**, behind the `streamRoster`
narrowing, on the reasoning that removing the route while the stream still
dumped the membership would be theatre. That followed from treating the
broadcast as a cheat, which it is not — so the dependency was never real,
and it would have left the door open for the length of the whole programme.

**Step 2 builds nothing**, and an earlier draft of this paragraph proposed
that it should — `about([keys])` as a new signed verb.

> **Andy:** *"callers of the census have two choices: use other interfaces
> or die."*

No caller is accommodated. `peer.acquire` confirms that a key really is on
that relay, so a mistyped paste cannot write a phantom contact. It has three
ways out and none is a door:

1. **Most of the time it need not ask at all.** A key that arrived by search
   result or broadcast was told to this node *by the relay*. Asking the relay
   to confirm what it just said is the pure form of a node wasting its own
   request budget. Only a **pasted** key is unverified.
2. **For a paste, reaching them beats listing them.** `peerPost` already
   answers it: [0006](../decisions/0006-fast-and-true-not-guaranteed.md) has
   the relay deliver or refuse instantly, so a post to a key nobody holds
   comes back refused at once. A stronger check than the census — *reachable*
   rather than *enrolled* — on an interface that exists.
3. **Or the check dies.** What it buys is preventing a row for somebody who
   is not there. A contacts row is this node's own perception, in a local
   file; a wrong one is a contact that never answers, which is honest,
   visible and deletable. Small, against keeping a cheat alive for it.

1 narrows the problem to pastes; 2 or 3 finishes them. Either way nothing new
is built and the route goes in the same commit.

### What breaks, said in advance

- A relay this node lists but has **never streamed to** loses its badge
  facts. The honest answer becomes "not joined", which is what it is.
- **`peers` disappears** and nothing reads it.
- **The partner picker empties** for relays whose owner this node has not met
  elsewhere.
- **A joining node starts empty** and fills from the stream. Different, and
  better ordered — but visibly different on first run.

### Verification

`node spirit/test/runAll.js` throughout, plus the source-level assertion in
`censusNarrow.js` that nothing in `run/` reaches `/api/relay/who` — the check
that has caught every relapse so far.

### Two wrong drafts, kept

**Draft one listed each fact the census served and hunted a replacement.**
Andy: *"bottom-up means the relay looks after itself first and will serve
**necessary** facts. Not every fact."* That is migration, not eradication:
every dependent gets what it had by a different road and the cost is
unchanged.

**Draft two condemned the broadcasts along with the route**, on the reasoning
that a list arriving unasked is the same disclosure as one arriving on
request. Andy: *"the working relay will broadcast useful information to its
membership… less work for the relay, more up-to-date information for the
node."* What is rejected is a **cost shape** — unbounded pull — not
disclosure to members. A push is O(1) per event and bounded by real activity,
so it satisfies [0013](../decisions/0013-a-relay-is-fixed-cost-per-time-unit.md)
rather than evading it.

The correction that matters for next time: **ask what a thing costs and who
controls that cost**, before asking who can see it. The first question
separated these four; the second put them in one bucket and would have
deleted the mechanism that replaces the cheat.
