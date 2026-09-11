# A scenario is a scenario; a test is a test within a scenario

*2026-09-11. Verified against the tree at the commit this landed on.*

Andy:

> a scenario, is a scenario, a test is a test within a scenario. i, visually can
> only run 1/1000 of the number of test you can run automatically, but we both
> can use the same scenario.

That sentence is the whole design. This note records what it turned into, what
it caught on the way, and what is deliberately still separate.

---

## The shape

Three files, and only the middle one is new thinking.

| file | what it is |
|---|---|
| [`spirit/test/scenario.js`](../../spirit/test/scenario.js) | the **vocabulary**. Normalises and complains. Builds nothing. |
| [`spirit/test/world.js`](../../spirit/test/world.js) | builds a scenario **in process**, in about a millisecond |
| [`spirit/test/labWorld.js`](../../spirit/test/labWorld.js) | builds the same scenario as **real processes on real ports**, once, so a person can look at it |

The two builders do not know about each other. What they share is the
vocabulary — which is what stops *"the world I tested"* and *"the world I looked
at"* from quietly meaning two different things.

A scenario is data:

```json
{ "title": "…", "why": "…", "covers": ["presenceStream.js"], "look": ["…"],
  "relays": ["lab"], "owner": "andy",
  "peers": [{ "name": "bella", "label": "bella", "on": ["lab", "live"], "running": false }],
  "knows": [["bella", "carlos"]],
  "messages": [{ "from": "bella", "text": "morning" }],
  "then": [{ "remove": "dina", "from": "lab" }] }
```

Anything outside that list is **refused, not ignored** — a field somebody added
in good faith that silently does nothing is worse than an error.

### Two questions, kept apart

`problems()` asks *is this well-formed*. `exhibitProblems()` asks *is this worth
spawning four processes to look at* — a title, a reason, something named to look
at, and at least one peer.

They were one function, and that was wrong: **an owner alone with a relay is a
perfectly good world** — it is the one the entire device arc happens in — and
refusing it would have pushed every device suite back to building a relay by
hand, which is the thing this work exists to stop. Only
[`visualScenarios.js`](../../spirit/test/visualScenarios.js) asks the second
question.

### The two stock worlds

`scenario.OWNER_ONLY` and `scenario.UNCLAIMED` (`owner: null` — nobody has
claimed yet, which is a world in its own right and not an incomplete one). Those
two cover most suites. Anything else is a literal in the suite, which is one
line.

---

## What it replaced

A `lab()` helper copied into a dozen suites, drifted in every one. Some minted
invites and some did not; some saved the mailbox a key of its own and some
forgot, so `mailboxPublicKey` was null in some suites and not in others for no
reason anybody had chosen.

Migrated: `routerPost`, `removePeer`, `presenceStream`, `devicePeers`,
`deviceSig`, `deviceDisplace`, `deviceInbox`, `deviceHandshakeTest`,
`deviceListen`, `inviteLock`, `inviteRedeem`, `inviteMint`, `inviteSpeakable`,
`firstOwner`, `relayConsole`, `inboxSig`, `identityPerception`, `chatPeople`.

**Not migrated, on purpose:** `cycleA` builds two mailboxes owned by one
supplied identity with its own relay labels — a genuinely different fixture, not
a drifted copy of the common one. `invites.js` seeds `allow.json` before
constructing the relay. `relayGates` and `presenceWire` run against the live
checkout and a real socket respectively.

In the suites that *test* claiming and inviting, every claim and every mint
stays written out in full. Only the empty box underneath moved. **A helper that
made them would be a helper that hid them.**

---

## Four bugs it caught, none of which were failing

This is the part worth keeping. Every one of these was a suite passing for the
wrong reason, which is the only kind of bug a test suite can have.

**1. The relay wore its owner's key.** `world.js` saved the owner's identity into
the relay's home. But `relay-state/identity.json` in a relay home is the
**mailbox's own** key — [`server.js`](../../spirit/run/js/server.js) makes it
with `ensureIdentity(ROOT_DIR, 'relay')` on the first `--relay` boot, and
`relay.js` says so at `mailboxPublicKey()`: *"the owner is a peer who claimed,
the mailbox is the box."* So any check that distinguished the two passed without
distinguishing anything. Fixed; the relay now gets its own key and
`world.relayKey()` hands it over.

**2. The eleventh peer was refused by a rate limit.** Every peer claimed from
`10.0.0.1`, and the fourth argument to `claim()` is the rate-limit bucket
(`CLAIM_PER_MIN = 10`). A scenario with eleven peers would have failed to build
and **blamed the scenario**, which would have been innocent. Andy's lab already
runs nine. Each peer now claims from its own address.

**3. `live` folded twice.** Every visual scenario puts peers `on: ["lab",
"live"]`. In process there is no live relay, so `live` folds onto the first —
and folded *twice*, so the peer claimed the same box twice and the build died on
"key already claimed". Found the same hour the build check was added, by the
build check.

**4. The lab silently built a different scenario.** `labWorld.createWorld` did
`Math.min(PEER_PORTS.length, wanted)`, so a five-peer scenario built three
peers and **reported success**. Now it refuses and names the reason. A lab world
is forty seconds and four processes; the failure that names itself beats the
success that lies.

A fifth, smaller: `labPopulate` read the scenario file raw, so `peers:
["bert"]` — legal, and what the fast builder accepts — arrived with `.name`
undefined and the lab built a peer called `lab-undefined`. It now normalises
through the shared vocabulary, which is what makes *"we both can use the same
scenario"* true rather than nearly true.

---

## The runner

There wasn't one. Fifty-two files each had to be named by hand, so in practice a
change got the four suites somebody remembered.

```
npm test                          everything, ~18 seconds
node spirit/test/runAll.js device only suites whose name matches
node spirit/test/runAll.js --serial
```

Suites are **discovered, not listed** — a list is a second place to forget
something, and a new suite nobody added would look exactly like one that passes.
A suite that never reaches its last line reads as worse than red, not the same;
a suite that hangs is killed and counted as failed.

`visualScenarios.js` runs last, alone, because it reads the other suites off
disk.

---

## Decided / open

**Decided.** One vocabulary, two builders, neither aware of the other. Grammar
and exhibit are separate questions. Suites own their scenarios inline; the ones
worth *looking* at live as `spirit/test/visual/*.visual.json` and are reachable
from labMaster. The builder has its own suite
([`worldBuilder.js`](../../spirit/test/worldBuilder.js)) — shared infrastructure
with no tests is worse than twelve copies that drift, because when it is wrong
it is wrong everywhere at once and quietly.

**Open.** `world.build()` takes no supplied owner identity, the way
`labWorld.createWorld({ owner })` does; `cycleA` is the only caller that would
want it and it was not worth speculative API. The lab's three peer ports cap
what can be exhibited — raising it means understanding labMaster's allocation in
the 65400–65429 range. And no scenario yet exercises two relays at once in
process, though the vocabulary allows it.
