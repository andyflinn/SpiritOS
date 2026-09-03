# 0005: AI Manager and titlebar app launchers

**Status:** Proposed — design settled, not yet implemented
**Date:** 2026-09-03

## Context

`checkClaudeKeyValidity()` and the Claude model list were deliberately
left duplicated between AI Chat and App Builder in the original App
Builder plan, on the reasoning that the function is small (~15 lines),
mechanical, and unlikely to drift, and that sharing executable code
across separately-loaded dynamic apps would need a script-loading-order
mechanism that doesn't exist and wasn't worth building for two
duplicates.

That calculus changes once Type Designer (0004) and, eventually,
ProcessBuilder also need Claude connectivity — every "codeBuilder" needs
to know if the key is valid and which model to use. Duplicating the
same check across a growing number of apps is exactly the kind of
redundancy the original decision accepted only because the count was
small and fixed at two.

## Decision

**AI Manager: a new, standalone system-tier app** (own icon, own
manifest, `"owner": "system"`) that owns AI configuration as its sole
concern — the real, live Claude-key-validity check, the canonical model
list (superseding the shared `app/shared/claudeModels.json` file
consumers already read), and likely AI Chat's existing LM Studio
configuration too, since that's AI-configuration in general, not
something specific to chat.

**Sharing by status file, not by shared code.** Rather than solving the
dynamic-app code-sharing problem this project has twice now decided
isn't worth solving for a handful of call sites, AI Manager is the only
app that ever performs the live check. It writes the result to a small
shared file other apps just read — e.g. `app/shared/aiStatus.json`:
`{keyValid, lastChecked, selectedModel}`. This is the same cheap,
decoupled, read-a-JSON-file pattern already used everywhere in this
project (manifests, `history.json`, `claudeModels.json`), applied to
configuration status instead of data.

**Titlebar app-launcher icons** — a small icon in a participating app's
title bar that launches another app directly. This is not a new
capability: it's the smallest possible rendering of the `buildAppIcon`/
`launchApp` mechanism the desktop grid already uses, just placed inline
in a title bar instead of as a grid tile. Each codeBuilder (and AI Chat)
gets one linking to AI Manager, so checking or fixing AI configuration
is one click away without leaving the current tool. Uses a normal
(non-`replace`) `launchApp` push — unlike the grid/group-menu case,
which intentionally skips itself in the Back-stack, jumping to AI
Manager should return to wherever you were, so Back must come back to
the calling app, not past it.

## Consequences

- AI Chat needs to be refactored to read AI Manager's status rather
  than performing its own check — a real, if small, migration of
  already-working code, not a net-new build.
- The status file can go stale if AI Manager is never opened (e.g. key
  revoked after the last check) — no background/periodic recheck is
  designed here; a consumer trusts the last-known status until the user
  visits AI Manager again. Worth revisiting if this proves confusing in
  practice.
- `app/shared/claudeModels.json` as App Builder currently reads it gets
  superseded by AI Manager's own canonical list — existing readers need
  to be repointed when this is built, not left reading two sources of
  truth.
- Titlebar launcher icons are generic UI, not AI-Manager-specific —
  once built, nothing stops other apps from using the same small
  mechanism to link to each other for unrelated reasons.
