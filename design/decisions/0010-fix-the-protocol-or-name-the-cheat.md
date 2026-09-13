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
the relay became addressable by its owner (R18), and **the same verb is
now expressible as a packet** — post to the relay, get a signed reply
correlated by hash. The route and the message format are redundant, and
they are only redundant because the protocol was fixed afterwards.

Had this decision existed that morning, the order would have been:
notice the protocol cannot say it → decide → fix it → then write the
feature once.

**That is the whole cost of not having this rule: the feature gets built
twice, and the first build leaves a door open behind it.**

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
| `POST /api/relay/invite` · `mintMessage` | **a real hole:** the signed bytes carry no clock and no relay identity, so a mint signature never expires, works on every relay where you are owner, and each replay mints a fresh token | posting it — `postMessage` binds sender, recipient and text, and the hash is registered before anything is sent |
| `POST /api/relay/remove-peer` · `removePeerMessage` | a second door, and a minute window hand-rolled per verb | posting it |
| `GET /api/relay/status` · `statusMessage` | a second door; also replayable into other verbs if the message shape ever drifts | posting it |
| `POST /api/relay/set-device` · `setDeviceMessage` | a second door | posting it |
| `POST /api/relay/monitor` · `monitorMessage` | **already redundant** — the packet path works and is tested | deleting it |

Five cheats, four of them older than this decision and one of them a
day old.

## What this costs

**It will stop work.** That is the point, and the cost is real: the next
time something needs a word the protocol does not have, the answer is a
conversation rather than a commit.

The alternative is what the register above already shows — five doors,
four signed formats that each hand-rolled their own replay window, and one
genuine hole that survived because nobody had to justify the door it came
through.

## Open

- **Collapsing the four older cheats** into packets. Now possible, not
  done, and it closes the mint-replay hole as a side effect rather than
  needing its own fix.
- **Deleting `/api/relay/monitor`**, which is redundant today.
- Whether `GET /api/relay/status` is bootstrap rather than a cheat: a
  node reads it before it holds a stream. Probably bootstrap, and it is
  listed as a cheat until somebody argues it properly.
