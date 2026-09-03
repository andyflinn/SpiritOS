# Vision Alignment Review — 2026-09-03

**Author:** Claude (Sonnet 5), at Andy Flinn's request
**Scope:** Whole repo — coherence of vision, status vs. vision, short/mid-term recommendations
**Method:** Read `design/VISION.md`, `design/README.md`, `design/cleanup/MORITURI-TE-SALUTANT.md`,
`design/storage/STORAGE-PHILOSOPHY.md`, `design/principles/NODE-ARCHITECTURE.md`,
`design/spirit-json/ROOT-STRUCTURE.md`, `design/transforms/COMPOUND-REQUEST-SYSTEM.md`,
against the current `spirit/run/` codebase, its real data (`media/`, `published/`), and
this session's own work (proven identity, kernel-privilege, App Builder).

## Coherence: strong where it counts

The core philosophy is genuinely, verifiably reflected in the running code, not just stated:

- **Single-user, no multi-tenancy** — `server.js` has no user table, no auth, no RBAC;
  its entire trust model is loopback + Host-header, matching `NODE-ARCHITECTURE.md`'s
  "no users table, no multi-account support" exactly.
- **Radical simplicity, plain JSON** — `preferences.json`, `conversation.json`,
  `history.json`, media sidecars, the whole `published/` corpus: every one is a flat,
  human-editable JSON file, matching `STORAGE-PHILOSOPHY.md` to the letter. This
  session's own discipline (deleting `loadSpiritModule`, deleting the entire type
  system earlier, retiring ZS4 rather than modernizing it) is the same value in
  practice, not just policy.
- **"Complexity belongs in plugins, never the core"** — this session's kernel-privilege
  arc (see `design/decisions/0002-kernel-privilege.md`) is this principle applied to a
  problem (LLM-generated code) that didn't exist when the principle was written. The
  principle generalized cleanly to something its authors couldn't have anticipated.

## A finding that wasn't expected: further along the vision than the docs admit

`VISION.md` describes the "Media & Memory Vault" as mid-to-long-term future work.
`published/` already has roughly 200 real, scraped content records from andyflinn.com
spanning 1950–2026 — song lyrics, bio pages, show history — and `media/` has 44 real
photos with AI-generated captions and tags, produced by the `imageCaption*`/
`wordpressScanner` process scripts in `process/js/`. This isn't aspirational anymore;
it's a working pipeline with real personal data flowing through it. `VISION.md` should
say so.

## The real gap: Phase 1 of the project's own roadmap hasn't started

`design/cleanup/MORITURI-TE-SALUTANT.md` names Phase 1 as: WebSocket comms, simplified
JSON persistence (done, see above), **public-key identity**, and a **basic consent
engine**. The last two are exactly what everything past this point depends on — Phase 2
(three-node network), and the "Sovereignty"/"Consent-First" pillars from `VISION.md`
itself (peer-to-peer sharing, revocable consent, Spirit Packages). Right now there is no
identity primitive beyond "whoever's running the browser on this machine," and no
consent mechanism at all — not a criticism of sequencing (Spring Cleaning first was the
right call), just the honest current state against the project's own stated next step.

## A tension the docs don't address yet

App Builder calls a hosted, third-party API (Anthropic's Claude) to help build parts of
the node itself. That's a genuinely good, pragmatic capability — but it sits in some
tension with "Sovereignty: the user owns their data, their models, their digital
presence completely." Nothing here says stop; but a system whose own code can be shaped
by an external paid service is worth one honest sentence in the vision docs
acknowledging the tradeoff, rather than leaving it implicit.

## Small, mechanical findings

- Root `README.md`'s "What's running today" list predates this entire session — no
  mention of App Builder, Groups, or kernel-privilege. Quick fix, keeps the one doc
  that's supposed to be the current-state source of truth honest.
- `design/relay/`, `design/thoughts/`, `design/types/` are empty leftover folders.
- `app/contactApp/` is a stray App Builder test artifact still sitting on disk,
  untracked.
- App Builder's validation logic (`validateResponse`, `checkIdentityAvailable`) has no
  permanent regression test yet — tracked in `spirit/currentIssues.md`.

## Recommendations

**Short-term (weeks):**

1. Refresh `README.md`'s current-state section to include App Builder, Groups, and
   kernel-privilege.
2. Promote App Builder's scratch validation tests to `spirit/test/` (tracked, per
   `spirit/currentIssues.md`).
3. Delete/clean the stray empty folders and `app/contactApp/`.
4. Write a short ADR or `VISION.md` addendum naming the hosted-AI-vs-sovereignty
   tension explicitly, and updating the Memory Vault section to reflect that it's real,
   not just planned.

**Mid-term (months):**

1. Public-key identity + a basic consent engine — the actual next roadmap phase, and
   the thing everything past it depends on. Worth noting: kernel-privilege's
   capability-injection model (a peer as a proven identity granted specific, scoped
   capabilities) is a plausible structural head start for consent modeling later — not
   a proposal yet, just a resemblance worth remembering when this phase starts.
2. Reconcile "Personal AI Adapters — train specialized models" (`VISION.md`) with what's
   actually working today (prompting a hosted model well, via a hardened contract) —
   decide if training remains the goal or if "prompt a paid API reliably" is the real
   MVP path, and say so in `VISION.md`.
