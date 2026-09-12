# 2026-09-12 — app-building removed

**Status: OPEN — agreed, not built.**

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

All four sites above. `POST /api/fs/save-app-script` and
`/api/fs/save-app-manifest` reach the fall-through `405`, and
`spirit.core.fs.saveAppScript` / `saveAppManifest` do not exist on either
side of the boundary.

**Verify:** not written.
**Status:** OPEN

### R2 — an app's own code is unwritable from the browser, with no exception
The rule `writableRoots.js` has always stated as "refused, except through
these two doors" becomes "refused". Stated as its own requirement because
it is the *reason* R1 is safe, and because a suite that merely loses 40
checks records a smaller world rather than a stronger one.

**Verify:** not written. Wants the refusal restated in
`spirit/test/writableRoots.js` as absolute, and the mirror-image
exception half (~lines 108-186) removed rather than left passing
vacuously.
**Status:** OPEN

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

**Verify:** not written.
**Status:** OPEN

### R4 — App Builder and Type Designer are deleted
> no app builder and no type designer

`app/appBuilder/` and `app/typeDesigner/`, plus their two blocks in
[`preferences.json`](../../spirit/run/preferences.json) and the two
titlebar lines in
[`aiManager.js:176-177`](../../spirit/run/app/aiManager/aiManager.js#L176).

The titlebar lines are **cosmetic** — `addTitlebarLink` returns early on
an unknown app id and `renderTitlebarLinks` skips it again, so AI Manager
mounts either way.

**Verify:** not written. Wants a check that no manifest, preference or
titlebar link names an app folder that does not exist — which is the
general rule, and catches the next one too.

**Status:** OPEN

### R5 — AI Manager and AI Chat still mount
> AI manager and AI chat stay for now, we only maintain them enough to be mounted in the shell

The standard 0008 sets, made checkable. Both read
`app/shared/aiStatus.json`, which neither deleted app owns, so nothing
should break — which is exactly the kind of claim that wants a check
rather than a sentence.

**Verify:** not written.
**Status:** OPEN
