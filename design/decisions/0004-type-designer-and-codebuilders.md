# 0004: Type Designer and the codeBuilder category

**Status:** Proposed — design settled, not yet implemented
**Date:** 2026-09-03

## Context

Real usage of App Builder surfaced a clear pattern: a vague prompt
("make me a contact list manager") tends to produce nothing useful, but
a prompt that spells out the data's exact shape and behavior (a table
of records, loaded at launch, autosaved on every change) produces
consistently good results. Requiring the user to retype that level of
detail in prose every time doesn't scale, and hand-writing it invites
drift between apps that should agree on the same shape.

At the same time, a second code-generating tool is clearly coming — a
future "ProcessBuilder" for spawnable scripts, mirroring App Builder for
`process/` the way App Builder covers `app/`. Anything built to solve
this for App Builder alone would need solving again for ProcessBuilder,
and worse, an app and a process script that need to agree on the same
data shape (e.g. a contact-list app and a bulk-import script) would have
no way to do so if each tool's notion of "shape" were private to it.

This project already deleted a general-purpose type system once,
deliberately, and has been steering the kernel toward needing less
structure over time, not more. Any design here has to earn its way past
that history rather than re-argue it — the tests applied throughout were
"does this add a new thing the kernel must understand," and "does this
commit to *how types get used* before that's actually decided."

## Decision

**"codeBuilder" becomes a named category**, not a new kernel concept: any
system-tier app that generates code reviewed via a chat-request/Apply
cycle. App Builder is the first; ProcessBuilder is the anticipated
second. They share conventions and a common dependency, never shared
executable code.

**Type Designer is a new, standalone system-tier app** — its own icon,
its own manifest (`"owner": "system"`), not owned by or embedded in App
Builder. It's a shared dependency every codeBuilder knows about, the
same relationship App Builder already has with `app/shared/claudeModels.json`,
now generalized to `app/shared/types/`.

**Type format: a plain nested JSON tree**, not a schema language.
- Top level is always an object (a named type can't itself be a bare
  array or primitive).
- A leaf is either a primitive type-name token (starting vocabulary:
  `string`, `number`, `boolean`, `date` — extended only when a real app
  needs one) or another nested object.
- An array is represented as a single-element array whose one element
  describes the item's shape (a token, an object, or another array) —
  no new syntax, just a documented reading convention on top of
  ordinary JSON.
- **No inheritance.** Composition only — a field can reference another
  named type (has-a), but nothing extends or subclasses another type.
  This keeps every type self-contained and readable top-to-bottom, with
  no override-resolution semantics to ever reason about.

This is deliberately *not* a schema-validation language — a leaf token
like `"date"` carries no enforced semantics (format, range, etc.) beyond
what the compiled module (below) mechanically implements. Extending it
into real validation rules (patterns, bounds, required-ness beyond
presence) is explicitly out of scope, the same call already made once
about not building a general type/validation system.

**Interaction model matches App Builder's**, not a bespoke tree-editor
UI: natural-language requests ("add a member `birthday`, type `date`")
edit an in-memory draft, reviewed before anything is kept. Nothing
touches disk mid-conversation — only an explicit Save persists the tree
JSON and its compiled module together, atomically, so the two can never
disagree on disk and no half-designed draft is ever visible to a
codeBuilder reading the shared registry.

**The finished module is compiled, not Claude-authored.** Every type
module exposes the same fixed interface — `validate(obj)`, `serialize(obj)`,
`deserialize(raw)`, `createEmpty()` — generated deterministically by
plain Tier-2 code from the tree, not written fresh by Claude on each
request. For a tree limited to primitives, composition, and arrays with
no inheritance, shape-checking and (de)serialization (e.g. converting a
`date` field to/from an ISO string) are mechanical problems with one
correct answer, not ones needing judgment. Claude's only job in this
loop is translating a fuzzy natural-language request into a precise
tree edit — exactly the kind of narrow, structured task the App Builder
model already handles well — never generating the validate/serialize
logic itself. This is a stronger reliability guarantee than App
Builder's own generated code gets, because the risky part (structural
correctness) is never re-derived per call at all.

**Consumption: concatenation into the fixed header, not a runtime
reference.** When a codeBuilder generates or edits an app/process that
uses a named type, the compiled module's source is concatenated
verbatim into the generated file's fixed, non-modifiable header —
alongside the existing skeleton preamble, in the same
`//FILE_BEGINNING`/`//START_OF_MODIFIABLE_SECTION` zone `appBuilder.js`
already protects. The consuming file gets its own physical copy, not an
import (there's no module loader in this codebase — every app is a
plain top-level `<script>`). Re-synced to the current version on every
Apply, not frozen at first use, matching the policy already governing
the manifest.

## Consequences

- `buildMessages`/`validateResponse` in `appBuilder.js` currently treat
  the fixed header as one constant (`SKELETON_JS`) — this design
  requires them to build and check against a *per-app composed* header
  (skeleton + whichever type module(s) this app references) instead.
  Real, mechanical implementation work, not yet done.
- Because each consuming app/process gets a frozen, re-synced-on-Apply
  copy rather than a live reference, two apps built against the same
  type at different points in time can end up with divergently-versioned
  copies if one hasn't been re-Applied since the type last changed. This
  is an accepted tradeoff of "no auto-rippling" (already the policy for
  manifests), not something this design solves.
- No protection mechanism (analogous to the manifest's `saveAppManifest`
  door) has been designed yet for `app/shared/types/*` itself — worth
  revisiting once Type Designer is actually built, following the same
  "introspectable, not self-writable by a Tier-3 consumer" principle if
  it turns out to matter in practice.
- ProcessBuilder gets this shared dependency for free once it exists —
  no separate type-design tooling to build for it.
