# SpiritOS Design & Architecture

This directory contains the vision, principles, and architecture decisions for **SpiritOS** — the sovereign personal operating system for your digital spirit.

## Core Principles
- [Node Architecture Principles](principles/NODE-ARCHITECTURE.md)
- [Storage Philosophy](storage/STORAGE-PHILOSOPHY.md)

## Spring Cleaning
- [Morituri Te Salutant — Execution Roadmap](cleanup/MORITURI-TE-SALUTANT.md)
- [Icon convention](cleanup/2026-09-11-icon-convention.md) — what the circles
  fixed, and what is still outstanding repo-wide.
- [The live surface has no tests](cleanup/2026-09-11-live-surface-tests.md) —
  the harness proves logic in process and has never seen TLS, Caddy or a held
  connection. Presence is the first thing that depends on all three.

## Decisions
- Dated Architecture Decision Records — why a specific technical choice was made, not
  just what it is. See [decisions/](decisions/).
- [0006 — Fast and true, not guaranteed](decisions/0006-fast-and-true-not-guaranteed.md)
  — a relay delivers or refuses, and stores nothing. Changes what a relay *is*.

## Relay
- [Peer Devices](relay/PEER-DEVICES.md) — every identity attaching its own
  browsers. Designed, not built; the owner-only version shipped as device
  cycles 1–5.
- [The "Add one of my own devices" panel](relay/DEVICE-PANEL.md) — the surface
  in Natter for attaching a browser. Built; §7 also carries the rendezvous rule,
  which is why enrolment is certain rather than likely.
- [Presence](relay/PRESENCE.md) — the first cut of that wire, carrying who is
  reachable and nothing else. Staged, and the precondition for decision 0006.
- [The relay doorbell](relay/EVENT-STREAM.md) — one held connection per identity
  instead of polling. The destination; PRESENCE.md is the route to it.

## Reviews
- Periodic point-in-time assessments of status against vision. See [reviews/](reviews/).

## Future Layer (not yet implemented)
- [Root Structure — spirit.json](spirit-json/ROOT-STRUCTURE.md)
- [Compound Request & Transform System](transforms/COMPOUND-REQUEST-SYSTEM.md)

## Archive
- Superseded design thinking, kept for the record rather than as current
  or planned direction — see [archive/](archive/).

## Other
- More documents will be added as we progress.