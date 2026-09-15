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
harness by name, because it spawns a relay and three nodes. It fails
before it starts, identically before and after R8:

```
could not build the lab: mint alfa: lab owner could not open a stream: 403
```

That is `labWorld.build` and not this cycle's work. It is named here
because it is the same class of thing and the same page should carry it:
**everything in this tree that spawns real processes is currently red,
and none of it was red in a way anybody would notice.**

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
| `relayHubPing` | a node reaching a relay through its own `/api/hub/*` | `/api/hub/send` and `/api/hub/inbox` → `/api/hub/post` |
| `relaySignedPing` | Ed25519 claim | the send half |

The common cost is that **a post needs somebody holding a stream**. These
casts do not open one, so every rewrite here is "spawn the target, open
its wire, then post" rather than a one-line swap. That is the sitting
this page is asking for, and it is not the one that wrote this page.

## Until then

```
node spirit/test/labMaster/relaySurface.test.js
node spirit/test/labMaster/servableStatic.test.js
```

are the two that mean what they say. `labPopulate.js` builds the whole
world in one command and is the thing to reach for in the meantime — see
[design/cleanup/2026-09-11-labmaster.md](../../../design/cleanup/2026-09-11-labmaster.md).
