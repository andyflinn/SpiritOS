# 0010 — If the protocol cannot carry it, stop

**Decided 2026-09-13 by Andy. Measured against `a241dbc`.**

> If the protocol doesn't support it: no code until a decision is reached:
> fix the protocol, or cheat?

## The decision

When something has to cross the WAN and the protocol cannot express it,
**no code is written until that is decided out loud.** Three outcomes,
and all three are allowed:

1. **Fix the protocol** so it can carry the thing.
2. **Cheat, and name it** — write it down as a cheat, with what it costs
   and what would undo it.
3. **Don't do the thing.**

What is not allowed is the fourth outcome, which is what happens by
default: a new signed message format and a new route appear, the feature
works, and nobody ever calls it a decision.

## The narrowing, because a rule that fires on everything is ignored

**It applies to one thing: a new way of speaking on the wire.** In this
tree that has exactly two shapes, and both are greppable:

- a new `<verb>Message()` in `relayAuth.js`, `invites.js` or
  `deviceAuth.js` — a new format of signed bytes
- a new `/api/relay/*` route — a new public door

**It does not apply** to node-local work (`whoBook`, preferences, the
traffic log), to anything in the browser (panels, layout, copy), or to
anything already expressible as a post. Most work is untouched by this.

If you are adding either of those two things, you are extending the
protocol by hand. Stop and decide.

## Why, in one worked example that is mine

`/api/relay/monitor` and `monitorMessage` were added on 2026-09-13,
because the relay needed to be told to start streaming its activity and
the protocol had no way to say it. It worked. It was tested. It was also
a cheat, and nobody called it one.

Hours later the same day Andy said the panel should go through protocol,
the relay became addressable by its owner (R18), and **the same verb
became expressible as a packet** — post to the relay, get a signed reply
correlated by hash. The route and the message format were redundant, and
they were only redundant because the protocol was fixed afterwards.

Had this decision existed that morning, the order would have been:
notice the protocol cannot say it → decide → fix it → then write the
feature once.

**That is the whole cost of not having this rule: the feature gets built
twice, and the first build leaves a door open behind it.**

**Collapsed the same day.** `/api/relay/monitor`, `monitorMessage`,
`monitorSignatureOk`, `relay.setMonitor`, `hub.handleMonitor` and
`/api/hub/monitor` are gone. Nothing replaced them: the panel posts to
the relay the way it posts to a person, and `spirit/test/relayMonitor.js`
makes the same twenty checks it made before, through the packet.

Two things fell out that are worth having on the record, because they are
the argument for collapsing the other four:

- **The hand-rolled replay window was redundant too.** `monitorMessage`
  put the flag inside the signed bytes so a captured `start` could not be
  replayed as a `stop`. `postMessage` binds sender, recipient and the
  exact text, so it already covered that — the verb was buying a property
  the transport gives away.
- **The gate went with the door.** `setMonitor` re-derived the owner from
  `allow.byName` to decide who may ask. The post's own signature had
  already proved it. Two places deciding who the owner is, is one place
  to get it wrong, and every cheat below has its own copy of that code.

## The register

Every way of speaking on this wire, and what each one is. A new entry
requires a decision; `spirit/test/protocolSurface.js` goes red if the tree
holds one this list does not.

### The protocol

| | |
|---|---|
| `POST /api/relay/post` · `postMessage` | a peer drops a packet on a peer |
| `POST /api/relay/reply` · `receiptMessage` | the answer, by hash |
| `GET /api/relay/stream` · `streamMessage` | the wire itself |

### Bootstrap — cannot be a packet, by nature

| | |
|---|---|
| `POST /api/relay/claim` · `claimMessage` | **you cannot post to a relay you have no row on.** Permanently outside. |
| `GET /api/relay/who` | the public census, unsigned, and what a node reads *before* it has anything |
| `POST /api/relay/device` | posted by a browser that has **no identity yet** — that is the thing it is asking for |

### Dying with the ring (R8)

| | |
|---|---|
| `POST /api/relay/send` · `sendMessage` | |
| `GET /api/relay/inbox` · `inboxMessage` | |

Not cheats — they predate the router and are already sentenced.

### Cheats, named

Each could be a packet now that a relay is addressable by its owner
(R18). Each exists because it could not be, when it was written.

| | costs | undone by |
|---|---|---|
| `POST /api/relay/remove-peer` · `removePeerMessage` | a second door, and a minute window hand-rolled per verb — **now carrying the self path alone** | nothing, until a relay answers more than its owner |
| `GET /api/relay/status` · `statusMessage` | a second door; also replayable into other verbs if the message shape ever drifts | **nothing. It is bootstrap** — see below |
| `POST /api/relay/set-device` · `setDeviceMessage` | a second door | **nothing, as things stand** — see below |

Three cheats. Two more were listed here when this decision was written
and are **collapsed**: `POST /api/relay/monitor` · `monitorMessage` (the
worked example above) and `POST /api/relay/invite` · `mintMessage`, which
took the real hole with it. They are off this list because the list is of
things that exist; `spirit/test/protocolSurface.js` goes red in that
direction too, which is what stops the register drifting into a
description of a world that has moved.

### What stopped the other three — one sentence, and it is the same one

**A relay is addressable by its owner and by nobody else.** That
narrowing is what made R18 cheap and safe, and it is exactly what the
three survivors run into:

- **`set-device` is not an owner verb.** Every peer installs its own
  device key on its own row — `relay.setDevice` resolves the caller with
  `deviceIdentity` and verifies against whatever row key that finds (B2:
  *"nobody installs a key on a row they cannot sign for"*). A peer cannot
  address the relay, so there is nowhere for that request to go.
- **`remove-peer` is half an owner verb, and that half HAS collapsed.**
  The owner's way in is a post (`body.removePeer`), reached through
  `/api/hub/remove-peer` — the node-side interface this verb never had.
  `bySelf` cannot follow: a peer taking themselves off a relay signs with
  their own key, and a peer cannot address the relay at all.

  An earlier note here said collapsing only the owner half would "buy
  nothing" because the route and the format stand either way. **That was
  wrong, and this corrects it.** It buys two things. The route now carries
  one caller instead of two, so what it is *for* is legible — an exit, not
  an administration channel. And the owner's path stopped needing a signed
  verb, which is the thing that would otherwise have been copied the next
  time somebody added an owner action.
- **`status` is bootstrap, and this is the argument the decision asked
  for.** `presenceNode.start` calls `ownerBadge.probe`, which reads
  `GET /api/relay/status`, **to learn which relays to open streams to**.
  A relay's answer to a post is delivered on the asker's stream. So a
  posted `status` would need the stream that its own answer is what
  decides to open. That is circular, not merely awkward, and it puts
  `status` beside `claim` and `who` rather than beside the cheats.

Which leaves one question, and it is a protocol decision rather than a
tidy-up: **should a relay be addressable by every peer on it, for verbs
about their own row?** That would collapse `set-device` and the rest of
`remove-peer`. It also widens R18's narrowing, which was chosen on
purpose — today a peer posting to the relay's key gets `no such peer`,
the same answer an unknown key gets, and learns nothing. **Open. No code
until it is decided.**

## What this costs

**It will stop work.** That is the point, and the cost is real: the next
time something needs a word the protocol does not have, the answer is a
conversation rather than a commit.

The alternative is what the register above already shows — five doors,
four signed formats that each hand-rolled their own replay window, and one
genuine hole that survived because nobody had to justify the door it came
through.

## Open

- **Whether a relay should be addressable by every peer on it**, for
  verbs about that peer's own row. It is the one thing standing between
  `set-device` and `remove-peer` and a collapse, and it widens a
  narrowing that was chosen deliberately. Nothing gets built until this
  is decided.

## What a missing door taught this decision

The rule as written catches a protocol **extended** by hand. It said
nothing about one **absent**, and that turned out to be the more common
fault in this tree.

`relay.removePeer` had worked, been signed and been thorough since it
shipped, and **nothing under `run/` could reach it** — no route on the
node, no app that asked. A person could not remove anybody from their own
relay. Nothing about that was wrong anywhere a reader could see it: the
verb was correct, the route was correct, the register listed it honestly.
The defect was that the two never met.

`GET /api/hub/arrivals` was the same fault inverted — a door with no
caller, offering a weaker answer to a question `createArrivals.subscribe`
already answered better. Deleted.

Andy: *"These are the kind of things i wanted to know when asked about
impurities regarding protocol in the servers."* So the register is not
the whole inventory. **A verb with no interface and an interface with no
caller are both impurities**, and neither is visible to
`protocolSurface.js`, which can only compare two lists of things that
exist.

## Closed since this was written

- **`/api/relay/monitor` · `monitorMessage`** — deleted, with
  `relay.setMonitor`, `hub.handleMonitor` and `/api/hub/monitor`. Nothing
  replaced them.
- **`/api/relay/invite` · `mintMessage`** — deleted. `hub.handleInvite`
  keeps its door and posts underneath it; `relay.mint` takes no signature
  because the post already carried one. **The mint-replay hole closed as
  a side effect**, which is what this decision predicted would happen and
  the reason it was worth writing down rather than fixing the hole alone.
- **`/api/hub/remove-peer`** — the interface `relay.removePeer` never
  had, and the owner's half of remove-peer collapsed into a post on the
  way. The public route now carries the departing peer alone.
- **`GET /api/hub/arrivals`** — deleted with `hub.rowAsMessage`. No
  caller, and catch-up was already solved on the live channel.
- **Whether `GET /api/relay/status` is bootstrap** — it is, and the
  argument is in the register above: the stream a posted `status` would
  be answered on is the stream that `status` is what decides to open.
  It stays in the "Cheats, named" table with that reasoning beside it
  rather than being moved, so the next reader sees why it was argued
  rather than finding it quietly reclassified.
