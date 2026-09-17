# Review request: partner reach, and a relay that governs itself

**Repo:** `github.com/andyflinn/SpiritOS`, branch `master`.
Everything below is pushed — read it there rather than from this file.

**The two documents under review, raw:**

- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/design/relay/PARTNERS.md
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/design/relay/CAPACITY.md

**The code the claims are about, raw:**

- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/spirit/run/js/relay.js
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/spirit/run/js/hub.js
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/spirit/run/js/peerPost.js
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/spirit/run/js/whoBook.js
- https://raw.githubusercontent.com/andyflinn/SpiritOS/master/spirit/run/js/partnerLink.js

This file is scaffolding and will be deleted once the review has landed.
It is written for Grok; Andy is the decision-maker it reports to.

You are reviewing **design, not a patch.** No relay code has changed. The
last commit to `spirit/run/js/relay.js` is `f5fcb16`, which predates all of
this.

---

## What to read, in this order

1. **`design/relay/PARTNERS.md`**, the four sections appended at the end
   (line ~1221 onward). The rest of that file is prior context from
   2026-09-15/16 and is **already decided** — read it for grounding, not for
   review:
   - *Status at `9110393` — what is built, and the four gates that are not*
   - *Describe must reach as far as search (decided 2026-09-17)*
   - *Acquisition is the gate (decided 2026-09-17)*
2. **`design/relay/CAPACITY.md`** — new, whole file. First cut.

Both separate **decided (Andy)** from **recommended (Claude)** from
**open**. Only the second and third are up for review. Where a decided item
looks wrong to you, say so plainly and say why — but mark it as arguing with
a decision rather than finding a bug.

---

## What has been proven on live boxes

Three real nodes and two real relays, measured 2026-09-17, not reasoned
about:

```
spirit.andyflinn.com   owner: Andy Flinn      version 0.0.1 d27d5ba
lab.andyflinn.com      owner: lab-keeper      version 0.0.1 9110393
   (the two relays are partnered; the only commit between those
    two builds touches three test files and no product code)

jazz    member of spirit only
sonny   member of lab only
andy    member of both
```

**Acquisition across a partnership works today, both directions, with no
code change:**

```
jazz  peer.search "sonny"  -> row with relay=https://lab.andyflinn.com (via resolved)
jazz  peer.acquire         -> 201
sonny peer.search "jazz"   -> row with relay=https://spirit.andyflinn.com
sonny peer.acquire         -> 201

whoBook.listens(jazz's row for sonny)  -> true  (via handle)
whoBook.listens(sonny's row for jazz)  -> true  (via handle)
```

So **both front doors are already open in both directions**, decided
independently at each end. Nothing checks mutuality; it simply holds.

**Delivery does not work:**

```
jazz peer.post {describe} -> sonny  :  HTTP 503 "that peer is not reachable right now"
```

and it is refused **inside jazz's own node** (`presence.relaysNaming` is
empty, `hub.js:889`) before anything reaches a wire. Four further gates
would refuse it if that one were removed; they are enumerated with line
numbers in the *four gates* section.

**Two measurements that changed the shape of the proposal:**

- **`routePost` has no rate limit at all.** `rateOk` has exactly two call
  sites — `claim` and device enrolment. The "30 sends per minute per key"
  that reads like a live rule (`relay.js:259`) is a comment about `send`,
  the ring route R8 deleted. So CAPACITY.md is not tightening anything; it
  would be the first relay-side limit on the thing that moves bytes.
- **The node's stranger floor is global, not per-sender.** `unknownBytes` is
  one array summed across everybody (`peerPost.js:143`), so the ceiling on
  what strangers can make a node write does not move when the stranger
  population grows. This is why widening reach is argued to cost nothing
  there. Please check that reasoning specifically.

---

## Harness

```
node spirit/test/runAll.js
83 suites, 2158 green, 0 red, 0 unhappy, 1 not run
```

The "1 not run" is `launch.js`, ten lines of scratch from another project.
The runner now **names** anything it skips, which is itself a fix from this
sitting: it discovers a suite by finding `startTest(` in the file and used
to skip silently. Two suites had never run — `deviceAuth.js` (which had been
asserting three deliberately-deleted APIs for four days and threw on the
first) and `iconIndex.js` (31 green, invisible for want of one line).

No suite covers any of the design under review. That is the honest state:
the partner-reach behaviour above was established by driving live nodes by
hand, not by the harness.

---

## Where review is most valuable

Ranked by how unsure we are.

**1. The vouching model has a hole we cannot see the bottom of.**
The delivery path (already in PARTNERS.md from 2026-09-15) is:

```
N1 ──post──▶ A ──forward, signed by A──▶ B ──deliver──▶ N2
```

Andy's ruling: *"it vouches for the fact that they are verified by a trusted
partner"*, and *"the partnership contract includes mutual vouchery."* So B
verifies A's relay key, and A asserts "N1 is one of mine".

**If A lies — forges a member, or forwards for a key it never verified — B
and N2 have no way to detect it.** The trust is explicitly "I trust A", and
the blast radius is bounded by one hop and by N2's own front door. Is that
sufficient? Is there a cheap construction that makes the assertion checkable
rather than merely attributable? We have not found one that does not require
B to hold A's roster, which is forbidden (`partnerLink.js:106`).

**2. Is gate 3 accidental?**
`routePost` resolves a sender as `deviceIdentity(fromToken) ||
partnerIdentity(fromToken)` (`relay.js:2087`). `routeReply` resolves only
`deviceIdentity(fromToken)` (`relay.js:2186`) — no partner fallback, no
comment explaining the difference. We read it as an oversight. It may not
be. If a partner must never reply *by post*, say why.

**3. `describe`: register or forward?** Undecided, and it is the only thing
between "found across a partnership" and "confirmable across a
partnership". Two options, both written up:
   - **register** (tier three): the peer declares its description to its home
     relay, the relay publishes it, a node fetches it by id from whichever
     relay answered the search. Reach equals search by construction, works
     while the peer is asleep, touches no gate. Costs a persist-shape change
     on the relay's peer row.
   - **forward**: relays carry the describe packet to the peer's node, which
     already answers it above its front door. Matches the conduit model,
     needs all four gates, and fails whenever the peer is asleep — which is
     most of the time.

**4. CAPACITY.md, recommendations 1, 5 and 10.**
   - **1 — two limits, not one.** RAM is a stock spent by what is
     outstanding; bandwidth is a flow. We may be over-splitting: if `routes`
     in flight correlates tightly with bytes in practice, one governor is
     simpler and the distinction is theory.
   - **5 — the floor as a requirement in units of work** (*"one greeting and
     a handful of replies per minute must always get through"*) rather than
     a constant, with the failure mode "a relay too loaded to honour it
     stops accepting new members and says so". Least conventional part;
     nobody has costed that failure mode.
   - **10 — the governor is a module with injected observations**, on the
     `peerSearch` precedent, so that an adaptive limit with history (a ring,
     a decaying peak, a committed value) is testable at all. Is the
     signature right?

**5. The interval.** *"Streamed to partners and members at reasonable
intervals"* is decided; the number is not. A value committed until
superseded is stale during exactly the burst it exists to govern.

---

## What is NOT under review

- The UI work from this sitting (armed-button colour, the device panel row,
  the device page account name, labMaster buttons). Separate, shipped,
  tagged `v-2026-09-17-07-28`.
- Anything in PARTNERS.md above line 1221 — prior decided design.
- Decision files `0006`, `0010`, `0011` — cited, not reopened.

---

## How to answer

Per the working agreement: **findings first**, and keep two categories
apart — *regressions of closed gates* versus *design that is not implemented
yet*. A short pasted verdict is enough to act on; long analysis makes Andy
do the extraction.

If you think the whole partner-reach direction is wrong, that is a useful
answer and "or not" is a real outcome — say what waiting costs. Acquisition
already works without any of it, so the cost of deferring delivery is
currently: two people can find and add each other, and cannot yet speak.
