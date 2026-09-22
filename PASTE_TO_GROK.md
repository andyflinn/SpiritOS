# PASTE_TO_GROK.md

**What this file is.** The current call for review, put in the repo so it can be
read at a link instead of pasted. It is **overwritten each time**, so it always
holds the latest call and nothing else. Git history holds the previous ones.

Read at:
<https://github.com/andyflinn/SpiritOS/blob/master/PASTE_TO_GROK.md>

**This round (2026-09-22): the gap cycle's review pile.** The previous call is
in git at [`0f95649`](https://github.com/andyflinn/SpiritOS/commit/0f95649).
The cycle is
[design/cycles/2026-09-21-filling-the-gaps-request-budget.md](https://github.com/andyflinn/SpiritOS/blob/master/design/cycles/2026-09-21-filling-the-gaps-request-budget.md);
everything that could be built without changing a packet has been built, and
what is left is the four items below — each one changes the wire or a relay's
bones, which is why they wait for you.

**Before anything else:** if Andy has pasted pages of his *any-agent* compile
above this, read those first and answer in the way they describe — plain words,
short, a verdict per item (`GROK.md`, *Speak Andy's language, not yours*).

**Prepared by the two Claudes together, over SpiritOS itself:** the Windows
Claude drafted this, and wsl-claude checked every `file:line` against the tree
and ran the harness on Linux at the same commit. Measured at the commit named
in git for this file.

---

## 1. R28, hops 2 and 3 — a label change reaches every member

**Decided by Andy** (0019): *"add public Label change to broadcast, at all
levels."* Hop 1 — the node sending a rename to every relay it sits on — is
already built (`app/info/info.js:281`, `infoPush`).

**What is left, on the relay:**

- **Hop 2:** a rename today is told to the owner alone —
  `ownerEvent('peer-renamed', …)` (`spirit/run/js/relay.js:1790`), and
  `ownerEvent` reaches one sink (`relay.js:3498`). It would be broadcast
  `{key, label}` to the relay's members.
- **Hop 3:** a claim is likewise owner-only (`relay.js:1277`); 0012 decided on
  2026-09-18 that it broadcasts, and the code never did.

**Cost:** `O(members) × event rate`, and both events are rare and durable —
the cheapest broadcasts there are. It stops at the partnership: a partner
passing a name on is second-hand.

**Question:** a new event name for it, or ride the existing `route` event,
which a node already reads a label from (`server.js`, the `onRoute` hook)?

## 2. R13 — no streams between partners

Partners today hold streams to each other: `partnerLink.js` (144 lines),
dialled at boot (`relayServer.js:691-696`), and counted against the same
allowance as members' streams (`presence.js:145`).

**Proposed:** remove them. Relay↔relay becomes **one verb** — the answer to a
post *is* the reply — which the forward path already does in production
(`carryToPartner` / `askPartner`).

**What that moves:** a partner's liveness stops being "holds a stream here".
R12 already put `last` on the partner row — the time it last answered — which
is what "live" would read instead, for the live-only search and for hint
routing.

**Question:** agree, and is "answered within N minutes" the right liveness, or
something else?

## 3. R36, phase B — the relay says what an error means

Phase A is built: `spirit/run/js/spiritErrors.js` catalogues 48 error codes,
each with what it says about **presence**, whether a **retry** can help, and
whose **fault** it is, and a node maps what arrives back to a code. A suite
scans the tree for any error sentence the catalogue does not know.

**Phase B:** the relay sends the code itself, beside the sentence, so no node
has to recognise text. That changes the refusal whitelist in
`relayServer.js` — the post answer at `:547-561`, the reply answer at `:578`,
and `deviceRefusal`'s bare `"not now"` (`serveCommon.js:204`).

**Question:** a `code` field on every refusal — anything against that shape?

## 4. Retiring the Governor (R20, cancelled)

**Andy ruled** that the owner's configured RAM is a constant, *"and the
owner's only useful input is ram and disc configuration"*. The measured
per-stream cost (R15) makes the connection ceiling arithmetic on that
constant; the one runtime hazard left (a member that stops reading) is now cut
at a fixed bound (R35, below). **Nothing is left for the Governor to govern.**

**What it would remove:** `governor.js` (232 lines), required at
`relay.js:22` with 32 references there and 3 in `relayServer.js` (the tick
every 5 s), the lever verb, its fields in the owner's `relay-status` report,
and five suites (`governor`, `governorTwoRelays`, `lever`, `leverVerb`,
`settableCensus`). The allowance becomes fixed at boot from the owner's RAM.

**Question:** remove it whole, or keep the lever machinery for something else?

---

## Changed without a review — so you can see it and object

- **R35 — a member who stops reading is cut loose.** The relay's stream sink
  ignored `res.write`'s answer, so a member that stopped reading made the
  relay hold every write in its own process (50 MB for one reader, measured).
  Now a stream holding more than 2 × the largest packet (~193 KB) is destroyed,
  and the requests it leaves are answered at once: its askers get
  `503 peer not reachable`, its own pending requests are dropped.
  `spirit/run/js/streamSink.js`, `relay.failRoutesOf`, `router.release`. Andy
  ruled it in-file work: *"agreed. this needs only documenting…"*.
- **R16 — the node's outgoing queue is persisted in `node.db`.** A new storage
  shape; the cycle file itself says such a thing is a team review, and Andy's
  recorded waiver names the shadow roll, not the queue. **Andy is asked
  separately whether his waiver covers it**; if not, it is a fifth item here.

## Not in this round, and why

- **R9** (a URL in route hints): cancelled — Andy, *"no URL's it would bypass
  the need for the relay to fetch (still) owner-approved partner records"*.
- **R11, R14** (the URL rule; open partnering): outside the core — autonomous
  partnering is *"a grant from the owner"*, a growth decision for later.
