# 2026-09-12 — transport, below the node boundary

**Status: OPEN — 16 requirements, 13 done.**

Opened as a contract under [the method](README.md). Two sittings: the
first settled scope and cleared two preliminaries (R1, R2); the second
costed the whole job (R3–R9). Done: R1, R2, R3, R4, R6. R10 was found by
building R3, and it blocks R8.

---

## 1. Goal and scope

**Goal** (Andy): *"clean up transport usage from ground up, to the
boundary of node."*

**Scope: `spirit/run/` only.** Not `spirit/test/`, and not the browser —
apps and the shell sit above the boundary and are a separate contract.

**The boundary** is the node's HTTP surface, `/api/hub/*`. Above it is the
browser. Below it is `spirit/run/js/**` (excluding `client/`),
`spirit/run/process/**`, and the relay.

### Principles this cycle works under

**`spirit/run/` must be fully operational with `spirit/test/` deleted.**
Nothing in `run/` may require, read, spawn or depend on anything under
`test/`. A comment may cite a test as the place a rule is proven; nothing
else may name it. The dependency runs one way only — `test/` reaches into
`run/` freely, which is what every suite does.

**`process/` scripts are product.** They are spawned by Jobs and they
appear in the Processes app, so they answer to the same standard as an
app. A process script that only works against a lab is mis-filed by
definition, not merely untidy.

---

## 2. What the tree says (checked, not assumed)

Measured at `7734ecc`.

**Known before we started** (Andy): *"Nothing above the node uses the
packet transport."* Confirmed — of 16 apps, zero use it. The five files
that do are the ones that implement it.

**Two terms, kept apart**, because conflating them is what makes Relay
Chat look half-migrated:

- **the packet envelope** — `{app, v, body}` inside the text
  (`packet.js`, `api.onPacket`). Says *which app a message is for*.
- **the transport** — how bytes travel: the **router** (post → held
  stream → signed receipt, nothing stored) or the **ring** (send → the
  relay keeps 200 → the far end polls `inbox`).

They are independent. Chat uses the new envelope on the old transport.

**Below the boundary, 35 modules. Eleven mention transport; four of those
are false positives** (`messages` meaning an AI request array in the
image-captioning scripts). Four more are comments only — `kernel.js`,
`relayAuth.js`, `chatLog.js`, `trafficLog.js`.

**Already compliant:** `peerPost.js` *is* the protocol; `presenceNode.js`
routes stream events into `onRequest`/`onReply`; `sseClient.js` is the
stream client.

**Non-compliant, and its size:**

| where | what | size |
|---|---|---|
| `relay.js` | `send()` | 159 lines — the largest function in the file |
| `relay.js` | `inbox()` | 53 |
| `relay.js` | `consoleExchange()` | 56 — reached *through* `send`, and not peer transport at all |
| `relay.js` | the `messages` ring | 19 refs |
| `hub.js` | `handleSend`, `handleInbox` | 2 handlers |
| `process/js/relayLabPing/` | send-then-poll smoke test | 2 files |

Against **198 lines** for the router it duplicates (`routePost` 40,
`routeReply` 50, `post` 60, `streamOpen/Close/Roster` 48).

**Three facts that shape any plan:**

**The relay never makes an outbound HTTP call.** `relay.js`,
`presence.js`, `router.js`, `invites.js` and `relayConsole.js` contain no
`fetch`, no `http.request`, no `require('http')`. It serves requests and
pushes down streams it already holds. Every outbound byte in the system
comes from a node.

**The boundary has two doors, and `peerPost` owns neither.** It is handed
a request function (`var request = opts.request`). The wire lives in
`hub.relayRequest` (node → relay, `lib.request`) and `sseClient` (the held
stream, global `fetch`). Andy has accepted that trio as justified. Nothing
prevents a fourth caller appearing with its own `fetch` — which is how
`relayLabPing` got one.

**The inbox credential machinery does not all die with the inbox.**
`inboxSignatureFrom` is used by `relay.js`, `server.js` **and
`sseClient.js`** — it is the rule that a signature arrives as a header and
never on the query string, and the **stream** reuses it.
`inboxMessage`/`inboxSignatureOk` are used by `deviceAuth.js`. Roughly two
of the five survive and want renaming, not removing.

**And `/api/hub/post` has no hub handler** — it is inline in
`server.js:1127`. The old transport has proper handlers; the compliant
path is the one without a home.

---

## 3. Requirements

### R1 — `relayLabPing` is removed from `run/`
> it must be removed from run/ — agreed?

A dead smoke test filed in the product tree. It cannot work anywhere: it
points at `127.0.0.1:65430` (nothing listens; the lab runs on 65425), it
sends to `bert` (not on the lab relay), it rides `send`/`inbox`, and its
own manifest says it *"requires the three temp nodes from spirit/test"*.
On a personal node it fails at connect; on a relay `/api/jobs` is 404 so
Jobs cannot spawn it at all.

It is worse than dead code: it has a manifest, so it is a **button in the
Processes app that cannot work** — and the string a user reads is the one
place `run/` declares a dependency on `test/`.

Deleting: `relayLabPing.js` and `relayLabPing.json`.

**Carried a consequence, and it was honoured in the same commit:**
`servableAssets.js` used it as the specimen for *"process scripts are
readable, never writable"*. That rule is about `process/` as a directory
and outlives any script in it, so the specimen moved to `imageStats` —
which talks to no external service and depends on no lab, making it the
process script least likely to be the next one deleted.

**Verify:** `spirit/test/runStandsAlone.js` — "nothing under spirit/run/
names the harness, in code or in a manifest string"; the specimen itself
in `spirit/test/servableAssets.js` — "process/js/imageStats/imageStats.js"
**Status:** DONE

### R2 — `run/` operates with `test/` deleted
> Are we agreed that node and relay must be fully operational, even if the test folder was completely deleted?

Already true in code: no `require`, no runtime path. The only violation is
R1's manifest string. Stated as a requirement because it is the kind of
rule that decays silently — a single `require('../test/…')` added in
haste would not fail anything until somebody shipped.

Built as [`runStandsAlone.js`](../../spirit/test/runStandsAlone.js): 539
files scanned, comments stripped, JSON read whole — because the only
violation in the tree was a *description string* in a manifest, which is
a sentence a user reads.

**False negatives only, on purpose.** A `//` inside a string truncates
that line, so a reference after one on the same line would be missed. A
suite that cried wolf about `https://` would be deleted by the third
person who tripped over it, and then the rule would have nothing at all.

One exemption, named as an exact file rather than a pattern:
`buildStamp.js` names the directory in order to **exclude** it
(`':!spirit/test'`), and a check asserts that exemption is still earned —
an exemption nobody needs is a hole nobody is watching.

**Verify:** `spirit/test/runStandsAlone.js` — "nothing under spirit/run/
names the harness, in code or in a manifest string", plus "the scanner
catches the sentence that was actually in the tree". Proven able to fail:
a planted `require('../../test/…')` in `chatLog.js` turned it red.
**Status:** DONE

---

## The second sitting — 2026-09-13

Andy: *"I want a contract to purify the system layer of SpiritOS, so that
the server and relay offer, if possible, single point interfaces for
Posting to peers with reply, and to (conceptually) subscribe to POSTs from
peers."* Then: *"what would it really take to move the relay into complete
compliance?"*

**Compliant, defined:** one way to post to a peer with reply, one way to
receive posts from peers, on both surfaces, with no second transport
underneath.

### The 25 routes, classified

**Node, 13:** three are peer data (`post`, `send`, `inbox`), five are
relay administration (`claim`, `peer`, `invite`, `status`, `who`), five
are node-local and never cross the WAN (`contact`, `unknown-senders`,
`rotate-password`, `device`, `handle`).

**Relay, 12:** five are peer data (`post`+`reply`, `stream`, `send`,
`inbox`), seven are administration.

**Post with reply: two entry points at the node boundary, not
equivalent.** `post` carries a reply; `send` does not. The correct one is
the only `/api/hub/*` route with no handler.

**Subscribe: one entry point, and it serves the transport being
retired.** The router path has **none**. This is the finding that changes
the shape of the work — a third of it is building an interface that does
not exist, not consolidating two that do.

**Where a single point is not achievable:** the relay needs `post` and
`reply` as two routes, because the answer arrives on a different
connection from a different party. One interface, two doors, and it stays
that way.

---

## Requirements — the second sitting

### R3 — the node has an arrival interface at all
> I'd rather see apps breaking than apps faking

`peerPost` has an `onArrival` hook ([peerPost.js:90](../../spirit/run/js/peerPost.js#L90))
whose only caller in the tree is `spirit/test/frontDoor.js:72`.
`server.js` builds `createPeerPost` with `answer`, `admit`, `remember`
and `traffic`, and no `onArrival`. So an app packet arriving over the
router is answered with a bare receipt by
[`answerRelay.answer`](../../spirit/run/js/answerRelay.js#L184) — which
handles `device-offer` and returns `''` for everything else — and
dropped. Nothing above the boundary can ever see it.

Wants `onArrival` wired, and a carrier to the browser. `/api/events`
already exists as an SSE for Jobs
([server.js:335](../../spirit/run/js/server.js#L335)); a `packet` event on
it needs no new route.

Built as [`arrivals.js`](../../spirit/run/js/arrivals.js) — a seam, not a
feature: peerPost's front door has already decided who may be heard, and
the shell decides which app wants it, so this holds subscribers, decodes
the envelope once, and hands each of them the same message. `server.js`
subscribes from `handleSseConnection` (a `packet` event on the
`/api/events` stream the page already holds) and notes into it from
`createPeerPost`.

`decorateWithPacket` moved from `hub.js` into
[`packet.decorate`](../../spirit/run/js/packet.js) on the way, so the
ring and the router build `message.packet` with one function rather than
two that can drift.

**Verify:** `spirit/test/arrivals.js` — "a real post from a known peer
comes out of the seam as a chess packet", and its negative half "a
stranger reaches no app at all — the front door binds before the seam"
**Status:** DONE

### R4 — the shell's packet fan-out has a source of its own
The shell already routes on `packet.app` into `packetHandlers`
([shell.js:1647](../../spirit/run/js/client/shell.js#L1647)). It has no
source. Its source is **Relay Chat's poll**
([relayChat.js:597](../../spirit/run/app/relayChat/relayChat.js#L597)),
which hands its catch to `api.deliverPackets` for the shell to fan out.

So every app's `api.onPacket` depends on Relay Chat running — the app
this cycle exists to retire. Recorded as its own requirement because it
is invisible from either file alone.

Now two sources, and the handlers cannot tell them apart — the router's
`packet` event and the ring's `api.deliverPackets`. The ring's half goes
with R8; nothing above it changes when it does.

**Verify:** `spirit/test/arrivals.js` — "the shell subscribes to `packet`
on the node event stream" and "a packet on that stream reaches the app
that asked for it, body first", both against the real `shell.js` booted
in Node with no Relay Chat present at all
**Status:** DONE

### R5 — `api.sendMessagePacket` posts on the router
[`shell.js:1274`](../../spirit/run/js/client/shell.js#L1274) is already
the single point for apps — they never name an HTTP path and never see a
signature. It points at `/api/hub/send`. Pointing it at `/api/hub/post`
moves every well-behaved app at once.

`relayChat.js:590` and `:1129` and `natter.js:428` call the paths
directly, bypassing the api, and move by hand.

**THE BREAKAGE, named in advance so it is a decision and not a surprise
on the day:** `send` holds for an offline peer and answers 200. `post`
refuses with 503. Chat to somebody who is not connected stops working.
That is the point of the cycle, and it is Andy's call to take it, not
something to discover.

**Scoped to the WRITE half.** `/api/hub/inbox` is still wired, and
retiring it is R8 — chat's poll also drives contact acquisition and
`peerStats`, which the router path does not do (see R11).

`handlePost` learned the packet envelope on the way, through the same
`outgoingText` the ring used — so a packet sent by the router is
byte-identical to one the ring would have sent, and there is one place
that decides how an app's `{app, body}` becomes bytes.

Chat's send moved with it, and had to change what it FILES: the ring
answered 201 with the message the relay had stored, and chat filed the
relay's copy. Nothing is stored now, so the record is built from what was
typed — which is the only copy of that line that will ever exist.

**Verify:** `spirit/test/hubPost.js` — "nothing above the boundary names
`/api/hub/send` — 41 files scanned"; `spirit/test/chatSession.js` — the
breakage asserted rather than tolerated: "a 503 is shown as a refusal in
plain words, not as a status code", "nothing was written to the peer file
— a refused line did not happen", and "what was typed is still in the
box, to try again or copy out".
**Status:** DONE

### R6 — `/api/hub/post` has a handler like every other hub route
The only `/api/hub/*` route implemented inline in `server.js`
([1127-1160](../../spirit/run/js/server.js#L1127)). Roughly 35 lines, and
they are not plumbing: they decide whether this node is attached to a
relay, **which relay to send through** (`presence.relaysNaming(to)`,
first match, `via` override), and what "unreachable" means. That rule
lives in the web server rather than the transport layer, and can only be
reached over HTTP — every other hub verb can be called as a function.

Moved to `hub.handlePost`, with `peerRouter` and `presence` handed in as
`deps` at call time rather than closed over — they are built at the foot
of `server.js`, long after `createHub` runs, and a setter would make
`hub.js` hold state it cannot see created.

It **returns** its promise, unlike the older handlers beside it. A
handler whose completion cannot be observed can only be tested by
sleeping, and a test that sleeps is one that goes flaky on a slower
machine.

**Verify:** `spirit/test/hubPost.js` — "with two relays naming the peer,
the first is used and the app is not asked" and "a `via` no relay matches
is refused, never silently rerouted". The routing rule had never been
stated anywhere but in a web server's switch statement.
**Status:** DONE

### R7 — the relay console is deleted
> console exchange is not something i like to see at all. it's near
> useless, when this sort of information could be streamed to the
> owner-node, permitting a real-time monitor in shell for the relay
> memory status etc....

**Supersedes the earlier form of R7** — *"`consoleExchange` has a home
outside `send`"*, which assumed the console was worth relocating. Grok's
ordering said find it a home before the ring goes. Deleting it is a home.

The console has eight words and **not one of them changes anything**. Six
of the eight return data that is already public:

| word | returns | already public? |
|---|---|---|
| `help` | the word list | yes — the repo is public |
| `whoami` | your own label and key | the caller already knows it |
| `status` | mode, owner, peer count, message count | `/api/relay/status` |
| `peers` | the peer list | `/api/relay/who`, to anyone, unauthenticated |
| `search` | a filter over that same list | same |
| `key` | the mailbox key | in the census |
| `version` | the running commit | — |
| `invites` | live tokens | **the only owner-private one** |

So `RELAY_CONSOLE_OWNER_WORDS`, the `isOwner(src) && signedByHouseKey`
check and the *"that one is the owner's"* refusal exist to protect **one
word**.

Deleting: [`relayConsole.js`](../../spirit/run/js/relayConsole.js) (208
lines), `consoleExchange` ([relay.js:489](../../spirit/run/js/relay.js#L489),
56 lines), `spirit/test/relayConsole.js` (64 checks), and `relay` as an
addressable **destination**
([relay.js:237](../../spirit/run/js/relay.js#L237),
[678](../../spirit/run/js/relay.js#L678)).

**Two things that must survive, and they are not the same rule.** `relay`
stays reserved as a **claimable name**
([relay.js:301](../../spirit/run/js/relay.js#L301),
[relayAuth.js:308](../../spirit/run/js/relayAuth.js#L308)) and as an
**invite label** ([relay.js:450](../../spirit/run/js/relay.js#L450)).
Those are namespace rules and have nothing to do with the console.

**Carries a simplification:** the `toConsole` carve-out in the device
confinement ([relay.js:645](../../spirit/run/js/relay.js#L645)) goes with
it, leaving that rule as plainly *a device may only reach its own
identity* — one clause shorter. R7 of
[the device cycle](2026-09-12-device-and-node-defence.md) must still pass
afterwards.

**One thing the deletion exposed, and it needed fixing rather than
noting:** with the console gone, a line to `relay` did not error — it
fell through and became an ordinary ring entry addressed to a name no
peer holds, `toKey` null, which nobody can ever read back because
`inbox('relay')` is refused for everyone including the owner. A junk sink
that looks like a delivery is precisely what removing the console was
meant to stop, so the reserved name is now **refused outright (404)**.

**And the device page lost its only post-enrolment function.** Its
"Send to relay" box posted to `/api/relay/send` addressed to `relay`; it
went with the console rather than being left to write into a ring nobody
reads. An enrolled device now says who it is and nothing more — which is
honest about where the device arc actually is, and consistent with the
architecture: a device's correspondent is its node, not a relay.

**Verify:** `spirit/test/firstOwner.js` — "a line to the reserved name is
refused — nothing answers to it now" and "the name itself is still
unclaimable, which was never about the console";
`spirit/test/devicePeers.js` — "not the relay either — the last exception
to its confinement is gone"; `spirit/test/liveFrontDoor.js` — "the
handheld cannot reach the reserved name over the wire either — 403"
**Status:** DONE — R8 unblocked

### R9 — the relay streams its own condition to its owner
> permitting a real-time monitor in shell for the relay memory status etc....

What replaces the console, and it is **new capability rather than a
port**: memory, uptime, open sinks, routes in flight. None of it is
anything the console could have answered.

This is [decision 0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md)
made observable. *A relay survives and earns its keep* — and today there
is no way to learn whether it is surviving except an SSH session.

**Cheaper than it looks, for one reason:**
[`presentNow.send(id, event, data)`](../../spirit/run/js/presence.js#L108)
is already targeted — only `broadcast` is unfiltered. So an owner-only
push needs **no change to `presence.js`**, and none of the
recipient-aware work R11 will need. The relay already holds the owner's
key in `allow.byName`.

**No conflict with 0006.** A relay that pushes its own condition stores
nothing on anyone's behalf. But it is a second kind of traffic on a
stream that has carried only peer traffic, and the owner's node must be
free to ignore it.

Built as [`relayStatus.js`](../../spirit/run/js/relayStatus.js) (the
report, pure) plus `relay.statusToOwner()` (the delivery). The split is
deliberate: the rule that must never be got wrong lives next to the key
it depends on, and the part that formats numbers is testable without a
relay at all.

Pushed on every presence change, and on a 10-second timer in `server.js`
for the figures that move when nothing else does — a monitor on a quiet
relay that looked frozen would be worse than none.

**What it carries that nothing else could answer:** requests in flight,
memory (rss *and* heap — the gap is the interesting figure on a box made
of sockets), uptime, and **live invites**, which are in no census and on
no public route. Labels and expiry only: the token is a credential and a
monitor is a view, not a place to leave secrets on a screen.

Reachable rather than merely held — `presenceNode` keeps the latest
report per owned relay and `/api/hub/status` returns it under
`relayStatus`, keyed by url and **absent** rather than empty for a relay
that has not spoken. "Not told yet" and "told me nothing" look identical
to a careless reader and mean very different things.

**Verify:** `spirit/test/relayStatus.js` — "the owner gets a report
without asking, as soon as its stream is open" **and its negative half**,
"a peer who is not the owner gets none at all — this is send(), never
broadcast()", plus "no invite label anywhere in a non-owner's stream".
Every other event on this stream travels by `broadcast`, which cannot
express a recipient, so the wrong function is the familiar one and one
word away.

Verified live over real HTTP against a relay started from the repo: the
report arrives at stream-open and again on the tick, memory moving
between them, and no token in either.
**Status:** DONE

### R10 — a packet that arrives while no page is open is not lost
**Found by building R3, and it is the reason R8 cannot simply follow.**

The seam delivers live. With no browser open there is no subscriber, and
the packet is **dropped** — not held, not queued, not counted as
pending. The ring being retired does not have that hole: the relay held
200 messages and the far end collected them whenever it next looked.

So as things stand today, a live push is **strictly less** than a poll
against a buffer, and deleting the ring would be the one migration that
makes the system worse. That is not a reason to keep the ring; it is a
reason this has to be answered first.

The bytes are not actually lost —
[`trafficLog`](../../spirit/run/js/trafficLog.js) already keeps every
packet that crossed the WAN for 24 hours, payload included. What is
missing is delivery: what counts as already-seen, and by whom, when a
page opens. That is a design question and it has not been asked yet.

**Answered by Andy, 2026-09-13: the node keeps ONE mark.** A packet
counts as seen once it reached at least one live page; everything after
that is replayed to the next page that opens. No watermark in the
browser, no new rule for apps.

**And the obvious home for the backlog could not be used.** `trafficLog`
already keeps every packet for 24 hours, payload included — but it
records **arrival, not admission**: `peerPost` logs a *held* packet as
`outcome: delivered` **with its payload** and then deliberately hands it
to no app, because a stranger waiting to be accepted is a decision a
human makes. Replaying from the traffic log would hand an unaccepted
stranger's packet straight to an app and walk the front door back.
`arrivals` is the only thing that sees both *admitted* and *delivered to
a page*, so the backlog lives there —
`relay-state/pendingArrivals.json`, gitignored, unservable, unwritable,
temp-file-then-rename.

**AND NO CLOCK — corrected the same day.** It shipped with a 24-hour
window copied from `trafficLog`, and Andy caught the analogy: that file
is a **record** of what crossed the WAN and a record may age out; this is
**undelivered mail**, and ageing it out is data loss *after* an
acknowledgement. A receipt true when signed and a lie by morning is the
false positive [ROUTER.md §4](../relay/ROUTER.md) forbids — and exactly
the sin 0006 removed from the relay, relocated somewhere harder to
notice. The bound is the node's own disk, on the node's own machine, in a
file somebody can look at: the three things the ring was not.

**What it still does not do, said out loud:** the mark is one mark, not
one per page. The first page to open drains the backlog; a second
opening after it gets nothing. A tab that opens and closes at once
consumes what it was handed — the same failure a poll that read and then
crashed always had, and the price of keeping no per-browser state.

**Verify:** `spirit/test/arrivals.js` — the old check named the gap ("the
packet is dropped, and says so") and was **replaced rather than deleted**,
because 0 delivered is still 0 delivered whether a packet was thrown away
or kept. Now: "with no page open nothing is delivered — and the packet is
HELD, not dropped", "the first page to open is handed it, after which it
is forgotten", "a second page opening after it gets nothing — the mark is
the node's, not the page's", "a page that throws does not count as having
received it", "a packet held while the node was down is still there when
it comes back", and — the reversal — "a packet a YEAR old is still
waiting: undelivered mail has no clock, whatever the receipt promised".
**Status:** DONE — R8 no longer blocked on this

### R8 — the ring is deleted
> `send` / `inbox` / `status` are retired

The same requirement as R14 in
[the device cycle](2026-09-12-device-and-node-defence.md), which is where
it was first agreed; kept there and costed here.

`relay.js`: `send()` 159 lines, `inbox()` 53, the `messages` ring 19
refs. `hub.js`: `handleSend`, `handleInbox`, `inboxRequest`,
`sweepInbox`, `applyInboxBatch`. Four routes. Against **198 lines** for
the router that already does the job.

**Does not all die with it:** `inboxSignatureFrom` is used by `relay.js`,
`server.js` **and `sseClient.js`** — it is the rule that a signature
arrives as a header and never on a query string, and the stream reuses
it. Rename, do not delete.

**Verify:** not written.
**Status:** OPEN — blocks on R11

### R11 — what the ring does BESIDES carrying messages must not vanish with it
**Found by building R5.** The inbox poll is not only a read. Through
`applyInboxBatch` it also runs `acquireFromInbox` (a stranger becoming a
contact, under the `acquire` policy), `holdFromInbox`, and
`countInbound` → `peerStats.noteIn`.

**The router path does none of that.** `peerPost` has no `peerStats`
reference at all, so a node moved fully onto the router would silently
stop counting inbound traffic per peer — the numbers Contacts shows would
freeze rather than go to zero, which is worse.

Recorded rather than fixed in R5's commit because it is the ring's READ
half and belongs with R8, and because a silent statistic is exactly the
kind of thing that disappears between two commits nobody connected.

`peerPost` now calls `peerStats.noteIn` on the arrival path, keyed by the
**request hash** rather than a relay's message id — the id existed only
because a non-destructive poll could hand the same line twice, and the
hash is over the exact bytes rather than a number somebody else assigned.

Per peer, never per app: a count of *"chess packets from bert"* would be
the node doing the shell's reading.

**Verify:** `spirit/test/liveFrontDoor.js` — "alfa is counted in the
per-peer numbers bravo keeps — the router moves them now, as the ring
did", over the wire between real nodes.
**Status:** DONE

### R13 — the log is readable as a table
> The node will provide client(s) with an api block that treats the log like a database file with the primary keys being hash, arrival-date.

**And it is the log that already existed.** `trafficLog` has recorded both
directions since it landed, keyed by exactly that pair. Three things were
missing, none of them a second store:

**Admission.** `outcome: 'delivered'` meant *arrived and filed*, which is
equally true of a packet the front door **held** for a human decision —
both in the file, both with their payload, indistinguishable. Reading the
log back without that distinction would hand an unaccepted stranger's
line straight to an app. Rows now carry `admitted`.

**Retention that contradicted itself.** 24 hours is right for a *record*
and wrong for *undelivered mail*. Resolved per row state rather than per
file: a row that is admitted and not yet `takenAt` outlives any window;
everything else ages at the clock. That also folds R10's separate
`pendingArrivals.json` back into the one log.

**A read surface, and a contained one:**
> only an entity that knows the internal package structure (shell) can fan out based on the internal package structure, so the read-log-interface the node provides should be fairly contained.

`since` + `limit`, or one row by `hash`. **No filter on `packet.app`,
ever** — the node keys on public keys and hashes, and routing by app is
the shell's reading. Rows come back in the same shape the live push
sends, so a catching-up client merges one shape rather than two. The
store stays payload-agnostic: the decode happens on the way out.

**Verify:** `spirit/test/trafficLog.js` — "only an ADMITTED inbound row
is an arrival", "`since` is a position, not a filter", "the surface offers
no way to ask by app", "two days on the unread packet is still there and
the read one has aged out"; `spirit/test/liveFrontDoor.js` — "bravo
answers /api/hub/arrivals with the one line it agreed to hear" and "the
post it IGNORED is absent from that table, though both are in its log".
**Status:** DONE

---
### R14 — one owner per store, and production code goes through it
> tests can read what they need to read, production code MUST read through the API. I'm sure there's local-disc databases that can boost performance down the road….

The last clause is the requirement. A file is an implementation, not an
architecture: `traffic.json` should be able to become SQLite without
anything above it noticing — and that is only true while **exactly one
module knows the filename.** The moment a second opens it directly, the
file format *is* the interface and swapping it is a rewrite.

Tests are explicitly exempt. A suite reading a store's file to see what
really landed is doing its job; that is the difference between checking a
claim and depending on a shape.

**It was written because it had already been broken.** `arrivals.js` grew
its own `relay-state/pendingArrivals.json` beside the traffic log — two
copies of *what is still waiting*, able to drift — and the commit message
for R13 claimed the fold had happened when it had not. A claim in prose
is not a check. `arrivals.js` now keeps nothing on disk and reaches the
log through its api block; the retired filename is asserted gone by name,
so its return would fail with a reason rather than pass in silence.

**Verify:** `spirit/test/storeOwnership.js` — seven stores, each known to
one module, plus "pendingArrivals.json is gone and stays gone".
**Status:** DONE

### R15 — the log is permanent, and pays for it with an append
> the log should be permanent. period.

The window is gone, and so is the rule that exempted undelivered mail
from it: nothing ages out, read or unread, inbound or outbound. It was
never a privacy measure — it was *"certainly enough to test concepts
surrounding logfiles"* — and what it did was make this node's record of
its own traffic the one thing in the system that forgot.

**Permanence forced the write path.** A 24-hour window and a whole-file
rewrite could coexist; permanence and a whole-file rewrite cannot — a
node running a year would rewrite a year of traffic on every packet. So
`traffic.json` became `traffic.jsonl`, append-only, and a write is O(1).

The failure mode improved rather than merely changing: a torn append
costs the line being written and nothing behind it. **And the existing
corrupt-file check caught the bug in the first attempt** — a file that
does not end in a newline is exactly what a torn write leaves, and
appending onto it glues the next row to the broken one and loses both.
`append()` reads the last byte and breaks the line first.

**Verify:** `spirit/test/trafficLog.js` — "a year-old entry is still there
beside a new one", "reading it leaves the file byte-for-byte as it was",
"a torn last line is skipped, leaving everything written before it", and
the migration, "a log written in the old whole-file shape is still read".
**Status:** DONE

### R16 — the log must be able to PROVE what it claims
> database decision deferred until proof that the system in itself can verify its promises.

**The condition on the database decision, and the system does not meet it
yet.**

Every packet arrives signed. `peerPost` verifies the signature, acts on
it, and **never stores it** — no row in `trafficLog` holds a `sig`. So
`outcome: 'receipted'` is this node asserting something about itself, and
an inbound row is a line this node could equally have written for itself.

| the promise | what is stored | provable |
|---|---|---|
| *bert sent me this* | peer, hash, payload | **no** |
| *bert received mine* | `outcome: 'receipted'` | **no** |
| *bert acted on it* | — | unreachable (R12) |

**This got worse when the relay stopped storing things**, which is worth
saying plainly: under the ring, the relay was a witness — the message was
on it and could be pointed at. Decision 0006 removed that on purpose, so
the node's own log is the only record left, and a record nobody can check
is a diary rather than evidence.

**What it takes:** keep the signature on the row. An inbound row with
`from` + `text` + `sig` lets anyone recompute the hash and verify *that
peer* signed *those bytes*. An outbound settle row with the receipt's
`sig` over the hash is proof the far end acknowledged. About 88 base64
characters a row, against payloads already larger than that.

Then the three states of [ROUTER.md §3a](../relay/ROUTER.md) stop being
labels this node applies to itself and become things it can demonstrate
— which is what "the system can verify its promises" has to mean.

**Verify:** not written. Wants a check that a stored row can be
independently verified from the log alone, and its negative half: a row
whose signature does not match the bytes is reported as unverifiable
rather than quietly trusted.
**And it is now the larger claim**, since
[decision 0009](../decisions/0009-the-log-is-the-training-set.md): if this
record is what a manifestation of a person is formed from, provenance is
the whole game. A memory you cannot verify is one you cannot trust to
have formed you honestly.

**Status:** OPEN — and 0009 settles the database question separately:
files in the core indefinitely, a plugin behind this api block if anyone
ever wants one.

---

## Not yet agreed

### R12 — an app can reply, and a reply is the only evidence of being read
> It's only when a reply arrives from the human with a hash of the message he responds to, can the sender be reasonably certain that the package was read… peer to peer consent over the status of a uniquely identifiable package.

**Agreed as a model, and the third state is currently unreachable.**
[ROUTER.md §3a](../relay/ROUTER.md) now records it: *not delivered* /
*delivered* / *acted on*, with nothing between the last two, because an
app being mounted is not a human reading — a `seen` flag would have been
two green checkmarks, a false positive dressed as precision and signed.

What is missing is the third state's mechanism, and it has the same shape
as the arrival gap R3 closed:

- [`deliverPackets`](../../spirit/run/js/client/shell.js) **discards the
  handler's return value**, so an app has no way to say anything back.
- [`answerRelay.answer`](../../spirit/run/js/answerRelay.js) returns `''`
  for everything that is not a `device-offer`, so the reply is always the
  bare receipt.

So the router has carried a reply channel since it landed — `routeReply`,
correlated by hash, signed by the recipient — and **no app has ever been
able to use it.**

**Verify:** not written. Wants a packet answered by a real app handler,
the reply reaching the original sender correlated by the same hash, and
the negative half: an app that says nothing leaves the bare receipt, with
no `seen`, no tick, and no inference.
**Status:** OPEN

---

## Not yet agreed — a second contract, recorded so it is not lost

**The relay as an addressable post target.** Today `routePost` resolves a
destination through [`deviceIdentity`](../../spirit/run/js/relay.js#L827),
which knows the owner and peer rows and nothing else; the relay's own
identity is neither, so posting to it is `404 no such peer`. And
`presentNow.isPresent` would refuse anyway — a relay holds no stream to
itself, which [routeReply names as *"the one asymmetry in the whole
arrangement"*](../../spirit/run/js/relay.js#L1206).

If it were a target, `/api/relay/invite`, `/api/relay/remove-peer` and
the console collapse into the one interface, **and the mint-replay hole
closes for free** — `postMessage` binds sender, recipient and text, and
the hash is registered before anything is sent.

That hole, measured: `mintMessage` is `'mint\n<label>\n<days>[\n<token>]'`
— no clock and no relay identity, unlike `remove-peer` which carries a
minute. So a mint signature never expires, is valid on every relay where
you are the owner, and each replay mints a *new working token* because
[`invites.add`](../../spirit/run/js/invites.js#L81) generates a fresh one
and pushes unconditionally. **A signature that names no recipient is a
bearer token for every recipient.**

`claim` can never join them — you cannot post to a relay you have no row
on. It is the bootstrap and stays outside.

**Recipient-aware presence.** `presence.broadcast(event, data)`
([presence.js:116](../../spirit/run/js/presence.js#L116)) writes one
payload to every sink; there is no predicate and no per-recipient
payload. Required by R11 anyway — *"the connected device must only appear
on the census for its owning node"* makes `who()`, `streamRoster()` and
`broadcast` all recipient-dependent — and forced by the above, since the
relay's own row must not read as an ordinary peer.

**The owner-key lookup is copy-pasted four times** —
[419](../../spirit/run/js/relay.js#L419),
[454](../../spirit/run/js/relay.js#L454),
[832](../../spirit/run/js/relay.js#L832),
[1063](../../spirit/run/js/relay.js#L1063). One `ownerKey()` collapses it.
The *messages* must stay separate, and
[the comment at 426](../../spirit/run/js/relay.js#L426) says why: a
`status` signature replayed into mint would read as *"mint me a token for
any label, for any number of days."* Subsumed by the above if it happens.

---

## What is not in the way

Recorded because it is most of the surface, and because a plan that
inventories only obstacles reads as larger than the job.

- The relay makes **no outbound HTTP call at all**. Nothing to untangle.
- A device **already** cannot open a stream
  ([relay.js:1273](../../spirit/run/js/relay.js#L1273)) and **already**
  does not appear in the census — `devicePublicKey` lives on the owning
  row and `who()` drops it. The negative half of R11 is structurally true.
- `peerPost` **is** the protocol. Nothing needs rewriting, only wiring.
- The shell's fan-out already exists.

**Four connections and one deletion. The deletion is easy; the first
connection does not exist yet.**
