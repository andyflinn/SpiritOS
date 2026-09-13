# What a relay keeps

**Measured at working tree, 2026-09-13** (after `a992273`). Every claim
carries a file. Illustration only — no proposal, nothing about what
should change.

A relay is `node js/server.js --relay`. Decision 0006 is the rule this
page is measured against: *"A relay relays. It offers no sophisticated
services, buffers nothing, and stores nothing on anyone's behalf."*

---

## 1. On disk

Everything lives under `relay-state/`, which is gitignored and unservable
(the gate is directory-wide, `kernel.js`).

| file | what | why |
|---|---|---|
| **`identity.json`** | this relay's own keypair — `{name, publicKey, privateKey}` | It is a **party**, not just a pipe: it signs the receipt for every post it answers, and its public key is its address. Without it the box cannot be identified, pinned, or addressed. Written once, at first start. `relayAuth.js` |
| **`allow.json`** | `{keys:[{name, publicKey}]}` — in practice **one row: the owner** | The only authority on who the owner is. `ownerName()` reads it, every owner verb is decided by it, and it is the file an operator edits by hand on the box when all else fails. `relayAuth.js` |
| **`routingTable.json`** | `{nextId, peers, messages}` | **`peers` is the routing table** — who has a row here, and which key answers to which label. This is what makes a relay able to route at all, and the only thing on this list that is unambiguously its job. `relay.js` |
| **`invites.json`** | `[{token, label, expiresAt, invitedBy}]` | An unclaimed invite is a **reservation held for somebody who is not here yet**, so it cannot live anywhere else. A claimed one is deleted, not stamped — a waiting room, not a guestbook. `invites.js` |
| **`pending-owner.json`** | a key allowed to reclaim ownership | Read at claim time and cleared on success. Recovery for a relay whose owner lost their key. `relayAuth.js`, cleared at `relay.js:347` |


### What is on this list that should not be

**`messages` — the ring.** Up to 200 routed-by-the-old-transport messages,
inside `routingTable.json`. It is the one thing here that is stored *on
somebody else's behalf*, which is what 0006 forbids.

- It has **no drain**: `inbox` filters and returns; nothing marks or
  deletes. A message leaves only when 200 newer ones push it off the end.
- It exists because **before the router there was no held stream** — a
  peer that was not connected had no other way to receive.
- Sentenced (R8). Andy inspected spirit-3's — 77 messages, 15 of them
  telemetry from a console that no longer exists — and said: *"they are
  all noise."* So the deletion needs no migration.

### What a relay no longer reads

**`mailbox.json`** — the name `routingTable.json` replaced. The fallback
that read it was deleted on 2026-09-13, once spirit-3 had provably written
the new file (a forced `persist()`; 10 rows before, 10 after). A stale copy
may still sit in `relay-state/` on an old box: nothing reads it, and
`servableAssets.js` still asserts it is unservable, because a full roster
on disk must not become readable just because it became irrelevant.

### What is NOT on disk, deliberately

- **No device keys.** A relay held one per row until 2026-09-13. The
  binding between a device and its node is the **node's** — the browser
  keeps the private half, the password is compared on the node and
  nowhere else. `deviceAuth.js`
- **No traffic log, no history, no receipts.** A post is delivered or
  refused; the record of it is the sender's and the recipient's.
- **No message content for the router.** The ring above is the old
  transport; nothing on the router path is written down.

---

## 2. In RAM

All of it inside one `createRelay()` closure, except where noted.

### Loaded from disk at start — the working copy

| held | from | why in RAM |
|---|---|---|
| `peers`, `nextId` | `routingTable.json` | Every post resolves a key to a row. Reading the file per request would put a disk read in the delivery path. Written back by `persist()` — three call sites, all of them changes to the roster (a claim, a send, a removal). |
| `messages` | `routingTable.json` | The ring. Dies with R8. |
| `allow` | `allow.json` | Read on every owner check. Re-read by `reloadAllow()` when it is written. |

### Temporary, and the reason the relay can do its job at all

**These are the additions 0006 permits**: none of them is kept, none
survives a restart, and each exists only while something is in flight.

| held | shape | where it comes from | what it enables |
|---|---|---|---|
| **`presentNow.sinks`** | `key → open SSE response` | a peer opening `GET /api/relay/stream` and proving that key | **The whole of delivery.** A post is pushed down the recipient's held connection. No sink, no delivery — which is why an absent peer is refused instantly rather than buffered. `presence.js` |
| **`routes.pending`** | `hash → {requester, target, at}` | `routes.open()` on every post, **before** it is forwarded | Matching an answer to its question. Registered first so nothing leaves until the thing that will match it exists; deleted by `routes.answer()`. Bounded: **256 total, 16 per requester, 20s ttl** — capacity is a refusal, never a drop. `router.js` |
| **`monitoring`, `monitorFilter`** | a flag and a filter | the owner posting `{monitor:{on, filter}}` to the relay itself | The owner watching their own box. Dies with the owner's stream — a browser that crashed leaves nothing pushing into nothing. `relay.js` |
| **`claimHits`, `sendHits`, `deviceHits`** | `key → [timestamps]` | every claim, send and device offer | Rate limits. A sliding window per caller, swept when the bucket grows; the key is the client address for claim and send, and the identity for device offers. `relay.js:178` |
| **`awaitingReply`** | `hash → resolver` | the relay posting a device offer to a node | The relay is the **requester** for exactly one thing — carrying a browser's enrolment to the owning node — and this is where it waits for that node's answer. `relay.js` |

### Where the RAM comes from, in one line each

- **`sinks`** — peers arriving. A relay's population of open connections
  is not a thing it chose; it is who turned up.
- **`pending`** — its own forwarding, one entry per in-flight question.
- **`monitoring`** — one owner packet.
- **rate buckets** — callers, including ones with no row.
- **`awaitingReply`** — its own single outbound errand.

---

## 3. The shape, stated plainly

A relay persists **four things it needs to be itself** — who it is, who
owns it, who has a row, and who has been invited — and **one thing it
should not** (the ring).

It holds in RAM **one working copy of the first four**, and **four
temporary structures that exist only while something is happening**: who
is connected, what is in flight, whether the owner is watching, and who
has been knocking.

Nothing in the temporary set survives a restart, and nothing in it belongs
to anybody else. That is the whole of what "stores nothing on anyone's
behalf" costs to keep true — and the one line item that breaks it is
already sentenced.
