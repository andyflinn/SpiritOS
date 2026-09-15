# Human tools

Three things you run by hand. Commands first; the reasons are underneath.

*Measured 2026-09-15 at `65fa167`. Everything below was run, not read off
the source.*

---

## 1. Watch the whole suite go by

```
npm test
```

Same as `node spirit/test/runAll.js`. Six suites run at once, so the
output interleaves. To watch it bubble past in order:

```
node spirit/test/runAll.js --serial
```

To run only some of it, give a bare word — it is a substring match on the
filename, no flag:

```
node spirit/test/runAll.js relay      # every suite with "relay" in its name
node spirit/test/runAll.js label
```

The last line is the count: `63 suites, 1626 green, 2 red`.

**Three suites are deliberately left out of that count** and only ever run
by hand:

| file | why it is excluded |
|---|---|
| `testTemplate.js` | fails on purpose — it is the worked example of what red looks like |
| `liveRelay.js` | opens sockets to spirit-3 and changes state on a box other people use |
| `liveFrontDoor.js` | spawns a relay and three real nodes; seconds, not milliseconds |

`visualScenarios.js` always runs last, on purpose: it reads the other
suites off disk, so it should be answering for the tree as the run leaves
it.

---

## 2. Build a world to look at

```
node spirit/test/labPopulate.js            # the default world
node spirit/test/labPopulate.js buddies    # a named one
node spirit/test/labPopulate.js --list     # what is available
node spirit/test/labPopulate.js --down     # take it away again
```

**labMaster must already be running** (section 3) — labPopulate drives it
over `http://127.0.0.1:65420` and cannot start or stop a node it did not
spawn.

The worlds are **data, not code**: `spirit/test/visual/*.visual.json`.
Today there are three.

| scenario | what you get |
|---|---|
| `buddies` | a little buddy network |
| `presence-colours` | presence colours |
| `on-spirit-3` | two peers on spirit-3 |

To add a world, write another `.visual.json`. You do not touch
`labPopulate.js`.

**The one rule this tool must never break:** your identity is *read* and
never written. The key in `spirit/run/relay-state/identity.json` is the
key that owns `spirit.andyflinn.com`. Generating a new one there would
silently cost you that relay, and you would not find out until the next
time you asked it for a census.

---

## 3. The lab panel

```
node spirit/test/labMaster/labMaster.js
```

Panel: **`http://localhost:65420`** — fixed bookmark, bound to loopback.

- Lab nodes get ports **65400–65429**.
- **65432 is your work node.** labMaster refuses to hand that port out
  (`403 — 65432 is the work node`), refuses to recycle it, refuses to
  delete it, and leaves it running when labMaster itself exits.
- If your work node is down when a world is built, labMaster starts it.

### Refresh, Recycle and Delete are not synonyms

This is the one that bites at 2am. As the buttons stand **today**:

| button | what it does |
|---|---|
| **Refresh** | new code, **same node** — copies the tracked tree over the top. Key, relay rows, device slot and session all survive. |
| **Recycle** | wipes the home first, then copies. **The node's key is destroyed**, which takes it off every relay it was on and leaves rows behind that nobody holds a key for. |
| **Delete** | the row goes and the home goes with it. |

Nine times out of ten the thing wanted is **Refresh**.

> Under discussion, 2026-09-15: Recycle is to be repointed at a tag on
> `origin/master` and keep state, so that Refresh means *my working tree*
> and Recycle means *what a real user actually gets*. Until that lands,
> the table above is what the buttons do.

---

## Where it all lives on disk

```
%TEMP%\spiritos-relay-fakes    lab node homes
%TEMP%\spiritos-lab-master     which nodes labMaster thinks exist
```

Both under the OS temp directory. **Windows Storage Sense deletes files
there by age without asking.** When that happens a lab peer loses its
key, and any enrolment row it holds on a relay is orphaned — the relay is
never told. Purging those rows is currently manual, and see the gap below.

A lab node's home is *not* a git repository. It is a copy of the tracked
tree, stamped at build time with the commit it came from, which is what
`GET /api/version` reports. If you have untracked files under `spirit/`,
labMaster warns you that they will not reach the copy: `git add` is
enough, a commit is not required.

---

## What is broken right now

Written down because a silent trap is worse than a red one.

- **`natterIntrinsic.js` — 2 red** in `npm test`. Pre-existing; reproduces
  identically at `fbf9ebf`, before the current run of work started.
- **Nothing in `spirit/test/labMaster/*.test.js` is run by `npm test`.**
  `runAll.js` reads only files sitting *directly* in `spirit/test/`. Five
  of those six lab tests were already red before the ring was deleted, and
  nothing would have told anybody. Numbers in
  `spirit/test/labMaster/STATE.md`.
- **`liveFrontDoor.js` fails before it starts:**
  `could not build the lab: mint alfa: lab owner could not open a stream: 403`.
  That is `labWorld.build`, not the front door it is meant to test.

## Known gap

**There is no button that removes a peer row from a relay you own.**
`POST /api/hub/remove-peer` works and has no caller outside the tests and
`labPopulate --down`. Natter's *Remove* is a different verb — it drops a
relay from *your own* list; it does not touch the relay's ledger. So an
orphaned lab row on spirit-3 currently has no broom.
