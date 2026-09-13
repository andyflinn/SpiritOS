# A correspondent that is not a person

**Sketch, 2026-09-13. Measured against `27143b3`. Nothing built.**

> It's like a brainfart, where i give you a personal node on my system, we
> chat through that, and it gives us both a history, based on which we can
> improve our interactions, or train a third person (AI) to continue "us"
> when we no longer are….

Feasibility and shape only. This changes the **priority** of an existing
requirement and adds no new mechanism, which is the finding.

---

## 1. The shape

A second personal node on the same machine. Its own Ed25519 identity, its
own name claimed on a relay, its own `relay-state/`. To every other peer
it is a peer; nothing about the protocol knows or cares that no human
reads its mail.

Two people talking through it are two nodes posting packets at each
other, over the router, signed end to end. **Each keeps its own permanent
log of its own side.**

## 2. Why it is one function rather than an architecture

**The seam already exists and is already load-bearing.**
[`peerPost`](../../spirit/run/js/peerPost.js)'s `answer` hook is handed an
arriving packet and **may return a string that becomes the reply's text**.
No browser is involved. Its own comment says why it lives where it does:

> an answerer that hangs is holding somebody's browser open, which is the
> reason this hook belongs to the node's own code and not to anything an
> app can register freely.

Today exactly one thing uses it, for device enrolment, and it returns `''`
for everything else. **A node that answers as a model is that same seam
with a different answerer.**

**And the credential path is built.** `/api/proxy` substitutes
`ANTHROPIC_API_KEY` server-side, gated by variable name **and** by
destination host ([server.js:562](../../spirit/run/js/server.js#L562)), so
the key never exists in browser-visible code and cannot be aimed at a host
of a caller's choosing.

**And the conversation has structure.** `re` — a packet naming the packet
it is about, by request hash — landed the same day as this sketch
([ROUTER.md §3b](../relay/ROUTER.md)). It is a protocol field precisely so
that it is not one app's convention.

## 3. The part worth the sketch: two logs, no shared store

Each node records its own side. There is no joint database and no
authority both parties must trust.

**But the same packet appears in both logs under the same hash**, because
the hash is taken over the exact bytes that were signed. So either party
can hand their record to a third, and it can be **reconciled against the
other's** without anyone ever having held a shared store.

That is the architecture doing something a database would specifically
undo: **two sovereign records that can be checked against each other,
rather than one both must believe.** For a corpus meant to outlive the
people in it, that is the difference between a record and an attested one.

It also follows from decisions already taken rather than needing new ones:
0006 made the relay store nothing, 0009 made the node's log permanent and
readable, and `storeOwnership` keeps it swappable without being
swappable-away.

## 4. What this makes urgent

**[R16](../cycles/2026-09-12-transport-below-the-boundary.md) — the log
must be able to prove what it claims.**

Every packet arrives signed; the signature is verified and then
**discarded**. So `outcome: 'receipted'` is a node asserting something
about itself, and an inbound row is a line the node could have written for
itself.

For a diagnostic log that is untidy. **For a corpus intended to train a
successor it is fatal**, and the reason is the use case's own premise: the
people who could vouch for it are the people who will not be there. A
record nobody can check is worth what the last person to touch it says it
is worth.

This sketch does not change R16's content. It changes why it is worth
doing: **provenance is not hygiene here, it is the product.**

## 5. The constraint that shapes the design

**The `answer` hook is awaited, and the route expires.**
`ROUTE_WAIT_MS` is 15s on the relay
([relay.js:38](../../spirit/run/js/relay.js#L38)); the router table sweeps
at 20s ([router.js:31](../../spirit/run/js/router.js#L31)). A model that
takes longer than that leaves the requester with `no-answer` — truthfully,
and with the bare receipt already sent.

So there are two shapes, and the second is the one that lasts:

| | |
|---|---|
| **answer in the hook** | the reply rides the open exchange. Simple, and only honest while the answer is fast. |
| **answer as a new post carrying `re`** | the receipt says *arrived*; the answer comes later as its own packet, naming what it is about. No window, no held connection. |

The second is what `re` was built for. It also means a correspondent node
can think for a minute without holding anybody's browser open, which the
first cannot.

## 6. Said plainly: a corpus is not a model

The distance between *a permanent, verifiable record of an exchange* and
*an AI that continues the people in it* is enormous, and none of it is a
storage question. Nothing in this repo shortens it.

What the system would supply is the half that is usually skipped:
permanent, human-readable, portable, owned by each party separately, held
by no third party, and — once R16 lands — checkable line by line.
Corpora are easy to make and hard to trust, and most attempts at this
begin by uploading everything to somebody else's box.

## 7. Decided / open

**Decided already, and this depends on nothing new:** a node is a node
(0006, 0009); the answer seam exists; `re` exists; the proxy scopes the
key.

**Open, and not answered here:**

- **Whether a correspondent node is a node or a mode.** A second process
  with its own identity is the honest reading and costs nothing; a flag on
  an existing node would blur whose signature is on what, which is the one
  thing this must not do.
- **What it is allowed to read.** Its log is its own. Whether it may read
  the *other* party's is a consent question and the answer is presumably
  no — the reconciliation in §3 works precisely because neither holds the
  other's record.
- **Who may train on it, and how that is expressed.** Not a storage
  problem. The signatures make authorship checkable; they say nothing
  about permission, and nothing in the system does.
- **The gap 0009 records still applies.** The log holds what crossed the
  WAN. What was chosen, refused or reversed is state, not history — and a
  correspondence is exactly where that distinction would start to bite.
