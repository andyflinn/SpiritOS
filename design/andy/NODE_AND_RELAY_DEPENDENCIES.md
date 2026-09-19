# What each server would depend on, separated

> Andy: "illustrating exactly how many other modules, and which modules, these
> two servers would depend on, if or when they're separated from each other."

**Measured, not estimated.** Every count below was taken from the tree at
commit `e647e60` (2026-09-16), and the runtime figures come from booting each
mode and reading `require.cache` rather than from reading `require` lines.
Re-derive with the method in §7.

Feasibility and shape only. Nothing here is a plan to build.

---

## 1. The short answer

| | modules | lines |
|---|---|---|
| A relay **loads** today | 22 | ~11,100 |
| A relay **uses** | **11** | **6,881** |
| Loaded on the public box and never reached | **11** | **4,257** |
| A node **loads** today | 27 | — |
| A node **uses** | 21 | — |

**Separation is already nine-tenths done and is not expressed anywhere.** The
relay's whole public surface is 8 API paths and 4 files
([server.js:801-850](../../spirit/run/js/server.js#L801-L850)), and everything
behind it is reachable from one module. What stops the two being two products
is not entanglement; it is that `server.js` is a single 1,738-line file that
boots either, and that a `--relay` process therefore loads the node's half and
leaves it sitting in memory.

After a split the sets are:

```
RELAY ONLY   relay.js  presence.js  router.js  relayStatus.js
             invites.js  labelRule.js                      6 modules   3,194 lines

SHARED       relayAuth.js  deviceAuth.js  buildStamp.js     3 modules     855 lines
             + part of kernel.js — see §4, it is two things

NODE ONLY    hub.js  trafficLog.js  ownerBadge.js  jobs.js  whoBook.js
             packet.js  arrivals.js  verbTable.js  peerStats.js
             relayKeys.js  peerFile.js  answerRelay.js  deviceTick.js
             peerPost.js  presenceNode.js  sseClient.js
                                                        16 modules
             + client/shell.js  client/browser.js  iconIndex.js
               chatLog.js  (2,928 lines, browser-served)
             + all of app/      (14 files, 6,888 lines)
```

**Three whole modules plus one slice of a fourth is the entire shared
surface.** That is the number worth holding on to.

---

## 2. What the relay actually uses

Closure of `relay.js`, plus the entry point:

| module | lines | why the relay has it |
|---|---|---|
| `server.js` | 1,738 | the seam — see §5 |
| `relay.js` | 2,352 | claim, census, post/reply, stream, partner flag |
| `kernel.js` | 1,094 | constants and one path helper — **never `core.fs`**, see §4 |
| `relayAuth.js` | 436 | signatures, `allow.json`, identity |
| `deviceAuth.js` | 275 | pulled in by `relayAuth.js` |
| `invites.js` | 228 | the waiting room |
| `router.js` | 170 | deliver or refuse |
| `labelRule.js` | 157 | a caption is not an identity |
| `presence.js` | 146 | who is holding a stream |
| `relayStatus.js` | 141 | the owner's report |
| `buildStamp.js` | 144 | `/api/version` |

Public surface, from `isRelayPublicPath`:

```
GET  /  /index.html  /relay.html  /favicon.svg  /api/version
GET  /api/relay/who       /api/relay/stream
POST /api/relay/claim     /api/relay/device
POST /api/relay/post      /api/relay/reply
```

`relay.html` is 22 lines and **loads no scripts** — two `href`s to GitHub and
nothing else. So a relay needs none of `client/`, none of `app/`, and no icon
or chat-log module. The browser half of this system is entirely node-side.

---

## 3. What a relay carries and never touches

Loaded by a `--relay` process, reached by nothing on it:

| module | lines | note |
|---|---|---|
| `hub.js` | 1,521 | every use is inside `if (!relayMode)`, [server.js:1377-1696](../../spirit/run/js/server.js#L1377-L1696) |
| `trafficLog.js` | 531 | **see below** |
| `ownerBadge.js` | 481 | the node's view of relays it uses |
| `jobs.js` | 327 | **see below** |
| `whoBook.js` | 289 | never uploaded, and not the relay's |
| `packet.js` | 253 | the relay carries packets without parsing them |
| `arrivals.js` | 236 | subscribed only from `/api/events`, which a relay 404s |
| `verbTable.js` | 170 | the loopback door, which a relay does not open |
| `peerStats.js` | 164 | per-peer counting, node-side |
| `relayKeys.js` | 161 | pinning — what a *member* does |
| `peerFile.js` | 124 | the node's own files |

**`trafficLog.js` is the one to look at.** Its own header
([trafficLog.js:50-57](../../spirit/run/js/trafficLog.js#L50-L57)) says it
holds messages themselves, in and out, and that a relay keeping this file
"would be holding everybody's messages — not metadata, the content — which is
a far worse thing than the ring 0006 deletes". It ends: *"the only thing
between the two is the gate in note() below."*

That gate is `if (relayMode || !rootDir || !entry) return null;` — a boolean,
evaluated per call, in a module that is **present and constructed on the public
box**. Nothing is written today. But the distance between "a relay stores
nothing on anyone's behalf" and a relay storing everything is one flag, and
decision 0006 is the reason that matters. Separation turns a runtime promise
into an absence.

**`jobs.startFsWatcherJob(ROOT_DIR)` runs unconditionally.**
[server.js:178](../../spirit/run/js/server.js#L178) sits above every mode gate,
and `startFsWatcherJob` ([jobs.js:139](../../spirit/run/js/jobs.js#L139)) has
no relay check. So a public relay scans its entire root directory, builds a
file list, creates a permanent job and installs an `fs.watch` — for the Files
app, which a relay never serves. Verified by reading; not a hypothetical.

---

## 4. The couplings that would have to be cut

Four, and three are one-liners.

**`kernel.js` is two modules under one name, and only one of them is shared.**

This is the coupling worth the most attention, and the first version of this
document got it wrong — it said the relay carried the kernel for a single
constant in `relay.js`. It does not. `server.js:4` requires it unconditionally
and reads `ROOT_DIR`, `MIME_TYPES` and `DEFAULT_SPIRIT_PORT` from it
([server.js:87-105](../../spirit/run/js/server.js#L87-L105)) before any mode
branch exists. A relay needs those.

What a relay never touches is the other half. All seventeen `spirit.` uses in
`server.js` fall into two groups:

- **`core.const`, `core.node.const`, `core.node.util`** — constants, paths, MIME
  types. Both sides.
- **`core.fs.*`** — `statFile`, `saveFile`, `deleteFile`, `annotateFile`,
  `getAnnotations`, `fileServable`. Every call site is a `fs.*` verb behind the
  loopback door, i.e. node-only. The one apparent exception,
  `fileServable` at [server.js:1124](../../spirit/run/js/server.js#L1124), is
  short-circuited on a relay: its four static files are all in `BOOT_ASSETS`
  ([server.js:175](../../spirit/run/js/server.js#L175)), which is tested first,
  and anything else is already 404 by then.

So the split of `kernel.js` is along a line that is already visible in the API:
a relay wants the constants, and must not be given the filesystem capability
surface at all. That is a more interesting separation than moving a module.

**`relay.js` → `kernel.js` is still a redundant edge.**
[relay.js:2112](../../spirit/run/js/relay.js#L2112) is the file's only
reference — `require('./kernel').core.const.VERSION` — and `buildStamp.js` is
already the module for "what build is this" and already on both sides. Cutting
it does not unload anything today (see above), but it means the *relay product*
would not name the kernel at all.

**`hub.js` → `invites.js` is dead.** [hub.js:9](../../spirit/run/js/hub.js#L9)
binds it and the binding is never used — the only other mentions in the file
are two comments. Delete the line and `invites.js` is relay-only with nothing
else to decide.

**`labelRule.js` has exactly one caller**, `relay.js:82`. It is relay-side
today. Worth a second look before a split: a node that never validates a label
it *displays* is trusting a relay to have done it.

**`server.js` is the real work.** It is the only file both products need and
the only one that cannot simply be assigned to a side. Its mode branches are
already clean and explicit — `relayMode` appears at 20 sites, the node's boot
is one contiguous block at lines 1377-1696, and the relay's public surface is
one function. It is a split along lines that exist, not a rewrite.

---

## 5. What the separation does *not* give you

**Not a smaller attack surface on the wire.** The relay already refuses
everything outside `isRelayPublicPath` with a 404 before any handler runs
([server.js:895](../../spirit/run/js/server.js#L895)). Removing the modules
removes code that is loaded, not code that is reachable.

**Not a second implementation of anything.** Three shared modules is small
enough that a shared package is probably not worth its own release cycle;
vendoring a copy into each product and letting them diverge is a real option,
and `relayAuth.js` is the one where divergence would actually hurt.

**Not the end of "a node can act as a relay".** Verified live at `e647e60`: a
personal node with no `--relay` answers `GET /api/relay/who` with HTTP 200 and
a `relayPublicKey` of its own. Every node mints a relay identity. That is what
labMaster's local relays are, and a split would have to say explicitly whether
it survives — as a build flag, a second entry point, or not at all.

---

## 6. Decided / Recommended / Open

**Decided** (recorded elsewhere, not by this document)
- A relay stores nothing on anyone's behalf — decision 0006.
- One operator; root is spirit — `bash/ONE-OPERATOR.md`.
- The log is permanent, and it is the *node's* — decision 0009.

**Recommended** (cheap, correct whether or not anything is ever separated)

1. **Guard `server.js:178` with `if (!relayMode)`.** The only one with a
   behaviour change today: a public relay stops scanning its whole root at boot
   and stops holding an `fs.watch` on it, for an app it does not serve.
2. **Delete `hub.js:9`.** Dead import, zero risk, and it settles `invites.js`
   as relay-side with nothing left to decide.
3. **Take `relay.js:2112` onto `buildStamp.js`.** So the relay's own module
   does not name the kernel.

**None of these makes a running relay smaller**, and saying otherwise was the
error in the first draft of this document. `kernel.js` and `jobs.js` are both
required unconditionally by `server.js` (lines 4 and 177), so a relay goes on
loading them until `server.js` itself is split. What (1) buys is a real
behaviour: no scan, no watcher. What (2) and (3) buy is that the module graph
stops asserting dependencies that are not real — which is what makes §1's
table trustworthy, and it is the table a split would be planned from.

The savings in §3 are what a **separated** relay would not ship. They are not
available by tidying.

**Open** (needs a decision, not an implementation)
- Does a personal node keep its relay identity and its `who` route (§5)?
- Shared package, or vendored copies that may diverge (§5)?
- Does `labelRule.js` belong on the node as well (§4)?
- ~~Is `server.js` split into two files, or one file with two entry points?~~
  **Decided 2026-09-19 (Andy):** separate startup modules for node and relay
  — the first step of the separation. See
  [NODE-AND-RELAY.md](../principles/NODE-AND-RELAY.md), Open, *one tree or
  two*. *This document's counts are from `e647e60` and stale; a static
  re-count at `c3cd6d0` puts `labelRule.js` in the shared core (via
  `nodeCard.js`) and `peerSearch`, `gradedSearch`, `bucket` relay-only.*

---

## 7. How to re-derive this

The static graph is `require()` lines; the runtime figures are the ones that
matter, and they were taken by setting `process.argv`, requiring
`js/server.js`, and reading `require.cache` after boot — in a throwaway node
root from `spirit/test/setupRelayFakes.js`, never the repo.

```
relay: 22 modules loaded     node: 27 modules loaded
node-only at boot: answerRelay.js deviceTick.js peerPost.js
                   presenceNode.js sseClient.js
relay-only at boot: (none)
```

**"Relay-only: none" is the finding.** A relay loads a strict subset of what a
node loads. There is nothing on the public box that a personal node does not
already run — which is why the split is a subtraction rather than a divorce,
and why nobody has been forced to do it.

---

*Counts and line references verified at `e647e60`, 2026-09-16. Anything below
`spirit/run/js/` moves quickly; re-run §7 before acting on a number.*
