# The lab suites are in the harness

*Rewritten 2026-09-15. This page used to be an inventory of rot — six
suites nothing ran, with their real pass/fail counts written down so the
trap was at least visible. That is finished, so the inventory is gone
and what it found is kept.*

**Every suite that spawns real processes now runs in `node spirit/test/runAll.js`.**
Nothing is left in this directory but the lab itself: `labMaster.js`, its
panel, `ensureMaster.js`, and this note.

```
72 suites, 1773 green, 0 red        ~60s
```

It was 66 suites, 1702 green, ~25s. The extra 35 seconds is the price of
running real relays and real nodes on real ports, and it was taken
deliberately — an opt-in tier would be the same silent trap wearing a
flag.

## Where they went

| was | is | what happened |
|---|---|---|
| `relayPing.test.js` | [`labLifecycle.js`](../labLifecycle.js) | kept its 8 lifecycle checks, lost a 3-check "ping" across a dead transport. The name was describing the third that no longer existed |
| `relayAbuse.test.js` | [`labRefusals.js`](../labRefusals.js) | kept the label rule and the packet cap; lost a `sendHits` rate limit that no longer exists and a claim-flood limit `relayGates.js` already drives |
| `relayPersist.test.js` | [`labPersistence.js`](../labPersistence.js) | kept persistence, dropped the half that proved it with MAIL |
| `relaySurface.test.js` | [`labRelaySurface.js`](../labRelaySurface.js) | moved as-is. It was always green |
| `servableStatic.test.js` | [`labServableStatic.js`](../labServableStatic.js) | moved as-is. It was always green |
| `relayHubPing.test.js` | **deleted** | its subject — a node reaching a relay through its own API — is what `liveFrontDoor.js` now proves between three real nodes, with acquisition, logging, counting and hash correlation on top |
| `relaySignedPing.test.js` | **deleted** | every unique claim it made (signed claim accepted, unsigned refused, wrong-key refused) is in `relayGates.js`, which the harness has been running all along. The rest was `send`/`inbox` and a names-mode `allow.json` that nothing has ever written |
| `relayAllowPing.test.js` | deleted earlier | names mode went with the ring |

## What the rot actually was, when it was finally looked at

Worth keeping, because none of it is the kind of thing a person finds by
reading:

**`liveFrontDoor` was reading a file the product stopped writing.** It
read `relay-state/traffic.json` — the read-once legacy shape, whose own
comment says *"Never written again"* — while the live log is
`traffic.jsonl`. Every read returned `[]`, and **an empty array is not an
error, it is an answer.** Seven checks were asserting things about a log
they never saw, reporting `0 of 10 landed` while all ten had landed.

**`relayAbuse` was defending a rule that had been deliberately removed.**
It required `../etc` to be refused as a label. Labels became Unicode
captions; addressing is by key; there is nothing for a label to traverse
into. Had that suite been in the harness at the time it would have gone
**red on a correct change** — which is the other failure mode of an
unwatched test, and the reason it is now a check that `../etc` is
*accepted*.

**Two setups had been failing under passing assertions.** `labWorld`
put the stream signature on a query string (a relay *refuses* that — a
URL reaches logs and referrers), and sent an invite token with no
`inviteLabel` (the two travel together since R1). And `liveFrontDoor`'s
device block installed nothing, because `body.setDevice` was deleted —
while the five checks beneath it went on passing. A section where the
setup fails and the assertions pass is how a vacuous test hides.

**`MAX_ROUTED_TEXT` was asserted nowhere.** The router's 16 KB cap is
enforced in four places in `relay.js` and no test had ever sent a byte
over it. `labRefusals.js` does now, and the answer is `413`.

## Running the lab by hand

Unchanged, and still how you drive it as a person:

```
node spirit/test/labMaster/labMaster.js        the panel on :65420
node spirit/test/labPopulate.js                a whole world in one command
```

The suites no longer need you to do that first —
[`ensureMaster.js`](ensureMaster.js) starts labMaster if it is not
already up, and leaves it alone if it is, because you may be using
yours.

See [design/cleanup/2026-09-11-labmaster.md](../../../design/cleanup/2026-09-11-labmaster.md).

---

## Where a lab node lives, and where a fixture does

*Added 2026-09-17, because the two were one place and that is what made a
node somebody keeps as disposable as a fixture.*

| | root | built from | wiped between runs |
|---|---|---|---|
| **a lab node** (this panel) | `repo/lab/<name>` | a **git clone**, updated `git fetch && git reset --hard origin/master` | never |
| **a test fixture** (`labWorld`, `setupRelayFakes`, `labPersistence`, `liveRelay`) | `%TEMP%/spiritos-relay-fakes/<id>` | a copy of the **working tree** (`git ls-files`) | deliberately |

> **Andy:** *"i want all my nodes on labMaster page to only be updated via
> github, jazz's binding to spirit-3 keeps getting trashed."*

**Why they must not share a root.** A fixture wants a throwaway tree and
must test the code being written; a lab node holds a key, a seat on a
public relay and a conversation, and should run what is *published*. They
answer different questions. While both were copies under `%TEMP%`, the
only way to get new code into a lab node was `Recycle` — which wipes —
so updating a node destroyed it.

**Nothing restores a node's state, because nothing takes it.**
`relay-state/`, `session.json`, `relays.json`, `view.json`, `prefs.json`,
`minted.json` and the peerfiles are all gitignored, so `reset --hard`
cannot reach them. That is the whole fix, and it is a fix by subtraction.

**An unpushed commit does not reach the lab.** That is the point of
updating from GitHub and the one thing that surprises: `git log
origin/master..HEAD` is the list of what the lab cannot see. The `Commit`
column on the panel is there to make it visible.
