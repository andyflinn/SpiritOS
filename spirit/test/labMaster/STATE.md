# What the labMaster tests are worth right now

*Measured 2026-09-15, after R8 deleted the ring. Every number below is a
real run on this laptop, not a reading of the source.*

**The harness does not run any of these.** `runAll.js` reads only files
directly in `spirit/test/`, so nothing in this directory has been going
red in `npm test` — and nothing here would have told anybody it had
rotted. That is the reason this page exists: a silent trap is worse than
a red one, and the numbers below are the trap, written down.

**`spirit/test/liveFrontDoor.js` is in the same condition**, and it is
not in this directory — it sits with the suites and is excluded from the
harness by name, because it spawns a relay and three nodes.

### It builds again — 2026-09-15, after the loopback fold

It used to fail before it started:

```
could not build the lab: mint alfa: lab owner could not open a stream: 403
```

*This corrects the note that stood here.* That was not "`labWorld.build`
rot in general" — it was two specific things, both found and fixed:

1. **The stream signature travelled on the query string.** `labWorld.askOn`
   sent `&sig=`, and a relay REFUSES that rather than ignoring it
   (`relay.streamSignatureFrom`): a URL ends up in logs, referrers and
   history, and a signature must not. Now an `X-Spirit-Sig` header.
2. **The claim carried a token and no word.** Since R1 the two travel
   together or the claim is refused — `{"error":"invite label required"}`
   — because the relay stopped falling back for stale nodes.

With those two, the lab builds, and the file went from **3 ✅ / 9 ❌**
(nothing but "could not build") to **16 ✅ / 8 ❌**. What now passes is
the thing it exists to prove: a packet crosses between real processes,
is admitted, acquired by `message`, logged, counted in peerStats, and
found again by its hash alone. The verb fold is proven live too —
`contact.setSenders` and `peer.post` both answer real nodes.

### The eight that are left

Not investigated, and not this sitting's work. They are the ordinary rot
this page is about, now visible for the first time in months because the
file gets far enough to run:

- the inbound-log reads (`bravo logged: []`, `after acquire: []`) — the
  helper reads a file directly and may be reading the wrong one or too
  early;
- the rationing section (`contact posts: 0 of 10 landed`) — every post in
  it is 4000 bytes, which is under `MAX_ROUTED_TEXT` but worth checking
  against the packet caps;
- `set-device` answers `no such peer`.

**Everything in this tree that spawns real processes is still partly red,
and none of it was red in a way anybody would notice.** That has not
changed. What changed is that one of them now reaches its subject.

## The state, before and after

| file | at `fbf9ebf` (before R8) | now | what it is |
|---|---|---|---|
| `relaySurface.test.js` | 10 ✅ | **10 ✅** | fine |
| `servableStatic.test.js` | 16 ✅ | **16 ✅** | fine |
| `relayAllowPing.test.js` | 8 ✅ | *deleted* | its subject is gone — see below |
| `relayPing.test.js` | 11 ✅ 1 ❌ | 9 ✅ 3 ❌ | rotted, then more so |
| `relayAbuse.test.js` | 7 ✅ 1 ❌ | 5 ✅ 3 ❌ | rotted, then more so |
| `relayPersist.test.js` | 7 ✅ 3 ❌ | 5 ✅ 5 ❌ | rotted, then more so |
| `relayHubPing.test.js` | 11 ✅ 3 ❌ | 11 ✅ 2 ❌ | rotted, then more so |
| `relaySignedPing.test.js` | 10 ✅ 4 ❌ | 7 ✅ 6 ❌ | rotted, then more so |

**Five of the six were already red before R8 touched anything**, and that
is the finding worth carrying out of this sitting. They fail on things
that have nothing to do with the ring — unsigned claims, for one, which
have been refused since decision 0003 made the first claim the owner.
These files were written against Phases C, E, H and I of a relay that has
moved several times since.

So R8 did not break them. It made an existing mess larger, and the
honest accounting is that fixing them is **two jobs, not one**: catching
up on rot that predates this sitting, and moving off a transport that no
longer exists.

## What was deleted

`relayAllowPing.test.js` — *"Claim verification v0 (Phase H): names not
on the relay allow-list get 403. No keys yet."*

It was the only one of the six that was fully green, and it is the only
one whose SUBJECT no longer exists: it wrote a names-mode `allow.json`
(`{ "names": [...] }`), and names mode was deleted on 2026-09-15 with the
ring. Nothing in the tree ever wrote one — `writeAllowKeys` only ever
writes `keys` — and the two gates that gave the mode meaning, `checkSend`
and `checkInbox`, died with the transport.

Deleted rather than left red, because a test whose subject has been
removed by decision is not a failing test, it is an obsolete one. The
claim-gating it covered is asserted in `spirit/test/relayGates.js`, which
the harness does run.

## What the other five need

Each has a subject that survives the transport, which is why none of them
is deleted:

| file | what survives | what has to move |
|---|---|---|
| `relayPing` | labMaster's own lifecycle — create, start, delete, leave `work` alone | the ping. Claim needs a key and a signature; the send/inbox pair becomes a post down a held stream |
| `relayAbuse` | name charset, and a cap on what one request may carry | `MAX_TEXT` → `MAX_ROUTED_TEXT`; the send rate limit is gone with `sendHits`, and the claim limit is the one left |
| `relayPersist` | `routingTable.json` survives stop + start | it proved persistence with MAIL. The file holds `peers` and nothing else now, which is a better subject than the one it had |
| `relayHubPing` | a node reaching a relay through its own loopback API | `/api/hub/send` and `/api/hub/inbox` → `peer.post` and the stream |
| `relaySignedPing` | Ed25519 claim | the send half |

The common cost is that **a post needs somebody holding a stream**. These
casts do not open one, so every rewrite here is "spawn the target, open
its wire, then post" rather than a one-line swap. That is the sitting
this page is asking for, and it is not the one that wrote this page.

**Two of the five now have a worked example.** `labWorld.askOn` speaks the
whole thing by hand — census for the relay key, a stream held with the
signature in a header, a post, and a read of the stream until the reply
to THAT hash arrives. Whoever takes this sitting should start by reading
it rather than inventing the shape again.

Their claims were also retargeted at `relay.claim` on 2026-09-15 when
`/api/hub/claim` folded, so the claim half of `relayHubPing` and
`relaySignedPing` is current even though the send half is not.

## Until then

```
node spirit/test/labMaster/relaySurface.test.js
node spirit/test/labMaster/servableStatic.test.js
```

are the two that mean what they say. `labPopulate.js` builds the whole
world in one command and is the thing to reach for in the meantime — see
[design/cleanup/2026-09-11-labmaster.md](../../../design/cleanup/2026-09-11-labmaster.md).
