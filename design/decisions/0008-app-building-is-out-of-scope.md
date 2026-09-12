# 0008 — App-building is out of scope

**Decided 2026-09-12 by Andy. Measured against `7734ecc`. Nothing removed yet.**

> all we ever will use for production code in the foreseeable future will
> be done in vscode. i want to decide, officially, that this is not the
> job of the basic SpiritOS system. It doesn't belong here right now.
> App-Building is not in the scope of this repo anymore. all we have
> there are dumb toys. no app builder and no type designer.

## The decision

SpiritOS does not generate code. Production code is written in VS Code,
in the checkout, by a person.

Two apps go — **App Builder** and **Type Designer** — and with them the
system-layer doors that exist only so an app can write another app's
entry script and manifest.

The apps that remain are apps. Nothing in the repo builds one.

### AI Manager and AI Chat, and the standard they are held to

> AI manager and AI chat stay for now, we only maintain them enough to be
> mounted in the shell.

Both stay. Neither is in scope for work. **The standard is: it mounts.**
An app that launches, paints, and does not throw is meeting it — no
feature work, no polish, no fixing something that was already broken
before this decision. If one of them stops mounting because something
underneath it moved, it gets the smallest change that makes it mount
again, and nothing more.

"For now" is Andy's word and is kept. This is a holding position, not a
commitment that either survives the next scope question.

### `/api/proxy` stays

> we keep that.

Raised while surveying the POST API, and settled here so a later reading
of "app-building is out" does not sweep it up. It does two jobs and they
have different footholds:

- **CORS circumvention.** A browser cannot `fetch()` LM Studio at
  `localhost:1234` — no `Access-Control-Allow-Origin` — so the page asks
  its own server. Its load-bearing caller is **not an app**: the Jobs
  argument form's model dropdown
  ([index.html:1195](../../spirit/run/index.html#L1195)), which serves
  four process scripts that declare an LM Studio model argument.
- **Credential scoping.** `${ENV:ANTHROPIC_API_KEY}` substituted
  server-side, gated by variable name *and* destination host. Its only
  callers are AI Chat and AI Manager.

Anything **spawned by Jobs needs none of it** — process scripts run in
Node and read `ANTHROPIC_API_KEY` from the environment directly
([imageCaptionClaude.js:22](../../spirit/run/process/js/imageCaptionClaude/imageCaptionClaude.js#L22)).
So if the two AI apps ever went, the substitution machinery would lose
every caller while the route itself would still be held up by that one
dropdown.

## What this supersedes

**[0004 — Type Designer and the codeBuilder category](0004-type-designer-and-codebuilders.md)**
is withdrawn entire. It was Proposed and never implemented; the category
it named ("any system-tier app that generates code") now has no members
and no anticipated members. ProcessBuilder, named there as the next one,
is not coming.

**[0005 — AI Manager and titlebar launchers](0005-ai-manager-and-titlebar-launchers.md)**
loses its premise but not its subject. It was argued from *"every
codeBuilder needs to know if the key is valid"*. With no codeBuilders,
AI Manager still stands on its own: it checks Claude and LM Studio and
writes `app/shared/aiStatus.json`, which **AI Chat reads**. Both stay, at
the mounts-and-nothing-more standard above.

**[0003 — three-tier privilege and manifest protection](0003-three-tier-privilege-and-manifest-protection.md)**
survives and gets stronger, which is worth being exact about. The shell
still reads `owner` and `hidden` from a manifest; the tiers are
unchanged. What goes is the only door through which a browser can
*write* one. `saveFile` already refuses entry scripts and manifests
unconditionally for every caller — `saveAppScript`/`saveAppManifest` are
the two named exceptions to that refusal. Remove them and the refusal
has no exceptions, so the `owner: "user"` forcing that 0003 relies on
becomes structural rather than enforced.

---

## What it costs, measured

### Deleted outright — the apps

| | files | size |
|---|---|---|
| `app/appBuilder/` | 5 | `appBuilder.js` 38.3 KB — the largest app in the repo, plus a 264 KB `log.jsonl` |
| `app/typeDesigner/` | 4 | `typeDesigner.js` 18.4 KB, `walkerTemplate.js` 97 lines |

**Type Designer is already dead.** It reads and writes
`app/shared/types/` ([typeDesigner.js:192, 321-322](../../spirit/run/app/typeDesigner/typeDesigner.js#L321-L322)),
and that directory does not exist — `app/shared/` holds `aiStatus.json`
and `claudeModels.json` and nothing else. The type system was deleted
deliberately; the designer for it outlived it by an unknown number of
commits without anybody noticing. It writes through plain `saveFile`, so
it takes no system machinery with it.

### Deleted — the doors

Only **App Builder** uses these, at
[appBuilder.js:733-734](../../spirit/run/app/appBuilder/appBuilder.js#L733-L734).
They have no other production caller.

| file | what |
|---|---|
| `server.js` | 2 path guards ([442](../../spirit/run/js/server.js#L442), [452](../../spirit/run/js/server.js#L452)), 2 handlers ([482-502](../../spirit/run/js/server.js#L482-L502)), 2 dispatch entries ([1204, 1209](../../spirit/run/js/server.js#L1204-L1212)) |
| `kernel.js` | node-side `saveAppScript` ([347](../../spirit/run/js/kernel.js#L347)) and `saveAppManifest` ([379](../../spirit/run/js/kernel.js#L379)); browser-side XHR wrappers ([702, 721](../../spirit/run/js/kernel.js#L702)) |

The POST API loses `/api/fs/save-app-script` and
`/api/fs/save-app-manifest` — see
[the route hierarchy](../andy/spiritNodeAPI.md).

**Not a caller:** `group-manager` names `saveAppManifest` in a comment
([group-manager.js:12](../../spirit/run/app/group-manager/group-manager.js#L12))
explaining why it sits in its own folder. It calls neither function. The
comment needs rewording, not the app.

### Re-pointed, not deleted

| where | why |
|---|---|
| [`aiManager.js:176-177`](../../spirit/run/app/aiManager/aiManager.js#L176-L177) | two titlebar links to apps that no longer exist. **Cosmetic only** — `addTitlebarLink` returns early on an unknown app id ([shell.js:1062](../../spirit/run/js/client/shell.js#L1062)) and `renderTitlebarLinks` skips it again ([shell.js:1017](../../spirit/run/js/client/shell.js#L1017)). The lines become no-ops; AI Manager still mounts. Delete them for tidiness, not to keep it working. |
| [`preferences.json:16,19`](../../spirit/run/preferences.json) | permission blocks for both apps |
| [`test/pathCanonicalization.js:120`](../../spirit/test/pathCanonicalization.js#L120) | uses `app/appBuilder/appBuilder.js` as the specimen for *"every spelling of this path is unwritable"*. The rule is about `app/` as a directory and must survive — the specimen re-points at an app that stays. Same shape as the `relayLabPing` specimen in the transport cycle. |

### Tests that die with it

| suite | what it proved | what happens |
|---|---|---|
| `test/typeWalker.js` (125 lines) | the walker template interprets an embedded SHAPE | goes with `walkerTemplate.js` |
| `test/writableRoots.js` ~lines 108-186 | *"exactly what `saveFile` refuses, `saveAppScript` exists to allow"* — the mirror-image exception, and `owner:"user"` forcing | the allow half goes; **the refuse half gets stronger** and should be restated as having no exception |
| `test/natterIntrinsic.js:292-373` | an intrinsic app's script and manifest cannot be overwritten *through those two doors* | the attack vector ceases to exist. The protection is not weakened — it becomes unreachable rather than defended. |

That last row is the one to watch. A test that proves "the door refuses
you" is not the same as a door that is not there, and the second is
better — but the suite must say so out loud rather than quietly losing
41 checks.

---

## Recommended sequence (not decided)

1. **Delete the two app folders.** Nothing depends on them; this breaks
   two titlebar links and two `preferences.json` blocks and nothing else.
2. **Re-point the three specimens** — `pathCanonicalization`,
   `writableRoots`, `natterIntrinsic` — so the rules they guard keep a
   living witness before the doors go.
3. **Delete the doors** in `kernel.js` and `server.js`, in that order.
4. **Restate the refusal** in `writableRoots.js`: entry scripts and
   manifests are unwritable from the browser, with no exception.

Steps 2 and 3 belong in one commit. A specimen re-pointed after its
subject is gone is a specimen nobody checked.

## Open

**Does `app/` stay writable?** Yes — apps still write their own data
under `app/<name>/`. This decision removes the ability to write an app's
*code*, not an app's files. Stated because the two are easy to conflate
when reading `writableRoots.js`.

**What the Apps app shows.** Checked — it names no app-creation surface
and does not mention App Builder. Nothing to do there.
