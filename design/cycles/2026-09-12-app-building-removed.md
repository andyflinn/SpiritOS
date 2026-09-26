# 2026-09-12 — app-building removed

**Status: CLOSED.** Four requirements built and verified; R5 superseded by Andy, 2026-09-26. The header said "all five built and verified" while R3 and R5 both still read OPEN — R3 because its status line was never updated after the work landed, and the AI-apps one because it was never built. Neither was a lie anybody told on purpose, and both are the reason a status line has to be cheap to correct.

Implements [decision 0008](../decisions/0008-app-building-is-out-of-scope.md)
under [the method](README.md). Measured at `7734ecc`.

> that means: save-app-script and save-app-manifest will be removed
> (including the handling code) from the server

---

## What "including the handling code" covers

Four sites, not two. The routes are the visible end of a chain that
crosses the browser/node boundary.

| # | file | what goes |
|---|---|---|
| 1 | `server.js` | 2 dispatch entries ([1204-1212](../../spirit/run/js/server.js#L1204)), 2 handler functions ([477-502](../../spirit/run/js/server.js#L477)), 5 branches of `writeFsResult` ([435-459](../../spirit/run/js/server.js#L435)) |
| 2 | `kernel.js` node side | `saveAppScript` ([347](../../spirit/run/js/kernel.js#L347)), `saveAppManifest` ([379](../../spirit/run/js/kernel.js#L379)) |
| 3 | `kernel.js` browser side | two XHR wrappers ([702](../../spirit/run/js/kernel.js#L702), [721](../../spirit/run/js/kernel.js#L721)) |
| 4 | `app/appBuilder/` | the only production caller ([733-734](../../spirit/run/app/appBuilder/appBuilder.js#L733)) |

**Two of those `writeFsResult` branches are already dead.**
`app-entry-script-protected` and `app-manifest-protected` are handled at
[server.js:435](../../spirit/run/js/server.js#L435) and
[:445](../../spirit/run/js/server.js#L445) and **nothing in the tree
produces them** — the checks moved behind `fileWritable` when it was
extracted as a shared predicate, and `saveFile` has answered every
refusal with plain `forbidden` ever since.
[`writableRoots.js:34-39`](../../spirit/test/writableRoots.js#L34) records
that, so it was known and the branches were left. They go with the rest.

**What stays.** `APP_ENTRY_SCRIPT_PATTERN` and `MANIFEST_PATTERN`
([kernel.js:204, 215](../../spirit/run/js/kernel.js#L204)) are used by
`fileWritable` ([266-267](../../spirit/run/js/kernel.js#L266)) — the
absolute refusal — and by the manifest lookup at
[329-330](../../spirit/run/js/kernel.js#L329). The patterns are how the
system knows what an app's own code *is*; only their use inside the two
save functions goes.

---

## Requirements

### R1 — the two routes and their handlers are gone
> that means: save-app-script and save-app-manifest will be removed (including the handling code) from the server

All four sites, plus a fifth that only became visible once the others
went: **`isIntrinsicApp` and `intrinsicManifestFor` were left with no
caller in the tree.** They answered one question for one pair of callers
— may THIS door overwrite an app the node treats as its own — and were
exported on `spirit.core.fs`, so what remained was kernel API that looks
load-bearing and is not. Removed with them.

The FLAG is untouched, and the distinction matters: `intrinsic` in a
manifest is still read by the shell (`declareIntrinsicApps`) to decide
which apps a person may not remove. A write-time guard for writers that
no longer exist was deleted; the concept was not.

**Verify:** `spirit/test/writableRoots.js` — "an app's own code is
unwritable from a browser with NO exception — saveAppScript and
saveAppManifest no longer exist (0008)"
**Status:** DONE

### R2 — an app's own code is unwritable from the browser, with no exception
The rule `writableRoots.js` has always stated as "refused, except through
these two doors" becomes "refused". Stated as its own requirement because
it is the *reason* R1 is safe, and because a suite that merely loses 40
checks records a smaller world rather than a stronger one.

The exception half of `writableRoots.js` is gone and the rule is stated
in its place — as a check, not a comment, so the ~40 checks that
disappeared read as a stronger claim rather than a smaller world.

**Verify:** `spirit/test/writableRoots.js` — the same check as R1, plus
the surviving refusals either side of it ("an app entry script … is
correctly forbidden", "an app manifest … is correctly forbidden")
**Status:** DONE

### R3 — the specimens outlive their subjects
Three suites use a doomed app or a doomed function as the specimen for a
rule that must survive. Same shape as the `relayLabPing` specimen in
[the transport cycle](2026-09-12-transport-below-the-boundary.md).

- [`pathCanonicalization.js:120`](../../spirit/test/pathCanonicalization.js#L120)
  — `app/appBuilder/appBuilder.js` is the specimen for *"every spelling of
  this path is unwritable"*. Re-point at an app that stays.
- [`natterIntrinsic.js:292-373`](../../spirit/test/natterIntrinsic.js#L292)
  — uses the two functions as the attack vector proving an intrinsic app
  cannot be overwritten. The vector ceases to exist; the protection must
  be re-asserted through `saveFile`, and the suite must say out loud that
  the door is gone rather than defended.
- `test/typeWalker.js` (125 lines) — goes with `walkerTemplate.js`.

**Must land in the same commit as R1.** A specimen re-pointed after its
subject is gone is a specimen nobody checked.

**Verify:** `spirit/test/pathCanonicalization.js` and
`spirit/test/natterIntrinsic.js` — the specimens themselves.
**Status:** DONE — the status line was stale, not the work. Verified
2026-09-26: `pathCanonicalization.js:115-125` records the move in its own
words — *"The non-intrinsic half was app/appBuilder/appBuilder.js until
2026-09-13, when decision 0008 deleted that app. The rule outlives any app,
so the specimen moved rather than the check"* — and
`natterIntrinsic.js:326` carries the removed sections under *"The doors that
could have overwritten it are gone"*.

### R4 — App Builder and Type Designer are deleted
> no app builder and no type designer

`app/appBuilder/` and `app/typeDesigner/`, plus their two blocks in
[`preferences.json`](../../spirit/run/preferences.json) and the two
titlebar lines in
[`aiManager.js:176-177`](../../spirit/run/app/aiManager/aiManager.js#L176).

The titlebar lines are **cosmetic** — `addTitlebarLink` returns early on
an unknown app id and `renderTitlebarLinks` skips it again, so AI Manager
mounts either way.

Both deleted, with the two `preferences.json` blocks and the two
titlebar lines. `spirit/test/typeWalker.js` (125 checks' worth of walker
template) went with `walkerTemplate.js`.

**Leftover data is deliberately NOT deleted.** `git rm` removed the code
and left `app/appBuilder/log.jsonl` — 264KB of generated history — and
`history.json` behind. That is the owner's data, not the repo's to sweep
up, and it registers nothing: every consumer defines an app by its entry
script (`discoverDynamicApps`), not by its directory. The verification
uses the same definition, which is what stops it reporting "still
present" for as long as somebody's old logs survive.

**Verify:** `spirit/test/appReferences.js` — "every app named in
preferences, the shell, index.html or an app script exists on disk", plus
"App Builder and Type Designer are gone". The general rule is the point;
it catches the *next* deletion, which is the only kind of check worth
writing after the fact.

**Status:** DONE

### R5 — AI Manager and AI Chat still mount
> AI manager and AI chat stay for now, we only maintain them enough to be mounted in the shell

The standard 0008 sets, made checkable. Both read
`app/shared/aiStatus.json`, which neither deleted app owns, so nothing
should break — which is exactly the kind of claim that wants a check
rather than a sentence.

**Where they went, 2026-09-26:** [andyflinn/aiChat](https://github.com/andyflinn/aiChat)
and [andyflinn/aiManager](https://github.com/andyflinn/aiManager), public, the same
shape as [andyflinn/relayChat](https://github.com/andyflinn/relayChat) before them — on Andy's
word — *"you make the repos, like with relay chat, all authorized, just get
them out of here."* Each holds its entry script, its manifest and a README
saying what it needs; `app/shared/claudeModels.json` travelled with AI
Manager because it is that app's data. `app/shared/ask.js` STAYED — it is
used by `appServer.js`, `starter/starter.html` and three suites.

**Nothing had to be unwired**, which is the part worth recording: discovery
is by manifest, the kernel and the shell never imported either app, and the
only references were two comments, one untracked `preferences.json` entry
each, and a single test string. An app leaving this repository costs four
lines, and that is the property the app model was built for.

**The coupling that survives the split:** AI Chat reads
`app/shared/aiStatus.json`, which AI Manager writes. Two separately installed
apps sharing one file path is now their contract rather than an internal
detail — and it is the miniature of
[PUBLIC-APP-SERVER](../shell/PUBLIC-APP-SERVER.md)'s open question about app
code and app state sharing a directory.

**Verify:** not written, and not to be written.
**Status:** DEFERRED: the two apps leave this repository — Andy, 2026-09-26: *"AI manager and AI chat will be pushed to public repos outside of SpiritOS"*, which replaces his *"stay for now"* above. The check this requirement asked for would assert something the product no longer promises, so there is nothing to build here; their departure is its own work.