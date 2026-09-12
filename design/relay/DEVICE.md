# What a device is

**Status: design, not built. Against `4a0d51e` (2026-09-12).
REVIEWED by Grok at `d515f70` — see "Review: what this document got wrong"
near the end. Three claims below are superseded there and are NOT safe to
build from: the router's rejection of device keys (2), the confidentiality
of the device channel (5, 7), and what a crooked relay cannot do (7).
None of the three touches the design; all three are places this document
described the tree wrongly.**

**Architecture: Andy Flinn.** Every decision in this document is his, in
the order he made them, and the quotations below are the record rather
than illustration. What was added here is verification — checking each
premise against the tree, finding the file and line it lands on, the two
places existing code already enforces it, the four places it would leak,
the one collision with a closed gate, and what it deletes.

Attribution in these documents marks **authority, not authorship**
(CLAUDE.md): this is named so that a later session does not relitigate it.

### It is not new, and that is the strongest thing about it

The three premises this rests on were written down on **16 and 17 May
2026**, before any of the machinery existed:

| written in May | what it became |
|---|---|
| *"A Personal Node … **is** the digital embodiment of that person"* ([NODE-ARCHITECTURE.md](../principles/NODE-ARCHITECTURE.md), 16 May) | "nodes are people" |
| *"Peer-to-peer connectivity between Personal Nodes **with minimal public relays**"* ([VISION.md](../VISION.md), 17 May) | "relays are satellites", and [0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md) |
| *"Maintain presence **while I am creating offline**"* (VISION.md, 17 May) | the premise [0006](../decisions/0006-fast-and-true-not-guaranteed.md) rests its whole argument on |

The device is the same logic taken one level further down: if a node is
the person, a device is a window onto that person and must carry none of
them with it. Andy has described it as *"an ejectable UI surface"*, and
the shape below is what that sentence turns out to require.

Supersedes the device model in [PEER-DEVICES.md](PEER-DEVICES.md) and
[DEVICE-PANEL.md](DEVICE-PANEL.md) §8, both of which describe a device key
installed in a relay's `allow.json`. That is what is built; it is not what
a device is.

---

## The premise

Andy, in the order he said it:

> a device is an ejectable UI surface

> the device conceptually can only talk safely and securely with the
> personal node that owns it. that is a premise.

> what a device can do: it can ask its owning personal node to sign
> requests it wants to make to any of the actual peers of the personal
> node

> the relay needs to store the public key in the same dataset as it
> stores the public key of its owner, so that it can peer route packets
> between owning node and device … it's a RAM only part of the ledger the
> relay keeps

> what the relay is NOT allowed to do is: expose the temporary device ID
> to any other peer

> the device must read stream and write POST

## In one sentence

**A device is a node-shaped thing with a temporary key instead of an
identity, no disk, and exactly one correspondent — its own node, which
acts on its behalf and hands back the result.**

It reads a stream and writes POSTs — the same two halves a personal node
uses ([presenceNode.js](../../spirit/run/js/presenceNode.js) and
`peerPost`) — which is why it needs no new transport. What differs is
everything about its standing: it holds no authority, it is on no ledger
anyone can read, and it can address nobody but the node that owns it.

## What that makes it, and not

| | a peer | a device |
|---|---|---|
| key | permanent identity | temporary session key |
| may address | any peer on the relay | **its owner — and only because the node's key is the address it posts to** |
| reaches a peer by | posting | **asking its node to** |
| appears in the census | to everyone | **to its owner, and to nobody else** |
| authority toward peers | signs as itself | **none — it petitions** |
| held by the relay | on disk, the ledger | **in RAM, and paired to its owner** |
| its key resolves for | anyone who asks | **its owner and the relay, and nobody else** |
| survives a relay restart | yes | **no, and that is a feature** |

---

## 1. The device asks; the node does it and answers

Andy, stating the requirement:

> this should allow the device to: get a request package signed by its
> owner, which it then can post to any peer on the ledger. and the peer
> will never know i'm sipping pina-coladas at the riviera.

and then, having looked at what that would take:

> a more simple route: the device simply asks its node to execute a post,
> and send back the result

**That is the design.** One exchange on one channel:

1. The device asks its node: *post this to that peer.*
2. The node decides, signs, posts, and waits for the reply — which is
   ordinary `peerPost`, unchanged.
3. The node sends the result back to the device.

### It is simpler and it is also shorter

The route it replaces had the node sign a package and hand it back for
the device to post itself. That reads like it saves a step and does not,
because the signing is a round trip of its own:

| | relay traversals |
|---|---|
| the device carries a signed package | **5** — ask to sign, receive it, post it, peer replies to the node, node forwards |
| **the device asks the node to post** | **4** — ask, node posts, peer replies, node answers |

The carrier version also needed the reply to travel node→device anyway,
because `routeReply` delivers to the route's *requester* and the requester
is the owner's key whoever pressed send. So it paid two legs for the
signature and saved nothing at the far end.

### And it keeps the premise literally true

*"The device can only talk safely and securely with the personal node
that owns it."* Under the carrier route that was true-with-an-exception —
the device also spoke to `/api/relay/post`. Here there is no exception.
**The device's only correspondent is its node, full stop**, which is what
makes every rule in §2 a complete description rather than most of one.

Three things fall away with it, none of them missed: a signed package
existing outside the node at all; the question of what happens when one
expires in transit; and the case of a device posting while its own node is
down.

### The peer cannot tell, and neither can the relay

The peer sees a post from the node, signed by the house key, identical to
every other. **Nothing in it names a device.** That is the pina colada,
and it is a property of the shape rather than a feature that was added.

This route is better than the carrier one here too. Had the device posted
the package itself, the relay would have seen *"a packet from Andy, posted
from a hotel in the Riviera"* — the correlation sitting in one request.
Now the relay sees a device talking to its node, sealed (§5), and
separately a node posting to a peer from home. It can still infer from
timing; it is no longer told.

Worth being exact about what remains: the relay knows **where the device
is**, because somebody has to open the socket. It knew that from the
moment the stream opened, and no packet makes it worse. Andy's claim is
the precise one: *the peer will never know.*

### What this buys that the current build cannot

Today a device *is* the identity, so the relay must be told about it, and
any policy about what a device may do would have to live on a public box.
Here the node is the only thing that can sign, so **the decision lives on
the one machine its owner controls** — and a place for that decision now
exists, which it currently does not. The first policy may well be *"sign
whatever my device asks"*. The point is that it is a policy rather than a
property of the wire.

It is also the same shape [0006](../decisions/0006-fast-and-true-not-guaranteed.md)
predicted from the other direction: *"a device is a client of its own
node, over the relay."*

### The answer arrives where the record lives

The node is the requester, so `routeReply` delivers to it (`relay.js:1148`)
— no special case, the ordinary path. It files the answer and passes it to
the device.

That is the right destination rather than a compromise:
[0006](../decisions/0006-fast-and-true-not-guaranteed.md) puts durability
on the recipient's own node, and a device with no disk is a poor place for
anything to arrive. **The device sees the result; the node keeps it.**
Which is the whole of what "ejectable UI surface" means when it is written
out.

### The newest code already enforces this

`routePost` verifies against `who.publicKey` — the house key alone
(`relay.js:1060`) — and does not consult `keysForName`. `streamOpen` does
the same (`relay.js:1181`, *"a borrowed phone must not open the wire its
owner is on"*). So on the router and on the stream, **a device key is
already worth nothing.**

The owner-equivalence that exists today is confined to three functions:
`send` (`relayAuth.js:350`), `inbox` (`:388`) and `status` (`:406`) — the
store-and-forward routes that [0006](../decisions/0006-fast-and-true-not-guaranteed.md)
retires and that the [Peerlink review](../reviews/2026-09-12-peerlink-world-view.md)
calls the last contradiction in the system.

**Three arguments now converge on the same deletion**: 0006's honesty
about storage, the satellite frame, and this premise. Retiring
`send`/`inbox`/`status` removes a device's standing authority at a relay
for free.

---

## 2. The address is the destination; the pairing is only a cache

**Revised three times on 2026-09-12, each time narrowing it.** The earlier
versions are recorded at the end of this section rather than deleted,
because two of them were wrong in a way worth not repeating: they built
machinery for a property the addressing already had.

### What the relay must guarantee

> Andy: what the relay is NOT allowed to do is: expose the temporary
> device ID to any other peer

> the connected device must only appear on the census for its owning node

> a device key only resolves for its owner AND the relay

Two questions, and separating them is what shrank this section:

| | |
|---|---|
| **destination** — can a device reach anyone but its node? | **No, structurally.** The node's key is in the path |
| **authenticity** — is this really that node's device? | the session key, checked against a pairing the relay caches |

### Destination: the path, not a comparison

Andy:

> when the device posts for a login/connect: the last path segment on that
> post is the public key of the associated node, or at least the path of
> that page is made unique by the pub key of the node

> can a static device page post to the relay with a relative path?
> ./device? and that gets translated to a path for the server?

**Yes, and this is the whole of the destination rule.**

`DEVICE_PAGE_PATH` is `/^\/([A-Za-z0-9_-]{16,512})\/device$/` and
`devicePageKey()` (`server.js:651`) decodes that segment back to the
node's public key. There is **no trailing slash**, so a page served at
`/KEY/device` resolves relative URLs against `/KEY/`:

| from the page | resolves to |
|---|---|
| `./device` | `/KEY/device` — the same URL that served it |
| `./enrol` | `/KEY/enrol` |
| `/api/relay/device` *(what it does today)* | `/api/relay/device` — **the key is gone** |

So `GET /KEY/device` serves the page and `POST /KEY/device` is the
enrolment: one path, two methods, and the server already knows how to read
the node out of it.

**Why this is stronger than a check.** A body field is something a caller
chooses. With the node in the path, a device page cannot address a
different node by changing a field — it would have to be served from a
different URL, which is a different page. **The wrong destination is not
refused, it is unrepresentable.**

That matters because a comparison can be forgotten. Grok's review found
exactly that: `routePost` appeared to reject device keys and in fact
rejected them by accident, because nothing resolved them. A check that
only seems to exist is the failure mode of checks. An address space has no
line to delete.

**And relative posting is what stops the page dropping it.** Today
`device.html:92` regexes `enrollFor` out of `location.pathname` and sends
it as a **body field** to an absolute path — so the key leaves the
address, travels through JavaScript, and returns as data the server must
trust. Posting relatively removes the parsing step, and therefore removes
the parsing step's bugs.

Three things to get right when this is built:

- `isRelayPublicPath` allows **GET only** for `devicePageKey`
  (`server.js:681`). POST needs adding — as a second method on a path that
  already exists, not as a new route.
- Any verb beyond `/device` (a `/KEY/connect`, say) means widening that
  regex. Keep it a **closed list** of segments, never a wildcard.
- The page tolerates a trailing slash (`\/device\/?$`) and the server does
  not. Harmless while the page only reads the key; once the path is
  load-bearing the two must agree, because a page at `/KEY/device/` would
  resolve `./enrol` to `/KEY/device/enrol` and miss.

### Authenticity: ask the node the path already names

The path says which node a device claims to belong to. It does not say the
device is genuinely that node's. For that the relay needs the device's
public key — and the way it gets one is to ask:

> Relay: *a device claiming key D wants to connect — is that yours?*
> Node: checks `relay-state/device.json`, answers signed.
> Relay: caches `D → node`, opens the stream.

No new transport. `post(toKey, text)` has been generic since the poll was
deleted, and `answerRelay` on the node already dispatches on the payload's
shape, so this is a second question beside `device-offer`.

**The relay never has to guess whom to ask**, which is the other thing the
path buys: the question is addressed by the request that provoked it.

Three consequences, all good:

- **It self-heals.** A relay restart drops the cache; the device
  reconnects; the relay asks again. A restart already drops every presence
  stream and everyone reconnects, so a device becomes the same class of
  event rather than a special one needing a re-typed password.
- **It works on a relay that never saw the enrolment.** The device key
  lives on the node, so any relay can ask — which is B2's "one device,
  every relay" without `installEverywhere`'s fan-out.
- **Revocation becomes authoritative rather than eventual.** The node
  forgets the device locally and the next connect anywhere is refused,
  because a relay that does not know asks. That is the red button reduced
  to one local write.

One gap to close on purpose: a device **already connected** keeps its
stream, because the relay holds the cache. So revoking should also have
the node tell its connected relays to drop — cheap, since it holds streams
to all of them, and the one case where an announce verb earns itself. A
short cache lifetime would also work and is worse: a lifetime is a guess,
a drop is immediate.

### The pairing is RAM, and only for the return path

`deviceKey → ownerKey`, in memory, never on disk.

**It exists for one reason: the node has to be able to reach BACK.** A
device reads a stream, so the relay needs a sink under the device's key to
push down. Nothing else needs it — the destination rule above is
addressing, not lookup.

Why RAM is right, in the tree's own words
([presence.js](../../spirit/run/js/presence.js)):

> In RAM, never written to disk — presence is true only while a socket is
> open, and written down it is a record of something that has stopped
> being true.

A session key is that kind of fact. It satisfies
[0006](../decisions/0006-fast-and-true-not-guaranteed.md) — a cache is not
storage on anyone's behalf — and
[0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md), since
nothing accumulates and the bound is live connections.

### Never exposed to another peer

Four existing surfaces would leak a device ID, every one of them doing the
right thing for a peer:

| surface | audience |
|---|---|
| `who()` → `/api/relay/who` (`relay.js:253`) | **anyone on the internet**, unauthenticated |
| `streamRoster()` (`relay.js:1186`) | every peer, on connect |
| `presence.broadcast('presence', …)` (`:1226`, `:1238`, `:1057`) | **every** connected sink, on connect, disconnect and removal |
| `deviceIdentityPublic` (`:1272`) | anyone — it confirms whether a key exists on this box |

The last is the quiet one: absent from the roster, a lookup that still
resolves a device key is an oracle for confirming a guessed one.

**Structural, not a filter.** The pairing lives in its own table that
`who()` cannot reach, and a device's connection registers a sink
**without broadcasting** — which is why §3 says devices need their own
entry point. Then leaking requires writing new code rather than forgetting
to filter, and a filter on `who()` is one refactor from being dropped.

Where the scoped view lands:

| surface | what changes |
|---|---|
| `/api/relay/who` | **nothing.** Unauthenticated: it does not know who is asking and must never carry a scoped answer |
| `streamRoster()` | takes the viewer. Already sent per connection (`relay.js:1225`); it merely computes one answer for everyone today |
| the presence event | **stops being a broadcast.** `presentNow.send(ownerKey, …)`, not `broadcast(…)` — one word, and the whole difference in exposure |
| `deviceIdentity` | resolves a device key for its owner and for the relay's own routing; *"no such peer"* to everybody else |

The stream is the right home for the scoped view because it is the only
**authenticated** view a node has — `streamOpen` verified a signature to
open it, where `/api/relay/who` verified nothing.

#### Why the relay is on the "resolves for" list

Because it is not an observer of the pairing, it is the party that holds
it. It resolves a device key **to route**; it never resolves one **to
answer** — and that split already has a seam, between `deviceIdentity`
(internal) and `deviceIdentityPublic` (the outward face, which returns a
label and deliberately no keys).

It concedes nothing that matters: the relay holds the device's **public**
key. It can route to it and verify its signatures; it cannot forge one.

### The reverse direction, which nobody has ruled on

If the device is sent a roster, **what is in it?** The full census would
hand a seized phone every label and key its owner can see. Under *"a
device can only talk to its owning node"* the answer that follows is **its
owner and nothing else** — stated here because it follows from the premise
rather than from a decision, and inheriting it by default would be the
expensive way to find out.

### The test this needs, and it is two claims

Andy: *"if there was one step in the device architecture that should be
tested, it is."*

Stand up a relay, enrol a device, connect a second peer, and assert the
temporary ID appears in **none** of: the public census, that peer's
roster, any presence event that peer receives, or a `deviceIdentityPublic`
lookup. False negatives only, never false positives (ROUTER.md §4).

**And the positive half in the same test**, because scoping is two claims
and only one is about hiding: the owner's own roster *does* carry the
device, and the owner *does* get its presence events. A check that only
proves absence passes just as happily against a device its own owner
cannot see — the same green tick, a different bug.

Add a third, for the destination: a device request arriving at `/KEY/…`
reaches that node and there is **no request it can make** that reaches
another. If that one is hard to write, the addressing is wrong.

### What the earlier drafts of this section said, and why they were worse

Recorded rather than deleted — both were machinery for a property the
addressing already had.

**Draft 1: the node announces the pairing.** On each stream reconnect the
node would tell every relay "this key is my device", signed with the house
key. It worked and it self-healed, and it invented a verb, a signature to
verify, and a registry for the relay to maintain.

**Draft 2: the relay learns the pairing at enrolment.** Cheaper — the
relay already holds `who.id` and gets `devicePublicKey` back in the node's
accepted answer, so the pairing could be recorded with no new message at
all. Better than draft 1, and it had one real cost: a relay restart
orphaned the device, since nothing would re-establish the pairing until
somebody re-typed a password.

**Both were answering the destination question with state.** Andy's
correction — the node's key is already in the path — means the destination
needs no state, and asking the node at connect makes authenticity
self-healing. What is left in RAM is a cache for the return path, which is
the only thing that ever needed to be remembered.

The general lesson, since it has now happened twice in this document:
**check what the addressing already guarantees before designing a check.**

## 3. Read stream, write POST

The browser's natural asymmetry, and the same two halves a node uses.

**There is a collision worth knowing before anybody writes it.**
`/api/relay/stream` takes its credential from a **header** and refuses a
query-string signature even when a good header is present
(`server.js:795` → `inboxSignatureFrom`; cycle 4 moved it there because a
signature on a query string lands in every access log on the route, and
`spirit/test/inboxSig.js` fails if it goes back).

A browser's `EventSource` **cannot set headers.**

| way out | cost |
|---|---|
| **`fetch()` with a streaming response** — same SSE wire format, headers allowed | reconnect is no longer free; the device page inherits the backoff lessons `sseClient.js` already paid for. ~40 lines |
| a query-string signature for the device stream only | reopens the hole cycle 4 closed, on the least trusted surface in the system |
| a one-use short-lived ticket in the URL, obtained by POST | keeps `EventSource`; adds a handshake and a second credential kind |

Recommended: **`fetch()` streaming.** `sseClient.js` describes itself as
*"a parser and a reconnect loop and nothing else"* and is the model, even
though it is Node code and cannot be shared.

**The cost under 0007:** each open device holds a socket on the relay.
Bounded by device count, and `presence.js`'s connect rate limit
(`DEFAULT_PER_MIN = 6`) already covers the flapping case.

---

## 4. What this deletes

Everything the relay currently knows about devices exists to solve *"a
device enrolled on one relay must work on all of them."* **Under this
premise that problem does not exist**, because the key lives on the node
and the node is one thing.

| goes | lines |
|---|---|
| `relay.setDevice` | 39 |
| `deviceTick.installEverywhere` — the fan-out | 20 |
| `deviceAuth.keysForName` | 9 |
| `deviceByName` in `allow.json`, the device field on peer rows, `/api/relay/set-device` | 28 touchpoints in all |

Plus `spirit/test/deviceEnrol.js`'s `oneDeviceEveryRelay` — written the
same morning this was decided, and correct about a mechanism that stops
existing.

**Two limits stop being structural and become choices.** "One device per
identity" came from `allow.json` having one field; a node can hold a list
as easily as a slot. And the relay's `DEVICE_PER_MIN` still keys on the
identity being enrolled, which it can still see — but any *"this device is
misbehaving"* judgement becomes the node's, because the relay can no
longer read the channel.

---

## 5. The relay should stop composing, and start carrying

`deviceOffer` (`relay.js:797`) already carries a browser's request to a
node and holds the connection for the answer. The only thing keeping it
from being the general device channel is that **the relay writes the
payload instead of carrying one**:

```js
var wrapped = JSON.stringify({
  relay: 'device-offer', password: password, devicePublicKey: devicePublicKey,
});
```

So today the relay handles the enrolment password in the clear and learns
the device key, and on the way back `deviceAnswerFrom` (`relay.js:956`)
parses the node's answer to decide what to tell the browser.

Under this premise it should see none of it — only *"a browser is talking
to this node."* Make the blob opaque in both directions and the relay
carries rather than understands, which is the move `packet.js` already
enforces one layer down.

Two things that buys beyond tidiness:

- **The relay stops handling the enrolment password.** It cannot leak what
  it never sees.
- **The "logged in as ANDY, even for bella" bug becomes unconstructable.**
  The relay could only get the name wrong because it composed an answer
  about identity (`answer.name = who.label`). Carrying the node's answer
  verbatim removes the opportunity rather than fixing the line.

### And the session key can close the last gap — WITHDRAWN

**This claim is withdrawn. It is kept because the reason it fails is the
useful part.**

It said that a session key the relay does not hold would make the
device↔node channel *"the first thing in the system a relay genuinely
cannot read"*, answering the confidentiality gap
[TRANSPORT.md](TRANSPORT.md) admits: *"the relay reads everything.
Untamperable is not private."*

Grok's reason for withdrawing it was that a password-derived key is
indefensible while the relay has seen the password. True — and **not the
real obstacle**, because that part is fixable: the browser already knows
the node's public key from the path it was served at (§2), so it could
seal to the node directly and the relay would carry ciphertext it never
composed. §5 above already says the relay should carry rather than
compose.

**The real obstacle is the key type.** Every identity in this system is
**Ed25519** — `crypto.generateKeyPairSync('ed25519')` on the node,
`crypto.subtle.generateKey({ name: 'Ed25519' })` in the browser. Ed25519
is a **signature** scheme. There is no encrypt operation for it and
WebCrypto exposes none. **There is nothing to seal to.**

Sealing would need an **X25519** key alongside every Ed25519 identity,
published wherever the signing key is, pinned the same way, with browser
support confirmed the way Ed25519 was on 2026-09-10. That touches
`generateIdentity`, the census, the device URL's shape and pinning.

**And the device channel is not uniquely unsealed — nothing is.**
TRANSPORT.md's admission holds for every packet in the system for exactly
this reason. So sealing this channel means introducing encryption to the
SYSTEM, which is a far larger decision than a device feature and must not
ride in on one.

Standing position until that sitting: the device↔node payload is
TRANSPORT.md's — **untamperable, not private.**

This does not make the system private. It makes one channel private, and
that channel is the one a person uses from a hotel room.

---

## 6. The red button

The scenario, which is the spec:

> imagine i get arrested in my hotel room while working with my personal
> secrets on my cell phone. this is where i push the "red" button on the
> device, it orders my personal server to instantly rotate the secret
> password, then disconnects, instantly, nobody entering the room has
> access to my secrets anymore.

Under the architecture above this is small, and the reason it is small is
the reason the architecture is right.

### What it costs to press — and this is the design argument

Andy:

> isn't the red button in a hotel room on the device something that cannot
> damage the node? it simply forces a trip home before ever using a device
> again

**Exactly that, and it should decide the button's shape.**

Everything the button touches is devices. The node's own operation is
untouched: peers still reach it, its rows on every relay stand, presence
continues, nothing is deleted, nothing is lost. The password gates
enrolment and nothing else.

And the recovery is **bounded and known**: the new password can be read
from `/api/hub/device`, which is a personal-node route, and a personal
node refuses every non-loopback connection (`server.js:723`). So it is
readable **from a browser on that machine and nowhere else**. One trip
home, and everything works again.

That asymmetry is the whole case for making it easy to press:

| | cost |
|---|---|
| pressed when it was not needed | **one trip home** |
| not pressed when it was needed | the identity |

So: **no confirmation dialog, no "are you sure", no second press.** A
destructive action normally earns a confirmation; this one has no
destruction in it to confirm. And a dialog is precisely what fails in the
only situation it exists for — somebody is at the door and there is time
for one press.

It is also **safe against its own misuse**, which is rare in a control
like this: anyone who presses it maliciously has to be holding the device,
and all they achieve is locking that device out and sending its owner
home. There is no version of pressing it that helps an attacker.

### The trip home is not a cost, it is the proof

There is an apparent conflict with DEVICE-PANEL.md §7 — *"no routine
failure should require being physically at home"* — and it dissolves on
the word **routine**. That rule exists so a closed tab, a restart or a
shut window cannot strand somebody. The red button is the emergency, not a
routine failure, and it is deliberate rather than suffered.

More than that, the journey is **the property, not the price**:

> **If a device could be re-enrolled from the road, so could whoever took
> the phone.**

A panic button that is remotely recoverable has not revoked anything — it
has just added a step for the attacker. Requiring presence at the node is
the only thing that makes the revocation mean something, and it is
therefore not a limitation to be engineered away later.

### It is a local write, not a fan-out

The node holds the device's key; the node stops honouring it. **One string
in one file on the box you own.** The earlier design — before this premise
— had revocation clearing a key on every relay, `installEverywhere` run
backwards, with a caveat that could not be removed: *a relay that is down
keeps honouring the stolen key.*

**That caveat disappears.** If your node cannot reach a relay to say
*forget my device*, your node is not present on that relay either — and
`post` refuses to route to an absent node (503, decision 0006). The device
gets nothing. The failure mode is covered by a rule that already exists.

### Three verbs, and the order is the design

| verb | touches | needs the network |
|---|---|---|
| **eject** | this surface's key material and what is on the screen | no |
| **revoke** | the pairing, on the node — and in each live relay's RAM | the node's problem, not the device's |
| **rotate** | the enrolment password in `device.json` | the node does it |

**You cannot sign after you wipe.** The device's only proof is the key it
is about to destroy. So: sign the order and fire it, do not await it, wipe
`sessionStorage` and blank the screen in the same tick. A room with no
signal must still lose the key.

Nothing is reported back on that device — there is nothing trustworthy to
show and nobody left to read it. The honest per-relay result belongs in
the panel at home.

**Revoke everything, not "this one."** A device cannot be trusted to name
which device it is *not*, and the failure mode of guessing wrong is
keeping theirs rather than losing yours.

**And it is free, once the trip home is already paid.** Any press at all
rotates the password, and the new one can only be read at the node — so
revoking one device and revoking all of them have the **same recovery
cost**. There is no saving to be had by being selective, only a risk. A
control with a cheaper and a more thorough option, priced identically,
should not offer the cheaper one.

### Rotation is essential, for a reason we created ourselves

The reason it is essential is our own advice. The panel says *"let that
browser's password manager memorise the password."* So the seized phone
very likely holds the 128 hex characters ready to autofill, and without
rotation the attacker enrols **a fresh device of their own**, at leisure,
indistinguishable from a legitimate one.

**The bookmark-and-save advice and the panic button are joined**, and
neither document said so until now.

**And rotation is total within its scope** — Andy: *"the red-button
rotate password can easily deny all requests from the old password,
that's kind of the point."* Exactly so, and an earlier draft here hedged
it into sounding partial. The password is compared in **one place**,
`deviceTick.js:85`. After rotation every request that depends on the old
one is denied, and that is the whole of what the password ever did. What
the attacker keeps is a dead string.

Rotation not detaching an attached device is **a different verb, not a
shortfall** — that is revocation, and the button performs both. Saying
rotation does not revoke is like saying new locks do not evict a tenant:
true, and not a criticism of locks. The only place the distinction needs
saying aloud is the UI, if rotate is ever offered *on its own*.

### What it cannot do

Nothing protects what is on the screen at the moment of seizure beyond
blanking it, and nothing protects someone who never gets to press
anything. `sessionStorage` is cleared, not shredded — browser memory and
swap are outside what a page can reach. The practical bound is: cleared,
tab closed, and the key worthless the moment the node forgets it.

---

## 7. Where this points — FUTURE LAYER, not this arc

**Nothing below is decided or scheduled.** It is the horizon the sections
above happen to open, written down so it is not re-derived, and kept apart
from them on purpose.

**§1–6 do not depend on any of it.** They describe a channel between a
device and its node; this describes what might eventually run on that
channel. Today's `device.html` works against §1–6 exactly as it is. That
separability is what makes this safe to leave alone, and it is the reason
the split is worth drawing rather than letting the good idea pull the
buildable one out of shape.

Andy, offering it as an aside and then placing it:

> and just for kicks, the relay can deliver a spirit object module to the
> device, containing an api and UI support for it

> that would be a section pointing to the future

So: the device stops being `device.html` — a fixed 444-line page with one
console in it — and becomes **a shell that is sent its apps**. What
follows is what the tree says that would require, and the two places it is
already most of the way there.

### The contract already fits, unchanged

An app in this system is behaviour and nothing else. It calls
`activateApp({ mount, open, render })` and states no identity, because
identity is **proven rather than claimed** — `shell.js:1544`:

> its identity is proven by which script the shell itself just injected …
> not by anything the script states about itself

That is [0001](../decisions/0001-proven-vs-claimed-identity.md)'s
principle applied to app loading, and it is exactly the property that
makes injecting a module that arrived over a wire safe in the direction
that matters: **the receiving shell decides what an app is; the code only
supplies what it does.**

### The `api` boundary is the seam, and it is already drawn

An app is handed about twenty methods. They fall cleanly in two:

| | |
|---|---|
| **pure UI — identical on a device** | `escapeHtml`, `setScreenTitle`, `launchApp`, `callDialog`, `closeDialog`, `setDialogResult`, `addTitlebarLink`, `ui`, `isVisible`, `listApps`, `listGroups` |
| **needs the node — becomes "ask my node"** | `sendMessagePacket`, `onPacket`, `onFiles`, `onJobs`, `readProject`, `getAppOverride`, `setAppOverride`, `nodeLabel`, `fetchExternal` |

Every method in the second column becomes the verb from §1: *ask the node
to do it and hand back the result.* `sendMessagePacket` **is** that verb
already — an app says it and has never known whether the node was local.

So an app written for the shell runs on a device without being told it
moved.

### The rule that makes this possible was written as tidiness

[AGENT.md](../../AGENT.md):

> Target: apps do not name HTTP paths. Methods live on `api`. **Today
> Relay Chat still `fetch`es `/api/hub/*`; do not lint-fail that file
> until Andy opens the `api.hub` sitting.**

That reads like housekeeping. It is the **enabling constraint** for this
entire section: an app that names a path is an app that assumes a local
node, and it is the one thing that cannot travel.

Measured at `4a0d51e` — **9 of 17 apps would travel today; 8 would not**:

| names HTTP paths | |
|---|---|
| `natter` (4), `relayChat` (3), `natterDetails` (3), `contacts` (3), `contactsDetails` (2), `typeDesigner`, `appBuilder`, `aiChat` | would need the `api.hub` sitting first |
| `textEditor`, `files`, `jobs`, `stats`, `apps`, `group-manager`, `process-browser`, `aiManager`, `shared` | already portable |

Including, honestly, two touched this week: `natterDetails` was written
with `fetch('/api/hub/device')` in it on the same day this architecture
was decided.

That table is *portability*, not permission. Which of the nine should
actually go is the next section's flag, and the answer is fewer than nine.

### `deviceCapable: true` — one manifest entry

Andy's, and it is the right place for it: the manifest is the **trusted**
half of an app. `shell.js` reads `id`, `name`, `icon`, `hidden`,
`intrinsic` and `handlesExtensions` from it at discovery, and refuses to
believe anything the *script* says about itself. A field here is a
statement by the node about one of its apps, not a claim an app makes on
its own behalf.

**Absent means false.** Opt-in, always — an app written without a thought
about devices must stay at home rather than be shipped to a phone because
nobody said otherwise. It is the same instinct AGENT.md already applies to
chrome: *prefer not building it over hiding it.* Nothing reaches a device
that was not deliberately sent.

**It answers "should", not "could",** and keeping those apart is the point
of having a flag rather than inferring one:

| | |
|---|---|
| **could** it run there? | does it avoid naming HTTP paths — a technical fact, and greppable |
| **should** it be there? | do you want this reachable from a phone that might be taken |

They are not the same question and the interesting cases are where they
disagree. `appBuilder` names exactly one path and is nearly portable — and
must never be `deviceCapable`, because a seized phone that can rewrite
your apps is worse than one that can read your mail. `typeDesigner` and
`aiManager` are the same shape. **Portability is the precondition;
capability is a decision.**

**The node reads it, and nobody else.** Not the device, which cannot
verify anything about itself, and not the relay, which must not know what
a person runs. It is the node choosing what to send.

**And it needs a test, or it is a comment.** A manifest saying
`deviceCapable: true` beside a script that names an HTTP path is a
contradiction, and catching it is a grep — the `natterIntrinsic.js` shape:
read both files, assert the invariant, false negatives only. Without that
the flag records an intention and the app fails on the phone, in a hotel,
which is the worst place to discover it.

**Where it sits against manifest protection.** `intrinsic` is read from
disk and never from what is being written, so App Builder can neither set
nor clear it (`kernel.js:322`) — because losing it would break the node.
`deviceCapable` bears privilege in the other direction: *gaining* it
broadens what leaves the house. On an intrinsic app it is already
protected by that same rule. On an app the operator wrote, the operator
can set it — which is the operator deciding about their own node and their
own code, and is fine, but should be written down rather than discovered.

### Who may author a module — and this is the load-bearing rule

**The relay serves the boot page.** That is unavoidable and should be said
plainly rather than engineered around: the address a person types is a
relay address, so a hostile relay serves a hostile page and owns the
device. No cryptography inside a browser fixes the page that delivered the
browser's code.

So the rule is not *"the relay cannot be trusted"* — it is:

> **The relay serves the boot shell. The node delivers everything with
> authority in it.**

Not because that closes the hole. Because it **bounds** it. The relay's
reach becomes one small page whose source is public and whose running
commit is published at `/api/version`; everything that touches a person's
data arrives from their own machine, sealed to their own key (§5).

It is §5's rule — *the relay carries, it does not compose* — applied to
code instead of answers, and it has the same shape: the relay may deliver
a module; it may not be the thing that wrote one.

**The line falls where the channel begins.** Before enrolment there is no
node channel, so the relay must serve the boot shell and the enrolment
page. After enrolment there is a channel, and everything comes down it.

**And this makes "keep the boot page small" a security argument** rather
than an aesthetic one. Today `device.html` is 444 lines carrying enrolment,
a key store and a console. Under this design the console leaves and
becomes a module; what stays is the smallest thing that can enrol and
verify.

### Which is also what makes it ejectable

Nothing of the person's is ever *in* the page. The apps arrived, the data
arrived, and both belong to the node. Eject, and what is left is a boot
shell that knows nobody — which is the same thing it was before anyone
typed a password into it.

### Where it goes: the relay build IS the trust root, and it is small

Andy:

> since the code for the device shell lives on the relay…. which won't
> actually be deployed with all apps or any unnecessary code….. see where
> this will be going?

This is the piece that closes the argument, and it closes it from the
deployment side rather than the design side.

**The device shell ships in the relay build.** And a relay build contains
no apps, because a relay has no use for one — that was
[0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md)'s
packaging note and it was not written with this in mind. So:

> **"Keep the boot page small" stops being a discipline and becomes a
> consequence.** Nobody can ship an app on a relay by accident, because
> the relay build does not have one to ship.

Measured at `4a0d51e`, what a routing-only relay actually needs:

| | lines | bytes |
|---|---|---|
| `relay.js` | 1303 | 54 KB |
| `relayAuth.js` | 454 | 18 KB |
| `packet.js` | 189 | 7.6 KB |
| `deviceAuth.js` | 201 | 7.6 KB |
| `router.js` | 170 | 6.4 KB |
| `invites.js` | 168 | 5.9 KB |
| `presence.js` | 146 | 5.0 KB |
| **routing core** | **~2 400** | **~105 KB** |

plus a stripped `server.js` and the boot shell — against **2 986 KB**
across 94 files in the tree a relay carries today.

### Which turns an admitted weakness into a bounded one

Above, this document concedes something it cannot engineer away: *a
hostile relay serves a hostile page and owns the device, and no
cryptography inside a browser fixes the page that delivered the browser's
code.*

That concession does not go away. **Its size changes, and size is the
whole of what can be done about it.** The thing a person must trust is
roughly a hundred kilobytes of open-source routing plus a boot shell, with
the running commit published at `/api/version` (`server.js`) — auditable
in an afternoon, pinnable, and comparable between relays. An unbounded
trust becomes an inspectable one, which is the best answer available in a
browser and is a real answer rather than a shrug.

**It also makes the relay's smallness load-bearing rather than tidy.**
Until now "minimal public relays" was a cost argument. Here it is a
security argument: every kilobyte the relay does not ship is a kilobyte
nobody has to read before trusting their phone to it.

### And it is how the software reaches people

The consequence nobody set out to build: **you install nothing to use your
own node from a phone.** You type a URL. The relay hands over a shell; the
node hands over the apps and the data. VISION.md's *"peer-to-peer
connectivity between Personal Nodes with minimal public relays"* turns out
to describe a distribution model as well as a topology — the relay is
small, and it is also how the client gets to anybody.

Which answers a question [0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md)
left open — *what does a relay sell?* It carries, it is reachable, and **it
is where the client comes from.** That is a product, and it costs almost
nothing to run.

### A crooked relay, and "certified by self"

Andy, naming the threat the section above only bounds:

> let's face it: anybody can build a crooked relay that pretends to be
> true…. the best guard against that is to only use a relay that is
> somehow certified by 'self'

**True, and worth stating without softening: there is no remote
attestation and there cannot be.** A relay is open source, anyone may run
a modified one, and `/api/version` is *self-reported* — a crooked box
simply says the commit you wanted to hear. No amount of auditing the
published source tells you what a stranger's server is executing.

This generalises past devices. It applies to every relay a node touches.

#### What a crooked relay can and cannot do

The bound matters, because it is what makes this tractable rather than
hopeless:

| it **cannot** | why |
|---|---|
| forge a message from anybody | every packet is signed end to end and verified against the *sender's* key, which the relay does not hold |
| hand over an archive later | it keeps none (0006) |
| read a sealed device channel | §5 |

| it **can** | |
|---|---|
| read everything unsealed | TRANSPORT.md admits this already: *"the relay reads everything; untamperable is not private"* |
| lie about presence | saying 🔴 of someone present is a **false negative**, which ROUTER.md §4 already declares the tolerable direction. Saying 🟢 falsely is caught by the next post, which refuses or goes unanswered |
| refuse to route | censorship, and it is honest about being a refusal |
| **serve a bad boot shell to a device** | the worst of them, and the subject of this section |

**So a crooked relay is a censor and an eavesdropper, never an
impersonator.** That is a property of the signature discipline rather than
of anyone's good behaviour, and it is why the remaining problem is small
enough to have an answer.

#### Certified by self, in three grades

**1. Run it yourself.** The literal form, and the system already supports
it: `--relay` plus first-claim-is-owner
([0003](../decisions/0003-first-claim-is-owner.md)). For your own traffic
this closes the question completely. It is also what *"minimal public
relays"* was for.

**2. Pin what you accepted — and this is half-built already.**
`answerRelay.js:89` fetches a relay's `mailboxPublicKey` and keeps it,
with its own comment explaining why that is safe:

> a relay's key is made on its first `--relay` boot and does not change
> while it is the same relay

Exactly right, and it makes the key a near-perfect pinning target. But the
cache is **per process and in RAM**: it is forgotten on restart and
believes whatever answers next time. And `relays.json` holds
`{ label, url }` with **no key at all** — so a node has no durable record
of which relay a URL ever was, and a substitution between restarts is
silent.

The fix is one field: record the key when a relay is first added, and
treat a change as an **event** rather than as a fact.

**What pinning proves, and what it does not.** It proves the relay is the
*same* one you accepted. It does not prove it was ever honest — a relay
crooked from the first boot pins perfectly. Trust-on-first-use protects
**continuity, not integrity**, and saying so is the difference between a
guard and a comfort.

**3. The bookmark is a device's certificate** — and this is the one worth
noticing, because it is already in the product and nobody called it this.

A device has no prior state. It is a browser that was just opened; it
cannot check a pin, because it has nothing to check against. So its
certification has to be something **the person carries**, and that is the
bookmark.

[DEVICE-PANEL.md](DEVICE-PANEL.md) §8 says *"bookmark that page while you
are there"*, written as a convenience — *"its address carries your key,
and it is not one anybody could retype."* **It is in fact the device's
entire defence against a crooked relay.** Typing a URL from memory, or
following a link somebody sent, is where a person gets phished. Opening
their own bookmark is where they do not.

That should be said in the panel copy, because a person who knows *why*
will actually do it.

#### And it argues for small relays a third time

**What** must be trusted is bounded by what the relay ships (the section
above). **Who** must be trusted is bounded by pinning, and removed
entirely by running your own. Neither is a guarantee. Together they are
the difference between an unbounded trust and two bounded ones, which is
all that was ever available here.

### The open question this creates

`shell.js` is **2 254 lines**, and that is too big to be a trust root as
it stands. So one of two things has to be true, and it matters which:

- **one shell, two bindings** — the same code, with `api` pointing at a
  local node or a remote one. Cheapest to maintain, and it means shipping
  all 2 254 lines on the relay;
- **a subset build** — only what a remote `api` can satisfy: app
  injection, `activateApp`, `switchTo`, navigation. Not the desktop, the
  Files tree, app overrides or group management.

The second is almost certainly right, and it is the same move as the
relay build itself: **strip to what the far end can actually use.** But it
is a real decision with a real cost, and it should be made rather than
discovered.

### What would have to happen first

Listed so the size is visible, not as a plan:

1. **`api.hub`** — AGENT.md names it as a sitting that is not open. It is
   the gate: eight of seventeen apps name HTTP paths and cannot travel
   until methods live on `api`.
2. **A device-side `api`** implementing the second column above as *ask my
   node* — which is §1's verb, and nothing more than that.
3. **`deviceCapable` and its test.** The flag is cheap; the check that
   keeps it honest is what makes it real.
4. **A relay build**, which delivers the small boot shell as a side effect
   rather than as a discipline — and is the same build 0007 calls a
   deployment problem. It is now also a security one.

None of it blocks anything above. All of it is worth having written down
before somebody builds the first module and discovers the order.

## Review — what this document got wrong

**Grok, against `d515f70`, 2026-09-12. Recorded rather than edited away:
the reasoning that was wrong is more useful than a document that never
shows it.** Verified line by line before recording; one correction of the
correction is noted.

### 1. `routePost` and `streamOpen` reject device keys BY ACCIDENT, and §2 would break it

**The most serious finding here.** Both call `deviceIdentity(token)` and
refuse when it returns null (`relay.js:1060`, `:1181`). A device key
returns null today only because it is **in no table** — not in
`allow.json`, not in the peer roster.

That is an absence, not a gate.

**The design is not in question. The implementation site is.** §2
postulates the rule plainly — *a packet signed by a device's session key
may be addressed to its paired owner and to nothing else* — and that rule
is structural rather than defensive: **routing a device only to its owner
is what makes the node the sole place where requests are granted or
refused.** Route it anywhere else and the node is bypassed, which is the
whole architecture gone.

The problem is that **`routePost` has nowhere for that rule to live.** Its
checks are each independent — both tokens resolve, the signature verifies,
the target is present, the text is not too large — and **it never compares
the sender to the target.** Nothing in it could express "this sender may
only reach that one peer".

So the rule is enforced today only by accident: device keys reach no check
because they resolve to nothing. §2 requires them to resolve, and the
moment they do, the accident stops holding and there is no gate underneath
it. `streamOpen` has the same shape, and there it is worse — a device
accepted as a peer would be announced by `presence.broadcast`, which is
leak surface #2 firing on connect.

**The earlier claim in this document that the router "already enforces
this" described a coincidence** and should not have been written as a
property. Grok is right about that, and about the danger: §2 makes device
keys resolve, so the coincidence stops holding.

**But the cost turned out to be smaller than "one explicit check at two
call sites", and §2 has been rewritten around why.** Andy: the node's
public key is already in the path of every device request
(`devicePageKey`, `server.js:651`). So a device's destination is not
something it supplies and then has compared — it is the address the
request arrived at. There is no route to anywhere else to refuse.

That disposes of this finding in the strongest available way: a check can
be forgotten in a refactor, which is precisely what this finding IS. An
address space has no line to delete. What remains for `routePost` and
`streamOpen` is to refuse a device key as a *peer* — which they will do by
resolving device keys only for the owner and the relay, not by comparing
sender to target.

#### THESE TWO MUST LAND IN THE SAME CYCLE

Not as a preference — as a requirement, because the order is a hole.

Today a device can only reach its own node, and the reason is that a
device key resolves nowhere. **§2 makes device keys resolve.** Build the
pairing first and the accident stops holding with nothing underneath it:
`routePost` would accept a device as a sender to any peer, and
`streamOpen` would accept one as a peer and announce it to everybody
(`presence.broadcast`, leak surface #2, on connect).

So the pairing and the destination restriction are one change. Splitting
them across two sittings would open, for however long the gap lasted,
exactly the hole the architecture exists to close.

#### AND THE NODE'S OWN DOOR HAS TO LEARN ITS DEVICE

Found by Andy asking whether the relay does everything possible — it does
not, and neither, it turns out, does the node.

`hub.frontDoor` (built 2026-09-12, the answer to the review) knows two
sets: `listenSet` — contacts and self — and `relayKeys.acceptedKeys`, the
relays this node accepted. **A device's session key is in neither.**

So as the tree stands, the moment a device posts to its own node, its own
node refuses it: the front door is a stranger-gate and a session key
looks exactly like a stranger. The node does know the key — it is in
`relay-state/device.json` — it simply is not asked.

**A third known-set, and it belongs with the device cycle**, for the same
reason the relay exception belonged with the router path: a gate that is
right about peers is wrong about the one party that is neither a peer nor
a relay. That is now twice this shape has appeared in one afternoon, and
it is worth stating as a rule rather than as two incidents:

> **Every new party needs adding to every gate that predates it.** A
> device is the third kind of sender in this system, after a peer and a
> relay, and each gate was written when there were fewer.

### 1b. The second defence Andy named — and it is missing for everybody

Andy, on being told the relay has nowhere to enforce §2's routing rule:

> if the device, by any chance, attempts to post to any peer other than
> its own owner node, that peer could not possibly verify the originator
> of the request, and no node, by protocol, should accept requests from
> unknown

**Correct, and it is the right shape: two independent defences.** The
relay routes a device only to its owner; and even if that failed, the far
end refuses a sender it does not know. A device session key is by design
held only by its owner node and the relay, so to any other node it is a
stranger's key and should bounce.

**The rule exists. It is on the wrong transport.**

`hub.js:379` — `listenSet`, *"who this node will listen to: everyone it
has actually acquired, plus itself"*, built from `whoBook.contacts()`,
with `unknownPolicy` (`hub.js:360`) offering `acquire` / `hold` /
`silent`. A considered position, with a UI behind it.

It is applied in **one** place, `hub.js:389` — the `inbox` path. The
router path never consults it: `peerPost.js`, `answerRelay.js` and
`presenceNode.js` contain no reference to `listenSet`,
`whoBook.contacts`, or `unknownPolicy`.

What `peerPost.onRequest` actually checks is **two things**: that the
signature verifies against the `from` the packet claims, and that `to` is
this node. That proves the sender holds the key they say they hold. It
proves nothing about whether this node has ever heard of them.

**How far that actually reaches — corrected by Andy, and it is narrower
than first written here.** An earlier draft of this section said *any key
that can reach a relay this node is on*. That is wrong:

> the relay, as it sits, is incapable of relaying packets of keys unknown
> to itself

Correct. `routePost` resolves the sender through `deviceIdentity` and
answers **403 `no such identity`** to a key with no row on that relay
(`relay.js:1061`). In keys-mode a row requires an invite minted by the
relay's owner. So a stranger on the internet cannot post to anybody
through a relay; they must first be admitted to it.

**The relay's membership roll is doing security work**, which is
[0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md)'s *"the
roll is the ledger"* earning its keep in a way that decision did not
claim.

**What remains is still real, and it is the union.** A node on several
relays accepts from **everyone the owner of each of those relays
admitted** — and it never consented to any of those guest lists. If this
node is a peer on somebody else's relay, everyone they invited can post to
it. That is precisely the gap `listenSet` exists to close: the node's own
judgement about who it will hear, as distinct from the relay owner's
judgement about who may be present.

So on the router path, an admitted-elsewhere key is accepted, written to
`relay-state/traffic.json` **with the payload**, handed to `onArrival` for
the apps, and receipted — all before any policy, because no policy is
consulted. Not the internet. Still not this node's decision.

**This is the same failure as the rate limit, and that makes twice.** A
gate that exists on the transport being retired, not carried across to the
transport replacing it — and invisible because nothing goes red when a
check is simply absent. Worth naming as a pattern before the third one:
**when a path is replaced, its gates do not come along on their own.**

For this design the consequence is narrow and good: Andy's second defence
is the right one, and it costs nothing new — `listenSet` and
`unknownPolicy` already exist and already have a considered answer for
strangers. They need wiring to `onRequest`. That is a cycle, and it is not
a device cycle: it protects every node against every unknown sender, of
which a misrouted device is one small case.

### 1c. Where the policy lives is wrong, and the floor should not live in a file at all

Andy:

> `app/contacts/prefs.json` is the wrong place for that file, it's a
> node-global

**Right, and it is wrong twice over.**

**Wrong as a location.** Who this node will hear from is a fact about the
node's front door, not about one app. Contacts is a *view* of the whoBook;
it does not own the door. A node-global setting already has a home —
`preferences.json` at the run root, and `kernel.js:184` lists it in
`WRITABLE_ROOT_FILES`, so writes to it pass the kernel rather than an
app's own `api.fs`.

**Wrong as a layer.** `api.fs` is scoped to `app/<name>/` by convention,
so Contacts can write its own prefs — correct for a preference, and the
reason a *safety floor* must not be there. AGENT.md's model is that **the
server is the only jail**, and a rule enforced by reading an app's JSON is
enforced outside it.

So the split, and it falls out cleanly once the two are separated:

| | where |
|---|---|
| the **preference** — `silent` / `hold` / `acquire` | `preferences.json`, node-global, the user's to set |
| the **floor** — an unknown sender reaches no app before a decision, and spends bounded rate and bytes whatever the policy says | **code.** It is not a setting, so it needs no file and must not have one |

The repo already knows this difference: decision 0003 reads `intrinsic`
**from disk, never from the content being written** — *"a caller cannot
clear it by sending a manifest without it."* That is the shape an
invariant has. `unknownPolicy` does not have it and should not, because it
is a preference and preferences are meant to be changed.

Said the other way round, which is the version worth keeping: **the
preference decides who you talk to; the floor decides what a stranger can
spend.** A person can consent to hearing from strangers. Nobody is being
asked to consent to unbounded strangers, so nobody can.

One thing not to move: this is the same sitting as the review's finding
that `relay-state/` is the wrong name for a personal node's private
directory. Both are "a file in the wrong place because of where the code
grew". Worth doing together or not at all.

### 2. Replay after one real enrolment — the third consequence of the relay signing as a party

Asked for in the request and answered. §7 claimed a crooked relay is *"a
censor and an eavesdropper, never an impersonator"*. It holds for peer
packets. It does **not** hold for enrolment, and not only because the
relay signs:

**The relay is handed the password in cleartext.** `deviceOffer`
(`relay.js:~806`) composes `{relay:'device-offer', password, …}` itself,
so a crooked relay that carries **one legitimate enrolment** keeps the
password and can enrol a device of its own afterwards, at any time, until
the password is rotated.

Fabricating offers without the password fails. Replaying one it was given
does not. That is a standing capability, not an attempt.

### 3. §5's sealed channel is a requirement with no primitive

Follows directly from #2 and demolishes the §7 claim that this would be
*"the first thing in the system a relay genuinely cannot read"*.

**A password-derived channel key is indefensible while the relay has seen
the password** — and it has, because the relay carries the enrolment that
would establish the seal. The bootstrap cannot be sealed by the thing it
bootstraps.

**Standing position until a later sitting: the device↔node payload is
TRANSPORT.md's position — untamperable, not private.** Everything in this
document that assumed confidentiality is unsupported, including §7's
answer to TRANSPORT.md's admitted gap.

### 4. The rate limit — right conclusion, and my line number was right

Grok: *"`DEVICE_PER_MIN` binds HTTP `deviceOffer` callers, not a crooked
relay and not `answerOffer`."* **Correct, and sharper than the request put
it.** A crooked relay never calls `deviceOffer` at all; it posts to the
node directly, and `deviceTick.answerOffer` has no counter, no backoff and
no delay.

**The missing half: a node-side failure counter keyed by `item.relay`** —
which `answerRelay` already holds. Not built.

*Correction to the correction:* the leash says *"line `:813` in the
request is not that check."* It is — `relay.js:813` is
`rateOk(deviceHits, who.id, DEVICE_PER_MIN)`. The architectural point
stands; the citation was sound.

### 5. Ordering on the retirement

`send`/`inbox`/`status` must not go while Relay Chat still `hubPost`s
`/api/hub/send` and polls `/api/hub/inbox` every 2s. **`consoleExchange`
moves to the relay-as-party post first; then the routes can die.**

### 6. Pinning, and what a device does instead

Pin `mailboxPublicKey` **on disk** on the node; a key change is an
**explicit accept**, not a warning. A device has no disk and cannot pin —
it **fail-closes on a bookmark mismatch**, which is what makes §7's
"bookmark as certificate" operational rather than a metaphor.

### 7. A fifth leak surface

`/device/<hex>` in access logs, **if the hex is the session id**. Not a
bug today — the current page carries the *owner's* key, which is public —
but it is the obvious way to build the device shell and it would put a
session credential in every log on the route. The same lesson cycle 4
learned for `?sig=`.

**Answered by §2 as rewritten, by construction rather than by care.** The
path carries the NODE's public key, which is a locator and already public
at `/api/relay/who`; the session key never appears in a URL at all,
because the device posts relatively and proves itself with a signature.
So there is no hex in the path that is worth capturing from a log.

## Open

- **What a node's policy is** when a device asks it to sign. "Everything"
  is a fine first answer; it should be a written one.
- **What makes the key temporary** — a clock, or the node's word. An
  expiring key gives revocation a floor that works when nothing is
  pressed.
- **Whether a node holds one device or several**, now that the slot is no
  longer a field in someone else's file.
- **What a device's own roster contains** (§2). It follows from the
  premise that it is the owner and nothing else, but it has not been
  decided, and inheriting it by default would hand a seized phone the
  whole relay.
Not open, and §7 is where they live rather than here: module delivery,
`deviceCapable`, and what `api.hub` would have to become. They are the
horizon, not the backlog.
- **Password rotation — SCHEDULED, no longer open.** There was no
  mechanism at all: open before the hotel-room scenario, load-bearing for
  it, and load-bearing again after Grok's finding that a relay which
  carried one legitimate enrolment holds that password until it changes.
  It is now **item 6 of the cycle answering that review** — the only
  available answer to that finding, since sealing the channel needs a
  primitive we do not have.

  It is **mitigation, not a fix**, and must say so: rotation cannot un-see
  a password. It stops a captured one being a permanent key to the front
  door, and it does **not** detach devices already attached — different
  files on different machines, which is the distinction this whole
  document turns on.

  **Open inside it: where the control lives.** Andy's specification for
  the panel was a Copy button, a link and a paragraph — *"thats all"* — so
  a rotate control is a second control in a panel deliberately given one.
  It is also a different kind of act: enrolling a device is routine,
  rotating a password is a security action taken when something has gone
  wrong. Whether it belongs in that panel, quieter, or somewhere else is a
  UI decision and is Andy's.
