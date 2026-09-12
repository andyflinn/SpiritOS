# 2026-09-12 — transport, below the node boundary

**Status: OPEN — stage 2 (agreeing), planning not yet agreed.**

Opened as a contract under [the method](README.md). Stage 1 and 1.5 are
settled; requirements are being added as they are agreed, before anything
is built.

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

**Carries a consequence:** `spirit/test/servableAssets.js:133-135` uses it
as the specimen for *"process scripts are readable, never writable"*. That
rule is about `process/` as a directory and must survive — the specimen
re-points at a script that stays.

**Verify:** not written.
**Status:** OPEN

### R2 — `run/` operates with `test/` deleted
> Are we agreed that node and relay must be fully operational, even if the test folder was completely deleted?

Already true in code: no `require`, no runtime path. The only violation is
R1's manifest string. Stated as a requirement because it is the kind of
rule that decays silently — a single `require('../test/…')` added in
haste would not fail anything until somebody shipped.

**Verify:** not written. Wants a check that no file under `spirit/run/`
requires a test path or references one at runtime — comments excepted,
`buildStamp`'s `':!spirit/test'` exclusion pathspec excepted.
**Status:** OPEN

---

## Not yet agreed

The ring itself — `send`, `inbox`, the `messages` ring, and where
`consoleExchange` lives once `send` is gone. That is the substance of this
cycle and it has not been discussed yet. It also has one ordering
dependency already known: `consoleExchange` is *inside* `send()`, is not
peer transport, and needs somewhere to live before `send` can go.
