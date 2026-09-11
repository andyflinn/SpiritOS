# The relay doorbell — one held connection per identity

**Status: arc, not scheduled. Opened 2026-09-11 against `babf22b`.**

Replacing polling between a relay client (a personal node, or a device browser)
and the relay, with one persistent connection carrying notifications.

---

## 1. Why — and it is not devices

With Relay Chat open, the node already calls the relay **30 times a minute**:
`setInterval(refreshInbox, 2000)` → `/api/hub/inbox` → `inboxRequest` → the
relay, each one a signed read verified across a ±1-minute window, so **up to 90
Ed25519 verifies a minute per node**.

Every other poll in the system is a rounding error on that number. The device
watcher we costed at one request a minute is one-thirtieth of traffic already
running. **Chat is the prize.** Devices come along free.

What a stream buys: one connection verified once instead of thirty verified
each, and messages arriving *when they arrive* instead of up to two seconds
later.

## 2. The shape: a wire, not a mailbox

Superseded by [decision 0006 — fast and true, not guaranteed](../decisions/0006-fast-and-true-not-guaranteed.md).
An earlier draft here proposed a **doorbell**: the stream would carry *"something
changed"* and the client would fetch content with a separate signed read. That
shape existed to protect a property — `inboxMessage` carries a minute so a
captured proof dies, and a doorbell leaks timing rather than content.

Decision 0006 removes the mailbox the doorbell was ringing about. **The stream
carries the message.** A relay delivers to a connected recipient or refuses, and
stores nothing.

Two things follow, and both belong here rather than in the decision:

**The connection needs a bounded life.** Authenticated once and held for hours,
it becomes the standing licence the minute window was designed to prevent — and
now it carries content. So: re-signed periodically, or dropped and
re-established on a schedule. Cheap; keeps the property.

**Presence becomes the node's, not the human's.** A personal node holds the
connection around the clock and files what arrives. That is what keeps
asynchronous messaging alive under a synchronous wire, and it moves the archive
to the machine that should have owned it all along.

Device offers ride the same wire: the offer arrives as an event rather than
being polled for.

## 3. The model, stated

Every relay client holds **one** connection and listens. To reach a peer, it
**posts**. The relay turns a post into a notification on the recipient's
connection. Apps are peer-to-peer in the sense that matters — they address each
other, not the relay.

**This is already the design at the envelope layer.** `packet.js` puts
`{app, v, id, body}` *inside* `text`, so the relay stores and returns it without
knowing what it is. Apps already trigger each other by posting. The stream is
the transport catching up with an envelope that was built for it.

**One connection, fanned out by `packet.app`** — which is exactly the rule the
shell already enforces one layer up: *"The page still holds exactly ONE
EventSource… an app opening its own would multiply the server's sseConnections
by the number of apps in the page."* Same shape, same reason, one level out.

### Three corrections to the picture

**It is not peer-to-peer in the confidentiality sense.** Every byte passes
through the relay, and `text` is stored in plaintext. Messages are **signed**,
so authorship is proven and the relay cannot forge one — but it can read them
all. "This host is only a mailbox" is a statement about its role, not a
cryptographic guarantee. If apps are to be genuinely private, content encryption
is a separate question, and the identity keys are Ed25519 — signing keys — so it
would mean deriving X25519 alongside. Not a blocker; not free either.

**The relay stores nothing.** Today `messages` is a 200-entry ring shared by
every peer, and `inbox` is a *filter* over it — nothing consumed on read, and
yours silently evicted once 200 have passed. Decision 0006 retires that
altogether: delivered, or refused, and the sender is told which. Durability
belongs to the recipient's own node.

**One socket per identity, not per app or per device.** N identities means N
held connections, which a relay carries by the thousand.

## 3b. Presence — the one service the model earns

The relay keeps a registry of held connections in order to route at all. *Who is
reachable right now* is that registry read out. **No storage, no lifecycle,
nothing kept on anyone's behalf** — it is a fact about live sockets, and it dies
with them. It sits inside decision 0006 rather than against it.

**It is also what makes refusal humane.** Under fast-and-true a send to an
absent peer fails; without presence, every send is a gamble reported after the
fact. With it, a To list can say who is reachable *before* anything is typed —
which is the chrome rule doing its job (`AGENT.md`): a composer aimed at
somebody unreachable is a form whose every value would be refused.

**It leaks nothing new.** Under this model any sender can already detect
presence by attempting a send — success and refusal are a presence oracle. An
explicit answer just makes it cheap and quiet instead of requiring a spammy
probe. Which gives the rule:

> **You may see the presence of anyone you may send to.**

**It rides the stream, not a poll.** *"bert connected"*, *"bert went"* as events
on the connection already held, fanned out like everything else. A live To list
with no polling at all.

**And the words matter.** Presence means *this node holds a connection*, not
*this person is there*. Under this design that is exactly the useful meaning —
reachability — but people read presence socially, so the UI must say "can be
reached", never "is online". A phone dark and a laptop shut change nothing about
whether a node is answering.

Presence is not perception: it is a live fact about the network, not a
judgement, so it does not touch the rule that the whoBook never leaves home. It
is the same shape as the owner badge — asked of the mailbox, answered by the
mailbox.

## 4. What it costs to build

- **Node has no dependable `EventSource`.** The wire format is trivial — lines,
  `data:`, blank-line separated — so this is a small client over `http.request`,
  not a dependency.
- **Reconnect becomes load-bearing.** A browser's EventSource reconnects itself;
  a Node client must. Once *all* traffic rides the stream, a silent failure to
  reconnect is worse than a missed poll. The existing pattern answers it: the
  node's `/api/events` writes a heartbeat every 20s and cleans up on `error` as
  well as `close`, because a socket that dies without a clean close never fires
  `close`. Silence means dead; reconnect with backoff.
- **Caddy must not buffer** a streaming response. It does not by default —
  confirm once.
- **The relay keeps a connection registry** keyed by identity, and a post fans a
  notification to the recipient's connection if it is held.

## 5. Interim, and what it replaces

Until this exists, every watcher polls on a timer, and the rule is simply that
the interval must be boring: **60s for the device watcher**, and chat's 2s stays
what it is because that is the latency a conversation needs.

When the stream lands it replaces both, and the device long-poll that was
considered for the interim is unnecessary — it would have optimised the smaller
number and been thrown away.

## 6. Open

- **How the connection's life is bounded** — re-signed on an interval, or
  dropped and re-established. It carries content now, so once-and-forever is not
  available.
- **Retiring `inbox`** deliberately rather than by neglect: the route,
  `checkInboxKey`, the minute window, `inboxSignatureFrom`. Good machinery
  answering a question that stops being asked.
- **A device's history.** It has no disk and cannot reach its own node directly,
  so it sees only what arrives while connected. The shape that resolves it — a
  device asking its own node over the relay — needs no new mechanism, but it
  needs writing down.
- Content encryption, if "peer-to-peer" is ever to mean private and not only
  authentic. The relay reads plaintext in transit even when it keeps none.
