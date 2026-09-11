# 0006 — Fast and true, not guaranteed

**Decided 2026-09-11. Against `babf22b`. Not yet implemented.**

> If a relay cannot immediately relay, it returns an error immediately.

## The decision

A relay delivers a message to a connected recipient, or refuses it. It does not
hold, retry, queue, or promise. The sender learns the truth at post time.

Nothing is stored on a relay on anyone's behalf.

## Stated at full width

**A relay relays. It offers no sophisticated services, buffers nothing, and
stores nothing on anyone's behalf.**

Applied strictly, that reaches past messages, so here is the whole of what a
relay holds today and where each part lands:

| held today | under this decision |
|---|---|
| `messages` — the 200-entry ring | **gone**; delivered or refused |
| `identity.json` — the mailbox's own keypair | stays; it is the relay's, not a user's |
| `allow.json` — the owner record and device slot | **stays, and is the irreducible part** |
| `mailbox.json` — claimed peers | in question, see below |
| `invites.json` — tokens, expiry, consumption | **in question; this is a service** |
| the RAM handshake slot | already transient, already right |

**The allow list cannot go**, because it is the answer to *who may use this
relay at all*. Drop it and the box routes for anybody — which is a coherent
thing to be, but it is a different product.

**The peer directory is softer than it looks.** `resolveParty` already accepts a
key as readily as a label, and labels are display — perception lives on personal
nodes and is never uploaded. A relay that routed strictly by public key would
need no directory: a key cannot be impersonated without its private half, so the
claim exists to reserve a *name*, not to prove an identity.

**Invites are the one genuine service left.** Minting, expiry and one-shot
consumption are lifecycle, not relaying, and `invites.json` is state kept on
behalf of people. There is a stateless form — the owner signs a grant *bound to
the invitee's public key*, the relay verifies the signature and nothing else,
and replay is impossible because the grant names who may use it. The peer row
becomes its own record of consumption. The cost is a real change in the human
flow: the owner must know the invitee's key before minting, where today a spoken
token needs no key at all. Worth deciding on purpose; not part of this decision.

## Why

Every soft guarantee in the system was a lie of a different size. The 200-entry
`messages` ring holds words on a public box for a while, silently, and evicts
them without telling anybody — neither fast nor true. A node-side outbox with
retry would be the same promise made of patience instead of disk, and it
reorders time: a line written on Tuesday that flushes on Friday arrives with
Friday's clock and Tuesday's meaning.

A system that promises eventual delivery is promising something the world does
not honour. Better to say what happened.

## What it makes true

**The relay stops being a place where anyone's words rest.** *"This host is only
a mailbox"* becomes *"this host is only a wire."* It still sees traffic passing —
`text` crosses it in plaintext — but it keeps none of it, which disposes of
plaintext-at-rest on a public VPS without any cryptography at all.

**Durability moves to the recipient's own node**, which is where this
architecture already puts everything else: perception is never uploaded, the
whoBook lives at home, per-peer files live at home. Messages should be no
different.

## The consequence that would have been fatal, and its answer

Read naively, this ends asynchronous messaging: write to someone asleep, get an
error.

It does not, because **presence is the node's, not the human's.** A personal node
is on around the clock; it holds the connection, receives, and files locally.
The recipient's laptop being shut, or their phone dark, changes nothing. The
answering machine moves from the relay to the recipient's own hardware — which
is the correct owner of it.

What genuinely fails is a recipient whose node is *down*. The sender is told so,
at once. That is the case this decision accepts on purpose.

## What it costs

**`inbox` as a route loses its reason to exist**, and with it a good deal of
hard-won machinery — `checkInboxKey`, the minute window in `inboxMessage`,
`inboxSignatureFrom`. That machinery solved a real problem and solved it well;
it simply answers a question that stops being asked. Retire it deliberately, not
by neglect.

**A device browser cannot be its own archive.** It holds a key in
`sessionStorage`, has no disk, and cannot reach its own node directly. Under
this decision it receives only what arrives while it is connected.

The shape that resolves it: **a device is a client of its own node, over the
relay.** The node holds the history and answers the device's requests for it as
ordinary signed traffic on the same wire. No new mechanism — the device already
speaks as the identity, and `packet.js` already carries an app name.

**A stream that carries content cannot be authenticated once and held for
hours.** While the plan was a doorbell — *"something changed"*, with content
fetched by a separate signed read — a captured connection leaked timing and
nothing else. Delivering content over the stream removes that argument, and the
minute window existed precisely so a captured proof would die. So the connection
needs a bounded life: re-signed periodically, or dropped and re-established on a
schedule. Cheap, and it keeps the property the minute window was protecting.

## What already agreed with this before it was decided

`inbox` is a *filter* that consumes nothing. `consoleExchange` returns its reply
inside the send response and stores nothing, deliberately, because a console
that wrote two ring entries per command would evict real traffic. The relay was
already drifting this way; this names it.

## Status

Decided. Superseded by nothing. Implementation unscheduled — see
[../relay/EVENT-STREAM.md](../relay/EVENT-STREAM.md) for the transport this
depends on, which must land first.
