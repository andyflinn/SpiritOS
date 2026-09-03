# 0001: Proven identity over claimed identity

**Status:** Accepted
**Date:** 2026-09-02

## Context

Every early version of the shell trusted an app to correctly state
facts about itself: a dynamically-loaded app's manifest declared its
own `id`; a user-defined group's identity, if it had had one, would
naturally have been its own editable `name`. Both are examples of the
same pattern — the shell asking an entity "who are you?" and taking
the answer at face value, with nothing to stop a manifest from
claiming an `id` that collided with another app's, or a rename from
silently breaking whatever referenced the old name.

This stopped being a hypothetical concern once app-authored code (and,
later, LLM-generated code via App Builder) became a real category of
"app" the shell has to deal with — code that isn't hand-reviewed the
way the built-in apps are.

## Decision

The shell trusts only what it can directly observe, never what an
entity self-reports about its own identity.

Concretely:

- A dynamically-loaded app's `id` is derived from its own
  `_scriptPath` (`app/<folder>/<folder>.js`, observed via the
  fs-watcher), not read from `manifest.id`. `declareDynamicApp`
  (`shell.js`) ignores a manifest's `id` field entirely if one is even
  present.
- `activateApp` takes no id argument at all (`activateApp(behavior)`,
  not `activateApp(id, behavior)`) — the app's own script has nothing
  left to assert; the shell already knows which script it injected via
  a `pendingActivationId` set immediately before injection.
- A user-defined group's identity is a shell-generated token
  (`'grp_' + Date.now().toString(36)`), never derived from or equal to
  its own `name` — the `name` is exactly the kind of user-editable,
  claimed label that must never double as an identifier. Renaming a
  group only ever changes `preferences.groups[id].name`; the id never
  moves.
- `api.fs` (see 0002) is constructed by the shell from an app's own
  proven `_scriptPath`, never from a string the app supplies to a
  `createScopedFs(name)` call itself.

## Consequences

- An app cannot spoof another app's identity, by accident or on
  purpose — there is no code path through which it could construct or
  claim a different app's id.
- Renaming something (a group, an app's display name via
  `appOverrides`) is always safe — nothing else in the system holds a
  reference to the *name*, only to the proven id.
- The cost is a small amount of indirection: an id is a fact derived
  from something else, not a literal string sitting in a manifest,
  which requires whoever's designing a new proven-identity source to
  actually identify what the shell can observe independently, rather
  than just asking the entity what it wants to be called.
