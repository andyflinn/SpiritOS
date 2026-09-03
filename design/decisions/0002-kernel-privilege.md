# 0002: Kernel privilege — capability injection over ambient authority

**Status:** Accepted
**Date:** 2026-09-03

## Context

Every app's `mount(container, params)` reached out to a global object
(`window.spirit`) for anything it needed — `spirit.core.fs.createScopedFs('<itsOwnName>')`,
`spirit.shell.escapeHtml`, a raw `fetch('/api/proxy', ...)`. Nothing
about this was actually enforced: an app could call
`createScopedFs('someOtherApp')` and there was no mechanism to stop
it — the same claimed-vs-proven-identity gap 0001 already closed for
an app's own id, just recurring one level down, in what data an app
could reach.

This became a live concern once App Builder started generating app
code from a chat request. Two separate problems pointed at the same
fix:

1. **Security** — the same claimed-identity gap as 0001, applied to
   data access instead of app ids.
2. **Prompt reliability** — a deep, open-ended global namespace
   (`spirit.core.fs.*`, `spirit.shell.*`) pattern-matches against a huge
   number of real-world JS libraries an LLM has seen in training, which
   invites hallucinating plausible-sounding siblings that were never
   actually documented (`spirit.core.fs.readFile`, etc.). A small,
   flat, explicitly-passed parameter has no such implied hierarchy to
   guess at.

## Decision

`mount(container, api, params)` replaces `mount(container, params)`
everywhere — every built-in app and every dynamic app. `api` is
constructed by the shell (`buildApiFor`, `shell.js`) at the moment an
app is mounted, from that app's own proven `_scriptPath` (0001), and
handed in; the app is never given a string to construct its own scope
with.

`api` today:

- **`api.fs`** — `{loadFile, saveFile, deleteFile, fileStats,
  scanDirectory}`, scoped to the app's own folder. Built-in apps (no
  folder of their own) don't get this member.
- **`api.escapeHtml(str)`** — HTML-escapes a string.
- **`api.fetchExternal(url, options)`** — the only way to reach an
  external API, returning a `Promise` of the already-parsed JSON
  response. Hides the `/api/proxy` wire envelope
  (`method`/`headers`/`body`/`timeoutMs` nested just so) behind a
  plain call, the same way `api.fs.loadFile` already hides the jailed
  path resolver behind a bare filename.

`api` is deliberately small and grown only when something concrete
needs it — it is not a mirror of everything `spirit.*` already
exposes. `escapeHtml` and `fetchExternal` were folded in specifically
to close the last documented "exception" to "everything is `api`" —
a contract with carve-outs invites exactly the guessing this design
exists to prevent.

App Builder's whole taught contract for this — `mount`'s signature,
`api`'s exact shape, the response format — lives in one place,
`spirit/run/app/appBuilder/preamble.md`, loaded fresh and sent to
Claude verbatim. A hand-maintained JS string describing the same
contract could say something different from what's actually asked of
the model; this file *is* the prompt, not a description of it.

## Consequences

- An app cannot construct another app's `api.fs`, or reach one it
  wasn't handed — there is no code path through which it could.
- Existing hand-written apps (`aiChat.js`, `textEditor.js`,
  `appBuilder.js` itself) were migrated to use `api.escapeHtml`/
  `api.fetchExternal` for consistency, not just left as an example for
  future generated code — real apps dogfood the same contract Claude
  is taught. Two deliberate exceptions remain: `index.html`'s built-in
  apps share one `escapeHtml` alias across a common closure (a
  structurally different pattern from per-app dynamic apps), and Text
  Editor's `spirit.core.fs.loadFile`/`saveFile` calls stay unscoped,
  since editing arbitrary paths anywhere in the tree — not just its
  own folder — is its actual job.
- Every `mount` call site (7 built-in apps, 2 viewers, 3 dynamic apps)
  had to migrate in the same pass — this is a breaking change to a
  call signature, not something that can land piecemeal without
  silently shifting `params` into the wrong argument slot for whatever
  hasn't been updated yet.
- Widening what an app can reach later (a new `api` member) is cheap;
  narrowing it is not, since existing apps may already depend on
  whatever's there. `api`'s membership should stay deliberate.
