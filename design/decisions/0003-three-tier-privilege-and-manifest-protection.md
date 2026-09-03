# 0003: Three-tier privilege model, system-privilege doors, and manifest protection

**Status:** Accepted
**Date:** 2026-09-03

## Context

0001 established that identity must be proven, never claimed — an app's
`id` comes from its own script path, not from what its manifest says.
0002 built on that: `mount(container, api, params)` hands every app a
small, explicit capability object instead of ambient access to
`spirit.*`, closing the same claimed-vs-proven gap one level down, for
data access rather than identity.

Both of those were framed around a single distinction: hand-written,
reviewed code versus App Builder's generated output. Working through
what happens once a *second* builder tool exists — a hypothetical
"ProcessBuilder" generating spawnable scripts under `process/`, the same
way App Builder generates apps under `app/` — made it clear the real
axis isn't "written by a human" versus "written by an AI" (most of the
kernel itself was drafted by an AI, in this very session, and reviewed
before being trusted). The axis that actually matters is **how much
review something passed through before it's trusted to run**, and
*who decided to ship it* — not who or what typed the first draft.

That reframing surfaced a second, unrelated gap while pressure-testing
it: `APP_ENTRY_SCRIPT_PATTERN` already stops any caller — including an
app's own later runtime code — from overwriting its own
`app/<name>/<name>.js`. Its own comment says plainly that the sibling
`.json` manifest gets no such protection. That was a live loophole even
before this conversation: a Tier-3 app's own scoped `fs.saveFile` can
already rewrite its own `name`/`icon` at runtime, silently bypassing
`checkIdentityAvailable`'s collision check. Recording a privilege tier
in that same manifest would have been pointless without fixing this
first.

## Decision

**Three tiers**, defined by review depth and shipping status, not by
who/what produced the first draft:

- **Kernel** — `kernel.js`, `server.js`, `shell.js`. Unrestricted. Not a
  discoverable app or process; has no manifest to speak of.
- **System** — hand-written, reviewed, git-shipped apps and processes:
  AI Chat, Text Editor, App Builder itself, the `process/js/*` scripts.
  Trusted because each change went through an active review loop
  (proposed, explained, checked, explicitly approved) before a human
  with push authority over `origin` committed it — the "shipping
  boundary." That boundary is a role (whoever controls the canonical
  repo), not tied to a specific person forever.
- **User** — AI-generated apps and processes produced by a builder tool
  (App Builder today; a future ProcessBuilder later) through a
  deliberately lightweight, one-click Apply gate. Same underlying model
  can produce Tier-2 or Tier-3 output; the tier reflects the review loop
  around a given change, not the model's competence.

**System-privilege doors**: a recurring shape for narrow kernel
exceptions, of which `saveAppScript` was the first instance and
`saveAppManifest` (below) is the second. Neither kernel-unrestricted nor
ordinary jailed app-capability — a single-purpose route the kernel
carves out of its own boundary, reachable only for one specific
operation, gated by an explicit user gesture (an Apply click), never a
general grant.

**Manifests are introspectable, never self-writable.** A manifest
belongs to whichever tool created it, never to the app it describes.
`app/<name>/<name>.json` now gets the same protection the entry script
already had:

- `saveFile` refuses any path matching `app/<name>/<name>.json`
  (`MANIFEST_PATTERN`), for every caller, with reason
  `app-manifest-protected` — closing the silent self-rename/re-icon gap.
- A new `saveAppManifest` (mirroring `saveAppScript`'s shape) is the only
  way through: it parses the incoming content as JSON and **force-sets
  `owner: 'user'` unconditionally**, discarding whatever the caller's
  JSON claims for that key. The kernel decides `owner`, never the
  caller. No browser-reachable route can ever produce `owner: "system"`
  or `owner: "kernel"` — those values are only ever set by a direct hand
  edit to the file, outside the running server, which is exactly the
  git-commit shipping boundary already described above.
- App Builder's Apply handler now calls `saveAppManifest` instead of
  `saveFile` for the manifest write, and `buildManifestContent` includes
  `owner: 'user'` explicitly for self-documentation (the kernel enforces
  it independently regardless of what's sent).

## Consequences

- Promotion from Tier 3 to Tier 2 already existed as a mechanism before
  it had a name: it's `git add && git commit`. No new promotion feature
  was needed — the shipping boundary you already control *is* the
  promotion gate.
- Because App Builder's Apply handler writes the manifest identically
  for "create a new app" and "edit an existing app" (including an
  existing Tier-2 app the user deliberately pointed App Builder at via
  the "not built with App Builder" confirm-banner flow), **any App
  Builder edit to an existing app forces its `owner` back to `"user"`,
  even if it was previously `"system"`.** This is intended: an
  AI-driven edit resets trust; only a subsequent human review-and-commit
  re-promotes it.
- `process/<lang>/<name>/<name>.json` process manifests get no
  equivalent protection yet. There is no ProcessBuilder, and `process/`
  already has zero write capability from any app's `api` today, so
  there's no live vulnerability to close there — revisit when a
  ProcessBuilder is actually built, rather than shipping an unused guard
  now.
- `owner` is a new manifest key that `declareDynamicApp` (shell.js)
  doesn't read — it's silently ignored today, the same way a stray
  `manifest.id` already is. No discovery-code change was needed for it
  to coexist; it exists purely as recorded state for now, not yet acted
  on by any enforcement logic beyond the write-time guarantee above.
