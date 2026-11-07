# Human tools

Two things you run by hand. Commands first; the reasons are underneath.

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

The run takes every suite directly in `spirit/test/` and every product test folder under `spirit/run/` (`spirit/run/test/testModule.js`, `testsFor`); `--list` prints them and runs nothing.

To run only some of it, give a bare word — it is a substring match on the
filename, no flag:

```
node spirit/test/runAll.js relay      # every suite with "relay" in its name
node spirit/test/runAll.js label
```

The last line is the count, e.g. `63 suites, 1626 green, 2 red` (on 2026-09-15).

**One suite is deliberately left out of that count** and only ever run by
hand: `testTemplate.js`, which fails on purpose — it is the worked example of
what red looks like. It is named in `spirit/test/notASuite.js`, beside the
helpers there that are not suites at all. (`liveRelay.js`, the suite that opened
sockets to spirit-3, was deleted as a stale test in goal/G43.23, 885f1ab5.
`liveFrontDoor.js`, deleted with it, was restored and runs in the harness.)

The lab suites, which spawn real relays and nodes, are in the harness since
2026-09-15 (`runAll.js`, *THE LAB SUITES ARE IN THE HARNESS*); `runAll.js`
starts labMaster before the first lane.

`visualScenarios.js` always runs last, on purpose: it reads the other
suites off disk, so it should be answering for the tree as the run leaves
it.

The world builder this page also described, `spirit/test/labPopulate.js`, was
deleted as a stale test in goal/G43.23 (885f1ab5). The worlds it built,
`spirit/test/visual/*.visual.json`, stay; `visualScenarios.js` and
`presenceShow.js` read them.

---

## 2. The lab panel

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
| **Refresh** | new code, **same node** — copies the tracked tree over the top. Key, relay rows and session all survive. |
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

## What was broken on 2026-09-15

Written down because a silent trap is worse than a red one. Kept as that
day's record: `natterIntrinsic.js` went with Natter (goal/G30.7), and the lab
suites have run in `npm test` since that day (above).

- **`natterIntrinsic.js` — 2 red** in `npm test`. Pre-existing; reproduces
  identically at `fbf9ebf`, before the current run of work started.
- **Nothing in `spirit/test/labMaster/*.test.js` is run by `npm test`.**
  `runAll.js` reads only files sitting *directly* in `spirit/test/`. Five
  of those six lab tests were already red before the ring was deleted, and
  nothing would have told anybody. Numbers in
  `spirit/test/labMaster/STATE.md`.
- **`liveFrontDoor.js` fails before it starts:**
  `could not build the lab: mint alfa: lab owner could not open a stream: 403`.
  That is `labWorld.build`, not the front door it is meant to test. (The
  suite itself was deleted in goal/G43.23.)

## Known gap

**There is no button that removes a peer row from a relay you own.**
The relay's `removePeer` verb (by key, `relay.js`) does it, and has no caller
outside the tests (`labPopulate --down`, its other caller, was deleted in
goal/G43.23); the `/api/hub/remove-peer` route
it once went through is gone. Leaving a relay (`relay.leave`, goal/G40.10) is
a different act: this node gives up its own seat and removes nobody else. So an
orphaned lab row on spirit-3 currently has no broom.
